import { NextResponse } from "next/server";
import { db } from "@/db";
import { reports, patients } from "@/db/schema";

// DELETE /api/reports/clear — Delete all reports and patients
export async function DELETE() {
    try {
        db.delete(reports).run();
        db.delete(patients).run();
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[API] Error clearing reports:", error);
        return NextResponse.json({ error: "Failed to clear reports" }, { status: 500 });
    }
}

