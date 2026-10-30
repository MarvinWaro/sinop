---
name: berth-websocket
description: Connect a Laravel app (or any Pusher-compatible backend and frontend) to the system's WebSocket app provisioned in Berth, which runs on a shared Soketi server on Coolify. Use when the user wants realtime, broadcasting, Laravel Echo, pusher-js, live updates, notifications, presence or "whisper"/typing indicators for an app whose credentials come from Berth.
---

# Berth WebSocket (Soketi) integration

Berth gives each system its own app on a shared **Soketi** server. Soketi speaks the **Pusher protocol**, so the app uses Laravel's `pusher` broadcaster, the `pusher/pusher-php-server` SDK, and `laravel-echo` + `pusher-js` in the browser. Nothing Soketi-specific is installed.

There are two endpoints:

| Who | Connects to | Values |
|---|---|---|
| Backend (Laravel, queue workers) publishing events | Soketi's **internal** Coolify hostname, plain `http`, port `6001` | `PUSHER_HOST`, `PUSHER_PORT`, `PUSHER_SCHEME` |
| Browser (Echo) subscribing | The **public** domain, `https`, port `443` | `VITE_PUSHER_HOST`, `VITE_PUSHER_PORT`, `VITE_PUSHER_SCHEME` |

## Rules

- **Never commit credentials.** Values go in `.env` locally and in the app's Coolify environment in production. Use `.env.example` with empty values only.
- **The secret never reaches the browser.** Only `PUSHER_APP_KEY` gets a `VITE_` twin. Never create `VITE_PUSHER_APP_SECRET`.
- **The key is public.** Anyone with it can listen on *public* channels. Use `PrivateChannel` or `PresenceChannel` for anything about a specific user, record or tenant.
- **Berth is the source of truth.** Don't edit Soketi's database or config. Rotating secrets, changing connection limits or allowing client events is done by a Berth admin.
- Don't guess hosts or keys. If you don't have the values, stop and ask the user for them (step 1).

## 1. Get the values from Berth

Ask the user to open the system in Berth, go to the **WebSocket** tab, check it says provisioned, and click **Copy as .env** at the top of the page. It gives a block like this (the user pastes it; the real values differ):

```dotenv
BROADCAST_CONNECTION=pusher
PUSHER_APP_ID=<slug>
PUSHER_APP_KEY=<key>
PUSHER_APP_SECRET=<secret>
PUSHER_HOST=<soketi container name>
PUSHER_PORT=6001
PUSHER_SCHEME=http
PUSHER_APP_CLUSTER=mt1

VITE_PUSHER_APP_KEY="${PUSHER_APP_KEY}"
VITE_PUSHER_HOST=<public ws domain>
VITE_PUSHER_PORT=443
VITE_PUSHER_SCHEME=https
VITE_PUSHER_APP_CLUSTER="${PUSHER_APP_CLUSTER}"
```

The block also has MySQL/S3/Redis lines. Only take the `BROADCAST_*`, `PUSHER_*` and `VITE_PUSHER_*` lines unless the user asks for more.

If there are no `VITE_PUSHER_*` lines, Berth has no public host configured and browsers can't connect. Backend publishing still works. Tell the user to ask the Berth admin if the frontend needs realtime.

**Local development:** `PUSHER_HOST` is an internal Coolify name and won't resolve on a laptop. Locally, point the backend at the public endpoint instead: `PUSHER_HOST=<the VITE_PUSHER_HOST value>`, `PUSHER_PORT=443`, `PUSHER_SCHEME=https`. Keep the internal values for production.

## 2. Inspect the project

Check before changing anything:

- Laravel version: `php artisan --version` or `composer.json`.
- `config/broadcasting.php` exists? (Laravel 11+ only has it after `install:broadcasting`.)
- Frontend: `resources/js/bootstrap.js`, `resources/js/echo.js`, `resources/js/app.(js|ts)`. Inertia/React/Vue? A Laravel 12 starter kit may use `configureEcho()` from `@laravel/echo-react` or `@laravel/echo-vue`.
- Queue: `QUEUE_CONNECTION` in `.env`, and whether the Coolify deployment runs a queue worker.
- Not Laravel? Skip to "Other stacks" at the end.

## 3. Install broadcasting

**Laravel 11 and later:**

```sh
php artisan install:broadcasting --pusher
```

If the command doesn't accept `--pusher`, run `php artisan install:broadcasting` and **decline Reverb** when asked. The install should publish `config/broadcasting.php` and `routes/channels.php`, add `resources/js/echo.js`, and install `laravel-echo` + `pusher-js`. Then make sure the PHP SDK is present:

```sh
composer require pusher/pusher-php-server
npm install --save-dev laravel-echo pusher-js
```

**Laravel 10 and earlier:**

```sh
composer require pusher/pusher-php-server
npm install --save-dev laravel-echo pusher-js
```

Uncomment `App\Providers\BroadcastServiceProvider::class` in `config/app.php`. The env key is `BROADCAST_DRIVER`, not `BROADCAST_CONNECTION`, so add `BROADCAST_DRIVER=pusher` (keeping both lines is harmless).

**Check `config/broadcasting.php`:** the `pusher` connection must read the host from env. Recent Laravel versions already do. If it doesn't, make its `options` look like this:

```php
'options' => [
    'cluster' => env('PUSHER_APP_CLUSTER'),
    'host' => env('PUSHER_HOST') ?: 'api-'.env('PUSHER_APP_CLUSTER', 'mt1').'.pusher.com',
    'port' => env('PUSHER_PORT', 443),
    'scheme' => env('PUSHER_SCHEME', 'https'),
    'encrypted' => true,
    'useTLS' => env('PUSHER_SCHEME', 'https') === 'https',
],
```

## 4. Frontend: point Echo at Soketi

Laravel's stock Pusher snippet only sets `key` and `cluster`, so it would connect to pusher.com. Replace the Echo setup (`resources/js/echo.js`, or the Echo block in `resources/js/bootstrap.js` on Laravel 10) with:

```js
import Echo from "laravel-echo";
import Pusher from "pusher-js";

window.Pusher = Pusher;
window.Echo = new Echo({
  broadcaster: "pusher",
  key: import.meta.env.VITE_PUSHER_APP_KEY,
  cluster: import.meta.env.VITE_PUSHER_APP_CLUSTER,
  wsHost: import.meta.env.VITE_PUSHER_HOST,
  wsPort: import.meta.env.VITE_PUSHER_PORT,
  wssPort: import.meta.env.VITE_PUSHER_PORT,
  forceTLS: import.meta.env.VITE_PUSHER_SCHEME === "https",
  enabledTransports: ["ws", "wss"],
});
```

If the project uses `configureEcho({...})` (`@laravel/echo-react` / `@laravel/echo-vue`), pass the same options there with `broadcaster: "pusher"`. Make sure the file is imported by the app entry point.

If the app sends a Content-Security-Policy header, add `wss://<VITE_PUSHER_HOST>` to `connect-src`.

## 5. A first event

Broadcast events are queued by default (`ShouldBroadcast`), so a **queue worker must be running** in production. If the app has none, either add one in Coolify (e.g. a worker process running `php artisan queue:work`) or use `ShouldBroadcastNow` for events that must go out from the request itself. Tell the user which one you chose.

Example: notify a user that their order changed, on a private channel.

```php
// app/Events/OrderUpdated.php
namespace App\Events;

use App\Models\Order;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class OrderUpdated implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public Order $order) {}

    public function broadcastOn(): array
    {
        return [new PrivateChannel('orders.'.$this->order->user_id)];
    }

    // Only send what the browser needs, not the whole model.
    public function broadcastWith(): array
    {
        return ['id' => $this->order->id, 'status' => $this->order->status];
    }
}
```

```php
// routes/channels.php: who may join the private channel
Broadcast::channel('orders.{userId}', fn ($user, $userId) => (int) $user->id === (int) $userId);
```

```php
// Wherever the order changes
OrderUpdated::dispatch($order);
```

```js
// Frontend (logged-in page)
window.Echo.private(`orders.${userId}`).listen("OrderUpdated", (e) => {
  console.log("order updated", e.id, e.status);
});
```

Private and presence channels are authorised through `POST /broadcasting/auth`, which needs the user's session (web guard). For token auth (Sanctum SPA/API), register the routes with the matching middleware, e.g. `Broadcast::routes(['middleware' => ['auth:sanctum']])`, and configure Echo's `authorizer` or `auth.headers`.

**Client events ("whisper", e.g. typing indicators)** only work if a Berth admin ticked **Allow client events** for this system. They skip the backend entirely, so never use them for data that must be saved or trusted.

```js
window.Echo.private(`chat.${roomId}`).whisper("typing", { name });
window.Echo.private(`chat.${roomId}`).listenForWhisper("typing", (e) => showTyping(e.name));
```

## 6. Production on Coolify

In the Laravel app's **Environment Variables** in Coolify:

1. Add the `BROADCAST_*` and `PUSHER_*` lines with the **internal** host from Berth.
2. Add the five `VITE_PUSHER_*` lines and mark them as **Build Variable**. Vite reads them at build time, so a running container never sees changes to them.
3. Redeploy with a fresh build.

The backend reaches Soketi by its container name, so the app must run on the same server and Docker network as Soketi (Coolify applications join the `coolify` network by default).

## 7. Verify

Run these in order and report the results to the user.

1. **Soketi reachable from the backend** (production container terminal):
   ```sh
   curl -s "http://$PUSHER_HOST:$PUSHER_PORT"     # expect: OK
   ```
2. **Credentials accepted.** Soketi answers a bad secret with HTTP 200 and an error in the body, so Laravel does NOT throw. Check the body:
   ```sh
   php artisan tinker --execute="dump(Broadcast::connection('pusher')->getPusher()->trigger('berth-check', 'ping', ['ok' => true]));"
   ```
   An empty object or `ok: true` means the secret is right. `"The secret authentication failed"` means `PUSHER_APP_SECRET` is stale (it was rotated in Berth): copy the new value from Berth.
3. **Browser connected:** open the app, DevTools → Network → WS. There should be an open connection to `wss://<VITE_PUSHER_HOST>/app/<key>?protocol=7…`, and the `pusher:connection_established` frame.
4. **End to end:** dispatch the event (tinker or the real action) and watch it arrive in the WS frames and the `listen` callback.

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| Browser connects to `ws-mt1.pusher.com` | Echo has no `wsHost`. Use the snippet in step 4. |
| `App key … does not exist` (code 4001) | Wrong `VITE_PUSHER_APP_KEY`, the app was deprovisioned in Berth, or the build used old values. Recopy from Berth, rebuild. |
| WS connects, events never arrive, no errors | Stale or wrong `PUSHER_APP_SECRET` (see verify step 2), no queue worker running, or the event isn't `ShouldBroadcast`. Check `php artisan queue:failed` and `storage/logs`. |
| `cURL error 6: Could not resolve host` when broadcasting | `PUSHER_HOST` is the internal name but the app isn't on the Coolify network (or you're running locally). See step 1 "Local development" or step 6. |
| `403` on `/broadcasting/auth` | The `routes/channels.php` callback returned false, or the user isn't authenticated for that guard. |
| `419` on `/broadcasting/auth` | CSRF token missing. Make sure the page has the CSRF meta tag or axios sends `X-XSRF-TOKEN`. |
| Client events rejected | Client events are off for this system. Ask a Berth admin to allow them, and use a private or presence channel. |
| Connection refused after N users | The system's max connections limit in Berth was reached. Ask a Berth admin. |
| Mixed content / blocked `ws://` | The site is https, so the browser must use `wss://`: `VITE_PUSHER_SCHEME=https`, `VITE_PUSHER_PORT=443`. |

## Other stacks

Any Pusher SDK works with the same values. Set the host, port and TLS options explicitly, never just the cluster:

- **Node backend:** `new Pusher({ appId, key, secret, host: PUSHER_HOST, port: PUSHER_PORT, useTLS: false })` from the `pusher` package, then `pusher.trigger(channel, event, data)`.
- **Plain browser (no Echo):** `new Pusher(key, { cluster: "mt1", wsHost, wsPort: 443, wssPort: 443, forceTLS: true, enabledTransports: ["ws", "wss"] })` from `pusher-js`. Private channels need an `authEndpoint` on your backend that signs the subscription with the secret.
- **Mobile:** the official Pusher Channels SDKs (Swift, Kotlin, Flutter) accept a custom host and port the same way.
