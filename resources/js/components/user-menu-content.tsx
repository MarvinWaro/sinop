import { Link, router, usePage } from '@inertiajs/react';
import {
    LogOut,
    PenLine,
    Settings,
    ShieldCheck,
    UserRound,
} from 'lucide-react';
import {
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { UserInfo } from '@/components/user-info';
import { useCan } from '@/hooks/use-can';
import { useMobileNavigation } from '@/hooks/use-mobile-navigation';
import { logout } from '@/routes';
import { switchToAdmin, switchToUser } from '@/routes/admin';
import { edit } from '@/routes/profile';
import { edit as editSignature } from '@/routes/signature';
import type { User } from '@/types';

type Props = {
    user: User;
};

export function UserMenuContent({ user }: Props) {
    const cleanup = useMobileNavigation();
    const { auth } = usePage().props;
    const can = useCan();
    // Admin-side users can switch to "user mode" to request supplies themselves.
    const canSwitchMode = can('dashboard.view') && can('ris.request');

    const handleLogout = () => {
        cleanup();
        router.flushAll();
    };

    const switchMode = () => {
        cleanup();
        router.post(
            auth.isAdminUserMode ? switchToAdmin.url() : switchToUser.url(),
        );
    };

    return (
        <>
            <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                    <UserInfo user={user} showEmail={true} />
                </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
                <DropdownMenuItem asChild>
                    <Link
                        className="block w-full cursor-pointer"
                        href={edit()}
                        prefetch
                        onClick={cleanup}
                    >
                        <Settings className="mr-2" />
                        Settings
                    </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                    <Link
                        className="block w-full cursor-pointer"
                        href={editSignature()}
                        onClick={cleanup}
                    >
                        <PenLine className="mr-2" />
                        E-Signature
                    </Link>
                </DropdownMenuItem>
            </DropdownMenuGroup>
            {canSwitchMode && (
                <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        className="cursor-pointer"
                        onSelect={switchMode}
                    >
                        {auth.isAdminUserMode ? (
                            <>
                                <ShieldCheck className="mr-2" />
                                Back to admin mode
                            </>
                        ) : (
                            <>
                                <UserRound className="mr-2" />
                                Switch to user mode
                            </>
                        )}
                    </DropdownMenuItem>
                </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
                <Link
                    className="block w-full cursor-pointer"
                    href={logout()}
                    as="button"
                    onClick={handleLogout}
                    data-test="logout-button"
                >
                    <LogOut className="mr-2" />
                    Log out
                </Link>
            </DropdownMenuItem>
        </>
    );
}
