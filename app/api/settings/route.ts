import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { config, profile, appearance, security, users, sessions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";

// GET /api/settings?type=config|profile|appearance|users
export async function GET(request: NextRequest) {
    const type = request.nextUrl.searchParams.get("type");

    try {
        switch (type) {
            case "config": {
                const row = db.select().from(config).where(eq(config.id, 1)).get();
                if (!row) {
                    return NextResponse.json({
                        n8nWebhookUrl: "",
                        supabaseUrl: "",
                        supabaseAnonKey: "",
                        pacsOrthancUrl: "",
                        pacsAuthType: "none",
                        pacsUsername: "",
                        pacsPassword: "",
                        pacsBearerToken: "",
                        pacsAeTitle: "",
                    });
                }
                return NextResponse.json({
                    n8nWebhookUrl: row.n8nWebhookUrl || "",
                    supabaseUrl: row.supabaseUrl || "",
                    supabaseAnonKey: row.supabaseAnonKey || "",
                    pacsOrthancUrl: row.pacsOrthancUrl || "",
                    pacsAuthType: row.pacsAuthType || "none",
                    pacsUsername: row.pacsUsername || "",
                    pacsPassword: row.pacsPassword || "",
                    pacsBearerToken: row.pacsBearerToken || "",
                    pacsAeTitle: row.pacsAeTitle || "",
                });
            }
            case "profile": {
                const row = db.select().from(profile).where(eq(profile.id, 1)).get();
                if (!row) {
                    return NextResponse.json({
                        fullName: "",
                        role: "",
                        hospitalName: "",
                        department: "",
                    });
                }
                return NextResponse.json({
                    fullName: row.fullName || "",
                    role: row.role || "",
                    hospitalName: row.hospitalName || "",
                    department: row.department || "",
                });
            }
            case "appearance": {
                const row = db.select().from(appearance).where(eq(appearance.id, 1)).get();
                if (!row) {
                    return NextResponse.json({
                        theme: "dark",
                        template: "standard",
                        hospitalName: "",
                        logo: "",
                    });
                }
                return NextResponse.json({
                    theme: row.theme || "dark",
                    template: row.template || "standard",
                    hospitalName: row.hospitalName || "",
                    logo: row.logo || "",
                });
            }

            case "security": {
                const row = db.select().from(security).where(eq(security.id, 1)).get();
                if (!row) {
                    return NextResponse.json({
                        appLockEnabled: true,
                        defaultUserId: null,
                        updatedBy: null,
                        updatedAt: null,
                        updatedByName: null,
                    });
                }
                // Get the name of who last changed it
                let updatedByName = null;
                if (row.updatedBy) {
                    const updater = db.select({ fullName: users.fullName }).from(users).where(eq(users.id, row.updatedBy)).get();
                    updatedByName = updater?.fullName || null;
                }
                return NextResponse.json({
                    appLockEnabled: row.appLockEnabled ?? true,
                    defaultUserId: row.defaultUserId || null,
                    updatedBy: row.updatedBy || null,
                    updatedAt: row.updatedAt || null,
                    updatedByName,
                });
            }

            default:
                return NextResponse.json({ error: "Invalid type. Use: config, profile, appearance, security, or users" }, { status: 400 });
        }
    } catch (error) {
        console.error("[API] Error reading settings:", error);
        return NextResponse.json({ error: "Failed to read settings" }, { status: 500 });
    }
}

// PUT /api/settings — Upsert settings
export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();
        const { type, data } = body;

        switch (type) {
            case "config": {
                const exists = db.select().from(config).where(eq(config.id, 1)).get();
                if (exists) {
                    db.update(config).set({
                        n8nWebhookUrl: data.n8nWebhookUrl || "",
                        supabaseUrl: data.supabaseUrl || "",
                        supabaseAnonKey: data.supabaseAnonKey || "",
                        pacsOrthancUrl: data.pacsOrthancUrl || "",
                        pacsAuthType: data.pacsAuthType || "none",
                        pacsUsername: data.pacsUsername || "",
                        pacsPassword: data.pacsPassword || "",
                        pacsBearerToken: data.pacsBearerToken || "",
                        pacsAeTitle: data.pacsAeTitle || "",
                    }).where(eq(config.id, 1)).run();
                } else {
                    db.insert(config).values({
                        id: 1,
                        n8nWebhookUrl: data.n8nWebhookUrl || "",
                        supabaseUrl: data.supabaseUrl || "",
                        supabaseAnonKey: data.supabaseAnonKey || "",
                        pacsOrthancUrl: data.pacsOrthancUrl || "",
                        pacsAuthType: data.pacsAuthType || "none",
                        pacsUsername: data.pacsUsername || "",
                        pacsPassword: data.pacsPassword || "",
                        pacsBearerToken: data.pacsBearerToken || "",
                        pacsAeTitle: data.pacsAeTitle || "",
                    }).run();
                }
                break;
            }
            case "profile": {
                const exists = db.select().from(profile).where(eq(profile.id, 1)).get();
                if (exists) {
                    db.update(profile).set({
                        fullName: data.fullName || "",
                        role: data.role || "",
                        hospitalName: data.hospitalName || "",
                        department: data.department || "",
                    }).where(eq(profile.id, 1)).run();
                } else {
                    db.insert(profile).values({
                        id: 1,
                        fullName: data.fullName || "",
                        role: data.role || "",
                        hospitalName: data.hospitalName || "",
                        department: data.department || "",
                    }).run();
                }
                break;
            }
            case "appearance": {
                const exists = db.select().from(appearance).where(eq(appearance.id, 1)).get();
                if (exists) {
                    db.update(appearance).set({
                        theme: data.theme || "dark",
                        template: data.template || "standard",
                        hospitalName: data.hospitalName || "",
                        logo: data.logo || "",
                    }).where(eq(appearance.id, 1)).run();
                } else {
                    db.insert(appearance).values({
                        id: 1,
                        theme: data.theme || "dark",
                        template: data.template || "standard",
                        hospitalName: data.hospitalName || "",
                        logo: data.logo || "",
                    }).run();
                }
                break;
            }

            case "security": {
                // Admin-only: verify the current user is an admin
                const cookieStore = await cookies();
                const sessionId = cookieStore.get('omnirad_session_id')?.value;
                if (!sessionId) {
                    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
                }
                const sessionList = db.select().from(sessions).where(eq(sessions.id, sessionId)).all();
                const session = sessionList[0];
                if (!session || session.expiresAt * 1000 < Date.now()) {
                    return NextResponse.json({ error: "Session expired" }, { status: 401 });
                }
                const currentUser = db.select().from(users).where(eq(users.id, session.userId)).get();
                if (!currentUser || currentUser.role !== 'Admin') {
                    return NextResponse.json({ error: "Only administrators can change security settings" }, { status: 403 });
                }

                const appLockEnabled = data.appLockEnabled ?? true;
                const defaultUserId = data.defaultUserId || null;
                const secExists = db.select().from(security).where(eq(security.id, 1)).get();
                const secData = {
                    appLockEnabled,
                    defaultUserId,
                    updatedBy: currentUser.id,
                    updatedAt: new Date().toISOString(),
                };
                if (secExists) {
                    db.update(security).set(secData).where(eq(security.id, 1)).run();
                } else {
                    db.insert(security).values({ id: 1, ...secData }).run();
                }

                // Set or clear the middleware signal cookie
                if (!appLockEnabled) {
                    cookieStore.set('omnirad_app_unlocked', 'true', {
                        httpOnly: false,
                        secure: process.env.NODE_ENV === 'production',
                        sameSite: 'lax',
                        path: '/',
                        maxAge: 60 * 60 * 24 * 365, // 1 year
                    });
                } else {
                    cookieStore.delete('omnirad_app_unlocked');
                }

                break;
            }

            default:
                return NextResponse.json({ error: "Invalid type" }, { status: 400 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[API] Error saving settings:", error);
        return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
    }
}
