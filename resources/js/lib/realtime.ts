import type { ChannelAuthorizationCallback } from 'pusher-js';
import type Pusher from 'pusher-js';
import { postJson } from '@/lib/http';
import type { BroadcastingConfig } from '@/types';

/**
 * Live updates from Berth's Soketi app (Pusher protocol): one WebSocket per
 * tab, opened the first time a signed-in page listens. pusher-js is only
 * downloaded then. Signals carry no data; the page asks the server again,
 * which still decides what its reader may see.
 */

export type LiveStatus = 'connecting' | 'connected' | 'unavailable';

/** Gets the event's data, or nothing when run after a reconnect. */
type Listener = (data?: unknown) => void;

/** Where private channels are signed with the session (bootstrap/app.php). */
const AUTH_URL = '/broadcasting/auth';

let socket: Promise<Pusher> | null = null;
let socketFor = '';
let status: LiveStatus = 'connecting';
const listeners = new Set<Listener>();
// Listeners per channel, to leave a channel once nobody listens (logout).
const followers = new Map<string, number>();
const statusListeners = new Set<(status: LiveStatus) => void>();

/**
 * Hear `event` on the private `channel`. Returns the function that stops
 * listening. After a dropped connection comes back, every listener runs
 * once (without data), since anything sent meanwhile went unheard.
 */
export function listen(
    config: BroadcastingConfig,
    channel: string,
    event: string,
    listener: Listener,
): () => void {
    const name = `private-${channel}`;
    const connection = connect(config);
    let listening = true;

    listeners.add(listener);
    followers.set(name, (followers.get(name) ?? 0) + 1);
    void connection.then((pusher) => {
        if (listening) {
            (pusher.channel(name) ?? pusher.subscribe(name)).bind(
                event,
                listener,
            );
        }
    });

    return () => {
        listening = false;
        listeners.delete(listener);
        followers.set(name, (followers.get(name) ?? 1) - 1);
        void connection.then((pusher) => {
            pusher.channel(name)?.unbind(event, listener);

            if ((followers.get(name) ?? 0) <= 0) {
                followers.delete(name);
                pusher.unsubscribe(name);
            }
        });
    };
}

/** Follow whether live updates come through; told the current state at once. */
export function onLiveStatus(
    config: BroadcastingConfig,
    listener: (status: LiveStatus) => void,
): () => void {
    void connect(config);
    statusListeners.add(listener);
    listener(status);

    return () => {
        statusListeners.delete(listener);
    };
}

function connect(config: BroadcastingConfig): Promise<Pusher> {
    const target = `${config.key}@${config.host}:${config.port}`;

    if (socket !== null && socketFor === target) {
        return socket;
    }

    void socket?.then((pusher) => pusher.disconnect());
    socketFor = target;
    socket = import('pusher-js').then(({ default: PusherClient }) => {
        const pusher = new PusherClient(config.key ?? '', {
            cluster: config.cluster ?? 'mt1',
            wsHost: config.host ?? undefined,
            wsPort: config.port,
            wssPort: config.port,
            forceTLS: config.scheme === 'https',
            enabledTransports: ['ws', 'wss'],
            disableStats: true,
            channelAuthorization: { customHandler: authorize },
        });
        let connectedBefore = false;

        pusher.connection.bind(
            'state_change',
            ({ current }: { current: string }) => {
                const next = statusOf(current);

                if (next === 'connected' && connectedBefore) {
                    listeners.forEach((listener) => listener());
                }

                connectedBefore ||= next === 'connected';
                setStatus(next);
            },
        );

        return pusher;
    });

    return socket;
}

function statusOf(state: string): LiveStatus {
    if (state === 'connected') {
        return 'connected';
    }

    return state === 'initialized' || state === 'connecting'
        ? 'connecting'
        : 'unavailable';
}

function setStatus(next: LiveStatus) {
    if (next !== status) {
        status = next;
        statusListeners.forEach((listener) => listener(next));
    }
}

/** Sign a private channel with the person's session, like any form post. */
function authorize(
    { socketId, channelName }: { socketId: string; channelName: string },
    callback: ChannelAuthorizationCallback,
) {
    postJson<{ auth: string }>(AUTH_URL, {
        socket_id: socketId,
        channel_name: channelName,
    })
        .then((data) => callback(null, data))
        .catch((error: Error) => callback(error, null));
}
