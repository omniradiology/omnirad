import { NextResponse } from 'next/server';
import { db } from '@/db';
import { users, sessions } from '@/db/schema';
import { eq, not } from 'drizzle-orm';
import { hashPassword } from '@/lib/auth';
import { cookies } from 'next/headers';

async function checkIsAdmin() {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('omnirad_session_id')?.value;
    if (!sessionId) return false;

    const sessionList = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1);
    const session = sessionList[0];
    if (!session || session.expiresAt * 1000 < Date.now()) return false;

    const userList = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
    if (!userList[0] || userList[0].role !== 'Admin') return false;

    return true;
}

export async function GET() {
    if (!await checkIsAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

    try {
        const allUsers = await db.select({
            id: users.id,
            fullName: users.fullName,
            username: users.username,
            email: users.email,
            role: users.role,
            createdAt: users.createdAt
        }).from(users);

        return NextResponse.json(allUsers);
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    if (!await checkIsAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

    try {
        const { fullName, username, email, password, role } = await req.json();

        // Ensure unique username/email
        const existingUsers = await db.select().from(users).where(eq(users.username, username));
        if (existingUsers.length > 0) return NextResponse.json({ error: 'Username is taken' }, { status: 400 });

        const passwordHash = await hashPassword(password);
        await db.insert(users).values({
            id: crypto.randomUUID(),
            fullName,
            username,
            email,
            passwordHash,
            role: role || 'User',
            createdAt: new Date().toISOString()
        });

        return NextResponse.json({ success: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    if (!await checkIsAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

    try {
        const { id, role } = await req.json();
        
        await db.update(users).set({ role }).where(eq(users.id, id));

        return NextResponse.json({ success: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    if (!await checkIsAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

    try {
        const url = new URL(req.url);
        const id = url.searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

        // First remove all their sessions
        await db.delete(sessions).where(eq(sessions.userId, id));
        // Then delete the user
        await db.delete(users).where(eq(users.id, id));

        return NextResponse.json({ success: true });
    } catch (e: any) {
         return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
