import { Head, Link, usePage } from '@inertiajs/react';
import { Eye, PackageOpen } from 'lucide-react';
import { useState } from 'react';
import { DataPagination } from '@/components/data-pagination';
import { EmptyState } from '@/components/empty-state';
import { PageContainer, PageHeader } from '@/components/page-header';
import { ReceiveDialog } from '@/components/staff/receive-dialog';
import { UserModeNotice } from '@/components/staff/user-mode-notice';
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
import { useLiveProps } from '@/hooks/use-inbox';
import { formatDate, formatTime } from '@/lib/format';
import { risKey } from '@/lib/ris';
import { show as showRis } from '@/routes/ris';
import { received as staffReceived } from '@/routes/staff';
import type { Paginated, RisSlip } from '@/types';

type Props = {
    receivedRequisitions: Paginated<RisSlip>;
};

export default function StaffReceived({ receivedRequisitions }: Props) {
    const { auth } = usePage().props;
    const [receiving, setReceiving] = useState<RisSlip | null>(null);

    // Supplies issued to you show here without a refresh.
    useLiveProps(['receivedRequisitions']);

    return (
        <>
            <Head title="Received supplies" />
            <PageContainer>
                <UserModeNotice />
                <PageHeader
                    title="Received supplies"
                    description="Supplies issued to you. Confirm receipt once you have the items."
                />

                <div className="space-y-4">
                    <TablePanel>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>RIS No</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Requested by</TableHead>
                                    <TableHead className="text-right">
                                        Actions
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {receivedRequisitions.data.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4}>
                                            <EmptyState
                                                icon={PackageOpen}
                                                title="No supplies received"
                                                description="You haven't received any supplies yet."
                                            />
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    receivedRequisitions.data.map(
                                        (requisition) => {
                                            const canReceive =
                                                Number(
                                                    requisition.received_by,
                                                ) === auth.user.id &&
                                                !requisition.received_at &&
                                                requisition.status ===
                                                    'posted' &&
                                                Boolean(requisition.issued_at);

                                            return (
                                                <TableRow
                                                    key={requisition.ris_id}
                                                >
                                                    <TableCell className="font-medium">
                                                        {requisition.ris_no}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-col">
                                                            <span>
                                                                {formatDate(
                                                                    requisition.ris_date,
                                                                )}
                                                            </span>
                                                            <span className="text-xs text-muted-foreground">
                                                                {formatTime(
                                                                    requisition.created_at,
                                                                )}
                                                            </span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        {requisition.requester
                                                            ?.name ?? 'N/A'}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            {canReceive ? (
                                                                <Button
                                                                    size="sm"
                                                                    onClick={() =>
                                                                        setReceiving(
                                                                            requisition,
                                                                        )
                                                                    }
                                                                >
                                                                    Receive
                                                                </Button>
                                                            ) : requisition.received_at ? (
                                                                <span className="text-xs text-muted-foreground">
                                                                    Received{' '}
                                                                    {formatDate(
                                                                        requisition.received_at,
                                                                    )}
                                                                </span>
                                                            ) : null}
                                                            <Button
                                                                asChild
                                                                variant="ghost"
                                                                size="icon"
                                                                aria-label="View details"
                                                            >
                                                                <Link
                                                                    href={showRis(
                                                                        risKey(
                                                                            requisition,
                                                                        ),
                                                                    )}
                                                                >
                                                                    <Eye />
                                                                </Link>
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        },
                                    )
                                )}
                            </TableBody>
                        </Table>
                    </TablePanel>
                    <DataPagination paginator={receivedRequisitions} />
                </div>
            </PageContainer>

            <ReceiveDialog
                requisition={receiving}
                onClose={() => setReceiving(null)}
            />
        </>
    );
}

StaffReceived.layout = {
    breadcrumbs: [{ title: 'Received supplies', href: staffReceived() }],
};
