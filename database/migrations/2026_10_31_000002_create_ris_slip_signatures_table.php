<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The e-signature put on an RIS at each step, as it was when signed: a copy
 * of the image (ris-signatures/…) and where the signer placed it inside
 * their box, as fractions of the box (x, y: centre; width: share of the box
 * width; rotation in degrees). Changing or deleting a saved signature later
 * doesn't change signed forms. SGD steps have no row. New table only: safe
 * to re-run.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('ris_slip_signatures')) {
            return;
        }

        Schema::create('ris_slip_signatures', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('ris_id');
            $table->string('step', 10);
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('path', 2048);
            $table->decimal('x', 5, 4);
            $table->decimal('y', 5, 4);
            $table->decimal('width', 5, 4);
            $table->decimal('rotation', 4, 1)->default(0);
            $table->timestamp('signed_at');
            $table->timestamps();

            $table->foreign('ris_id')->references('ris_id')->on('ris_slips')->cascadeOnDelete();
            $table->unique(['ris_id', 'step']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ris_slip_signatures');
    }
};
