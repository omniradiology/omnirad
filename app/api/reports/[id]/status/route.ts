import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { reports } from "@/db/schema";
import { eq } from "drizzle-orm";

// PATCH /api/reports/[id]/status — Update report status (approve/reject/unreject)
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    try {
        const body = await request.json();
        const { status, signature, rejectionReason, notes, userName, userRole } = body;

        // Get current report
        const row = db.select().from(reports).where(eq(reports.id, id)).get();
        if (!row) {
            return NextResponse.json({ error: "Report not found" }, { status: 404 });
        }

        const updatedData = JSON.parse(row.reportData);

        // Update status in report_data
        updatedData.report_footer.report_status = status;

        // Collaboration: logs & comments
        if (!updatedData.collaboration) {
            updatedData.collaboration = { comments: [], logs: [] };
        }
        const timestamp = new Date().toISOString();
        const user = userName || "System";

        updatedData.collaboration.logs.push({
            id: `log_${Date.now()}`,
            action: `Status Changed to ${status}`,
            user,
            timestamp,
            details: status === "Rejected" ? `Reason: ${rejectionReason}` :
                status === "Approved" ? "Report Approved" : "Status reset",
        });

        if (notes || rejectionReason) {
            updatedData.collaboration.comments.push({
                id: `comment_${Date.now()}`,
                author: user,
                role: userRole || "System",
                text: notes || rejectionReason || "",
                timestamp,
            });
        }

        // Handle approval
        if (status === "Approved") {
            updatedData.report_footer.approved_at = timestamp;
            if (signature) updatedData.report_footer.signature = signature;
            updatedData.report_footer.approved_by = user;
        }

        // Handle rejection
        if (status === "Rejected" && rejectionReason) {
            updatedData.report_footer.rejection_reason = rejectionReason;
        }

        // Handle unreject (clear rejection reason)
        if (status === "Pending") {
            updatedData.report_footer.rejection_reason = undefined;
        }

        // Update SQLite
        db.update(reports)
            .set({
                reportData: JSON.stringify(updatedData),
                reportStatus: status,
            })
            .where(eq(reports.id, id))
            .run();

        return NextResponse.json({
            success: true,
            report_data: updatedData,
        });
    } catch (error) {
        console.error("[API] Error updating report status:", error);
        return NextResponse.json({ error: "Failed to update status" }, { status: 500 });
    }
}
