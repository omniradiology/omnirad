import { NextRequest } from "next/server";
import { db } from "@/db";
import { reports, patients } from "@/db/schema";
import { eq } from "drizzle-orm";
import { toFhirDiagnosticReport, fhirResponse, fhirErrorResponse, requireFhirAccess } from "@/lib/fhir";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    // 1. Auth check
    const authError = await requireFhirAccess(request, "read");
    if (authError) return authError;

    // 2. Fetch data
    const { id } = await params;
    const reportRow = db.select().from(reports).where(eq(reports.id, id)).get();

    if (!reportRow) {
        return fhirErrorResponse("not-found", `DiagnosticReport with id '${id}' not found`, 404);
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

    // Optional PDF generation handling could go here
    // const includePdf = request.nextUrl.searchParams.get("includePdf") === "true";

    // 3. Serialize and return
    const resource = toFhirDiagnosticReport({
        report: reportRow,
        reportData,
        patient: patientRow as any
    });

    return fhirResponse(resource);
}
