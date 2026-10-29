<?php

namespace App\Models;

use App\Enums\ActivityModule;
use App\Models\Concerns\LogsActivity;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Supplier extends Model
{
    use HasFactory, LogsActivity;

    protected $fillable = [
        'name',
        'email',
        'contact_number',
        'address',         // newly added
        'contact_person'   // newly added
    ];

    public function activityModule(): ActivityModule
    {
        return ActivityModule::Suppliers;
    }
}
