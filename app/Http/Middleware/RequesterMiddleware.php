<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * The requester screens (staff dashboard, first-login password change), for
 * people without the admin side. Admin-side users are sent to their
 * dashboard, and request supplies through "user mode" instead (was
 * `role:staff`).
 */
class RequesterMiddleware
{
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->user()?->can('dashboard.view')) {
            return redirect('/dashboard');
        }

        return $next($request);
    }
}
