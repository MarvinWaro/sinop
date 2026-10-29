<?php

use App\Http\Controllers\Settings\ActivityLogController;
use App\Http\Controllers\Settings\ProfileController;
use App\Http\Controllers\Settings\RisSignatoryController;
use App\Http\Controllers\Settings\RoleController;
use App\Http\Controllers\Settings\SecurityController;
use App\Http\Controllers\SignatureController;
use Illuminate\Auth\Middleware\RequirePassword;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth'])->group(function () {
    Route::redirect('settings', '/settings/profile');

    Route::get('settings/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('settings/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('settings/profile-photo', [ProfileController::class, 'destroyPhoto'])->name('profile-photo.destroy');

    // E-signature used on RIS forms (was a section of the Jetstream profile page)
    Route::get('settings/signature', [SignatureController::class, 'edit'])->name('signature.edit');
});

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('settings/security', [SecurityController::class, 'edit'])
        ->middleware(RequirePassword::class)
        ->name('security.edit');

    Route::put('settings/password', [SecurityController::class, 'update'])
        ->middleware('throttle:6,1')
        ->name('user-password.update');

    Route::inertia('settings/appearance', 'settings/appearance')->name('appearance.edit');
});

// Admin-side settings, each behind its own permission (not while in user mode).
Route::middleware(['auth', 'verified', 'admin-cao', 'admin.not-user-mode'])->group(function () {
    Route::get('settings/activity-logs', [ActivityLogController::class, 'index'])->name('activity-logs.index')->middleware('can:activity-logs.view');

    Route::get('settings/roles', [RoleController::class, 'index'])->name('roles.index')->middleware('can:roles.view');
    Route::post('settings/roles', [RoleController::class, 'store'])->name('roles.store')->middleware('can:roles.create');
    Route::put('settings/roles/{role}', [RoleController::class, 'update'])->name('roles.update')->middleware('can:roles.update');
    Route::delete('settings/roles/{role}', [RoleController::class, 'destroy'])->name('roles.destroy')->middleware('can:roles.delete');

    Route::get('settings/ris-signatory', [RisSignatoryController::class, 'edit'])->name('ris-signatory.edit')->middleware('can:settings.ris-signatory');
    Route::put('settings/ris-signatory', [RisSignatoryController::class, 'update'])->name('ris-signatory.update')->middleware('can:settings.ris-signatory');
});
