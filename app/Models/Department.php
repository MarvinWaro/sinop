<?php

namespace App\Models;

use App\Enums\ActivityModule;
use App\Models\Concerns\LogsActivity;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Department extends Model
{
    use LogsActivity;


    use HasFactory;

    protected $fillable = [
        'name',
    ];

    public function activityModule(): ActivityModule
    {
        return ActivityModule::Divisions;
    }
}
