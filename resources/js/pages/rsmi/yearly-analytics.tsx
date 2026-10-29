import { Head, Link, router } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';
import { YearlyIssuanceAnalytics } from '@/components/analytics/yearly-issuance-analytics';
import type { YearlyData } from '@/components/analytics/yearly-issuance-analytics';
import { PageContainer, PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { index as rsmiIndex, yearlyAnalytics } from '@/routes/rsmi';

type Props = {
    year: number;
    fundCluster: string;
    yearlyData: YearlyData;
};

export default function RsmiYearlyAnalytics({
    year,
    fundCluster,
    yearlyData: data,
}: Props) {
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 6 }, (_, i) => currentYear - i);
    const yearOptions = years.includes(year) ? years : [year, ...years];

    const visit = (params: {
        year?: string | number;
        fund_cluster?: string;
    }) => {
        router.get(
            yearlyAnalytics.url(),
            {
                year: params.year ?? year,
                fund_cluster: params.fund_cluster ?? fundCluster,
            },
            { preserveScroll: true },
        );
    };

    return (
        <>
            <Head title={`RSMI yearly analytics ${year}`} />
            <PageContainer>
                <PageHeader
                    title={`RSMI yearly analytics – ${year}`}
                    description={`Fund cluster ${fundCluster}`}
                    actions={
                        <>
                            <NativeSelect
                                value={String(year)}
                                onChange={(e) =>
                                    visit({ year: e.target.value })
                                }
                                className="w-28"
                                aria-label="Year"
                            >
                                {yearOptions.map((y) => (
                                    <option key={y} value={y}>
                                        {y}
                                    </option>
                                ))}
                            </NativeSelect>
                            <NativeSelect
                                value={fundCluster}
                                onChange={(e) =>
                                    visit({ fund_cluster: e.target.value })
                                }
                                className="w-44"
                                aria-label="Fund cluster"
                            >
                                <option value="101">Fund cluster 101</option>
                                <option value="151">Fund cluster 151</option>
                            </NativeSelect>
                            <Button asChild variant="outline">
                                <Link href={rsmiIndex()}>
                                    <ArrowLeft />
                                    Back to RSMI
                                </Link>
                            </Button>
                        </>
                    }
                />

                <YearlyIssuanceAnalytics data={data} />
            </PageContainer>
        </>
    );
}

RsmiYearlyAnalytics.layout = (props: Props) => ({
    breadcrumbs: [
        { title: 'RSMI', href: rsmiIndex() },
        {
            title: `Yearly analytics – ${props.year}`,
            href: yearlyAnalytics({
                query: { year: props.year, fund_cluster: props.fundCluster },
            }),
        },
    ],
});
