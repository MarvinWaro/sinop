<?php

namespace App\Http\Resources;

use App\Models\Notification;
use App\Support\Uploads;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * One notification as the bell and the Notifications page show it. Load
 * NotificationInbox::RELATIONS first.
 *
 * @mixin Notification
 */
class NotificationResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $kind = $this->kind;
        $activity = $this->activity;
        $actor = $activity?->user;

        return [
            'id' => $this->id,
            'kind' => [
                'code' => $kind->value,
                'label' => $kind->label(),
                'tone' => $kind->tone(),
            ],
            'module' => [
                'code' => $kind->module()->value,
                'label' => $kind->module()->label(),
            ],
            'actor' => $kind->showsActor() && $activity !== null ? [
                'name' => $activity->actor_name,
                'avatar' => Uploads::url($actor?->profile_photo_path),
            ] : null,
            'sentence' => $this->sentence(),
            'read_at' => $this->read_at?->toIso8601ZuluString(),
            'created_at' => $this->created_at->toIso8601ZuluString(),
        ];
    }

    /**
     * The sentence split around the record's name, so the page can show
     * the name in bold: "approved your" · "RIS 2026-10-118" · "".
     *
     * @return array{before: string, subject: string|null, after: string}
     */
    private function sentence(): array
    {
        $parts = explode(':subject', $this->kind->sentence(), 2);

        return [
            'before' => trim($parts[0]),
            'subject' => count($parts) === 2 ? ($this->resource->subjectLabel() ?? 'a record') : null,
            'after' => trim($parts[1] ?? ''),
        ];
    }
}
