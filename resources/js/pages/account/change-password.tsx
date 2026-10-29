import { Head, useForm } from '@inertiajs/react';
import { KeyRound, ShieldCheck } from 'lucide-react';
import type { FormEvent } from 'react';
import { FormField } from '@/components/form-field';
import { PageContainer } from '@/components/page-header';
import PasswordInput from '@/components/password-input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { forceChangePassword } from '@/routes/user';
import { update } from '@/routes/user/force-change-password';

export default function ChangePassword() {
    const form = useForm({
        password: '',
        password_confirmation: '',
    });

    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.post(update.url(), {
            onFinish: () => form.reset('password', 'password_confirmation'),
        });
    };

    return (
        <>
            <Head title="Change password" />
            <PageContainer className="items-center justify-center">
                <Card className="w-full max-w-md">
                    <CardHeader>
                        <div className="mb-2 w-fit rounded-md border bg-muted/50 p-2 text-muted-foreground">
                            <KeyRound className="size-5" />
                        </div>
                        <CardTitle>Set your new password</CardTitle>
                        <CardDescription>
                            Your account was created by an administrator. Please
                            set a new secure password to continue.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={submit} className="grid gap-4">
                            <FormField
                                label="New password"
                                htmlFor="password"
                                error={form.errors.password}
                                hint="At least 8 characters. Mix letters, numbers and symbols."
                                required
                            >
                                <PasswordInput
                                    id="password"
                                    value={form.data.password}
                                    onChange={(e) =>
                                        form.setData('password', e.target.value)
                                    }
                                    autoComplete="new-password"
                                    minLength={8}
                                    required
                                    autoFocus
                                />
                            </FormField>
                            <FormField
                                label="Confirm new password"
                                htmlFor="password_confirmation"
                                error={form.errors.password_confirmation}
                                required
                            >
                                <PasswordInput
                                    id="password_confirmation"
                                    value={form.data.password_confirmation}
                                    onChange={(e) =>
                                        form.setData(
                                            'password_confirmation',
                                            e.target.value,
                                        )
                                    }
                                    autoComplete="new-password"
                                    minLength={8}
                                    required
                                />
                            </FormField>
                            <Alert>
                                <ShieldCheck />
                                <AlertTitle>Keep it unique</AlertTitle>
                                <AlertDescription>
                                    For your security, use a password you don't
                                    use anywhere else.
                                </AlertDescription>
                            </Alert>
                            <Button type="submit" disabled={form.processing}>
                                Set new password
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </PageContainer>
        </>
    );
}

ChangePassword.layout = {
    breadcrumbs: [{ title: 'Change password', href: forceChangePassword() }],
};
