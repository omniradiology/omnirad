import { db } from "@/db";
import { config } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function getPacsConfigServer() {
    const row = db.select().from(config).where(eq(config.id, 1)).get();
    if (!row) return null;
    
    return {
        pacsOrthancUrl: row.pacsOrthancUrl?.replace(/\/$/, "") || "",
        pacsAuthType: row.pacsAuthType || "none",
        pacsUsername: row.pacsUsername || "",
        pacsPassword: row.pacsPassword || "",
        pacsBearerToken: row.pacsBearerToken || "",
        pacsAeTitle: row.pacsAeTitle || "",
    };
}

export async function getOrthancHeaders() {
    const pConfig = await getPacsConfigServer();
    if (!pConfig || !pConfig.pacsOrthancUrl) {
        throw new Error("Orthanc URL not configured");
    }

    const headers: Record<string, string> = {
        "Accept": "application/json"
    };

    if (pConfig.pacsAuthType === "basic" && pConfig.pacsUsername && pConfig.pacsPassword) {
        const authBase64 = Buffer.from(`${pConfig.pacsUsername}:${pConfig.pacsPassword}`).toString('base64');
        headers["Authorization"] = `Basic ${authBase64}`;
    } else if (pConfig.pacsAuthType === "bearer" && pConfig.pacsBearerToken) {
        headers["Authorization"] = `Bearer ${pConfig.pacsBearerToken}`;
    }

    return { headers, baseUrl: pConfig.pacsOrthancUrl };
}
