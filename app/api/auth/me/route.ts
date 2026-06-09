import { NextResponse } from 'next/server';
import { db } from '@/db';
import { users, sessions } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { cookies } from 'next/headers';

async function getCurrentUser() {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('omnirad_session_id')?.value;
    if (!sessionId) return null;

    const sessionList = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1);
    const session = sessionList[0];
    
    if (!session || session.expiresAt * 1000 < Date.now()) return null;

    const userList = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
    return userList[0];
}

export async function GET() {
    try {
        const user = await getCurrentUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        return NextResponse.json({
            id: user.id,
            fullName: user.fullName,
            username: user.username,
            email: user.email,
            role: user.role,
            position: user.position || ""
        });
    } catch (e) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const user = await getCurrentUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        const { fullName, username, email, position } = body;

        // Ensure unique username/email 
        const existingUsers = await db.select().from(users).where(
            eq(users.username, username)
        );
        
        if (existingUsers.length > 0 && existingUsers[0].id !== user.id) {
            return NextResponse.json({ error: 'Username is already taken' }, { status: 400 });
        }

        const existingEmails = await db.select().from(users).where(
            eq(users.email, email)
        );

        if (existingEmails.length > 0 && existingEmails[0].id !== user.id) {
            return NextResponse.json({ error: 'Email is already correctly registered' }, { status: 400 });
        }

        await db.update(users).set({
            fullName,
            username,
            email,
            position
        }).where(eq(users.id, user.id));

        return NextResponse.json({ success: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || 'Internal Server Error' }, { status: 500 });
    }
}
