import { Head, router, useForm, usePage } from '@inertiajs/react';
import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useInitials } from '@/hooks/use-initials';
import { destroy as destroyPhoto } from '@/routes/profile-photo';
import { edit, update } from '@/routes/profile';

export default function Profile() {
    const { auth } = usePage().props;
    const getInitials = useInitials();
    const photoInput = useRef<HTMLInputElement>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);

    const form = useForm<{
        name: string;
        email: string;
        photo: File | null;
        _method: 'patch';
    }>({
        name: auth.user.name,
        email: auth.user.email,
        photo: null,
        _method: 'patch',
    });

    const submit = (event: FormEvent) => {
        event.preventDefault();

        // POST + _method=patch so the optional photo can be sent as multipart.
        form.post(update.url(), {
            preserveScroll: true,
            forceFormData: true,
            onSuccess: () => {
                form.setData('photo', null);
                setPhotoPreview(null);

                if (photoInput.current) {
                    photoInput.current.value = '';
                }
            },
        });
    };

    const selectPhoto = (file: File | null) => {
        form.setData('photo', file);
        setPhotoPreview(file ? URL.createObjectURL(file) : null);
    };

    const removePhoto = () => {
        router.delete(destroyPhoto.url(), { preserveScroll: true });
    };

    const currentPhoto = photoPreview ?? auth.user.avatar ?? undefined;

    return (
        <>
            <Head title="Profile settings" />

            <h1 className="sr-only">Profile settings</h1>

            <div className="space-y-6">
                <Heading
                    variant="small"
                    title="Profile"
                    description="Update your photo, name and email address"
                />

                <form onSubmit={submit} className="space-y-6">
                    <div className="grid gap-2">
                        <Label>Photo</Label>
                        <div className="flex items-center gap-4">
                            <Avatar className="size-16 overflow-hidden rounded-full">
                                <AvatarImage
                                    src={currentPhoto}
                                    alt={auth.user.name}
                                    className="object-cover"
                                />
                                <AvatarFallback className="text-lg">
                                    {getInitials(auth.user.name)}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-wrap gap-2">
                                <input
                                    ref={photoInput}
                                    type="file"
                                    accept="image/png,image/jpeg"
                                    className="hidden"
                                    onChange={(event) =>
                                        selectPhoto(
                                            event.target.files?.[0] ?? null,
                                        )
                                    }
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => photoInput.current?.click()}
                                >
                                    Select a new photo
                                </Button>
                                {auth.user.avatar && !photoPreview && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={removePhoto}
                                    >
                                        Remove photo
                                    </Button>
                                )}
                            </div>
                        </div>
                        <InputError message={form.errors.photo} />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="name">Name</Label>
                        <Input
                            id="name"
                            className="mt-1 block w-full"
                            value={form.data.name}
                            onChange={(event) =>
                                form.setData('name', event.target.value)
                            }
                            required
                            autoComplete="name"
                            placeholder="Full name"
                        />
                        <InputError
                            className="mt-2"
                            message={form.errors.name}
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="email">Email address</Label>
                        <Input
                            id="email"
                            type="email"
                            className="mt-1 block w-full"
                            value={form.data.email}
                            onChange={(event) =>
                                form.setData('email', event.target.value)
                            }
                            required
                            autoComplete="username"
                            placeholder="Email address"
                        />
                        <InputError
                            className="mt-2"
                            message={form.errors.email}
                        />
                    </div>

                    <div className="grid gap-1 rounded-md border bg-muted/30 p-3 text-sm">
                        <span className="text-muted-foreground">
                            Department
                        </span>
                        <span className="font-medium">
                            {auth.user.department?.name ?? 'Not assigned'}
                        </span>
                        <span className="mt-2 text-muted-foreground">
                            Designation
                        </span>
                        <span className="font-medium">
                            {auth.user.designation?.name ?? 'Not assigned'}
                        </span>
                        <p className="mt-2 text-xs text-muted-foreground">
                            Department and designation are managed by the
                            administrator.
                        </p>
                    </div>

                    <div className="flex items-center gap-4">
                        <Button
                            disabled={form.processing}
                            data-test="update-profile-button"
                        >
                            Save
                        </Button>
                    </div>
                </form>
            </div>
        </>
    );
}

Profile.layout = {
    breadcrumbs: [
        {
            title: 'Profile settings',
            href: edit(),
        },
    ],
};
