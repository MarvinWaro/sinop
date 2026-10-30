<?php

namespace App\Services;

use Closure;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Collection;

/**
 * Read-only checks for the data problems found in the old database (see
 * REFACTOR_PLAN §3). Each normalization batch starts from these numbers on a
 * real export and should bring its own checks to zero. Nothing is changed.
 */
final class DataAudit
{
    private const SAMPLES = 5;

    public function __construct(private readonly ConnectionInterface $db) {}

    /**
     * @return list<array{key: string, label: string, batch: string, count: int, samples: list<string>}>
     */
    public function run(): array
    {
        return array_values(array_filter([
            $this->usersWithoutRole(),
            $this->legacyRoleMismatch(),
            $this->orphanRows(),
            $this->duplicateRisNumbers(),
            $this->issueLinesWithoutFundCluster(),
            $this->onHandVersusLedger(),
            $this->totalCostDrift(),
            $this->duplicateStockRows(),
            $this->linesOfType('beginning_balance_lines', 'Beginning Balance receipt lines', fn (Builder $q) => $q->where('reference_no', 'Beginning Balance')),
            $this->linesOfType('adjustment_lines', 'Re-value adjustment lines', fn (Builder $q) => $q->where('transaction_type', 'adjustment')),
            $this->issuedVersusLedger(),
            $this->manualReceivedWithoutLink(),
            $this->officeDiffersFromDivision(),
            $this->propertiesOnRemovedLocations(),
            $this->spellings('fund_spellings', 'Fund cluster spelled more than one way', '3', [
                ['properties', 'fund'], ['supply_stocks', 'fund_cluster'], ['supply_transactions', 'fund_cluster'], ['ris_slips', 'fund_cluster'],
            ], fn (string $value) => preg_replace('/\D+/', '', $value)),
            $this->spellings('unit_spellings', 'Unit of measure spelled more than one way', '3', [
                ['supplies', 'unit_of_measurement'], ['properties', 'unit_of_measure'],
            ]),
            $this->spellings('condition_spellings', 'Property condition spelled more than one way', '3', [
                ['properties', 'condition'],
            ]),
            $this->endUsers(),
        ]));
    }

    private function usersWithoutRole(): ?array
    {
        if (! $this->has('users', 'role_user')) {
            return null;
        }

        $users = $this->db->table('users')
            ->whereNotExists(fn (Builder $q) => $q->from('role_user')->whereColumn('role_user.user_id', 'users.id'))
            ->orderBy('id')
            ->get(['id', 'name']);

        return $this->result('users_without_role', 'Accounts without a role (no access)', '0', $users->count(),
            $users->map(fn ($user) => "#{$user->id} {$user->name}"));
    }

    private function legacyRoleMismatch(): ?array
    {
        if (! $this->has('users', 'role_user', 'roles')) {
            return null;
        }

        $slugs = $this->db->table('role_user')
            ->join('roles', 'roles.id', '=', 'role_user.role_id')
            ->get(['role_user.user_id', 'roles.slug'])
            ->groupBy('user_id')
            ->map(fn (Collection $rows) => $rows->pluck('slug'));

        // Same mapping as User::syncLegacyRole().
        $mismatched = $this->db->table('users')->orderBy('id')->get(['id', 'name', 'role'])
            ->filter(function ($user) use ($slugs) {
                $held = $slugs->get($user->id);

                if ($held === null) {
                    return false;
                }

                $expected = $held->contains('admin') ? 'admin' : ($held->contains('cao') ? 'cao' : 'staff');

                return $user->role !== $expected;
            });

        return $this->result('legacy_role_mismatch', 'users.role out of step with the assigned roles', '6', $mismatched->count(),
            $mismatched->map(fn ($user) => "#{$user->id} {$user->name} ({$user->role})"));
    }

    private function orphanRows(): ?array
    {
        $links = [
            ['ris_items', 'ris_id', 'ris_slips', 'ris_id'],
            ['ris_items', 'supply_id', 'supplies', 'supply_id'],
            ['supply_stocks', 'supply_id', 'supplies', 'supply_id'],
            ['supply_transactions', 'supply_id', 'supplies', 'supply_id'],
            ['ris_slips', 'division', 'departments', 'id'],
            ['properties', 'location_id', 'locations', 'id'],
        ];

        $found = collect($links)
            ->filter(fn (array $link) => $this->has($link[0], $link[2]))
            ->map(function (array $link) {
                [$table, $column, $parent, $key] = $link;

                $count = $this->db->table($table)
                    ->whereNotNull($column)
                    ->whereNotExists(fn (Builder $q) => $q->from($parent)->whereColumn("{$parent}.{$key}", "{$table}.{$column}"))
                    ->count();

                return [$count, "{$table}.{$column} → {$parent}: {$count}"];
            })
            ->filter(fn (array $row) => $row[0] > 0);

        return $this->result('orphan_rows', 'Rows pointing to a record that no longer exists', '1', $found->sum(fn ($row) => $row[0]),
            $found->map(fn ($row) => $row[1]));
    }

    private function duplicateRisNumbers(): ?array
    {
        if (! $this->has('ris_slips')) {
            return null;
        }

        $duplicates = $this->db->table('ris_slips')
            ->selectRaw('ris_no, count(*) as copies')
            ->groupBy('ris_no')
            ->havingRaw('count(*) > 1')
            ->orderBy('ris_no')
            ->get();

        return $this->result('duplicate_ris_numbers', 'RIS numbers used by more than one slip', '4', $duplicates->count(),
            $duplicates->map(fn ($row) => "{$row->ris_no} ×{$row->copies}"));
    }

    private function issueLinesWithoutFundCluster(): ?array
    {
        if (! $this->has('supply_transactions')) {
            return null;
        }

        $lines = $this->db->table('supply_transactions')
            ->where('transaction_type', 'issue')
            ->where(fn (Builder $q) => $q->whereNull('fund_cluster')->orWhere('fund_cluster', ''))
            ->orderBy('transaction_id')
            ->get(['transaction_id', 'reference_no']);

        return $this->result('issue_lines_without_fund_cluster', 'Issue lines without a fund cluster', '5', $lines->count(),
            $lines->map(fn ($line) => "#{$line->transaction_id} {$line->reference_no}"));
    }

    private function onHandVersusLedger(): ?array
    {
        if (! $this->has('supply_stocks', 'supply_transactions')) {
            return null;
        }

        $onHand = $this->db->table('supply_stocks')
            ->selectRaw('supply_id, sum(quantity_on_hand) as quantity')
            ->groupBy('supply_id')
            ->pluck('quantity', 'supply_id');

        $ledger = $this->db->table('supply_transactions')
            ->selectRaw("supply_id, sum(case when transaction_type = 'receipt' then quantity else 0 end)
                - sum(case when transaction_type = 'issue' then quantity else 0 end) as quantity")
            ->groupBy('supply_id')
            ->pluck('quantity', 'supply_id');

        $mismatched = $onHand->keys()->merge($ledger->keys())->unique()->sort()
            ->filter(fn ($supplyId) => (int) ($onHand[$supplyId] ?? 0) !== (int) ($ledger[$supplyId] ?? 0));

        return $this->result('on_hand_vs_ledger', 'Supplies whose on-hand differs from receipts − issues', '5', $mismatched->count(),
            $mismatched->map(fn ($supplyId) => "supply #{$supplyId}: on hand ".(int) ($onHand[$supplyId] ?? 0).', ledger '.(int) ($ledger[$supplyId] ?? 0)));
    }

    private function totalCostDrift(): ?array
    {
        if (! $this->has('supply_stocks')) {
            return null;
        }

        $rows = $this->db->table('supply_stocks')
            ->whereRaw('abs(coalesce(total_cost, 0) - quantity_on_hand * coalesce(unit_cost, 0)) > 0.01')
            ->orderBy('stock_id')
            ->get(['stock_id', 'supply_id', 'quantity_on_hand', 'unit_cost', 'total_cost']);

        return $this->result('total_cost_drift', 'Stock rows whose total cost ≠ quantity × unit cost', '5', $rows->count(),
            $rows->map(fn ($row) => "stock #{$row->stock_id}: {$row->quantity_on_hand} × {$row->unit_cost} ≠ {$row->total_cost}"));
    }

    private function duplicateStockRows(): ?array
    {
        if (! $this->has('supply_stocks')) {
            return null;
        }

        $rows = $this->db->table('supply_stocks')
            ->selectRaw("supply_id, coalesce(fund_cluster, '') as cluster, count(*) as copies")
            ->groupByRaw("supply_id, coalesce(fund_cluster, '')")
            ->havingRaw('count(*) > 1')
            ->orderBy('supply_id')
            ->get();

        return $this->result('duplicate_stock_rows', 'More than one stock row for a supply and fund cluster', '5', $rows->count(),
            $rows->map(fn ($row) => "supply #{$row->supply_id} cluster '{$row->cluster}' ×{$row->copies}"));
    }

    /** @param  Closure(Builder): Builder  $filter */
    private function linesOfType(string $key, string $label, Closure $filter): ?array
    {
        if (! $this->has('supply_transactions')) {
            return null;
        }

        $lines = $filter($this->db->table('supply_transactions'))
            ->orderBy('transaction_id')
            ->get(['transaction_id', 'supply_id', 'transaction_date']);

        return $this->result($key, $label, '5', $lines->count(),
            $lines->map(fn ($line) => "#{$line->transaction_id} supply #{$line->supply_id} on {$line->transaction_date}"));
    }

    private function issuedVersusLedger(): ?array
    {
        if (! $this->has('ris_slips', 'ris_items', 'supply_transactions')) {
            return null;
        }

        // Per RIS number: ledger lines only carry the number, and one number
        // can be spread over several slips (see duplicate_ris_numbers).
        $issued = $this->db->table('ris_items')
            ->join('ris_slips', 'ris_slips.ris_id', '=', 'ris_items.ris_id')
            ->selectRaw('ris_slips.ris_no, sum(coalesce(ris_items.quantity_issued, 0)) as quantity')
            ->groupBy('ris_slips.ris_no')
            ->pluck('quantity', 'ris_no');

        $ledger = $this->db->table('supply_transactions')
            ->where('transaction_type', 'issue')
            ->where('reference_no', 'like', 'RIS%')
            ->selectRaw('reference_no, sum(quantity) as quantity')
            ->groupBy('reference_no')
            ->pluck('quantity', 'reference_no');

        $mismatched = $issued->keys()->merge($ledger->keys())->unique()->sort()
            ->filter(fn ($risNo) => (int) ($issued[$risNo] ?? 0) !== (int) ($ledger[$risNo] ?? 0));

        return $this->result('issued_vs_ledger', 'RIS numbers whose issued quantity differs from their ledger lines', '5', $mismatched->count(),
            $mismatched->map(fn ($risNo) => "{$risNo}: slips ".(int) ($issued[$risNo] ?? 0).', ledger '.(int) ($ledger[$risNo] ?? 0)));
    }

    private function manualReceivedWithoutLink(): ?array
    {
        if (! $this->has('ris_slips', 'user_transactions', 'supply_transactions')) {
            return null;
        }

        $slips = $this->db->table('ris_slips')
            ->where('is_manual_entry', true)
            ->whereNotNull('received_by')
            ->whereNotExists(fn (Builder $q) => $q->from('user_transactions')
                ->join('supply_transactions', 'supply_transactions.transaction_id', '=', 'user_transactions.transaction_id')
                ->whereColumn('supply_transactions.reference_no', 'ris_slips.ris_no')
                ->where('user_transactions.role', 'receiver'))
            ->orderBy('ris_id')
            ->get(['ris_id', 'ris_no']);

        return $this->result('manual_received_without_link', "Received manual RIS missing from the receiver's \"Received supplies\"", '1', $slips->count(),
            $slips->map(fn ($slip) => "{$slip->ris_no} (#{$slip->ris_id})"));
    }

    private function officeDiffersFromDivision(): ?array
    {
        if (! $this->has('ris_slips', 'departments')) {
            return null;
        }

        $slips = $this->db->table('ris_slips')
            ->join('departments', 'departments.id', '=', 'ris_slips.division')
            ->orderBy('ris_slips.ris_id')
            ->get(['ris_slips.ris_id', 'ris_slips.ris_no', 'ris_slips.office', 'departments.name'])
            ->filter(function ($slip) {
                $office = trim((string) $slip->office);
                $dash = strpos($slip->name, ' - ');
                $afterDash = $dash === false ? '' : trim(substr($slip->name, $dash + 3));

                return $office !== '' && ! in_array($office, [trim($slip->name), $afterDash], true);
            });

        return $this->result('office_differs_from_division', 'RIS office text that differs from its division', '2', $slips->count(),
            $slips->map(fn ($slip) => "{$slip->ris_no}: \"{$slip->office}\" vs \"{$slip->name}\""));
    }

    private function propertiesOnRemovedLocations(): ?array
    {
        if (! $this->has('properties', 'locations')) {
            return null;
        }

        $properties = $this->db->table('properties')
            ->join('locations', 'locations.id', '=', 'properties.location_id')
            ->where('locations.excluded', true)
            ->where('properties.excluded', false)
            ->orderBy('properties.id')
            ->get(['properties.id', 'locations.location_name']);

        return $this->result('properties_on_removed_locations', 'Properties still on a removed location', '1', $properties->count(),
            $properties->map(fn ($row) => "property #{$row->id} at \"{$row->location_name}\""));
    }

    /**
     * Values that are the same once spelling is evened out ("pcs", "PCS ",
     * "Pcs.") but stored differently.
     *
     * @param  list<array{0: string, 1: string}>  $columns
     * @param  (Closure(string): string)|null  $key
     */
    private function spellings(string $name, string $label, string $batch, array $columns, ?Closure $key = null): ?array
    {
        $key ??= fn (string $value) => preg_replace(['/\s+/', '/\./'], [' ', ''], strtolower(trim($value)));

        $values = collect($columns)
            ->filter(fn (array $column) => $this->has($column[0]))
            ->flatMap(fn (array $column) => $this->db->table($column[0])
                ->whereNotNull($column[1])
                ->distinct()
                ->pluck($column[1]))
            ->map(fn ($value) => (string) $value)
            ->filter(fn (string $value) => trim($value) !== '')
            ->unique();

        if ($values->isEmpty() && ! $this->has($columns[0][0])) {
            return null;
        }

        $groups = $values->groupBy($key)->filter(fn (Collection $group) => $group->count() > 1);

        return $this->result($name, $label, $batch, $groups->count(),
            $groups->map(fn (Collection $group) => $group->map(fn ($value) => "\"{$value}\"")->join(' / ')));
    }

    private function endUsers(): ?array
    {
        if (! $this->has('end_users')) {
            return null;
        }

        $count = $this->db->table('end_users')->count();

        return $this->result('end_users_rows', 'Rows in the unused end_users table', '6', $count, collect());
    }

    /** @param  Collection<int|string, string>  $samples */
    private function result(string $key, string $label, string $batch, int $count, Collection $samples): array
    {
        return [
            'key' => $key,
            'label' => $label,
            'batch' => $batch,
            'count' => $count,
            'samples' => $samples->take(self::SAMPLES)->values()->all(),
        ];
    }

    private function has(string ...$tables): bool
    {
        $schema = $this->db->getSchemaBuilder();

        foreach ($tables as $table) {
            if (! $schema->hasTable($table)) {
                return false;
            }
        }

        return true;
    }
}
