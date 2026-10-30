<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Each person's notifications (the header bell and the Notifications page).
 * One row per recipient. Who did what to which record is read from the
 * linked activity log entry, so no message text is copied here; stock alerts
 * also name their supply. Read rows are pruned after 90 days
 * (App\Models\Notification::prunable). New table only: safe to re-run.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('notifications')) {
            return;
        }

        Schema::create('notifications', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('kind', 40);
            $table->foreignUlid('activity_log_id')->constrained('activity_logs')->cascadeOnDelete();
            $table->unsignedBigInteger('supply_id')->nullable();
            $table->timestamp('read_at')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->foreign('supply_id')->references('supply_id')->on('supplies')->cascadeOnDelete();
            $table->index(['user_id', 'created_at']);
            $table->index(['user_id', 'read_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notifications');
    }
};
