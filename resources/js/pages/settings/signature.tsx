import { Head, usePage } from '@inertiajs/react';
import { lazy, Suspense, useState } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import { SignatureLibrary } from '@/components/signature/signature-library';
import { useSignatureLibrary } from '@/hooks/use-signature-library';
import { edit } from '@/routes/signature';
import type { UserSignature } from '@/types';

// The drawing pad and handwriting fonts load only when they are needed.
const SignatureCreatorDialog = lazy(
    () => import('@/components/signature/signature-creator-dialog'),
);

export default function Signature({
    signatures,
    limit,
}: {
    signatures: UserSignature[];
    limit: number;
}) {
    const { auth } = usePage().props;
    const library = useSignatureLibrary({ signatures, limit });
    const [creating, setCreating] = useState(false);
    const [removing, setRemoving] = useState<UserSignature | null>(null);
    const [busy, setBusy] = useState(false);

    const run = async (action: () => Promise<unknown>) => {
        setBusy(true);

        try {
            await action();
        } catch {
            // Shown below the list (library.error).
        } finally {
            setBusy(false);
        }
    };

    return (
        <>
            <Head title="E-Signature" />

            <div className="space-y-6">
                <Heading
                    variant="small"
                    title="E-Signature"
                    description={`Draw, type or upload up to ${library.limit} signatures for signing requisition and issue slips. The default one is picked first when you sign.`}
                />

                <SignatureLibrary
                    signatures={library.signatures}
                    limit={library.limit}
                    busy={busy}
                    onNew={() => setCreating(true)}
                    onMakeDefault={(signature) =>
                        run(() => library.makeDefault(signature.id))
                    }
                    onDelete={setRemoving}
                    className="sm:grid-cols-3"
                />
                <InputError message={library.error ?? undefined} />

                <p className="text-sm text-muted-foreground">
                    Requisitions you already signed keep the signature you used,
                    even if you change or delete it here.
                </p>
            </div>

            {creating && (
                <Suspense>
                    <SignatureCreatorDialog
                        open={creating}
                        onOpenChange={setCreating}
                        typedName={auth.user.name}
                        onCreate={library.add}
                    />
                </Suspense>
            )}

            <ConfirmDialog
                open={removing !== null}
                onOpenChange={(open) => !open && setRemoving(null)}
                title="Delete this signature?"
                description="Requisitions you already signed with it keep it."
                confirmLabel="Delete"
                destructive
                processing={busy}
                onConfirm={() =>
                    removing &&
                    run(async () => {
                        await library.remove(removing.id);
                        setRemoving(null);
                    })
                }
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
