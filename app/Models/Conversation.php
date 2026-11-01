<?php

namespace App\Models;

use App\Services\Messenger;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Carbon;

/**
 * A conversation between a requester (staff) and the supply office, which
 * answers as a shared inbox. About an RIS, a concern, or anything else.
 * Changed only through App\Services\Messenger.
 *
 * @property int $id
 * @property string $kind request, concern or general
 * @property string $subject
 * @property int|null $ris_id
 * @property int|null $property_id
 * @property int $requester_id
 * @property int|null $started_by
 * @property string $status open (answered), waiting (for the office) or resolved
 * @property Carbon|null $last_message_at
 */
class Conversation extends Model
{
    public const KINDS = ['request', 'concern', 'general'];

    public const STATUSES = ['open', 'waiting', 'resolved'];

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['last_message_at' => 'datetime'];
    }

    /** @return HasMany<Message, $this> */
    public function messages(): HasMany
    {
        return $this->hasMany(Message::class);
    }

    /** @return HasOne<Message, $this> */
    public function latestMessage(): HasOne
    {
        return $this->hasOne(Message::class)->latestOfMany();
    }

    /**
     * The newest message from the supply office: who is on it, for the requester.
     *
     * @return HasOne<Message, $this>
     */
    public function latestOfficeReply(): HasOne
    {
        return $this->hasOne(Message::class)->ofMany(['id' => 'max'], fn (Builder $query) => $query->where('side', 'office'));
    }

    /** @return BelongsTo<User, $this> */
    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requester_id');
    }

    /** @return BelongsTo<RisSlip, $this> */
    public function risSlip(): BelongsTo
    {
        return $this->belongsTo(RisSlip::class, 'ris_id', 'ris_id');
    }

    /** @return BelongsTo<Property, $this> */
    public function property(): BelongsTo
    {
        return $this->belongsTo(Property::class);
    }

    /**
     * What this person sees in Messages: everything while they answer for
     * the supply office, their own conversations otherwise.
     *
     * @param  Builder<self>  $query
     */
    public function scopeVisibleTo(Builder $query, User $user): void
    {
        if (! Messenger::actsForOffice($user)) {
            $query->where('requester_id', $user->getKey());
        }
    }
}
