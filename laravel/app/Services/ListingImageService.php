<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Intervention\Image\Drivers\Gd\Driver;
use Intervention\Image\Encoders\WebpEncoder;
use Intervention\Image\ImageManager;

/**
 * Photos, resized once at upload rather than on every request.
 *
 * `next/image` goes away in the port and nothing in PHP replaces it for free.
 * Shared hosting cannot afford per-request transcoding — which is the same
 * reason `NEXT_IMAGE_UNOPTIMIZED=true` was set on the cPanel deployment — so
 * the work happens once, here, and the page emits a plain `<img srcset>`.
 *
 * Three widths, WebP. A listing gallery on a phone over 3G is most of what this
 * site costs its users, and the original off a modern phone camera is four
 * megabytes of it.
 */
final class ListingImageService
{
    /** Mirrors storage.rules: what the old bucket would accept. */
    public const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];

    public const MAX_BYTES = 6 * 1024 * 1024;

    /** @var list<int> */
    private const WIDTHS = [400, 800, 1600];

    private ImageManager $manager;

    public function __construct()
    {
        // GD rather than Imagick: it is the one always present on shared
        // hosting, and nothing here needs what Imagick adds.
        $this->manager = new ImageManager(new Driver);
    }

    /**
     * @param  list<UploadedFile>  $files
     * @return list<array{url: string, storage_path: string, width: int, height: int}>
     */
    public function store(array $files, string $ownerUid, string $listingId): array
    {
        $stored = [];

        foreach ($files as $file) {
            if (! $this->acceptable($file)) {
                continue;
            }

            $stored[] = $this->one($file, $ownerUid, $listingId);
        }

        return $stored;
    }

    /** @return array{url: string, storage_path: string, width: int, height: int} */
    private function one(UploadedFile $file, string $ownerUid, string $listingId): array
    {
        $directory = "listings/{$ownerUid}/{$listingId}";
        $name = Str::random(16);

        /*
         * decodePath(), not read(): Intervention 4.3 dropped read() and
         * toWebp() in favour of decodePath() and encode(). Both were
         * method-not-found fatals at the moment somebody attached a photo, and
         * nothing caught it because the publish tests posted no file — which is
         * why PublishImageTest now uploads a real one.
         */
        $image = $this->manager->decodePath($file->getRealPath());

        // Orientation first: a photo taken sideways on a phone carries the
        // rotation in EXIF, and every resize below would bake in the wrong one.
        $image->orient();

        $widest = null;
        $widestDimensions = [0, 0];

        /*
         * Never upscale: a 600px photo rendered at 1600 is a blurrier file that
         * costs more to download than the original. scaleDown does that part —
         * what this loop decides is when to stop, which is the first width that
         * already covers the source. Going further would write the same pixels
         * again under a larger name, and the srcset would then claim a width
         * the file does not have.
         */
        foreach (self::widthsFor($image->width()) as $width) {
            $resized = (clone $image)->scaleDown(width: $width);
            $path = "{$directory}/{$name}-{$width}.webp";

            Storage::disk('public')->put($path, (string) $resized->encode(new WebpEncoder(quality: 82)));

            $widest = $path;
            $widestDimensions = [$resized->width(), $resized->height()];
        }

        return [
            'url' => Storage::disk('public')->url($widest),
            'storage_path' => $widest,
            'width' => $widestDimensions[0],
            'height' => $widestDimensions[1],
        ];
    }

    private function acceptable(UploadedFile $file): bool
    {
        return $file->isValid()
            && $file->getSize() <= self::MAX_BYTES
            && in_array((string) $file->getMimeType(), self::ACCEPTED, true);
    }

    /**
     * The widths actually written for a source this wide.
     *
     * Every step below the source, plus the one that first covers it. A photo
     * narrower than 1600 is the common case — most are — so emitting all three
     * unconditionally would name two files that were never written.
     *
     * @return list<int>
     */
    private static function widthsFor(int $source): array
    {
        $out = [];

        foreach (self::WIDTHS as $width) {
            $out[] = $width;
            if ($width >= $source) {
                break;
            }
        }

        return $out;
    }

    /**
     * The `srcset` for one stored image, given the width recorded on its row.
     *
     * Built from the widest path by substitution rather than stored per width:
     * the files differ by one number, and a table row per size would be rows to
     * keep in step for no information the name does not carry.
     *
     * The descriptor is the file's real width, not the name's. The largest file
     * of a 600px upload is called `-800.webp` because 800 is the step that
     * covered it, but it is 600 pixels across, and a browser told otherwise
     * picks the wrong file on a narrow screen.
     */
    public static function srcset(string $url, int $width): string
    {
        $out = [];

        foreach (self::widthsFor($width) as $step) {
            $out[] = preg_replace('/-\d+\.webp$/', "-{$step}.webp", $url).' '.min($step, $width).'w';
        }

        return implode(', ', $out);
    }
}
