<?php

use App\Http\Middleware\AdminCaoMiddleware;
use App\Http\Middleware\AdminUserModeMiddleware;
use App\Http\Middleware\HandleAppearance;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\RecordExport;
use App\Http\Middleware\RequesterMiddleware;
use App\Http\Middleware\RoleMiddleware;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withBroadcasting(
        __DIR__.'/../routes/channels.php',
        ['middleware' => ['web', 'auth']],
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->encryptCookies(except: ['appearance', 'sidebar_state']);

        $middleware->web(append: [
            HandleAppearance::class,
            HandleInertiaRequests::class,
            AddLinkHeadersForPreloadedAssets::class,
            RecordExport::class,
        ]);

        // Access middleware. `admin-cao` now means "may use the admin side"
        // (the dashboard.view permission); `requester` is the staff screens.
        $middleware->alias([
            'role' => RoleMiddleware::class,
            'admin-cao' => AdminCaoMiddleware::class,
            'admin.not-user-mode' => AdminUserModeMiddleware::class,
            'requester' => RequesterMiddleware::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );

        // A missing permission on a page or button: back to where they were
        // (or their home page) with a message, instead of a bare 403 page.
        $exceptions->respond(function (Response $response, Throwable $exception, Request $request) {
            if ($response->getStatusCode() !== 403 || $request->expectsJson() || $request->user() === null) {
                return $response;
            }

            $message = 'You don\'t have permission to do that. Ask an administrator if you need access.';

            if (! $request->isMethod('GET')) {
                return back()->with('error', $message);
            }

            $home = match (true) {
                (bool) $request->session()->get('admin_user_mode') => route('admin.user-dashboard'),
                $request->user()->can('dashboard.view') => route('dashboard'),
                default => route('staff.dashboard'),
            };

            return redirect($home)->with('error', $message);
        });
    })->create();
