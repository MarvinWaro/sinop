<?php

namespace App\Http\Controllers;

use App\Models\Property;
use App\Models\PropertyCondition;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Settings › Property conditions: the list the property form picks from
 * (and adds to). Properties keep the condition's name, so a rename is
 * applied to them too. Serviceable and Unserviceable are built in: the
 * assets overview counts them, so they can't be renamed or deleted.
 */
class PropertyConditionController extends Controller
{
    public function index(Request $request): Response
    {
        $search = $request->string('search')->trim()->value();

        $conditions = PropertyCondition::query()
            ->when($search, fn ($query) => $query->where('name', 'like', "%{$search}%"))
            ->addSelect([
                'properties_count' => Property::query()
                    ->selectRaw('COUNT(*)')
                    ->whereColumn('properties.condition', 'property_conditions.name')
                    ->where('excluded', 0),
            ])
            ->orderBy('name')
            ->paginate(10)
            ->withQueryString()
            ->through(fn (PropertyCondition $condition) => [
                'id' => $condition->id,
                'name' => $condition->name,
                'properties_count' => (int) $condition->getAttribute('properties_count'),
                'built_in' => $condition->isBuiltIn(),
            ]);

        return Inertia::render('settings/property-conditions', [
            'conditions' => $conditions,
            'filters' => ['search' => $search ?: null],
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $name = $this->validated($request);

        PropertyCondition::query()->create(['name' => $name]);

        return back()->with('success', "“{$name}” added.");
    }

    public function update(Request $request, PropertyCondition $condition): RedirectResponse
    {
        if ($condition->isBuiltIn()) {
            return back()->with('error', "“{$condition->name}” is built in and can't be renamed.");
        }

        $name = $this->validated($request, $condition);
        $old = $condition->name;

        DB::transaction(function () use ($condition, $name, $old) {
            $condition->update(['name' => $name]);
            Property::query()->where('condition', $old)->update(['condition' => $name]);
        });

        return back()->with('success', 'Condition renamed.');
    }

    public function destroy(PropertyCondition $condition): RedirectResponse
    {
        if ($condition->isBuiltIn()) {
            return back()->with('error', "“{$condition->name}” is built in and can't be deleted.");
        }

        $inUse = Property::query()->where('condition', $condition->name)->where('excluded', 0)->count();

        if ($inUse > 0) {
            return back()->with('error', "“{$condition->name}” is used by {$inUse} ".str('property')->plural($inUse).'. Change those first.');
        }

        $condition->delete();

        return back()->with('success', "“{$condition->name}” deleted.");
    }

    /** The name, tidied, and not already listed (in any case). */
    private function validated(Request $request, ?PropertyCondition $condition = null): string
    {
        $request->merge(['name' => trim((string) preg_replace('/\s+/', ' ', (string) $request->input('name')))]);

        $request->validate([
            'name' => [
                'required', 'string', 'max:50',
                function (string $attribute, mixed $value, \Closure $fail) use ($condition) {
                    $taken = PropertyCondition::query()
                        ->whereRaw('LOWER(name) = ?', [mb_strtolower((string) $value)])
                        ->when($condition, fn ($query) => $query->whereKeyNot($condition->getKey()))
                        ->exists();

                    if ($taken) {
                        $fail('This condition is already in the list.');
                    }
                },
            ],
        ]);

        $name = (string) $request->input('name');

        return mb_strtoupper(mb_substr($name, 0, 1)).mb_substr($name, 1);
    }
}
