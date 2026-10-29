import { Head, useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import { FormField } from '@/components/form-field';
import Heading from '@/components/heading';
import { SearchableSelect } from '@/components/searchable-select';
import { Button } from '@/components/ui/button';
import { edit, update } from '@/routes/ris-signatory';

type Props = {
    /** The saved choice (a user id), or null when none was saved. */
    signatoryId: string | null;
    /** Who signs today, after the fallbacks. */
    current: { id: number | null; name: string; designation: string };
    users: {
        id: number;
        name: string;
        designation: string | null;
        department: string | null;
    }[];
};

/**
 * Settings › RIS signatory: the CAO whose name appears on RIS forms and who
 * approves manual (past) RIS entries. Used to be "the first active CAO".
 */
export default function RisSignatory({ signatoryId, current, users }: Props) {
    const form = useForm({
        user_id: signatoryId ?? (current.id ? String(current.id) : ''),
    });

    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.put(update.url(), { preserveScroll: true });
    };

    return (
        <>
            <Head title="RIS signatory" />

            <div className="space-y-6">
                <Heading
                    variant="small"
                    title="RIS signatory"
                    description="The Chief Administrative Officer who signs RIS forms and approves manual (past) RIS entries."
                />

                <div className="rounded-xl border bg-card px-5 py-4">
                    <p className="text-xs text-muted-foreground">
                        Signs RIS forms now
                    </p>
                    <p className="mt-1 text-lg font-semibold">{current.name}</p>
                    <p className="text-sm text-muted-foreground">
                        {current.designation}
                    </p>
                    {current.id === null && (
                        <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                            No active account is chosen, so the name the old
                            system used is shown. Pick the CAO below.
                        </p>
                    )}
                </div>

                <form onSubmit={submit} className="space-y-4">
                    <FormField
                        label="CAO signatory"
                        htmlFor="ris-signatory"
                        error={form.errors.user_id}
                        required
                    >
                        <SearchableSelect
                            id="ris-signatory"
                            value={form.data.user_id}
                            onChange={(value) => form.setData('user_id', value)}
                            placeholder="Choose a person"
                            options={users.map((user) => ({
                                value: String(user.id),
                                label: user.name,
                                description:
                                    [user.designation, user.department]
                                        .filter(Boolean)
                                        .join(' · ') || undefined,
                            }))}
                        />
                    </FormField>
                    <p className="text-xs text-muted-foreground">
                        Only active accounts are listed. Changing this doesn't
                        change slips that were already approved.
                    </p>
                    <Button
                        type="submit"
                        disabled={form.processing || form.data.user_id === ''}
                    >
                        Save signatory
                    </Button>
                </form>
            </div>
        </>
    );
}

RisSignatory.layout = {
    breadcrumbs: [{ title: 'RIS signatory', href: edit() }],
};
