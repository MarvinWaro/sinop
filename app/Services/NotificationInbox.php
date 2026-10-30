<?php

namespace App\Services;

use App\Enums\NotificationKind;
use App\Models\Notification;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;

/**
 * A person's own notifications: what they hold, and reading or clearing
 * them. Shared by the header bell and the Notifications page.
 */
class NotificationInbox
{
    /** Notifications per page in the bell's panel. */
    public const RECENT_PER_PAGE = 5;

    /** Notifications per page on the Notifications page. */
    public const PAGE_SIZE = 15;

    /** What NotificationResource reads, loaded for a whole page at once. */
    public const RELATIONS = [
        'activity:id,user_id,actor_name,subject_label',
        'activity.user:id,name,profile_photo_path',
        'supply:supply_id,item_name,stock_no',
    ];

    public function __construct(private readonly LiveUpdates $live) {}

    /**
     * How many are unread and when the newest arrived (one query), so the
     * browser can tell when something new came in.
     *
     * @return array{unread: int, latest_at: string|null}
     */
    public function summary(User $user): array
    {
        $row = $user->notifications()
            ->toBase()
            ->selectRaw('COUNT(CASE WHEN read_at IS NULL THEN 1 END) AS unread, MAX(created_at) AS latest_at')
            ->first();

        return [
            'unread' => (int) ($row->unread ?? 0),
            'latest_at' => $row?->latest_at !== null
                ? CarbonImmutable::parse($row->latest_at, 'UTC')->toIso8601ZuluString()
                : null,
        ];
    }

    /**
     * The person's notifications, newest first.
     *
     * @param  array<string, mixed>  $filters  See Notification::scopeFilter().
     * @return Builder<Notification>
     */
    public function query(User $user, array $filters = []): Builder
    {
        return Notification::query()
            ->whereBelongsTo($user)
            ->filter($filters)
            ->with(self::RELATIONS)
            ->orderByDesc('created_at')
            ->orderByDesc('id');
    }

    /**
     * The kinds the person has been told about, for the Type filter.
     *
     * @return list<NotificationKind>
     */
    public function kindsOf(User $user): array
    {
        return $user->notifications()
            ->distinct()
            ->pluck('kind')
            ->map(fn (NotificationKind|string $kind) => $kind instanceof NotificationKind ? $kind : NotificationKind::from($kind))
            ->sortBy(fn (NotificationKind $kind) => $kind->label())
            ->values()
            ->all();
    }

    public function setRead(Notification $notification, bool $read): void
    {
        if ($read === ($notification->read_at !== null)) {
            return;
        }

        $notification->forceFill(['read_at' => $read ? now() : null])->save();
        $this->live->inbox([$notification->user_id]);
    }

    public function markAllRead(User $user): void
    {
        if ($user->notifications()->unread()->update(['read_at' => now()]) > 0) {
            $this->live->inbox([$user->getKey()]);
        }
    }

    public function remove(Notification $notification): void
    {
        $notification->delete();
        $this->live->inbox([$notification->user_id]);
    }
}
