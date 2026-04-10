import { NextResponse } from "next/server";
import { db } from "@/db";
import { aiConfigurations } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: Request) {
    try {
        // Fetch active internal config (unmasked key)
        const active = db.select().from(aiConfigurations).where(eq(aiConfigurations.isActive, true)).all();
        
        if (active.length === 0) {
            return NextResponse.json({ success: false, error: "No active AI configuration found." });
        }
        
        const aiConfig = active[0];
        
        // Forward to local python backend
        const pythonEndpoint = "http://localhost:8000/test_ai_connection";
        const payload = {
            ai_config: {
                providerType: aiConfig.providerType,
                providerName: aiConfig.providerName,
                apiEndpointUrl: aiConfig.apiEndpointUrl,
                apiSecretKey: aiConfig.apiSecretKey,
                modelName: aiConfig.modelName
            }
        };
        
        const response = await fetch(pythonEndpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            return NextResponse.json({ success: false, error: data.error || `HTTP ${response.status}` });
        }
        
        return NextResponse.json(data);
        
    } catch (e) {
        console.error("[AI Config Test] Error checking AI model connection:", e);
        return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
    }
}
