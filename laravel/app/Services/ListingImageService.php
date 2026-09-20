<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Intervention\Image\Drivers\Gd\Driver;
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

        $image = $this->manager->read($file->getRealPath());

        // Orientation first: a photo taken sideways on a phone carries the
        // rotation in EXIF, and every resize below would bake in the wrong one.
        $image->orient();

        $widest = null;
        $widestDimensions = [0, 0];

        foreach (self::WIDTHS as $width) {
            // Never upscale. A 600px photo rendered at 1600 is a blurrier file
            // that costs more to download than the original.
            if ($image->width() < $width && $widest !== null) {
                continue;
            }

            $resized = (clone $image)->scaleDown(width: $width);
            $path = "{$directory}/{$name}-{$width}.webp";

            Storage::disk('public')->put($path, (string) $resized->toWebp(quality: 82));

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
     * The `srcset` for one stored image.
     *
     * Built from the widest path by substitution rather than stored per width:
     * the three files differ by one number, and a table row per size would be
     * three rows to keep in step for no information the name does not carry.
     */
    public static function srcset(string $url): string
    {
        $out = [];

        foreach (self::WIDTHS as $width) {
            $out[] = preg_replace('/-\d+\.webp$/', "-{$width}.webp", $url)." {$width}w";
        }

        return implode(', ', $out);
    }
}
