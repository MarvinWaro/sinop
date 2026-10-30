<?php

namespace App\Support;

use Generator;
use RuntimeException;

/**
 * Splits a phpMyAdmin / mysqldump export into single SQL statements, reading
 * the file a line at a time so a large export never sits in memory whole.
 *
 * It knows enough SQL to split correctly: semicolons inside '…', "…" and
 * `…` (with \ escapes and doubled quotes) don't end a statement, `-- `, `#`
 * and block comments are dropped, and MySQL's executable comments
 * (`/*!40101 SET … *\/`) are kept because they carry session settings.
 */
final class SqlDumpReader
{
    /** @return Generator<int, string> */
    public static function statements(string $path): Generator
    {
        $handle = @fopen($path, 'rb');

        if ($handle === false) {
            throw new RuntimeException("Cannot read {$path}.");
        }

        try {
            yield from self::split(self::lines($handle));
        } finally {
            fclose($handle);
        }
    }

    /**
     * @param  iterable<string>  $chunks  Pieces of SQL text in order (e.g. lines).
     * @return Generator<int, string>
     */
    public static function split(iterable $chunks): Generator
    {
        $statement = '';
        $quote = null;          // ', " or ` while inside one
        $lineComment = false;   // -- … or # … up to the end of the line
        $blockComment = false;  // /* … */ (dropped)
        $keptComment = false;   // /*! … */ (kept)
        $carry = '';            // the last character of the previous chunk, when it may start a token

        foreach ($chunks as $chunk) {
            $text = $carry.$chunk;
            $carry = '';
            $length = strlen($text);

            for ($i = 0; $i < $length; $i++) {
                $char = $text[$i];
                $next = $text[$i + 1] ?? null;

                if ($lineComment) {
                    if ($char === "\n") {
                        $lineComment = false;
                        $statement .= "\n";
                    }

                    continue;
                }

                if ($blockComment || $keptComment) {
                    if ($char === '*' && $next === null) {
                        $carry = '*';

                        break;
                    }

                    if ($keptComment) {
                        $statement .= $char;
                    }

                    if ($char === '*' && $next === '/') {
                        if ($keptComment) {
                            $statement .= '/';
                        }

                        $blockComment = $keptComment = false;
                        $i++;
                    }

                    continue;
                }

                if ($quote !== null) {
                    // An escape or a (possibly doubled) closing quote at the
                    // end of the chunk waits for the next character.
                    if ($next === null && ($char === $quote || ($char === '\\' && $quote !== '`'))) {
                        $carry = $char;

                        break;
                    }

                    $statement .= $char;

                    if ($char === '\\' && $quote !== '`') {
                        $statement .= $next;
                        $i++;
                    } elseif ($char === $quote) {
                        if ($next === $quote) {
                            $statement .= $next;
                            $i++;
                        } else {
                            $quote = null;
                        }
                    }

                    continue;
                }

                // Tokens that need the next character wait for it.
                if (($char === '-' || $char === '/') && $next === null) {
                    $carry = $char;

                    break;
                }

                if ($char === '-' && $next === '-' && in_array($text[$i + 2] ?? "\n", [' ', "\t", "\r", "\n"], true)) {
                    $lineComment = true;
                    $i++;

                    continue;
                }

                if ($char === '#') {
                    $lineComment = true;

                    continue;
                }

                if ($char === '/' && $next === '*') {
                    if (($text[$i + 2] ?? null) === '!') {
                        $keptComment = true;
                        $statement .= '/*';
                    } else {
                        $blockComment = true;
                    }

                    $i++;

                    continue;
                }

                if ($char === "'" || $char === '"' || $char === '`') {
                    $quote = $char;
                    $statement .= $char;

                    continue;
                }

                if ($char === ';') {
                    if (trim($statement) !== '') {
                        yield trim($statement);
                    }

                    $statement = '';

                    continue;
                }

                $statement .= $char;
            }
        }

        // A quote held back at the very end closes the string.
        $statement .= $carry;

        if (trim($statement) !== '') {
            yield trim($statement);
        }
    }

    /**
     * The table and number of rows of an `INSERT INTO `t` (…) VALUES (…), (…)`
     * statement, or null for anything else.
     *
     * @return array{table: string, rows: int}|null
     */
    public static function insertedRows(string $statement): ?array
    {
        if (! preg_match('/^INSERT\s+(?:IGNORE\s+)?INTO\s+`?([A-Za-z0-9_]+)`?/i', $statement, $match)) {
            return null;
        }

        $values = stripos($statement, 'VALUES');

        if ($values === false) {
            return null;
        }

        $rows = 0;
        $depth = 0;
        $quote = null;
        $length = strlen($statement);

        for ($i = $values + 6; $i < $length; $i++) {
            $char = $statement[$i];

            if ($quote !== null) {
                if ($char === '\\') {
                    $i++;
                } elseif ($char === $quote) {
                    if (($statement[$i + 1] ?? null) === $quote) {
                        $i++;
                    } else {
                        $quote = null;
                    }
                }

                continue;
            }

            if ($char === "'" || $char === '"') {
                $quote = $char;
            } elseif ($char === '(') {
                if ($depth === 0) {
                    $rows++;
                }

                $depth++;
            } elseif ($char === ')') {
                $depth--;
            }
        }

        return ['table' => $match[1], 'rows' => $rows];
    }

    /**
     * @param  resource  $handle
     * @return Generator<int, string>
     */
    private static function lines($handle): Generator
    {
        while (($line = fgets($handle)) !== false) {
            yield $line;
        }
    }
}
