<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Small key/value settings chosen in the app. The first one is the CAO who
 * signs RIS forms, which used to be "the first active user whose role is
 * cao"; that same person is saved here so nothing changes on day one.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('app_settings')) {
            Schema::create('app_settings', function (Blueprint $table) {
                $table->string('key')->primary();
                $table->text('value')->nullable();
                $table->timestamps();
            });
        }

        $cao = DB::table('users')->where('role', 'cao')->where('status', 1)->orderBy('id')->value('id');

        DB::table('app_settings')->insertOrIgnore([
            'key' => 'ris.cao_signatory_user_id',
            'value' => $cao !== null ? (string) $cao : null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('app_settings');
    }
};
