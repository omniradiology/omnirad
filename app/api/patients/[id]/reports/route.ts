import { db } from "@/db";
import { reports } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const data = await db.select()
            .from(reports)
            .where(eq(reports.patientId, id))
            .orderBy(desc(reports.createdAt));
        
        return NextResponse.json(data);
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
