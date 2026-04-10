import { db } from "@/db";
import { patients } from "@/db/schema";
import { desc, like, or } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
    try {
        const url = new URL(req.url);
        const q = url.searchParams.get("q");

        if (!q || q.length < 2) {
            return NextResponse.json([]);
        }

        const data = await db.select().from(patients).where(
            or(
                like(patients.patientName, `%${q}%`),
                like(patients.patientIdNumber, `%${q}%`)
            )
        ).orderBy(desc(patients.createdAt)).limit(10);
        return NextResponse.json(data);
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
