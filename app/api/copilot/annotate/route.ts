import { NextRequest, NextResponse } from "next/server";
import { requireUser, requirePermission, handleAuthError } from "@/lib/security/authz";
import { safeError } from "@/lib/security/phi-redaction";
import { auditSuccess, auditEventFromContext } from "@/lib/security/audit";

// POST /api/copilot/annotate — proxy to Python backend for structured annotation
export async function POST(req: NextRequest) {
    try {
        const ctx = await requireUser(req);
        requirePermission(ctx, "copilot.use");

        const body = await req.json();
        const {
            message,
            session_id,
            patient_id,
            report_id,
            study_uid,
            series_uid,
            current_slice,
            total_slices,
            modality,
            report_text,
            viewport_image,
        } = body;

        if (!message) {
            return NextResponse.json({ error: "Message is required" }, { status: 400 });
        }

        await auditSuccess(auditEventFromContext(ctx, "segmentation.request", "ai", {
            patientId: patient_id || undefined,
            metadata: { modality: modality || undefined },
        }));

        // Proxy to Python backend
        const pythonUrl = "http://localhost:8001/copilot/annotate";
        const pythonResponse = await fetch(pythonUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                message,
                session_id: session_id || null,
                patient_id: patient_id || null,
                report_id: report_id || null,
                study_uid: study_uid || null,
                series_uid: series_uid || null,
                current_slice: current_slice ?? null,
                total_slices: total_slices ?? null,
                modality: modality || null,
                report_text: report_text || null,
                viewport_image: viewport_image || null,
            }),
        });

        if (!pythonResponse.ok) {
            safeError("Copilot annotate backend error", { status: pythonResponse.status });
            return NextResponse.json(
                {
                    reply: "⚠️ Could not reach the AI Copilot service for annotation.",
                    viewer_actions: [],
                    findings_summary: [],
                },
                { status: 200 }
            );
        }

        const result = await pythonResponse.json();

        return NextResponse.json({
            reply: result.reply || "",
            viewer_actions: result.viewer_actions || [],
            findings_summary: result.findings_summary || [],
            references: result.references || [],
        });
    } catch (error: any) {
        if ((error as any)?.statusCode) return handleAuthError(error);

        if (error?.cause?.code === "ECONNREFUSED" || error?.message?.includes("ECONNREFUSED")) {
            return NextResponse.json({
                reply: "⚠️ The AI Copilot backend is not running.",
                viewer_actions: [],
                findings_summary: [],
            });
        }

        safeError("Copilot annotate error:", error);
        return NextResponse.json({
            reply: "⚠️ An unexpected error occurred.",
            viewer_actions: [],
            findings_summary: [],
        });
    }
}
