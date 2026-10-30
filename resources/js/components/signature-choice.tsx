import { usePage } from '@inertiajs/react';
import { useState } from 'react';
import { SignatureUpload } from '@/components/signature-upload';
import { cn } from '@/lib/utils';
import type { SignatureType } from '@/types';

type Props = {
    value: SignatureType;
    onChange: (value: SignatureType) => void;
    name?: string;
    className?: string;
    /** E-signature terms the user must accept when choosing e-sign. */
    terms?: string[];
    agreed?: boolean;
    onAgreedChange?: (agreed: boolean) => void;
};

/**
 * E-signature vs. "SGD" (signed) choice used when requesting, approving,
 * issuing and receiving an RIS. E-sign needs an uploaded signature; without
 * one, it can be uploaded right here (and is then selected), so the form
 * being filled in isn't lost.
 */
export function SignatureChoice({
    value,
    onChange,
    name = 'signature_type',
    className,
    terms,
    agreed = false,
    onAgreedChange,
}: Props) {
    const { auth } = usePage().props;
    const signatureUrl = auth.user?.signature_url ?? null;
    const [uploading, setUploading] = useState(false);

    return (
        <fieldset className={cn('grid gap-3', className)}>
            <legend className="mb-2 text-sm font-medium">Signature type</legend>
            <div className="grid gap-2 sm:grid-cols-2">
                <label
                    className={cn(
                        'flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm',
                        value === 'esign' && 'border-primary bg-muted/50',
                        !signatureUrl && 'border-dashed',
                    )}
                    onClick={() => !signatureUrl && setUploading(true)}
                >
                    <input
                        type="radio"
                        name={name}
                        value="esign"
                        checked={value === 'esign'}
                        disabled={!signatureUrl}
                        onChange={() => onChange('esign')}
                        className="mt-0.5"
                    />
                    <span>
                        <span className="block font-medium">E-signature</span>
                        <span className="text-muted-foreground">
                            {signatureUrl
                                ? 'Use your uploaded signature'
                                : 'Upload your signature to use it'}
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
            {signatureUrl ? (
                value === 'esign' && (
                    <div className="grid gap-3">
                        <div className="rounded-md border bg-white p-3">
                            <img
                                src={signatureUrl}
                                alt="Your signature"
                                className="mx-auto max-h-16"
                            />
                        </div>
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
                                            onAgreedChange?.(
                                                event.target.checked,
                                            )
                                        }
                                    />
                                    <span>I agree to the above terms</span>
                                </label>
                            </div>
                        )}
                    </div>
                )
            ) : uploading ? (
                <div className="rounded-md border p-3">
                    <SignatureUpload
                        saveLabel="Save and use e-signature"
                        onUploaded={() => {
                            setUploading(false);
                            onChange('esign');
                        }}
                    />
                </div>
            ) : (
                <p className="text-xs text-muted-foreground">
                    No e-signature yet.{' '}
                    <button
                        type="button"
                        onClick={() => setUploading(true)}
                        className="font-medium text-foreground underline underline-offset-4"
                    >
                        Upload one now
                    </button>{' '}
                    to sign electronically.
                </p>
            )}
        </fieldset>
    );
}
