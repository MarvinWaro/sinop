import { usePage } from '@inertiajs/react';
import { Check, RotateCcw, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import InputError from '@/components/input-error';
import { PlacementEditor } from '@/components/signature/placement-editor';
import { RisFormPreview } from '@/components/signature/ris-form-preview';
import { guardImage } from '@/components/signature/signature-box';
import SignatureCreatorDialog from '@/components/signature/signature-creator-dialog';
import { SignatureLibrary } from '@/components/signature/signature-library';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useSignatureLibrary } from '@/hooks/use-signature-library';
import { todayIso } from '@/lib/format';
import { getJson } from '@/lib/http';
import {
    clampPlacement,
    defaultPlacement,
    SIGN_STEP_LABELS,
} from '@/lib/signature-placement';
import { risKey } from '@/lib/ris';
import { document as risDocument } from '@/routes/ris';
import type {
    PlacedSignature,
    Placement,
    RisDocument,
    RisDocumentSource,
    SignStep,
    UserSignature,
} from '@/types';

/**
 * "Sign": the RIS form as it will print, the person's saved signatures and
 * a new-signature button. Pick a signature, then drag, resize or tilt it
 * inside your own box (the other boxes are locked) and apply. Loaded only
 * when someone signs (React.lazy in SignatureChoice).
 */
export default function SignatureStudio({
    open,
    onOpenChange,
    step,
    source,
    value,
    onApply,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    step: SignStep;
    source: RisDocumentSource;
    value: PlacedSignature | null;
    onApply: (signature: PlacedSignature, url: string) => void;
}) {
    const { auth } = usePage().props;
    const library = useSignatureLibrary();
    const document = useRisDocument(source, open);
    const [selectedId, setSelectedId] = useState<number | null>(
        value?.id ?? null,
    );
    const [placement, setPlacement] = useState<Placement | null>(value);
    const [ratio, setRatio] = useState(1 / 3);
    /** Until the signer moves it, a signature is sized to fit its box. */
    const [moved, setMoved] = useState(value !== null);
    const [creating, setCreating] = useState(false);

    const selected =
        library.signatures.find((signature) => signature.id === selectedId) ??
        null;

    // Start with the default signature, placed in the middle of the box.
    const hasSignatures = library.signatures.length > 0;

    useEffect(() => {
        if (selectedId === null && hasSignatures) {
            choose(
                library.signatures.find((signature) => signature.is_default) ??
                    library.signatures[0],
            );
        }
        // Only when the list first arrives.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hasSignatures]);

    function choose(signature: UserSignature) {
        setSelectedId(signature.id);
        setPlacement(defaultPlacement(step, ratio));
        setMoved(false);
    }

    const reset = () => {
        setPlacement(defaultPlacement(step, ratio));
        setMoved(false);
    };

    // The signer's name, designation and today's date in their box.
    const preview = useMemo<RisDocument | null>(
        () =>
            document && {
                ...document,
                signatories: {
                    ...document.signatories,
                    [step]: {
                        name: auth.user.name,
                        designation: auth.user.designation?.name ?? null,
                        date: todayIso(),
                        type: 'esign',
                        signature: null,
                    },
                },
            },
        [document, step, auth.user],
    );

    const apply = () => {
        if (selected && placement) {
            onApply(
                { id: selected.id, ...clampPlacement(step, placement, ratio) },
                selected.url,
            );
            onOpenChange(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex h-[94vh] flex-col gap-0 p-0 sm:max-w-[min(96vw,100rem)]">
                <DialogHeader className="border-b px-6 py-4">
                    <DialogTitle>Sign</DialogTitle>
                    <DialogDescription>
                        {SIGN_STEP_LABELS[step]}
                        {preview?.ris_no ? ` · ${preview.ris_no}` : ''}. Drag
                        your signature inside the highlighted box; use the
                        corners to resize and the round handle to tilt it.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_22rem] lg:overflow-hidden">
                    <div className="bg-muted/60 p-4 sm:p-6 lg:overflow-y-auto">
                        {preview ? (
                            <RisFormPreview
                                document={preview}
                                activeStep={step}
                                className="mx-auto max-w-5xl"
                                active={
                                    selected && placement ? (
                                        <PlacementEditor
                                            step={step}
                                            url={selected.url}
                                            ratio={ratio}
                                            placement={placement}
                                            onChange={(next) => {
                                                setMoved(true);
                                                setPlacement(next);
                                            }}
                                            onRatioChange={(next) => {
                                                setRatio(next);
                                                setPlacement((current) =>
                                                    current && moved
                                                        ? clampPlacement(
                                                              step,
                                                              current,
                                                              next,
                                                          )
                                                        : defaultPlacement(
                                                              step,
                                                              next,
                                                          ),
                                                );
                                            }}
                                        />
                                    ) : (
                                        <span className="absolute inset-0 flex items-center justify-center p-1 text-center text-[1.3cqw] text-sky-700">
                                            Pick a signature
                                        </span>
                                    )
                                }
                            />
                        ) : (
                            <Skeleton className="mx-auto aspect-[8.5/7] max-w-5xl" />
                        )}
                    </div>

                    <aside className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-5 overflow-x-hidden border-t p-4 sm:p-6 lg:overflow-y-auto lg:border-t-0 lg:border-l">
                        <section className="grid gap-3">
                            <div className="flex items-baseline justify-between">
                                <h3 className="text-sm font-medium">
                                    Your signatures
                                </h3>
                                <span className="text-xs text-muted-foreground">
                                    {library.signatures.length} of{' '}
                                    {library.limit}
                                </span>
                            </div>
                            {library.loading ? (
                                <div className="grid grid-cols-2 gap-3">
                                    <Skeleton className="aspect-[5/2]" />
                                    <Skeleton className="aspect-[5/2]" />
                                </div>
                            ) : (
                                <SignatureLibrary
                                    signatures={library.signatures}
                                    limit={library.limit}
                                    selectedId={selectedId}
                                    onSelect={choose}
                                    onNew={() => setCreating(true)}
                                />
                            )}
                            <InputError message={library.error ?? undefined} />
                        </section>

                        <section className="grid gap-2">
                            <h3 className="text-sm font-medium">
                                On this document
                            </h3>
                            {selected && placement ? (
                                <div className="flex items-center gap-2 rounded-md border p-2">
                                    <span className="flex h-9 w-16 shrink-0 items-center justify-center rounded bg-white">
                                        <img
                                            src={selected.url}
                                            alt=""
                                            {...guardImage}
                                            className="max-h-full max-w-full object-contain"
                                        />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm">
                                            {selected.name}
                                        </span>
                                        <span className="block text-xs text-muted-foreground">
                                            {SIGN_STEP_LABELS[step]}
                                        </span>
                                    </span>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="size-8"
                                        title="Back to the middle"
                                        aria-label="Put the signature back in the middle"
                                        onClick={reset}
                                    >
                                        <RotateCcw className="size-4" />
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="size-8 text-destructive"
                                        title="Remove"
                                        aria-label="Remove the signature from the form"
                                        onClick={() => {
                                            setSelectedId(null);
                                            setPlacement(null);
                                        }}
                                    >
                                        <Trash2 className="size-4" />
                                    </Button>
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground">
                                    Nothing yet. Pick one of your signatures, or
                                    create one.
                                </p>
                            )}
                            <p className="text-xs text-muted-foreground">
                                Keyboard: arrow keys move it (Shift for bigger
                                steps), + and − resize it, [ and ] tilt it.
                            </p>
                        </section>
                    </aside>
                </div>

                <DialogFooter className="border-t px-6 py-4">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        onClick={apply}
                        disabled={!selected || !placement}
                    >
                        <Check />
                        Apply signature
                    </Button>
                </DialogFooter>

                {creating && (
                    <SignatureCreatorDialog
                        open={creating}
                        onOpenChange={setCreating}
                        typedName={auth.user.name}
                        onCreate={async (signature) => {
                            const created = await library.add(signature);

                            if (created) {
                                choose(created);
                            }
                        }}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
}

/** The form to sign: the draft as given, or a saved slip fetched once. */
function useRisDocument(
    source: RisDocumentSource,
    open: boolean,
): RisDocument | null {
    const slip = 'slip' in source ? source.slip : null;
    const routeKey = slip?.route_key ?? null;
    const [loaded, setLoaded] = useState<{
        key: string;
        document: RisDocument;
    } | null>(null);

    useEffect(() => {
        if (!open || slip === null || loaded?.key === slip.route_key) {
            return;
        }

        let active = true;
        const key = slip.route_key;

        getJson<RisDocument>(risDocument.url(risKey(slip)))
            .then((document) => active && setLoaded({ key, document }))
            .catch(() => undefined);

        return () => {
            active = false;
        };
        // The slip object may be new on every render; its key is what counts.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, routeKey, loaded?.key]);

    if ('draft' in source) {
        return source.draft;
    }

    return loaded?.key === routeKey ? loaded.document : null;
}
