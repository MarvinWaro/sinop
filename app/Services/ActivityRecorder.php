<?php

namespace App\Services;

use App\Enums\ActivityAction;
use App\Enums\ActivityModule;
use App\Models\ActivityLog;
use App\Models\Category;
use App\Models\Department;
use App\Models\Designation;
use App\Models\Location;
use App\Models\Property;
use App\Models\RisSlip;
use App\Models\Role;
use App\Models\Supplier;
use App\Models\Supply;
use App\Models\SupplyStock;
use App\Models\SupplyTransaction;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use Throwable;

/**
 * Writes the activity log: who did what to which record, when and from which
 * device. The only writer of `activity_logs`, so every module records the
 * same way. Called after the change it records has been made, and never
 * throws: a missing log entry must not undo the change itself.
 * (Ported from PHLGADIS.)
 */
class ActivityRecorder
{
    /** Never written to the log, whatever the model shows. */
    private const SKIPPED = [
        'created_at', 'updated_at', 'remember_token', 'password',
        'two_factor_secret', 'two_factor_recovery_codes', 'two_factor_confirmed_at',
    ];

    /** Subject types as stored, so entries don't depend on class names. */
    private const TYPES = [
        'user' => User::class,
        'division' => Department::class,
        'designation' => Designation::class,
        'category' => Category::class,
        'supplier' => Supplier::class,
        'location' => Location::class,
        'supply' => Supply::class,
        'stock' => SupplyStock::class,
        'transaction' => SupplyTransaction::class,
        'ris' => RisSlip::class,
        'property' => Property::class,
        'role' => Role::class,
    ];

    /** Foreign keys shown by name instead of number in an entry's changes. */
    private const NAMED_KEYS = [
        'department_id' => [Department::class, 'name'],
        'division' => [Department::class, 'name'],
        'designation_id' => [Designation::class, 'name'],
        'category_id' => [Category::class, 'name'],
        'supplier_id' => [Supplier::class, 'name'],
        'location_id' => [Location::class, 'location_name'],
        'user_id' => [User::class, 'name'],
    ];

    /** Longest text kept for one value of a change. */
    private const VALUE_LIMIT = 500;

    /**
     * @param  Model|null  $subject  What was acted on.
     * @param  array<string, array{0: mixed, 1: mixed}>  $changes  Field => [before, after]; see changesOf().
     * @param  array<string, mixed>  $properties  Anything else worth keeping (item lines, export filters).
     * @param  string|null  $summary  One short line shown under the entry, e.g. "5 items · Fund cluster 101".
     * @param  User|null  $actor  Who acted; the signed-in user when left out.
     * @param  string|null  $label  Names the subject instead of its own name, or names what was acted on when there is no record.
     * @param  string|null  $actorName  Who acted when no account is known, such as the email of a failed login.
     */
    public function record(
        ActivityAction $action,
        ActivityModule $module,
        ?Model $subject = null,
        array $changes = [],
        array $properties = [],
        ?string $summary = null,
        ?User $actor = null,
        ?string $label = null,
        ?string $actorName = null,
    ): ?ActivityLog {
        try {
            $actor ??= Auth::user();
            // A new account registering itself has no signed-in user yet.
            $actor ??= $subject instanceof User ? $subject : null;
            // A console command has no browser or address to record.
            $request = app()->runningInConsole() && ! app()->runningUnitTests() ? null : request();

            return ActivityLog::query()->create([
                'user_id' => $actor?->getKey(),
                'actor_name' => Str::limit($actor->name ?? $actorName ?? 'System', 250, ''),
                'actor_role' => $actor !== null ? Str::limit($actor->primaryRoleSlug(), 20, '') : null,
                'department_id' => $actor?->department_id,
                'module' => $module,
                'action' => $action,
                'subject_type' => $subject !== null ? (array_search($subject::class, self::TYPES, true) ?: Str::snake(class_basename($subject))) : null,
                'subject_id' => $subject !== null ? (string) $subject->getKey() : null,
                'subject_label' => Str::limit($label ?? ($subject !== null ? $this->labelOf($subject) : ''), 250, '…') ?: null,
                'summary' => $summary !== null ? Str::limit($summary, 250, '…') : null,
                'changes' => $changes === [] ? null : $changes,
                'properties' => $properties === [] ? null : $properties,
                'ip_address' => $request?->ip(),
                'user_agent' => Str::limit((string) $request?->userAgent(), 512, '') ?: null,
            ]);
        } catch (Throwable $exception) {
            report($exception);

            return null;
        }
    }

    /**
     * A record's edit, as its last save made it. An edit that changed nothing
     * (or only skipped fields) is not logged.
     *
     * @param  list<string>  $except  Attributes left out of the changes.
     * @param  (callable(array<string, array{0: mixed, 1: mixed}>): ?ActivityAction)|null  $actionFor  Names special edits, such as switching an account off.
     */
    public function recordUpdate(ActivityModule $module, Model $model, array $except = [], ?callable $actionFor = null): ?ActivityLog
    {
        $changes = $this->changesOf($model, $except);

        if ($changes === []) {
            return null;
        }

        $action = ($actionFor !== null ? $actionFor($changes) : null) ?? ActivityAction::Updated;

        // A reused row (e.g. a removed property recycled for a new one) is a
        // new record; the old values aren't its "before".
        return $this->record($action, $module, $model, $action === ActivityAction::Created ? [] : $changes);
    }

    /**
     * What the model's last save changed, as field => [before, after]. Hidden
     * attributes, passwords, tokens and timestamps are left out; foreign keys
     * are shown by name and dates as ISO 8601.
     *
     * @param  list<string>  $except
     * @return array<string, array{0: mixed, 1: mixed}>
     */
    public function changesOf(Model $model, array $except = []): array
    {
        $after = Arr::except($model->getChanges(), [...self::SKIPPED, ...$model->getHidden(), ...$except]);
        $before = $model->getPrevious();
        $changes = [];

        foreach ($after as $key => $value) {
            $old = $this->readable($model, $key, $before[$key] ?? null);
            $new = $this->readable($model, $key, $value);

            // "5" → 5 or "1.50" → "1.5000" are the same value, not a change.
            if (is_scalar($old) && is_scalar($new) && is_numeric($old) && is_numeric($new) && (float) $old === (float) $new) {
                continue;
            }

            $changes[$key] = [$old, $new];
        }

        return $changes;
    }

    /** How an entry names a record: "ALCOHOL (01)", "RIS 2025-12-190", a person's name… */
    public function labelOf(Model $model): string
    {
        return match (true) {
            $model instanceof Supply => "{$model->item_name} ({$model->stock_no})",
            $model instanceof SupplyStock => trim(($model->supply?->item_name ?? 'Stock').' · Fund '.($model->fund_cluster ?? '—')),
            $model instanceof SupplyTransaction => (string) $model->reference_no,
            $model instanceof RisSlip => "RIS {$model->ris_no}",
            $model instanceof Property => trim("{$model->property_number} · {$model->item_name}"),
            $model instanceof Location => (string) $model->location_name,
            default => (string) ($model->getAttribute('name') ?? class_basename($model).' #'.$model->getKey()),
        };
    }

    private function readable(Model $model, string $key, mixed $value): mixed
    {
        if ($value === null || $value === '') {
            return null;
        }

        if (isset(self::NAMED_KEYS[$key]) && is_numeric($value)) {
            [$class, $column] = self::NAMED_KEYS[$key];

            return $class::query()->whereKey($value)->value($column) ?? $value;
        }

        if ($model->hasCast($key, ['bool', 'boolean']) || in_array($key, ['status', 'excluded', 'active', 'is_active'], true) && in_array($value, [0, 1, '0', '1', true, false], true)) {
            return (bool) $value;
        }

        if ($value instanceof CarbonInterface) {
            return $value->toIso8601String();
        }

        if (is_array($value)) {
            return $value;
        }

        return is_string($value) ? Str::limit($value, self::VALUE_LIMIT, '…') : $value;
    }
}
