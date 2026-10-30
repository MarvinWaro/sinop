<?php

namespace App\Http\Controllers;

use App\Models\Location;
use App\Models\Property;
use App\Models\Role;
use App\Models\User; // Using User model now
use App\Services\ActivityRecorder;
use App\Services\Notifier;
use App\Support\Uploads;
use Barryvdh\DomPDF\Facade\Pdf;
use Endroid\QrCode\Logo\Logo;
use Endroid\QrCode\QrCode;
use Endroid\QrCode\Writer\PngWriter; // PDF facade
use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use Inertia\Inertia;

class PropertyController extends Controller
{
    public function view(Property $property)
    {
        // Load relationships: now load 'user', 'images', and 'location'
        $property->load('images', 'user', 'location');

        $propertyDetails = "Property Number: {$property->property_number}\n"
            ."Item Name: {$property->item_name}\n"
            ."Serial Number: {$property->serial_no}\n"
            ."Model Number: {$property->model_no}\n"
            .'Acquisition Date: '.($property->acquisition_date ? $property->acquisition_date->format('F j, Y') : 'N/A')."\n"
            .'Acquisition Cost: '.($property->acquisition_cost ? '₱'.number_format($property->acquisition_cost, 2) : 'N/A')."\n"
            ."Fund: {$property->fund}\n"
            ."Location: {$property->location->location_name}\n"
            ."Description: {$property->item_description}\n"
            ."Remarks: {$property->remarks}\n"
            .'Assigned User: '.($property->user ? $property->user->name : 'N/A')."\n"
            .'Designation: '.($property->user && $property->user->designation ? optional($property->user->designation)->name : 'N/A');

        // Generate QR code with CHED logo if it doesn't exist (or was deleted on update)
        $qrCodePath = storage_path('app/public/qrcodes/property_'.$property->id.'.png');
        $qrCodeDir = dirname($qrCodePath);

        if (! File::exists($qrCodeDir)) {
            File::makeDirectory($qrCodeDir, 0755, true);
        }

        if (! file_exists($qrCodePath)) {
            $qrCode = new QrCode($propertyDetails);
            $writer = new PngWriter;

            // Add CHED logo
            $logoPath = public_path('img/ched-logo.png');
            $logo = new Logo($logoPath, 50, 50);

            $result = $writer->write(
                $qrCode,
                $logo,
                null,
                ['size' => 200]
            );
            $result->saveToFile($qrCodePath);
        }

        $qrCodeImage = asset('storage/qrcodes/property_'.$property->id.'.png');

        $property->user?->load('designation', 'department');

        // The holder's other active properties (the Blade view listed these
        // straight from $property->user->properties, including removed ones).
        $holderProperties = $property->user
            ? $property->user->properties()
                ->where('excluded', 0)
                ->with('images')
                ->latest()
                ->get()
            : collect();

        return Inertia::render('properties/show', [
            'property' => $property,
            'qrCodeImage' => $qrCodeImage,
            'holder' => [
                'assignedCount' => $holderProperties->count(),
                'lastAssignment' => $holderProperties->first()?->item_name,
            ],
            'otherProperties' => $holderProperties
                ->where('id', '!=', $property->id)
                ->map(fn ($other) => [
                    'id' => $other->id,
                    'property_number' => $other->property_number,
                    'item_name' => $other->item_name,
                    'item_description' => $other->item_description,
                    'acquisition_date' => $other->acquisition_date?->format('Y-m-d'),
                    'image_url' => $other->images->first()?->url,
                ])
                ->values(),
        ]);
    }

    public function downloadQr($propertyId)
    {
        $property = Property::with('user', 'location')->findOrFail($propertyId);

        $propertyDetails = "Property Number: {$property->property_number}\n"
            ."Item Name: {$property->item_name}\n"
            ."Serial Number: {$property->serial_no}\n"
            ."Model Number: {$property->model_no}\n"
            .'Acquisition Date: '.($property->acquisition_date ? $property->acquisition_date->format('F j, Y') : 'N/A')."\n"
            .'Acquisition Cost: '.($property->acquisition_cost ? '₱'.number_format($property->acquisition_cost, 2) : 'N/A')."\n"
            ."Fund: {$property->fund}\n"
            ."Condition: {$property->condition}\n"
            ."Location: {$property->location->location_name}\n"
            ."Description: {$property->item_description}\n"
            ."Remarks: {$property->remarks}\n"
            .'Assigned User: '.($property->user ? $property->user->name : 'N/A')."\n"
            .'Designation: '.($property->user && $property->user->designation ? optional($property->user->designation)->name : 'N/A');

        $qrCodePath = storage_path('app/public/qrcodes/property_'.$property->id.'.png');
        $qrCodeDir = dirname($qrCodePath);

        if (! File::exists($qrCodeDir)) {
            File::makeDirectory($qrCodeDir, 0755, true);
        }

        if (! file_exists($qrCodePath)) {
            $qrCode = new QrCode($propertyDetails);
            $writer = new PngWriter;
            $logoPath = public_path('img/ched-logo.png');
            $logo = new Logo($logoPath, 50, 50);

            $result = $writer->write(
                $qrCode,
                $logo,
                null,
                ['size' => 200]
            );
            $result->saveToFile($qrCodePath);
        }

        $qrCodeImage = public_path('storage/qrcodes/property_'.$property->id.'.png');

        $data = [
            'qrCodeImage' => $qrCodeImage,
            'itemName' => $property->item_name,
            'propertyNumber' => $property->property_number,
            'employeeName' => $property->user->name ?? 'N/A',
            'designation' => $property->user && $property->user->designation ? optional($property->user->designation)->name : 'N/A',
            'serialNo' => $property->serial_no ?? 'N/A',
            'modelNo' => $property->model_no ?? 'N/A',
            'condition' => $property->condition ?? 'N/A',
        ];

        $pdf = Pdf::loadView('manage-property.qr_pdf', $data);

        return $pdf->download('property_sticker_'.$property->property_number.'.pdf');
    }

    public function index(Request $request)
    {
        $search = $request->get('search');

        $properties = Property::where('excluded', 0)
            ->when($search, function ($query, $search) {
                $query->where(function ($q) use ($search) {
                    $q->where('item_name', 'like', "%{$search}%")
                        ->orWhere('item_description', 'like', "%{$search}%")
                        ->orWhere('serial_no', 'like', "%{$search}%")
                        ->orWhere('model_no', 'like', "%{$search}%")
                        ->orWhere('acquisition_cost', 'like', "%{$search}%")
                        ->orWhere('unit_of_measure', 'like', "%{$search}%")
                        ->orWhere('fund', 'like', "%{$search}%")
                        ->orWhere('condition', 'like', "%{$search}%")
                        ->orWhere('remarks', 'like', "%{$search}%")
                        ->orWhere('quantity_per_physical_count', 'like', "%{$search}%");

                    $q->orWhereHas('location', function ($subQ) use ($search) {
                        $subQ->where('location_name', 'like', "%{$search}%");
                    });

                    // The users table has no `department` column (the old query
                    // failed whenever a search term was entered), so search the
                    // department relationship instead.
                    $q->orWhereHas('user', function ($subQ) use ($search) {
                        $subQ->where('name', 'like', "%{$search}%")
                            ->orWhere('email', 'like', "%{$search}%")
                            ->orWhereHas('department', function ($deptQ) use ($search) {
                                $deptQ->where('name', 'like', "%{$search}%");
                            });
                    });
                });
            })
            ->with(['user:id,name', 'location:id,location_name'])
            ->orderBy('created_at', 'desc')
            ->paginate(5)
            ->withQueryString();

        return Inertia::render('properties/index', [
            'properties' => $properties,
            'filters' => ['search' => $search],
        ]);
    }

    public function create()
    {
        $locations = Location::where('excluded', 0)->get();

        return Inertia::render('properties/create', [
            'locations' => $locations,
            'users' => $this->assignableUsers(),
        ]);
    }

    public function store(Request $request)
    {
        // Remove commas from acquisition cost and set to null if empty.
        $request->merge([
            'acquisition_cost' => $request->acquisition_cost ? str_replace(',', '', $request->acquisition_cost) : null,
        ]);

        $request->validate([
            'property_number' => 'required|string|unique:properties,property_number,NULL,id,excluded,0',
            'item_name' => 'required|string|max:255',
            'item_description' => 'nullable|string',
            'serial_no' => 'nullable|string|unique:properties,serial_no',
            'model_no' => 'nullable|string',
            'acquisition_date' => 'nullable|date',
            'acquisition_cost' => 'nullable|numeric',
            'unit_of_measure' => 'nullable|string|max:50',
            'quantity_per_physical_count' => 'required|integer|min:1',
            'fund' => 'nullable|string',
            'location_id' => 'required|exists:locations,id',
            'user_id' => 'required|exists:users,id',
            'condition' => 'required|string',
            'remarks' => 'nullable|string',
            'images' => 'nullable|array|max:4',
            'images.*' => 'image|max:25600',
        ]);

        if (! empty($request->serial_no)) {
            $existsActive = Property::where('excluded', 0)
                ->where('serial_no', $request->serial_no)
                ->exists();

            if ($existsActive) {
                return redirect()->back()
                    ->withInput()
                    ->withErrors(['serial_no' => 'Serial number is already taken among active properties.']);
            }
        }

        $excludedProperty = Property::where('excluded', 1)->first();

        if ($excludedProperty) {
            foreach ($excludedProperty->images as $image) {
                Uploads::disk()->delete($image->file_path);
                $image->delete();
            }

            $excludedProperty->update([
                'property_number' => $request->property_number,
                'item_name' => $request->item_name,
                'item_description' => $request->item_description,
                'serial_no' => $request->serial_no,
                'model_no' => $request->model_no,
                'acquisition_date' => $request->acquisition_date,
                'acquisition_cost' => $request->acquisition_cost,
                'unit_of_measure' => $request->unit_of_measure,
                'quantity_per_physical_count' => $request->quantity_per_physical_count,
                'fund' => $request->fund,
                'location_id' => $request->location_id,
                'user_id' => $request->user_id,
                'condition' => $request->condition,
                'remarks' => $request->remarks,
                'excluded' => 0,
                'active' => 1,
            ]);

            if ($request->hasFile('images')) {
                foreach ($request->file('images') as $image) {
                    $filename = time().'_'.uniqid().'.'.$image->getClientOriginalExtension();
                    $path = $image->storeAs('property_images', $filename, Uploads::diskName());
                    $excludedProperty->images()->create([
                        'file_path' => $path,
                    ]);
                }
            }

            $this->notifyAssignee($excludedProperty);

            return redirect()->route('property.index')
                ->with('success', 'Property reactivated successfully.');
        }

        $property = Property::create([
            'property_number' => $request->property_number,
            'item_name' => $request->item_name,
            'item_description' => $request->item_description,
            'serial_no' => $request->serial_no,
            'model_no' => $request->model_no,
            'acquisition_date' => $request->acquisition_date,
            'acquisition_cost' => $request->acquisition_cost,
            'unit_of_measure' => $request->unit_of_measure,
            'quantity_per_physical_count' => $request->quantity_per_physical_count,
            'fund' => $request->fund,
            'location_id' => $request->location_id,
            'user_id' => $request->user_id,
            'condition' => $request->condition,
            'remarks' => $request->remarks,
            'active' => 1,
            'excluded' => 0,
        ]);

        if ($request->hasFile('images')) {
            foreach ($request->file('images') as $image) {
                $filename = time().'_'.uniqid().'.'.$image->getClientOriginalExtension();
                $path = $image->storeAs('property_images', $filename, Uploads::diskName());
                $property->images()->create([
                    'file_path' => $path,
                ]);
            }
        }

        $this->notifyAssignee($property);

        return redirect()->route('property.index')
            ->with('success', 'Property created successfully.');
    }

    /** Tell the accountable officer the property is now theirs. */
    private function notifyAssignee(Property $property): void
    {
        app(Notifier::class)->propertyAssigned($property, app(ActivityRecorder::class)->latestFor($property));
    }

    public function edit(Property $property)
    {
        $locations = Location::where('excluded', 0)->get();

        $property->load('images');

        return Inertia::render('properties/edit', [
            'property' => $property,
            'locations' => $locations,
            'users' => $this->assignableUsers($property->user_id),
        ]);
    }

    public function update(Request $request, Property $property)
    {
        $request->merge([
            'acquisition_cost' => $request->acquisition_cost ? str_replace(',', '', $request->acquisition_cost) : null,
        ]);

        $request->validate([
            'property_number' => 'required|string|unique:properties,property_number,'.$property->id,
            'item_name' => 'required|string|max:255',
            'item_description' => 'nullable|string',
            'serial_no' => 'nullable|string|unique:properties,serial_no,'.$property->id,
            'model_no' => 'nullable|string',
            'acquisition_date' => 'nullable|date',
            'acquisition_cost' => 'nullable|numeric',
            'unit_of_measure' => 'nullable|string|max:50',
            'quantity_per_physical_count' => 'required|integer|min:1',
            'fund' => 'nullable|string',
            'location_id' => 'required|exists:locations,id',
            'user_id' => 'required|exists:users,id',
            'condition' => 'required|string',
            'remarks' => 'nullable|string',
            'images' => 'nullable|array|max:4',
            'images.*' => 'image|max:25600',
        ]);

        $property->update([
            'property_number' => $request->property_number,
            'item_name' => $request->item_name,
            'item_description' => $request->item_description,
            'serial_no' => $request->serial_no,
            'model_no' => $request->model_no,
            'acquisition_date' => $request->acquisition_date,
            'acquisition_cost' => $request->acquisition_cost,
            'unit_of_measure' => $request->unit_of_measure,
            'quantity_per_physical_count' => $request->quantity_per_physical_count,
            'fund' => $request->fund,
            'location_id' => $request->location_id,
            'user_id' => $request->user_id,
            'condition' => $request->condition,
            'remarks' => $request->remarks,
        ]);

        if ($property->wasChanged('user_id')) {
            $this->notifyAssignee($property);
        }

        // Remove the cached QR code so it is regenerated with the updated details
        $cachedQr = storage_path('app/public/qrcodes/property_'.$property->id.'.png');
        if (file_exists($cachedQr)) {
            @unlink($cachedQr);
        }

        if ($request->remove_existing_images == '1') {
            foreach ($property->images as $image) {
                Uploads::disk()->delete($image->file_path);
                $image->delete();
            }
        }

        if ($request->hasFile('images')) {
            foreach ($request->file('images') as $image) {
                $filename = time().'_'.uniqid().'.'.$image->getClientOriginalExtension();
                $path = $image->storeAs('property_images', $filename, Uploads::diskName());
                $property->images()->create([
                    'file_path' => $path,
                ]);
            }
        }

        return redirect()->route('property.index')
            ->with('success', 'Property updated successfully!');
    }

    public function destroy(Property $property)
    {
        if ($property->excluded) {
            return redirect()->route('property.index')
                ->with('error', 'Property is already excluded.');
        }

        $property->update([
            'excluded' => 1,
            'active' => 0,
        ]);

        return redirect()->route('property.index')
            ->with('success', 'Property has been removed.');
    }

    /**
     * Users that can be assigned (MR) a property, with department and designation.
     * Admin accounts are left out, as in the old forms; the property's current
     * holder is always kept so editing never drops the assignment.
     */
    private function assignableUsers(?int $currentUserId = null)
    {
        return User::with(['department:id,name', 'designation:id,name'])
            ->where(function ($query) use ($currentUserId) {
                $query->whereDoesntHave('roles', fn ($roles) => $roles->where('slug', Role::SUPER_ADMIN));

                if ($currentUserId) {
                    $query->orWhere('id', $currentUserId);
                }
            })
            ->orderBy('name')
            ->get()
            ->map(fn ($user) => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'status' => (bool) $user->status,
                'department' => $user->department?->name,
                'designation' => $user->designation?->name,
            ])
            ->values();
    }
}
