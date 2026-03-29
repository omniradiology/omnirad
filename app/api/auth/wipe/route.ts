import { NextResponse } from "next/server";
import { db } from "@/db";
import { users, sessions, reports, config, profile, appearance } from "@/db/schema";
import { cookies } from "next/headers";

// DELETE /api/auth/wipe — Wipe ALL data and reset application to factory state
export async function DELETE() {
    try {
        // Wipe everything in order (sessions first due to FK)
        db.delete(sessions).run();
        db.delete(reports).run();
        db.delete(users).run();
        db.delete(config).run();
        db.delete(profile).run();
        db.delete(appearance).run();

        // Clear all auth cookies
        const cookieStore = await cookies();
        cookieStore.delete('openrad_session_id');
        cookieStore.delete('openrad_setup_complete');

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[API] Error wiping all data:", error);
        return NextResponse.json({ error: "Failed to wipe data" }, { status: 500 });
    }
}
