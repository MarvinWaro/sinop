import { useEffect, useRef } from 'react';

/**
 * "Open the New IAR form once you get there": a shortcut (the phone tab
 * bar's quick actions) marks what to open, then visits the page, and the
 * page opens it on arrival. Kept out of the URL so pagination and search
 * links don't carry it along.
 */
const KEY = 'sinop:open-on-arrival';

export function openOnArrival(target: string): void {
    try {
        sessionStorage.setItem(KEY, target);
    } catch {
        // Storage blocked: the page just opens as usual.
    }
}

function takeArrival(target: string): boolean {
    try {
        if (sessionStorage.getItem(KEY) === target) {
            sessionStorage.removeItem(KEY);

            return true;
        }
    } catch {
        // Storage blocked.
    }

    return false;
}

/** Runs `open` once when this page was opened by `openOnArrival(target)`. */
export function useOpenOnArrival(target: string, open: () => void): void {
    const checked = useRef(false);

    useEffect(() => {
        if (checked.current) {
            return;
        }

        checked.current = true;

        if (takeArrival(target)) {
            open();
        }
    }, [target, open]);
}
