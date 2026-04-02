import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { reports } from "@/db/schema";
import { desc } from "drizzle-orm";

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

        db.insert(reports).values({
            id: reportId,
            patientName: report_data.patient?.name || "",
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

        return NextResponse.json({ id: reportId, success: true });
    } catch (error) {
        console.error("[API] Error saving report:", error);
        return NextResponse.json({ error: "Failed to save report" }, { status: 500 });
    }
}
