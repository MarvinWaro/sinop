<?php

namespace App\Support;

use App\Models\RisSlip;
use App\Models\RisSlipSignature;
use App\Models\User;
use App\Models\UserSignature;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * The e-signature a person puts on an RIS when requesting, approving,
 * issuing or receiving: which of their saved signatures, and where inside
 * their box (fractions of the box, see RisSignatureBox). Sent as
 * `signature: {id, x, y, width, rotation}` next to `signature_type`; SGD
 * needs none.
 */
final class RisSignaturePlacement
{
    /** @return array<string, list<mixed>> */
    public static function rules(User $signer): array
    {
        $esign = 'exclude_unless:signature_type,esign';

        return [
            'signature' => [$esign, 'required', 'array'],
            'signature.id' => [$esign, 'required', 'integer', Rule::exists('user_signatures', 'id')->where('user_id', $signer->getKey())],
            'signature.x' => [$esign, 'required', 'numeric', 'between:0,1'],
            'signature.y' => [$esign, 'required', 'numeric', 'between:0,1'],
            'signature.width' => [$esign, 'required', 'numeric', 'between:0.1,1'],
            'signature.rotation' => [$esign, 'required', 'numeric', 'between:-30,30'],
        ];
    }

    /** @return array<string, string> */
    public static function messages(): array
    {
        return [
            'signature.required' => 'Place your e-signature on the form first.',
            'signature.id.exists' => 'Choose one of your saved signatures.',
        ];
    }

    /**
     * Freezes the signature on the slip: a copy of the image (so changing or
     * deleting the saved one later doesn't change the form) and its place.
     *
     * @param  array{id: int, x: float, y: float, width: float, rotation: float}  $input
     */
    public static function record(RisSlip $risSlip, string $step, User $signer, array $input): RisSlipSignature
    {
        $saved = UserSignature::query()->whereBelongsTo($signer)->findOrFail($input['id']);
        $copy = 'ris-signatures/'.Str::uuid().'.png';

        Uploads::disk()->copy($saved->path, $copy);

        $previous = $risSlip->signatures()->where('step', $step)->value('path');

        $signature = RisSlipSignature::query()->updateOrCreate(
            ['ris_id' => $risSlip->getKey(), 'step' => $step],
            [
                'user_id' => $signer->getKey(),
                'path' => $copy,
                'x' => round((float) $input['x'], 4),
                'y' => round((float) $input['y'], 4),
                'width' => round((float) $input['width'], 4),
                'rotation' => round((float) $input['rotation'], 1),
                'signed_at' => now(),
            ],
        );

        if ($previous !== null) {
            Uploads::disk()->delete($previous);
        }

        return $signature;
    }
}
