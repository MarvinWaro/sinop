import { router } from '@inertiajs/react';
import { PencilLine, Trash2 } from 'lucide-react';
import { createElement, useEffect } from 'react';
import { toast } from '@/lib/toast';
import type { FlashToast } from '@/types/ui';

/**
 * What a success message is about, from its wording ("… deleted",
 * "… updated"), so it gets that kind's colour and icon: green for done,
 * blue for changed, red for removed (see the toast styles in app.css).
 */
function kindOf(data: FlashToast): FlashToast['type'] {
    if (data.type !== 'success') {
        return data.type;
    }

    if (/\b(deleted|removed)\b/i.test(data.message)) {
        return 'deleted';
    }

    return /\b(updated|saved|changed)\b/i.test(data.message)
        ? 'updated'
        : 'success';
}

function show(data: FlashToast): void {
    switch (kindOf(data)) {
        case 'deleted':
            toast.success(data.message, {
                className: 'toast-deleted',
                icon: createElement(Trash2, { className: 'size-4' }),
            });
            break;
        case 'updated':
            toast.success(data.message, {
                className: 'toast-updated',
                icon: createElement(PencilLine, { className: 'size-4' }),
            });
            break;
        case 'error':
            toast.error(data.message);
            break;
        case 'warning':
            toast.warning(data.message);
            break;
        case 'info':
            toast.info(data.message);
            break;
        default:
            toast.success(data.message);
    }
}

/**
 * Shows sonner toasts for flash data. Controllers can use the starter kit's
 * `Inertia::flash('toast', [...])`; the old `->with('success', ...)` style
 * messages are converted to `toasts` by HandleInertiaRequests.
 */
export function useFlashToast(): void {
    useEffect(() => {
        return router.on('flash', (event) => {
            const flash = (event as CustomEvent).detail?.flash;

            if (!flash) {
                return;
            }

            const messages: FlashToast[] = [];

            if (flash.toast) {
                messages.push(flash.toast as FlashToast);
            }

            if (Array.isArray(flash.toasts)) {
                messages.push(...(flash.toasts as FlashToast[]));
            }

            messages.forEach(show);
        });
    }, []);
}
