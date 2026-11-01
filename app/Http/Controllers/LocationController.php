<?php

namespace App\Http\Controllers;

use App\Models\Location;
use Illuminate\Http\Request;
use Inertia\Inertia;

class LocationController extends Controller
{
    public function index(Request $request)
    {
        // Get the search term from the request
        $search = $request->get('search');

        // Fetch locations that are not excluded, ordering the newest first
        $locations = Location::where('excluded', 0)
            ->when($search, function ($query, $search) {
                return $query->where('location_name', 'like', "%{$search}%");
            })
            ->orderBy('created_at', 'desc')
            ->paginate(5)
            ->withQueryString();

        return Inertia::render('settings/locations', [
            'locations' => $locations,
            'filters' => ['search' => $search],
        ]);
    }

    public function store(Request $request)
    {
        // Validate input
        $request->validate([
            'location_name' => 'required|string|max:255',
        ]);

        // Check if an ACTIVE location exists
        $existingLocation = Location::where('excluded', 0)
            ->where('location_name', $request->location_name)
            ->first();

        if ($existingLocation) {
            return redirect()->back()
                ->withInput()
                ->withErrors(['location_name' => 'This property location is already in the list.']);
        }

        // Find the first EXCLUDED location and reuse it
        $excludedLocation = Location::where('excluded', 1)->first();

        if ($excludedLocation) {
            // Reactivate the excluded location with new details
            $excludedLocation->update([
                'location_name' => $request->location_name,
                'excluded' => 0, // Mark as active
                'active' => 1,
                'updated_at' => now(),
            ]);

            return redirect()->route('location.index')->with('success', 'Property location added.');
        }

        // If no excluded location is found, create a new location
        Location::create([
            'location_name' => $request->location_name,
            'active' => 1,
            'excluded' => 0,
        ]);

        return redirect()->route('location.index')->with('success', 'Property location added.');
    }

    public function update(Request $request, Location $location)
    {
        // Validate input (no regex, just max length and unique rule)
        $request->validate([
            'location_name' => 'required|string|max:255|unique:locations,location_name,'.$location->id,
        ]);

        // Update location
        $location->update([
            'location_name' => $request->location_name,
        ]);

        return redirect()->route('location.index')->with('success', 'Property location updated.');
    }

    public function destroy(Location $location)
    {
        // Check if the location is already excluded
        if ($location->excluded) {
            return redirect()->route('location.index')->with('error', 'This property location is already removed.');
        }

        // Mark the location as excluded and inactive
        $location->update([
            'excluded' => 1,
            'active' => 0,
        ]);

        return redirect()->route('location.index')->with('deleted', 'Property location removed.');
    }
}
