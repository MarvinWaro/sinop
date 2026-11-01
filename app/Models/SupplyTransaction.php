<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SupplyTransaction extends Model
{
    use HasFactory;

    public const RECEIPT = 'receipt';

    public const ISSUE = 'issue';

    public const ADJUSTMENT = 'adjustment';

    protected $primaryKey = 'transaction_id';

    protected $fillable = [
        'supply_id',
        'transaction_type',
        'transaction_date',
        'reference_no',
        'quantity',
        'unit_cost',
        'total_cost',
        'department_id',
        'user_id',
        'fund_cluster',
        'remarks',
        'requested_by',
        'received_by',
        'balance_quantity', // Added this field
    ];

    protected $casts = [
        'transaction_date' => 'date:Y-m-d',
        'unit_cost' => 'decimal:2',
        'total_cost' => 'decimal:2',
    ];

    /** @return BelongsTo<Supply, $this> */
    public function supply(): BelongsTo
    {
        return $this->belongsTo(Supply::class, 'supply_id');
    }

    /** @return BelongsTo<Department, $this> */
    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class, 'department_id');
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function users()
    {
        return $this->belongsToMany(User::class, 'user_transactions', 'transaction_id', 'user_id')
            ->withPivot('role')
            ->withTimestamps();
    }

    public function requesters()
    {
        return $this->users()->wherePivot('role', 'requester');
    }

    public function receivers()
    {
        return $this->users()->wherePivot('role', 'receiver');
    }
}
