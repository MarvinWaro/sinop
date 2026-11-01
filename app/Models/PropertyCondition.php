<?php

namespace App\Models;

use App\Enums\ActivityModule;
use App\Models\Concerns\LogsActivity;
use Illuminate\Database\Eloquent\Model;

/**
 * A condition a property can be in: Serviceable, Unserviceable, or one an
 * admin typed in the property form. Properties store the name.
 *
 * @property int $id
 * @property string $name
 */
class PropertyCondition extends Model
{
    use LogsActivity;

    /** Counted on the assets overview, so never renamed or deleted. */
    public const BUILT_IN = ['Serviceable', 'Unserviceable'];

    protected $fillable = ['name'];

    public function isBuiltIn(): bool
    {
        return in_array(mb_strtolower($this->name), array_map('mb_strtolower', self::BUILT_IN), true);
    }

    public function activityModule(): ActivityModule
    {
        return ActivityModule::Properties;
    }

    /**
     * The listed spelling of a condition, adding it when it's new:
     * "serviceable" → "Serviceable"; "for repair" → "For repair" (added).
     */
    public static function resolve(string $name): string
    {
        $name = trim((string) preg_replace('/\s+/', ' ', $name));

        $existing = static::query()
            ->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])
            ->value('name');

        return $existing ?? static::query()->create([
            'name' => mb_strtoupper(mb_substr($name, 0, 1)).mb_substr($name, 1),
        ])->name;
    }
}
