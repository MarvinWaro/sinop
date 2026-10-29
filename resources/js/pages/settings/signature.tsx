import { Head, router, useForm, usePage } from '@inertiajs/react';
import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
    deleteMethod as deleteSignature,
    edit,
    upload,
} from '@/routes/signature';

export default function Signature() {
    const { auth } = usePage().props;
    const fileInput = useRef<HTMLInputElement>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [confirmRemove, setConfirmRemove] = useState(false);
    const [removing, setRemoving] = useState(false);

    const form = useForm<{ signature: File | null }>({ signature: null });

    const submit = (event: FormEvent) => {
        event.preventDefault();

        form.post(upload.url(), {
            preserveScroll: true,
            forceFormData: true,
            onSuccess: () => {
                form.reset();
                setPreview(null);

                if (fileInput.current) {
                    fileInput.current.value = '';
                }
            },
        });
    };

    const remove = () => {
        router.delete(deleteSignature.url(), {
            preserveScroll: true,
            onStart: () => setRemoving(true),
            onFinish: () => {
                setRemoving(false);
                setConfirmRemove(false);
            },
        });
    };

    return (
        <>
            <Head title="E-Signature" />

            <div className="space-y-6">
                <Heading
                    variant="small"
                    title="E-Signature"
                    description="Upload your signature to sign requisition and issue slips electronically"
                />

                <div className="grid gap-2">
                    <Label>Current signature</Label>
                    <div className="flex min-h-28 items-center justify-center rounded-md border bg-white p-4">
                        {auth.user.signature_url ? (
                            <img
                                src={auth.user.signature_url}
                                alt="Your signature"
                                className="max-h-24"
                            />
                        ) : (
                            <p className="text-sm text-muted-foreground">
                                No signature uploaded yet.
                            </p>
                        )}
                    </div>
                    {auth.user.signature_url && (
                        <div>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setConfirmRemove(true)}
                            >
                                Remove signature
                            </Button>
                        </div>
                    )}
                </div>

                <form onSubmit={submit} className="space-y-4">
                    <div className="grid gap-2">
                        <Label htmlFor="signature">Upload new signature</Label>
                        <input
                            ref={fileInput}
                            id="signature"
                            type="file"
                            accept="image/png,image/jpeg,image/jpg,image/gif"
                            onChange={(event) => {
                                const file = event.target.files?.[0] ?? null;
                                form.setData('signature', file);
                                setPreview(
                                    file ? URL.createObjectURL(file) : null,
                                );
                            }}
                            className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium"
                        />
                        <p className="text-xs text-muted-foreground">
                            PNG, JPG or GIF, up to 1 MB. A transparent PNG looks
                            best on printed forms.
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

                    <Button
                        type="submit"
                        disabled={!form.data.signature || form.processing}
                    >
                        Upload signature
                    </Button>
                </form>
            </div>

            <ConfirmDialog
                open={confirmRemove}
                onOpenChange={setConfirmRemove}
                title="Remove signature?"
                description="You will need to upload it again to e-sign requisition slips."
                confirmLabel="Remove"
                destructive
                processing={removing}
                onConfirm={remove}
            />
        </>
    );
}

Signature.layout = {
    breadcrumbs: [
        {
            title: 'E-Signature',
            href: edit(),
        },
    ],
};
