<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

/**
 * One switch a role can have, e.g. `ris.approve`. The list is fixed by
 * migrations because the code checks these slugs; roles choose from it.
 *
 * @property int $id
 * @property string $name
 * @property string $slug
 * @property string $group
 */
class Permission extends Model
{
    protected $fillable = ['name', 'slug', 'group'];

    public function roles(): BelongsToMany
    {
        return $this->belongsToMany(Role::class);
    }
}
