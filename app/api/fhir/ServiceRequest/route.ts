/// <reference types="fhir" />
import { NextRequest } from "next/server";
import { db } from "@/db";
import { patients, worklistOrders } from "@/db/schema";
import { eq } from "drizzle-orm";
import { 
    parseInboundServiceRequest, 
    toFhirServiceRequest,
    fhirResponse, 
    fhirErrorResponse, 
    requireFhirAccess 
} from "@/lib/fhir";


export async function POST(request: NextRequest) {
    // 1. Auth check
    const authError = await requireFhirAccess(request, "write");
    if (authError) return authError;

    // 2. Validate content type
    const contentType = request.headers.get("content-type");
    if (!contentType?.includes("application/fhir+json")) {
        return fhirErrorResponse("invalid", "Content-Type must be application/fhir+json", 415);
    }

    try {
        const body = await request.json() as fhir4.ServiceRequest;

        if (body.resourceType !== "ServiceRequest") {
            return fhirErrorResponse("invalid", `Expected ServiceRequest, got ${body.resourceType}`, 400);
        }

        // 3. Parse and map to OmniRad model
        const orderInput = parseInboundServiceRequest(body);
        
        // Ensure patient exists
        let patientId = orderInput.patientId;
        
        if (orderInput.patientIdentifier && !patientId) {
            // Try to find patient by identifier
            const existing = db.select().from(patients).where(eq(patients.patientIdNumber, orderInput.patientIdentifier)).get();
            if (existing) {
                patientId = existing.id;
            } else {
                // We could auto-create a patient stub here if we had all the details, 
                // but usually the EMR sends Patient first or we match by demographics.
                // For MVP, we'll store the order without a linked patient ID, but keeping the name/identifier.
            }
        }

        const newId = `order_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

        // 4. Store in database
        const newOrder = {
            id: newId,
            sourceSystem: "FHIR",
            fhirServiceRequestId: body.id || null,
            patientId: patientId || null,
            patientName: orderInput.patientName,
            patientIdentifier: orderInput.patientIdentifier,
            status: orderInput.status,
            intent: orderInput.intent,
            priority: orderInput.priority,
            urgency: orderInput.urgency,
            modality: orderInput.modality || null,
            requestedProcedure: orderInput.requestedProcedure,
            reason: orderInput.reason || null,
            authoredOn: orderInput.authoredOn || new Date().toISOString(),
            requesterDisplay: orderInput.requesterDisplay || null,
            rawFhir: JSON.stringify(body),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        db.insert(worklistOrders).values(newOrder).run();

        // 5. Return success with the stored resource representation
        const storedResource = toFhirServiceRequest(newOrder as any);
        return fhirResponse(storedResource, 201);

    } catch (e: any) {
        console.error("[FHIR ServiceRequest] Error processing inbound order:", e);
        return fhirErrorResponse("exception", `Failed to process ServiceRequest: ${e.message}`, 400);
    }
}
