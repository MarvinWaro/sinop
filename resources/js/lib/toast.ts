import { createElement, Fragment } from 'react';
import { toast as sonner } from 'sonner';
import type { ExternalToast } from 'sonner';
import { formatDayDateTime } from '@/lib/format';

type Message = Parameters<typeof sonner>[0];

/**
 * Adds when it happened ("Saturday, Oct 31, 2026 · 04:41 PM", Philippine
 * time) under the toast's text, after its own description if it has one.
 */
function stamped(options?: ExternalToast): ExternalToast {
    const time = createElement(
        'span',
        { className: 'toast-time' },
        formatDayDateTime(new Date().toISOString()),
    );
    const description =
        typeof options?.description === 'function'
            ? options.description()
            : options?.description;

    return {
        ...options,
        description: description
            ? createElement(Fragment, null, description, time)
            : time,
    };
}

/**
 * Sonner's `toast`, with the date, day and time on every message. Import it
 * from here instead of 'sonner'.
 */
export const toast = Object.assign(
    (message: Message, options?: ExternalToast) =>
        sonner(message, stamped(options)),
    sonner,
    {
        message: (message: Message, options?: ExternalToast) =>
            sonner.message(message, stamped(options)),
        success: (message: Message, options?: ExternalToast) =>
            sonner.success(message, stamped(options)),
        info: (message: Message, options?: ExternalToast) =>
            sonner.info(message, stamped(options)),
        warning: (message: Message, options?: ExternalToast) =>
            sonner.warning(message, stamped(options)),
        error: (message: Message, options?: ExternalToast) =>
            sonner.error(message, stamped(options)),
    },
);
