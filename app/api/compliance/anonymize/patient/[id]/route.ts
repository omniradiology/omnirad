import { NextRequest, NextResponse } from "next/server";
import { db, sqlite } from "@/db";
import { patients, reports } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireUser, requirePermission, handleAuthError } from "@/lib/security/authz";
import { safeError } from "@/lib/security/phi-redaction";
import { auditSuccess, auditEventFromContext } from "@/lib/security/audit";
import { randomUUID } from "crypto";

// POST /api/compliance/anonymize/patient/[id] — GDPR Article 17: Right to Erasure (Anonymization)
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const ctx = await requireUser(request);
        requirePermission(ctx, "compliance.manage");

        const { id } = await params;

        // Validate patient exists
        const patient = await db.select().from(patients).where(eq(patients.id, id)).limit(1);
        if (patient.length === 0) {
            return NextResponse.json({ error: "Patient not found" }, { status: 404 });
        }

        const now = new Date().toISOString();
        const anonymizedName = `ANONYMIZED_${Date.now()}`;

        // Anonymize patient record — replace PII with placeholder values
        db.update(patients).set({
            patientName: anonymizedName,
            patientIdNumber: null,
            dob: null,
            age: null,
            gender: null,
            mobile: null,
            address: null,
            contactInfo: null,
            notes: null,
            updatedAt: now,
        }).where(eq(patients.id, id)).run();

        // Anonymize reports — strip patient-identifying info from report_data JSON
        const patientReports = sqlite.prepare(
            "SELECT id, report_data FROM reports WHERE patient_id = ?"
        ).all(id) as any[];

        for (const r of patientReports) {
            try {
                const reportData = JSON.parse(r.report_data);
                // Strip patient section
                if (reportData.patient) {
                    reportData.patient = {
                        name: anonymizedName,
                        patient_id: null,
                        dob: null,
                        age: null,
                        gender: null,
                    };
                }
                // Strip image data
                delete reportData.image_data;

                sqlite.prepare(
                    "UPDATE reports SET patient_name = ?, report_data = ?, image_data = NULL WHERE id = ?"
                ).run(anonymizedName, JSON.stringify(reportData), r.id);
            } catch { /* skip reports that fail to parse */ }
        }

        // Update privacy controls
        const existing = sqlite.prepare(
            "SELECT id FROM patient_privacy_controls WHERE patient_id = ?"
        ).get(id) as any;

        if (existing) {
            sqlite.prepare(`
                UPDATE patient_privacy_controls 
                SET restriction = 'anonymized', anonymized_at = ?, anonymized_by = ?, updated_at = ?
                WHERE patient_id = ?
            `).run(now, ctx.userId, now, id);
        } else {
            sqlite.prepare(`
                INSERT INTO patient_privacy_controls (id, patient_id, restriction, anonymized_at, anonymized_by, created_at, updated_at)
                VALUES (?, ?, 'anonymized', ?, ?, ?, ?)
            `).run(randomUUID(), id, now, ctx.userId, now, now);
        }

        await auditSuccess(auditEventFromContext(ctx, "patient.anonymize", "patient", {
            resourceId: id,
            patientId: id,
            metadata: { count: patientReports.length },
        }));

        return NextResponse.json({
            success: true,
            anonymizedReports: patientReports.length,
        });
    } catch (error) {
        if ((error as any)?.statusCode) return handleAuthError(error);
        safeError("Error anonymizing patient:", error);
        return NextResponse.json({ error: "Failed to anonymize patient" }, { status: 500 });
    }
}
