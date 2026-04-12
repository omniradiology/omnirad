import { NextResponse } from "next/server";
import { db } from "@/db";
import { aiConfigurations } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const mode = searchParams.get("mode");
        const purpose = searchParams.get("purpose");

        // Internal mode: return the active config WITH the real key (for server-side forwarding)
        if (mode === "active_internal") {
            const targetPurpose = purpose || "report_generation";
            const all = db.select().from(aiConfigurations).where(eq(aiConfigurations.isActive, true)).all();
            // Find config matching the requested purpose, fallback to any active
            const match = all.find((c: any) => (c.purpose || 'report_generation') === targetPurpose) || all[0];
            if (!match) {
                return NextResponse.json({ error: "No active AI configuration found" }, { status: 404 });
            }
            return NextResponse.json(match);
        }

        // Default: return all configs, optionally filtered by purpose
        const configs = db.select().from(aiConfigurations).all();
        if (purpose) {
            const filtered = configs.filter((c: any) => (c.purpose || 'report_generation') === purpose);
            return NextResponse.json(filtered);
        }
        return NextResponse.json(configs);
    } catch (e) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();

        // Auto-derive providerName from endpoint URL since we removed it from the UI
        const url = (body.apiEndpointUrl || "").toLowerCase();
        let providerName = "Custom API";
        if (url.includes("googleapis.com") || url.includes("generativelanguage")) {
            providerName = "Google Gemini";
        } else if (url.includes("openrouter")) {
            providerName = "OpenRouter";
        } else if (url.includes("openai.com")) {
            providerName = "OpenAI";
        } else if (body.providerType === "ollama") {
            providerName = "Ollama";
        }

        const configPurpose = body.purpose || "report_generation";

        // Deactivate other configs with the same purpose
        if (body.isActive) {
            const allConfigs = db.select().from(aiConfigurations).all();
            for (const c of allConfigs) {
                if ((c.purpose || 'report_generation') === configPurpose && c.isActive) {
                    db.update(aiConfigurations).set({ isActive: false }).where(eq(aiConfigurations.id, c.id)).run();
                }
            }
        }

        // Check if a config for this purpose already exists (upsert pattern — one config per purpose)
        const allConfigs = db.select().from(aiConfigurations).all();
        const existing = allConfigs.filter((c: any) => (c.purpose || 'report_generation') === configPurpose);

        if (existing.length > 0) {
            const updateData: any = {
                providerType: body.providerType,
                providerName,
                apiEndpointUrl: body.apiEndpointUrl,
                modelName: body.modelName,
                isActive: body.isActive ?? true,
                isVisionCapable: body.isVisionCapable ?? false,
                maxTokens: body.maxTokens ?? 4096,
                temperature: body.temperature ?? 0.3,
                timeoutSeconds: body.timeoutSeconds ?? 120,
                purpose: configPurpose,
                updatedAt: new Date().toISOString(),
            };

            // Only update the key if a new non-empty one was provided
            if (body.apiSecretKey && body.apiSecretKey.trim() !== "") {
                updateData.apiSecretKey = body.apiSecretKey;
            }

            // Add langsmith fields for copilot
            if (configPurpose === "copilot") {
                if (body.langsmithApiKey !== undefined) updateData.langsmithApiKey = body.langsmithApiKey;
                if (body.langsmithProject !== undefined) updateData.langsmithProject = body.langsmithProject;
            }

            db.update(aiConfigurations)
                .set(updateData)
                .where(eq(aiConfigurations.id, existing[0].id))
                .run();

            return NextResponse.json({ success: true, updated: true });
        }

        // Create new config
        if (body.providerType !== "ollama" && (!body.apiSecretKey || body.apiSecretKey.trim() === "")) {
            return NextResponse.json({ error: "API Secret Key is required for new configurations." }, { status: 400 });
        }

        db.insert(aiConfigurations).values({
            id: `config_${Date.now()}_${configPurpose}`,
            providerType: body.providerType,
            providerName,
            apiEndpointUrl: body.apiEndpointUrl,
            apiSecretKey: body.apiSecretKey || "",
            modelName: body.modelName,
            isActive: body.isActive ?? true,
            isVisionCapable: body.isVisionCapable ?? false,
            maxTokens: body.maxTokens ?? 4096,
            temperature: body.temperature ?? 0.3,
            timeoutSeconds: body.timeoutSeconds ?? 120,
            purpose: configPurpose,
            langsmithApiKey: body.langsmithApiKey || null,
            langsmithProject: body.langsmithProject || null,
            createdAt: new Date().toISOString(),
        }).run();

        return NextResponse.json({ success: true });
    } catch (e) {
        console.error("[AI Config] Error saving:", e);
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
