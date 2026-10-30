<?php

namespace App\Models;

use App\Support\Uploads;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * One of a person's saved e-signatures: a transparent PNG on the uploads
 * disk (signatures/…). Changed only through App\Services\SignatureLibrary.
 *
 * @property int $id
 * @property int $user_id
 * @property string $name
 * @property string $source drawn, typed or uploaded
 * @property string $path
 * @property bool $is_default
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class UserSignature extends Model
{
    public const SOURCES = ['drawn', 'typed', 'uploaded'];

    /** Most signatures one person can keep. */
    public const LIMIT = 10;

    protected $guarded = ['id'];

    protected $hidden = ['path', 'user_id'];

    protected $appends = ['url'];

    protected function casts(): array
    {
        return ['is_default' => 'boolean'];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function getUrlAttribute(): ?string
    {
        return Uploads::url($this->path);
    }
}
