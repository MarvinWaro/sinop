<?php

namespace App\Http\Controllers;

use App\Models\RisSlip;
use App\Models\RisSlipSignature;
use App\Models\User;
use App\Support\Uploads;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;

class UploadController extends Controller
{
    /**
     * An uploaded file (e-signature, profile photo, property image), for
     * signed-in users. Every upload gets a new file name, so the browser
     * may keep its copy, except of signatures: those are personal, so they
     * are only for the people who may see them and never kept.
     */
    public function show(Request $request, string $path): StreamedResponse
    {
        abort_unless($this->mayOpen($request->user(), $path), 404);

        return $this->stream($path);
    }

    /**
     * An RIS's signature for one step, for people who may open the RIS: the
     * copy frozen at signing, or for slips signed before signatures were
     * frozen, the signer's current one (e-signed steps only).
     */
    public function risSignature(RisSlip $risSlip, string $step): StreamedResponse
    {
        [$signerId, $type] = match ($step) {
            'requested' => [$risSlip->requested_by, $risSlip->requester_signature_type],
            'approved' => [$risSlip->approved_by, $risSlip->approver_signature_type],
            'issued' => [$risSlip->issued_by, $risSlip->issuer_signature_type],
            'received' => [$risSlip->received_by, $risSlip->receiver_signature_type],
            default => abort(404),
        };

        $path = $risSlip->signatures()->where('step', $step)->value('path')
            ?? ($type === 'esign' && $signerId ? User::query()->whereKey($signerId)->value('signature_path') : null);

        abort_if($path === null, 404);

        return $this->stream($path);
    }

    /**
     * Signatures are personal: a saved one only for its owner, one frozen
     * on an RIS only for people who may open that RIS. Photos and property
     * images: anyone signed in.
     */
    private function mayOpen(User $user, string $path): bool
    {
        return match (Str::before($path, '/')) {
            'signatures' => $user->signature_path === $path
                || $user->signatures()->where('path', $path)->exists(),
            'ris-signatures' => ($slip = RisSlipSignature::query()->where('path', $path)->first()?->risSlip) !== null
                && $user->can('view', $slip),
            default => true,
        };
    }

    private function stream(string $path): StreamedResponse
    {
        $disk = Uploads::disk();

        abort_unless($disk->exists($path), 404);

        return $disk->response($path, headers: [
            'Cache-Control' => Uploads::isSignature($path) ? 'private, no-store' : 'private, max-age=31536000, immutable',
        ]);
    }
}
