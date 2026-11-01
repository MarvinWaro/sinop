import { Head } from '@inertiajs/react';
import { PageContainer, PageHeader } from '@/components/page-header';
import { PropertyForm } from '@/components/properties/property-form';
import { edit, index as propertiesIndex, view } from '@/routes/property';
import type { Location, Property, UserOption } from '@/types';

type Props = {
    property: Property;
    locations: Location[];
    users: UserOption[];
    conditions: string[];
    canAddLocations: boolean;
    canAddConditions: boolean;
};

export default function PropertyEdit({
    property,
    locations,
    users,
    conditions,
    canAddLocations,
    canAddConditions,
}: Props) {
    return (
        <>
            <Head title={`Edit ${property.item_name}`} />
            <PageContainer>
                <PageHeader
                    title="Edit property"
                    description={`${property.item_name} · Property no. ${property.property_number}`}
                />
                <PropertyForm
                    property={property}
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

PropertyEdit.layout = (props: Props) => ({
    breadcrumbs: [
        { title: 'Properties', href: propertiesIndex() },
        { title: props.property.item_name, href: view(props.property.id) },
        { title: 'Edit', href: edit(props.property.id) },
    ],
});
