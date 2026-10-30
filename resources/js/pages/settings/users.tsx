import { Head, router, useForm, usePage } from '@inertiajs/react';
import {
    Eye,
    KeyRound,
    MoreHorizontal,
    Pencil,
    UserPlus,
    Users,
} from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { DataPagination } from '@/components/data-pagination';
import { EmptyState } from '@/components/empty-state';
import { FormField } from '@/components/form-field';
import { FormSelect } from '@/components/form-select';
import Heading from '@/components/heading';
import { SearchForm } from '@/components/search-form';
import { ActiveBadge, RoleBadges } from '@/components/status-badges';
import { TablePanel } from '@/components/table-panel';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { useCan } from '@/hooks/use-can';
import { formatDate, initialsOf } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
    index as usersIndex,
    resetPassword,
    store as storeUser,
    update as updateUser,
} from '@/routes/users';
import type {
    AppUser,
    Department,
    Designation,
    Paginated,
    AppRole,
} from '@/types';

type Props = {
    users: Paginated<AppUser>;
    departments: Department[];
    designations: Designation[];
    roles: AppRole[];
    search: string | null;
};

/**
 * All accounts. Adding, editing (including roles) and password resets each
 * follow their own permission; viewing needs users.view.
 */
export default function UsersIndex({
    users,
    departments,
    designations,
    roles,
    search,
}: Props) {
    const can = useCan();
    const canCreate = can('users.create');
    const canEdit = can('users.update');
    const canReset = can('users.reset-password');

    const [roleFilter, setRoleFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [departmentFilter, setDepartmentFilter] = useState('');
    const [creating, setCreating] = useState(false);
    const [editing, setEditing] = useState<AppUser | null>(null);
    const [viewing, setViewing] = useState<AppUser | null>(null);
    const [resetting, setResetting] = useState<AppUser | null>(null);
    const [resetProcessing, setResetProcessing] = useState(false);

    // Client-side filters on the current page (same as the Blade version).
    const filtered = users.data.filter((user) => {
        if (
            roleFilter &&
            !user.roles?.some((role) => String(role.id) === roleFilter)
        ) {
            return false;
        }

        if (
            statusFilter &&
            (statusFilter === 'active') !== Boolean(user.status)
        ) {
            return false;
        }

        if (
            departmentFilter &&
            String(user.department_id ?? '') !== departmentFilter
        ) {
            return false;
        }

        return true;
    });

    const hasFilters = roleFilter || statusFilter || departmentFilter;

    const confirmReset = () => {
        if (!resetting) {
            return;
        }

        router.post(
            resetPassword.url(resetting.id),
            {},
            {
                preserveScroll: true,
                onStart: () => setResetProcessing(true),
                onFinish: () => {
                    setResetProcessing(false);
                    setResetting(null);
                },
            },
        );
    };

    return (
        <>
            <Head title="Users" />

            <div className="space-y-6">
                <Heading
                    variant="small"
                    title="Users"
                    description="All staff, CAO and admin accounts in the system"
                    actions={
                        canCreate && (
                            <Button onClick={() => setCreating(true)}>
                                <UserPlus />
                                Add user
                            </Button>
                        )
                    }
                />

                <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                        <SearchForm
                            url={usersIndex.url()}
                            defaultValue={search}
                            placeholder="Search users..."
                        />
                        <FormSelect
                            value={roleFilter}
                            onValueChange={(value) => setRoleFilter(value)}
                            className="w-40"
                            aria-label="Filter by role"
                            options={[
                                { value: '', label: 'All roles' },
                                ...roles.map((role) => ({
                                    value: role.id,
                                    label: role.name,
                                })),
                            ]}
                        />
                        <FormSelect
                            value={statusFilter}
                            onValueChange={(value) => setStatusFilter(value)}
                            className="w-40"
                            aria-label="Filter by status"
                            options={[
                                { value: '', label: 'All statuses' },
                                { value: 'active', label: 'Active' },
                                { value: 'inactive', label: 'Inactive' },
                            ]}
                        />
                        <FormSelect
                            value={departmentFilter}
                            onValueChange={(value) =>
                                setDepartmentFilter(value)
                            }
                            className="w-64"
                            aria-label="Filter by department"
                            options={[
                                { value: '', label: 'All departments' },
                                ...departments.map((department) => ({
                                    value: department.id,
                                    label: department.name,
                                })),
                            ]}
                        />
                        {hasFilters && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    setRoleFilter('');
                                    setStatusFilter('');
                                    setDepartmentFilter('');
                                }}
                            >
                                Clear filters
                            </Button>
                        )}
                    </div>

                    <TablePanel>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-14">ID</TableHead>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Role</TableHead>
                                    <TableHead>Department</TableHead>
                                    <TableHead>Designation</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">
                                        Actions
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filtered.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8}>
                                            <EmptyState
                                                icon={Users}
                                                title="No users found"
                                                description="Try a different search or filter."
                                            />
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filtered.map((user) => (
                                        <TableRow key={user.id}>
                                            <TableCell className="text-muted-foreground">
                                                {user.id}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <UserAvatar user={user} />
                                                    <span className="font-medium">
                                                        {user.name}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-muted-foreground">
                                                {user.email}
                                            </TableCell>
                                            <TableCell>
                                                <RoleBadges
                                                    roles={user.roles}
                                                />
                                            </TableCell>
                                            <TableCell className="max-w-56 truncate">
                                                {user.department?.name ?? 'N/A'}
                                            </TableCell>
                                            <TableCell className="max-w-56 truncate">
                                                {user.designation?.name ??
                                                    'N/A'}
                                            </TableCell>
                                            <TableCell>
                                                <ActiveBadge
                                                    active={Boolean(
                                                        user.status,
                                                    )}
                                                />
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() =>
                                                            setViewing(user)
                                                        }
                                                        aria-label={`View ${user.name}`}
                                                    >
                                                        <Eye />
                                                    </Button>
                                                    {canEdit && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() =>
                                                                setEditing(user)
                                                            }
                                                            aria-label={`Edit ${user.name}`}
                                                        >
                                                            <Pencil />
                                                        </Button>
                                                    )}
                                                    {canReset && (
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger
                                                                asChild
                                                            >
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    aria-label="More actions"
                                                                >
                                                                    <MoreHorizontal />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end">
                                                                <DropdownMenuItem
                                                                    onSelect={() =>
                                                                        setViewing(
                                                                            user,
                                                                        )
                                                                    }
                                                                >
                                                                    <Eye className="mr-2" />
                                                                    User details
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem
                                                                    onSelect={() =>
                                                                        setResetting(
                                                                            user,
                                                                        )
                                                                    }
                                                                >
                                                                    <KeyRound className="mr-2" />
                                                                    Reset
                                                                    password
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </TablePanel>

                    <DataPagination paginator={users} />

                    {canCreate && (
                        <CreateUserDialog
                            open={creating}
                            onOpenChange={setCreating}
                            departments={departments}
                            designations={designations}
                            roles={roles}
                        />
                    )}
                    {canEdit && (
                        <EditUserDialog
                            user={editing}
                            onClose={() => setEditing(null)}
                            departments={departments}
                            designations={designations}
                            roles={roles}
                        />
                    )}
                    {canReset && (
                        <ConfirmDialog
                            open={resetting !== null}
                            onOpenChange={(open) => !open && setResetting(null)}
                            title="Reset password?"
                            description={
                                resetting
                                    ? `${resetting.name}'s password will be reset to the default password (12345678) and they will be asked to change it.`
                                    : undefined
                            }
                            confirmLabel="Reset password"
                            destructive
                            processing={resetProcessing}
                            onConfirm={confirmReset}
                        />
                    )}
                </div>
            </div>

            <ViewUserDialog user={viewing} onClose={() => setViewing(null)} />
        </>
    );
}

UsersIndex.layout = {
    breadcrumbs: [{ title: 'Users', href: usersIndex() }],
};

function UserAvatar({
    user,
    className,
}: {
    user: AppUser;
    className?: string;
}) {
    return (
        <Avatar className={className ?? 'size-8'}>
            <AvatarImage src={user.avatar ?? undefined} alt={user.name} />
            <AvatarFallback>{initialsOf(user.name)}</AvatarFallback>
        </Avatar>
    );
}

function CreateUserDialog({
    open,
    onOpenChange,
    departments,
    designations,
    roles,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    departments: Department[];
    designations: Designation[];
    roles: AppRole[];
}) {
    const staff = roles.find((role) => role.slug === 'staff');
    const form = useForm({
        name: '',
        email: '',
        roles: staff ? [staff.id] : ([] as number[]),
        department_id: '',
        designation_id: '',
    });

    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.post(storeUser.url(), {
            preserveScroll: true,
            onSuccess: () => {
                form.reset();
                onOpenChange(false);
            },
        });
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(value: boolean) => {
                onOpenChange(value);

                if (!value) {
                    form.clearErrors();
                }
            }}
        >
            <DialogContent>
                <form onSubmit={submit} className="grid gap-4">
                    <DialogHeader>
                        <DialogTitle>Add user</DialogTitle>
                        <DialogDescription>
                            The account is created active with the default
                            password <strong>12345678</strong>. The user is
                            asked to change it on first login.
                        </DialogDescription>
                    </DialogHeader>
                    <FormField
                        label="Name"
                        htmlFor="create-name"
                        error={form.errors.name}
                        required
                    >
                        <Input
                            id="create-name"
                            value={form.data.name}
                            onChange={(e) =>
                                form.setData('name', e.target.value)
                            }
                            required
                        />
                    </FormField>
                    <FormField
                        label="Email"
                        htmlFor="create-email"
                        error={form.errors.email}
                        required
                    >
                        <Input
                            id="create-email"
                            type="email"
                            value={form.data.email}
                            onChange={(e) =>
                                form.setData('email', e.target.value)
                            }
                            required
                        />
                    </FormField>
                    <RolesPicker
                        idPrefix="create"
                        roles={roles}
                        value={form.data.roles}
                        onChange={(value) => form.setData('roles', value)}
                        error={form.errors.roles}
                    />
                    <FormField
                        label="Department"
                        htmlFor="create-department"
                        error={form.errors.department_id}
                        required
                    >
                        <FormSelect
                            id="create-department"
                            value={form.data.department_id}
                            onValueChange={(value) =>
                                form.setData('department_id', value)
                            }
                            required
                            placeholder="Select department"
                            options={departments.map((department) => ({
                                value: department.id,
                                label: department.name,
                            }))}
                        />
                    </FormField>
                    <FormField
                        label="Designation"
                        htmlFor="create-designation"
                        error={form.errors.designation_id}
                        required
                    >
                        <FormSelect
                            id="create-designation"
                            value={form.data.designation_id}
                            onValueChange={(value) =>
                                form.setData('designation_id', value)
                            }
                            required
                            placeholder="Select designation"
                            options={designations.map((designation) => ({
                                value: designation.id,
                                label: designation.name,
                            }))}
                        />
                    </FormField>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={form.processing}>
                            Create user
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function EditUserDialog({
    user,
    onClose,
    departments,
    designations,
    roles,
}: {
    user: AppUser | null;
    onClose: () => void;
    departments: Department[];
    designations: Designation[];
    roles: AppRole[];
}) {
    return (
        <Dialog
            open={user !== null}
            onOpenChange={(open: boolean) => !open && onClose()}
        >
            <DialogContent>
                {user && (
                    <EditUserForm
                        key={user.id}
                        user={user}
                        onClose={onClose}
                        departments={departments}
                        designations={designations}
                        roles={roles}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
}

function EditUserForm({
    user,
    onClose,
    departments,
    designations,
    roles,
}: {
    user: AppUser;
    onClose: () => void;
    departments: Department[];
    designations: Designation[];
    roles: AppRole[];
}) {
    const form = useForm({
        roles: (user.roles ?? []).map((role) => role.id),
        department_id: user.department_id ? String(user.department_id) : '',
        designation_id: user.designation_id ? String(user.designation_id) : '',
        status: Boolean(user.status),
    });

    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.transform((data) => ({ ...data, status: data.status ? 1 : 0 }));
        form.put(updateUser.url(user.id), {
            preserveScroll: true,
            onSuccess: () => onClose(),
        });
    };

    return (
        <form onSubmit={submit} className="grid gap-4">
            <DialogHeader>
                <DialogTitle>Edit user</DialogTitle>
                <DialogDescription>
                    {user.name} · {user.email}
                </DialogDescription>
            </DialogHeader>
            <RolesPicker
                idPrefix="edit"
                roles={roles}
                value={form.data.roles}
                onChange={(value) => form.setData('roles', value)}
                error={form.errors.roles}
            />
            <FormField
                label="Department"
                htmlFor="edit-department"
                error={form.errors.department_id}
                required
            >
                <FormSelect
                    id="edit-department"
                    value={form.data.department_id}
                    onValueChange={(value) =>
                        form.setData('department_id', value)
                    }
                    required
                    placeholder="Select department"
                    options={departments.map((department) => ({
                        value: department.id,
                        label: department.name,
                    }))}
                />
            </FormField>
            <FormField
                label="Designation"
                htmlFor="edit-designation"
                error={form.errors.designation_id}
                required
            >
                <FormSelect
                    id="edit-designation"
                    value={form.data.designation_id}
                    onValueChange={(value) =>
                        form.setData('designation_id', value)
                    }
                    required
                    placeholder="Select designation"
                    options={designations.map((designation) => ({
                        value: designation.id,
                        label: designation.name,
                    }))}
                />
            </FormField>
            <div className="flex items-center gap-3 rounded-md border p-3">
                <Checkbox
                    id="edit-status"
                    checked={form.data.status}
                    onCheckedChange={(checked: boolean | 'indeterminate') =>
                        form.setData('status', checked === true)
                    }
                />
                <div className="grid gap-0.5">
                    <Label htmlFor="edit-status">Active account</Label>
                    <p className="text-xs text-muted-foreground">
                        Inactive users cannot log in.
                    </p>
                </div>
            </div>
            <DialogFooter>
                <Button type="button" variant="outline" onClick={onClose}>
                    Cancel
                </Button>
                <Button type="submit" disabled={form.processing}>
                    Save changes
                </Button>
            </DialogFooter>
        </form>
    );
}

function ViewUserDialog({
    user,
    onClose,
}: {
    user: AppUser | null;
    onClose: () => void;
}) {
    return (
        <Dialog
            open={user !== null}
            onOpenChange={(open: boolean) => !open && onClose()}
        >
            <DialogContent>
                {user && (
                    <>
                        <DialogHeader>
                            <DialogTitle>User details</DialogTitle>
                        </DialogHeader>
                        <div className="flex flex-col items-center gap-3 text-center">
                            <UserAvatar user={user} className="size-20" />
                            <div>
                                <p className="text-lg font-semibold">
                                    {user.name}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    {user.email}
                                </p>
                            </div>
                            <div className="flex gap-2">
                                <RoleBadges roles={user.roles} />
                                <ActiveBadge active={Boolean(user.status)} />
                            </div>
                        </div>
                        <dl className="grid gap-3 rounded-md border p-4 text-sm sm:grid-cols-2">
                            <div>
                                <dt className="text-muted-foreground">
                                    Department
                                </dt>
                                <dd className="font-medium">
                                    {user.department?.name ?? 'Not assigned'}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-muted-foreground">
                                    Designation
                                </dt>
                                <dd className="font-medium">
                                    {user.designation?.name ?? 'Not assigned'}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-muted-foreground">
                                    Member since
                                </dt>
                                <dd className="font-medium">
                                    {formatDate(user.created_at)}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-muted-foreground">
                                    Last updated
                                </dt>
                                <dd className="font-medium">
                                    {formatDate(user.updated_at)}
                                </dd>
                            </div>
                        </dl>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}

/**
 * Pick one or more roles. Only an Administrator can give or take away the
 * Administrator role (the server checks this too).
 */
function RolesPicker({
    idPrefix,
    roles,
    value,
    onChange,
    error,
}: {
    idPrefix: string;
    roles: AppRole[];
    value: number[];
    onChange: (value: number[]) => void;
    error?: string;
}) {
    const { auth } = usePage().props;

    const toggle = (id: number, checked: boolean) =>
        onChange(
            checked ? [...value, id] : value.filter((roleId) => roleId !== id),
        );

    return (
        <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-medium">
                Roles <span className="text-destructive">*</span>
            </legend>
            <div className="grid max-h-56 gap-1 overflow-y-auto rounded-md border p-2">
                {roles.map((role) => {
                    const locked = role.slug === 'admin' && !auth.isSuperAdmin;
                    const id = `${idPrefix}-role-${role.id}`;

                    return (
                        <label
                            key={role.id}
                            htmlFor={id}
                            className={cn(
                                'flex cursor-pointer items-start gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50',
                                locked && 'cursor-not-allowed opacity-60',
                            )}
                        >
                            <Checkbox
                                id={id}
                                className="mt-0.5"
                                checked={value.includes(role.id)}
                                disabled={locked}
                                onCheckedChange={(
                                    checked: boolean | 'indeterminate',
                                ) => toggle(role.id, checked === true)}
                            />
                            <span className="grid gap-0.5">
                                <span className="text-sm font-medium">
                                    {role.name}
                                </span>
                                {role.description && (
                                    <span className="text-xs text-muted-foreground">
                                        {role.description}
                                    </span>
                                )}
                            </span>
                        </label>
                    );
                })}
            </div>
            <p className="text-xs text-muted-foreground">
                A person gets every permission of each role they hold.
            </p>
            {error && <p className="text-sm text-destructive">{error}</p>}
        </fieldset>
    );
}
