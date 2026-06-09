import { NextRequest } from "next/server";
import { db } from "@/db";
import { reports, patients } from "@/db/schema";
import { eq, or } from "drizzle-orm";
import { toFhirImagingStudy, fhirResponse, fhirErrorResponse, requireFhirAccess, sanitizeId } from "@/lib/fhir";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    // 1. Auth check
    const authError = await requireFhirAccess(request, "read");
    if (authError) return authError;

    // 2. Fetch data
    const { id } = await params;
    
    // We try to find the report by its sanitized PACS UID OR its internal ID
    // Since we don't have a direct index on sanitized UID, we might just load by ID
    // or by exact pacsStudyUid if they provided the raw one
    const reportRow = db.select().from(reports)
        .where(or(
            eq(reports.id, id),
            eq(reports.pacsStudyUid, id) // Fallback in case they used the raw DICOM UID
        )).get();

    if (!reportRow) {
        // As a fallback, we could query all reports and sanitize their UIDs, but for performance,
        // we'll stick to ID or raw UID for now. If they want to use sanitized UID, they should
        // look it up via DiagnosticReport.imagingStudy.reference first.
        return fhirErrorResponse("not-found", `ImagingStudy with id '${id}' not found`, 404);
    }

    if (!reportRow.pacsStudyUid) {
        return fhirErrorResponse("not-supported", `Report '${reportRow.id}' does not have associated PACS metadata`, 404);
    }

    let reportData;
    try {
        reportData = JSON.parse(reportRow.reportData);
    } catch (e) {
        return fhirErrorResponse("exception", "Failed to parse internal report data", 500);
    }

    const patientRow = reportRow.patientId 
        ? db.select().from(patients).where(eq(patients.id, reportRow.patientId)).get() 
        : undefined;

    // 3. Serialize and return
    const resource = toFhirImagingStudy({
        report: reportRow,
        reportData,
        patient: patientRow as any
    });

    return fhirResponse(resource);
}
