<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * The conditions a property can be in (Serviceable, Unserviceable, and any
 * an admin types in the property form). `properties.condition` keeps the
 * name as before. Seeded with the two defaults and every condition already
 * used. New table only: safe to re-run.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('property_conditions')) {
            Schema::create('property_conditions', function (Blueprint $table) {
                $table->id();
                $table->string('name', 50)->unique();
                $table->timestamps();
            });
        }

        $known = DB::table('property_conditions')->pluck('name')->map(fn ($name) => mb_strtolower($name));
        $used = DB::table('properties')->whereNotNull('condition')->distinct()->pluck('condition');

        collect(['Serviceable', 'Unserviceable'])
            ->merge($used)
            ->map(fn ($name) => trim(preg_replace('/\s+/', ' ', (string) $name)))
            ->filter()
            ->unique(fn ($name) => mb_strtolower($name))
            ->reject(fn ($name) => $known->contains(mb_strtolower($name)))
            ->each(fn ($name) => DB::table('property_conditions')->insert([
                'name' => mb_substr($name, 0, 50),
                'created_at' => now(),
                'updated_at' => now(),
            ]));
    }

    public function down(): void
    {
        Schema::dropIfExists('property_conditions');
    }
};
