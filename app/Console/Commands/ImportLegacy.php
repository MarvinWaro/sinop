<?php

namespace App\Console\Commands;

use App\Support\SqlDumpReader;
use Illuminate\Console\Command;
use Illuminate\Database\Connection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Throwable;

/**
 * Builds a database from an export of the old system, adds SINOP's new
 * tables (roles, activity log, notifications, …) by running the migrations,
 * then checks that nothing was lost. Used for the development copy today and
 * for the go-live cutover from a fresh export later; it never touches any
 * other database.
 */
class ImportLegacy extends Command
{
    protected $signature = 'sinop:import-legacy
        {dump : The .sql export of the old system (phpMyAdmin or mysqldump)}
        {--database= : Name of the database to build, e.g. sinop_dev}
        {--replace : Drop and rebuild that database if it already has tables}
        {--force : Allow building into the database named in .env}';

    protected $description = 'Build a database from an old-system export, add the new tables and check it';

    private const CONNECTION = 'legacy_import';

    /** Statements that would switch to, create or drop another database. */
    private const SKIPPED = '/^(USE\s|(CREATE|DROP)\s+(DATABASE|SCHEMA)\b)/i';

    public function handle(): int
    {
        $dump = (string) $this->argument('dump');
        $target = (string) $this->option('database');
        $base = config('database.connections.'.config('database.default'));

        if (! is_file($dump) || ! is_readable($dump)) {
            $this->components->error("Cannot read {$dump}.");

            return self::FAILURE;
        }

        if (! preg_match('/^[A-Za-z0-9_]+$/', $target)) {
            $this->components->error('Name the database to build with --database=name (letters, digits and _ only).');

            return self::FAILURE;
        }

        if (! in_array($base['driver'] ?? null, ['mysql', 'mariadb'], true)) {
            $this->components->error('The import needs a MySQL or MariaDB connection.');

            return self::FAILURE;
        }

        // Checked before connecting, so the app's own database is never at risk.
        if ($target === ($base['database'] ?? null) && ! $this->option('force')) {
            $this->components->error("{$target} is the database the app uses (.env). Build into another name, or add --force if you really mean it.");

            return self::FAILURE;
        }

        $started = microtime(true);
        $server = $this->connect('legacy_server', 'information_schema', $base);
        $tables = (int) $server->selectOne('select count(*) as n from information_schema.tables where table_schema = ?', [$target])->n;

        if ($tables > 0 && ! $this->option('replace')) {
            $this->components->error("{$target} already has {$tables} tables. Add --replace to rebuild it.");

            return self::FAILURE;
        }

        $charset = $base['charset'] ?? 'utf8mb4';
        $collation = $base['collation'] ?? 'utf8mb4_unicode_ci';

        if ($tables > 0) {
            $server->statement("DROP DATABASE `{$target}`");
        }

        $server->statement("CREATE DATABASE IF NOT EXISTS `{$target}` CHARACTER SET {$charset} COLLATE {$collation}");
        DB::purge('legacy_server');

        // 1. Import the export as it is.
        $this->components->info('Importing '.basename($dump)." into {$target}");
        $db = $this->connect(self::CONNECTION, $target, $base);
        $expected = [];
        $statements = 0;

        $db->unprepared('SET FOREIGN_KEY_CHECKS=0');

        foreach (SqlDumpReader::statements($dump) as $statement) {
            if (preg_match(self::SKIPPED, $statement)) {
                $this->components->warn('Skipped: '.Str::limit($statement, 80));

                continue;
            }

            try {
                $db->unprepared($statement);
            } catch (Throwable $exception) {
                $this->components->error("Statement {$statements} failed: ".$exception->getMessage());
                $this->line(Str::limit($statement, 400));

                return self::FAILURE;
            }

            if ($insert = SqlDumpReader::insertedRows($statement)) {
                $expected[$insert['table']] = ($expected[$insert['table']] ?? 0) + $insert['rows'];
            }

            $statements++;
        }

        $db->unprepared('SET FOREIGN_KEY_CHECKS=1');
        $this->components->twoColumnDetail('Statements run', (string) $statements);

        // A fresh connection, so the migrations run with the app's own SQL mode
        // rather than the one the export set.
        DB::purge(self::CONNECTION);
        $db = DB::connection(self::CONNECTION);
        $migrationsBefore = $db->table('migrations')->count();

        // 2. Add the new tables and roles (only the migrations the export lacks).
        $this->components->info('Running the new migrations');

        if ($this->call('migrate', ['--database' => self::CONNECTION, '--force' => true]) !== self::SUCCESS) {
            return self::FAILURE;
        }

        // 3. Every row of the export is there.
        $this->components->info('Checking row counts against the export');
        $lost = 0;

        foreach ($expected as $table => $count) {
            if ($table === 'migrations') {
                continue;
            }

            $actual = $db->table($table)->count();
            $lost += max(0, $count - $actual);
            $this->components->twoColumnDetail($table, $actual === $count
                ? "<fg=green>{$actual}</>"
                : "<fg=red>{$actual} (export has {$count})</>");
        }

        $this->components->twoColumnDetail('migrations', $migrationsBefore.' from the export + '.($db->table('migrations')->count() - $migrationsBefore).' new');

        $this->call('sinop:audit-data', ['--database' => self::CONNECTION]);

        if ($lost > 0) {
            $this->components->error("{$lost} rows of the export are missing.");

            return self::FAILURE;
        }

        $this->components->info(sprintf('Built %s in %.1f s. To use it: set DB_DATABASE=%s in .env, then run php artisan config:clear.', $target, microtime(true) - $started, $target));

        return self::SUCCESS;
    }

    /** A connection like the app's, pointed at another database. */
    private function connect(string $name, string $database, array $base): Connection
    {
        config(["database.connections.{$name}" => ['database' => $database, 'url' => null] + $base]);
        DB::purge($name);

        return DB::connection($name);
    }
}
