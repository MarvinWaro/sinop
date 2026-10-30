import { useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import InputError from '@/components/input-error';
import { SignatureChoice } from '@/components/signature-choice';
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
import type { RisSlip, SignatureType } from '@/types';

/** Confirm receipt of issued supplies, with the receiver's signature choice. */
export function ReceiveDialog({
    requisition,
    onClose,
}: {
    requisition: RisSlip | null;
    onClose: () => void;
}) {
    const form = useForm<{ signature_type: SignatureType }>({
        signature_type: 'sgd',
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
                    <SignatureChoice
                        value={form.data.signature_type}
                        onChange={(value) =>
                            form.setData('signature_type', value)
                        }
                    />
                    <InputError message={form.errors.signature_type} />
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={form.processing}>
                            Confirm receipt
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
