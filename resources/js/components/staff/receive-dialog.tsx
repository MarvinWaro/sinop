import { useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import InputError from '@/components/input-error';
import {
    signatureError,
    SignatureChoice,
    signatureReady,
} from '@/components/signature-choice';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { risKey } from '@/lib/ris';
import { receive } from '@/routes/ris';
import type { PlacedSignature, RisSlip, SignatureType } from '@/types';

/** Confirm receipt of issued supplies, with the receiver's signature choice. */
export function ReceiveDialog({
    requisition,
    onClose,
}: {
    requisition: RisSlip | null;
    onClose: () => void;
}) {
    const form = useForm<{
        signature_type: SignatureType;
        signature: PlacedSignature | null;
    }>({
        signature_type: 'sgd',
        signature: null,
    });

    const submit = (event: FormEvent) => {
        event.preventDefault();

        if (!requisition) {
            return;
        }

        form.post(receive.url(risKey(requisition)), {
            preserveScroll: true,
            onSuccess: () => onClose(),
        });
    };

    return (
        <Dialog
            open={requisition !== null}
            onOpenChange={(open: boolean) => !open && onClose()}
        >
            <DialogContent>
                <form onSubmit={submit} className="grid gap-4">
                    <DialogHeader>
                        <DialogTitle>Confirm receipt</DialogTitle>
                        <DialogDescription>
                            Confirm that you received the supplies for{' '}
                            {requisition?.ris_no}.
                        </DialogDescription>
                    </DialogHeader>
                    {requisition && (
                        <SignatureChoice
                            value={form.data.signature_type}
                            onChange={(value) =>
                                form.setData('signature_type', value)
                            }
                            step="received"
                            document={{ slip: requisition }}
                            signature={form.data.signature}
                            onSignatureChange={(signature) =>
                                form.setData('signature', signature)
                            }
                        />
                    )}
                    <InputError
                        message={
                            form.errors.signature_type ??
                            signatureError(form.errors)
                        }
                    />
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={
                                form.processing ||
                                !signatureReady(
                                    form.data.signature_type,
                                    form.data.signature,
                                )
                            }
                        >
                            Confirm receipt
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
