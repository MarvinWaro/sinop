<?php

namespace App\Models;

use App\Enums\ActivityAction;
use App\Enums\ActivityModule;
use App\Models\Concerns\LogsActivity;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Supply extends Model
{
    use LogsActivity;

    protected $primaryKey = 'supply_id';

    protected $fillable = [
        'stock_no',
        'item_name',
        'description',
        'unit_of_measurement',
        'category_id',
        'reorder_point',
        'acquisition_cost',
        'is_active'
    ];

    protected $casts = [
        'acquisition_cost' => 'decimal:2',
        'reorder_point' => 'integer',
        'is_active' => 'boolean',
    ];

    /**
     * Mutator to automatically convert item_name to uppercase when saving
     */
    public function setItemNameAttribute($value)
    {
        $this->attributes['item_name'] = strtoupper($value);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class, 'category_id');
    }

    /**
     * Get the stock records for this supply
     */
    public function stocks()
    {
        return $this->hasMany(SupplyStock::class, 'supply_id', 'supply_id');
    }

    public function activityModule(): ActivityModule
    {
        return ActivityModule::Supplies;
    }

    public function activityActionFor(array $changes): ?ActivityAction
    {
        // Switching a supply on or off on its own reads as that, not an edit.
        if (array_keys($changes) === ['is_active']) {
            return $changes['is_active'][1] ? ActivityAction::Activated : ActivityAction::Deactivated;
        }

        return null;
    }
}
