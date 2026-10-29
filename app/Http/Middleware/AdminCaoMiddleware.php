<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/**
 * The admin side (alias `admin-cao`, kept from the Jetstream version): open
 * to anyone whose roles include `dashboard.view`. Everyone else is sent to
 * their own dashboard quietly, as staff were before.
 */
class AdminCaoMiddleware
{
    public function handle(Request $request, Closure $next): Response
    {
        if (! Auth::check()) {
            return redirect('/login')->with('error', 'You must be logged in.');
        }

        if (! $request->user()->can('dashboard.view')) {
            return redirect('/staff-dashboard');
        }

        return $next($request);
    }
}
