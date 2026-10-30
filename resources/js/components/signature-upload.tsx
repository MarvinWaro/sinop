import { useForm } from '@inertiajs/react';
import { useEffect, useId, useRef, useState } from 'react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { upload } from '@/routes/signature';

/**
 * Pick, preview and save the signature image used for e-signing.
 *
 * It has no <form> of its own and its button is type="button": it is shown
 * inside other forms (requesting, approving, issuing, receiving an RIS),
 * where a nested form would be invalid and would submit the outer one.
 */
export function SignatureUpload({
    onUploaded,
    label = 'Signature image',
    saveLabel = 'Save signature',
    className,
}: {
    onUploaded?: () => void;
    label?: string;
    saveLabel?: string;
    className?: string;
}) {
    const inputId = useId();
    const fileInput = useRef<HTMLInputElement>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const form = useForm<{ signature: File | null }>({ signature: null });

    // Free the previous preview image whenever it changes or this unmounts.
    useEffect(
        () => () => {
            if (preview) {
                URL.revokeObjectURL(preview);
            }
        },
        [preview],
    );

    const choose = (file: File | null) => {
        form.setData('signature', file);
        form.clearErrors();
        setPreview(file ? URL.createObjectURL(file) : null);
    };

    const save = () => {
        form.post(upload.url(), {
            forceFormData: true,
            preserveState: true,
            preserveScroll: true,
            onSuccess: () => {
                form.reset();
                setPreview(null);

                if (fileInput.current) {
                    fileInput.current.value = '';
                }

                onUploaded?.();
            },
        });
    };

    return (
        <div className={cn('grid gap-3', className)}>
            <div className="grid gap-2">
                <label htmlFor={inputId} className="text-sm font-medium">
                    {label}
                </label>
                <input
                    ref={fileInput}
                    id={inputId}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/gif"
                    onChange={(event) =>
                        choose(event.target.files?.[0] ?? null)
                    }
                    className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium"
                />
                <p className="text-xs text-muted-foreground">
                    PNG, JPG or GIF, up to 1 MB. A transparent PNG looks best on
                    printed forms.
                </p>
                <InputError message={form.errors.signature} />
            </div>

            {preview && (
                <div className="rounded-md border bg-white p-4">
                    <img
                        src={preview}
                        alt="New signature preview"
                        className="mx-auto max-h-24"
                    />
                </div>
            )}

            <div>
                <Button
                    type="button"
                    onClick={save}
                    disabled={!form.data.signature || form.processing}
                >
                    {form.processing && <Spinner />}
                    {saveLabel}
                </Button>
            </div>
        </div>
    );
}
