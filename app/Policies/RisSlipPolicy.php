<?php

namespace App\Policies;

use App\Models\RisSlip;
use App\Models\User;

/**
 * Who may open, print or export one RIS: anyone who can see all
 * requisitions or act on them, plus the person who requested it and the
 * person it was issued to (their own slips, as on the staff dashboard).
 */
class RisSlipPolicy
{
    public function view(User $user, RisSlip $risSlip): bool
    {
        return $user->hasPermission('ris.view')
            || $user->hasPermission('ris.approve')
            || $user->hasPermission('ris.issue')
            || (int) $risSlip->requested_by === (int) $user->id
            || (int) $risSlip->received_by === (int) $user->id;
    }
}
