<?php

namespace App\Listeners;

use App\Enums\ActivityAction;
use App\Enums\ActivityModule;
use App\Models\User;
use App\Services\ActivityRecorder;
use Illuminate\Auth\Events\Failed;
use Illuminate\Auth\Events\Login;
use Illuminate\Auth\Events\Logout;
use Laravel\Fortify\Events\TwoFactorAuthenticationConfirmed;
use Laravel\Fortify\Events\TwoFactorAuthenticationDisabled;

/**
 * Sign-ins, sign-outs, failed sign-ins and two-factor changes in the
 * activity log. Discovered automatically (handle* methods). Password changes
 * are recorded by the User model, whichever way they happen.
 */
class RecordAuthenticationActivity
{
    public function __construct(private readonly ActivityRecorder $recorder) {}

    public function handleLogin(Login $event): void
    {
        if ($event->user instanceof User) {
            $this->recorder->record(ActivityAction::Login, ActivityModule::Authentication, actor: $event->user, label: 'Signed in');
        }
    }

    public function handleLogout(Logout $event): void
    {
        if ($event->user instanceof User) {
            $this->recorder->record(ActivityAction::Logout, ActivityModule::Authentication, actor: $event->user, label: 'Signed out');
        }
    }

    public function handleFailed(Failed $event): void
    {
        $email = (string) ($event->credentials['email'] ?? '');
        $user = $event->user instanceof User ? $event->user : null;

        $this->recorder->record(
            ActivityAction::LoginFailed,
            ActivityModule::Authentication,
            summary: $user ? 'Wrong password' : 'No account with this email',
            actor: $user,
            label: $email !== '' ? "Sign-in attempt as {$email}" : 'Sign-in attempt',
            actorName: $email !== '' ? $email : 'Unknown',
        );
    }

    public function handleTwoFactorConfirmed(TwoFactorAuthenticationConfirmed $event): void
    {
        $this->recorder->record(ActivityAction::TwoFactorEnabled, ActivityModule::Account, $event->user);
    }

    public function handleTwoFactorDisabled(TwoFactorAuthenticationDisabled $event): void
    {
        $this->recorder->record(ActivityAction::TwoFactorDisabled, ActivityModule::Account, $event->user);
    }
}
