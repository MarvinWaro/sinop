<?php

namespace App\Enums;

/**
 * What an activity log entry records. The codes are stored as they are;
 * never reuse one for a different action.
 */
enum ActivityAction: string
{
    case Login = 'login';
    case Logout = 'logout';
    case LoginFailed = 'login_failed';
    case PasswordReset = 'password_reset';
    case PasswordChanged = 'password_changed';
    case TwoFactorEnabled = 'two_factor_enabled';
    case TwoFactorDisabled = 'two_factor_disabled';
    case Created = 'created';
    case Updated = 'updated';
    case Deleted = 'deleted';
    case Activated = 'activated';
    case Deactivated = 'deactivated';
    case Removed = 'removed';
    case Restored = 'restored';
    case Requested = 'requested';
    case Approved = 'approved';
    case Declined = 'declined';
    case Issued = 'issued';
    case Received = 'received';
    case Recorded = 'recorded';
    case Revalued = 'revalued';
    case Adjusted = 'adjusted';
    case Uploaded = 'uploaded';
    case Exported = 'exported';
    case Printed = 'printed';
    case Downloaded = 'downloaded';
    case SwitchedMode = 'switched_mode';

    /** The entry's badge. */
    public function label(): string
    {
        return match ($this) {
            self::Login => 'Login',
            self::Logout => 'Logout',
            self::LoginFailed => 'Failed login',
            self::PasswordReset => 'Password reset',
            self::PasswordChanged => 'Password changed',
            self::TwoFactorEnabled => '2FA enabled',
            self::TwoFactorDisabled => '2FA disabled',
            self::Created => 'Created',
            self::Updated => 'Updated',
            self::Deleted => 'Deleted',
            self::Activated => 'Activated',
            self::Deactivated => 'Deactivated',
            self::Removed => 'Removed',
            self::Restored => 'Restored',
            self::Requested => 'Requested',
            self::Approved => 'Approved',
            self::Declined => 'Declined',
            self::Issued => 'Issued',
            self::Received => 'Received',
            self::Recorded => 'Recorded',
            self::Revalued => 'Re-valued',
            self::Adjusted => 'Adjusted',
            self::Uploaded => 'Uploaded',
            self::Exported => 'Exported',
            self::Printed => 'Printed',
            self::Downloaded => 'Downloaded',
            self::SwitchedMode => 'Switched mode',
        };
    }

    /**
     * Colour group of the badge: positive (green), change (blue),
     * negative (red), output (amber), account (violet), neutral (grey).
     */
    public function tone(): string
    {
        return match ($this) {
            self::Login, self::Created, self::Activated, self::Restored, self::Approved,
            self::Issued, self::Received, self::Recorded, self::Uploaded => 'positive',
            self::Updated, self::Revalued, self::Adjusted, self::Requested => 'change',
            self::LoginFailed, self::Deleted, self::Deactivated, self::Removed, self::Declined => 'negative',
            self::Exported, self::Printed, self::Downloaded => 'output',
            self::PasswordReset, self::PasswordChanged, self::TwoFactorEnabled, self::TwoFactorDisabled => 'account',
            self::Logout, self::SwitchedMode => 'neutral',
        };
    }
}
