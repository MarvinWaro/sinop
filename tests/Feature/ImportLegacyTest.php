<?php

/*
 * The import itself needs MySQL/MariaDB and is checked by running it on an
 * export. These are the guards that run before any connection is made.
 */

test('the database the app uses is refused without --force', function () {
    $dump = tempnam(sys_get_temp_dir(), 'dump');
    $default = config('database.default');

    // Pretend the app runs on MySQL database "cims"; nothing connects to it.
    config([
        'database.connections.app_mysql' => ['driver' => 'mysql', 'host' => '203.0.113.1', 'database' => 'cims', 'username' => 'nobody', 'password' => ''],
        'database.default' => 'app_mysql',
    ]);

    try {
        $this->artisan('sinop:import-legacy', ['dump' => $dump, '--database' => 'cims', '--replace' => true])
            ->expectsOutputToContain('is the database the app uses')
            ->assertFailed();
    } finally {
        config(['database.default' => $default]);
        unlink($dump);
    }
});

test('a missing export or an unsafe database name is refused', function () {
    $this->artisan('sinop:import-legacy', ['dump' => 'C:/no/such/export.sql', '--database' => 'sinop_dev'])
        ->expectsOutputToContain('Cannot read')
        ->assertFailed();

    $dump = tempnam(sys_get_temp_dir(), 'dump');

    $this->artisan('sinop:import-legacy', ['dump' => $dump, '--database' => 'sinop`; DROP DATABASE cims; --'])
        ->expectsOutputToContain('letters, digits and _ only')
        ->assertFailed();

    unlink($dump);
});
