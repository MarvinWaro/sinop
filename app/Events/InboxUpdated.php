<?php

namespace App\Events;

use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;

/**
 * "Your notifications changed", sent on each person's own channel. It
 * carries nothing: the browser asks the server for the new counts, which
 * still decides what its reader may see. Sent by App\Services\LiveUpdates.
 */
class InboxUpdated implements ShouldBroadcastNow
{
    /** @param  list<int>  $userIds */
    public function __construct(public readonly array $userIds) {}

    /** @return list<PrivateChannel> */
    public function broadcastOn(): array
    {
        return array_map(fn (int $id) => new PrivateChannel("App.Models.User.{$id}"), $this->userIds);
    }

    public function broadcastAs(): string
    {
        return 'inbox';
    }

    /** @return array<string, never> */
    public function broadcastWith(): array
    {
        return [];
    }
}
