<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

/**
 * A named bundle of permissions. A user can hold several roles and gets every
 * permission of each. "Administrator" (slug `admin`) is the super admin: it
 * always has every permission and can't be edited or deleted. Changes are
 * logged by Settings\RoleController (with the permissions added and removed).
 *
 * @property int $id
 * @property string $name
 * @property string $slug
 * @property string|null $description
 */
class Role extends Model
{
    public const SUPER_ADMIN = 'admin';

    /** Built in: can't be deleted (CAO and Staff can still be edited). */
    public const BUILT_IN = ['admin', 'cao', 'staff'];

    protected $fillable = ['name', 'slug', 'description'];

    public function permissions(): BelongsToMany
    {
        return $this->belongsToMany(Permission::class);
    }

    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class);
    }

    public function isSuperAdmin(): bool
    {
        return $this->slug === self::SUPER_ADMIN;
    }

    public function isBuiltIn(): bool
    {
        return in_array($this->slug, self::BUILT_IN, true);
    }
}
