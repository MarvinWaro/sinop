import { usePage } from '@inertiajs/react';
import { useCallback } from 'react';

/**
 * `can('ris.approve')`: whether the signed-in user's roles allow it. For
 * showing menus and buttons only; the server checks every request itself.
 */
export function useCan(): (permission: string) => boolean {
    const { auth } = usePage().props;
    const permissions = auth.permissions;
    const isSuperAdmin = auth.isSuperAdmin;

    return useCallback(
        (permission: string) =>
            isSuperAdmin || (permissions ?? []).includes(permission),
        [isSuperAdmin, permissions],
    );
}
