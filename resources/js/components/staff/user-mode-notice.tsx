import { usePage } from '@inertiajs/react';

/** Reminds admin-side users that they're in "user mode" on the requester pages. */
export function UserModeNotice() {
    const { auth } = usePage().props;

    if (!auth.isAdminUserMode) {
        return null;
    }

    return (
        <div className="rounded-md border border-dashed px-4 py-3 text-sm text-muted-foreground">
            You are in{' '}
            <span className="font-medium text-foreground">user mode</span>.
            Requests you make here go through the same approval as staff
            requests. Use the account menu to switch back.
        </div>
    );
}
