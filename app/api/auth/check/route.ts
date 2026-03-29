import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { count } from "drizzle-orm";

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const usersCountResult = await db.select({ value: count() }).from(users);
        const numUsers = usersCountResult[0].value;
        return NextResponse.json({ hasUsers: numUsers > 0 });
    } catch (error) {
        console.error("[Auth Check] Error checking database:", error);
        return NextResponse.json({ hasUsers: false }, { status: 500 });
    }
}
