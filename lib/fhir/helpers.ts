/// <reference types="fhir" />
import { NextResponse, NextRequest } from "next/server";
import { FHIR_CONTENT_TYPE } from "./constants";
import { db } from "@/db";
import { fhirIntegrationConfig } from "@/db/schema";
import { eq } from "drizzle-orm";
import * as bcrypt from "bcryptjs";

export function operationOutcome(
    code: fhir4.OperationOutcomeIssue["code"],
    diagnostics: string,
    severity: fhir4.OperationOutcomeIssue["severity"] = "error"
): fhir4.OperationOutcome {
    return {
        resourceType: "OperationOutcome",
        issue: [
            {
                severity,
                code,
                diagnostics
            }
        ]
    };
}

export function sanitizeId(id: string | null | undefined): string {
    if (!id) return "unknown";
    // FHIR IDs must be [A-Za-z0-9\-\.]{1,64}
    return id.replace(/[^A-Za-z0-9\-\.]/g, "-").substring(0, 64);
}

export function fhirResponse(resource: any, status: number = 200) {
    return NextResponse.json(resource, {
        status,
        headers: { "Content-Type": FHIR_CONTENT_TYPE }
    });
}

export function fhirErrorResponse(code: fhir4.OperationOutcomeIssue["code"], message: string, status: number) {
    return fhirResponse(operationOutcome(code, message), status);
}

export async function requireFhirAccess(request: NextRequest, scope: "read" | "write" = "read"): Promise<NextResponse | null> {
    const config = db.select().from(fhirIntegrationConfig).where(eq(fhirIntegrationConfig.id, 1)).get();
    
    if (!config || !config.enabled) {
        return fhirErrorResponse("security", "FHIR API is disabled", 403);
    }

    if (scope === "read" && !config.outboundReadEnabled) {
        return fhirErrorResponse("security", "Outbound FHIR reads are disabled", 403);
    }

    if (scope === "write" && !config.inboundServiceRequestEnabled) {
        return fhirErrorResponse("security", "Inbound FHIR orders are disabled", 403);
    }

    if (config.authMode === "bearer_token" && config.apiTokenHash) {
        const authHeader = request.headers.get("authorization");
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return fhirErrorResponse("security", "Missing or invalid Authorization header", 401);
        }

        const token = authHeader.split(" ")[1];
        const isValid = await bcrypt.compare(token, config.apiTokenHash);
        
        if (!isValid) {
            return fhirErrorResponse("security", "Invalid bearer token", 401);
        }
    }

    return null;
}
