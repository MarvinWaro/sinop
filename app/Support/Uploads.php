<?php

namespace App\Support;

use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Support\Facades\Storage;
use Throwable;

/**
 * People's files: e-signatures (saved ones, and the copies frozen on signed
 * RIS forms), profile photos and property images. They live on the uploads
 * disk (`filesystems.uploads`: the S3 bucket, or storage/app/public) and the
 * browser loads them from /files/<path>, so the bucket stays private and the
 * links never expire.
 */
final class Uploads
{
    /** The folders the app writes to; only these are served. */
    public const FOLDERS = ['signatures', 'ris-signatures', 'profile-photos', 'property_images'];

    public static function diskName(): string
    {
        return config('filesystems.uploads');
    }

    public static function disk(): FilesystemAdapter
    {
        return Storage::disk(self::diskName());
    }

    /** A saved e-signature or a copy frozen on an RIS. */
    public static function isSignature(string $path): bool
    {
        return str_starts_with($path, 'signatures/') || str_starts_with($path, 'ris-signatures/');
    }

    /** Where the browser loads the file from; null when there is none. */
    public static function url(?string $path): ?string
    {
        return $path ? route('uploads.show', ['path' => $path], false) : null;
    }

    /**
     * A file on this server with the upload's contents, for libraries that
     * only read local files (PhpSpreadsheet drawings). Null when the upload
     * is missing or can't be read. A downloaded copy is deleted after the
     * response is sent.
     */
    public static function localPath(?string $path): ?string
    {
        if (! $path) {
            return null;
        }

        try {
            $disk = self::disk();

            if (! $disk->exists($path)) {
                return null;
            }

            if (config('filesystems.disks.'.self::diskName().'.driver') === 'local') {
                return $disk->path($path);
            }

            $copy = (string) tempnam(sys_get_temp_dir(), 'upload');
            file_put_contents($copy, $disk->get($path));
            app()->terminating(fn () => @unlink($copy));

            return $copy;
        } catch (Throwable $exception) {
            report($exception);

            return null;
        }
    }
}
