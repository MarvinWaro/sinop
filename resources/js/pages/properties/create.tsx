import { Head } from '@inertiajs/react';
import { PageContainer, PageHeader } from '@/components/page-header';
import { PropertyForm } from '@/components/properties/property-form';
import { create, index as propertiesIndex } from '@/routes/property';
import type { Location, UserOption } from '@/types';

type Props = {
    locations: Location[];
    users: UserOption[];
    conditions: string[];
    canAddLocations: boolean;
    canAddConditions: boolean;
};

export default function PropertyCreate({
    locations,
    users,
    conditions,
    canAddLocations,
    canAddConditions,
}: Props) {
    return (
        <>
            <Head title="Add property" />
            <PageContainer>
                <PageHeader
                    title="Add property"
                    description="Register equipment or furniture and assign it to an employee (MR)"
                />
                <PropertyForm
                    locations={locations}
                    users={users}
                    conditions={conditions}
                    canAddLocations={canAddLocations}
                    canAddConditions={canAddConditions}
                />
            </PageContainer>
        </>
    );
}

PropertyCreate.layout = {
    breadcrumbs: [
        { title: 'Properties', href: propertiesIndex() },
        { title: 'Add property', href: create() },
    ],
};
