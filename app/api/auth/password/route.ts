import { NextResponse } from 'next/server';
import { db } from '@/db';
import { users, sessions } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { verifyPassword, hashPassword } from '@/lib/auth';

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

export async function PUT(req: Request) {
    try {
        const user = await getCurrentUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { currentPassword, newPassword } = await req.json();

        if (newPassword.length < 8) {
             return NextResponse.json({ error: 'New password must be at least 8 characters' }, { status: 400 });
        }

        const isValid = await verifyPassword(currentPassword, user.passwordHash);
        if (!isValid) {
            return NextResponse.json({ error: 'Incorrect current password' }, { status: 401 });
        }

        const passwordHash = await hashPassword(newPassword);

        await db.update(users).set({
            passwordHash
        }).where(eq(users.id, user.id));

        return NextResponse.json({ success: true });

    } catch (e: any) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
