<?php

namespace App\Policies;

use App\Models\User;
use App\Models\UserSignature;

/** A saved e-signature is its owner's alone: nobody else may use or change it. */
class UserSignaturePolicy
{
    public function manage(User $user, UserSignature $signature): bool
    {
        return (int) $signature->user_id === (int) $user->id;
    }
}
