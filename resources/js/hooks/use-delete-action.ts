import { router } from '@inertiajs/react';
import { useState } from 'react';

/**
 * State for a "confirm, then DELETE" flow: pick a row with `request(row)`,
 * render a ConfirmDialog while `target` is set, and call `confirm()`.
 */
export function useDeleteAction<T>(getUrl: (item: T) => string) {
    const [target, setTarget] = useState<T | null>(null);
    const [processing, setProcessing] = useState(false);

    const confirm = () => {
        if (target === null) {
            return;
        }

        router.delete(getUrl(target), {
            preserveScroll: true,
            onStart: () => setProcessing(true),
            onFinish: () => {
                setProcessing(false);
                setTarget(null);
            },
        });
    };

    return {
        target,
        processing,
        request: (item: T) => setTarget(item),
        cancel: () => setTarget(null),
        confirm,
    };
}
