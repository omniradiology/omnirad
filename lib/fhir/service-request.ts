/// <reference types="fhir" />
import { WorklistOrder, OmniRadWorklistOrderInput } from "../../types/fhir";
import { sanitizeId } from "./helpers";

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

export function parseInboundServiceRequest(resource: fhir4.ServiceRequest): OmniRadWorklistOrderInput {
    if (resource.resourceType !== "ServiceRequest") {
        throw new Error("Invalid resourceType: expected ServiceRequest");
    }
    
    // priority mapping
    let urgency = "Routine";
    if (resource.priority === "urgent" || resource.priority === "asap") urgency = "Urgent";
    else if (resource.priority === "stat") urgency = "Critical";

    let patientId = null;
    let patientName = "Unknown";
    let patientIdentifier = "";
    
    if (resource.subject) {
        if (resource.subject.reference && resource.subject.reference.startsWith("Patient/")) {
            patientId = resource.subject.reference.replace("Patient/", "");
        }
        if (resource.subject.display) {
            patientName = resource.subject.display;
        }
    }

    let requestedProcedure = "";
    if (resource.code?.text) {
        requestedProcedure = resource.code.text;
    } else if (resource.code?.coding && resource.code.coding.length > 0) {
        requestedProcedure = resource.code.coding[0].display || resource.code.coding[0].code || "";
    }

    let reason = "";
    if (resource.reasonCode && resource.reasonCode.length > 0) {
        reason = resource.reasonCode[0].text || resource.reasonCode[0].coding?.[0]?.display || "";
    }

    return {
        id: generateUUID(),
        sourceSystem: "FHIR",
        fhirServiceRequestId: resource.id || "",
        patientId,
        patientName,
        patientIdentifier,
        status: resource.status || "active",
        intent: resource.intent || "order",
        priority: resource.priority || "routine",
        urgency,
        modality: null,
        requestedProcedure,
        reason,
        authoredOn: resource.authoredOn || new Date().toISOString(),
        requesterDisplay: resource.requester?.display || null,
        rawFhir: JSON.stringify(resource),
        createdAt: new Date().toISOString(),
        updatedAt: null
    };
}

export function toFhirServiceRequest(order: WorklistOrder): fhir4.ServiceRequest {
    return {
        resourceType: "ServiceRequest",
        id: sanitizeId(order.fhirServiceRequestId || order.id),
        status: (order.status as fhir4.ServiceRequest["status"]) || "active",
        intent: (order.intent as fhir4.ServiceRequest["intent"]) || "order",
        priority: (order.priority as fhir4.ServiceRequest["priority"]) || "routine",
        code: order.requestedProcedure ? { text: order.requestedProcedure } : undefined,
        subject: {
            reference: order.patientId ? `Patient/${sanitizeId(order.patientId)}` : undefined,
            display: order.patientName || undefined
        },
        authoredOn: order.authoredOn || undefined,
        reasonCode: order.reason ? [{ text: order.reason }] : undefined,
        requester: order.requesterDisplay ? { display: order.requesterDisplay } : undefined
    };
}
