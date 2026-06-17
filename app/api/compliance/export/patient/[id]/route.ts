import { NextRequest, NextResponse } from "next/server";
import { db, sqlite } from "@/db";
import { patients, reports, patientPrivacyControls } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireUser, requirePermission, handleAuthError } from "@/lib/security/authz";
import { safeError } from "@/lib/security/phi-redaction";
import { auditSuccess, auditEventFromContext } from "@/lib/security/audit";
import { randomUUID } from "crypto";

// POST /api/compliance/export/patient/[id] — GDPR Article 20: Data Portability
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const ctx = await requireUser(request);
        requirePermission(ctx, "compliance.manage");

        const { id } = await params;

        // Get patient data
        const patient = db.select().from(patients).where(eq(patients.id, id)).limit(1).all();
        if (patient.length === 0) {
            return NextResponse.json({ error: "Patient not found" }, { status: 404 });
        }

        // Get all reports for this patient
        const patientReports = db.select({
            id: reports.id,
            modality: reports.modality,
            urgency: reports.urgency,
            reportStatus: reports.reportStatus,
            reportData: reports.reportData,
            createdAt: reports.createdAt,
        }).from(reports).where(eq(reports.patientId, id)).all();

        const parsedReports = patientReports.map(r => {
            let reportData: any = {};
            try { reportData = JSON.parse(r.reportData); } catch {}
            // Exclude image_data from exports to keep size manageable
            delete reportData.image_data;
            delete reportData.images_data;
            return {
                id: r.id,
                modality: r.modality,
                urgency: r.urgency,
                reportStatus: r.reportStatus,
                reportData,
                createdAt: r.createdAt,
            };
        });

        // Get privacy controls
        const privacyCtrl = sqlite.prepare(
            "SELECT * FROM patient_privacy_controls WHERE patient_id = ?"
        ).get(id) as any;

        // Build export package
        const exportData = {
            exportVersion: "1.0",
            exportedAt: new Date().toISOString(),
            exportedBy: ctx.fullName,
            patient: {
                id: patient[0].id,
                name: patient[0].patientName,
                idNumber: patient[0].patientIdNumber,
                dateOfBirth: patient[0].dob,
                age: patient[0].age,
                gender: patient[0].gender,
                contactInfo: patient[0].contactInfo,
                notes: patient[0].notes,
                createdAt: patient[0].createdAt,
            },
            reports: parsedReports,
            privacyControls: privacyCtrl ? {
                restriction: privacyCtrl.restriction,
                consentStatus: privacyCtrl.consent_status,
            } : null,
            _meta: {
                format: "OmniRad GDPR Export",
                recordCount: parsedReports.length,
            },
        };

        // Update last exported timestamp
        if (privacyCtrl) {
            sqlite.prepare(
                "UPDATE patient_privacy_controls SET last_exported_at = ?, last_exported_by = ?, updated_at = ? WHERE patient_id = ?"
            ).run(new Date().toISOString(), ctx.userId, new Date().toISOString(), id);
        } else {
            sqlite.prepare(
                "INSERT INTO patient_privacy_controls (id, patient_id, last_exported_at, last_exported_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
            ).run(randomUUID(), id, new Date().toISOString(), ctx.userId, new Date().toISOString(), new Date().toISOString());
        }

        await auditSuccess(auditEventFromContext(ctx, "patient.export", "patient", {
            resourceId: id,
            patientId: id,
            metadata: { format: "json", count: parsedReports.length },
        }));

        return NextResponse.json(exportData);
    } catch (error) {
        if ((error as any)?.statusCode) return handleAuthError(error);
        safeError("Error exporting patient data:", error);
        return NextResponse.json({ error: "Failed to export patient data" }, { status: 500 });
    }
}
