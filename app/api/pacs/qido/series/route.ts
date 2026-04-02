import { NextRequest, NextResponse } from "next/server";
import { getOrthancHeaders } from "@/lib/pacs/server-utils";

export async function GET(request: NextRequest) {
    try {
        const { headers, baseUrl } = await getOrthancHeaders();
        const searchParams = request.nextUrl.searchParams;
        const studyUid = searchParams.get('studyUid');

        if (!studyUid) {
            return NextResponse.json({ error: "Missing studyUid parameter" }, { status: 400 });
        }

        const orthancUrl = new URL(`${baseUrl}/studies/${studyUid}/series`);
        
        searchParams.forEach((value, key) => {
            if (key !== 'studyUid') {
                orthancUrl.searchParams.append(key, value);
            }
        });

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
        console.error("PACS Series Proxy Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
