import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { fhirIntegrationConfig } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireUser, requirePermission, handleAuthError } from "@/lib/security/authz";
import { maskSecret } from "@/lib/security/secrets";
import { safeError } from "@/lib/security/phi-redaction";
import { auditSuccess, auditEventFromContext } from "@/lib/security/audit";

export async function GET(request: NextRequest) {
    try {
        const ctx = await requireUser(request);
        requirePermission(ctx, "settings.read");

        const row = db.select().from(fhirIntegrationConfig).where(eq(fhirIntegrationConfig.id, 1)).get();
        if (!row) {
            return NextResponse.json({
                enabled: false,
                publicBaseUrl: "",
                authMode: "bearer_token",
                inboundServiceRequestEnabled: false,
                outboundReadEnabled: true,
                externalFhirBaseUrl: "",
                externalFhirAuthType: "none",
                externalFhirClientId: "",
                externalFhirClientSecret: "",
                hasClientSecret: false,
                externalFhirBearerToken: "",
                hasBearerToken: false,
            });
        }
        return NextResponse.json({
            enabled: row.enabled ?? false,
            publicBaseUrl: row.publicBaseUrl || "",
            authMode: row.authMode || "bearer_token",
            inboundServiceRequestEnabled: row.inboundServiceRequestEnabled ?? false,
            outboundReadEnabled: row.outboundReadEnabled ?? true,
            externalFhirBaseUrl: row.externalFhirBaseUrl || "",
            externalFhirAuthType: row.externalFhirAuthType || "none",
            externalFhirClientId: row.externalFhirClientId || "",
            externalFhirClientSecret: maskSecret(row.externalFhirClientSecret),
            hasClientSecret: !!(row.externalFhirClientSecret && row.externalFhirClientSecret.length > 0),
            externalFhirBearerToken: maskSecret(row.externalFhirBearerToken),
            hasBearerToken: !!(row.externalFhirBearerToken && row.externalFhirBearerToken.length > 0),
        });
    } catch (error) {
        if ((error as any)?.statusCode) return handleAuthError(error);
        safeError("Error reading FHIR configuration:", error);
        return NextResponse.json({ error: "Failed to read FHIR configuration" }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const ctx = await requireUser(request);
        requirePermission(ctx, "settings.write");

        const data = await request.json();
        const exists = db.select().from(fhirIntegrationConfig).where(eq(fhirIntegrationConfig.id, 1)).get();
        const now = new Date().toISOString();

        const updateData: Record<string, any> = {
            enabled: data.enabled ?? false,
            publicBaseUrl: data.publicBaseUrl || "",
            authMode: data.authMode || "bearer_token",
            inboundServiceRequestEnabled: data.inboundServiceRequestEnabled ?? false,
            outboundReadEnabled: data.outboundReadEnabled ?? true,
            externalFhirBaseUrl: data.externalFhirBaseUrl || "",
            externalFhirAuthType: data.externalFhirAuthType || "none",
            externalFhirClientId: data.externalFhirClientId || "",
            updatedAt: now,
        };

        // Only update secrets if new non-masked values provided
        if (data.externalFhirClientSecret && !data.externalFhirClientSecret.startsWith("********")) {
            updateData.externalFhirClientSecret = data.externalFhirClientSecret;
        }
        if (data.externalFhirBearerToken && !data.externalFhirBearerToken.startsWith("********")) {
            updateData.externalFhirBearerToken = data.externalFhirBearerToken;
        }

        if (exists) {
            db.update(fhirIntegrationConfig).set(updateData).where(eq(fhirIntegrationConfig.id, 1)).run();
        } else {
            db.insert(fhirIntegrationConfig).values({
                id: 1,
                ...updateData,
                createdAt: now,
            }).run();
        }

        await auditSuccess(auditEventFromContext(ctx, "settings.update", "fhir", {
            metadata: { method: "POST", route: "/api/fhir/config" },
        }));

        return NextResponse.json({ success: true });
    } catch (error) {
        if ((error as any)?.statusCode) return handleAuthError(error);
        safeError("Error saving FHIR configuration:", error);
        return NextResponse.json({ error: "Failed to save FHIR configuration" }, { status: 500 });
    }
}
