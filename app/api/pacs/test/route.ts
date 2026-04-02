import { NextResponse } from "next/server";
import { getOrthancHeaders } from "@/lib/pacs/server-utils";

export async function GET() {
    try {
        const { headers, baseUrl } = await getOrthancHeaders();
        // The most basic connectivity test is fetching the root system info or studies with limit 1
        const rootUrl = new URL(baseUrl);
        const testUrl = new URL("/studies?limit=1", baseUrl);
        
        console.log("Testing connection to:", testUrl.toString());

        const res = await fetch(testUrl.toString(), {
            method: "GET",
            headers,
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Orthanc returned ${res.status}: ${errText}`);
        }

        const data = await res.json();
        
        return NextResponse.json({ success: true, count: data?.length || 0 });
    } catch (e: any) {
        console.error("PACS Test Route Error:", e);
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
