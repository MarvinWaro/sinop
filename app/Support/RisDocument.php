<?php

namespace App\Support;

use App\Models\RisSlip;
use App\Models\RisSlipSignature;
use App\Models\User;
use Carbon\CarbonInterface;

/**
 * What the RIS form (Appendix 63) shows, as the signing preview draws it:
 * the same fields, items and signatories as the Excel export.
 */
final class RisDocument
{
    /** @return array<string, mixed> */
    public static function of(RisSlip $risSlip): array
    {
        $risSlip->loadMissing([
            'department:id,name',
            'requester.designation',
            'approver.designation',
            'issuer.designation',
            'receiver.designation',
            'items.supply',
            'signatures',
        ]);

        $signatures = $risSlip->signatures->keyBy('step');

        return [
            'ris_no' => $risSlip->ris_no,
            'entity_name' => $risSlip->entity_name,
            'fund_cluster' => $risSlip->fund_cluster,
            'division' => $risSlip->department?->name,
            'office' => $risSlip->office,
            'responsibility_center_code' => $risSlip->responsibility_center_code,
            'purpose' => $risSlip->purpose,
            'items' => $risSlip->items->map(fn ($item) => [
                'stock_no' => $item->supply?->stock_no,
                'unit' => $item->supply?->unit_of_measurement,
                'description' => collect([$item->supply?->item_name, $item->supply?->description])->filter()->join(', '),
                'requested' => (int) $item->quantity_requested,
                'available' => (bool) $item->stock_available,
                'issued' => $item->quantity_issued !== null ? (int) $item->quantity_issued : null,
                'remarks' => $item->remarks,
            ])->values(),
            'signatories' => [
                'requested' => self::signatory($risSlip, 'requested', $risSlip->requester, $risSlip->created_at, $risSlip->requester_signature_type, $signatures->get('requested')),
                'approved' => $risSlip->approved_by ? self::signatory($risSlip, 'approved', $risSlip->approver, $risSlip->approved_at, $risSlip->approver_signature_type, $signatures->get('approved')) : null,
                'issued' => $risSlip->issued_by ? self::signatory($risSlip, 'issued', $risSlip->issuer, $risSlip->issued_at, $risSlip->issuer_signature_type, $signatures->get('issued')) : null,
                'received' => $risSlip->received_by ? self::signatory($risSlip, 'received', $risSlip->receiver, $risSlip->received_at, $risSlip->receiver_signature_type, $signatures->get('received'), signed: $risSlip->received_at !== null) : null,
            ],
        ];
    }

    /** @return array<string, mixed>|null */
    private static function signatory(RisSlip $risSlip, string $step, ?User $user, ?CarbonInterface $date, ?string $type, ?RisSlipSignature $signature, bool $signed = true): ?array
    {
        if ($user === null) {
            return null;
        }

        return [
            'name' => $user->name,
            'designation' => $user->designation?->name,
            'date' => $signed ? $date?->toIso8601String() : null,
            'type' => $signed ? $type : null,
            'signature' => $signed && $type === 'esign' ? self::signature($risSlip, $step, $user, $signature) : null,
        ];
    }

    /**
     * The frozen signature, or for slips signed before signatures were
     * frozen, the person's current one (placement null: drawn centred),
     * loaded through the RIS so only people who may open it see it.
     *
     * @return array<string, mixed>|null
     */
    private static function signature(RisSlip $risSlip, string $step, User $user, ?RisSlipSignature $signature): ?array
    {
        if ($signature !== null) {
            return [
                'url' => $signature->url,
                'placement' => ['x' => $signature->x, 'y' => $signature->y, 'width' => $signature->width, 'rotation' => $signature->rotation],
            ];
        }

        return $user->signature_path !== null
            ? ['url' => route('ris.signature', ['risSlip' => $risSlip, 'step' => $step], false), 'placement' => null]
            : null;
    }
}
