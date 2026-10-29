<?php

namespace App\Models\Concerns;

use App\Enums\ActivityAction;
use App\Enums\ActivityModule;
use App\Services\ActivityRecorder;

/**
 * Logs a model's create, edit (with before → after) and delete to the
 * activity log. For reference and master data, where the record itself is
 * the story; workflows (RIS, IAR) record their own business entries instead.
 */
trait LogsActivity
{
    /** Where this model's entries are filed. */
    abstract public function activityModule(): ActivityModule;

    /**
     * Attributes whose changes are not logged.
     *
     * @return list<string>
     */
    public function activityIgnored(): array
    {
        return [];
    }

    /**
     * Names a special edit, such as switching a record off; null for a plain update.
     *
     * @param  array<string, array{0: mixed, 1: mixed}>  $changes
     */
    public function activityActionFor(array $changes): ?ActivityAction
    {
        return null;
    }

    /**
     * Locations and properties are "removed" by flagging them `excluded`, and
     * a removed row is reused for the next new record. Reads such an edit as
     * Removed, Restored, or Created when the row now holds a new record.
     *
     * @param  array<string, array{0: mixed, 1: mixed}>  $changes
     * @param  string  $identity  The attribute that names the record (changes when a row is reused).
     */
    protected function excludedRowAction(array $changes, string $identity): ?ActivityAction
    {
        if (! array_key_exists('excluded', $changes)) {
            return null;
        }

        if ($changes['excluded'][1]) {
            return ActivityAction::Removed;
        }

        return array_key_exists($identity, $changes) ? ActivityAction::Created : ActivityAction::Restored;
    }

    public static function bootLogsActivity(): void
    {
        static::created(function (self $model): void {
            app(ActivityRecorder::class)->record(ActivityAction::Created, $model->activityModule(), $model);
        });

        static::updated(function (self $model): void {
            app(ActivityRecorder::class)->recordUpdate(
                $model->activityModule(),
                $model,
                $model->activityIgnored(),
                fn (array $changes) => $model->activityActionFor($changes),
            );
        });

        static::deleted(function (self $model): void {
            app(ActivityRecorder::class)->record(ActivityAction::Deleted, $model->activityModule(), $model);
        });
    }
}
