import { NextRequest, NextResponse } from "next/server";
import { createFhirClient } from "@/lib/fhir/client";
import { requireUser, requirePermission, handleAuthError } from "@/lib/security/authz";
import { safeError } from "@/lib/security/phi-redaction";

export async function POST(request: NextRequest) {
    try {
        const ctx = await requireUser(request);
        requirePermission(ctx, "settings.write");

        const body = await request.json();
        const {
            externalFhirBaseUrl,
            externalFhirAuthType,
            externalFhirBearerToken,
            externalFhirClientId,
            externalFhirClientSecret
        } = body;

        if (!externalFhirBaseUrl) {
            return NextResponse.json({ success: false, error: "FHIR Base URL is required." });
        }

        const client = createFhirClient(
            externalFhirBaseUrl,
            externalFhirAuthType,
            externalFhirBearerToken,
            externalFhirClientId,
            externalFhirClientSecret
        );

        // Attempt to fetch capability statement (metadata)
        const capabilityStatement = await client.capabilityStatement();

        return NextResponse.json({
            success: true,
            fhirVersion: (capabilityStatement as any)?.fhirVersion || "Unknown",
            softwareName: (capabilityStatement as any)?.software?.name || (capabilityStatement as any)?.publisher || "Unknown FHIR Server"
        });

    } catch (error: any) {
        if (error?.statusCode) return handleAuthError(error);
        safeError("FHIR Test Connection Error:", error);
        return NextResponse.json({ 
            success: false, 
            error: error.message || "Failed to connect to the FHIR server. Please check your credentials and URL." 
        });
    }
}
