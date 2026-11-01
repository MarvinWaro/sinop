<?php

namespace App\Http\Controllers;

use App\Models\Property;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

/**
 * What a property sticker's QR code opens. Anyone who scans it sees what the
 * item is and who is accountable for it; people signed in to SINOP also see
 * its cost, fund, notes and photos. Removed properties aren't shown.
 */
class PropertyScanController extends Controller
{
    public function show(Request $request, string $propertyNumber): Response
    {
        $number = mb_strtoupper(trim($propertyNumber));
        $viewer = $request->user();

        $property = Property::query()
            ->where('excluded', 0)
            ->whereRaw('UPPER(property_number) = ?', [$number])
            ->with(['location:id,location_name', 'user.designation:id,name', 'user.department:id,name', 'images'])
            ->first();

        $canOpen = $property !== null && (bool) $viewer?->can('properties.view');

        return Inertia::render('public/property', [
            'propertyNumber' => $number,
            'property' => $property ? $this->details($property, full: $viewer !== null) : null,
            'signedIn' => $viewer !== null,
            'openUrl' => $canOpen ? route('property.view', $property) : null,
        ])->toResponse($request)->setStatusCode($property ? 200 : 404);
    }

    /**
     * "Sign in to see more": behind the login, so signing in comes back here
     * and the page then shows everything.
     */
    public function signIn(string $propertyNumber): RedirectResponse
    {
        return redirect()->route('property.scan', $propertyNumber);
    }

    /** @return array<string, mixed> */
    private function details(Property $property, bool $full): array
    {
        $holder = $property->user;

        $basics = [
            'item_name' => $property->item_name,
            'property_number' => $property->property_number,
            'serial_no' => $property->serial_no,
            'model_no' => $property->model_no,
            'condition' => $property->condition,
            'location' => $property->location?->location_name,
            'accountable' => $holder ? [
                'name' => $holder->name,
                'designation' => $holder->designation?->name,
                'division' => $holder->department?->name,
            ] : null,
        ];

        if (! $full) {
            return $basics;
        }

        return $basics + [
            'item_description' => $property->item_description,
            'acquisition_date' => $property->acquisition_date?->format('Y-m-d'),
            'acquisition_cost' => $property->acquisition_cost,
            'fund' => $property->fund,
            'unit_of_measure' => $property->unit_of_measure,
            'quantity' => $property->quantity_per_physical_count,
            'remarks' => $property->remarks,
            'photos' => $property->images->map(fn ($image) => $image->url)->values(),
        ];
    }
}
