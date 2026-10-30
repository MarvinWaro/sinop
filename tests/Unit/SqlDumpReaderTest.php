<?php

use App\Support\SqlDumpReader;

/** Split SQL fed in the given pieces (default: one line at a time, like a file). */
function splitSql(string $sql, ?array $chunks = null): array
{
    $chunks ??= preg_split('/(?<=\n)/', $sql);

    return iterator_to_array(SqlDumpReader::split($chunks), false);
}

test('statements end at semicolons outside strings', function () {
    $sql = "CREATE TABLE `a` (`id` int);\nINSERT INTO `a` VALUES (1), (2);\nCOMMIT;\n";

    expect(splitSql($sql))->toBe([
        'CREATE TABLE `a` (`id` int)',
        'INSERT INTO `a` VALUES (1), (2)',
        'COMMIT',
    ]);
});

test('semicolons, newlines and quotes inside strings stay in the statement', function () {
    $sql = "INSERT INTO `t` VALUES (1, 'a; b\nnext line', 'it''s', 'say \\'hi\\';', \"x;y\");\nSELECT 2;\n";

    expect(splitSql($sql))->toBe([
        "INSERT INTO `t` VALUES (1, 'a; b\nnext line', 'it''s', 'say \\'hi\\';', \"x;y\")",
        'SELECT 2',
    ]);
});

test('comments are dropped but executable comments are kept', function () {
    $sql = "-- phpMyAdmin SQL Dump\n--\n# hash comment\n/* block; comment */\n/*!40101 SET NAMES utf8mb4 */;\nSELECT 1 -- trailing\n;\nSELECT 3-1;\n";

    expect(splitSql($sql))->toBe([
        '/*!40101 SET NAMES utf8mb4 */',
        'SELECT 1',
        'SELECT 3-1',
    ]);
});

test('tokens split across chunks are still understood', function () {
    $sql = "INSERT INTO `t` VALUES ('it''s; fine');-- note\nSELECT 'a\\'b';/* x */SELECT 5;";

    // Every possible two-way cut, plus one character at a time.
    foreach (range(1, strlen($sql) - 1) as $cut) {
        expect(splitSql($sql, [substr($sql, 0, $cut), substr($sql, $cut)]))->toBe([
            "INSERT INTO `t` VALUES ('it''s; fine')",
            "SELECT 'a\\'b'",
            'SELECT 5',
        ]);
    }

    expect(splitSql($sql, str_split($sql)))->toHaveCount(3);
});

test('a last statement without a semicolon is returned', function () {
    expect(splitSql("SELECT 1;\nSELECT 2"))->toBe(['SELECT 1', 'SELECT 2']);
});

test('inserted rows are counted per statement', function () {
    expect(SqlDumpReader::insertedRows("INSERT INTO `ris_items` (`a`, `b`) VALUES\n(1, 'x (y)'),\n(2, 'it''s (3)'),\n(3, NULL)"))
        ->toBe(['table' => 'ris_items', 'rows' => 3])
        ->and(SqlDumpReader::insertedRows('CREATE TABLE `x` (`id` int)'))->toBeNull();
});

test('a file is read statement by statement', function () {
    $path = tempnam(sys_get_temp_dir(), 'dump');
    file_put_contents($path, "SET time_zone = \"+00:00\";\r\nINSERT INTO `a` VALUES (1);\r\n");

    try {
        expect(iterator_to_array(SqlDumpReader::statements($path), false))
            ->toBe(['SET time_zone = "+00:00"', 'INSERT INTO `a` VALUES (1)']);
    } finally {
        unlink($path);
    }
});
