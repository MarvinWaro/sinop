<?php

namespace App\Http\Middleware;

use App\Models\RisSlip;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Session flash keys used by the controllers (carried over from the
     * Jetstream version) mapped to the toast type shown in the UI.
     *
     * @var array<string, string>
     */
    protected array $legacyFlashKeys = [
        'success' => 'success',
        'deleted' => 'success',
        'signature_success' => 'success',
        'error' => 'error',
        'warning' => 'warning',
        'info' => 'info',
    ];

    /**
     * Determines the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        $this->bridgeLegacyFlashMessages($request);

        $user = $request->user();

        if ($user) {
            $user->loadMissing(['department:id,name', 'designation:id,name']);
        }

        // What the signed-in user may do, for menus and buttons. The server
        // still checks every request itself.
        $permissions = $user?->permissionSlugs() ?? [];
        $user?->makeHidden('roles');
        $isAdmin = in_array('dashboard.view', $permissions, true);

        return [
            ...parent::share($request),
            'name' => config('app.name'),
            'auth' => [
                'user' => $user,
                'role' => $user?->role,
                'roles' => $user?->roles->pluck('name')->sort()->values() ?? [],
                'permissions' => $permissions,
                'isSuperAdmin' => (bool) $user?->isSuperAdmin(),
                'isAdminUserMode' => (bool) $request->session()->get('admin_user_mode', false),
                'originalRole' => $request->session()->get('original_role'),
            ],
            'notifications' => fn () => $user ? $this->notificationCounts($user->id, $isAdmin) : null,
            'broadcasting' => [
                'enabled' => config('broadcasting.default') === 'pusher' && filled(config('broadcasting.connections.pusher.key')),
                'key' => config('broadcasting.connections.pusher.key'),
                'cluster' => config('broadcasting.connections.pusher.options.cluster'),
            ],
            'sidebarOpen' => ! $request->hasCookie('sidebar_state') || $request->cookie('sidebar_state') === 'true',
        ];
    }

    /**
     * Badge counts that used to be loaded by the layout's notification script.
     *
     * @return array<string, int>
     */
    protected function notificationCounts(int $userId, bool $isAdmin): array
    {
        $counts = [
            'approved_requests_count' => RisSlip::where('requested_by', $userId)
                ->where('status', 'approved')
                ->count(),
            'pending_receipt_count' => RisSlip::where('received_by', $userId)
                ->where('status', 'posted')
                ->whereNull('received_at')
                ->count(),
        ];

        if ($isAdmin) {
            $counts['draft_count'] = RisSlip::where('status', 'draft')->count();
            $counts['approved_count'] = RisSlip::where('status', 'approved')->count();
        }

        return $counts;
    }

    /**
     * Turn the old `->with('success', ...)` style flash messages into the
     * starter kit's toast flash so they show up as sonner toasts.
     */
    protected function bridgeLegacyFlashMessages(Request $request): void
    {
        if (! $request->hasSession()) {
            return;
        }

        $toasts = [];

        foreach ($this->legacyFlashKeys as $key => $type) {
            $message = $request->session()->get($key);

            if (is_string($message) && $message !== '') {
                $toasts[] = ['type' => $type, 'message' => $message];
            }
        }

        if ($toasts === []) {
            return;
        }

        Inertia::flash('toasts', $toasts);
    }
}
