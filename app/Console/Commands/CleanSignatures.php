<?php

namespace App\Console\Commands;

use App\Models\UserSignature;
use App\Support\SignatureInk;
use App\Support\Uploads;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Gives saved e-signatures uploaded with a paper background (white boxes on
 * the form, black boxes in dark mode) a transparent one. Each cleaned
 * signature gets a new file, because /files tells browsers to keep a file
 * for a year. Signatures that are already transparent are left alone, so it
 * is safe to run again.
 */
class CleanSignatures extends Command
{
    protected $signature = 'sinop:clean-signatures';

    protected $description = 'Make the background of saved e-signatures transparent';

    public function handle(): int
    {
        $disk = Uploads::disk();
        $cleaned = 0;
        $skipped = 0;
        $missing = [];

        UserSignature::query()->orderBy('id')->each(function (UserSignature $signature) use ($disk, &$cleaned, &$skipped, &$missing) {
            if (! $disk->exists($signature->path)) {
                $missing[] = $signature->path;

                return;
            }

            $png = SignatureInk::clean((string) $disk->get($signature->path));

            if ($png === null) {
                $skipped++;

                return;
            }

            $old = $signature->path;
            $new = 'signatures/'.Str::uuid().'.png';
            $disk->put($new, $png);

            DB::transaction(function () use ($signature, $old, $new) {
                $signature->forceFill(['path' => $new])->save();
                DB::table('users')->where('signature_path', $old)->update(['signature_path' => $new]);
            });

            $disk->delete($old);
            $cleaned++;
        });

        $this->components->info("{$cleaned} cleaned, {$skipped} already transparent.");

        if ($missing !== []) {
            $this->components->warn('Not on the disk (run sinop:copy-uploads first):');
            $this->components->bulletList($missing);

            return self::FAILURE;
        }

        return self::SUCCESS;
    }
}
