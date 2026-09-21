<?php

declare(strict_types=1);

namespace App\Services;

/**
 * An article cover, drawn rather than photographed.
 *
 * Stock photography is the obvious answer and the wrong one here: the
 * licensable images of "a modern apartment" are of buildings in countries this
 * site is not about, they cost money per article, and a reader recognises them
 * from everywhere else. What this draws instead is a skyline at dusk in the
 * site's own navy — plainly an illustration, consistent across the whole
 * section, and free to regenerate when an article is rewritten.
 *
 * Deterministic: the same slug always produces the same cover, so re-running
 * the seeder does not reshuffle the section, and a reader who comes back to an
 * article finds the picture they remember.
 */
final class CoverImage
{
    private const WIDTH = 1600;

    private const HEIGHT = 900;

    /**
     * Draw one and return the WebP bytes.
     *
     * @param  float  $hue  0–360; each article picks its own sky.
     */
    public static function render(float $hue, string $seed): string
    {
        $image = imagecreatetruecolor(self::WIDTH, self::HEIGHT);
        imageantialias($image, true);

        // crc32 of the slug, so the skyline is the article's own and never
        // moves between runs.
        mt_srand(crc32($seed));

        self::sky($image, $hue);
        self::sun($image, $hue);
        self::skyline($image, $hue);

        ob_start();
        imagewebp($image, null, 86);
        $bytes = (string) ob_get_clean();

        imagedestroy($image);
        mt_srand();

        return $bytes;
    }

    /** A vertical wash, lighter towards the horizon. */
    private static function sky(\GdImage $image, float $hue): void
    {
        for ($y = 0; $y < self::HEIGHT; $y++) {
            $t = $y / self::HEIGHT;
            [$r, $g, $b] = self::hsl($hue, 0.34 - 0.16 * $t, 0.22 + 0.48 * $t);
            imagefilledrectangle($image, 0, $y, self::WIDTH, $y + 1, imagecolorallocate($image, $r, $g, $b));
        }
    }

    /** Low and well off centre, so the frame is not symmetrical. */
    private static function sun(\GdImage $image, float $hue): void
    {
        [$r, $g, $b] = self::hsl($hue + 24, 0.55, 0.72);
        $disc = imagecolorallocatealpha($image, $r, $g, $b, 70);

        imagefilledellipse($image, (int) (self::WIDTH * 0.72), (int) (self::HEIGHT * 0.52), 260, 260, $disc);
    }

    /** Three ranks of towers, each nearer and a shade apart. */
    private static function skyline(\GdImage $image, float $hue): void
    {
        $base = (int) (self::HEIGHT * 0.54);

        foreach ([[0.30, 0.86, 150], [0.46, 0.72, 118], [0.62, 0.56, 92]] as $rank => [$light, $depth, $step]) {
            [$r, $g, $b] = self::hsl($hue + $rank * 4, 0.30 + 0.06 * $rank, $light * 0.34);
            $stone = imagecolorallocate($image, $r, $g, $b);

            [$wr, $wg, $wb] = self::hsl($hue + 30, 0.45, 0.62 + 0.08 * $rank);
            $lit = imagecolorallocatealpha($image, $wr, $wg, $wb, 55);

            $x = -40;

            while ($x < self::WIDTH + 40) {
                $width = $step + mt_rand(-18, 34);
                $height = (int) ((self::HEIGHT - $base) * $depth) + mt_rand(-40, 110);
                $top = self::HEIGHT - $height - (int) (self::HEIGHT * 0.08 * $rank);

                imagefilledrectangle($image, $x, $top, $x + $width, self::HEIGHT, $stone);

                // Windows only on the nearer ranks: a lit grid on the far one
                // reads as noise at the size a card shows.
                if ($rank >= 1) {
                    for ($wy = $top + 26; $wy < self::HEIGHT - 30; $wy += 40) {
                        for ($wx = $x + 16; $wx < $x + $width - 16; $wx += 34) {
                            if (mt_rand(0, 100) < 42) {
                                imagefilledrectangle($image, $wx, $wy, $wx + 13, $wy + 20, $lit);
                            }
                        }
                    }
                }

                $x += $width + mt_rand(6, 20);
            }
        }
    }

    /** @return array{int, int, int} */
    private static function hsl(float $h, float $s, float $l): array
    {
        $h = fmod($h, 360);
        $c = (1 - abs(2 * $l - 1)) * $s;
        $x = $c * (1 - abs(fmod($h / 60, 2) - 1));
        $m = $l - $c / 2;

        [$r, $g, $b] = match (true) {
            $h < 60 => [$c, $x, 0.0],
            $h < 120 => [$x, $c, 0.0],
            $h < 180 => [0.0, $c, $x],
            $h < 240 => [0.0, $x, $c],
            $h < 300 => [$x, 0.0, $c],
            default => [$c, 0.0, $x],
        };

        return [
            (int) round(($r + $m) * 255),
            (int) round(($g + $m) * 255),
            (int) round(($b + $m) * 255),
        ];
    }
}
