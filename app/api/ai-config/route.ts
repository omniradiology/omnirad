import { NextResponse } from "next/server";
import { db } from "@/db";
import { aiConfigurations } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const mode = searchParams.get("mode");

        // Internal mode: return the active config WITH the real key (for server-side forwarding)
        if (mode === "active_internal") {
            const active = db.select().from(aiConfigurations).where(eq(aiConfigurations.isActive, true)).all();
            if (active.length === 0) {
                return NextResponse.json({ error: "No active AI configuration found" }, { status: 404 });
            }
            return NextResponse.json(active[0]);
        }

        // Default: return all configs (unmasked as per user request to view in UI)
        const configs = db.select().from(aiConfigurations).all();
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

        // Deactivate all other configs first
        if (body.isActive) {
            db.update(aiConfigurations).set({ isActive: false }).run();
        }

        // Check if any config already exists (upsert pattern — one config at a time)
        const existing = db.select().from(aiConfigurations).all();

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
                updatedAt: new Date().toISOString(),
            };

            // Only update the key if a new non-empty one was provided
            if (body.apiSecretKey && body.apiSecretKey.trim() !== "") {
                updateData.apiSecretKey = body.apiSecretKey;
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
            id: `config_${Date.now()}`,
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
            createdAt: new Date().toISOString(),
        }).run();

        return NextResponse.json({ success: true });
    } catch (e) {
        console.error("[AI Config] Error saving:", e);
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
