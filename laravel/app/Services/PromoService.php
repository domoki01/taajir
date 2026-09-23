<?php

declare(strict_types=1);

namespace App\Services;

use App\Enums\Permission;
use App\Models\AuditEntry;
use App\Models\Promo;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Intervention\Image\Drivers\Gd\Driver;
use Intervention\Image\Encoders\WebpEncoder;
use Intervention\Image\ImageManager;

/**
 * ── ADVERTISING BANNERS ──────────────────────────────────────────────────────
 * The carousel on the home page.
 *
 * Ported from src/server/actions/promos.ts. Every method re-checks the
 * permission rather than trusting it was reached through /admin: the page guard
 * and the action guard protect against different mistakes.
 */
final class PromoService
{
    public const MAX = 10;

    public const MAX_BYTES = 4 * 1024 * 1024;

    /** One width. A banner is one image in one slot, not a responsive gallery. */
    private const WIDTH = 1600;

    /**
     * @throws ValidationException
     */
    public function create(User $actor, UploadedFile $image, string $title, string $link): Promo
    {
        $this->ensure($actor);

        $title = $this->cleanTitle($title);
        $link = $this->safeLink($link);

        if (Promo::query()->count() >= self::MAX) {
            $this->refuse('image', __('admin.promos.too_many', ['max' => self::MAX]));
        }

        $stored = $this->store($image);

        // Appended to the end; the admin reorders afterwards.
        $order = (int) Promo::query()->max('order') + 1;

        $promo = Promo::create([
            'image_url' => $stored['url'],
            'storage_path' => $stored['path'],
            'width' => $stored['width'],
            'height' => $stored['height'],
            'link_url' => $link,
            'title' => $title,
            'is_active' => true,
            'order' => $order,
        ]);

        AuditEntry::record($actor, 'promo.create', 'promo', (string) $promo->id, ['note' => $title]);

        return $promo;
    }

    /** @throws ValidationException */
    public function update(User $actor, Promo $promo, string $title, string $link): void
    {
        $this->ensure($actor);

        $promo->update([
            'title' => $this->cleanTitle($title),
            'link_url' => $this->safeLink($link),
        ]);

        AuditEntry::record($actor, 'promo.update', 'promo', (string) $promo->id, ['note' => $promo->title]);
    }

    public function setActive(User $actor, Promo $promo, bool $active): void
    {
        $this->ensure($actor);

        $promo->update(['is_active' => $active]);

        AuditEntry::record($actor, $active ? 'promo.show' : 'promo.hide', 'promo', (string) $promo->id);
    }

    /**
     * Swap a banner with its neighbour.
     *
     * In a transaction, and written back by *position* rather than by swapping
     * the two stored values: two banners sharing an `order` render in an
     * arbitrary sequence, which is exactly the complaint the agency that paid
     * for the first slot would make. Rewriting every row by its index leaves no
     * ties behind, whatever the table looked like going in.
     */
    public function move(User $actor, Promo $promo, string $direction): void
    {
        $this->ensure($actor);

        DB::transaction(function () use ($promo, $direction): void {
            $all = Promo::query()->orderBy('order')->orderBy('id')->lockForUpdate()->get()->all();

            $index = null;
            foreach ($all as $i => $row) {
                if ($row->id === $promo->id) {
                    $index = $i;
                    break;
                }
            }

            if ($index === null) {
                return;
            }

            $target = $direction === 'up' ? $index - 1 : $index + 1;
            if ($target < 0 || $target >= count($all)) {
                return;
            }

            [$all[$index], $all[$target]] = [$all[$target], $all[$index]];

            foreach ($all as $position => $row) {
                $row->update(['order' => $position]);
            }
        });
    }

    public function delete(User $actor, Promo $promo): void
    {
        $this->ensure($actor);

        $path = $promo->storage_path;
        $title = $promo->title;
        $id = (string) $promo->id;

        $promo->delete();

        // Best effort: an orphaned file costs pennies, while a failed delete
        // that blocked removing a banner would cost the admin the ability to
        // pull a bad advert.
        if ($path !== '') {
            try {
                Storage::disk('public')->delete($path);
            } catch (\Throwable $e) {
                report($e);
            }
        }

        AuditEntry::record($actor, 'promo.delete', 'promo', $id, ['note' => $title]);
    }

    /**
     * The uploaded banner, resized once and written as WebP.
     *
     * @return array{url: string, path: string, width: int, height: int}
     */
    private function store(UploadedFile $file): array
    {
        $image = (new ImageManager(new Driver))->decodePath($file->getRealPath());
        // A banner is usually exported rather than shot, but an image that came
        // off a phone still carries its rotation in EXIF.
        $image->orient();
        $image->scaleDown(width: self::WIDTH);

        $path = 'promos/'.Str::random(16).'.webp';
        Storage::disk('public')->put($path, (string) $image->encode(new WebpEncoder(quality: 82)));

        return [
            'url' => Storage::disk('public')->url($path),
            'path' => $path,
            'width' => $image->width(),
            'height' => $image->height(),
        ];
    }

    /**
     * An href built from stored text gets the same treatment as any other
     * untrusted URL.
     *
     * `javascript:` and `data:` are executable in an href, and the admin panel
     * being staff-only is not a reason to leave that open — a banner is the one
     * thing on the home page every visitor sees.
     *
     * @throws ValidationException
     */
    private function safeLink(string $raw): string
    {
        $value = trim($raw);

        // A site-relative path is the common case: a banner usually points at
        // an agency's own listings here. `//evil.dz` is protocol-relative, not
        // a path.
        if (str_starts_with($value, '/') && ! str_starts_with($value, '//')) {
            return $value;
        }

        $scheme = parse_url($value, PHP_URL_SCHEME);
        if (! in_array($scheme, ['http', 'https'], true) || parse_url($value, PHP_URL_HOST) === null) {
            $this->refuse('link_url', __('admin.promos.bad_link'));
        }

        return $value;
    }

    /** @throws ValidationException */
    private function cleanTitle(string $raw): string
    {
        $title = trim($raw);

        // It is the alt text as well as the label, so an empty one costs a
        // blind visitor the whole slide.
        if (mb_strlen($title) < 2 || mb_strlen($title) > 140) {
            $this->refuse('title', __('admin.promos.bad_title'));
        }

        return $title;
    }

    private function ensure(User $actor): void
    {
        abort_unless($actor->hasPermission(Permission::PromosManage), 403);
    }

    /** @throws ValidationException */
    private function refuse(string $field, string $message): never
    {
        throw ValidationException::withMessages([$field => $message]);
    }
}
