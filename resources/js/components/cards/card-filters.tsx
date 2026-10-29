import { router } from '@inertiajs/react';
import { NativeSelect } from '@/components/ui/native-select';
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
            <NativeSelect
                value={String(selectedYear)}
                onChange={(e) => visit({ year: e.target.value, month: null })}
                className={cn('w-32', selectClassName)}
                aria-label="Year"
            >
                {availableYears.map((year) => (
                    <option key={year} value={year}>
                        Year {year}
                    </option>
                ))}
            </NativeSelect>
            {availableMonths.length > 0 && (
                <NativeSelect
                    value={selectedMonth ? String(selectedMonth) : ''}
                    onChange={(e) => visit({ month: e.target.value || null })}
                    className={cn('w-36', selectClassName)}
                    aria-label="Month"
                >
                    <option value="">All months</option>
                    {availableMonths.map((month) => (
                        <option key={month.value} value={month.value}>
                            {month.name}
                        </option>
                    ))}
                </NativeSelect>
            )}
            <NativeSelect
                value={fundCluster}
                onChange={(e) => visit({ fund_cluster: e.target.value })}
                className={cn('w-44', selectClassName)}
                aria-label="Fund cluster"
            >
                {clusters.map((fc) => (
                    <option key={fc} value={fc}>
                        Fund cluster {fc}
                    </option>
                ))}
            </NativeSelect>
        </div>
    );
}
