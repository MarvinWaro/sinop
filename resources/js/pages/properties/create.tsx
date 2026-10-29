import { Head } from '@inertiajs/react';
import { PageContainer, PageHeader } from '@/components/page-header';
import { PropertyForm } from '@/components/properties/property-form';
import { create, index as propertiesIndex } from '@/routes/property';
import type { Location, UserOption } from '@/types';

type Props = {
    locations: Location[];
    users: UserOption[];
};

export default function PropertyCreate({ locations, users }: Props) {
    return (
        <>
            <Head title="Add property" />
            <PageContainer>
                <PageHeader
                    title="Add property"
                    description="Register equipment or furniture and assign it to an employee (MR)"
                />
                <PropertyForm locations={locations} users={users} />
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
