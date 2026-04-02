import { NextRequest, NextResponse } from "next/server";
import { getOrthancHeaders } from "@/lib/pacs/server-utils";

export async function GET(request: NextRequest) {
    try {
        const { headers, baseUrl } = await getOrthancHeaders();
        const searchParams = request.nextUrl.searchParams;

        // E.g. /studies?PatientName=*John*&PatientID=123
        const orthancUrl = new URL(baseUrl + "/studies");
        
        searchParams.forEach((value, key) => {
            orthancUrl.searchParams.append(key, value);
        });

        // Add limit by default if not specified
        if (!orthancUrl.searchParams.has('limit')) {
            orthancUrl.searchParams.append('limit', '50');
        }

        const res = await fetch(orthancUrl.toString(), {
            method: "GET",
            headers,
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Orthanc returned ${res.status}: ${errText}`);
        }

        const data = await res.json();
        return NextResponse.json(data);
    } catch (e: any) {
        console.error("PACS Studies Proxy Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
