<?php

namespace App\Models;

use App\Enums\ActivityModule;
use App\Models\Concerns\LogsActivity;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Category extends Model
{
    use HasFactory, LogsActivity;

    protected $fillable = [
        'name',
        'description',
    ];

    public function supplies()
    {
        return $this->hasMany(Supply::class, 'category_id');
    }

    public function activityModule(): ActivityModule
    {
        return ActivityModule::Categories;
    }
}
