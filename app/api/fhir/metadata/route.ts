/// <reference types="fhir" />
import { NextRequest } from "next/server";
import { fhirResponse } from "@/lib/fhir";


export async function GET(request: NextRequest) {
    const origin = request.nextUrl.origin;
    
    const capabilityStatement: fhir4.CapabilityStatement = {
        resourceType: "CapabilityStatement",
        status: "active",
        date: new Date().toISOString(),
        publisher: "OmniRad",
        kind: "instance",
        software: {
            name: "OmniRad FHIR Integration",
            version: "1.0.0"
        },
        implementation: {
            description: "OmniRad Radiology Information System",
            url: `${origin}/api/fhir`
        },
        fhirVersion: "4.0.1",
        format: ["application/fhir+json"],
        rest: [
            {
                mode: "server",
                resource: [
                    {
                        type: "Patient",
                        interaction: [{ code: "read" }]
                    },
                    {
                        type: "DiagnosticReport",
                        interaction: [{ code: "read" }]
                    },
                    {
                        type: "ImagingStudy",
                        interaction: [{ code: "read" }]
                    },
                    {
                        type: "ServiceRequest",
                        interaction: [{ code: "create" }]
                    }
                ]
            }
        ]
    };

    return fhirResponse(capabilityStatement);
}
