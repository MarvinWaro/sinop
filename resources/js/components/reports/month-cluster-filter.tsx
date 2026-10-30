import { router } from '@inertiajs/react';
import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { FormSelect } from '@/components/form-select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { formatMonthKey } from '@/lib/format';

type Props = {
    /** Route the form submits to (GET). */
    url: string;
    /** "YYYY-MM" keys, newest first. */
    months: string[];
    month: string | null;
    fundClusters: string[];
    fundCluster: string | null;
    submitLabel?: ReactNode;
    submitVariant?: 'default' | 'secondary' | 'outline';
    /** Extra query params to keep (e.g. department_id). */
    extra?: Record<string, string | number | null | undefined>;
    /** Stack the fields vertically (for the index cards). */
    stacked?: boolean;
    idPrefix?: string;
    children?: ReactNode;
};

/** Month + fund cluster selectors shared by the RSMI pages. */
export function MonthClusterFilter({
    url,
    months,
    month,
    fundClusters,
    fundCluster,
    submitLabel = 'Apply filters',
    submitVariant = 'secondary',
    extra = {},
    stacked = false,
    idPrefix = 'filter',
    children,
}: Props) {
    const fallbackMonth = new Date().toISOString().slice(0, 7);
    const monthOptions = months.length > 0 ? months : [fallbackMonth];
    const [selectedMonth, setSelectedMonth] = useState(
        month && monthOptions.includes(month) ? month : monthOptions[0],
    );
    const [cluster, setCluster] = useState(fundCluster ?? '');

    const submit = (event: FormEvent) => {
        event.preventDefault();

        const query: Record<string, string | number> = { month: selectedMonth };

        if (cluster) {
            query.fund_cluster = cluster;
        }

        for (const [key, value] of Object.entries(extra)) {
            if (value !== null && value !== undefined && value !== '') {
                query[key] = value;
            }
        }

        router.get(url, query);
    };

    return (
        <form
            onSubmit={submit}
            className={cn(
                'grid gap-3',
                stacked
                    ? 'gap-4'
                    : 'items-end sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto]',
            )}
        >
            <div className="grid gap-2">
                <Label htmlFor={`${idPrefix}-month`}>Month</Label>
                <FormSelect
                    id={`${idPrefix}-month`}
                    value={selectedMonth}
                    onValueChange={(value) => setSelectedMonth(value)}
                    options={monthOptions.map((key) => ({
                        value: key,
                        label: formatMonthKey(key),
                    }))}
                />
            </div>
            <div className="grid gap-2">
                <Label htmlFor={`${idPrefix}-fund-cluster`}>Fund cluster</Label>
                <FormSelect
                    id={`${idPrefix}-fund-cluster`}
                    value={cluster}
                    onValueChange={(value) => setCluster(value)}
                    options={[
                        { value: '', label: 'All fund clusters' },
                        ...fundClusters.map((fc) => ({
                            value: fc,
                            label: `Fund cluster ${fc}`,
                        })),
                    ]}
                />
            </div>
            <div className={cn('flex flex-wrap gap-2', stacked && 'pt-2')}>
                <Button type="submit" variant={submitVariant}>
                    {submitLabel}
                </Button>
                {children}
            </div>
        </form>
    );
}
