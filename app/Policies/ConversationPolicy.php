<?php

namespace App\Policies;

use App\Models\Conversation;
use App\Models\User;

/** A conversation is its requester's and the supply office's. */
class ConversationPolicy
{
    public function view(User $user, Conversation $conversation): bool
    {
        return (int) $conversation->requester_id === (int) $user->id
            || $user->hasPermission('messages.office');
    }
}
