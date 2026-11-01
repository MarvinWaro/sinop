<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Messages between a requester and the supply office (a shared inbox):
 * conversations about an RIS, a concern or anything else, their messages
 * and attached files, and how far each person has read. Adds the
 * permission to answer for the supply office, given to the roles that
 * approve or issue requisitions. New tables only: safe to re-run.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('conversations')) {
            Schema::create('conversations', function (Blueprint $table) {
                $table->id();
                $table->string('kind', 10);
                $table->string('subject');
                $table->unsignedBigInteger('ris_id')->nullable();
                $table->foreignId('property_id')->nullable()->constrained()->nullOnDelete();
                $table->foreignId('requester_id')->constrained('users')->cascadeOnDelete();
                $table->foreignId('started_by')->nullable()->constrained('users')->nullOnDelete();
                $table->string('status', 10)->default('open');
                $table->timestamp('last_message_at')->nullable();
                $table->timestamps();

                $table->foreign('ris_id')->references('ris_id')->on('ris_slips')->nullOnDelete();
                $table->index(['requester_id', 'last_message_at']);
                $table->index(['status', 'last_message_at']);
                $table->index('ris_id');
            });
        }

        if (! Schema::hasTable('messages')) {
            Schema::create('messages', function (Blueprint $table) {
                $table->id();
                $table->foreignId('conversation_id')->constrained()->cascadeOnDelete();
                $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
                $table->string('side', 10);
                $table->text('body')->nullable();
                $table->timestamp('created_at')->useCurrent();

                $table->index(['conversation_id', 'id']);
            });
        }

        if (! Schema::hasTable('message_attachments')) {
            Schema::create('message_attachments', function (Blueprint $table) {
                $table->id();
                $table->foreignId('message_id')->constrained()->cascadeOnDelete();
                $table->string('path', 2048);
                $table->string('name');
                $table->string('mime', 100);
                $table->unsignedInteger('size');
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('conversation_reads')) {
            Schema::create('conversation_reads', function (Blueprint $table) {
                $table->foreignId('conversation_id')->constrained()->cascadeOnDelete();
                $table->foreignId('user_id')->constrained()->cascadeOnDelete();
                $table->unsignedBigInteger('last_read_message_id')->default(0);

                $table->primary(['conversation_id', 'user_id']);
            });
        }

        if (! DB::table('permissions')->where('slug', 'messages.office')->exists()) {
            DB::table('permissions')->insert([
                'name' => 'Answer messages for the supply office',
                'slug' => 'messages.office',
                'group' => 'Messages',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        $permissionId = DB::table('permissions')->where('slug', 'messages.office')->value('id');
        $roleIds = DB::table('permission_role')
            ->join('permissions', 'permissions.id', '=', 'permission_role.permission_id')
            ->whereIn('permissions.slug', ['ris.issue', 'ris.approve'])
            ->distinct()
            ->pluck('permission_role.role_id');

        DB::table('permission_role')->insertOrIgnore(
            $roleIds->map(fn ($roleId) => ['permission_id' => $permissionId, 'role_id' => $roleId])->all(),
        );
    }

    public function down(): void
    {
        Schema::dropIfExists('conversation_reads');
        Schema::dropIfExists('message_attachments');
        Schema::dropIfExists('messages');
        Schema::dropIfExists('conversations');
        DB::table('permissions')->where('slug', 'messages.office')->delete();
    }
};
