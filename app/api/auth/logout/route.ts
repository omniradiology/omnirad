import { NextResponse } from 'next/server';
import { db } from '@/db';
import { sessions } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { cookies } from 'next/headers';

export async function POST(req: Request) {
    try {
        const cookieStore = await cookies();
        const sessionId = cookieStore.get('omnirad_session_id')?.value;

        if (sessionId) {
            // Remove session from DB
            await db.delete(sessions).where(eq(sessions.id, sessionId));
        }

        // Clear the cookie
        cookieStore.delete('omnirad_session_id');

        return NextResponse.json({ success: true });
    } catch (e: any) {
        console.error("Logout Error", e);
        return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
    }
}
