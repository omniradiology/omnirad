import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { security, users, sessions } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { generateSessionId } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function GET(req: NextRequest) {
    try {
        // Check if app is actually unlocked
        const secRow = db.select().from(security).where(eq(security.id, 1)).get();
        if (!secRow || secRow.appLockEnabled !== false) {
            // App is locked, redirect to login
            const loginUrl = new URL('/login', req.url);
            return NextResponse.redirect(loginUrl);
        }

        // Find the user to auto-login as
        let targetUser = null;
        
        if (secRow.defaultUserId) {
            const usersList = db.select().from(users).where(eq(users.id, secRow.defaultUserId)).all();
            targetUser = usersList[0];
        }
        
        if (!targetUser) {
            // Fallback to first admin
            const adminUsers = db.select().from(users).where(eq(users.role, 'Admin')).all();
            targetUser = adminUsers[0];
        }

        if (!targetUser) {
            // No admin found, fall back to login
            const loginUrl = new URL('/login', req.url);
            return NextResponse.redirect(loginUrl);
        }

        // Create a persistent session (30 days)
        const sessionId = generateSessionId();
        const expiresAt = Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 30);

        db.insert(sessions).values({
            id: sessionId,
            userId: targetUser.id,
            expiresAt,
        }).run();

        // Set session cookie
        const cookieStore = await cookies();
        cookieStore.set('omnirad_session_id', sessionId, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 24 * 30,
        });

        // Redirect to intended page or dashboard
        const redirect = req.nextUrl.searchParams.get('redirect') || '/';
        return NextResponse.redirect(new URL(redirect, req.url));
    } catch (e: unknown) {
        console.error('[Auto-Login] Error:', e);
        // On any error, fall back to login page
        return NextResponse.redirect(new URL('/login', req.url));
    }
}
