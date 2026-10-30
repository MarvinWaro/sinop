<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\View;
use Symfony\Component\HttpFoundation\Response;

class HandleAppearance
{
    /**
     * Landing and sign-in pages. They have their own light/dark switch
     * (resources/js/hooks/use-public-appearance.ts) and start dark.
     */
    private const PUBLIC_PAGES = [
        'home',
        'login',
        'register',
        'password.request',
        'password.reset',
        'password.confirm',
        'two-factor.login',
    ];

    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $publicPage = $request->routeIs(...self::PUBLIC_PAGES);

        View::share('appearance', $publicPage
            ? ($request->cookie('public_appearance') === 'light' ? 'light' : 'dark')
            // The app is dark until the user picks a mode (use-appearance.tsx).
            : ($request->cookie('appearance') ?? 'dark'));
        View::share('appearanceOverride', $publicPage);

        return $next($request);
    }
}
