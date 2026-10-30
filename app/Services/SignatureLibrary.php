<?php

namespace App\Services;

use App\Enums\ActivityAction;
use App\Enums\ActivityModule;
use App\Models\User;
use App\Models\UserSignature;
use App\Support\Uploads;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * A person's saved e-signatures: up to UserSignature::LIMIT, exactly one of
 * them the default while any exist. `users.signature_path` always holds the
 * default's file, for the code that still reads it.
 */
class SignatureLibrary
{
    public function __construct(private readonly ActivityRecorder $recorder) {}

    public function add(User $user, UploadedFile $file, string $name, string $source, bool $makeDefault = false): UserSignature
    {
        if ($user->signatures()->count() >= UserSignature::LIMIT) {
            throw ValidationException::withMessages([
                'file' => 'You can keep up to '.UserSignature::LIMIT.' signatures. Delete one to add another.',
            ]);
        }

        $path = $file->store('signatures', Uploads::diskName());

        $signature = DB::transaction(function () use ($user, $path, $name, $source, $makeDefault) {
            $signature = $user->signatures()->create([
                'name' => $name,
                'source' => $source,
                'path' => $path,
                'is_default' => false,
            ]);

            if ($makeDefault || ! $user->signatures()->where('is_default', true)->exists()) {
                $this->setDefault($user, $signature);
            }

            return $signature->refresh();
        });

        $this->recorder->record(ActivityAction::Uploaded, ActivityModule::Account, $user, summary: "E-signature: {$name}");

        return $signature;
    }

    public function makeDefault(UserSignature $signature): void
    {
        DB::transaction(fn () => $this->setDefault($signature->user, $signature));

        $this->recorder->record(ActivityAction::Updated, ActivityModule::Account, $signature->user, summary: "Default e-signature: {$signature->name}");
    }

    /** Signed RIS forms keep their own copies, so the file can go. */
    public function remove(UserSignature $signature): void
    {
        $user = $signature->user;

        DB::transaction(function () use ($user, $signature) {
            $signature->delete();

            if ($signature->is_default) {
                $next = $user->signatures()->first();
                $next !== null ? $this->setDefault($user, $next) : $this->syncUserColumn($user, null);
            }
        });

        Uploads::disk()->delete($signature->path);

        $this->recorder->record(ActivityAction::Removed, ActivityModule::Account, $user, summary: "E-signature: {$signature->name}");
    }

    private function setDefault(User $user, UserSignature $signature): void
    {
        UserSignature::query()
            ->where('user_id', $user->getKey())
            ->whereKeyNot($signature->getKey())
            ->where('is_default', true)
            ->update(['is_default' => false]);
        $signature->forceFill(['is_default' => true])->save();

        $this->syncUserColumn($user, $signature->path);
    }

    /** Quietly: the library records its own activity entries. */
    private function syncUserColumn(User $user, ?string $path): void
    {
        $user->forceFill(['signature_path' => $path])->saveQuietly();
    }
}
