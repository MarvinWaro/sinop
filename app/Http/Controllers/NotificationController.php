<?php

namespace App\Http\Controllers;

use App\Enums\ActivityModule;
use App\Enums\NotificationKind;
use App\Http\Requests\NotificationFilterRequest;
use App\Http\Resources\NotificationResource;
use App\Models\Notification;
use App\Models\User;
use App\Services\NotificationInbox;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The signed-in person's notifications: the Notifications page, and the
 * JSON the header bell reads and changes them through. A notification is
 * only ever its recipient's; anyone else (even an administrator) gets 404.
 */
class NotificationController extends Controller
{
    public function __construct(private readonly NotificationInbox $inbox) {}

    /** Every notification, newest first, loading more as the reader scrolls. */
    public function index(NotificationFilterRequest $request): Response
    {
        /** @var User $user */
        $user = $request->user();
        $filters = $request->filters();
        $kinds = $this->inbox->kindsOf($user);

        return Inertia::render('notifications/index', [
            'notifications' => Inertia::scroll(fn () => NotificationResource::collection(
                $this->inbox->query($user, $filters)->cursorPaginate(NotificationInbox::PAGE_SIZE)->withQueryString(),
            )),
            'filters' => $filters,
            // Only what this person has been told about.
            'kinds' => array_map(fn (NotificationKind $kind) => ['value' => $kind->value, 'label' => $kind->label()], $kinds),
            'modules' => collect($kinds)
                ->map(fn (NotificationKind $kind) => $kind->module())
                ->unique(fn (ActivityModule $module) => $module->value)
                ->map(fn (ActivityModule $module) => ['value' => $module->value, 'label' => $module->label()])
                ->sortBy('label')
                ->values(),
        ]);
    }

    /** The bell's panel: the newest few, a page at a time, with the counts. */
    public function recent(Request $request): AnonymousResourceCollection
    {
        /** @var User $user */
        $user = $request->user();

        return NotificationResource::collection(
            $this->inbox->query($user)->cursorPaginate(NotificationInbox::RECENT_PER_PAGE),
        )->additional(['inbox' => $this->inbox->summary($user)]);
    }

    /** How many are unread and when the newest came. */
    public function summary(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        return response()->json($this->inbox->summary($user));
    }

    /** Opening a notification reads it and goes where it points. */
    public function open(Request $request, Notification $notification): RedirectResponse
    {
        $user = $this->owner($request, $notification);
        $this->inbox->setRead($notification, true);

        $url = $notification->linkFor($user);

        return $url !== null
            ? redirect()->to($url)
            : to_route('notifications.index')->with('info', 'There is no page to open for this notification.');
    }

    public function update(Request $request, Notification $notification): JsonResponse
    {
        $user = $this->owner($request, $notification);
        $validated = $request->validate(['read' => ['required', 'boolean']]);

        $this->inbox->setRead($notification, (bool) $validated['read']);

        return response()->json([
            'notification' => (new NotificationResource($notification->load(NotificationInbox::RELATIONS)))->resolve($request),
            'inbox' => $this->inbox->summary($user),
        ]);
    }

    public function readAll(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $this->inbox->markAllRead($user);

        return response()->json(['inbox' => $this->inbox->summary($user)]);
    }

    public function destroy(Request $request, Notification $notification): JsonResponse
    {
        $user = $this->owner($request, $notification);
        $this->inbox->remove($notification);

        return response()->json(['inbox' => $this->inbox->summary($user)]);
    }

    private function owner(Request $request, Notification $notification): User
    {
        /** @var User $user */
        $user = $request->user();

        abort_unless($notification->user_id === $user->getKey(), 404);

        return $user;
    }
}
