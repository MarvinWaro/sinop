import { Head } from '@inertiajs/react';
import { SupplyCardList } from '@/components/cards/supply-card-list';
import type { SupplyWithStock } from '@/components/cards/supply-card-list';
import { PageContainer, PageHeader } from '@/components/page-header';
import {
    index as stockCardsIndex,
    show as showStockCard,
} from '@/routes/stock-cards';
import type { Paginated } from '@/types';

type Props = {
    supplies: Paginated<SupplyWithStock>;
    fundClusters: string[];
    filters: { search?: string; fund_cluster?: string };
};

export default function StockCardsIndex({
    supplies,
    fundClusters,
    filters,
}: Props) {
    return (
        <>
            <Head title="Stock cards" />
            <PageContainer>
                <PageHeader
                    title="Stock cards"
                    description="Quantity movements per supply (Appendix 58)"
                />
                <SupplyCardList
                    supplies={supplies}
                    fundClusters={fundClusters}
                    filters={filters}
                    indexUrl={stockCardsIndex.url()}
                    cardHref={(supplyId) => showStockCard(supplyId)}
                    viewLabel="Stock card"
                />
            </PageContainer>
        </>
    );
}

StockCardsIndex.layout = {
    breadcrumbs: [{ title: 'Stock cards', href: stockCardsIndex() }],
};
