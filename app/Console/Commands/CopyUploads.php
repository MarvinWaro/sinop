<?php

namespace App\Console\Commands;

use App\Support\Uploads;
use Illuminate\Console\Command;
use Illuminate\Http\File;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Copies uploaded files from a folder (the old system's storage/app/public,
 * or this app's) to the uploads disk, then checks that every file the
 * database points to is there. Safe to run again: files already copied
 * are skipped.
 */
class CopyUploads extends Command
{
    protected $signature = 'sinop:copy-uploads
        {from? : Folder holding signatures/, ris-signatures/, profile-photos/ and property_images/ (default: storage/app/public)}';

    protected $description = 'Copy e-signatures, profile photos and property images to the uploads disk';

    public function handle(): int
    {
        $from = rtrim((string) ($this->argument('from') ?? storage_path('app/public')), '\\/');

        if (! is_dir($from)) {
            $this->components->error("Cannot read the folder {$from}.");

            return self::FAILURE;
        }

        $disk = Uploads::disk();
        $this->components->info("Copying {$from} to the \"".Uploads::diskName().'" disk');

        foreach (Uploads::FOLDERS as $folder) {
            $copied = $skipped = 0;

            foreach (glob($from.DIRECTORY_SEPARATOR.$folder.DIRECTORY_SEPARATOR.'*') ?: [] as $file) {
                if (! is_file($file)) {
                    continue;
                }

                $path = $folder.'/'.basename($file);

                if ($disk->exists($path) && $disk->size($path) === filesize($file)) {
                    $skipped++;

                    continue;
                }

                $disk->putFileAs($folder, new File($file), basename($file));
                $copied++;
            }

            $this->components->twoColumnDetail($folder, "{$copied} copied, {$skipped} already there");
        }

        $missing = $this->referencedPaths()->reject(fn (string $path) => $disk->exists($path));

        if ($missing->isNotEmpty()) {
            $this->components->warn($missing->count().' files the database points to are not on the disk:');
            $this->components->bulletList($missing->take(20)->all());

            return self::FAILURE;
        }

        $this->components->info('Every file the database points to is on the disk.');

        return self::SUCCESS;
    }

    /** @return Collection<int, string> */
    private function referencedPaths(): Collection
    {
        $users = DB::table('users');

        return collect()
            ->merge((clone $users)->whereNotNull('signature_path')->pluck('signature_path'))
            ->merge((clone $users)->whereNotNull('profile_photo_path')->pluck('profile_photo_path'))
            ->merge(Schema::hasTable('property_images') ? DB::table('property_images')->pluck('file_path') : [])
            ->merge(Schema::hasTable('user_signatures') ? DB::table('user_signatures')->pluck('path') : [])
            ->merge(Schema::hasTable('ris_slip_signatures') ? DB::table('ris_slip_signatures')->pluck('path') : [])
            ->filter()
            ->unique()
            ->values();
    }
}
