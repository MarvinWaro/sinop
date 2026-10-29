<?php

namespace App\Models;

use App\Enums\ActivityAction;
use App\Enums\ActivityModule;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One activity log entry. Written only by App\Services\ActivityRecorder and
 * never edited afterwards.
 *
 * @property string $id
 * @property int|null $user_id
 * @property string $actor_name
 * @property string|null $actor_role
 * @property ActivityModule $module
 * @property ActivityAction $action
 * @property array<string, array{0: mixed, 1: mixed}>|null $changes
 * @property array<string, mixed>|null $properties
 */
class ActivityLog extends Model
{
    use HasUlids;

    public const UPDATED_AT = null;

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return [
            'module' => ActivityModule::class,
            'action' => ActivityAction::class,
            'changes' => 'array',
            'properties' => 'array',
            'created_at' => 'immutable_datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    /**
     * @param  array{search?: string|null, module?: string|null, action?: string|null, user?: int|string|null, from?: string|null, to?: string|null}  $filters
     */
    public function scopeFilter(Builder $query, array $filters): void
    {
        $search = trim((string) ($filters['search'] ?? ''));

        $query
            ->when($search !== '', fn (Builder $query) => $query->where(fn (Builder $query) => $query
                ->where('actor_name', 'like', "%{$search}%")
                ->orWhere('subject_label', 'like', "%{$search}%")
                ->orWhere('summary', 'like', "%{$search}%")
                ->orWhere('ip_address', 'like', "{$search}%")))
            ->when($filters['module'] ?? null, fn (Builder $query, string $module) => $query->where('module', $module))
            ->when($filters['action'] ?? null, fn (Builder $query, string $action) => $query->where('action', $action))
            ->when($filters['user'] ?? null, fn (Builder $query, int|string $user) => $query->where('user_id', $user))
            // Dates are picked in Philippine time; entries are stored in UTC.
            ->when($filters['from'] ?? null, fn (Builder $query, string $from) => $query->where(
                'created_at', '>=', CarbonImmutable::parse($from, 'Asia/Manila')->startOfDay()->utc(),
            ))
            ->when($filters['to'] ?? null, fn (Builder $query, string $to) => $query->where(
                'created_at', '<', CarbonImmutable::parse($to, 'Asia/Manila')->addDay()->startOfDay()->utc(),
            ));
    }
}
