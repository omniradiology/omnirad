import { NextRequest, NextResponse } from "next/server";
import { getOrthancHeaders } from "@/lib/pacs/server-utils";

export async function GET(request: NextRequest) {
    try {
        const { headers, baseUrl } = await getOrthancHeaders();
        const searchParams = request.nextUrl.searchParams;
        const studyUid = searchParams.get('studyUid');
        const seriesUid = searchParams.get('seriesUid');
        const instanceUid = searchParams.get('instanceUid');
        const frame = searchParams.get('frame');

        if (!studyUid || !seriesUid || !instanceUid) {
            return new NextResponse("Missing studyUid, seriesUid, or instanceUid parameter", { status: 400 });
        }

        // If a frame number is specified, fetch that specific frame from a multi-frame instance
        let renderPath = `${baseUrl}/studies/${studyUid}/series/${seriesUid}/instances/${instanceUid}`;
        if (frame) {
            renderPath += `/frames/${frame}/rendered`;
        } else {
            renderPath += `/rendered`;
        }
        const orthancUrl = new URL(renderPath);

        // Ask for jpeg explicitly if Orthanc supports it via accept headers
        const fetchHeaders = { ...headers, "Accept": "image/jpeg" };

        const res = await fetch(orthancUrl.toString(), {
            method: "GET",
            headers: fetchHeaders,
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Orthanc returned ${res.status}: ${errText}`);
        }

        // Return the binary body directly
        const contentType = res.headers.get("content-type") || "image/jpeg";
        return new NextResponse(res.body, {
            headers: {
                "Content-Type": contentType,
                "Cache-Control": "public, max-age=86400",
            },
        });
    } catch (e: any) {
        console.error("PACS Render Proxy Error:", e);
        return new NextResponse(e.message, { status: 500 });
    }
}
