/// <reference types="fhir" />
import { Patient } from "../../types/index";
import { FHIR_SYSTEMS } from "./constants";
import { sanitizeId } from "./helpers";

export function toFhirPatient(patient: Patient): fhir4.Patient {
    const names: fhir4.HumanName[] = [];
    if (patient.patientName) {
        const parts = patient.patientName.trim().split(/\s+/);
        const family = parts.length > 1 ? parts.pop() || "" : "";
        const given = parts;
        names.push({
            text: patient.patientName,
            ...(family ? { family } : {}),
            ...(given.length > 0 ? { given } : {})
        });
    }

    let gender: fhir4.Patient["gender"] = "unknown";
    const pGender = patient.gender?.toLowerCase() || "";
    if (["male", "m"].includes(pGender)) gender = "male";
    else if (["female", "f"].includes(pGender)) gender = "female";
    else if (["other"].includes(pGender)) gender = "other";

    const telecom: fhir4.ContactPoint[] = [];
    if (patient.mobile) {
        telecom.push({ system: "phone", value: patient.mobile });
    }
    if (patient.contactInfo && patient.contactInfo !== patient.mobile) {
        if (patient.contactInfo.includes("@")) {
            telecom.push({ system: "email", value: patient.contactInfo });
        } else {
            telecom.push({ system: "phone", value: patient.contactInfo });
        }
    }

    const identifiers = [];
    if (patient.patientIdNumber) {
        identifiers.push({
            system: FHIR_SYSTEMS.OMNIRAD_PATIENT_ID,
            value: patient.patientIdNumber
        });
    }

    return {
        resourceType: "Patient",
        id: sanitizeId(patient.id),
        identifier: identifiers.length > 0 ? identifiers : undefined,
        name: names.length > 0 ? names : undefined,
        gender,
        birthDate: patient.dob || undefined,
        telecom: telecom.length > 0 ? telecom : undefined,
        address: patient.address ? [{ text: patient.address }] : undefined
    };
}
