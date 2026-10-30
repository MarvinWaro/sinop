/**
 * Small JSON helpers for the few AJAX endpoints that still return JSON
 * (next IAR/RIS numbers, IAR data, manual stock validation, saved
 * e-signatures, ...).
 * Everything else goes through Inertia's router/useForm.
 */

type QueryValue = string | number | boolean | null | undefined;

function xsrfToken(): string | null {
    const match = document.cookie
        .split('; ')
        .find((row) => row.startsWith('XSRF-TOKEN='));

    return match ? decodeURIComponent(match.split('=')[1] ?? '') : null;
}

function buildHeaders(withBody: boolean): HeadersInit {
    const headers: Record<string, string> = {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
    };

    const token = xsrfToken();

    if (token) {
        headers['X-XSRF-TOKEN'] = token;
    }

    if (withBody) {
        headers['Content-Type'] = 'application/json';
    }

    return headers;
}

export class HttpError extends Error {
    constructor(
        message: string,
        public status: number,
        public data: unknown,
    ) {
        super(message);
    }
}

async function handle<T>(response: Response): Promise<T> {
    const data: unknown = await response.json().catch(() => null);

    if (!response.ok) {
        const message =
            data && typeof data === 'object' && 'message' in data
                ? String((data as { message: unknown }).message)
                : `Request failed (${response.status})`;

        throw new HttpError(message, response.status, data);
    }

    return data as T;
}

export async function getJson<T>(
    url: string,
    query: Record<string, QueryValue> = {},
): Promise<T> {
    const params = new URLSearchParams();

    Object.entries(query).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
            params.set(key, String(value));
        }
    });

    const qs = params.toString();
    const response = await fetch(
        qs ? `${url}${url.includes('?') ? '&' : '?'}${qs}` : url,
        {
            method: 'GET',
            headers: buildHeaders(false),
            credentials: 'same-origin',
        },
    );

    return handle<T>(response);
}

async function sendJson<T>(
    method: 'POST' | 'PATCH' | 'DELETE',
    url: string,
    body?: unknown,
): Promise<T> {
    const response = await fetch(url, {
        method,
        headers: buildHeaders(body !== undefined),
        credentials: 'same-origin',
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    return handle<T>(response);
}

/** A multipart POST (file uploads); the answer is JSON. */
export async function postForm<T>(url: string, body: FormData): Promise<T> {
    const response = await fetch(url, {
        method: 'POST',
        headers: buildHeaders(false),
        credentials: 'same-origin',
        body,
    });

    return handle<T>(response);
}

export function postJson<T>(url: string, body: unknown = {}): Promise<T> {
    return sendJson<T>('POST', url, body);
}

export function patchJson<T>(url: string, body: unknown): Promise<T> {
    return sendJson<T>('PATCH', url, body);
}

export function deleteJson<T>(url: string): Promise<T> {
    return sendJson<T>('DELETE', url);
}
