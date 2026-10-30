<?php

namespace App\Support;

/**
 * The four signature boxes of the RIS form (Appendix 63), as laid out in the
 * Excel export: which columns each spans and their size in pixels (the
 * column widths and the 50 pt signature row of RisSlipController::exportExcel).
 *
 * A placed signature is stored as fractions of its box, so the RIS page and
 * the signing preview draw boxes of the same proportions
 * (resources/js/lib/signature-placement.ts mirrors these sizes).
 */
final class RisSignatureBox
{
    public const STEPS = ['requested', 'approved', 'issued', 'received'];

    /** Column => width in pixels (Calibri 11 at the export's column widths). */
    public const COLUMNS = ['A' => 84, 'B' => 70, 'C' => 210, 'D' => 70, 'E' => 70, 'F' => 70, 'G' => 70, 'H' => 126];

    /** Step => the columns its box spans. */
    public const BOXES = [
        'requested' => ['C'],
        'approved' => ['D', 'E'],
        'issued' => ['F', 'G'],
        'received' => ['H'],
    ];

    /** Height of the signature row in pixels (50 pt). */
    public const HEIGHT = 67;

    public static function width(string $step): int
    {
        return array_sum(array_map(fn (string $column) => self::COLUMNS[$column], self::BOXES[$step]));
    }

    /**
     * The signature's rectangle inside the box, in pixels, before rotation:
     * the stored width, kept to the image's proportions and never taller
     * than the box (the browser applies the same rule).
     *
     * @param  array{x: float, y: float, width: float}  $placement
     * @return array{left: float, top: float, width: float, height: float}
     */
    public static function frame(string $step, array $placement, int $imageWidth, int $imageHeight): array
    {
        $boxWidth = self::width($step);
        $ratio = $imageWidth > 0 && $imageHeight > 0 ? $imageHeight / $imageWidth : 1 / 3;

        $width = min($placement['width'] * $boxWidth, self::HEIGHT / $ratio);
        $height = $width * $ratio;

        return [
            'left' => $placement['x'] * $boxWidth - $width / 2,
            'top' => $placement['y'] * self::HEIGHT - $height / 2,
            'width' => $width,
            'height' => $height,
        ];
    }

    /**
     * The column a point lies in, and how far into that column it is: Excel
     * anchors a picture to a cell plus an offset smaller than the cell.
     *
     * @return array{0: string, 1: int}
     */
    public static function anchor(string $step, float $left): array
    {
        $columns = self::BOXES[$step];
        $offset = max(0, (int) round($left));

        foreach ($columns as $index => $column) {
            if ($offset < self::COLUMNS[$column] || $index === array_key_last($columns)) {
                return [$column, min($offset, self::COLUMNS[$column] - 1)];
            }

            $offset -= self::COLUMNS[$column];
        }

        return [$columns[0], 0];
    }
}
