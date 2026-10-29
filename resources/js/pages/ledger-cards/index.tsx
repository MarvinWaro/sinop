import { Head } from '@inertiajs/react';
import { SupplyCardList } from '@/components/cards/supply-card-list';
import type { SupplyWithStock } from '@/components/cards/supply-card-list';
import { PageContainer, PageHeader } from '@/components/page-header';
import {
    index as ledgerCardsIndex,
    show as showLedgerCard,
} from '@/routes/supply-ledger-cards';
import type { Paginated } from '@/types';

type Props = {
    supplies: Paginated<SupplyWithStock>;
    fundClusters: string[];
    filters: { search?: string; fund_cluster?: string };
};

export default function LedgerCardsIndex({
    supplies,
    fundClusters,
    filters,
}: Props) {
    return (
        <>
            <Head title="Supply ledger cards" />
            <PageContainer>
                <PageHeader
                    title="Supply ledger cards"
                    description="Quantity and cost movements per supply (Appendix 57)"
                />
                <SupplyCardList
                    supplies={supplies}
                    fundClusters={fundClusters}
                    filters={filters}
                    indexUrl={ledgerCardsIndex.url()}
                    cardHref={(supplyId) => showLedgerCard(supplyId)}
                    viewLabel="Ledger card"
                />
            </PageContainer>
        </>
    );
}

LedgerCardsIndex.layout = {
    breadcrumbs: [{ title: 'Ledger cards', href: ledgerCardsIndex() }],
};
