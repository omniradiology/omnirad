import { NextResponse } from 'next/server';
import { db } from '@/db';
import { users, sessions } from '@/db/schema';
import { eq, or } from 'drizzle-orm';
import { verifyPassword, generateSessionId } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function POST(req: Request) {
    try {
        const { identifier, password, rememberMe } = await req.json();

        if (!identifier || !password) {
            return NextResponse.json({ error: 'Username/Email and password are required' }, { status: 400 });
        }

        // Find user by either email or username
        const foundUsers = await db.select().from(users).where(
            or(
                eq(users.email, identifier),
                eq(users.username, identifier)
            )
        ).limit(1);

        const user = foundUsers[0];

        if (!user) {
            return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
        }

        // Verify hash
        const isValid = await verifyPassword(password, user.passwordHash);
        if (!isValid) {
            return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
        }

        // Create Session
        const sessionId = generateSessionId();
        
        // Expiration: 30 days if rememberMe, otherwise 24 hours
        const expiresInSeconds = rememberMe ? (60 * 60 * 24 * 30) : (60 * 60 * 24);
        const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;
        
        await db.insert(sessions).values({
            id: sessionId,
            userId: user.id,
            expiresAt
        });

        // Set session cookie
        const cookieStore = await cookies();
        cookieStore.set('openrad_session_id', sessionId, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: expiresInSeconds
        });

        return NextResponse.json({ 
            success: true, 
            user: {
                id: user.id,
                fullName: user.fullName,
                username: user.username,
                role: user.role
            }
        });
    } catch (e: any) {
        console.error("Login Error", e);
        return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
    }
}
