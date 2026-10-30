import { useCallback, useEffect, useState } from 'react';
import {
    deleteJson,
    getJson,
    HttpError,
    patchJson,
    postForm,
} from '@/lib/http';
import {
    destroy,
    index,
    makeDefault as makeDefaultRoute,
    store,
} from '@/routes/signatures';
import type { UserSignature } from '@/types';

type Library = { signatures: UserSignature[]; limit: number };

export type NewSignature = {
    file: Blob;
    name: string;
    source: UserSignature['source'];
    makeDefault: boolean;
};

/**
 * The signed-in person's saved e-signatures (JSON endpoints, so adding one
 * in the middle of signing doesn't reload the page). Pass the list the page
 * already has to skip the first fetch.
 */
export function useSignatureLibrary(initial?: Library) {
    const [library, setLibrary] = useState<Library | null>(initial ?? null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (initial) {
            return;
        }

        let active = true;

        getJson<Library>(index.url())
            .then((data) => active && setLibrary(data))
            .catch(
                (failure: Error) =>
                    active &&
                    setError(failure.message || 'Could not load signatures.'),
            );

        return () => {
            active = false;
        };
        // Loaded once per mount; later changes come back from each action.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const run = useCallback(
        async <T extends Library>(request: Promise<T>): Promise<T> => {
            setError(null);

            try {
                const data = await request;
                setLibrary({ signatures: data.signatures, limit: data.limit });

                return data;
            } catch (failure) {
                setError(messageOf(failure));
                throw failure;
            }
        },
        [],
    );

    const add = useCallback(
        async ({ file, name, source, makeDefault }: NewSignature) => {
            const body = new FormData();
            body.append('file', file, 'signature.png');
            body.append('name', name);
            body.append('source', source);
            body.append('make_default', makeDefault ? '1' : '0');

            const data = await run(
                postForm<Library & { created: number }>(store.url(), body),
            );

            return data.signatures.find(
                (signature) => signature.id === data.created,
            );
        },
        [run],
    );

    const makeDefault = useCallback(
        (id: number) => run(patchJson<Library>(makeDefaultRoute.url(id), {})),
        [run],
    );

    const remove = useCallback(
        (id: number) => run(deleteJson<Library>(destroy.url(id))),
        [run],
    );

    return {
        signatures: library?.signatures ?? [],
        limit: library?.limit ?? 10,
        loading: library === null && error === null,
        error,
        add,
        makeDefault,
        remove,
    };
}

/** The first validation message, or the request's own message. */
function messageOf(failure: unknown): string {
    if (failure instanceof HttpError && failure.data) {
        const errors = (failure.data as { errors?: Record<string, string[]> })
            .errors;
        const first = errors ? Object.values(errors)[0]?.[0] : undefined;

        if (first) {
            return first;
        }
    }

    return failure instanceof Error ? failure.message : 'Something went wrong.';
}
