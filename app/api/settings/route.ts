import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { config, profile, appearance, users } from "@/db/schema";
import { eq } from "drizzle-orm";

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
                    });
                }
                return NextResponse.json({
                    n8nWebhookUrl: row.n8nWebhookUrl || "",
                    supabaseUrl: row.supabaseUrl || "",
                    supabaseAnonKey: row.supabaseAnonKey || "",
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

            default:
                return NextResponse.json({ error: "Invalid type. Use: config, profile, appearance, or users" }, { status: 400 });
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
                    }).where(eq(config.id, 1)).run();
                } else {
                    db.insert(config).values({
                        id: 1,
                        n8nWebhookUrl: data.n8nWebhookUrl || "",
                        supabaseUrl: data.supabaseUrl || "",
                        supabaseAnonKey: data.supabaseAnonKey || "",
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

            default:
                return NextResponse.json({ error: "Invalid type" }, { status: 400 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[API] Error saving settings:", error);
        return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
    }
}
