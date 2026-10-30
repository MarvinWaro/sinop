import { PenLine } from 'lucide-react';
import { lazy, Suspense, useState } from 'react';
import { SignatureBox } from '@/components/signature/signature-box';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import type {
    PlacedSignature,
    RisDocumentSource,
    SignatureType,
    SignStep,
} from '@/types';

// The signing preview, drawing pad and fonts load only when someone signs.
const SignatureStudio = lazy(
    () => import('@/components/signature/signature-studio'),
);

type Props = {
    value: SignatureType;
    onChange: (value: SignatureType) => void;
    /** Which box of the form this person signs. */
    step: SignStep;
    /** The form shown in the signing preview. */
    document: RisDocumentSource;
    /** The placed e-signature (sent as `signature`), null until placed. */
    signature: PlacedSignature | null;
    /** Also gives the signature image, for pages that draw the form. */
    onSignatureChange: (
        signature: PlacedSignature | null,
        url?: string,
    ) => void;
    /** A small picture of the placed signature (off when the page shows the form). */
    showPreview?: boolean;
    name?: string;
    className?: string;
    /** E-signature terms the user must accept when choosing e-sign. */
    terms?: string[];
    agreed?: boolean;
    onAgreedChange?: (agreed: boolean) => void;
};

/**
 * E-signature vs. "SGD" (signed) choice used when requesting, approving,
 * issuing and receiving an RIS. E-signature opens the signing preview,
 * where the person picks or creates a signature and places it in their box
 * on the form.
 */
export function SignatureChoice({
    value,
    onChange,
    step,
    document,
    signature,
    onSignatureChange,
    showPreview = true,
    name = 'signature_type',
    className,
    terms,
    agreed = false,
    onAgreedChange,
}: Props) {
    const [studioOpen, setStudioOpen] = useState(false);
    const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
    const placed = signature && signatureUrl ? signature : null;

    const chooseEsign = () => {
        onChange('esign');

        if (!placed) {
            setStudioOpen(true);
        }
    };

    return (
        <fieldset className={cn('grid gap-3', className)}>
            <legend className="mb-2 text-sm font-medium">Signature type</legend>
            <div className="grid gap-2 sm:grid-cols-2">
                <label
                    className={cn(
                        'flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm',
                        value === 'esign' && 'border-primary bg-muted/50',
                    )}
                >
                    <input
                        type="radio"
                        name={name}
                        value="esign"
                        checked={value === 'esign'}
                        onChange={chooseEsign}
                        className="mt-0.5"
                    />
                    <span>
                        <span className="block font-medium">E-signature</span>
                        <span className="text-muted-foreground">
                            Sign on the form with a saved signature
                        </span>
                    </span>
                </label>
                <label
                    className={cn(
                        'flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm',
                        value === 'sgd' && 'border-primary bg-muted/50',
                    )}
                >
                    <input
                        type="radio"
                        name={name}
                        value="sgd"
                        checked={value === 'sgd'}
                        onChange={() => onChange('sgd')}
                        className="mt-0.5"
                    />
                    <span>
                        <span className="block font-medium">SGD</span>
                        <span className="text-muted-foreground">
                            Mark as signed (manual)
                        </span>
                    </span>
                </label>
            </div>

            {value === 'esign' && (
                <div className="grid gap-3">
                    {placed ? (
                        <div className="flex items-center gap-3 rounded-md border p-2">
                            {showPreview && (
                                <div className="w-40 shrink-0 rounded-sm border border-neutral-300 bg-white">
                                    <SignatureBox
                                        step={step}
                                        paper
                                        signature={{
                                            url: signatureUrl!,
                                            placement: placed,
                                        }}
                                    />
                                </div>
                            )}
                            <p className="min-w-0 flex-1 text-sm text-muted-foreground">
                                Your signature is placed on the form.
                            </p>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setStudioOpen(true)}
                            >
                                Change
                            </Button>
                        </div>
                    ) : (
                        <Button
                            type="button"
                            variant="outline"
                            className="justify-start"
                            onClick={() => setStudioOpen(true)}
                        >
                            <PenLine />
                            Place your signature on the form
                        </Button>
                    )}

                    {terms && terms.length > 0 && (
                        <div className="rounded-md border bg-muted/30 p-3 text-sm">
                            <p className="font-medium">E-signature terms</p>
                            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted-foreground">
                                {terms.map((term) => (
                                    <li key={term}>{term}</li>
                                ))}
                            </ul>
                            <label className="mt-2 flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={agreed}
                                    onChange={(event) =>
                                        onAgreedChange?.(event.target.checked)
                                    }
                                />
                                <span>I agree to the above terms</span>
                            </label>
                        </div>
                    )}
                </div>
            )}

            {studioOpen && (
                <Suspense
                    fallback={
                        <span className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Spinner /> Opening the form…
                        </span>
                    }
                >
                    <SignatureStudio
                        open
                        onOpenChange={setStudioOpen}
                        step={step}
                        source={document}
                        value={placed}
                        onApply={(next, url) => {
                            setSignatureUrl(url);
                            onSignatureChange(next, url);
                        }}
                    />
                </Suspense>
            )}
        </fieldset>
    );
}

/** Whether a signing form can be sent: e-sign needs a placed signature. */
export function signatureReady(
    type: SignatureType,
    signature: PlacedSignature | null,
): boolean {
    return type === 'sgd' || signature !== null;
}

/** The first error about the placed signature (`signature`, `signature.id`…). */
export function signatureError(
    errors: Partial<Record<string, string>>,
): string | undefined {
    return Object.entries(errors).find(
        ([key]) => key === 'signature' || key.startsWith('signature.'),
    )?.[1];
}
