import { db } from "@/db";
import { patients, reports } from "@/db/schema";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { desc, like, or } from "drizzle-orm";

export async function GET(req: Request) {
    try {
        const url = new URL(req.url);
        const search = url.searchParams.get("search");

        let query = db.select().from(patients);

        if (search) {
            query = query.where(
                or(
                    like(patients.patientName, `%${search}%`),
                    like(patients.patientIdNumber, `%${search}%`)
                )
            ) as any;
        }

        const data = await query.orderBy(desc(patients.createdAt));

        // Get report counts for these patients
        const counts = db.select({ patientId: reports.patientId }).from(reports).all();
        const countsMap = counts.reduce((acc: any, curr) => {
            if (curr.patientId) {
                acc[curr.patientId] = (acc[curr.patientId] || 0) + 1;
            }
            return acc;
        }, {});

        const enrichedData = data.map((p) => ({
            ...p,
            reportCount: countsMap[p.id] || 0
        }));

        return NextResponse.json(enrichedData);
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const newPatient = {
            id: randomUUID(),
            patientName: body.patientName,
            patientIdNumber: body.patientIdNumber || null,
            dob: body.dob || null,
            age: body.age || null,
            gender: body.gender || null,
            contactInfo: body.contactInfo || null,
            notes: body.notes || null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        await db.insert(patients).values(newPatient);

        return NextResponse.json(newPatient);
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
