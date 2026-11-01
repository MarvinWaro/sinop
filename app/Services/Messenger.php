<?php

namespace App\Services;

use App\Models\Conversation;
use App\Models\Message;
use App\Models\Property;
use App\Models\RisSlip;
use App\Models\User;
use App\Support\Uploads;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Throwable;

/**
 * Messages between requesters and the supply office: the one place for who
 * may start what, how a conversation's status follows its messages, what
 * counts as unread, and who is told live. The office answers as a shared
 * inbox: anyone with `messages.office` sees and answers every conversation.
 */
class Messenger
{
    /** Seconds between "is typing" signals from one person. */
    private const TYPING_EVERY = 3;

    public function __construct(private readonly LiveUpdates $live) {}

    /**
     * Whether this person is answering for the supply office right now: they
     * may, and they aren't using the app as a requester (admin user mode).
     */
    public static function actsForOffice(User $user): bool
    {
        $userMode = app()->bound('request') && request()->hasSession()
            && (bool) request()->session()->get('admin_user_mode', false);

        return ! $userMode && $user->hasPermission('messages.office');
    }

    /** Which side a person writes for in this conversation. */
    public static function sideOf(Conversation $conversation, User $user): string
    {
        return (int) $conversation->requester_id === (int) $user->id ? 'requester' : 'office';
    }

    /**
     * Limits a messages query to what this person hasn't read: the other
     * side's messages after the last one they've seen. In their own
     * conversations that's the office's replies, in the others (the office
     * inbox) the requester's messages.
     *
     * @param  Builder<Message>  $messages
     */
    public static function scopeUnread(Builder $messages, User $user): void
    {
        $messages
            ->whereRaw(
                "messages.side = (case when (select c.requester_id from conversations c where c.id = messages.conversation_id) = ? then 'office' else 'requester' end)",
                [$user->id],
            )
            ->where(fn (Builder $query) => $query->whereNull('messages.user_id')->orWhere('messages.user_id', '!=', $user->id))
            ->whereRaw(
                'messages.id > coalesce((select r.last_read_message_id from conversation_reads r where r.conversation_id = messages.conversation_id and r.user_id = ?), 0)',
                [$user->id],
            );
    }

    /**
     * Starts a conversation with its first message, or adds the message to
     * the one already about that RIS. Requesters always write for
     * themselves; the office picks who it writes to.
     *
     * @param  array{kind: string, body: string, subject?: string|null, ris_id?: int|null, property_id?: int|null, requester_id?: int|null}  $data
     */
    public function start(User $starter, array $data): Conversation
    {
        $office = self::actsForOffice($starter);
        $requesterId = $office && ! empty($data['requester_id']) ? (int) $data['requester_id'] : (int) $starter->id;
        $subject = trim((string) ($data['subject'] ?? ''));
        $risId = null;
        $propertyId = null;

        if ($data['kind'] === 'request') {
            $ris = RisSlip::query()->findOrFail($data['ris_id'] ?? 0);

            if (! $office && ! in_array((int) $starter->id, [(int) $ris->requested_by, (int) $ris->received_by], true)) {
                throw ValidationException::withMessages(['ris_id' => 'Choose one of your own requests.']);
            }

            // From the office, a request conversation is with whoever asked for it.
            $requesterId = $office ? (int) $ris->requested_by : $requesterId;
            $risId = (int) $ris->ris_id;
            $subject = (string) $ris->ris_no;
        } elseif (! empty($data['property_id'])) {
            $property = Property::query()->where('excluded', 0)->findOrFail($data['property_id']);

            if ((int) $property->user_id !== $requesterId) {
                throw ValidationException::withMessages(['property_id' => $office
                    ? 'Choose a property this person holds.'
                    : 'Choose one of your own properties.']);
            }

            $propertyId = (int) $property->id;
            $subject = $subject !== '' ? $subject : "{$property->item_name} ({$property->property_number})";
        }

        if ($subject === '') {
            throw ValidationException::withMessages(['subject' => 'Say what it is about.']);
        }

        if ($office && $risId === null && $requesterId === (int) $starter->id) {
            throw ValidationException::withMessages(['requester_id' => 'Choose who to write to.']);
        }

        $conversation = $risId !== null
            ? Conversation::query()->where('ris_id', $risId)->where('requester_id', $requesterId)->first()
            : null;

        $conversation ??= Conversation::query()->create([
            'kind' => $data['kind'],
            'subject' => mb_substr($subject, 0, 255),
            'ris_id' => $risId,
            'property_id' => $propertyId,
            'requester_id' => $requesterId,
            'started_by' => $starter->id,
            'status' => $office ? 'open' : 'waiting',
        ]);

        $this->send($conversation, $starter, $data['body']);

        return $conversation;
    }

    /**
     * Adds a message (text, files or both). A requester's message waits for
     * the office; an office reply answers it; either reopens a resolved one.
     *
     * @param  list<UploadedFile>  $files
     */
    public function send(Conversation $conversation, User $sender, ?string $body, array $files = []): Message
    {
        $body = trim((string) $body);

        if ($body === '' && $files === []) {
            throw ValidationException::withMessages(['body' => 'Write a message or attach a file.']);
        }

        $side = self::sideOf($conversation, $sender);

        // Files first: if the database write fails, they're removed again.
        $stored = [];

        try {
            foreach ($files as $file) {
                $stored[] = [
                    'path' => $file->store('message-attachments', Uploads::diskName()),
                    'name' => mb_substr($file->getClientOriginalName(), 0, 255),
                    'mime' => (string) ($file->getMimeType() ?? $file->getClientMimeType()),
                    'size' => (int) $file->getSize(),
                ];
            }

            $message = DB::transaction(function () use ($conversation, $sender, $side, $body, $stored) {
                $message = $conversation->messages()->create([
                    'user_id' => $sender->id,
                    'side' => $side,
                    'body' => $body !== '' ? $body : null,
                    'created_at' => now(),
                ]);

                foreach ($stored as $attachment) {
                    $message->attachments()->create($attachment);
                }

                $conversation->forceFill([
                    'status' => $side === 'office' ? 'open' : 'waiting',
                    'last_message_at' => $message->created_at,
                ])->save();

                return $message;
            });
        } catch (Throwable $exception) {
            foreach ($stored as $attachment) {
                if (is_string($attachment['path'])) {
                    Uploads::disk()->delete($attachment['path']);
                }
            }

            throw $exception;
        }

        $this->markRead($conversation, $sender, $message->id);
        $this->live->messages($this->recipients($conversation, $sender), $conversation->id);

        return $message;
    }

    /** Remembers how far this person has read (never goes back). */
    public function markRead(Conversation $conversation, User $user, ?int $messageId = null): void
    {
        $messageId ??= (int) $conversation->messages()->max('id');
        $current = (int) DB::table('conversation_reads')
            ->where('conversation_id', $conversation->id)
            ->where('user_id', $user->id)
            ->value('last_read_message_id');

        if ($messageId <= $current) {
            return;
        }

        DB::table('conversation_reads')->upsert(
            [['conversation_id' => $conversation->id, 'user_id' => $user->id, 'last_read_message_id' => $messageId]],
            ['conversation_id', 'user_id'],
            ['last_read_message_id'],
        );
    }

    /**
     * Marks it resolved, or reopens it (waiting again if the requester had
     * the last word). Leaves a line in the thread saying who did it.
     */
    public function setResolved(Conversation $conversation, User $user, bool $resolved): void
    {
        if (($conversation->status === 'resolved') === $resolved) {
            return;
        }

        $lastSide = $conversation->messages()->where('side', '!=', 'system')->latest('id')->value('side');

        DB::transaction(function () use ($conversation, $user, $resolved, $lastSide) {
            $line = $conversation->messages()->create([
                'user_id' => $user->id,
                'side' => 'system',
                'body' => $resolved ? 'resolved' : 'reopened',
                'created_at' => now(),
            ]);

            $conversation->forceFill([
                'status' => $resolved ? 'resolved' : ($lastSide === 'requester' ? 'waiting' : 'open'),
                'last_message_at' => $line->created_at,
            ])->save();

            $this->markRead($conversation, $user, $line->id);
        });

        $this->live->messages($this->recipients($conversation, $user), $conversation->id);
    }

    /** Tells the others someone is typing, at most every few seconds. */
    public function typing(Conversation $conversation, User $user): void
    {
        if (! Cache::add("typing:{$conversation->id}:{$user->id}", true, self::TYPING_EVERY)) {
            return;
        }

        $this->live->typing(
            $this->recipients($conversation, $user),
            $conversation->id,
            (string) str($user->name)->before(' '),
        );
    }

    /** Messages this person hasn't read yet, across what they see. */
    public function unreadCountFor(User $user): int
    {
        return Message::query()
            ->whereIn('conversation_id', Conversation::query()->visibleTo($user)->select('id'))
            ->tap(fn (Builder $query) => self::scopeUnread($query, $user))
            ->count();
    }

    /**
     * Who hears about a conversation: its requester and the supply office,
     * minus the person who acted.
     *
     * @return Collection<int, int>
     */
    public function recipients(Conversation $conversation, ?User $except = null): Collection
    {
        return User::query()->withPermission('messages.office')->pluck('id')
            ->push((int) $conversation->requester_id)
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->reject(fn (int $id) => $except !== null && $id === (int) $except->id)
            ->values();
    }
}
