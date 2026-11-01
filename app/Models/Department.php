<?php

namespace App\Models;

use App\Enums\ActivityModule;
use App\Models\Concerns\LogsActivity;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Department extends Model
{
    use HasFactory;
    use LogsActivity;

    protected $fillable = [
        'name',
    ];

    public function activityModule(): ActivityModule
    {
        return ActivityModule::Divisions;
    }
}
