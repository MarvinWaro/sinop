<?php

namespace App\Events;

use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;

/**
 * "A conversation has news", on each person's own channel. It names the
 * conversation only; the browser asks the server for the messages, which
 * still decides who may read them. Sent by App\Services\LiveUpdates.
 */
class MessagesUpdated implements ShouldBroadcastNow
{
    /** @param  list<int>  $userIds */
    public function __construct(public readonly array $userIds, public readonly int $conversationId) {}

    /** @return list<PrivateChannel> */
    public function broadcastOn(): array
    {
        return array_map(fn (int $id) => new PrivateChannel("App.Models.User.{$id}"), $this->userIds);
    }

    public function broadcastAs(): string
    {
        return 'messages';
    }

    /** @return array{conversation: int} */
    public function broadcastWith(): array
    {
        return ['conversation' => $this->conversationId];
    }
}
