<?php

namespace App\Models;

use App\Enums\ActivityAction;
use App\Enums\ActivityModule;
use App\Models\Concerns\LogsActivity;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Property extends Model
{
    use HasFactory, LogsActivity;

    protected $fillable = [
        'property_number',  // Added new field here
        'item_name',
        'item_description',
        'serial_no',
        'model_no',
        'acquisition_date',
        'acquisition_cost',
        'unit_of_measure',
        'quantity_per_physical_count',
        'fund',
        'location_id',
        'user_id',  // Changed from 'end_user_id'
        'condition',
        'remarks',
        'active',
        'excluded'
    ];

    protected $casts = [
        'acquisition_date' => 'date:Y-m-d',
    ];


    /**
     * Relationship: Property belongs to a Location
     */
    public function location()
    {
        return $this->belongsTo(Location::class);
    }

    public function images()
    {
        return $this->hasMany(PropertyImage::class);
    }

    public function user()
    {
        return $this->belongsTo(\App\Models\User::class, 'user_id');
    }

    public function activityModule(): ActivityModule
    {
        return ActivityModule::Properties;
    }

    public function activityActionFor(array $changes): ?ActivityAction
    {
        return $this->excludedRowAction($changes, 'property_number');
    }
}
