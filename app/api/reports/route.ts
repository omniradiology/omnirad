import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { reports, patients } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { randomUUID } from "crypto";

// GET /api/reports — List all reports
export async function GET() {
    try {
        const rows = db.select().from(reports).orderBy(desc(reports.createdAt)).all();
        const parsed = rows.map((r) => {
            const reportData = JSON.parse(r.reportData);
            if (r.imageData && !reportData.image_data) {
                reportData.image_data = r.imageData;
            }
            return {
                id: r.id,
                patient_name: r.patientName,
                modality: r.modality,
                urgency: r.urgency,
                report_status: r.reportStatus,
                report_data: reportData,
                created_at: r.createdAt,
                pacs_study_uid: r.pacsStudyUid,
                pacs_series_uid: r.pacsSeriesUid,
                pacs_source: r.pacsSource,
            };
        });
        return NextResponse.json(parsed);
    } catch (error) {
        console.error("[API] Error fetching reports:", error);
        return NextResponse.json([], { status: 500 });
    }
}

// POST /api/reports — Create a new report
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { report_data, id } = body;

        const reportId = id || `local_${Date.now()}`;
        const pName = report_data.patient?.name || "Unknown";
        const pIdNumber = report_data.patient?.patient_id || body.patientIdNumber || null;

        // Auto-link or auto-create patient
        let linkedPatientId = "";
        
        // 1. Try to find by ID number first if provided
        let existing = [];
        if (pIdNumber) {
            existing = await db.select().from(patients).where(eq(patients.patientIdNumber, pIdNumber)).limit(1);
        }
        // 2. If not found by ID, try exact match by Name
        if (existing.length === 0) {
            existing = await db.select().from(patients).where(eq(patients.patientName, pName)).limit(1);
        }

        if (existing.length > 0) {
            linkedPatientId = existing[0].id;

            // Backfill any missing patient metadata from the new report
            const updates: Record<string, any> = {};
            const incomingAge = report_data.patient?.age || body.age;
            const incomingDob = report_data.patient?.dob || body.dob;
            const incomingGender = report_data.patient?.gender || body.gender;

            if (!existing[0].age && incomingAge) updates.age = incomingAge;
            if (!existing[0].dob && incomingDob) updates.dob = incomingDob;
            if (!existing[0].gender && incomingGender) updates.gender = incomingGender;

            if (Object.keys(updates).length > 0) {
                updates.updatedAt = new Date().toISOString();
                await db.update(patients).set(updates).where(eq(patients.id, linkedPatientId));
            }
        } else {
            // Auto-create
            linkedPatientId = randomUUID();
            await db.insert(patients).values({
                id: linkedPatientId,
                patientName: pName,
                patientIdNumber: pIdNumber,
                dob: report_data.patient?.dob || body.dob || null,
                age: report_data.patient?.age || body.age || null,
                gender: report_data.patient?.gender || body.gender || null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
        }

        // Insert report
        db.insert(reports).values({
            id: reportId,
            patientId: linkedPatientId,
            patientName: pName,
            modality: report_data.study?.examination || report_data.study?.modality || "",
            urgency: report_data.urgency || "Routine",
            reportStatus: report_data.report_footer?.report_status || "Pending",
            reportData: JSON.stringify(report_data),
            imageData: report_data.image_data || null,
            createdAt: new Date().toISOString(),
            pacsStudyUid: report_data.pacs_info?.study_uid || null,
            pacsSeriesUid: report_data.pacs_info?.series_uid || null,
            pacsSource: report_data.pacs_info?.source || null,
        }).run();

        return NextResponse.json({ id: reportId, patientId: linkedPatientId, success: true });
    } catch (error) {
        console.error("[API] Error saving report:", error);
        return NextResponse.json({ error: "Failed to save report" }, { status: 500 });
    }
}
