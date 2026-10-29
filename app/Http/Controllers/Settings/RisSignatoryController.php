<?php

namespace App\Http\Controllers\Settings;

use App\Enums\ActivityAction;
use App\Enums\ActivityModule;
use App\Http\Controllers\Controller;
use App\Models\AppSetting;
use App\Models\User;
use App\Services\ActivityRecorder;
use App\Support\RisSignatory;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Settings › RIS signatory: the CAO who signs RIS forms (and approves manual
 * RIS entries). Was "the first active user whose role is cao".
 */
class RisSignatoryController extends Controller
{
    public function edit(): Response
    {
        $current = RisSignatory::current();

        return Inertia::render('settings/ris-signatory', [
            'signatoryId' => AppSetting::get(AppSetting::RIS_CAO_SIGNATORY),
            'current' => $current,
            'users' => User::query()
                ->with(['designation:id,name', 'department:id,name'])
                ->where('status', true)
                ->orderBy('name')
                ->get(['id', 'name', 'designation_id', 'department_id'])
                ->map(fn (User $user): array => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'designation' => $user->designation?->name,
                    'department' => $user->department?->name,
                ]),
        ]);
    }

    public function update(Request $request, ActivityRecorder $recorder): RedirectResponse
    {
        $data = $request->validate([
            'user_id' => ['required', 'integer', 'exists:users,id'],
        ]);

        $before = RisSignatory::current()['name'];
        AppSetting::put(AppSetting::RIS_CAO_SIGNATORY, (string) $data['user_id']);
        $after = RisSignatory::current()['name'];

        if ($before !== $after) {
            $recorder->record(
                ActivityAction::Updated,
                ActivityModule::Settings,
                changes: ['signatory' => [$before, $after]],
                label: 'RIS CAO signatory',
            );
        }

        return back()->with('success', "{$after} now signs RIS forms as CAO.");
    }
}
