import { NextRequest, NextResponse } from "next/server";
import { sqlite } from "@/db";

// GET /api/copilot/reports — get report data for the viewer panel
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const patientId = searchParams.get("patientId");

    try {
        if (id) {
            // Get specific report by DB id
            let row = sqlite.prepare("SELECT * FROM reports WHERE id = ?").get(id) as any;

            // If not found by DB id, search by report_header.report_id in JSON
            if (!row) {
                const allReports = sqlite.prepare("SELECT * FROM reports").all() as any[];
                for (const r of allReports) {
                    try {
                        const rd = JSON.parse(r.report_data);
                        if (rd?.report_header?.report_id === id) {
                            row = r;
                            break;
                        }
                    } catch { /* skip */ }
                }
            }

            if (!row) {
                return NextResponse.json({ error: "Report not found" }, { status: 404 });
            }

            const reportData = typeof row.report_data === 'string' ? JSON.parse(row.report_data) : row.report_data;

            return NextResponse.json({
                id: row.id,
                patientId: row.patient_id,
                patientName: row.patient_name,
                modality: row.modality,
                urgency: row.urgency,
                reportStatus: row.report_status,
                reportData,
                imageData: row.image_data || null,
                pacsStudyUid: row.pacs_study_uid,
                createdAt: row.created_at,
            });
        }

        if (patientId) {
            // Get all reports for a patient
            const rows = sqlite.prepare(
                "SELECT id, patient_name, modality, urgency, report_status, report_data, image_data, created_at FROM reports WHERE patient_id = ? ORDER BY created_at DESC"
            ).all(patientId) as any[];

            const reports = rows.map((row: any) => {
                let reportData: any = {};
                try {
                    reportData = JSON.parse(row.report_data);
                } catch { /* skip */ }

                return {
                    id: row.id,
                    reportId: reportData?.report_header?.report_id || row.id,
                    patientName: row.patient_name,
                    modality: reportData?.study?.modality || row.modality,
                    date: reportData?.report_header?.report_date || row.created_at,
                    status: row.report_status,
                    urgency: reportData?.urgency || row.urgency,
                    hasImages: !!(row.image_data || reportData?.image_data),
                };
            });

            return NextResponse.json(reports);
        }

        return NextResponse.json({ error: "Either 'id' or 'patientId' parameter is required" }, { status: 400 });
    } catch (error: any) {
        console.error("[Copilot] Reports error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
