<?php

namespace App\Services;

use App\Events\ConversationTyping;
use App\Events\InboxUpdated;
use App\Events\MessagesUpdated;
use Throwable;

use function Illuminate\Support\defer;

/**
 * Tells browsers that something changed, over the WebSocket (Berth's Soketi
 * app, Pusher protocol). Signals are collected during the request and sent
 * once after the response, so the person who acted never waits for the
 * socket and a failed send can't undo what they did. Nothing is sent when
 * the request fails. One instance per request (see AppServiceProvider).
 */
class LiveUpdates
{
    /** @var array<int, true> */
    private array $inboxes = [];

    /** @var array<int, array<int, true>> conversation id => user ids */
    private array $conversations = [];

    private bool $scheduled = false;

    /**
     * Their notifications changed.
     *
     * @param  iterable<int>  $userIds
     */
    public function inbox(iterable $userIds): void
    {
        foreach ($userIds as $id) {
            $this->inboxes[(int) $id] = true;
        }

        $this->schedule();
    }

    /**
     * A conversation has news for these people.
     *
     * @param  iterable<int>  $userIds
     */
    public function messages(iterable $userIds, int $conversationId): void
    {
        foreach ($userIds as $id) {
            $this->conversations[$conversationId][(int) $id] = true;
        }

        $this->schedule();
    }

    /**
     * Someone is typing: sent at once (it's only useful now). Failures are
     * reported, never thrown.
     *
     * @param  iterable<int>  $userIds
     */
    public function typing(iterable $userIds, int $conversationId, string $name): void
    {
        $ids = array_values(array_map('intval', is_array($userIds) ? $userIds : iterator_to_array($userIds)));

        if ($ids === []) {
            return;
        }

        try {
            event(new ConversationTyping($ids, $conversationId, $name));
        } catch (Throwable $exception) {
            report($exception);
        }
    }

    private function schedule(): void
    {
        if (($this->inboxes !== [] || $this->conversations !== []) && ! $this->scheduled) {
            $this->scheduled = true;
            defer(fn () => $this->flush());
        }
    }

    /** Send what was collected. Failures are reported, never thrown. */
    public function flush(): void
    {
        $userIds = array_keys($this->inboxes);
        $conversations = $this->conversations;
        $this->inboxes = [];
        $this->conversations = [];
        $this->scheduled = false;

        try {
            if ($userIds !== []) {
                event(new InboxUpdated($userIds));
            }

            foreach ($conversations as $conversationId => $users) {
                event(new MessagesUpdated(array_keys($users), $conversationId));
            }
        } catch (Throwable $exception) {
            report($exception);
        }
    }
}
