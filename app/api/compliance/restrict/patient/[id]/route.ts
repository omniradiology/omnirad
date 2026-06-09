import { NextRequest, NextResponse } from "next/server";
import { db, sqlite } from "@/db";
import { patients } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireUser, requirePermission, handleAuthError } from "@/lib/security/authz";
import { safeError } from "@/lib/security/phi-redaction";
import { auditSuccess, auditEventFromContext } from "@/lib/security/audit";
import { randomUUID } from "crypto";

// POST /api/compliance/restrict/patient/[id] — GDPR Article 18: Right to Restriction
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const ctx = await requireUser(request);
        requirePermission(ctx, "compliance.manage");

        const { id } = await params;
        const body = await request.json();
        const { restriction, reason } = body; // restriction: "restricted" | "none"

        // Validate patient exists
        const patient = await db.select().from(patients).where(eq(patients.id, id)).limit(1);
        if (patient.length === 0) {
            return NextResponse.json({ error: "Patient not found" }, { status: 404 });
        }

        const now = new Date().toISOString();
        const existing = sqlite.prepare(
            "SELECT id FROM patient_privacy_controls WHERE patient_id = ?"
        ).get(id) as any;

        if (existing) {
            sqlite.prepare(`
                UPDATE patient_privacy_controls 
                SET restriction = ?, restricted_by = ?, restricted_at = ?, restriction_reason = ?, updated_at = ?
                WHERE patient_id = ?
            `).run(restriction || "restricted", ctx.userId, now, reason || null, now, id);
        } else {
            sqlite.prepare(`
                INSERT INTO patient_privacy_controls (id, patient_id, restriction, restricted_by, restricted_at, restriction_reason, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).run(randomUUID(), id, restriction || "restricted", ctx.userId, now, reason || null, now, now);
        }

        await auditSuccess(auditEventFromContext(ctx, "patient.restrict", "patient", {
            resourceId: id,
            patientId: id,
            metadata: { restriction: restriction || "restricted" },
        }));

        return NextResponse.json({ success: true });
    } catch (error) {
        if ((error as any)?.statusCode) return handleAuthError(error);
        safeError("Error restricting patient:", error);
        return NextResponse.json({ error: "Failed to restrict patient" }, { status: 500 });
    }
}
