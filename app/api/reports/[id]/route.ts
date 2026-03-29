import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { reports } from "@/db/schema";
import { eq } from "drizzle-orm";

// GET /api/reports/[id] — Get a single report
export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    try {
        const row = db.select().from(reports).where(eq(reports.id, id)).get();
        if (!row) {
            return NextResponse.json({ error: "Report not found" }, { status: 404 });
        }
        const reportData = JSON.parse(row.reportData);
        if (row.imageData && !reportData.image_data) {
            reportData.image_data = row.imageData;
        }

        return NextResponse.json({
            id: row.id,
            patient_name: row.patientName,
            modality: row.modality,
            urgency: row.urgency,
            report_status: row.reportStatus,
            report_data: reportData,
            created_at: row.createdAt,
        });
    } catch (error) {
        console.error("[API] Error fetching report:", error);
        return NextResponse.json({ error: "Failed to fetch report" }, { status: 500 });
    }
}

// PUT /api/reports/[id] — Update report data
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    try {
        const body = await request.json();
        const { updates } = body;

        // Get current report
        const row = db.select().from(reports).where(eq(reports.id, id)).get();
        if (!row) {
            return NextResponse.json({ error: "Report not found" }, { status: 404 });
        }

        const currentData = JSON.parse(row.reportData);
        const updatedData = { ...currentData, ...updates };

        db.update(reports)
            .set({
                reportData: JSON.stringify(updatedData),
                urgency: updatedData.urgency || row.urgency,
            })
            .where(eq(reports.id, id))
            .run();

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[API] Error updating report:", error);
        return NextResponse.json({ error: "Failed to update report" }, { status: 500 });
    }
}

// DELETE /api/reports/[id] — Delete a report
export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    try {
        db.delete(reports).where(eq(reports.id, id)).run();
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[API] Error deleting report:", error);
        return NextResponse.json({ error: "Failed to delete report" }, { status: 500 });
    }
}
