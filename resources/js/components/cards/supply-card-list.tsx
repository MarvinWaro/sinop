import { Link } from '@inertiajs/react';
import type { InertiaLinkProps } from '@inertiajs/react';
import { Eye, ScrollText } from 'lucide-react';
import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { DataPagination } from '@/components/data-pagination';
import { EmptyState } from '@/components/empty-state';
import { FormSelect } from '@/components/form-select';
import { useTypingPause, visitWithQuery } from '@/components/search-form';
import { SearchInput } from '@/components/search-input';
import { TablePanel } from '@/components/table-panel';
import { Button } from '@/components/ui/button';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { formatNumber } from '@/lib/format';
import type { Paginated, Supply } from '@/types';

export type SupplyWithStock = Supply & { total_stock: number | string | null };

type Props = {
    supplies: Paginated<SupplyWithStock>;
    fundClusters: string[];
    filters: { search?: string; fund_cluster?: string };
    indexUrl: string;
    cardHref: (supplyId: number) => NonNullable<InertiaLinkProps['href']>;
    viewLabel: string;
};

/** Supply list shared by the stock card and supply ledger card index pages. */
export function SupplyCardList({
    supplies,
    fundClusters,
    filters,
    indexUrl,
    cardHref,
    viewLabel,
}: Props) {
    const [search, setSearch] = useState(filters.search ?? '');
    const [fundCluster, setFundCluster] = useState(filters.fund_cluster ?? '');
    const pause = useTypingPause();
    // What the list is showing, so a pause or Enter doesn't reload it.
    const applied = useRef(
        `${(filters.search ?? '').trim()}|${filters.fund_cluster ?? ''}`,
    );

    // No button: typing applies once it pauses, a fund cluster right away.
    const visit = (nextSearch: string, nextCluster: string) => {
        pause.cancel();

        if (`${nextSearch}|${nextCluster}` === applied.current) {
            return;
        }

        applied.current = `${nextSearch}|${nextCluster}`;
        visitWithQuery(indexUrl, {
            search: nextSearch,
            fund_cluster: nextCluster,
        });
    };

    const apply = (event: FormEvent) => {
        event.preventDefault();
        visit(search.trim(), fundCluster);
    };

    return (
        <div className="space-y-4">
            <form
                onSubmit={apply}
                role="search"
                className="flex flex-col gap-2 sm:flex-row sm:justify-end"
            >
                <SearchInput
                    value={search}
                    onValueChange={(value) => {
                        setSearch(value);
                        pause.schedule(() => visit(value.trim(), fundCluster));
                    }}
                    onClear={() => {
                        setSearch('');
                        visit('', fundCluster);
                    }}
                    placeholder="Search item name or stock no..."
                    aria-label="Search supplies"
                    className="sm:w-72"
                />
                <FormSelect
                    value={fundCluster}
                    onValueChange={(value) => {
                        setFundCluster(value);
                        visit(search.trim(), value);
                    }}
                    className="sm:w-48"
                    aria-label="Fund cluster"
                    options={[
                        { value: '', label: 'All fund clusters' },
                        ...fundClusters.map((fc) => ({
                            value: fc,
                            label: `Fund cluster ${fc}`,
                        })),
                    ]}
                />
            </form>

            <TablePanel>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Stock no</TableHead>
                            <TableHead>Item name</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>Unit</TableHead>
                            <TableHead className="text-right">
                                Current stock
                            </TableHead>
                            <TableHead className="text-right">
                                Actions
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {supplies.data.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6}>
                                    <EmptyState
                                        icon={ScrollText}
                                        title="No supplies found"
                                    />
                                </TableCell>
                            </TableRow>
                        ) : (
                            supplies.data.map((supply) => (
                                <TableRow key={supply.supply_id}>
                                    <TableCell className="font-mono">
                                        {supply.stock_no}
                                    </TableCell>
                                    <TableCell className="whitespace-normal">
                                        <p className="font-medium">
                                            {supply.item_name}
                                        </p>
                                        {supply.description && (
                                            <p className="text-xs text-muted-foreground">
                                                {supply.description}
                                            </p>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {supply.category?.name ?? 'N/A'}
                                    </TableCell>
                                    <TableCell>
                                        {supply.unit_of_measurement}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        {formatNumber(supply.total_stock ?? 0)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button
                                            asChild
                                            variant="outline"
                                            size="sm"
                                        >
                                            <Link
                                                href={cardHref(
                                                    supply.supply_id,
                                                )}
                                            >
                                                <Eye />
                                                {viewLabel}
                                            </Link>
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </TablePanel>

            <DataPagination paginator={supplies} />
        </div>
    );
}
