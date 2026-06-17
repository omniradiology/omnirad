import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { complianceSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireUser, requirePermission, handleAuthError } from "@/lib/security/authz";
import { safeError } from "@/lib/security/phi-redaction";
import { auditSuccess, auditEventFromContext } from "@/lib/security/audit";

// GET /api/compliance/settings — Get compliance settings
export async function GET(request: NextRequest) {
    try {
        const ctx = await requireUser(request);
        requirePermission(ctx, "compliance.manage");

        const row = db.select().from(complianceSettings).where(eq(complianceSettings.id, 1)).get();

        if (!row) {
            // Return defaults
            return NextResponse.json({
                dataRetentionDays: 2555,
                auditRetentionDays: 2555,
                sessionTimeoutMinutes: 15,
                idleTimeoutMinutes: 30,
                enableGdprExport: true,
                enableGdprAnonymize: true,
                enableGdprRestriction: true,
                legalBasis: "legitimate_interest",
                privacyPolicyUrl: "",
                dpoContactEmail: "",
            });
        }

        return NextResponse.json({
            dataRetentionDays: row.dataRetentionDays ?? 2555,
            auditRetentionDays: row.auditRetentionDays ?? 2555,
            sessionTimeoutMinutes: row.sessionTimeoutMinutes ?? 15,
            idleTimeoutMinutes: row.idleTimeoutMinutes ?? 30,
            enableGdprExport: !!(row.enableGdprExport ?? 1),
            enableGdprAnonymize: !!(row.enableGdprAnonymize ?? 1),
            enableGdprRestriction: !!(row.enableGdprRestriction ?? 1),
            legalBasis: row.legalBasis || "legitimate_interest",
            privacyPolicyUrl: row.privacyPolicyUrl || "",
            dpoContactEmail: row.dpoContactEmail || "",
        });
    } catch (error) {
        if ((error as any)?.statusCode) return handleAuthError(error);
        safeError("Error fetching compliance settings:", error);
        return NextResponse.json({ error: "Failed to fetch compliance settings" }, { status: 500 });
    }
}

// PUT /api/compliance/settings — Update compliance settings
export async function PUT(request: NextRequest) {
    try {
        const ctx = await requireUser(request);
        requirePermission(ctx, "compliance.manage");

        const data = await request.json();
        const now = new Date().toISOString();

        const exists = db.select().from(complianceSettings).where(eq(complianceSettings.id, 1)).get();

        const values = {
            dataRetentionDays: data.dataRetentionDays ?? 2555,
            auditRetentionDays: data.auditRetentionDays ?? 2555,
            sessionTimeoutMinutes: data.sessionTimeoutMinutes ?? 15,
            idleTimeoutMinutes: data.idleTimeoutMinutes ?? 30,
            enableGdprExport: !!data.enableGdprExport,
            enableGdprAnonymize: !!data.enableGdprAnonymize,
            enableGdprRestriction: !!data.enableGdprRestriction,
            legalBasis: data.legalBasis || "legitimate_interest",
            privacyPolicyUrl: data.privacyPolicyUrl || null,
            dpoContactEmail: data.dpoContactEmail || null,
            updatedAt: now,
        };

        if (exists) {
            db.update(complianceSettings).set(values).where(eq(complianceSettings.id, 1)).run();
        } else {
            db.insert(complianceSettings).values({ id: 1, ...values }).run();
        }

        await auditSuccess(auditEventFromContext(ctx, "compliance.settings.update", "config", {
            metadata: { method: "PUT", route: "/api/compliance/settings" },
        }));

        return NextResponse.json({ success: true });
    } catch (error) {
        if ((error as any)?.statusCode) return handleAuthError(error);
        safeError("Error updating compliance settings:", error);
        return NextResponse.json({ error: "Failed to update compliance settings" }, { status: 500 });
    }
}
