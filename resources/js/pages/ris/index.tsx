import { Head, Link } from '@inertiajs/react';
import { Eye, FilePlus2 } from 'lucide-react';
import { useState } from 'react';
import { DataPagination } from '@/components/data-pagination';
import { EmptyState } from '@/components/empty-state';
import { PageContainer, PageHeader } from '@/components/page-header';
import { ManualEntryDialog } from '@/components/ris/manual-entry-dialog';
import type {
    ManualSupplyOption,
    ManualUserOption,
} from '@/components/ris/manual-entry-dialog';
import { SearchForm } from '@/components/search-form';
import { RisStatusBadge } from '@/components/status-badges';
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
import { useLiveProps } from '@/hooks/use-inbox';
import { formatDate, formatTime } from '@/lib/format';
import { risKey } from '@/lib/ris';
import { index as risIndex, show as showRis } from '@/routes/ris';
import type { Department, Paginated, RisSlip } from '@/types';

type Props = {
    risSlips: Paginated<RisSlip>;
    counts: {
        total: number;
        draft: number;
        approved: number;
        pendingReceipt: number;
        completed: number;
        declined: number;
    };
    departments: Department[];
    users: ManualUserOption[];
    availableSupplies: ManualSupplyOption[];
    showAllSupplies: boolean;
    filters: {
        status?: string;
        search?: string;
        date_from?: string;
        date_to?: string;
        department?: string;
    };
};

export default function RisIndex({
    risSlips,
    counts,
    departments,
    users,
    availableSupplies,
    showAllSupplies,
    filters,
}: Props) {
    const can = useCan();
    const canManualEntry = can('ris.manual-entry');
    const [manualOpen, setManualOpen] = useState(false);

    // New requests and status changes show here without a refresh.
    useLiveProps(['risSlips', 'counts']);

    const statuses: { value: string; label: string; count: number }[] = [
        { value: '', label: 'Total', count: counts.total },
        { value: 'draft', label: 'Pending', count: counts.draft },
        { value: 'approved', label: 'Approved', count: counts.approved },
        {
            value: 'pending-receipt',
            label: 'Pending receipt',
            count: counts.pendingReceipt,
        },
        { value: 'completed', label: 'Completed', count: counts.completed },
        { value: 'declined', label: 'Declined', count: counts.declined },
    ];
    const currentStatus = filters.status ?? '';

    return (
        <>
            <Head title="Requisition and Issue Slips" />
            <PageContainer>
                <PageHeader
                    title="Requisition and Issue Slips"
                    description="Review, approve and issue supply requisitions"
                    actions={
                        canManualEntry && (
                            <Button onClick={() => setManualOpen(true)}>
                                <FilePlus2 />
                                Add manual entry
                            </Button>
                        )
                    }
                />

                <div className="space-y-4">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                        <div className="flex flex-wrap gap-2">
                            {statuses.map((status) => (
                                <Button
                                    key={status.label}
                                    asChild
                                    size="sm"
                                    variant={
                                        currentStatus === status.value
                                            ? 'default'
                                            : 'outline'
                                    }
                                >
                                    <Link
                                        href={risIndex()}
                                        data={
                                            status.value
                                                ? { status: status.value }
                                                : {}
                                        }
                                        preserveScroll
                                    >
                                        {status.label}
                                        <span className="tabular-nums opacity-70">
                                            {status.count}
                                        </span>
                                    </Link>
                                </Button>
                            ))}
                        </div>
                        <SearchForm
                            url={risIndex.url()}
                            defaultValue={filters.search}
                            params={{ status: filters.status }}
                            placeholder="Search RIS number, requestor..."
                        />
                    </div>

                    <TablePanel>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>RIS No</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Division</TableHead>
                                    <TableHead>Requested by</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">
                                        Actions
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {risSlips.data.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6}>
                                            <EmptyState
                                                title="No requisitions found"
                                                description={
                                                    filters.search ||
                                                    filters.status
                                                        ? 'Try adjusting your filters or search term.'
                                                        : 'Requisitions submitted by staff will appear here.'
                                                }
                                            />
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    risSlips.data.map((slip) => (
                                        <TableRow key={slip.ris_id}>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium">
                                                        {slip.ris_no}
                                                    </span>
                                                    {slip.is_manual_entry && (
                                                        <Badge
                                                            variant="outline"
                                                            className="text-xs"
                                                        >
                                                            Manual
                                                        </Badge>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span>
                                                        {formatDate(
                                                            slip.ris_date,
                                                        )}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground">
                                                        {formatTime(
                                                            slip.created_at,
                                                        )}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="max-w-64 truncate">
                                                {slip.department?.name ?? 'N/A'}
                                            </TableCell>
                                            <TableCell>
                                                {slip.requester?.name ?? 'N/A'}
                                            </TableCell>
                                            <TableCell>
                                                <RisStatusBadge slip={slip} />
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button
                                                    asChild
                                                    variant="ghost"
                                                    size="icon"
                                                    aria-label={`View ${slip.ris_no}`}
                                                >
                                                    <Link
                                                        href={showRis(
                                                            risKey(slip),
                                                        )}
                                                    >
                                                        <Eye />
                                                    </Link>
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </TablePanel>

                    <DataPagination paginator={risSlips} />
                </div>
            </PageContainer>

            {canManualEntry && (
                <ManualEntryDialog
                    open={manualOpen}
                    onOpenChange={setManualOpen}
                    departments={departments}
                    users={users}
                    supplies={availableSupplies}
                    showAllSupplies={showAllSupplies}
                />
            )}
        </>
    );
}

RisIndex.layout = {
    breadcrumbs: [{ title: 'Requisitions', href: risIndex() }],
};
