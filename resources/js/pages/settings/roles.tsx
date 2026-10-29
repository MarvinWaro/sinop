import { Head, useForm } from '@inertiajs/react';
import { KeyRound, Lock, Pencil, Plus, Shield, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { EmptyState } from '@/components/empty-state';
import { FormField } from '@/components/form-field';
import Heading from '@/components/heading';
import { SearchForm } from '@/components/search-form';
import { TablePanel } from '@/components/table-panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { useCan } from '@/hooks/use-can';
import { useDeleteAction } from '@/hooks/use-delete-action';
import { destroy, index as rolesIndex, store, update } from '@/routes/roles';

type RoleRow = {
    id: number;
    name: string;
    slug: string;
    description: string | null;
    users_count: number;
    permission_ids: number[];
    permissions_count: number;
    is_super_admin: boolean;
    is_built_in: boolean;
};

type PermissionGroup = {
    group: string;
    permissions: { id: number; name: string; slug: string }[];
};

type Props = {
    roles: RoleRow[];
    permissionGroups: PermissionGroup[];
    totalPermissions: number;
    search: string;
};

/**
 * Settings › Roles & permissions (same layout as PHLGADIS). Administrator is
 * locked with every permission; built-in roles can't be deleted.
 */
export default function RolesIndex({
    roles,
    permissionGroups,
    totalPermissions,
    search,
}: Props) {
    const can = useCan();
    const [editing, setEditing] = useState<RoleRow | 'new' | null>(null);
    const deletion = useDeleteAction<RoleRow>((role) => destroy.url(role.id));

    return (
        <>
            <Head title="Roles & permissions" />

            <div className="space-y-6">
                <Heading
                    variant="small"
                    title="Roles & permissions"
                    description="Group permissions into roles, then give people one or more roles under Users."
                    actions={
                        can('roles.create') && (
                            <Button onClick={() => setEditing('new')}>
                                <Plus />
                                Add role
                            </Button>
                        )
                    }
                />

                <div className="space-y-4">
                    <SearchForm
                        url={rolesIndex.url()}
                        defaultValue={search}
                        placeholder="Search roles"
                    />

                    <TablePanel>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Role</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead>Users</TableHead>
                                    <TableHead>Permissions</TableHead>
                                    <TableHead className="text-right">
                                        Actions
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {roles.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5}>
                                            <EmptyState
                                                icon={KeyRound}
                                                title="No roles found"
                                            />
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    roles.map((role) => (
                                        <TableRow key={role.id}>
                                            <TableCell>
                                                <span className="flex items-center gap-2 font-medium">
                                                    {role.is_super_admin ? (
                                                        <Lock
                                                            className="size-4 text-muted-foreground"
                                                            aria-hidden
                                                        />
                                                    ) : (
                                                        <Shield
                                                            className="size-4 text-muted-foreground"
                                                            aria-hidden
                                                        />
                                                    )}
                                                    {role.name}
                                                </span>
                                            </TableCell>
                                            <TableCell className="max-w-md whitespace-normal text-muted-foreground">
                                                {role.description ?? '—'}
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant="secondary"
                                                    className="tabular-nums"
                                                >
                                                    {role.users_count}{' '}
                                                    {role.users_count === 1
                                                        ? 'user'
                                                        : 'users'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant="outline"
                                                    className="tabular-nums"
                                                >
                                                    {role.is_super_admin
                                                        ? 'All permissions'
                                                        : `${role.permissions_count} of ${totalPermissions}`}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {role.is_super_admin ? (
                                                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                                                        <Lock
                                                            className="size-3.5"
                                                            aria-hidden
                                                        />
                                                        System locked
                                                    </span>
                                                ) : (
                                                    <div className="flex justify-end gap-1">
                                                        {can(
                                                            'roles.update',
                                                        ) && (
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() =>
                                                                    setEditing(
                                                                        role,
                                                                    )
                                                                }
                                                                aria-label={`Edit ${role.name}`}
                                                            >
                                                                <Pencil />
                                                            </Button>
                                                        )}
                                                        {can('roles.delete') &&
                                                            !role.is_built_in && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    onClick={() =>
                                                                        deletion.request(
                                                                            role,
                                                                        )
                                                                    }
                                                                    aria-label={`Delete ${role.name}`}
                                                                >
                                                                    <Trash2 />
                                                                </Button>
                                                            )}
                                                    </div>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </TablePanel>
                </div>
            </div>

            <Dialog
                open={editing !== null}
                onOpenChange={(open: boolean) => !open && setEditing(null)}
            >
                <DialogContent className="flex max-h-[90vh] flex-col gap-0 p-0 sm:max-w-4xl">
                    {editing !== null && (
                        <RoleForm
                            key={editing === 'new' ? 'new' : editing.id}
                            role={editing === 'new' ? null : editing}
                            groups={permissionGroups}
                            total={totalPermissions}
                            onClose={() => setEditing(null)}
                        />
                    )}
                </DialogContent>
            </Dialog>

            <ConfirmDialog
                open={deletion.target !== null}
                onOpenChange={(open) => !open && deletion.cancel()}
                title="Delete role?"
                description={
                    deletion.target
                        ? deletion.target.users_count > 0
                            ? `“${deletion.target.name}” is still given to ${deletion.target.users_count} user(s). Remove it from them under Users first.`
                            : `“${deletion.target.name}” will be deleted.`
                        : undefined
                }
                confirmLabel="Delete role"
                destructive
                processing={deletion.processing}
                onConfirm={deletion.confirm}
            />
        </>
    );
}

RolesIndex.layout = {
    breadcrumbs: [{ title: 'Roles & permissions', href: rolesIndex() }],
};

function RoleForm({
    role,
    groups,
    total,
    onClose,
}: {
    role: RoleRow | null;
    groups: PermissionGroup[];
    total: number;
    onClose: () => void;
}) {
    const form = useForm({
        name: role?.name ?? '',
        description: role?.description ?? '',
        permissions: role?.permission_ids ?? ([] as number[]),
    });

    const selected = new Set(form.data.permissions);

    const setMany = (ids: number[], checked: boolean) => {
        const next = new Set(form.data.permissions);
        ids.forEach((id) => (checked ? next.add(id) : next.delete(id)));
        form.setData('permissions', [...next]);
    };

    const submit = (event: FormEvent) => {
        event.preventDefault();
        const options = { preserveScroll: true, onSuccess: () => onClose() };

        if (role) {
            form.put(update.url(role.id), options);
        } else {
            form.post(store.url(), options);
        }
    };

    return (
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
            <DialogHeader className="border-b px-6 pt-6 pb-4">
                <DialogTitle>{role ? 'Edit role' : 'Add role'}</DialogTitle>
                <DialogDescription>
                    Choose the exact actions members of this role can perform.
                </DialogDescription>
            </DialogHeader>

            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
                <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                        label="Role name"
                        htmlFor="role-name"
                        error={form.errors.name}
                        required
                    >
                        <Input
                            id="role-name"
                            value={form.data.name}
                            onChange={(e) =>
                                form.setData('name', e.target.value)
                            }
                            maxLength={60}
                            required
                            autoFocus
                        />
                    </FormField>
                    <FormField
                        label="Description (optional)"
                        htmlFor="role-description"
                        error={form.errors.description}
                    >
                        <Input
                            id="role-description"
                            value={form.data.description}
                            onChange={(e) =>
                                form.setData('description', e.target.value)
                            }
                            maxLength={255}
                        />
                    </FormField>
                </div>

                <div className="space-y-3">
                    <div className="flex items-baseline justify-between gap-3">
                        <h3 className="text-sm font-medium">Permissions</h3>
                        <span className="text-xs text-muted-foreground tabular-nums">
                            {selected.size} of {total} selected
                        </span>
                    </div>
                    {form.errors.permissions && (
                        <p className="text-sm text-destructive">
                            {form.errors.permissions}
                        </p>
                    )}

                    <div className="grid gap-4 md:grid-cols-2">
                        {groups.map((group) => {
                            const ids = group.permissions.map(
                                (permission) => permission.id,
                            );
                            const count = ids.filter((id) =>
                                selected.has(id),
                            ).length;
                            const groupId = `group-${group.group.replace(/\W+/g, '-').toLowerCase()}`;

                            return (
                                <fieldset
                                    key={group.group}
                                    className="overflow-hidden rounded-xl border"
                                >
                                    <legend className="sr-only">
                                        {group.group}
                                    </legend>
                                    <label
                                        htmlFor={groupId}
                                        className="flex cursor-pointer items-center gap-3 border-b bg-muted/40 px-4 py-3"
                                    >
                                        <Checkbox
                                            id={groupId}
                                            checked={
                                                count === ids.length
                                                    ? true
                                                    : count > 0
                                                      ? 'indeterminate'
                                                      : false
                                            }
                                            onCheckedChange={(
                                                checked:
                                                    | boolean
                                                    | 'indeterminate',
                                            ) => setMany(ids, checked === true)}
                                        />
                                        <span className="flex-1 font-medium">
                                            {group.group}
                                        </span>
                                        <span className="text-xs text-muted-foreground tabular-nums">
                                            {count}/{ids.length}
                                        </span>
                                    </label>
                                    <div className="grid gap-1 p-2">
                                        {group.permissions.map((permission) => {
                                            const id = `permission-${permission.id}`;

                                            return (
                                                <label
                                                    key={permission.id}
                                                    htmlFor={id}
                                                    className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50"
                                                    title={permission.slug}
                                                >
                                                    <Checkbox
                                                        id={id}
                                                        checked={selected.has(
                                                            permission.id,
                                                        )}
                                                        onCheckedChange={(
                                                            checked:
                                                                | boolean
                                                                | 'indeterminate',
                                                        ) =>
                                                            setMany(
                                                                [permission.id],
                                                                checked ===
                                                                    true,
                                                            )
                                                        }
                                                    />
                                                    {permission.name}
                                                </label>
                                            );
                                        })}
                                    </div>
                                </fieldset>
                            );
                        })}
                    </div>
                </div>
            </div>

            <DialogFooter className="border-t px-6 py-4">
                <Button type="button" variant="outline" onClick={onClose}>
                    Cancel
                </Button>
                <Button type="submit" disabled={form.processing}>
                    {role ? 'Save changes' : 'Create role'}
                </Button>
            </DialogFooter>
        </form>
    );
}
