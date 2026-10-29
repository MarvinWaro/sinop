<?php

namespace App\Models;

use App\Enums\ActivityAction;
use App\Enums\ActivityModule;
use App\Models\Concerns\LogsActivity;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Location extends Model
{
    use HasFactory, LogsActivity;

    protected $fillable = ['location_name', 'active', 'excluded'];

    // Ensure location names are alphanumeric
    public static function rules()
    {
        return [
            'location_name' => 'required|string|regex:/^[a-zA-Z0-9\s]+$/|unique:locations,location_name|max:255',
        ];
    }

    public function activityModule(): ActivityModule
    {
        return ActivityModule::Locations;
    }

    public function activityActionFor(array $changes): ?ActivityAction
    {
        return $this->excludedRowAction($changes, 'location_name');
    }
}
