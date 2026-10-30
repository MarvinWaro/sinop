<?php

namespace App\Console\Commands;

use App\Services\DataAudit;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class AuditData extends Command
{
    protected $signature = 'sinop:audit-data
        {--database= : Connection to check (default: the app database)}
        {--json= : Also save the report as JSON to this file}';

    protected $description = 'Report the data problems to fix during normalization (read-only)';

    public function handle(): int
    {
        $connection = DB::connection($this->option('database') ?: null);
        $checks = (new DataAudit($connection))->run();

        $this->components->info('Data audit of '.$connection->getDatabaseName());
        $this->table(
            ['Check', 'Found', 'Examples', 'Batch'],
            array_map(fn (array $check) => [
                $check['label'],
                $check['count'],
                implode("\n", $check['samples']),
                $check['batch'] === '0' ? 'now' : $check['batch'],
            ], $checks),
        );

        if ($path = $this->option('json')) {
            file_put_contents($path, json_encode([
                'database' => $connection->getDatabaseName(),
                'generated_at' => now()->toIso8601String(),
                'checks' => $checks,
            ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));

            $this->components->info("Saved to {$path}");
        }

        return self::SUCCESS;
    }
}
