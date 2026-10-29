<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The activity log: who did what in SINOP, and when. Written only by
 * App\Services\ActivityRecorder; entries are never edited or deleted.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('activity_logs', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            // Kept as text so an entry still reads after the account changes or goes.
            $table->string('actor_name');
            $table->string('actor_role', 20)->nullable();
            $table->foreignId('department_id')->nullable()->constrained('departments')->nullOnDelete();
            $table->string('module', 40);
            $table->string('action', 40);
            $table->string('subject_type', 40)->nullable();
            $table->string('subject_id', 40)->nullable();
            $table->string('subject_label')->nullable();
            $table->string('summary')->nullable();
            $table->json('changes')->nullable();
            $table->json('properties')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->string('user_agent', 512)->nullable();
            $table->timestamp('created_at')->useCurrent()->index();

            $table->index(['user_id', 'created_at']);
            $table->index(['module', 'created_at']);
            $table->index(['action', 'created_at']);
            $table->index(['subject_type', 'subject_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('activity_logs');
    }
};
