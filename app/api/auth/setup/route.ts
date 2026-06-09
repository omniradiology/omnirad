import { NextResponse } from 'next/server';
import { db } from '@/db';
import { users, sessions } from '@/db/schema';
import { count } from 'drizzle-orm';
import { hashPassword, generateSessionId } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function POST(req: Request) {
    try {
        const { fullName, username, email, password } = await req.json();

        // 1. Verify there are truly no users (security check)
        const usersCount = await db.select({ value: count() }).from(users);
        if (usersCount[0].value > 0) {
            return NextResponse.json({ error: 'Setup has already been completed.' }, { status: 403 });
        }

        // 2. Hash password
        const passwordHash = await hashPassword(password);
        const userId = crypto.randomUUID();

        // 3. Create Admin user
        await db.insert(users).values({
            id: userId,
            fullName,
            username,
            email,
            passwordHash,
            role: 'Admin',
            createdAt: new Date().toISOString()
        });

        // 4. Create Session
        const sessionId = generateSessionId();
        const expiresAt = Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7); // 7 days
        
        await db.insert(sessions).values({
            id: sessionId,
            userId,
            expiresAt
        });

        // 5. Set session cookie and setup complete cookie
        const cookieStore = await cookies();
        cookieStore.set('omnirad_session_id', sessionId, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 24 * 7 // 7 days
        });
        
        cookieStore.set('omnirad_setup_complete', 'true', {
            path: '/',
            maxAge: 60 * 60 * 24 * 365 * 10 // 10 years
        });

        return NextResponse.json({ success: true });
    } catch (e: any) {
        console.error("Setup Error", e);
        return NextResponse.json({ error: e.message || 'Error creating admin account.' }, { status: 500 });
    }
}
