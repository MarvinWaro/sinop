<?php

namespace App\Support;

use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * Sends a workbook as an .xlsx download.
 *
 * The file is written before the response is returned, while any temporary
 * images it uses (e-signatures from the bucket) still exist. It is a normal
 * response, so middleware such as the export log still runs.
 */
final class ExcelDownload
{
    public static function response(Spreadsheet $spreadsheet, string $filename): BinaryFileResponse
    {
        $file = tempnam(sys_get_temp_dir(), 'xlsx');
        (new Xlsx($spreadsheet))->save($file);
        $spreadsheet->disconnectWorksheets();

        return response()->download($file, $filename, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Cache-Control' => 'max-age=0',
        ])->deleteFileAfterSend();
    }
}
