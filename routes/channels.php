<?php

use Illuminate\Support\Facades\Broadcast;

/*
|--------------------------------------------------------------------------
| Broadcast Channels
|--------------------------------------------------------------------------
*/

// New requests: for whoever approves requisitions.
Broadcast::channel('cao-notifications', function ($user) {
    return $user->can('ris.approve');
});

// Approved requests to issue: for whoever issues supplies.
Broadcast::channel('admin-notifications', function ($user) {
    return $user->can('ris.issue');
});

// User-specific channel
Broadcast::channel('user.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});
