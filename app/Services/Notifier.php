<?php

namespace App\Services;

use App\Enums\NotificationKind;
use App\Models\ActivityLog;
use App\Models\Notification;
use App\Models\Property;
use App\Models\RisSlip;
use App\Models\Supply;
use App\Models\SupplyStock;
use App\Models\User;
use Closure;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;
use Throwable;

/**
 * Decides who is told about what, and writes their notifications. The only
 * writer of `notifications`. Each method takes the activity log entry of
 * the action (it names the actor and the record), runs after the work is
 * saved, and never throws: a missed notice must not undo the action.
 */
class Notifier
{
    public function __construct(private readonly LiveUpdates $live) {}

    /** A new request: whoever approves requisitions. */
    public function risSubmitted(?ActivityLog $entry): void
    {
        $this->guarded(fn () => $this->send(NotificationKind::RisSubmitted, $entry, $this->holders('ris.approve')));
    }

    /** Approved: the requester, and whoever issues supplies. */
    public function risApproved(RisSlip $slip, ?ActivityLog $entry): void
    {
        $this->guarded(function () use ($slip, $entry): void {
            $requester = array_filter([$slip->requested_by]);

            $this->send(NotificationKind::RisApproved, $entry, $requester);
            $this->send(NotificationKind::RisReadyToIssue, $entry, $this->holders('ris.issue')->diff($requester));
        });
    }

    public function risDeclined(RisSlip $slip, ?ActivityLog $entry): void
    {
        $this->guarded(fn () => $this->send(NotificationKind::RisDeclined, $entry, [$slip->requested_by]));
    }

    /** Issued: the person who receives the supplies, and the requester. */
    public function risIssued(RisSlip $slip, ?ActivityLog $entry): void
    {
        $this->guarded(fn () => $this->send(NotificationKind::RisIssued, $entry, [$slip->received_by, $slip->requested_by]));
    }

    /** Received: whoever issues and approves requisitions. */
    public function risReceived(?ActivityLog $entry): void
    {
        $this->guarded(fn () => $this->send(
            NotificationKind::RisReceived,
            $entry,
            $this->holders('ris.issue')->merge($this->holders('ris.approve')),
        ));
    }

    /** An IAR (delivery) was recorded: supply staff and approvers. */
    public function iarRecorded(?ActivityLog $entry): void
    {
        $this->guarded(fn () => $this->send(
            NotificationKind::IarRecorded,
            $entry,
            $this->holders('stocks.create')->merge($this->holders('ris.approve')),
        ));
    }

    /**
     * After stock went out: an alert for each supply now at or below its
     * reorder point (or at zero). A person isn't told again about a supply
     * while an earlier alert for it is still unread.
     *
     * @param  iterable<int|string>  $supplyIds
     */
    public function stockLevels(iterable $supplyIds, ?ActivityLog $entry): void
    {
        $this->guarded(function () use ($supplyIds, $entry): void {
            $supplyIds = collect($supplyIds)->map(fn ($id) => (int) $id)->unique()->values();

            if ($supplyIds->isEmpty()) {
                return;
            }

            $onHand = SupplyStock::query()
                ->whereIn('supply_id', $supplyIds)
                ->where('status', 'available')
                ->groupBy('supply_id')
                ->selectRaw('supply_id, SUM(quantity_on_hand) as total')
                ->pluck('total', 'supply_id');

            $recipients = $this->holders('stocks.create');

            Supply::query()->whereIn('supply_id', $supplyIds)->get(['supply_id', 'reorder_point'])
                ->each(function (Supply $supply) use ($onHand, $recipients, $entry): void {
                    $left = (int) ($onHand[$supply->supply_id] ?? 0);

                    if ($left > (int) $supply->reorder_point) {
                        return;
                    }

                    $kind = $left <= 0 ? NotificationKind::StockOut : NotificationKind::StockLow;
                    $alreadyTold = Notification::query()
                        ->where('kind', $kind)
                        ->where('supply_id', $supply->supply_id)
                        ->whereNull('read_at')
                        ->pluck('user_id');

                    $this->send($kind, $entry, $recipients->diff($alreadyTold), supplyId: $supply->supply_id, includeActor: true);
                });
        });
    }

    /** Someone registered: whoever can activate accounts. */
    public function accountRequested(?ActivityLog $entry): void
    {
        $this->guarded(fn () => $this->send(NotificationKind::AccountRequested, $entry, $this->holders('users.update')));
    }

    public function accountActivated(User $user, ?ActivityLog $entry): void
    {
        $this->guarded(fn () => $this->send(NotificationKind::AccountActivated, $entry, [$user->getKey()]));
    }

    /** The property's new accountable officer. */
    public function propertyAssigned(Property $property, ?ActivityLog $entry): void
    {
        $this->guarded(fn () => $this->send(NotificationKind::PropertyAssigned, $entry, [$property->user_id]));
    }

    /**
     * Active users with the permission (super admins have them all).
     *
     * @return Collection<int, int>
     */
    private function holders(string $permission): Collection
    {
        return User::query()->withPermission($permission)->pluck('id');
    }

    /**
     * Write the notices for the active recipients (never the person who
     * acted, unless asked) and tell their browsers.
     *
     * @param  iterable<int|string|null>  $recipients  User ids.
     */
    private function send(
        NotificationKind $kind,
        ?ActivityLog $entry,
        iterable $recipients,
        ?int $supplyId = null,
        bool $includeActor = false,
    ): void {
        // Without its log entry a notice couldn't say who did what.
        if ($entry === null) {
            return;
        }

        $ids = collect($recipients)->filter()->map(fn ($id) => (int) $id)->unique()
            ->when(! $includeActor && $entry->user_id !== null, fn (Collection $ids) => $ids->reject(fn (int $id) => $id === $entry->user_id));

        if ($ids->isEmpty()) {
            return;
        }

        $ids = User::query()->whereKey($ids)->where('status', true)->pluck('id');
        $now = now();

        foreach ($ids->chunk(500) as $chunk) {
            Notification::query()->insert($chunk->map(fn (int $userId) => [
                'id' => (string) Str::ulid(),
                'user_id' => $userId,
                'kind' => $kind->value,
                'activity_log_id' => $entry->getKey(),
                'supply_id' => $supplyId,
                'created_at' => $now,
            ])->all());
        }

        $this->live->inbox($ids);
    }

    private function guarded(Closure $callback): void
    {
        try {
            $callback();
        } catch (Throwable $exception) {
            report($exception);
        }
    }
}
