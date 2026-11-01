<?php

namespace App\Http\Controllers;

use App\Enums\ActivityAction;
use App\Models\ActivityLog;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\MessageAttachment;
use App\Models\Property;
use App\Models\RisSlip;
use App\Models\User;
use App\Services\Messenger;
use App\Support\Uploads;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Messages: the page, and the JSON it reads and writes through. Requesters
 * see their own conversations; the supply office sees all of them (see
 * Conversation::scopeVisibleTo). The rules live in App\Services\Messenger.
 */
class MessageController extends Controller
{
    /** Conversations per page of the list. */
    private const PER_PAGE = 30;

    /** Messages per page of a thread. */
    private const THREAD_PAGE = 50;

    /** What can be attached: photos, PDFs and spreadsheets. */
    public const FILE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'pdf', 'xlsx', 'xls', 'csv'];

    private const FILE_TYPES = [
        'image/jpeg', 'image/png', 'image/webp', 'application/pdf',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel', 'application/CDFV2', 'application/zip',
        'text/csv', 'text/plain',
    ];

    /** Shown in the browser; anything else is downloaded. */
    private const INLINE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

    /** The RIS history shown in a request's thread. */
    private const RIS_EVENTS = [
        ActivityAction::Requested, ActivityAction::Approved, ActivityAction::Declined,
        ActivityAction::Issued, ActivityAction::Received,
    ];

    public function __construct(private readonly Messenger $messenger) {}

    /**
     * The page. `?ris=<key>` opens the conversation about that request, or
     * starts one; `?c=<id>` opens a conversation.
     */
    public function index(Request $request): Response
    {
        /** @var User $user */
        $user = $request->user();
        $office = Messenger::actsForOffice($user);

        return Inertia::render('messages/index', [
            'isOffice' => $office,
            'list' => fn () => $this->listPayload($request, $user),
            // Who the office can write to.
            'people' => fn () => $office
                ? User::query()->where('status', true)->whereKeyNot($user->id)
                    ->with(['department:id,name', 'designation:id,name'])
                    ->orderBy('name')
                    ->get(['id', 'name', 'department_id', 'designation_id', 'profile_photo_path'])
                    ->map(fn (User $person) => $this->person($person))
                : [],
            'opening' => fn () => $this->opening($request, $user),
            'fileTypes' => self::FILE_EXTENSIONS,
        ]);
    }

    /** A page of conversations (or just `?id=`, to refresh one row). */
    public function conversations(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        return response()->json($this->listPayload($request, $user));
    }

    /** A thread: the newest messages (or those before `?before=`), and what it's about. */
    public function show(Request $request, Conversation $conversation): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $before = $request->integer('before');

        $messages = $conversation->messages()
            ->with(['user:id,name,profile_photo_path,designation_id', 'user.designation:id,name', 'attachments'])
            ->when($before > 0, fn ($query) => $query->where('id', '<', $before))
            ->orderByDesc('id')
            ->limit(self::THREAD_PAGE + 1)
            ->get();

        $hasEarlier = $messages->count() > self::THREAD_PAGE;
        $messages = $messages->take(self::THREAD_PAGE)->reverse()->values();

        if ($before > 0) {
            return response()->json([
                'messages' => $messages->map(fn (Message $message) => $this->message($message, $user)),
                'has_earlier' => $hasEarlier,
            ]);
        }

        return response()->json([
            'conversation' => $this->summary($this->rowsQuery($user)->findOrFail($conversation->id), $user),
            'messages' => $messages->map(fn (Message $message) => $this->message($message, $user)),
            'has_earlier' => $hasEarlier,
            'events' => $this->risEvents($conversation),
            'context' => $this->context($conversation),
            'office' => User::query()->withPermission('messages.office')
                ->with('designation:id,name')
                ->orderBy('name')
                ->get(['id', 'name', 'designation_id', 'profile_photo_path'])
                ->map(fn (User $person) => $this->person($person)),
        ]);
    }

    public function start(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $office = Messenger::actsForOffice($user);

        $data = $request->validate([
            'kind' => ['required', Rule::in(Conversation::KINDS)],
            'subject' => ['nullable', 'string', 'max:255'],
            'ris_id' => ['required_if:kind,request', 'nullable', 'integer'],
            'property_id' => ['nullable', 'integer'],
            'requester_id' => $office
                ? ['exclude_if:kind,request', 'required', 'integer', Rule::exists('users', 'id')]
                : ['prohibited'],
            'body' => ['required', 'string', 'max:5000'],
        ]);

        $conversation = $this->messenger->start($user, $data);

        return response()->json([
            'conversation' => $this->summary($this->rowsQuery($user)->findOrFail($conversation->id), $user),
        ], 201);
    }

    public function send(Request $request, Conversation $conversation): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $data = $request->validate([
            'body' => ['nullable', 'string', 'max:5000'],
            'files' => ['nullable', 'array', 'max:4'],
            'files.*' => [
                'file', 'max:10240',
                'extensions:'.implode(',', self::FILE_EXTENSIONS),
                'mimetypes:'.implode(',', self::FILE_TYPES),
            ],
        ], [
            'files.max' => 'Attach up to 4 files at a time.',
            'files.*.max' => 'Each file can be up to 10 MB.',
            'files.*.extensions' => 'Attach photos, PDFs or spreadsheets.',
            'files.*.mimetypes' => 'Attach photos, PDFs or spreadsheets.',
        ]);

        $message = $this->messenger->send($conversation, $user, $data['body'] ?? null, array_values(Arr::wrap($request->file('files', []))));

        return response()->json([
            'message' => $this->message($message->load(['user.designation:id,name', 'attachments']), $user),
        ], 201);
    }

    /** They've seen the thread: up to the newest message, or `message_id`. */
    public function read(Request $request, Conversation $conversation): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $validated = $request->validate(['message_id' => ['nullable', 'integer']]);

        $this->messenger->markRead($conversation, $user, $validated['message_id'] ?? null);

        return response()->json(['unread' => $this->messenger->unreadCountFor($user)]);
    }

    public function typing(Request $request, Conversation $conversation): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $this->messenger->typing($conversation, $user);

        return response()->json(['ok' => true]);
    }

    public function status(Request $request, Conversation $conversation): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $validated = $request->validate(['resolved' => ['required', 'boolean']]);

        $this->messenger->setResolved($conversation, $user, (bool) $validated['resolved']);

        return response()->json([
            'conversation' => $this->summary($this->rowsQuery($user)->findOrFail($conversation->id), $user),
        ]);
    }

    /** What a conversation can be about: this person's requests and properties. */
    public function options(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $requesterId = Messenger::actsForOffice($user) && $request->filled('requester')
            ? $request->integer('requester')
            : (int) $user->id;

        return response()->json([
            'requests' => RisSlip::query()
                ->where('requested_by', $requesterId)
                ->latest('ris_id')
                ->limit(40)
                ->get(['ris_id', 'ris_no', 'status', 'received_at', 'created_at'])
                ->map(fn (RisSlip $ris) => [
                    'id' => $ris->ris_id,
                    'no' => $ris->ris_no,
                    'status' => $ris->status,
                    'received_at' => $ris->received_at?->toIso8601String(),
                    'requested_at' => $ris->created_at?->toIso8601String(),
                ]),
            'properties' => Property::query()
                ->where('user_id', $requesterId)
                ->where('excluded', 0)
                ->orderBy('item_name')
                ->limit(100)
                ->get(['id', 'property_number', 'item_name'])
                ->map(fn (Property $property) => [
                    'id' => $property->id,
                    'number' => $property->property_number,
                    'name' => $property->item_name,
                ]),
        ]);
    }

    /** A file sent in a conversation, for the people in it only. */
    public function attachment(Request $request, MessageAttachment $attachment): StreamedResponse
    {
        $conversation = $attachment->message?->conversation;

        abort_if($conversation === null, 404);
        Gate::authorize('view', $conversation);

        $disk = Uploads::disk();
        abort_unless($disk->exists($attachment->path), 404);

        return $disk->response(
            $attachment->path,
            $attachment->name,
            [
                'Content-Type' => $attachment->mime,
                'X-Content-Type-Options' => 'nosniff',
                'Cache-Control' => 'private, max-age=86400',
            ],
            in_array($attachment->mime, self::INLINE_TYPES, true) ? 'inline' : 'attachment',
        );
    }

    /**
     * Conversations as list rows: who, the newest message, unread count.
     *
     * @return Builder<Conversation>
     */
    private function rowsQuery(User $user): Builder
    {
        return Conversation::query()
            ->visibleTo($user)
            ->with([
                'requester:id,name,department_id,designation_id,profile_photo_path',
                'requester.department:id,name',
                'requester.designation:id,name',
                'latestMessage' => fn ($query) => $query->withCount('attachments'),
                'latestMessage.user:id,name',
                'latestOfficeReply.user:id,name,designation_id,profile_photo_path',
                'latestOfficeReply.user.designation:id,name',
                'risSlip:ris_id,ris_no,status,received_at',
            ])
            ->withCount(['messages as unread' => fn (Builder $query) => Messenger::scopeUnread($query, $user)]);
    }

    /**
     * @return array{data: list<array<string, mixed>>, next_page: int|null, counts: array{all: int, request: int, concern: int, waiting: int}}
     */
    private function listPayload(Request $request, User $user): array
    {
        $query = $this->rowsQuery($user)->orderByRaw('coalesce(last_message_at, created_at) desc')->orderByDesc('id');

        if ($request->filled('id')) {
            $rows = $query->whereKey($request->integer('id'))->get();

            return [
                'data' => array_values($rows->map(fn (Conversation $row) => $this->summary($row, $user))->all()),
                'next_page' => null,
                'counts' => $this->counts($user),
            ];
        }

        $search = trim((string) $request->query('search', ''));

        $query
            ->when(in_array($request->query('tab'), ['request', 'concern'], true), fn ($query) => $request->query('tab') === 'request'
                ? $query->where('kind', 'request')
                : $query->whereIn('kind', ['concern', 'general']))
            ->when($request->query('tab') === 'waiting', fn ($query) => $query->where('status', 'waiting'))
            ->when($search !== '', fn ($query) => $query->where(fn ($match) => $match
                ->where('subject', 'like', "%{$search}%")
                ->orWhereHas('requester', fn ($requester) => $requester->where('name', 'like', "%{$search}%"))
                ->orWhereHas('messages', fn ($messages) => $messages->where('side', '!=', 'system')->where('body', 'like', "%{$search}%"))));

        $page = $query->simplePaginate(self::PER_PAGE)->withQueryString();

        return [
            'data' => array_map(fn (Conversation $row) => $this->summary($row, $user), array_values($page->items())),
            'next_page' => $page->hasMorePages() ? $page->currentPage() + 1 : null,
            'counts' => $this->counts($user),
        ];
    }

    /**
     * How many conversations each tab holds.
     *
     * @return array{all: int, request: int, concern: int, waiting: int}
     */
    private function counts(User $user): array
    {
        $counts = Conversation::query()->visibleTo($user)
            ->selectRaw("count(*) as total, sum(case when kind = 'request' then 1 else 0 end) as requests, sum(case when status = 'waiting' then 1 else 0 end) as waiting")
            ->first();
        $total = (int) $counts?->getAttribute('total');
        $requests = (int) $counts?->getAttribute('requests');

        return [
            'all' => $total,
            'request' => $requests,
            'concern' => $total - $requests,
            'waiting' => (int) $counts?->getAttribute('waiting'),
        ];
    }

    /** @return array<string, mixed> */
    private function summary(Conversation $conversation, User $viewer): array
    {
        $last = $conversation->latestMessage;
        $replier = $conversation->latestOfficeReply?->user;

        return [
            'id' => $conversation->id,
            'kind' => $conversation->kind,
            'subject' => $conversation->subject,
            'status' => $conversation->status,
            'mine' => (int) $conversation->requester_id === (int) $viewer->id,
            'requester' => $conversation->requester ? $this->person($conversation->requester) : null,
            'replied_by' => $replier ? $this->person($replier) : null,
            'last' => $last ? [
                'side' => $last->side,
                'body' => $last->body !== null ? Str::limit($last->body, 140) : null,
                'files' => (int) $last->getAttribute('attachments_count'),
                'author' => $last->user ? [
                    'id' => $last->user->id,
                    'name' => $last->user->name,
                ] : null,
                'at' => $last->created_at->toIso8601String(),
            ] : null,
            'unread' => (int) $conversation->getAttribute('unread'),
            'ris' => $conversation->risSlip ? [
                'key' => $conversation->risSlip->route_key,
                'no' => $conversation->risSlip->ris_no,
                'status' => $conversation->risSlip->status,
                'received_at' => $conversation->risSlip->received_at?->toIso8601String(),
            ] : null,
            'updated_at' => ($conversation->last_message_at ?? $conversation->created_at)?->toIso8601String(),
        ];
    }

    /** @return array<string, mixed> */
    private function message(Message $message, User $viewer): array
    {
        return [
            'id' => $message->id,
            'side' => $message->side,
            'body' => $message->body,
            'mine' => (int) $message->user_id === (int) $viewer->id,
            'author' => $message->user ? $this->person($message->user) : null,
            'at' => $message->created_at->toIso8601String(),
            'attachments' => $message->attachments->map(fn (MessageAttachment $file) => [
                'id' => $file->id,
                'name' => $file->name,
                'mime' => $file->mime,
                'size' => $file->size,
                'url' => $file->url(),
            ])->all(),
        ];
    }

    /** @return array{id: int, name: string, photo: string|null, division: string|null, role: string|null} */
    private function person(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'photo' => Uploads::url($user->profile_photo_path),
            'division' => $user->relationLoaded('department') ? $user->department?->name : null,
            'role' => $user->relationLoaded('designation') ? $user->designation?->name : null,
        ];
    }

    /**
     * The request's own history, shown between the messages.
     *
     * @return list<array{id: string, action: string, body: string, at: string}>
     */
    private function risEvents(Conversation $conversation): array
    {
        if ($conversation->ris_id === null) {
            return [];
        }

        return array_values(ActivityLog::query()
            ->where('subject_type', 'ris')
            ->where('subject_id', (string) $conversation->ris_id)
            ->whereIn('action', array_map(fn (ActivityAction $action) => $action->value, self::RIS_EVENTS))
            ->orderBy('created_at')
            ->limit(50)
            ->get(['id', 'action', 'actor_name', 'created_at'])
            ->map(fn (ActivityLog $event) => [
                'id' => $event->id,
                'action' => $event->action->value,
                'body' => "{$event->action->label()} by {$event->actor_name}",
                'at' => $event->created_at->toIso8601String(),
            ])
            ->all());
    }

    /** @return array{ris: array<string, mixed>|null, property: array<string, mixed>|null} */
    private function context(Conversation $conversation): array
    {
        $ris = $conversation->risSlip()->with(['items.supply:supply_id,item_name,unit_of_measurement', 'department:id,name'])->first();
        $property = $conversation->property()->with('location:id,location_name')->first();

        return [
            'ris' => $ris ? [
                'key' => $ris->route_key,
                'no' => $ris->ris_no,
                'status' => $ris->status,
                'received_at' => $ris->received_at?->toIso8601String(),
                'requested_at' => $ris->created_at?->toIso8601String(),
                'purpose' => $ris->purpose,
                'division' => $ris->department?->name,
                'items' => $ris->items->map(fn ($item) => [
                    'name' => $item->supply->item_name ?? 'Item',
                    'quantity' => (int) ($item->quantity_issued ?: $item->quantity_requested),
                    'unit' => $item->supply?->unit_of_measurement,
                ])->all(),
            ] : null,
            'property' => $property ? [
                'number' => $property->property_number,
                'name' => $property->item_name,
                'condition' => $property->condition,
                'location' => $property->location?->location_name,
            ] : null,
        ];
    }

    /**
     * What `?ris=` or `?c=` asks to open: an existing conversation, or a new
     * one about the request (the New conversation dialog, filled in).
     *
     * @return array{conversation: int}|array{ris: array{id: int, no: string}, requester: array<string, mixed>}|null
     */
    private function opening(Request $request, User $user): ?array
    {
        if ($request->filled('c')) {
            $id = Conversation::query()->visibleTo($user)->whereKey($request->integer('c'))->value('id');

            return $id ? ['conversation' => (int) $id] : null;
        }

        if (! $request->filled('ris')) {
            return null;
        }

        $ris = (new RisSlip)->resolveRouteBinding((string) $request->query('ris'));

        if (! $ris || ! $user->can('view', $ris)) {
            return null;
        }

        $requesterId = Messenger::actsForOffice($user) ? (int) $ris->requested_by : (int) $user->id;
        $existing = Conversation::query()->visibleTo($user)
            ->where('ris_id', $ris->ris_id)
            ->where('requester_id', $requesterId)
            ->value('id');

        if ($existing) {
            return ['conversation' => (int) $existing];
        }

        $requester = User::query()->with(['department:id,name', 'designation:id,name'])->find($requesterId);

        return $requester ? [
            'ris' => ['id' => (int) $ris->ris_id, 'no' => (string) $ris->ris_no],
            'requester' => $this->person($requester),
        ] : null;
    }
}
