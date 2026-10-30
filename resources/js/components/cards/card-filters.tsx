import { router } from '@inertiajs/react';
import { FormSelect } from '@/components/form-select';
import { cn } from '@/lib/utils';

type Props = {
    url: string;
    availableYears: (number | string)[];
    selectedYear: number;
    availableMonths: { value: number; name: string }[];
    selectedMonth: number | null;
    fundClusters: string[];
    fundCluster: string;
    /** Extra classes for each select, e.g. to sit on a coloured banner. */
    selectClassName?: string;
};

/** Year / month / fund cluster selectors for the stock and ledger cards. */
export function CardFilters({
    url,
    availableYears,
    selectedYear,
    availableMonths,
    selectedMonth,
    fundClusters,
    fundCluster,
    selectClassName,
}: Props) {
    const visit = (params: {
        year?: number | string;
        month?: number | string | null;
        fund_cluster?: string;
    }) => {
        const query: Record<string, string | number> = {
            year: params.year ?? selectedYear,
            fund_cluster: params.fund_cluster ?? fundCluster,
        };
        const month = params.month === undefined ? selectedMonth : params.month;

        if (month) {
            query.month = month;
        }

        router.get(url, query, {
            preserveScroll: true,
            preserveState: true,
            replace: true,
        });
    };

    const clusters = fundClusters.includes(fundCluster)
        ? fundClusters
        : [fundCluster, ...fundClusters];

    return (
        <div className="flex flex-wrap gap-2">
            <FormSelect
                value={String(selectedYear)}
                onValueChange={(value) => visit({ year: value, month: null })}
                className={cn('w-32', selectClassName)}
                aria-label="Year"
                options={availableYears.map((year) => ({
                    value: year,
                    label: `Year ${year}`,
                }))}
            />
            {availableMonths.length > 0 && (
                <FormSelect
                    value={selectedMonth ? String(selectedMonth) : ''}
                    onValueChange={(value) => visit({ month: value || null })}
                    className={cn('w-36', selectClassName)}
                    aria-label="Month"
                    options={[
                        { value: '', label: 'All months' },
                        ...availableMonths.map((month) => ({
                            value: month.value,
                            label: month.name,
                        })),
                    ]}
                />
            )}
            <FormSelect
                value={fundCluster}
                onValueChange={(value) => visit({ fund_cluster: value })}
                className={cn('w-44', selectClassName)}
                aria-label="Fund cluster"
                options={clusters.map((fc) => ({
                    value: fc,
                    label: `Fund cluster ${fc}`,
                }))}
            />
        </div>
    );
}
