<?php

use App\Models\User;
use App\Services\DataAudit;
use Illuminate\Support\Facades\DB;

/** @return array<string, int> check key => count */
function auditCounts(): array
{
    return collect((new DataAudit(DB::connection()))->run())->pluck('count', 'key')->all();
}

function ledgerLine(int $supplyId, string $type, int $quantity, array $extra = []): void
{
    DB::table('supply_transactions')->insert($extra + [
        'supply_id' => $supplyId,
        'transaction_type' => $type,
        'transaction_date' => '2026-03-01',
        'reference_no' => 'IAR 2026-03-001',
        'quantity' => $quantity,
        'unit_cost' => 5,
        'total_cost' => 5 * $quantity,
        'balance_quantity' => 0,
        'user_id' => User::query()->value('id'),
        'fund_cluster' => '101',
        'created_at' => now(),
        'updated_at' => now(),
    ]);
}

test('clean data reports nothing to fix', function () {
    $division = DB::table('departments')->insertGetId(['name' => 'Scholarship Division - UniFAST BARMM', 'created_at' => now(), 'updated_at' => now()]);
    User::factory()->create(['department_id' => $division]);
    DB::table('supplies')->insert(['supply_id' => 1, 'stock_no' => '01', 'item_name' => 'ALCOHOL', 'unit_of_measurement' => 'GALLON', 'created_at' => now(), 'updated_at' => now()]);
    DB::table('supply_stocks')->insert(['supply_id' => 1, 'quantity_on_hand' => 8, 'unit_cost' => 5, 'total_cost' => 40, 'status' => 'available', 'fund_cluster' => '101', 'created_at' => now(), 'updated_at' => now()]);
    ledgerLine(1, 'receipt', 10);
    ledgerLine(1, 'issue', 2, ['reference_no' => 'RIS 2026-03-001']);
    $slip = DB::table('ris_slips')->insertGetId(['ris_no' => 'RIS 2026-03-001', 'ris_date' => '2026-03-02', 'entity_name' => 'CHEDRO 12', 'division' => $division, 'office' => 'UniFAST BARMM', 'status' => 'posted', 'created_at' => now(), 'updated_at' => now()]);
    DB::table('ris_items')->insert(['ris_id' => $slip, 'supply_id' => 1, 'quantity_requested' => 2, 'quantity_issued' => 2, 'created_at' => now(), 'updated_at' => now()]);

    expect(array_filter(auditCounts()))->toBe([]);
});

test('each kind of problem is counted', function () {
    $division = DB::table('departments')->insertGetId(['name' => 'Technical Division', 'created_at' => now(), 'updated_at' => now()]);
    $staff = User::factory()->create(['department_id' => $division]);
    $noRole = User::factory()->create();
    DB::table('role_user')->where('user_id', $noRole->id)->delete();
    $staff->forceFill(['role' => 'cao'])->saveQuietly();

    DB::table('supplies')->insert([
        ['supply_id' => 1, 'stock_no' => '01', 'item_name' => 'ALCOHOL', 'unit_of_measurement' => 'pcs', 'created_at' => now(), 'updated_at' => now()],
        ['supply_id' => 2, 'stock_no' => '02', 'item_name' => 'BROOM', 'unit_of_measurement' => 'PCS.', 'created_at' => now(), 'updated_at' => now()],
    ]);
    DB::table('supply_stocks')->insert([
        // total cost 60 ≠ 10 × 5, and a second row for the same supply and cluster
        ['supply_id' => 1, 'quantity_on_hand' => 10, 'unit_cost' => 5, 'total_cost' => 60, 'status' => 'available', 'fund_cluster' => '101', 'created_at' => now(), 'updated_at' => now()],
        ['supply_id' => 1, 'quantity_on_hand' => 0, 'unit_cost' => 0, 'total_cost' => 0, 'status' => 'depleted', 'fund_cluster' => '101', 'created_at' => now(), 'updated_at' => now()],
    ]);
    ledgerLine(1, 'receipt', 12, ['reference_no' => 'Beginning Balance']);
    ledgerLine(1, 'issue', 2, ['reference_no' => 'RIS 2026-03-001', 'fund_cluster' => null]);
    ledgerLine(1, 'adjustment', 0);

    $slip = fn (array $extra) => DB::table('ris_slips')->insertGetId($extra + ['ris_no' => 'RIS 2026-03-001', 'ris_date' => '2026-03-02', 'entity_name' => 'CHEDRO 12', 'division' => $division, 'status' => 'posted', 'created_at' => now(), 'updated_at' => now()]);
    $issued = $slip(['office' => 'Old Office Name', 'fund_cluster' => 'Fund 101']);
    $slip(['is_manual_entry' => true, 'received_by' => $staff->id, 'status' => 'completed']);
    DB::table('ris_items')->insert(['ris_id' => $issued, 'supply_id' => 1, 'quantity_requested' => 3, 'quantity_issued' => 3, 'created_at' => now(), 'updated_at' => now()]);
    DB::table('end_users')->insert(['name' => 'Someone', 'email' => 'someone@example.com', 'department' => 'Admin', 'designation' => 'Clerk', 'created_at' => now(), 'updated_at' => now()]);

    expect(auditCounts())->toMatchArray([
        'users_without_role' => 1,
        'legacy_role_mismatch' => 1,
        'orphan_rows' => 0,
        'duplicate_ris_numbers' => 1,
        'issue_lines_without_fund_cluster' => 1,
        'on_hand_vs_ledger' => 0,
        'total_cost_drift' => 1,
        'duplicate_stock_rows' => 1,
        'beginning_balance_lines' => 1,
        'adjustment_lines' => 1,
        // RIS 2026-03-001: 3 issued on its slips vs 2 in the ledger.
        'issued_vs_ledger' => 1,
        'manual_received_without_link' => 1,
        'office_differs_from_division' => 1,
        'fund_spellings' => 1,
        'unit_spellings' => 1,
        'end_users_rows' => 1,
    ]);
});

test('the command prints the report and can save it as JSON', function () {
    $path = tempnam(sys_get_temp_dir(), 'audit');

    $this->artisan('sinop:audit-data', ['--json' => $path])
        ->expectsOutputToContain('RIS numbers used by more than one slip')
        ->assertSuccessful();

    expect(json_decode(file_get_contents($path), true))
        ->toHaveKeys(['database', 'generated_at', 'checks']);

    unlink($path);
});
