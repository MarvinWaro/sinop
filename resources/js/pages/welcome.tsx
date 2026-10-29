import { Head, Link, usePage } from '@inertiajs/react';
import { ClipboardList, FileSpreadsheet, Laptop, Package } from 'lucide-react';
import AppLogoIcon from '@/components/app-logo-icon';
import { Button } from '@/components/ui/button';
import { dashboard, login, register } from '@/routes';

const features = [
    {
        icon: ClipboardList,
        title: 'Supply requests',
        description:
            'Request office supplies online and follow each RIS from approval to issuance.',
    },
    {
        icon: Package,
        title: 'Stock & IAR',
        description:
            'Record deliveries, track stock levels and get low-stock warnings.',
    },
    {
        icon: Laptop,
        title: 'Property & MR',
        description:
            'Keep laptops, furniture and equipment on record with the accountable employee.',
    },
    {
        icon: FileSpreadsheet,
        title: 'Reports',
        description:
            'Stock cards, ledger cards, RSMI and RPCI ready to print or export.',
    },
];

export default function Welcome() {
    const { auth } = usePage().props;

    return (
        <>
            <Head title="Welcome" />
            <div className="flex min-h-svh flex-col bg-background">
                <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
                    <div className="flex items-center gap-3">
                        <AppLogoIcon className="size-10" />
                        <div className="leading-tight">
                            <p className="font-semibold">SINOP</p>
                            <p className="text-xs text-muted-foreground">
                                CHED Regional Office XII
                            </p>
                        </div>
                    </div>
                    <nav className="flex items-center gap-2">
                        {auth.user ? (
                            <Button asChild>
                                <Link href={dashboard()}>Go to dashboard</Link>
                            </Button>
                        ) : (
                            <>
                                <Button asChild variant="ghost">
                                    <Link href={login()}>Log in</Link>
                                </Button>
                                <Button asChild>
                                    <Link href={register()}>Register</Link>
                                </Button>
                            </>
                        )}
                    </nav>
                </header>

                <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center gap-12 px-6 py-12">
                    <section className="max-w-2xl space-y-5">
                        <p className="text-sm font-medium text-muted-foreground">
                            Masinop na pamamahala ng ari-arian at kagamitan
                        </p>
                        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
                            Property and supply management for CHEDRO XII
                        </h1>
                        <p className="text-lg text-muted-foreground">
                            SINOP keeps the office&apos;s supplies, requisitions
                            and accountable property records in one place.
                        </p>
                        <div className="flex flex-wrap gap-3">
                            {auth.user ? (
                                <Button asChild size="lg">
                                    <Link href={dashboard()}>
                                        Go to dashboard
                                    </Link>
                                </Button>
                            ) : (
                                <>
                                    <Button asChild size="lg">
                                        <Link href={login()}>Log in</Link>
                                    </Button>
                                    <Button asChild size="lg" variant="outline">
                                        <Link href={register()}>
                                            Create an account
                                        </Link>
                                    </Button>
                                </>
                            )}
                        </div>
                    </section>

                    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {features.map((feature) => (
                            <div
                                key={feature.title}
                                className="rounded-xl border bg-card p-5"
                            >
                                <feature.icon className="mb-3 size-5 text-muted-foreground" />
                                <h2 className="font-medium">{feature.title}</h2>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    {feature.description}
                                </p>
                            </div>
                        ))}
                    </section>
                </main>

                <footer className="py-6 text-center text-sm text-muted-foreground">
                    © {new Date().getFullYear()} CHED Regional Office XII
                </footer>
            </div>
        </>
    );
}
