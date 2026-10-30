<?php

namespace App\Http\Controllers;

use App\Models\UserSignature;
use App\Services\SignatureLibrary;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The signed-in person's saved e-signatures. The settings page and the
 * signing preview both use the JSON endpoints, so creating a signature in
 * the middle of approving or issuing doesn't reload the page.
 */
class SignatureController extends Controller
{
    public function __construct(private readonly SignatureLibrary $library) {}

    /** Settings › E-signature. */
    public function edit(Request $request): Response
    {
        return Inertia::render('settings/signature', [
            'signatures' => $request->user()->signatures,
            'limit' => UserSignature::LIMIT,
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        return $this->list($request);
    }

    /** The browser sends a cleaned, trimmed PNG (drawn, typed or uploaded). */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'file' => ['required', 'image', 'mimes:png', 'max:1024', 'dimensions:max_width=2400,max_height=2400'],
            'name' => ['required', 'string', 'max:60'],
            'source' => ['required', Rule::in(UserSignature::SOURCES)],
            'make_default' => ['boolean'],
        ]);

        $signature = $this->library->add(
            $request->user(),
            $validated['file'],
            $validated['name'],
            $validated['source'],
            $request->boolean('make_default'),
        );

        return $this->list($request, ['created' => $signature->getKey()]);
    }

    public function makeDefault(Request $request, UserSignature $signature): JsonResponse
    {
        $this->library->makeDefault($signature);

        return $this->list($request);
    }

    public function destroy(Request $request, UserSignature $signature): JsonResponse
    {
        $this->library->remove($signature);

        return $this->list($request);
    }

    /** @param  array<string, mixed>  $extra */
    private function list(Request $request, array $extra = []): JsonResponse
    {
        return response()->json([
            'signatures' => $request->user()->signatures()->get(),
            'limit' => UserSignature::LIMIT,
            ...$extra,
        ]);
    }
}
