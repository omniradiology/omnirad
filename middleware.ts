import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    
    // Bypass middleware for internal routes, static files, and the check API itself
    if (
        pathname.startsWith('/_next') ||
        pathname.startsWith('/api/auth/check') ||
        pathname === '/favicon.ico' ||
        pathname.match(/\.(png|jpg|jpeg|gif|svg|ico)$/)
    ) {
        return NextResponse.next();
    }

    // 1. Check if setup is needed
    // We use a cookie to cache the setup status and avoid hitting the API route on every request.
    const setupCompleteCookie = request.cookies.get('openrad_setup_complete');
    
    if (!setupCompleteCookie || setupCompleteCookie.value !== 'true') {
        try {
            // Ping the API route to check if any users exist
            const checkRes = await fetch(new URL('/api/auth/check', request.url));
            if (checkRes.ok) {
                const { hasUsers } = await checkRes.json();
                
                if (!hasUsers) {
                    // System is completely empty, redirect to /setup if not already there
                    if (!pathname.startsWith('/setup') && pathname !== '/api/auth/setup') {
                        return NextResponse.redirect(new URL('/setup', request.url));
                    }
                    return NextResponse.next();
                } else {
                    // System has users, cache this fact so we don't check again
                    const response = NextResponse.next();
                    response.cookies.set('openrad_setup_complete', 'true', { path: '/' });
                    
                    // If they are on /setup but setup is complete, redirect to login
                    if (pathname.startsWith('/setup')) {
                        return NextResponse.redirect(new URL('/login', request.url));
                    }
                    return response;
                }
            }
        } catch (e) {
            console.error('[Middleware] Error checking setup status:', e);
        }
    } else {
        // Cookie says setup is done, but verify on login page requests
        // (handles case where DB was reset/wiped after setup)
        if (pathname.startsWith('/login')) {
            try {
                const checkRes = await fetch(new URL('/api/auth/check', request.url));
                if (checkRes.ok) {
                    const { hasUsers } = await checkRes.json();
                    if (!hasUsers) {
                        // DB was wiped! Clear stale cookie and redirect to setup
                        const response = NextResponse.redirect(new URL('/setup', request.url));
                        response.cookies.delete('openrad_setup_complete');
                        return response;
                    }
                }
            } catch (e) {
                // If check fails, just let through to login
            }
            return NextResponse.next();
        }
        // If setup is marked complete, but user tries to access /setup, redirect to login
        if (pathname.startsWith('/setup')) {
            return NextResponse.redirect(new URL('/login', request.url));
        }
    }

    // 2. Auth Route Protection
    // Allow public access to /login and all other /api routes
    if (pathname.startsWith('/login') || pathname.startsWith('/api')) {
        return NextResponse.next();
    }

    // Protect all other routes
    const sessionCookie = request.cookies.get('openrad_session_id');
    if (!sessionCookie) {
        const loginUrl = new URL('/login', request.url);
        // Save the intended url to redirect back after login
        loginUrl.searchParams.set('redirect', pathname);
        return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
