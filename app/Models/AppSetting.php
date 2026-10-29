<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * A setting chosen in the app (key/value), e.g. the CAO who signs RIS forms.
 *
 * @property string $key
 * @property string|null $value
 */
class AppSetting extends Model
{
    public const RIS_CAO_SIGNATORY = 'ris.cao_signatory_user_id';

    protected $primaryKey = 'key';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = ['key', 'value'];

    public static function get(string $key, ?string $default = null): ?string
    {
        return static::query()->whereKey($key)->value('value') ?? $default;
    }

    public static function put(string $key, ?string $value): void
    {
        static::query()->updateOrCreate(['key' => $key], ['value' => $value]);
    }
}
