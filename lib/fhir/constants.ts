export const FHIR_SYSTEMS = {
    LOINC: "http://loinc.org",
    HL7_V2_0074: "http://terminology.hl7.org/CodeSystem/v2-0074",
    OMNIRAD_REPORT_ID: "urn:oid:1.3.6.1.4.1.59626.1.1", // Or another domain-specific URL
    OMNIRAD_PATIENT_ID: "urn:oid:1.3.6.1.4.1.59626.1.2",
    OMNIRAD_STUDY_UID: "urn:ietf:rfc:3986" // For DICOM UIDs like urn:oid:...
};

export const DEFAULT_DIAGNOSTIC_REPORT_CODE = {
    system: FHIR_SYSTEMS.LOINC,
    code: "18748-4",
    display: "Diagnostic imaging study"
};

export const RADIOLOGY_CATEGORY = {
    system: FHIR_SYSTEMS.HL7_V2_0074,
    code: "RAD",
    display: "Radiology"
};

export const FHIR_CONTENT_TYPE = "application/fhir+json";
