import { Head, Link } from '@inertiajs/react';
import { ScrollText } from 'lucide-react';
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
    cardTableBody,
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
import {
    formatDate,
    formatMoney,
    formatNumber,
    monthNames,
    toNumber,
} from '@/lib/format';
import { cn } from '@/lib/utils';
import { show as showStockCard } from '@/routes/stock-cards';
import {
    exportExcel,
    exportPdf,
    index as ledgerCardsIndex,
    show as showLedgerCard,
} from '@/routes/supply-ledger-cards';
import type { Supply } from '@/types';

type Entry = {
    date: string;
    reference: string;
    receipt_qty: number | null;
    receipt_unit_cost: number | string | null;
    receipt_total_cost: number | string | null;
    issue_qty: number | null;
    issue_unit_cost: number | string | null;
    issue_total_cost: number | string | null;
    balance_qty: number;
    balance_unit_cost: number | string | null;
    balance_total_cost: number | string | null;
    days_to_consume: number | null;
    transaction_id: number | null;
};

type Props = {
    supply: Supply;
    ledgerCardEntries: Entry[];
    fundClusters: string[];
    fundCluster: string;
    currentStock: number | string;
    averageUnitCost: number | string;
    availableYears: (number | string)[];
    selectedYear: number;
    availableMonths: { value: number; name: string }[];
    selectedMonth: number | null;
    navigation: SupplyCardNavigation;
    movingAverageCost: number | string;
};

const money = (value: number | string | null) =>
    value === null || value === '' ? '' : formatMoney(value, 4);

export default function LedgerCardShow(props: Props) {
    const can = useCan();
    const { supply, ledgerCardEntries: entries } = props;
    const query = {
        fund_cluster: props.fundCluster,
        year: props.selectedYear,
        ...(props.selectedMonth ? { month: props.selectedMonth } : {}),
    };
    const period = props.selectedMonth
        ? `${monthNames[props.selectedMonth - 1]} ${props.selectedYear}`
        : String(props.selectedYear);
    const status = balanceStatus(props.currentStock, supply.reorder_point);
    // Value issued in the rows shown for the selected period (display only).
    const issuedValue = entries.reduce(
        (sum, entry) =>
            sum + (entry.issue_qty ? toNumber(entry.issue_total_cost) : 0),
        0,
    );

    return (
        <>
            <Head title={`Supply ledger card – ${supply.item_name}`} />
            <PageContainer>
                <SupplyCardBanner
                    eyebrow="Supply ledger card · Appendix 57"
                    supply={supply}
                    navigation={props.navigation}
                    hrefFor={(supplyId) =>
                        showLedgerCard(supplyId, {
                            query: { fund_cluster: props.fundCluster },
                        })
                    }
                    filters={
                        <CardFilters
                            url={showLedgerCard.url(supply.supply_id)}
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
                        <>
                            {can('stock-cards.view') && (
                                <Button
                                    asChild
                                    size="sm"
                                    className={onBanner.button}
                                >
                                    <Link
                                        href={showStockCard(supply.supply_id, {
                                            query,
                                        })}
                                    >
                                        <ScrollText />
                                        Stock card
                                    </Link>
                                </Button>
                            )}
                            {can('ledger-cards.export') && (
                                <>
                                    <Button
                                        asChild
                                        size="sm"
                                        className={onBanner.solid}
                                    >
                                        <a
                                            href={exportPdf.url(
                                                supply.supply_id,
                                                {
                                                    query,
                                                },
                                            )}
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
                            )}
                        </>
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
                            label: 'Moving average cost',
                            value: `₱${formatMoney(props.movingAverageCost, 4)}`,
                            hint: 'Per unit',
                        },
                        {
                            label: 'Issued value',
                            value: `₱${formatMoney(issuedValue, 4)}`,
                            hint: period,
                        },
                    ]}
                />

                <section className="space-y-3">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <h2 className="text-base font-semibold">
                                Supply ledger card · {period}
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
                                        colSpan={3}
                                        className={cn(
                                            'border-l text-center',
                                            tone.receipt.head,
                                        )}
                                    >
                                        Receipt
                                    </TableHead>
                                    <TableHead
                                        colSpan={3}
                                        className={cn(
                                            'border-l text-center',
                                            tone.issue.head,
                                        )}
                                    >
                                        Issue
                                    </TableHead>
                                    <TableHead
                                        colSpan={3}
                                        className={cn(
                                            'border-l text-center',
                                            tone.balance.head,
                                        )}
                                    >
                                        Balance
                                    </TableHead>
                                    <TableHead
                                        rowSpan={2}
                                        className="border-l text-right"
                                    >
                                        Days to consume
                                    </TableHead>
                                </TableRow>
                                <TableRow>
                                    {(
                                        ['receipt', 'issue', 'balance'] as const
                                    ).map((group) => (
                                        <Subheads
                                            key={group}
                                            className={tone[group].subhead}
                                        />
                                    ))}
                                </TableRow>
                            </TableHeader>
                            <TableBody className={cardTableBody}>
                                {entries.length === 0 ? (
                                    <TableRow>
                                        <TableCell
                                            colSpan={12}
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
                                                        'text-right tabular-nums',
                                                        tone.receipt.cell,
                                                        tone.receipt.value,
                                                    )}
                                                >
                                                    {entry.receipt_qty
                                                        ? money(
                                                              entry.receipt_unit_cost,
                                                          )
                                                        : ''}
                                                </TableCell>
                                                <TableCell
                                                    className={cn(
                                                        'text-right tabular-nums',
                                                        tone.receipt.cell,
                                                        tone.receipt.value,
                                                    )}
                                                >
                                                    {entry.receipt_qty
                                                        ? `₱${money(entry.receipt_total_cost)}`
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
                                                        'text-right tabular-nums',
                                                        tone.issue.cell,
                                                        tone.issue.value,
                                                    )}
                                                >
                                                    {entry.issue_qty
                                                        ? money(
                                                              entry.issue_unit_cost,
                                                          )
                                                        : ''}
                                                </TableCell>
                                                <TableCell
                                                    className={cn(
                                                        'text-right tabular-nums',
                                                        tone.issue.cell,
                                                        tone.issue.value,
                                                    )}
                                                >
                                                    {entry.issue_qty
                                                        ? `₱${money(entry.issue_total_cost)}`
                                                        : ''}
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
                                                <TableCell
                                                    className={cn(
                                                        'text-right tabular-nums',
                                                        tone.balance.cell,
                                                        tone.balance.value,
                                                    )}
                                                >
                                                    {money(
                                                        entry.balance_unit_cost,
                                                    )}
                                                </TableCell>
                                                <TableCell
                                                    className={cn(
                                                        'text-right tabular-nums',
                                                        tone.balance.cell,
                                                        tone.balance.value,
                                                    )}
                                                >
                                                    ₱
                                                    {money(
                                                        entry.balance_total_cost,
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

function Subheads({ className }: { className?: string }) {
    return (
        <>
            <TableHead className={cn('border-l text-right', className)}>
                Qty.
            </TableHead>
            <TableHead className={cn('text-right', className)}>
                Unit cost
            </TableHead>
            <TableHead className={cn('text-right', className)}>
                Total cost
            </TableHead>
        </>
    );
}

LedgerCardShow.layout = (props: Props) => ({
    breadcrumbs: [
        { title: 'Ledger cards', href: ledgerCardsIndex() },
        {
            title: props.supply.item_name,
            href: showLedgerCard(props.supply.supply_id),
        },
    ],
});
