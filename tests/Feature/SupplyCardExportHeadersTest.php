<?php

use App\Models\User;
use Illuminate\Support\Facades\DB;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

beforeEach(function () {
    $this->admin = User::factory()->admin()->create();
    DB::table('supplies')->insert(['supply_id' => 1, 'stock_no' => '01', 'item_name' => 'ALCOHOL', 'unit_of_measurement' => 'PIECE', 'reorder_point' => 0, 'created_at' => now(), 'updated_at' => now()]);
    DB::table('supply_transactions')->insert(['supply_id' => 1, 'transaction_type' => 'receipt', 'transaction_date' => now()->toDateString(), 'reference_no' => 'IAR 2026-10-001', 'quantity' => 10, 'unit_cost' => 500, 'total_cost' => 5000, 'balance_quantity' => 10, 'fund_cluster' => '101', 'user_id' => $this->admin->id, 'created_at' => now(), 'updated_at' => now()]);
});

/** Every non-empty cell of the sheet's column-header rows (the two rows starting at "DATE"). */
function cardHeaders(Worksheet $sheet): array
{
    $row = null;

    foreach ($sheet->getRowIterator() as $candidate) {
        if ($sheet->getCell('A'.$candidate->getRowIndex())->getValue() === 'DATE') {
            $row = $candidate->getRowIndex();
            break;
        }
    }

    expect($row)->not->toBeNull();

    return array_values(array_filter(array_merge(
        $sheet->rangeToArray("A{$row}:L{$row}", null, false, false)[0],
        $sheet->rangeToArray('A'.($row + 1).':L'.($row + 1), null, false, false)[0],
    )));
}

test('the stock card and supply ledger card Excel files have their column headers in capitals', function (string $route, array $expected) {
    $response = $this->actingAs($this->admin)
        ->get(route($route, ['supplyId' => 1, 'fund_cluster' => '101', 'year' => now()->year]))
        ->assertOk();

    $sheet = IOFactory::load($response->getFile()->getPathname())->getActiveSheet();
    unlink($response->getFile()->getPathname());
    $headers = cardHeaders($sheet);

    expect($headers)->toBe($expected);
})->with([
    'stock card' => ['stock-cards.export-excel', ['DATE', 'REFERENCE', 'RECEIPT', 'ISSUE', 'BALANCE', "NO. OF DAYS\nTO CONSUME", 'QTY.', 'QTY.', 'OFFICE']],
    'supply ledger card' => ['supply-ledger-cards.export-excel', ['DATE', 'REFERENCE', 'RECEIPT', 'ISSUE', 'BALANCE', "NO. OF DAYS\nTO CONSUME", 'QTY.', 'UNIT COST', 'TOTAL COST', 'QTY.', 'UNIT COST', 'TOTAL COST', 'QTY.', 'UNIT COST', 'TOTAL COST']],
]);
