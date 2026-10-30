<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Default Filesystem Disk
    |--------------------------------------------------------------------------
    |
    | Here you may specify the default filesystem disk that should be used
    | by the framework. The "local" disk, as well as a variety of cloud
    | based disks are available to your application for file storage.
    |
    */

    'default' => env('FILESYSTEM_DISK', 'local'),

    /*
    |--------------------------------------------------------------------------
    | Uploads Disk
    |--------------------------------------------------------------------------
    |
    | Where people's files go: e-signatures, profile photos and property
    | images. "s3" is the system's bucket in Berth (Garage); "public" keeps
    | them in storage/app/public, for working without the bucket. Either way
    | the app serves them at /files/... to signed-in users (App\Support\Uploads).
    |
    */

    'uploads' => env('UPLOADS_DISK', 'public'),

    /*
    |--------------------------------------------------------------------------
    | Filesystem Disks
    |--------------------------------------------------------------------------
    |
    | Below you may configure as many filesystem disks as necessary, and you
    | may even configure multiple disks for the same driver. Examples for
    | most supported storage drivers are configured here for reference.
    |
    | Supported drivers: "local", "ftp", "sftp", "s3"
    |
    */

    'disks' => [

        'local' => [
            'driver' => 'local',
            'root' => storage_path('app/private'),
            'serve' => true,
            'throw' => false,
            'report' => false,
        ],

        'public' => [
            'driver' => 'local',
            'root' => storage_path('app/public'),
            'url' => rtrim((string) env('APP_URL', 'http://localhost'), '/').'/storage',
            'visibility' => 'public',
            'throw' => false,
            'report' => false,
        ],

        's3' => [
            'driver' => 's3',
            'key' => env('AWS_ACCESS_KEY_ID'),
            'secret' => env('AWS_SECRET_ACCESS_KEY'),
            'region' => env('AWS_DEFAULT_REGION'),
            'bucket' => env('AWS_BUCKET'),
            'url' => env('AWS_URL'),
            'endpoint' => env('AWS_ENDPOINT'),
            'use_path_style_endpoint' => env('AWS_USE_PATH_STYLE_ENDPOINT', false),
            // Each environment has its own folder in the bucket, named after
            // APP_ENV: "local/" on a laptop, "production/" on the server. Local
            // testing can then be wiped without touching the live files.
            // AWS_ROOT overrides the name.
            'root' => env('AWS_ROOT') ?: env('APP_ENV', 'production'),
            // Private: the app serves the files (App\Support\Uploads).
            'visibility' => 'private',
            // Copies get the visibility above instead of reading the source's
            // ACL: Garage has no ACLs (GetObjectAcl → 501 Not Implemented).
            'retain_visibility' => false,
            // S3-compatible servers such as Garage can reject the checksums
            // newer AWS SDKs add to every request; send them only when required.
            'request_checksum_calculation' => 'when_required',
            'response_checksum_validation' => 'when_required',
            // A failed upload must stop the save, not store an empty path.
            'throw' => true,
            'report' => false,
        ],

    ],

    /*
    |--------------------------------------------------------------------------
    | Symbolic Links
    |--------------------------------------------------------------------------
    |
    | Here you may configure the symbolic links that will be created when the
    | `storage:link` Artisan command is executed. The array keys should be
    | the locations of the links and the values should be their targets.
    |
    */

    'links' => [
        public_path('storage') => storage_path('app/public'),
    ],

];
