<?php

namespace App\Services;

use App\Events\InboxUpdated;
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

        if ($this->inboxes !== [] && ! $this->scheduled) {
            $this->scheduled = true;
            defer(fn () => $this->flush());
        }
    }

    /** Send what was collected. Failures are reported, never thrown. */
    public function flush(): void
    {
        $userIds = array_keys($this->inboxes);
        $this->inboxes = [];
        $this->scheduled = false;

        if ($userIds === []) {
            return;
        }

        try {
            event(new InboxUpdated($userIds));
        } catch (Throwable $exception) {
            report($exception);
        }
    }
}
