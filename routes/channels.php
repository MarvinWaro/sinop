<?php

use App\Models\User;
use Illuminate\Support\Facades\Broadcast;

/*
|--------------------------------------------------------------------------
| Broadcast Channels
|--------------------------------------------------------------------------
| Private channels are signed at /broadcasting/auth with the person's
| session (bootstrap/app.php). Signals carry no data; pages ask the server
| again, which decides what each reader may see.
*/

// Each person's own channel: their notifications changed (App\Events\InboxUpdated).
Broadcast::channel('App.Models.User.{id}', fn (User $user, int $id): bool => (int) $user->getKey() === $id);
