import { db } from "@/db";
import { patients, reports } from "@/db/schema";
import { isNull, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        
        if (body.action === "auto-migrate") {
            const nullReports = await db.select().from(reports).where(isNull(reports.patientId));
            let migratedCount = 0;
            
            for (const r of nullReports) {
                if (!r.reportData) continue;
                try {
                    const parsed = JSON.parse(r.reportData);
                    const pName = r.patientName || parsed.patient?.name;
                    if (!pName) continue;
                    
                    // Does this patient exist?
                    const existing = await db.select().from(patients).where(eq(patients.patientName, pName)).limit(1);
                    
                    let pId = "";
                    if (existing.length > 0) {
                        pId = existing[0].id;
                    } else {
                        pId = randomUUID();
                        await db.insert(patients).values({
                            id: pId,
                            patientName: pName,
                            patientIdNumber: parsed.patient?.patient_id || null,
                            gender: parsed.patient?.gender || null,
                            dob: parsed.patient?.age ? null : null, // Not inferring DOB from age directly
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString()
                        });
                    }
                    
                    // Link report
                    await db.update(reports).set({ patientId: pId }).where(eq(reports.id, r.id));
                    migratedCount++;
                } catch(err) {
                    console.error("[OmniRad] Migration error on report", r.id, err);
                }
            }
            
            return NextResponse.json({ success: true, migrated: migratedCount });
        }
        
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    } catch (e: any) {
        console.error(e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
