import { NextRequest } from "next/server";
import { db } from "@/db";
import { patients } from "@/db/schema";
import { eq } from "drizzle-orm";
import { toFhirPatient, fhirResponse, fhirErrorResponse, requireFhirAccess } from "@/lib/fhir";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    // 1. Auth check
    const authError = await requireFhirAccess(request, "read");
    if (authError) return authError;

    // 2. Fetch data
    const { id } = await params;
    const patientRow = db.select().from(patients).where(eq(patients.id, id)).get();

    if (!patientRow) {
        return fhirErrorResponse("not-found", `Patient with id '${id}' not found`, 404);
    }

    // 3. Serialize and return
    const resource = toFhirPatient(patientRow as any);
    return fhirResponse(resource);
}
