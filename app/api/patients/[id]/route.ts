import { db } from "@/db";
import { patients, reports } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const result = await db.select().from(patients).where(eq(patients.id, id)).limit(1);
        if (result.length === 0) {
            return NextResponse.json({ error: "Patient not found" }, { status: 404 });
        }
        return NextResponse.json(result[0]);
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await req.json();
        const updates = {
            ...body,
            updatedAt: new Date().toISOString()
        };
        await db.update(patients).set(updates).where(eq(patients.id, id));
        return NextResponse.json({ success: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        // The cascading delete is on the DB schema, so deleting the patient should delete reports.
        await db.delete(patients).where(eq(patients.id, id));
        return NextResponse.json({ success: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
