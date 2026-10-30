<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Each person's saved e-signatures (drawn, typed or uploaded), one of them
 * the default. `users.signature_path` stays and always holds the default's
 * file, so older code keeps working. The existing signatures are copied in
 * as each person's default. New table only: safe to re-run.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('user_signatures')) {
            Schema::create('user_signatures', function (Blueprint $table) {
                $table->id();
                $table->foreignId('user_id')->constrained()->cascadeOnDelete();
                $table->string('name', 60);
                $table->string('source', 10);
                $table->string('path', 2048);
                $table->boolean('is_default')->default(false);
                $table->timestamps();

                $table->index(['user_id', 'is_default']);
            });
        }

        $now = now();

        DB::table('users')
            ->whereNotNull('signature_path')
            ->where('signature_path', '!=', '')
            ->whereNotExists(fn ($query) => $query->from('user_signatures')->whereColumn('user_signatures.user_id', 'users.id'))
            ->orderBy('id')
            ->select(['id', 'signature_path'])
            ->chunk(200, function ($users) use ($now) {
                DB::table('user_signatures')->insert($users->map(fn ($user) => [
                    'user_id' => $user->id,
                    'name' => 'Uploaded signature',
                    'source' => 'uploaded',
                    'path' => $user->signature_path,
                    'is_default' => true,
                    'created_at' => $now,
                    'updated_at' => $now,
                ])->all());
            });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_signatures');
    }
};
