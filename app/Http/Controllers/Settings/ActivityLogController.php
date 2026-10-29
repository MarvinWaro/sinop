<?php

namespace App\Http\Controllers\Settings;

use App\Enums\ActivityAction;
use App\Enums\ActivityModule;
use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\ActivityLogFilterRequest;
use App\Models\ActivityLog;
use App\Models\Role;
use App\Models\User;
use App\Support\DeviceName;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Settings › Activity logs: who did what in SINOP, newest first. Admin only.
 */
class ActivityLogController extends Controller
{
    public function index(ActivityLogFilterRequest $request): Response
    {
        $filters = $request->validated();
        // Role names for the stored role slugs (a role may have been renamed since).
        $roleNames = Role::query()->pluck('name', 'slug');

        $logs = ActivityLog::query()
            ->with('department:id,name')
            ->filter($filters)
            ->latest('created_at')
            ->latest('id')
            ->paginate(20)
            ->withQueryString()
            ->through(fn (ActivityLog $log): array => [
                'id' => $log->id,
                'user_id' => $log->user_id,
                'actor_name' => $log->actor_name,
                'actor_role' => $log->actor_role,
                'actor_role_label' => $log->actor_role !== null ? ($roleNames[$log->actor_role] ?? $log->actor_role) : null,
                'department' => $log->department?->name,
                'module' => $log->module->value,
                'module_label' => $log->module->label(),
                'action' => $log->action->value,
                'action_label' => $log->action->label(),
                'tone' => $log->action->tone(),
                'subject_label' => $log->subject_label,
                'summary' => $log->summary,
                'changes' => $log->changes,
                'properties' => $log->properties,
                'ip_address' => $log->ip_address,
                'device' => DeviceName::from($log->user_agent),
                'created_at' => $log->created_at?->toIso8601String(),
            ]);

        return Inertia::render('settings/activity-logs', [
            'logs' => $logs,
            'filters' => [
                'search' => (string) ($filters['search'] ?? ''),
                'module' => (string) ($filters['module'] ?? ''),
                'action' => (string) ($filters['action'] ?? ''),
                'user' => (string) ($filters['user'] ?? ''),
                'from' => (string) ($filters['from'] ?? ''),
                'to' => (string) ($filters['to'] ?? ''),
            ],
            'modules' => array_map(fn (ActivityModule $module): array => [
                'value' => $module->value,
                'label' => $module->label(),
            ], ActivityModule::cases()),
            'actions' => collect(ActivityAction::cases())
                ->map(fn (ActivityAction $action): array => ['value' => $action->value, 'label' => $action->label()])
                ->sortBy('label')
                ->values(),
            'users' => User::query()->orderBy('name')->get(['id', 'name']),
        ]);
    }
}
