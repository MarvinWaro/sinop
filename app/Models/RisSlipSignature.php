<?php

namespace App\Models;

use App\Support\Uploads;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * The e-signature put on an RIS at one step, frozen at signing: its own copy
 * of the image and where it sits inside the signer's box (fractions of the
 * box; see App\Support\RisSignatureBox). Written by
 * App\Support\RisSignaturePlacement.
 *
 * @property int $id
 * @property int $ris_id
 * @property string $step requested, approved, issued or received
 * @property int|null $user_id
 * @property string $path
 * @property float $x
 * @property float $y
 * @property float $width
 * @property float $rotation
 * @property Carbon $signed_at
 */
class RisSlipSignature extends Model
{
    protected $guarded = ['id'];

    protected $hidden = ['path', 'ris_id', 'created_at', 'updated_at'];

    protected $appends = ['url'];

    protected function casts(): array
    {
        return [
            'x' => 'float',
            'y' => 'float',
            'width' => 'float',
            'rotation' => 'float',
            'signed_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<RisSlip, $this> */
    public function risSlip(): BelongsTo
    {
        return $this->belongsTo(RisSlip::class, 'ris_id', 'ris_id');
    }

    public function getUrlAttribute(): ?string
    {
        return Uploads::url($this->path);
    }
}
