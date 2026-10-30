<?php

namespace App\Models;

use App\Enums\ActivityAction;
use App\Enums\ActivityModule;
use App\Models\Concerns\LogsActivity;
use App\Services\ActivityRecorder;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Http\UploadedFile;
use Illuminate\Notifications\RoutesNotifications;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Laravel\Fortify\TwoFactorAuthenticatable;

/**
 * @property int $id
 * @property string $name
 * @property string $email
 * @property string $role
 * @property int|null $department_id
 * @property int|null $designation_id
 * @property Carbon|null $email_verified_at
 * @property string $password
 * @property bool $status
 * @property bool $needs_password_change
 * @property string|null $two_factor_secret
 * @property string|null $two_factor_recovery_codes
 * @property Carbon|null $two_factor_confirmed_at
 * @property string|null $remember_token
 * @property int|null $current_team_id
 * @property string|null $profile_photo_path
 * @property string|null $signature_path
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    // RoutesNotifications (not Notifiable) still sends mail such as password
    // resets; `notifications()` below is SINOP's own notification center.
    use HasFactory, LogsActivity, RoutesNotifications, TwoFactorAuthenticatable;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'role',
        'department_id',
        'designation_id',
        'status',
        'needs_password_change',
        'signature_path',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
        'two_factor_recovery_codes',
        'two_factor_secret',
    ];

    /**
     * The accessors to append to the model's array form.
     *
     * @var list<string>
     */
    protected $appends = [
        'profile_photo_url',
        'avatar',
        'signature_url',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'two_factor_confirmed_at' => 'datetime',
            'needs_password_change' => 'boolean',
        ];
    }

    /**
     * RELATIONSHIPS
     */
    public function department()
    {
        return $this->belongsTo(Department::class);
    }

    public function designation()
    {
        return $this->belongsTo(Designation::class);
    }

    public function properties()
    {
        return $this->hasMany(Property::class, 'user_id');
    }

    /** The person's notifications (App\Services\Notifier writes them). */
    public function notifications(): HasMany
    {
        return $this->hasMany(Notification::class);
    }

    public function transactions()
    {
        return $this->belongsToMany(SupplyTransaction::class, 'user_transactions', 'user_id', 'transaction_id')
            ->withPivot('role')
            ->withTimestamps();
    }

    public function requestedTransactions()
    {
        return $this->transactions()->wherePivot('role', 'requester');
    }

    public function receivedTransactions()
    {
        return $this->transactions()->wherePivot('role', 'receiver');
    }

    /**
     * ROLE HELPER METHODS
     *
     * @param  string|array<int, string>  $roles
     */
    public function hasRole($roles): bool
    {
        if (is_string($roles)) {
            return $this->role === $roles;
        }

        if (is_array($roles)) {
            return in_array($this->role, $roles);
        }

        return false;
    }

    public function hasAdminPrivileges(): bool
    {
        return in_array($this->role, ['admin', 'cao']);
    }

    /**
     * @param  array<int, string>  $roles
     */
    public function hasAnyRole(array $roles): bool
    {
        return in_array($this->role, $roles);
    }

    public function isAdmin(): bool
    {
        return $this->role === 'admin';
    }

    public function isCao(): bool
    {
        return $this->role === 'cao';
    }

    public function isStaff(): bool
    {
        return $this->role === 'staff';
    }

    /**
     * STATUS / ACTIVE HELPERS
     */
    public function getIsActiveAttribute()
    {
        return $this->status === 'active';
    }

    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }

    public function scopeByRole($query, $role)
    {
        return $query->where('role', $role);
    }

    public function scopeAdminAndCao($query)
    {
        return $query->whereIn('role', ['admin', 'cao']);
    }

    /**
     * ACCESSORS
     */
    public function getDepartmentNameAttribute()
    {
        return $this->department ? $this->department->name : 'No Department';
    }

    public function getDesignationNameAttribute()
    {
        return $this->designation ? $this->designation->name : 'No Designation';
    }

    public function getRoleNameAttribute()
    {
        return match ($this->role) {
            'admin' => 'Administrator',
            'cao' => 'Chief Administrative Officer',
            'staff' => 'Staff',
            default => 'Unknown Role'
        };
    }

    public function getDisplayNameAttribute()
    {
        return $this->name.' ('.$this->role_name.')';
    }

    /**
     * PROFILE PHOTO (previously provided by Jetstream's HasProfilePhoto)
     */
    public function getProfilePhotoUrlAttribute(): string
    {
        if ($this->profile_photo_path) {
            return Storage::disk('public')->url($this->profile_photo_path);
        }

        $initials = collect(explode(' ', trim((string) $this->name)))
            ->filter()
            ->map(fn ($segment) => mb_substr($segment, 0, 1))
            ->join(' ');

        return 'https://ui-avatars.com/api/?name='.urlencode($initials).'&color=7F9CF5&background=EBF4FF';
    }

    /**
     * Avatar used by the starter kit's user menu. Only set when the user
     * uploaded a photo, so the UI falls back to initials otherwise.
     */
    public function getAvatarAttribute(): ?string
    {
        return $this->profile_photo_path
            ? Storage::disk('public')->url($this->profile_photo_path)
            : null;
    }

    public function getSignatureUrlAttribute(): ?string
    {
        return $this->signature_path
            ? Storage::disk('public')->url($this->signature_path)
            : null;
    }

    public function updateProfilePhoto(UploadedFile $photo): void
    {
        $previous = $this->profile_photo_path;

        $this->forceFill([
            'profile_photo_path' => $photo->storePublicly('profile-photos', ['disk' => 'public']),
        ])->save();

        if ($previous) {
            Storage::disk('public')->delete($previous);
        }
    }

    public function deleteProfilePhoto(): void
    {
        if (! $this->profile_photo_path) {
            return;
        }

        Storage::disk('public')->delete($this->profile_photo_path);

        $this->forceFill(['profile_photo_path' => null])->save();
    }

    /**
     * Account events that ordinary edits don't show: password, profile photo
     * and e-signature. Caught here so every path (settings, first-login
     * change, admin reset, forgot-password link) records the same way.
     */
    protected static function booted(): void
    {
        // Every account gets a role, wherever it is created (admin form, the
        // RIS manual-entry CAO record, registration): the one matching its
        // `users.role`, or Staff.
        static::created(function (User $user): void {
            if ($user->roles()->exists()) {
                return;
            }

            $role = Role::query()->where('slug', $user->role ?: 'staff')->first()
                ?? Role::query()->where('slug', 'staff')->first();

            if ($role !== null) {
                $user->roles()->attach($role);
            }
        });

        static::updated(function (User $user): void {
            $recorder = app(ActivityRecorder::class);
            $isSelf = Auth::id() === $user->getKey();

            if ($user->wasChanged('password')) {
                match (true) {
                    $isSelf => $recorder->record(ActivityAction::PasswordChanged, ActivityModule::Account, $user),
                    Auth::check() => $recorder->record(ActivityAction::PasswordReset, ActivityModule::Users, $user, summary: 'Reset to the default password'),
                    default => $recorder->record(ActivityAction::PasswordReset, ActivityModule::Account, $user, summary: 'Through the forgot-password link'),
                };
            }

            foreach (['profile_photo_path' => 'Profile photo', 'signature_path' => 'E-signature'] as $column => $what) {
                if ($user->wasChanged($column)) {
                    $recorder->record(
                        $user->{$column} ? ActivityAction::Uploaded : ActivityAction::Removed,
                        $isSelf ? ActivityModule::Account : ActivityModule::Users,
                        $user,
                        summary: $what,
                    );
                }
            }
        });
    }

    /*
    |--------------------------------------------------------------------------
    | Roles and permissions
    |--------------------------------------------------------------------------
    | A user can hold several roles and has every permission of each. The
    | Administrator role (super admin) has every permission. `users.role` is
    | kept in sync (admin, cao or staff) for code that still reads it.
    */

    /** @var list<string>|null Permission slugs, worked out once per request. */
    private ?array $permissionCache = null;

    public function roles(): BelongsToMany
    {
        return $this->belongsToMany(Role::class);
    }

    public function isSuperAdmin(): bool
    {
        return $this->relationLoaded('roles')
            ? $this->roles->contains('slug', Role::SUPER_ADMIN)
            : $this->roles()->where('slug', Role::SUPER_ADMIN)->exists();
    }

    /** @return list<string> */
    public function permissionSlugs(): array
    {
        if ($this->permissionCache !== null) {
            return $this->permissionCache;
        }

        $this->loadMissing('roles.permissions');

        return $this->permissionCache = $this->isSuperAdmin()
            ? Permission::query()->orderBy('slug')->pluck('slug')->all()
            : $this->roles->flatMap(fn (Role $role) => $role->permissions->pluck('slug'))->unique()->sort()->values()->all();
    }

    public function hasPermission(string $slug): bool
    {
        return in_array($slug, $this->permissionSlugs(), true);
    }

    /** Active accounts holding the permission through a role (super admins hold all). */
    public function scopeWithPermission(Builder $query, string $slug): void
    {
        $query->where('status', true)->whereHas('roles', fn (Builder $roles) => $roles
            ->where('slug', Role::SUPER_ADMIN)
            ->orWhereHas('permissions', fn (Builder $permissions) => $permissions->where('slug', $slug)));
    }

    /**
     * The role that best describes the person, for labels such as the
     * activity log: Administrator, then CAO, then any other role, then Staff.
     */
    public function primaryRoleSlug(): string
    {
        $slugs = $this->roles()->orderBy('roles.id')->pluck('slug');

        return match (true) {
            $slugs->contains(Role::SUPER_ADMIN) => Role::SUPER_ADMIN,
            $slugs->contains('cao') => 'cao',
            default => $slugs->first(fn (string $slug) => $slug !== 'staff') ?? ($this->role ?: 'staff'),
        };
    }

    /** Forget the worked-out permissions after the user's roles change. */
    public function flushPermissionCache(): void
    {
        $this->permissionCache = null;
        $this->unsetRelation('roles');
    }

    /**
     * Keep the old `users.role` column matching the roles: admin when they're
     * a super admin, cao when they hold CAO, otherwise staff.
     */
    public function syncLegacyRole(): void
    {
        $slugs = $this->roles()->pluck('slug');
        $legacy = match (true) {
            $slugs->contains(Role::SUPER_ADMIN) => 'admin',
            $slugs->contains('cao') => 'cao',
            default => 'staff',
        };

        if ($this->role !== $legacy) {
            $this->forceFill(['role' => $legacy])->saveQuietly();
        }

        $this->flushPermissionCache();
    }

    /** A person editing their own profile is "My account"; anyone else's is "Users". */
    public function activityModule(): ActivityModule
    {
        return Auth::id() === $this->getKey() ? ActivityModule::Account : ActivityModule::Users;
    }

    /**
     * Password, photo, signature and the forced-change flag get their own
     * entries where they change (password changed / reset, photo, signature).
     *
     * @return list<string>
     */
    public function activityIgnored(): array
    {
        return ['needs_password_change', 'profile_photo_path', 'signature_path', 'current_team_id', 'email_verified_at'];
    }

    public function activityActionFor(array $changes): ?ActivityAction
    {
        // Switching an account on or off on its own reads as that, not an edit.
        if (array_keys($changes) === ['status']) {
            return $changes['status'][1] ? ActivityAction::Activated : ActivityAction::Deactivated;
        }

        return null;
    }
}
