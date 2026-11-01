<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * One message in a conversation, written by the requester or by someone in
 * the supply office (`side`), or a status line (`system`: the body is
 * `resolved` or `reopened`, by `user_id`). Messages are never edited.
 *
 * @property int $id
 * @property int $conversation_id
 * @property int|null $user_id
 * @property string $side requester, office or system
 * @property string|null $body
 * @property Carbon $created_at
 */
class Message extends Model
{
    public const UPDATED_AT = null;

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['created_at' => 'datetime'];
    }

    /** @return BelongsTo<Conversation, $this> */
    public function conversation(): BelongsTo
    {
        return $this->belongsTo(Conversation::class);
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return HasMany<MessageAttachment, $this> */
    public function attachments(): HasMany
    {
        return $this->hasMany(MessageAttachment::class);
    }
}
