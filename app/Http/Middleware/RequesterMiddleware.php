<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * The requester screens (dashboard, my requests, received supplies, my
 * properties, first-login password change), for people without the admin
 * side. Admin-side users use them in "user mode"; otherwise they're sent to
 * their own dashboard (was `role:staff`).
 */
class RequesterMiddleware
{
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->user()?->can('dashboard.view') && ! $request->session()->get('admin_user_mode')) {
            return redirect('/dashboard');
        }

        return $next($request);
    }
}
