import { Head, router, usePage } from '@inertiajs/react';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import Heading from '@/components/heading';
import { SignatureUpload } from '@/components/signature-upload';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { deleteMethod as deleteSignature, edit } from '@/routes/signature';

export default function Signature() {
    const { auth } = usePage().props;
    const [confirmRemove, setConfirmRemove] = useState(false);
    const [removing, setRemoving] = useState(false);

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

                <SignatureUpload
                    label="Upload new signature"
                    saveLabel="Upload signature"
                />
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
