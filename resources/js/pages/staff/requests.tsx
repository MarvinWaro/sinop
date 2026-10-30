import { Head, Link } from '@inertiajs/react';
import { Eye, Plus } from 'lucide-react';
import { DataPagination } from '@/components/data-pagination';
import { EmptyState } from '@/components/empty-state';
import { PageContainer, PageHeader } from '@/components/page-header';
import { SearchForm } from '@/components/search-form';
import { UserModeNotice } from '@/components/staff/user-mode-notice';
import { RisStatusBadge } from '@/components/status-badges';
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
import { useCan } from '@/hooks/use-can';
import { useLiveProps } from '@/hooks/use-inbox';
import { formatDate, formatTime, truncate } from '@/lib/format';
import { risKey } from '@/lib/ris';
import { show as showRis } from '@/routes/ris';
import { newRequest, requests as staffRequests } from '@/routes/staff';
import type { Paginated, RisSlip } from '@/types';

export type RequestCounts = {
    total: number;
    draft: number;
    approved: number;
    pendingReceipt: number;
    completed: number;
    declined: number;
    toReceive: number;
};

type Props = {
    counts: RequestCounts;
    myRequests: Paginated<RisSlip & { items_count?: number }>;
    filters: { status?: string; search?: string };
};

export default function StaffRequests({ counts, myRequests, filters }: Props) {
    const can = useCan();

    // A status change (approved, issued, …) shows here without a refresh.
    useLiveProps(['myRequests', 'counts']);

    const statusLinks: { value: string; label: string; count: number }[] = [
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

    const current = filters.status ?? '';
    const pageUrl = staffRequests.url();

    return (
        <>
            <Head title="My requests" />
            <PageContainer>
                <UserModeNotice />
                <PageHeader
                    title="My requests"
                    description="Track and manage your supply requisition requests"
                    actions={
                        can('ris.request') && (
                            <Button asChild>
                                <Link href={newRequest()}>
                                    <Plus />
                                    Request supply
                                </Link>
                            </Button>
                        )
                    }
                />

                <div className="space-y-4">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                        <div className="flex flex-wrap gap-2">
                            {statusLinks.map((status) => (
                                <Button
                                    key={status.label}
                                    asChild
                                    size="sm"
                                    variant={
                                        current === status.value
                                            ? 'default'
                                            : 'outline'
                                    }
                                >
                                    <Link
                                        href={pageUrl}
                                        data={
                                            status.value
                                                ? { status: status.value }
                                                : {}
                                        }
                                        preserveScroll
                                        preserveState
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
                            url={pageUrl}
                            defaultValue={filters.search}
                            params={{ status: filters.status }}
                            placeholder="Search by RIS number..."
                        />
                    </div>

                    <TablePanel>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>RIS No</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Items</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">
                                        Actions
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {myRequests.data.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5}>
                                            <EmptyState
                                                title="No requests found"
                                                description={
                                                    filters.status ||
                                                    filters.search
                                                        ? 'Try adjusting your filters or search term.'
                                                        : 'Get started by clicking the "Request supply" button.'
                                                }
                                            />
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    myRequests.data.map((request) => (
                                        <TableRow key={request.ris_id}>
                                            <TableCell className="font-medium">
                                                {request.ris_no}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span>
                                                        {formatDate(
                                                            request.ris_date,
                                                        )}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground">
                                                        {formatTime(
                                                            request.created_at,
                                                        )}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-muted-foreground tabular-nums">
                                                {request.items_count ?? 0}
                                            </TableCell>
                                            <TableCell className="whitespace-normal">
                                                <RisStatusBadge
                                                    slip={request}
                                                />
                                                {request.status ===
                                                    'declined' &&
                                                    request.decline_reason && (
                                                        <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                                                            {truncate(
                                                                request.decline_reason,
                                                                50,
                                                            )}
                                                        </p>
                                                    )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button
                                                    asChild
                                                    variant="ghost"
                                                    size="icon"
                                                    aria-label="View details"
                                                >
                                                    <Link
                                                        href={showRis(
                                                            risKey(request),
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

                    <DataPagination paginator={myRequests} />
                </div>
            </PageContainer>
        </>
    );
}

StaffRequests.layout = {
    breadcrumbs: [{ title: 'My requests', href: staffRequests() }],
};
