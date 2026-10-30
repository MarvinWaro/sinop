<?php

namespace App\Http\Controllers;

use App\Support\Uploads;
use Symfony\Component\HttpFoundation\StreamedResponse;

class UploadController extends Controller
{
    /**
     * An uploaded file (e-signature, profile photo, property image), for
     * signed-in users. Every upload gets a new file name, so the browser
     * may keep its copy.
     */
    public function show(string $path): StreamedResponse
    {
        $disk = Uploads::disk();

        abort_unless($disk->exists($path), 404);

        return $disk->response($path, headers: ['Cache-Control' => 'private, max-age=31536000, immutable']);
    }
}
