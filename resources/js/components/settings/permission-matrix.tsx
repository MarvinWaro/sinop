import { router } from '@inertiajs/react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import {
    CheckIcon,
    ChevronDown,
    Lock,
    MinusIcon,
    Pencil,
    SearchX,
    Trash2,
} from 'lucide-react';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Spinner } from '@/components/ui/spinner';
import { initialsOf } from '@/lib/format';
import { cn } from '@/lib/utils';
import { permissions as savePermissionsRoute } from '@/routes/roles';

export type MatrixRole = {
    id: number;
    name: string;
    users_count: number;
    permission_ids: number[];
    is_super_admin: boolean;
    is_built_in: boolean;
};

export type MatrixGroup = {
    group: string;
    permissions: { id: number; name: string; slug: string }[];
};

export type RoleHolders = {
    total: number;
    sample: { id: number; name: string; photo: string | null }[];
};

type Draft = Record<number, Set<number>>;

const fromRoles = (roles: MatrixRole[]): Draft =>
    Object.fromEntries(
        roles.map((role) => [role.id, new Set(role.permission_ids)]),
    );

/**
 * Every permission against every role, ticked in place: a row per
 * permission, grouped and collapsible, a column per role. Changes collect
 * until Save, which sends only the roles that changed. The Administrator
 * column is locked (it always has everything).
 */
export function PermissionMatrix<R extends MatrixRole>({
    roles,
    groups,
    people,
    filter,
    canEdit,
    canDelete,
    onEditRole,
    onDeleteRole,
}: {
    roles: R[];
    groups: MatrixGroup[];
    people: RoleHolders;
    filter: string;
    canEdit: boolean;
    canDelete: boolean;
    onEditRole: (role: R) => void;
    onDeleteRole: (role: R) => void;
}) {
    const [draft, setDraft] = useState<Draft>(() => fromRoles(roles));
    const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
    const [saving, setSaving] = useState(false);
    const saving$ = useRef(false);

    // Saved (or changed elsewhere): start again from what the server has.
    useEffect(() => setDraft(fromRoles(roles)), [roles]);

    const original = useMemo(() => fromRoles(roles), [roles]);
    const changedRoles = roles.filter((role) => {
        const before = original[role.id];
        const after = draft[role.id];

        return (
            !role.is_super_admin &&
            (before.size !== after.size ||
                [...after].some((id) => !before.has(id)))
        );
    });
    const changes = changedRoles.reduce((sum, role) => {
        const before = original[role.id];
        const after = draft[role.id];

        return (
            sum +
            [...after].filter((id) => !before.has(id)).length +
            [...before].filter((id) => !after.has(id)).length
        );
    }, 0);

    // Leaving with unsaved ticks asks first.
    useEffect(() => {
        if (changes === 0) {
            return;
        }

        const stopVisit = router.on('before', (event) => {
            if (
                !saving$.current &&
                event.detail.visit.method === 'get' &&
                !window.confirm('Leave without saving your permission changes?')
            ) {
                event.preventDefault();
            }
        });
        const onUnload = (event: BeforeUnloadEvent) => event.preventDefault();
        window.addEventListener('beforeunload', onUnload);

        return () => {
            stopVisit();
            window.removeEventListener('beforeunload', onUnload);
        };
    }, [changes]);

    const has = (role: MatrixRole, id: number) =>
        role.is_super_admin || draft[role.id].has(id);

    const set = (role: MatrixRole, ids: number[], on: boolean) =>
        setDraft((current) => {
            const next = new Set(current[role.id]);
            ids.forEach((id) => (on ? next.add(id) : next.delete(id)));

            return { ...current, [role.id]: next };
        });

    const save = () => {
        saving$.current = true;
        setSaving(true);
        router.put(
            savePermissionsRoute.url(),
            {
                roles: changedRoles.map((role) => ({
                    id: role.id,
                    permissions: [...draft[role.id]],
                })),
            },
            {
                preserveScroll: true,
                onFinish: () => {
                    saving$.current = false;
                    setSaving(false);
                },
            },
        );
    };

    const term = filter.trim().toLowerCase();
    const visibleGroups = groups
        .map((group) => ({
            ...group,
            rows:
                term === '' || group.group.toLowerCase().includes(term)
                    ? group.permissions
                    : group.permissions.filter((permission) =>
                          `${permission.name} ${permission.slug}`
                              .toLowerCase()
                              .includes(term),
                      ),
        }))
        .filter((group) => group.rows.length > 0);

    const toggleGroup = (name: string) =>
        setCollapsed((current) => {
            const next = new Set(current);

            if (next.has(name)) {
                next.delete(name);
            } else {
                next.add(name);
            }

            return next;
        });

    const lockedCell = (role: MatrixRole) =>
        role.is_super_admin && 'bg-muted/50 dark:bg-muted/30';

    return (
        <div className="overflow-hidden rounded-xl border bg-card">
            <div className="flex items-center justify-between gap-4 border-b px-5 py-4">
                <div className="min-w-0">
                    <h2 className="font-semibold">Roles and permissions</h2>
                    <p className="text-sm text-muted-foreground">
                        CHED RO XII ·{' '}
                        <span className="font-medium text-foreground tabular-nums">
                            {people.total}
                        </span>{' '}
                        {people.total === 1 ? 'person' : 'people'} across{' '}
                        <span className="font-medium text-foreground tabular-nums">
                            {roles.length}
                        </span>{' '}
                        {roles.length === 1 ? 'role' : 'roles'}
                    </p>
                </div>
                <PeopleStack people={people} />
            </div>

            <div className="max-h-[calc(100svh-15rem)] min-h-64 overflow-auto">
                <table className="w-full border-separate border-spacing-0 text-sm">
                    <thead>
                        <tr>
                            <th
                                scope="col"
                                className="sticky top-0 left-0 z-30 min-w-44 border-b bg-card px-5 py-3 text-left align-bottom text-xs font-normal text-muted-foreground sm:min-w-56"
                            >
                                Permission
                            </th>
                            {roles.map((role) => (
                                <th
                                    key={role.id}
                                    scope="col"
                                    className={cn(
                                        'sticky top-0 z-20 w-32 min-w-28 border-b bg-card px-2 py-2.5 align-bottom font-normal',
                                        role.is_super_admin &&
                                            'bg-muted dark:bg-muted/60',
                                    )}
                                >
                                    <RoleHeading
                                        role={role}
                                        canEdit={canEdit}
                                        canDelete={canDelete}
                                        onEdit={() => onEditRole(role)}
                                        onDelete={() => onDeleteRole(role)}
                                    />
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {visibleGroups.length === 0 && (
                            <tr>
                                <td colSpan={roles.length + 1}>
                                    <EmptyState
                                        icon={SearchX}
                                        title="No permissions match"
                                    />
                                </td>
                            </tr>
                        )}
                        {visibleGroups.map((group) => {
                            const ids = group.permissions.map(
                                (permission) => permission.id,
                            );
                            const open =
                                term !== '' || !collapsed.has(group.group);

                            return (
                                <Fragment key={group.group}>
                                    <tr className="group/row">
                                        <th
                                            scope="rowgroup"
                                            className="sticky left-0 z-10 border-b bg-card px-3 py-2.5 text-left font-medium group-hover/row:bg-muted"
                                        >
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    toggleGroup(group.group)
                                                }
                                                aria-expanded={open}
                                                className="flex items-center gap-2 rounded-md px-2 py-0.5 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                                            >
                                                <ChevronDown
                                                    className={cn(
                                                        'size-4 text-muted-foreground transition-transform',
                                                        !open && '-rotate-90',
                                                    )}
                                                />
                                                {group.group}
                                                <span className="font-normal text-muted-foreground tabular-nums">
                                                    {ids.length}
                                                </span>
                                            </button>
                                        </th>
                                        {roles.map((role) => {
                                            const count = ids.filter((id) =>
                                                has(role, id),
                                            ).length;

                                            return (
                                                <td
                                                    key={role.id}
                                                    className={cn(
                                                        'border-b text-center group-hover/row:bg-muted',
                                                        lockedCell(role),
                                                    )}
                                                >
                                                    <MatrixCheckbox
                                                        checked={
                                                            count === ids.length
                                                                ? true
                                                                : count > 0
                                                                  ? 'indeterminate'
                                                                  : false
                                                        }
                                                        locked={
                                                            role.is_super_admin
                                                        }
                                                        readOnly={!canEdit}
                                                        label={`All ${group.group} permissions for ${role.name}`}
                                                        onChange={(on) =>
                                                            set(role, ids, on)
                                                        }
                                                    />
                                                </td>
                                            );
                                        })}
                                    </tr>
                                    {open &&
                                        group.rows.map((permission) => (
                                            <tr
                                                key={permission.id}
                                                className="group/row"
                                            >
                                                <th
                                                    scope="row"
                                                    title={permission.slug}
                                                    className="sticky left-0 z-10 border-b bg-card py-2.5 pr-5 pl-12 text-left font-normal group-hover/row:bg-muted"
                                                >
                                                    {permission.name}
                                                </th>
                                                {roles.map((role) => {
                                                    const on = has(
                                                        role,
                                                        permission.id,
                                                    );
                                                    const changed =
                                                        !role.is_super_admin &&
                                                        on !==
                                                            original[
                                                                role.id
                                                            ].has(
                                                                permission.id,
                                                            );

                                                    return (
                                                        <td
                                                            key={role.id}
                                                            className={cn(
                                                                'border-b text-center group-hover/row:bg-muted',
                                                                lockedCell(
                                                                    role,
                                                                ),
                                                                changed &&
                                                                    'bg-amber-500/10 group-hover/row:bg-amber-500/15',
                                                            )}
                                                        >
                                                            <MatrixCheckbox
                                                                checked={on}
                                                                locked={
                                                                    role.is_super_admin
                                                                }
                                                                readOnly={
                                                                    !canEdit
                                                                }
                                                                label={`${permission.name} for ${role.name}`}
                                                                onChange={(
                                                                    value,
                                                                ) =>
                                                                    set(
                                                                        role,
                                                                        [
                                                                            permission.id,
                                                                        ],
                                                                        value,
                                                                    )
                                                                }
                                                            />
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))}
                                </Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {canEdit && (
                <div
                    className={cn(
                        'flex items-center justify-between gap-3 border-t px-5 py-3 text-sm',
                        changes === 0 && 'text-muted-foreground',
                    )}
                    aria-live="polite"
                >
                    <span>
                        {changes === 0 ? (
                            'Tick a box to give a role a permission. Administrator always has all of them.'
                        ) : (
                            <>
                                <span className="mr-1.5 inline-block size-2 rounded-full bg-amber-500 align-middle" />
                                <span className="font-medium tabular-nums">
                                    {changes}
                                </span>{' '}
                                unsaved {changes === 1 ? 'change' : 'changes'}{' '}
                                in{' '}
                                {changedRoles
                                    .map((role) => role.name)
                                    .join(', ')}
                            </>
                        )}
                    </span>
                    {changes > 0 && (
                        <div className="flex shrink-0 gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={saving}
                                onClick={() => setDraft(fromRoles(roles))}
                            >
                                Discard
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                disabled={saving}
                                onClick={save}
                            >
                                {saving && <Spinner />}
                                Save changes
                            </Button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function RoleHeading({
    role,
    canEdit,
    canDelete,
    onEdit,
    onDelete,
}: {
    role: MatrixRole;
    canEdit: boolean;
    canDelete: boolean;
    onEdit: () => void;
    onDelete: () => void;
}) {
    const people = `${role.users_count} ${role.users_count === 1 ? 'person' : 'people'}`;
    const deletable = canDelete && !role.is_built_in;

    if (role.is_super_admin || (!canEdit && !deletable)) {
        return (
            <div className="flex flex-col items-center gap-0.5">
                <span className="flex items-center gap-1 font-semibold">
                    {role.is_super_admin && (
                        <Lock
                            className="size-3.5 text-muted-foreground"
                            aria-label="Locked"
                        />
                    )}
                    {role.name}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">
                    {people}
                </span>
            </div>
        );
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    className="mx-auto flex flex-col items-center gap-0.5 rounded-md px-2 py-1 outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                    <span className="flex items-center gap-1 font-semibold">
                        {role.name}
                        <ChevronDown className="size-3.5 text-muted-foreground" />
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                        {people}
                    </span>
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center">
                {canEdit && (
                    <DropdownMenuItem onSelect={onEdit}>
                        <Pencil />
                        Edit role
                    </DropdownMenuItem>
                )}
                {deletable && (
                    <>
                        {canEdit && <DropdownMenuSeparator />}
                        <DropdownMenuItem
                            variant="destructive"
                            onSelect={onDelete}
                        >
                            <Trash2 />
                            Delete role
                        </DropdownMenuItem>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

/** A tick box for one cell: a check, a dash (some of a group) or empty. */
function MatrixCheckbox({
    checked,
    locked,
    readOnly,
    label,
    onChange,
}: {
    checked: boolean | 'indeterminate';
    locked: boolean;
    readOnly: boolean;
    label: string;
    onChange: (checked: boolean) => void;
}) {
    return (
        <CheckboxPrimitive.Root
            checked={checked}
            disabled={locked || readOnly}
            aria-label={label}
            onCheckedChange={(value) => onChange(value === true)}
            className={cn(
                'inline-flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-input align-middle shadow-xs transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                'data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground',
                'data-[state=indeterminate]:border-foreground/70 data-[state=indeterminate]:text-foreground',
                locked
                    ? 'cursor-not-allowed opacity-45'
                    : readOnly
                      ? 'cursor-default'
                      : 'cursor-pointer hover:border-foreground/50',
            )}
        >
            <CheckboxPrimitive.Indicator className="flex items-center justify-center">
                {checked === 'indeterminate' ? (
                    <MinusIcon className="size-3" strokeWidth={3} />
                ) : (
                    <CheckIcon className="size-3.5" strokeWidth={3} />
                )}
            </CheckboxPrimitive.Indicator>
        </CheckboxPrimitive.Root>
    );
}

/** A few of the people who hold roles, and how many more. */
function PeopleStack({ people }: { people: RoleHolders }) {
    const more = people.total - people.sample.length;

    return (
        <div className="hidden shrink-0 items-center sm:flex" aria-hidden>
            {people.sample.map((person) => (
                <span
                    key={person.id}
                    title={person.name}
                    className="relative -ml-1.5 flex size-8 items-center justify-center overflow-hidden rounded-full bg-muted text-[11px] font-medium ring-2 ring-card first:ml-0"
                >
                    {initialsOf(person.name)}
                    {person.photo && (
                        // Over the initials; a missing file leaves them showing.
                        <img
                            src={person.photo}
                            alt=""
                            onError={(event) => {
                                event.currentTarget.style.display = 'none';
                            }}
                            className="absolute inset-0 size-full object-cover"
                        />
                    )}
                </span>
            ))}
            {more > 0 && (
                <span className="-ml-1.5 flex h-8 min-w-8 items-center justify-center rounded-full bg-muted px-1.5 text-[11px] font-medium text-muted-foreground tabular-nums ring-2 ring-card">
                    +{more}
                </span>
            )}
        </div>
    );
}
