<?php

namespace App\Support;

use GdImage;

/**
 * Lifts the ink off a signature picture: the paper becomes transparent and
 * the edges are trimmed, so the signature sits cleanly on the printed form
 * and in dark mode. The same rule as the browser's
 * resources/js/lib/signature-image.ts (used for new signatures); this one
 * cleans the signatures uploaded before that existed.
 */
final class SignatureInk
{
    /** Darkness below this (0–255, against the paper) is paper… */
    private const LOW = 28;

    /** …above this is solid ink; in between fades. */
    private const HIGH = 110;

    private const MAX_SIDE = 1200;

    private const PADDING = 8;

    /**
     * A transparent, trimmed PNG of the signature. Null when the picture
     * already has a transparent background, can't be read, or holds no ink.
     */
    public static function clean(string $bytes): ?string
    {
        $source = @imagecreatefromstring($bytes);

        if (! $source instanceof GdImage) {
            return null;
        }

        $image = self::fit($source);
        $width = imagesx($image);
        $height = imagesy($image);

        if (self::hasTransparentEdges($image, $width, $height)) {
            return null;
        }

        [$paperR, $paperG, $paperB] = self::paperColour($image, $width, $height);
        $paperLight = self::luminance($paperR, $paperG, $paperB);
        // Light ink on dark paper (a photo in the dark, an inverted scan) is
        // recoloured black so it shows on the printed form.
        $darkPaper = $paperLight < 110;

        $out = imagecreatetruecolor($width, $height);
        imagealphablending($out, false);
        imagesavealpha($out, true);
        // Truecolor pixels are 0xAARRGGBB with alpha 0 (opaque) to 127 (clear).
        imagefill($out, 0, 0, 127 << 24);

        $minX = $width;
        $minY = $height;
        $maxX = -1;
        $maxY = -1;

        for ($y = 0; $y < $height; $y++) {
            for ($x = 0; $x < $width; $x++) {
                $rgb = imagecolorat($image, $x, $y);
                $r = ($rgb >> 16) & 0xFF;
                $g = ($rgb >> 8) & 0xFF;
                $b = $rgb & 0xFF;

                $contrast = $darkPaper ? self::luminance($r, $g, $b) - $paperLight : $paperLight - self::luminance($r, $g, $b);
                $alpha = min(1, max(0, ($contrast - self::LOW) / (self::HIGH - self::LOW)));

                if ($alpha <= 0) {
                    continue;
                }

                // The ink's own colour, without the paper mixed into its edges.
                [$r, $g, $b] = $darkPaper ? [0, 0, 0] : [
                    self::unblend($r, $paperR, $alpha),
                    self::unblend($g, $paperG, $alpha),
                    self::unblend($b, $paperB, $alpha),
                ];

                imagesetpixel($out, $x, $y, ((int) round(127 * (1 - $alpha)) << 24) | ($r << 16) | ($g << 8) | $b);

                if ($alpha > 0.25) {
                    $minX = min($minX, $x);
                    $minY = min($minY, $y);
                    $maxX = max($maxX, $x);
                    $maxY = max($maxY, $y);
                }
            }
        }

        if ($maxX < 0) {
            return null;
        }

        $left = max(0, $minX - self::PADDING);
        $top = max(0, $minY - self::PADDING);
        $trimmed = imagecrop($out, [
            'x' => $left,
            'y' => $top,
            'width' => min($width, $maxX + self::PADDING + 1) - $left,
            'height' => min($height, $maxY + self::PADDING + 1) - $top,
        ]);

        if (! $trimmed instanceof GdImage) {
            return null;
        }

        imagesavealpha($trimmed, true);
        ob_start();
        imagepng($trimmed);

        return (string) ob_get_clean();
    }

    /** Large photos are scaled down first; a signature needs no more. */
    private static function fit(GdImage $image): GdImage
    {
        $width = imagesx($image);
        $height = imagesy($image);
        $scale = min(1, self::MAX_SIDE / max($width, $height));

        if (! imageistruecolor($image)) {
            imagepalettetotruecolor($image);
        }

        if ($scale >= 1) {
            return $image;
        }

        $scaled = imagescale($image, (int) round($width * $scale), (int) round($height * $scale));

        return $scaled instanceof GdImage ? $scaled : $image;
    }

    private static function hasTransparentEdges(GdImage $image, int $width, int $height): bool
    {
        $transparent = 0;
        $points = self::edgePoints($width, $height);

        foreach ($points as [$x, $y]) {
            if ((imagecolorat($image, $x, $y) >> 24 & 0x7F) > 100) {
                $transparent++;
            }
        }

        return $transparent > count($points) / 2;
    }

    /** @return array{0: int, 1: int, 2: int} the median colour of the edges */
    private static function paperColour(GdImage $image, int $width, int $height): array
    {
        $channels = [[], [], []];

        foreach (self::edgePoints($width, $height) as [$x, $y]) {
            $rgb = imagecolorat($image, $x, $y);
            $channels[0][] = ($rgb >> 16) & 0xFF;
            $channels[1][] = ($rgb >> 8) & 0xFF;
            $channels[2][] = $rgb & 0xFF;
        }

        return array_map(function (array $values) {
            sort($values);

            return $values[intdiv(count($values), 2)];
        }, $channels);
    }

    /** @return list<array{0: int, 1: int}> about 400 points around the border */
    private static function edgePoints(int $width, int $height): array
    {
        $points = [];
        $stepX = max(1, intdiv($width, 100));
        $stepY = max(1, intdiv($height, 100));

        for ($x = 0; $x < $width; $x += $stepX) {
            $points[] = [$x, 0];
            $points[] = [$x, $height - 1];
        }

        for ($y = 0; $y < $height; $y += $stepY) {
            $points[] = [0, $y];
            $points[] = [$width - 1, $y];
        }

        return $points;
    }

    private static function luminance(int $r, int $g, int $b): float
    {
        return 0.299 * $r + 0.587 * $g + 0.114 * $b;
    }

    private static function unblend(int $value, int $paper, float $alpha): int
    {
        return (int) min(255, max(0, round(($value - (1 - $alpha) * $paper) / $alpha)));
    }
}
