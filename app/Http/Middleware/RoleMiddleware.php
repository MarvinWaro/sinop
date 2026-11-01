<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class RoleMiddleware
{
    public function handle(Request $request, Closure $next, string $role): Response
    {
        // Check if user is logged in
        if (! Auth::check()) {
            return redirect('/login')->with('error', 'You must be logged in.');
        }

        // Check if user has the required role
        if (Auth::user()->role !== $role) {
            if (in_array(Auth::user()->role, ['admin', 'cao'])) {
                return redirect('/dashboard');
            } elseif (Auth::user()->role == 'staff') {
                return redirect('/staff-dashboard');
            } else {
                return redirect('/login')->with('error', 'Unauthorized access.');
            }
        }

        return $next($request);
    }
}
