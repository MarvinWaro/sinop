<?php

namespace App\Support;

use Throwable;

/**
 * Stamps a faint line of text (e.g. "RIS 2026-10-002 · Oct 31, 2026")
 * across the middle of a signature image, so a copy saved from one RIS
 * can't pass for a signature on another document.
 */
final class SignatureStamp
{
    /** Ships with dompdf, which the PDF exports already need. */
    private const FONT = 'vendor/dompdf/dompdf/lib/fonts/DejaVuSans-Bold.ttf';

    /** Slate grey at about 55% opacity (GD alpha: 0 opaque … 127 clear). */
    private const COLOUR = [71, 85, 105, 57];

    /**
     * The image as a PNG with the text across it, or null when it can't be
     * stamped (not an image, or no FreeType): the caller keeps it as it is.
     */
    public static function apply(string $image, string $text): ?string
    {
        $font = base_path(self::FONT);

        if (! function_exists('imagettftext') || ! is_file($font)) {
            return null;
        }

        try {
            $canvas = @imagecreatefromstring($image);

            if ($canvas === false) {
                return null;
            }

            imagepalettetotruecolor($canvas);
            imagealphablending($canvas, true);
            imagesavealpha($canvas, true);

            $width = imagesx($canvas);
            $height = imagesy($canvas);

            // About 90% of the width, and no taller than a quarter of the height.
            $box = imagettfbbox(10, 0, $font, $text);
            $size = 10 * ($width * 0.9) / max(1, $box[2] - $box[0]);
            $size = max(6.0, min($size, $height * 0.25));

            $box = imagettfbbox($size, 0, $font, $text);
            $x = (int) round(($width - ($box[2] - $box[0])) / 2 - $box[0]);
            $y = (int) round(($height - ($box[1] - $box[7])) / 2 - $box[7]);

            [$red, $green, $blue, $alpha] = self::COLOUR;
            imagettftext($canvas, $size, 0, $x, $y, (int) imagecolorallocatealpha($canvas, $red, $green, $blue, $alpha), $font, $text);

            ob_start();
            imagepng($canvas);
            $png = (string) ob_get_clean();

            return $png !== '' ? $png : null;
        } catch (Throwable $exception) {
            report($exception);

            return null;
        }
    }
}
