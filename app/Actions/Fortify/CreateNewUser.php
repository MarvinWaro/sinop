<?php

namespace App\Actions\Fortify;

use App\Concerns\PasswordValidationRules;
use App\Models\User;
use App\Rules\ChedEmailRule;
use App\Services\ActivityRecorder;
use App\Services\Notifier;
use Illuminate\Support\Facades\Validator;
use Laravel\Fortify\Contracts\CreatesNewUsers;

class CreateNewUser implements CreatesNewUsers
{
    use PasswordValidationRules;

    /**
     * Validate and create a newly registered user.
     *
     * New accounts are created inactive and must be activated by an
     * administrator before the user can sign in (same as the Jetstream version).
     *
     * @param  array<string, string>  $input
     */
    public function create(array $input): User
    {
        Validator::make($input, [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users', new ChedEmailRule],
            'password' => $this->passwordRules(),
            'department_id' => ['required', 'exists:departments,id'],
            'designation_id' => ['required', 'exists:designations,id'],
        ])->validate();

        $user = User::create([
            'name' => $input['name'],
            'email' => $input['email'],
            'password' => $input['password'],
            'department_id' => $input['department_id'],
            'designation_id' => $input['designation_id'],
            'status' => false,
        ]);

        // Tell whoever can activate it (the entry its own save logged).
        app(Notifier::class)->accountRequested(app(ActivityRecorder::class)->latestFor($user));

        return $user;
    }
}
