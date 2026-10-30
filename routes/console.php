<?php

use App\Models\Notification;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Read notifications older than 90 days (Notification::prunable). Needs the
// scheduler running in production: `php artisan schedule:run` every minute.
Schedule::command('model:prune', ['--model' => [Notification::class]])->daily();
