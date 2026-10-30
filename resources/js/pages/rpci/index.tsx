import { Head, Link, router } from '@inertiajs/react';
import { ClipboardList, FileSpreadsheet, Info } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { FormField } from '@/components/form-field';
import { FormSelect } from '@/components/form-select';
import { PageContainer, PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { useCan } from '@/hooks/use-can';
import { exportExcel, generate, index as rpciIndex } from '@/routes/rpci';
import { index as stockCardsIndex } from '@/routes/stock-cards';

type Props = {
    availableYears: (number | string)[];
    fundClusters: string[];
    selectedYear: number;
    selectedSemester: string;
    selectedFundCluster: string | null;
};

export default function RpciIndex({
    availableYears,
    fundClusters,
    selectedYear,
    selectedSemester,
    selectedFundCluster,
}: Props) {
    const can = useCan();
    const years =
        availableYears.length > 0 ? availableYears : [new Date().getFullYear()];
    const [year, setYear] = useState(String(selectedYear || years[0]));
    const [semester, setSemester] = useState(selectedSemester || '1');
    const [fundCluster, setFundCluster] = useState(selectedFundCluster ?? '');

    const query = { year, semester, fund_cluster: fundCluster };

    const submit = (event: FormEvent) => {
        event.preventDefault();
        router.get(generate.url(), query);
    };

    return (
        <>
            <Head title="RPCI" />
            <PageContainer>
                <PageHeader
                    title="Report on the Physical Count of Inventories (RPCI)"
                    description="Semester reports comparing book quantities to the physical count"
                    actions={
                        <Button asChild variant="outline">
                            <Link href={stockCardsIndex()}>
                                <ClipboardList />
                                Stock cards
                            </Link>
                        </Button>
                    }
                />

                <div className="grid gap-6 lg:grid-cols-[minmax(0,28rem)_1fr]">
                    <Card>
                        <form onSubmit={submit} className="flex flex-col gap-6">
                            <CardHeader>
                                <CardTitle>Generate semester report</CardTitle>
                                <CardDescription>
                                    Pick the period and fund cluster, then view
                                    the report or export it to Excel.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="grid gap-4">
                                <FormField label="Year" htmlFor="year">
                                    <FormSelect
                                        id="year"
                                        value={year}
                                        onValueChange={(value) =>
                                            setYear(value)
                                        }
                                        options={years.map((y) => ({
                                            value: y,
                                            label: String(y),
                                        }))}
                                    />
                                </FormField>
                                <FormField label="Semester" htmlFor="semester">
                                    <FormSelect
                                        id="semester"
                                        value={semester}
                                        onValueChange={(value) =>
                                            setSemester(value)
                                        }
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
                                </FormField>
                                <FormField
                                    label="Fund cluster"
                                    htmlFor="fund_cluster"
                                >
                                    <FormSelect
                                        id="fund_cluster"
                                        value={fundCluster}
                                        onValueChange={(value) =>
                                            setFundCluster(value)
                                        }
                                        options={[
                                            {
                                                value: '',
                                                label: 'All fund clusters',
                                            },
                                            ...fundClusters.map((cluster) => ({
                                                value: cluster,
                                                label: `Fund cluster ${cluster}`,
                                            })),
                                        ]}
                                    />
                                </FormField>
                            </CardContent>
                            <CardFooter className="flex flex-wrap gap-2">
                                <Button type="submit">Generate report</Button>
                                {can('rpci.export') && (
                                    <Button asChild variant="outline">
                                        <a href={exportExcel.url({ query })}>
                                            <FileSpreadsheet />
                                            Export Excel
                                        </a>
                                    </Button>
                                )}
                            </CardFooter>
                        </form>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Info className="size-4 text-muted-foreground" />
                                About RPCI reports
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ul className="ml-4 list-disc space-y-2 text-sm text-muted-foreground">
                                <li>
                                    RPCI reports are generated every semester (6
                                    months) to compare physical inventory counts
                                    with book quantities.
                                </li>
                                <li>
                                    The first semester covers January to June;
                                    the second covers July to December.
                                </li>
                                <li>
                                    Reports show variances between the actual
                                    physical count and the book quantities
                                    calculated from transactions.
                                </li>
                                <li>
                                    Choose “All fund clusters” to combine 101
                                    and 151, or pick one to separate budget
                                    allocations.
                                </li>
                                <li>
                                    Variance analysis helps identify
                                    discrepancies that need investigation or
                                    adjustment.
                                </li>
                            </ul>
                        </CardContent>
                    </Card>
                </div>
            </PageContainer>
        </>
    );
}

RpciIndex.layout = {
    breadcrumbs: [{ title: 'RPCI', href: rpciIndex() }],
};
