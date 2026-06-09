/// <reference types="fhir" />
import { ImagingStudyInput } from "../../types/fhir";
import { FHIR_SYSTEMS } from "./constants";
import { sanitizeId } from "./helpers";

export function toFhirImagingStudy({
    report,
    reportData,
    patient
}: ImagingStudyInput): fhir4.ImagingStudy {
    const studyUid = report.pacsStudyUid || reportData?.pacs_info?.study_uid;
    const seriesUid = report.pacsSeriesUid || reportData?.pacs_info?.series_uid;
    
    const identifiers = [];
    if (studyUid) {
        identifiers.push({
            system: FHIR_SYSTEMS.OMNIRAD_STUDY_UID,
            value: `urn:oid:${studyUid}`
        });
    }

    const series = [];
    if (seriesUid) {
        const modality = report.modality || reportData?.study?.modality;
        series.push({
            uid: seriesUid,
            modality: { 
                system: "http://dicom.nema.org/resources/ontology/DCM",
                code: modality || "UNKNOWN" 
            }
        });
    }

    const started = reportData?.report_header?.report_date || report.createdAt;

    return {
        resourceType: "ImagingStudy",
        id: sanitizeId(studyUid || report.id),
        identifier: identifiers.length > 0 ? identifiers : undefined,
        status: studyUid ? "available" : "unknown",
        subject: {
            reference: patient ? `Patient/${sanitizeId(patient.id)}` : `Patient/${sanitizeId(report.patientId || "unknown")}`,
            display: patient?.patientName || report.patientName || undefined
        },
        started: started ? new Date(started).toISOString() : undefined,
        description: reportData?.study?.examination || undefined,
        series: series.length > 0 ? series : undefined
    };
}
