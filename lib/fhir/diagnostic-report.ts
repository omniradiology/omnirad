/// <reference types="fhir" />
import { DiagnosticReportInput } from "../../types/fhir";
import { FHIR_SYSTEMS, DEFAULT_DIAGNOSTIC_REPORT_CODE, RADIOLOGY_CATEGORY } from "./constants";
import { sanitizeId } from "./helpers";

export function toFhirDiagnosticReport({
    report,
    reportData,
    patient,
    pdfBase64,
    serviceRequestId
}: DiagnosticReportInput): fhir4.DiagnosticReport {
    let status: fhir4.DiagnosticReport["status"] = "unknown";
    const pStatus = report.reportStatus?.toLowerCase();
    if (pStatus === "pending") status = "preliminary";
    else if (pStatus === "approved" || pStatus === "final") status = "final";
    else if (pStatus === "rejected") status = "cancelled";

    const identifiers = [];
    if (reportData?.report_header?.report_id) {
        identifiers.push({
            system: FHIR_SYSTEMS.OMNIRAD_REPORT_ID,
            value: reportData.report_header.report_id
        });
    } else {
        identifiers.push({
            system: FHIR_SYSTEMS.OMNIRAD_REPORT_ID,
            value: report.id
        });
    }

    const effectiveDateTime = reportData?.report_header?.report_date || report.createdAt;
    let issued = reportData?.report_footer?.approved_at || report.createdAt;

    const conclusion = reportData?.impression ? reportData.impression.join("\n") : undefined;

    const resource: fhir4.DiagnosticReport = {
        resourceType: "DiagnosticReport",
        id: sanitizeId(report.id),
        identifier: identifiers,
        status,
        category: [
            {
                coding: [RADIOLOGY_CATEGORY],
                text: RADIOLOGY_CATEGORY.display
            }
        ],
        code: {
            coding: [DEFAULT_DIAGNOSTIC_REPORT_CODE],
            text: reportData?.study?.examination || `${report.modality || "Imaging"} report`
        },
        subject: {
            reference: patient ? `Patient/${sanitizeId(patient.id)}` : `Patient/${sanitizeId(report.patientId || "unknown")}`,
            display: patient?.patientName || report.patientName || undefined
        },
        effectiveDateTime: effectiveDateTime ? new Date(effectiveDateTime).toISOString() : undefined,
        issued: issued ? new Date(issued).toISOString() : undefined,
        conclusion
    };

    if (report.pacsStudyUid || report.id) {
        resource.imagingStudy = [
            {
                reference: `ImagingStudy/${sanitizeId(report.pacsStudyUid || report.id)}`
            }
        ];
    }

    if (serviceRequestId) {
        resource.basedOn = [
            {
                reference: `ServiceRequest/${sanitizeId(serviceRequestId)}`
            }
        ];
    }

    if (pdfBase64) {
        resource.presentedForm = [
            {
                contentType: "application/pdf",
                title: "OmniRad Radiology Report",
                data: pdfBase64
            }
        ];
    }

    return resource;
}
