import { Head, Link, router } from '@inertiajs/react';
import { ArrowLeft, FileSpreadsheet, Package } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { FormSelect } from '@/components/form-select';
import { PageContainer, PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { TablePanel } from '@/components/table-panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
    Table,
    TableBody,
    TableCell,
    TableFooter,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { useCan } from '@/hooks/use-can';
import { formatMoney, formatNumber, toNumber } from '@/lib/format';
import { exportExcel, generate, index as rpciIndex } from '@/routes/rpci';

type ReportRow = {
    supply_id: number;
    stock_no: string;
    item_name: string;
    description: string | null;
    unit: string;
    fund_cluster: string | null;
    book_quantity: number;
    unit_cost: number | string;
};

type Props = {
    reportData: ReportRow[];
    summary: { total_items: number; total_book_value: number | string };
    year: number;
    semester: string;
    startDate: string;
    endDate: string;
    periodLabel: string;
    asOfLabel: string;
    entityName: string;
    fundCluster: string | null;
    departmentId: number | string | null;
    availableYears: (number | string)[];
    fundClusters: string[];
};

const semesterLabel = (semester: string) => (semester === '1' ? '1st' : '2nd');

export default function RpciReport(props: Props) {
    const can = useCan();
    const { reportData, summary, fundCluster } = props;
    // The year on screen is always a choice, even one with no transactions.
    const years = props.availableYears.map(String);
    const yearOptions = years.includes(String(props.year))
        ? years
        : [...years, String(props.year)].sort((a, b) => b.localeCompare(a));
    const [year, setYear] = useState(String(props.year));
    const [semester, setSemester] = useState(props.semester);
    const [cluster, setCluster] = useState(fundCluster ?? '');

    // Each pick reloads the report straight away (no "Apply filters" button).
    const visit = (next: {
        year?: string;
        semester?: string;
        fund_cluster?: string;
    }) => {
        router.get(
            generate.url(),
            { year, semester, fund_cluster: cluster, ...next },
            { preserveScroll: true },
        );
    };

    const exportQuery = {
        year: props.year,
        semester: props.semester,
        fund_cluster: fundCluster ?? '',
        department_id: props.departmentId ?? '',
    };

    const columns = fundCluster ? 5 : 6;

    return (
        <>
            <Head
                title={`RPCI ${semesterLabel(props.semester)} semester ${props.year}`}
            />
            <PageContainer>
                <PageHeader
                    title={`RPCI – ${semesterLabel(props.semester)} semester ${props.year}`}
                    description={
                        fundCluster
                            ? `Fund cluster ${fundCluster}`
                            : 'All fund clusters'
                    }
                    actions={
                        <>
                            <Button asChild variant="outline">
                                <Link href={rpciIndex()}>
                                    <ArrowLeft />
                                    Back to RPCI
                                </Link>
                            </Button>
                            {can('rpci.export') && (
                                <Button asChild>
                                    <a
                                        href={exportExcel.url({
                                            query: exportQuery,
                                        })}
                                    >
                                        <FileSpreadsheet />
                                        Export Excel
                                    </a>
                                </Button>
                            )}
                        </>
                    }
                />

                <Card className="py-4">
                    <CardContent className="px-4">
                        <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            <div className="grid gap-2">
                                <Label htmlFor="filter_year">Year</Label>
                                <FormSelect
                                    id="filter_year"
                                    value={year}
                                    onValueChange={(value) => {
                                        setYear(value);
                                        visit({ year: value });
                                    }}
                                    options={yearOptions.map((y) => ({
                                        value: y,
                                        label: y,
                                    }))}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="filter_semester">
                                    Semester
                                </Label>
                                <FormSelect
                                    id="filter_semester"
                                    value={semester}
                                    onValueChange={(value) => {
                                        setSemester(value);
                                        visit({ semester: value });
                                    }}
                                    options={[
                                        {
                                            value: '1',
                                            label: '1st semester (Jan – Jun)',
                                        },
                                        {
                                            value: '2',
                                            label: '2nd semester (Jul – Dec)',
                                        },
                                    ]}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="filter_fund_cluster">
                                    Fund cluster
                                </Label>
                                <FormSelect
                                    id="filter_fund_cluster"
                                    value={cluster}
                                    onValueChange={(value) => {
                                        setCluster(value);
                                        visit({ fund_cluster: value });
                                    }}
                                    options={[
                                        {
                                            value: '',
                                            label: 'All fund clusters',
                                        },
                                        ...props.fundClusters.map((fc) => ({
                                            value: fc,
                                            label: `Fund cluster ${fc}`,
                                        })),
                                    ]}
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <div className="grid gap-4 sm:grid-cols-2">
                    <StatCard
                        title="Total items"
                        value={formatNumber(summary.total_items)}
                    />
                    <StatCard
                        title="Total book value"
                        value={`₱${formatMoney(summary.total_book_value, 4)}`}
                    />
                </div>

                <Card>
                    <CardHeader className="text-center">
                        <CardTitle>
                            Report on the Physical Count of Inventories
                        </CardTitle>
                        <CardDescription>
                            {props.entityName}
                            <br />
                            {fundCluster
                                ? `Fund cluster ${fundCluster}`
                                : 'All fund clusters'}{' '}
                            · {semesterLabel(props.semester)} semester{' '}
                            {props.year} (as of {props.asOfLabel})
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <TablePanel flush>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Stock no.</TableHead>
                                        {!fundCluster && (
                                            <TableHead>Fund cluster</TableHead>
                                        )}
                                        <TableHead>Item description</TableHead>
                                        <TableHead>Unit</TableHead>
                                        <TableHead className="text-right">
                                            Unit value
                                        </TableHead>
                                        <TableHead className="text-right">
                                            Balance per card (qty.)
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {reportData.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={columns}>
                                                <EmptyState
                                                    icon={Package}
                                                    title="No inventory data found for the selected criteria."
                                                />
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        reportData.map((row, index) => (
                                            <TableRow
                                                key={`${row.supply_id}-${row.fund_cluster ?? ''}-${index}`}
                                            >
                                                <TableCell className="font-mono">
                                                    {row.stock_no}
                                                </TableCell>
                                                {!fundCluster && (
                                                    <TableCell>
                                                        <Badge variant="outline">
                                                            {row.fund_cluster ??
                                                                'N/A'}
                                                        </Badge>
                                                    </TableCell>
                                                )}
                                                <TableCell className="whitespace-normal">
                                                    {row.item_name}
                                                    {row.description
                                                        ? `, ${row.description}`
                                                        : ''}
                                                </TableCell>
                                                <TableCell>
                                                    {row.unit}
                                                </TableCell>
                                                <TableCell className="text-right tabular-nums">
                                                    ₱
                                                    {formatMoney(
                                                        row.unit_cost,
                                                        4,
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right font-medium tabular-nums">
                                                    {formatNumber(
                                                        row.book_quantity,
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                                {reportData.length > 0 && (
                                    <TableFooter>
                                        <TableRow>
                                            <TableCell
                                                colSpan={columns - 1}
                                                className="text-right"
                                            >
                                                Total book value
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums">
                                                ₱
                                                {formatMoney(
                                                    toNumber(
                                                        summary.total_book_value,
                                                    ),
                                                    4,
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    </TableFooter>
                                )}
                            </Table>
                        </TablePanel>
                    </CardContent>
                </Card>
            </PageContainer>
        </>
    );
}

RpciReport.layout = (props: Props) => ({
    breadcrumbs: [
        { title: 'RPCI', href: rpciIndex() },
        {
            title: `${semesterLabel(props.semester)} semester ${props.year}`,
            href: generate({
                query: {
                    year: props.year,
                    semester: props.semester,
                    fund_cluster: props.fundCluster ?? '',
                },
            }),
        },
    ],
});
