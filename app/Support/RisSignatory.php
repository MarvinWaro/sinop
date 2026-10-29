<?php

namespace App\Support;

use App\Models\AppSetting;
use App\Models\User;
use Throwable;

/**
 * The CAO who signs RIS forms: the person chosen in Settings › RIS
 * signatory. Falls back to the old rule (first active user whose role is
 * cao), then to the name the old code used, so RIS forms always have a CAO.
 */
class RisSignatory
{
    public const FALLBACK_NAME = 'Maria Teresa L. Samonte, Ed.D.';

    /**
     * @return array{id: int|null, name: string, designation: string, email: string|null}
     */
    public static function current(): array
    {
        try {
            $chosen = AppSetting::get(AppSetting::RIS_CAO_SIGNATORY);
            $user = $chosen !== null
                ? User::query()->whereKey($chosen)->where('status', true)->first()
                : null;

            $user ??= User::query()->where('role', 'cao')->where('status', 1)->first();
        } catch (Throwable $exception) {
            report($exception);
            $user = null;
        }

        if ($user === null) {
            return [
                'id' => null,
                'name' => self::FALLBACK_NAME,
                'designation' => 'Chief Administrative Officer',
                'email' => 'cao@system.local',
            ];
        }

        return [
            'id' => $user->id,
            'name' => $user->name,
            // The old code always resolved to this title; kept as it was.
            'designation' => 'Chief Administrative Officer',
            'email' => $user->email,
        ];
    }
}
