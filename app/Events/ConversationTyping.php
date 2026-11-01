<?php

namespace App\Events;

use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;

/** "Someone is typing in this conversation", for the other people in it. */
class ConversationTyping implements ShouldBroadcastNow
{
    /** @param  list<int>  $userIds */
    public function __construct(
        public readonly array $userIds,
        public readonly int $conversationId,
        public readonly string $name,
    ) {}

    /** @return list<PrivateChannel> */
    public function broadcastOn(): array
    {
        return array_map(fn (int $id) => new PrivateChannel("App.Models.User.{$id}"), $this->userIds);
    }

    public function broadcastAs(): string
    {
        return 'typing';
    }

    /** @return array{conversation: int, name: string} */
    public function broadcastWith(): array
    {
        return ['conversation' => $this->conversationId, 'name' => $this->name];
    }
}
