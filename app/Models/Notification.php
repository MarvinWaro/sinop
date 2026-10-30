<?php

namespace App\Models;

use App\Enums\ActivityModule;
use App\Enums\NotificationKind;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Prunable;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One person's notice. Written only by App\Services\Notifier; the actor and
 * the record's name come from the linked activity log entry.
 *
 * @property string $id
 * @property int $user_id
 * @property NotificationKind $kind
 * @property string $activity_log_id
 * @property int|null $supply_id
 * @property CarbonImmutable|null $read_at
 * @property CarbonImmutable $created_at
 */
class Notification extends Model
{
    use HasUlids, Prunable;

    /** Read notices are deleted this many days after they arrived. */
    public const KEEP_READ_DAYS = 90;

    public const UPDATED_AT = null;

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return [
            'kind' => NotificationKind::class,
            'read_at' => 'immutable_datetime',
            'created_at' => 'immutable_datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function activity(): BelongsTo
    {
        return $this->belongsTo(ActivityLog::class, 'activity_log_id');
    }

    /** The supply a stock alert is about. */
    public function supply(): BelongsTo
    {
        return $this->belongsTo(Supply::class, 'supply_id', 'supply_id');
    }

    public function scopeUnread(Builder $query): void
    {
        $query->whereNull('read_at');
    }

    /**
     * @param  array{status?: string|null, search?: string|null, kind?: string|null, module?: string|null}  $filters
     */
    public function scopeFilter(Builder $query, array $filters): void
    {
        $search = trim((string) ($filters['search'] ?? ''));
        $module = $filters['module'] ?? null;

        $query
            ->when(($filters['status'] ?? null) === 'unread', fn (Builder $query) => $query->whereNull('read_at'))
            ->when($filters['kind'] ?? null, fn (Builder $query, string $kind) => $query->where('kind', $kind))
            ->when($module, fn (Builder $query) => $query->whereIn('kind', array_map(
                fn (NotificationKind $kind) => $kind->value,
                array_filter(NotificationKind::cases(), fn (NotificationKind $kind) => $kind->module()->value === $module),
            )))
            ->when($search !== '', fn (Builder $query) => $query->where(fn (Builder $query) => $query
                ->whereHas('activity', fn (Builder $activity) => $activity
                    ->where('actor_name', 'like', "%{$search}%")
                    ->orWhere('subject_label', 'like', "%{$search}%"))
                ->orWhereHas('supply', fn (Builder $supply) => $supply
                    ->where('item_name', 'like', "%{$search}%")
                    ->orWhere('stock_no', 'like', "{$search}%"))));
    }

    /** Read notices older than KEEP_READ_DAYS (php artisan model:prune). */
    public function prunable(): Builder
    {
        return static::query()
            ->whereNotNull('read_at')
            ->where('created_at', '<', now()->subDays(self::KEEP_READ_DAYS));
    }

    /** The record's name as the notice shows it. */
    public function subjectLabel(): ?string
    {
        if ($this->supply_id !== null) {
            return $this->supply !== null
                ? "{$this->supply->item_name} ({$this->supply->stock_no})"
                : null;
        }

        return $this->activity?->subject_label;
    }

    /**
     * Where opening the notice takes the person, or null when there's no
     * page for it they may open.
     */
    public function linkFor(User $viewer): ?string
    {
        $activity = $this->activity;

        return match ($this->kind->module()) {
            ActivityModule::Ris => $this->risLink($viewer, $activity?->subject_id),
            ActivityModule::Stocks => match (true) {
                $this->supply_id !== null && $viewer->can('stock-cards.view') => route('stock-cards.show', $this->supply_id),
                $this->supply_id !== null && $viewer->can('stocks.view') => route('stocks.index', ['search' => $this->supply?->item_name]),
                $this->kind === NotificationKind::IarRecorded && $viewer->can('transactions.view') => route('supply-transactions.index', [
                    'search' => $activity?->subject_label,
                    'type' => 'receipt',
                ]),
                default => null,
            },
            ActivityModule::Users => match (true) {
                $this->kind === NotificationKind::AccountRequested && $viewer->can('users.view') => route('users.index'),
                $this->kind === NotificationKind::AccountActivated => route('dashboard'),
                default => null,
            },
            ActivityModule::Properties => $viewer->can('properties.view') && $activity?->subject_id
                ? route('property.view', $activity->subject_id)
                : null,
            default => null,
        };
    }

    private function risLink(User $viewer, ?string $risId): ?string
    {
        $slip = $risId !== null ? RisSlip::query()->find($risId) : null;

        return $slip !== null && $viewer->can('view', $slip) ? route('ris.show', $slip) : null;
    }
}
