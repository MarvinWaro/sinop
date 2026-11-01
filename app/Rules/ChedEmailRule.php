<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Translation\PotentiallyTranslatedString;

class ChedEmailRule implements ValidationRule
{
    /**
     * Run the validation rule.
     *
     * @param  Closure(string, ?string=): PotentiallyTranslatedString  $fail
     */
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        // Check if the email ends with @ched.gov.ph
        if (! preg_match('/^[a-zA-Z0-9._%+-]+@ched\.gov\.ph$/', $value)) {
            $fail('The :attribute must be a valid @ched.gov.ph email address.');
        }
    }
}
