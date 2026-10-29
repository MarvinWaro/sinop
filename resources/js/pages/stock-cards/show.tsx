import { Head } from '@inertiajs/react';
import { CardFilters } from '@/components/cards/card-filters';
import {
    SupplyCardBanner,
    onBanner,
} from '@/components/cards/supply-card-banner';
import type { SupplyCardNavigation } from '@/components/cards/supply-card-banner';
import {
    SupplyCardStats,
    balanceStatus,
} from '@/components/cards/supply-card-stats';
import {
    cardTableHead,
    columnTones as tone,
} from '@/components/cards/column-tones';
import { PageContainer } from '@/components/page-header';
import { TablePanel } from '@/components/table-panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { useCan } from '@/hooks/use-can';
import { formatDate, formatNumber, monthNames, toNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
    exportExcel,
    exportPdf,
    index as stockCardsIndex,
    show as showStockCard,
} from '@/routes/stock-cards';
import type { Supply } from '@/types';

type Entry = {
    date: string;
    reference: string;
    receipt_qty: number | null;
    issue_qty: number | null;
    issue_office: string | null;
    balance_qty: number;
    days_to_consume: number | null;
    transaction_id: number | null;
};

type Props = {
    supply: Supply;
    stockCardEntries: Entry[];
    fundClusters: string[];
    fundCluster: string;
    currentStock: number | string;
    availableYears: (number | string)[];
    selectedYear: number;
    availableMonths: { value: number; name: string }[];
    selectedMonth: number | null;
    navigation: SupplyCardNavigation;
};

export default function StockCardShow(props: Props) {
    const can = useCan();
    const { supply, stockCardEntries: entries } = props;
    const query = {
        fund_cluster: props.fundCluster,
        year: props.selectedYear,
        ...(props.selectedMonth ? { month: props.selectedMonth } : {}),
    };
    const period = props.selectedMonth
        ? `${monthNames[props.selectedMonth - 1]} ${props.selectedYear}`
        : String(props.selectedYear);
    const status = balanceStatus(props.currentStock, supply.reorder_point);
    // Totals of the rows shown for the selected period (display only).
    const received = entries.reduce(
        (sum, entry) => sum + toNumber(entry.receipt_qty),
        0,
    );
    const issued = entries.reduce(
        (sum, entry) => sum + toNumber(entry.issue_qty),
        0,
    );

    return (
        <>
            <Head title={`Stock card – ${supply.item_name}`} />
            <PageContainer>
                <SupplyCardBanner
                    eyebrow="Stock card · Appendix 58"
                    supply={supply}
                    navigation={props.navigation}
                    hrefFor={(supplyId) =>
                        showStockCard(supplyId, {
                            query: { fund_cluster: props.fundCluster },
                        })
                    }
                    filters={
                        <CardFilters
                            url={showStockCard.url(supply.supply_id)}
                            availableYears={props.availableYears}
                            selectedYear={props.selectedYear}
                            availableMonths={props.availableMonths}
                            selectedMonth={props.selectedMonth}
                            fundClusters={props.fundClusters}
                            fundCluster={props.fundCluster}
                            selectClassName={onBanner.select}
                        />
                    }
                    actions={
                        can('stock-cards.export') && (
                            <>
                                <Button
                                    asChild
                                    size="sm"
                                    className={onBanner.solid}
                                >
                                    <a
                                        href={exportPdf.url(supply.supply_id, {
                                            query,
                                        })}
                                    >
                                        Export PDF
                                    </a>
                                </Button>
                                <Button
                                    asChild
                                    size="sm"
                                    className={onBanner.solid}
                                >
                                    <a
                                        href={exportExcel.url(
                                            supply.supply_id,
                                            {
                                                query,
                                            },
                                        )}
                                    >
                                        Export Excel
                                    </a>
                                </Button>
                            </>
                        )
                    }
                />

                <SupplyCardStats
                    tiles={[
                        {
                            label: 'Unit',
                            value: supply.unit_of_measurement,
                        },
                        {
                            label: 'Category',
                            value: (
                                <span title={supply.category?.name}>
                                    {supply.category?.name ?? 'N/A'}
                                </span>
                            ),
                        },
                        {
                            label: 'Current balance',
                            value: formatNumber(props.currentStock),
                            tone: status.tone,
                            hint: status.label,
                        },
                        {
                            label: 'Received',
                            value: formatNumber(received),
                            hint: period,
                        },
                        {
                            label: 'Issued',
                            value: formatNumber(issued),
                            hint: period,
                        },
                    ]}
                />

                <section className="space-y-3">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <h2 className="text-base font-semibold">
                                Stock card · {period}
                            </h2>
                            <p className="text-sm text-muted-foreground">
                                Entity name: COMMISSION ON HIGHER EDUCATION
                                REGIONAL OFFICE XII · Fund cluster{' '}
                                {props.fundCluster}
                            </p>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {formatNumber(entries.length)} entries
                        </p>
                    </div>
                    <TablePanel>
                        <Table>
                            <TableHeader className={cardTableHead}>
                                <TableRow>
                                    <TableHead rowSpan={2}>Date</TableHead>
                                    <TableHead rowSpan={2}>Reference</TableHead>
                                    <TableHead
                                        rowSpan={2}
                                        className={cn(
                                            'border-l text-right',
                                            tone.receipt.head,
                                        )}
                                    >
                                        Receipt qty.
                                    </TableHead>
                                    <TableHead
                                        colSpan={2}
                                        className={cn(
                                            'border-l text-center',
                                            tone.issue.head,
                                        )}
                                    >
                                        Issue
                                    </TableHead>
                                    <TableHead
                                        rowSpan={2}
                                        className={cn(
                                            'border-l text-right',
                                            tone.balance.head,
                                        )}
                                    >
                                        Balance qty.
                                    </TableHead>
                                    <TableHead
                                        rowSpan={2}
                                        className="border-l text-right"
                                    >
                                        Days to consume
                                    </TableHead>
                                </TableRow>
                                <TableRow>
                                    <TableHead
                                        className={cn(
                                            'border-l text-right',
                                            tone.issue.subhead,
                                        )}
                                    >
                                        Qty.
                                    </TableHead>
                                    <TableHead className={tone.issue.subhead}>
                                        Office
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {entries.length === 0 ? (
                                    <TableRow>
                                        <TableCell
                                            colSpan={7}
                                            className="py-8 text-center text-muted-foreground"
                                        >
                                            No transactions for this period.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    entries.map((entry, index) => {
                                        const beginning =
                                            entry.reference ===
                                            'Beginning Balance';

                                        return (
                                            <TableRow
                                                key={
                                                    entry.transaction_id ??
                                                    `row-${index}`
                                                }
                                                className={
                                                    beginning
                                                        ? 'bg-muted/50'
                                                        : undefined
                                                }
                                            >
                                                <TableCell>
                                                    {formatDate(entry.date)}
                                                </TableCell>
                                                <TableCell>
                                                    {beginning ? (
                                                        <Badge variant="secondary">
                                                            {entry.reference}
                                                        </Badge>
                                                    ) : (
                                                        entry.reference
                                                    )}
                                                </TableCell>
                                                <TableCell
                                                    className={cn(
                                                        'border-l text-right tabular-nums',
                                                        tone.receipt.cell,
                                                        tone.receipt.value,
                                                    )}
                                                >
                                                    {entry.receipt_qty
                                                        ? formatNumber(
                                                              entry.receipt_qty,
                                                          )
                                                        : ''}
                                                </TableCell>
                                                <TableCell
                                                    className={cn(
                                                        'border-l text-right tabular-nums',
                                                        tone.issue.cell,
                                                        tone.issue.value,
                                                    )}
                                                >
                                                    {entry.issue_qty
                                                        ? formatNumber(
                                                              entry.issue_qty,
                                                          )
                                                        : ''}
                                                </TableCell>
                                                <TableCell
                                                    className={cn(
                                                        'max-w-56 truncate',
                                                        tone.issue.cell,
                                                    )}
                                                >
                                                    {entry.issue_office ?? ''}
                                                </TableCell>
                                                <TableCell
                                                    className={cn(
                                                        'border-l text-right tabular-nums',
                                                        tone.balance.cell,
                                                        tone.balance.value,
                                                    )}
                                                >
                                                    {formatNumber(
                                                        entry.balance_qty,
                                                    )}
                                                </TableCell>
                                                <TableCell className="border-l text-right tabular-nums">
                                                    {entry.days_to_consume ??
                                                        ''}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </TablePanel>
                </section>
            </PageContainer>
        </>
    );
}

StockCardShow.layout = (props: Props) => ({
    breadcrumbs: [
        { title: 'Stock cards', href: stockCardsIndex() },
        {
            title: props.supply.item_name,
            href: showStockCard(props.supply.supply_id),
        },
    ],
});
