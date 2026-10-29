/** Badge colour group of an action (App\Enums\ActivityAction::tone()). */
export type ActivityTone =
    | 'positive'
    | 'change'
    | 'negative'
    | 'output'
    | 'account'
    | 'neutral';

/** One activity log entry as Settings › Activity logs receives it. */
export type ActivityEntry = {
    id: string;
    user_id: number | null;
    actor_name: string;
    actor_role: string | null;
    /** The role's current name (Administrator, CAO, Supply and Procurement Officer…). */
    actor_role_label: string | null;
    department: string | null;
    module: string;
    module_label: string;
    action: string;
    action_label: string;
    tone: ActivityTone;
    subject_label: string | null;
    summary: string | null;
    /** Field => [before, after]. */
    changes: Record<string, [unknown, unknown]> | null;
    /** Item lines (`items`) and other details, such as export filters. */
    properties: Record<string, unknown> | null;
    ip_address: string | null;
    device: string | null;
    created_at: string;
};

export type ActivityFilters = {
    search: string;
    module: string;
    action: string;
    user: string;
    from: string;
    to: string;
};

export type ActivityOption = { value: string; label: string };
