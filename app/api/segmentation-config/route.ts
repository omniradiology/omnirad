import { NextRequest, NextResponse } from "next/server";
import { sqlite } from "@/db";
import { requireUser, requirePermission, handleAuthError } from "@/lib/security/authz";
import { maskSecret } from "@/lib/security/secrets";
import { safeError } from "@/lib/security/phi-redaction";
import { auditSuccess, auditEventFromContext } from "@/lib/security/audit";

// GET /api/segmentation-config — load active segmentation config
export async function GET(req: NextRequest) {
    try {
        const ctx = await requireUser(req);
        requirePermission(ctx, "settings.read");
        const row = sqlite
            .prepare("SELECT * FROM segmentation_configurations WHERE is_active = 1 LIMIT 1")
            .get() as any;

        if (!row) {
            return NextResponse.json({
                deploymentMode: "localhost",
                providerName: "MedSAM3",
                modelName: "",
                modelType: "medsam3",
                baseUrl: "http://localhost:5000",
                healthEndpoint: "/healthz",
                predictEndpoint: "/v1/segmentations",
                apiSecretKey: "",
                timeoutSeconds: 120,
                supportsContours: true,
                supports3D: false,
                returnsMask: true,
                returnsBox: true,
                isActive: false,
            });
        }

        return NextResponse.json({
            id: row.id,
            deploymentMode: row.deployment_mode,
            providerName: row.provider_name,
            modelName: row.model_name,
            modelType: row.model_type || "medsam3",
            baseUrl: row.base_url,
            healthEndpoint: row.health_endpoint,
            predictEndpoint: row.predict_endpoint,
            apiSecretKey: maskSecret(row.api_secret_key),
            hasApiKey: !!(row.api_secret_key && row.api_secret_key.length > 0),
            timeoutSeconds: row.timeout_seconds,
            supportsContours: !!row.supports_contours,
            supports3D: !!row.supports_3d,
            returnsMask: !!row.returns_mask,
            returnsBox: !!row.returns_box,
            isActive: !!row.is_active,
        });
    } catch (error: any) {
        if (error?.statusCode) return handleAuthError(error);
        safeError("segmentation-config GET error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// PUT /api/segmentation-config — save segmentation config
export async function PUT(req: NextRequest) {
    try {
        const ctx = await requireUser(req);
        requirePermission(ctx, "ai.configure");
        const body = await req.json();
        const {
            deploymentMode = "localhost",
            providerName = "MedSAM3",
            modelName = "",
            modelType = "medsam3",
            baseUrl: rawBaseUrl = "http://localhost:5000",
            healthEndpoint = "/healthz",
            predictEndpoint = "/v1/segmentations",
            apiSecretKey = "",
            timeoutSeconds = 120,
            supportsContours = true,
            supports3D = false,
            returnsMask = true,
            returnsBox = true,
            isActive = true,
        } = body;

        // Sanitize base URL: strip any trailing path segments (e.g. /v1, /api)
        // Keep only the origin (scheme + host + port)
        let baseUrl = rawBaseUrl.trim().replace(/\/+$/, "")
        try {
            const parsed = new URL(baseUrl)
            baseUrl = parsed.origin  // strips any path like /v1
        } catch { /* not a valid URL yet, keep as-is */ }

        const now = new Date().toISOString();

        // Check if a config already exists
        const existing = sqlite
            .prepare("SELECT id FROM segmentation_configurations LIMIT 1")
            .get() as any;

        if (existing) {
            sqlite.prepare(`
                UPDATE segmentation_configurations SET
                    deployment_mode = ?, provider_name = ?, model_name = ?,
                    model_type = ?,
                    base_url = ?, health_endpoint = ?, predict_endpoint = ?,
                    api_secret_key = ?, timeout_seconds = ?,
                    supports_contours = ?, supports_3d = ?,
                    returns_mask = ?, returns_box = ?,
                    is_active = ?, updated_at = ?
                WHERE id = ?
            `).run(
                deploymentMode, providerName, modelName,
                modelType,
                baseUrl, healthEndpoint, predictEndpoint,
                apiSecretKey || null, timeoutSeconds,
                supportsContours ? 1 : 0, supports3D ? 1 : 0,
                returnsMask ? 1 : 0, returnsBox ? 1 : 0,
                isActive ? 1 : 0, now,
                existing.id
            );
        } else {
            const id = `segconfig_${Date.now()}`;
            sqlite.prepare(`
                INSERT INTO segmentation_configurations
                (id, deployment_mode, provider_name, model_name, model_type, base_url, health_endpoint, predict_endpoint,
                 api_secret_key, timeout_seconds, supports_contours, supports_3d, returns_mask, returns_box,
                 is_active, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                id, deploymentMode, providerName, modelName,
                modelType,
                baseUrl, healthEndpoint, predictEndpoint,
                apiSecretKey || null, timeoutSeconds,
                supportsContours ? 1 : 0, supports3D ? 1 : 0,
                returnsMask ? 1 : 0, returnsBox ? 1 : 0,
                isActive ? 1 : 0, now, now
            );
        }

        await auditSuccess(auditEventFromContext(ctx, "settings.update", "ai", {
            metadata: { providerName, modelName },
        }));

        return NextResponse.json({ success: true });
    } catch (error: any) {
        if (error?.statusCode) return handleAuthError(error);
        safeError("segmentation-config PUT error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST /api/segmentation-config — test connectivity to segmentation backend
export async function POST(req: NextRequest) {
    try {
        const ctx = await requireUser(req);
        requirePermission(ctx, "ai.configure");
        const body = await req.json();
        const { baseUrl, healthEndpoint, apiSecretKey, timeoutSeconds = 15 } = body;

        if (!baseUrl) {
            return NextResponse.json({ success: false, error: "Base URL is required." });
        }

        // Sanitize: strip trailing slashes and any accidental sub-paths (e.g. /v1)
        let cleanBase = baseUrl.trim().replace(/\/+$/, "")
        try {
            const parsed = new URL(cleanBase)
            cleanBase = parsed.origin  // keeps only scheme+host+port
        } catch { /* keep as-is */ }

        const url = `${cleanBase}${healthEndpoint || "/healthz"}`;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), (timeoutSeconds || 15) * 1000);

        try {
            const headers: Record<string, string> = { "Content-Type": "application/json" };
            if (apiSecretKey) {
                headers["Authorization"] = `Bearer ${apiSecretKey}`;
            }

            const response = await fetch(url, {
                method: "GET",
                headers,
                signal: controller.signal,
            });

            clearTimeout(timeout);

            if (response.ok) {
                const data = await response.json().catch(() => ({}));
                
                // Fetch available models to populate UI (ignoring errors)
                let availableModels: string[] = [];
                try {
                    // Try the OpenAI /v1/models route structure MedSAM3 uses
                    const modelsRes = await fetch(`${cleanBase}/v1/models`, { 
                        method: "GET", headers, signal: AbortSignal.timeout(5000) 
                    });
                    if (modelsRes.ok) {
                        const mData = await modelsRes.json();
                        if (Array.isArray(mData)) {
                            availableModels = mData.map((m: any) => typeof m === "string" ? m : m.id || m.name || String(m));
                        } else if (mData?.data) {
                            availableModels = mData.data.map((m: any) => typeof m === "string" ? m : m.id || m.name || String(m));
                        }
                    }
                } catch { /* non-fatal if models fail to fetch */ }

                return NextResponse.json({
                    success: true,
                    message: `Connected successfully to ${url}`,
                    details: data,
                    availableModels: availableModels.filter(Boolean),
                });
            } else {
                const text = await response.text().catch(() => "");
                return NextResponse.json({
                    success: false,
                    error: `HTTP ${response.status}: ${text.slice(0, 200)}`,
                });
            }
        } catch (fetchErr: any) {
            clearTimeout(timeout);
            if (fetchErr.name === "AbortError") {
                return NextResponse.json({
                    success: false,
                    error: `Connection timed out after ${timeoutSeconds}s`,
                });
            }
            return NextResponse.json({
                success: false,
                error: `Connection failed: ${fetchErr.message}`,
            });
        }
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message });
    }
}
