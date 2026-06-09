/// <reference types="fhir" />
import { NextRequest } from "next/server";
import { db } from "@/db";
import { reports, patients } from "@/db/schema";
import { eq } from "drizzle-orm";
import { 
    toFhirPatient, 
    toFhirDiagnosticReport, 
    toFhirImagingStudy, 
    fhirResponse, 
    fhirErrorResponse, 
    requireFhirAccess 
} from "@/lib/fhir";


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

    // 3. Serialize resources
    const entries: fhir4.BundleEntry[] = [];

    // Add Patient
    if (patientRow) {
        entries.push({
            fullUrl: `urn:uuid:${patientRow.id}`,
            resource: toFhirPatient(patientRow as any)
        });
    }

    // Add DiagnosticReport
    const fhirReport = toFhirDiagnosticReport({
        report: reportRow,
        reportData,
        patient: patientRow as any
    });
    entries.push({
        fullUrl: `urn:uuid:${fhirReport.id}`,
        resource: fhirReport
    });

    // Add ImagingStudy if it exists
    if (reportRow.pacsStudyUid) {
        const fhirStudy = toFhirImagingStudy({
            report: reportRow,
            reportData,
            patient: patientRow as any
        });
        entries.push({
            fullUrl: `urn:uuid:${fhirStudy.id}`,
            resource: fhirStudy
        });
    }

    const bundle: fhir4.Bundle = {
        resourceType: "Bundle",
        type: "collection",
        entry: entries
    };

    return fhirResponse(bundle);
}
