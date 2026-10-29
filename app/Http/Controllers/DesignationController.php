<?php

namespace App\Http\Controllers;

use App\Models\Designation;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Inertia\Inertia;

class DesignationController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $search = $request->get('search');

        $designations = Designation::when($search, function ($query, $search) {
            return $query->where('name', 'like', "%{$search}%");
        })
            ->paginate(25)
            ->withQueryString();

        return Inertia::render('settings/designations', [
            'designations' => $designations,
            'filters' => ['search' => $search],
        ]);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        try {
            $validated = $request->validate([
                'name' => 'required|string|max:255|unique:designations,name',
            ]);

            Designation::create($validated);

            return redirect()->route('designations.index')
                ->with('success', 'Designation created successfully.');
        } catch (QueryException $e) {
            if ($e->getCode() == 23000) {
                return redirect()->back()
                    ->withInput()
                    ->withErrors(['name' => 'This designation name already exists.']);
            }

            return redirect()->back()
                ->withInput()
                ->withErrors(['name' => 'An error occurred while saving the designation.']);
        }
    }

    public function update(Request $request, Designation $designation)
    {
        try {
            $validated = $request->validate([
                'name' => 'required|string|max:255|unique:designations,name,'.$designation->id,
            ]);

            $designation->update($validated);

            return redirect()->route('designations.index')->with('success', 'Designation updated successfully.');
        } catch (QueryException $e) {
            if ($e->getCode() == 23000) {
                return redirect()->back()
                    ->withInput()
                    ->withErrors(['name' => 'This designation name already exists.']);
            }

            return redirect()->back()
                ->withInput()
                ->withErrors(['name' => 'An error occurred while updating the designation.']);
        }
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Designation $designation)
    {
        try {
            $designation->delete();

            return redirect()->route('designations.index')
                ->with('success', 'Designation deleted successfully.');
        } catch (\Exception $e) {
            return redirect()->route('designations.index')
                ->with('error', 'Failed to delete designation. It may be in use.');
        }
    }
}
