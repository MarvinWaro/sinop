import { router } from '@inertiajs/react';
import { useEffect } from 'react';
import { toast } from 'sonner';
import type { FlashToast } from '@/types/ui';

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

            messages.forEach((data) => {
                (toast[data.type] ?? toast)(data.message);
            });
        });
    }, []);
}
