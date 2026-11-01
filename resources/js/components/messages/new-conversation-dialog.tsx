import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { FormField } from '@/components/form-field';
import { kindIcons } from '@/components/messages/message-parts';
import { errorText } from '@/components/messages/use-messages';
import { SearchableSelect } from '@/components/searchable-select';
import { RisStatusBadge } from '@/components/status-badges';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { formatDate } from '@/lib/format';
import { getJson, HttpError, postJson } from '@/lib/http';
import { cn } from '@/lib/utils';
import {
    options as optionsRoute,
    start as startRoute,
} from '@/routes/messages';
import type {
    ConversationKind,
    ConversationSummary,
    MessageOptions,
    MessagePerson,
} from '@/types';

/** A conversation about this request, with this person (from `?ris=`). */
export type ConversationPreset = {
    ris: { id: number; no: string };
    requester: MessagePerson;
};

const TOPICS: { kind: ConversationKind; label: string; hint: string }[] = [
    {
        kind: 'request',
        label: 'A request',
        hint: 'An RIS: items, pickup, status',
    },
    { kind: 'concern', label: 'A concern', hint: 'A property, or a problem' },
    { kind: 'general', label: 'Something else', hint: 'Any other question' },
];

/**
 * Starts a conversation with its first message. Requesters write to the
 * supply office; the office first picks who it writes to. A request
 * conversation that already exists gets the message instead.
 */
export function NewConversationDialog({
    open,
    onOpenChange,
    officeView,
    people,
    preset,
    onStarted,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    officeView: boolean;
    people: MessagePerson[];
    preset: ConversationPreset | null;
    onStarted: (conversation: ConversationSummary) => void;
}) {
    const [personId, setPersonId] = useState('');
    const [kind, setKind] = useState<ConversationKind>('request');
    const [risId, setRisId] = useState('');
    const [propertyId, setPropertyId] = useState('');
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [sending, setSending] = useState(false);
    const [choices, setChoices] = useState<MessageOptions | null>(null);

    // Fresh each time it opens, filled in from the link that opened it.
    useEffect(() => {
        if (!open) {
            return;
        }

        setPersonId(preset ? String(preset.requester.id) : '');
        setKind('request');
        setRisId(preset ? String(preset.ris.id) : '');
        setPropertyId('');
        setSubject('');
        setBody('');
        setErrors({});
    }, [open, preset]);

    // What this person can write about: their requests and properties.
    const optionsFor = officeView ? personId : 'me';

    useEffect(() => {
        if (!open || preset || !optionsFor) {
            setChoices(null);

            return;
        }

        let current = true;
        setChoices(null);
        getJson<MessageOptions>(optionsRoute.url(), {
            requester: officeView ? personId : undefined,
        })
            .then((result) => current && setChoices(result))
            .catch(
                () => current && setChoices({ requests: [], properties: [] }),
            );

        return () => {
            current = false;
        };
    }, [open, preset, optionsFor, officeView, personId]);

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        setSending(true);
        setErrors({});

        try {
            const { conversation } = await postJson<{
                conversation: ConversationSummary;
            }>(startRoute.url(), {
                kind: preset ? 'request' : kind,
                ris_id: preset
                    ? preset.ris.id
                    : kind === 'request'
                      ? Number(risId) || null
                      : null,
                property_id:
                    !preset && kind === 'concern' && propertyId
                        ? Number(propertyId)
                        : null,
                subject: preset || kind === 'request' ? null : subject,
                ...(officeView && !preset
                    ? { requester_id: Number(personId) || null }
                    : {}),
                body,
            });

            onStarted(conversation);
            onOpenChange(false);
        } catch (error) {
            const fields =
                error instanceof HttpError &&
                (error.data as { errors?: Record<string, string[]> })?.errors;

            if (fields) {
                setErrors(
                    Object.fromEntries(
                        Object.entries(fields).map(([key, messages]) => [
                            key,
                            messages[0],
                        ]),
                    ),
                );
            } else {
                setErrors({
                    body: errorText(error, 'It could not be sent. Try again.'),
                });
            }
        } finally {
            setSending(false);
        }
    };

    const person = people.find((item) => String(item.id) === personId);
    const needsPerson = officeView && !preset && !personId;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <form onSubmit={submit} className="grid gap-5">
                    <DialogHeader>
                        <DialogTitle>
                            {officeView
                                ? 'New conversation'
                                : 'Ask the supply office'}
                        </DialogTitle>
                        <DialogDescription>
                            {officeView
                                ? 'Write to a requester. Everyone in the supply office will see the conversation.'
                                : 'Anyone in the supply office can answer. You’ll see their reply here.'}
                        </DialogDescription>
                    </DialogHeader>

                    {preset ? (
                        <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">
                            About{' '}
                            <span className="font-medium">{preset.ris.no}</span>
                            {officeView && (
                                <>
                                    {' '}
                                    with{' '}
                                    <span className="font-medium">
                                        {preset.requester.name}
                                    </span>
                                </>
                            )}
                        </p>
                    ) : (
                        <>
                            {officeView && (
                                <FormField
                                    label="To"
                                    htmlFor="message-person"
                                    error={errors.requester_id}
                                    required
                                >
                                    <SearchableSelect
                                        id="message-person"
                                        options={people.map((item) => ({
                                            value: String(item.id),
                                            label: item.name,
                                            description: item.division,
                                        }))}
                                        value={personId}
                                        onChange={(value) => {
                                            setPersonId(value);
                                            setRisId('');
                                            setPropertyId('');
                                        }}
                                        placeholder="Choose a person"
                                        searchPlaceholder="Search people"
                                        invalid={!!errors.requester_id}
                                    />
                                </FormField>
                            )}

                            <fieldset
                                className="grid gap-2"
                                disabled={needsPerson}
                            >
                                <legend className="mb-2 text-sm font-medium">
                                    About
                                </legend>
                                <div className="grid gap-2 sm:grid-cols-3">
                                    {TOPICS.map((topic) => {
                                        const Icon = kindIcons[topic.kind];

                                        return (
                                            <label
                                                key={topic.kind}
                                                className={cn(
                                                    'flex cursor-pointer flex-col gap-1 rounded-lg border p-3 text-sm transition-colors has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50',
                                                    kind === topic.kind
                                                        ? 'border-primary bg-primary/5'
                                                        : 'hover:bg-muted/60',
                                                    needsPerson &&
                                                        'cursor-not-allowed opacity-60',
                                                )}
                                            >
                                                <input
                                                    type="radio"
                                                    name="kind"
                                                    value={topic.kind}
                                                    checked={
                                                        kind === topic.kind
                                                    }
                                                    onChange={() =>
                                                        setKind(topic.kind)
                                                    }
                                                    className="sr-only"
                                                />
                                                <span className="flex items-center gap-2 font-medium">
                                                    <Icon className="size-4 text-muted-foreground" />
                                                    {topic.label}
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                    {topic.hint}
                                                </span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </fieldset>

                            {!needsPerson && kind === 'request' && (
                                <FormField
                                    label="Request"
                                    htmlFor="message-ris"
                                    error={errors.ris_id}
                                    required
                                >
                                    {choices === null ? (
                                        <Loading />
                                    ) : choices.requests.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">
                                            {officeView
                                                ? `${person ? person.name.split(' ')[0] : 'This person'} has no requests yet.`
                                                : 'You have no requests yet.'}
                                        </p>
                                    ) : (
                                        <SearchableSelect
                                            id="message-ris"
                                            options={choices.requests.map(
                                                (ris) => ({
                                                    value: String(ris.id),
                                                    label: ris.no,
                                                    meta: ris.requested_at
                                                        ? formatDate(
                                                              ris.requested_at,
                                                          )
                                                        : null,
                                                }),
                                            )}
                                            value={risId}
                                            onChange={setRisId}
                                            placeholder="Choose a request"
                                            searchPlaceholder="Search RIS numbers"
                                            invalid={!!errors.ris_id}
                                        />
                                    )}
                                    {choices?.requests
                                        .filter(
                                            (ris) => String(ris.id) === risId,
                                        )
                                        .map((ris) => (
                                            <RisStatusBadge
                                                key={ris.id}
                                                slip={ris}
                                                className="w-fit"
                                            />
                                        ))}
                                </FormField>
                            )}

                            {!needsPerson && kind === 'concern' && (
                                <FormField
                                    label="Property"
                                    htmlFor="message-property"
                                    error={errors.property_id}
                                    hint="Optional. Choose one if the concern is about an item."
                                >
                                    {choices === null ? (
                                        <Loading />
                                    ) : (
                                        <SearchableSelect
                                            id="message-property"
                                            options={choices.properties.map(
                                                (property) => ({
                                                    value: String(property.id),
                                                    label: property.name,
                                                    meta: property.number,
                                                }),
                                            )}
                                            value={propertyId}
                                            onChange={setPropertyId}
                                            placeholder={
                                                choices.properties.length
                                                    ? 'Choose a property'
                                                    : 'No properties'
                                            }
                                            searchPlaceholder="Search properties"
                                            emptyText="No properties match"
                                            disabled={
                                                choices.properties.length === 0
                                            }
                                        />
                                    )}
                                </FormField>
                            )}

                            {!needsPerson && kind !== 'request' && (
                                <FormField
                                    label="Subject"
                                    htmlFor="message-subject"
                                    error={errors.subject}
                                    required={
                                        !(kind === 'concern' && propertyId)
                                    }
                                    hint={
                                        kind === 'concern' && propertyId
                                            ? 'Leave it blank to use the property’s name.'
                                            : undefined
                                    }
                                >
                                    <Input
                                        id="message-subject"
                                        value={subject}
                                        onChange={(event) =>
                                            setSubject(event.target.value)
                                        }
                                        maxLength={255}
                                        placeholder={
                                            kind === 'concern'
                                                ? 'e.g. Printer won’t turn on'
                                                : 'e.g. Year-end inventory'
                                        }
                                        aria-invalid={!!errors.subject}
                                    />
                                </FormField>
                            )}
                        </>
                    )}

                    <FormField
                        label="Message"
                        htmlFor="message-body"
                        error={errors.body}
                        required
                    >
                        <Textarea
                            id="message-body"
                            value={body}
                            onChange={(event) => setBody(event.target.value)}
                            maxLength={5000}
                            rows={4}
                            disabled={needsPerson}
                            aria-invalid={!!errors.body}
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
                        <Button
                            type="submit"
                            disabled={sending || needsPerson || !body.trim()}
                        >
                            {sending && <Spinner />}
                            Send
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function Loading() {
    return (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner />
            Loading…
        </p>
    );
}
