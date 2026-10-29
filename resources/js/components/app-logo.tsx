import AppLogoIcon from '@/components/app-logo-icon';

export default function AppLogo() {
    return (
        <>
            <div className="flex aspect-square size-8 items-center justify-center rounded-md bg-white p-0.5 ring-1 ring-sidebar-border">
                <AppLogoIcon className="size-7" />
            </div>
            <div className="ml-1 grid flex-1 text-left text-sm">
                <span className="truncate leading-tight font-semibold">
                    SINOP
                </span>
                <span className="truncate text-xs leading-tight text-muted-foreground">
                    CHED RO XII · Property &amp; Supply
                </span>
            </div>
        </>
    );
}
