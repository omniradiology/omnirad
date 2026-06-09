import { NextRequest, NextResponse } from "next/server";
import { db, sqlite } from "@/db";
import { requireUser, requirePermission, handleAuthError } from "@/lib/security/authz";
import { safeError } from "@/lib/security/phi-redaction";
import { auditSuccess, auditEventFromContext } from "@/lib/security/audit";

// POST /api/copilot/chat — proxy to Python backend + save messages
// Supports SSE streaming when 'x-stream: true' header is present
export async function POST(req: NextRequest) {
    try {
        const ctx = await requireUser(req);
        requirePermission(ctx, "copilot.use");

        const body = await req.json();
        const { message, patientContext, chatHistory, sessionId, study_context } = body;
        const wantsStream = body.stream === true;

        if (!message) {
            return NextResponse.json({ error: "Message is required" }, { status: 400 });
        }

        const activeSessionId = sessionId || `session_${Date.now()}`;

        // Save user message to SQLite
        try {
            const insertStmt = sqlite.prepare(
                "INSERT INTO chat_messages (session_id, role, content, patient_id, created_at) VALUES (?, 'user', ?, ?, ?)"
            );
            insertStmt.run(
                activeSessionId,
                message,
                patientContext?.patientId || null,
                new Date().toISOString()
            );
        } catch (dbErr) {
            safeError("Error saving user message:", dbErr);
        }

        // Audit the copilot message (without storing content)
        await auditSuccess(auditEventFromContext(ctx, "copilot.message", "ai", {
            patientId: patientContext?.patientId || undefined,
            metadata: { purpose: "copilot" },
        }));

        // Sanitize incoming history
        const sanitizedHistory = (chatHistory || []).map((msg: any) => ({
            role: msg.role,
            content: typeof msg.content === "string" 
                ? msg.content 
                : Array.isArray(msg.content)
                    ? msg.content.map((c: any) => c.text || JSON.stringify(c)).join("\n")
                    : JSON.stringify(msg.content)
        }));

        const requestBody = JSON.stringify({
            message,
            chat_history: sanitizedHistory,
            patient_context: patientContext || {},
            session_id: activeSessionId,
            study_context: study_context || null,
        });

        // ─── SSE Streaming Mode ─────────────────────────────────────────
        if (wantsStream) {
            const pythonUrl = "http://localhost:8001/copilot/chat/stream";
            let pythonResponse: Response;
            
            try {
                pythonResponse = await fetch(pythonUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: requestBody,
                });
            } catch (fetchErr: any) {
                if (fetchErr?.cause?.code === 'ECONNREFUSED' || fetchErr?.message?.includes('ECONNREFUSED')) {
                    return NextResponse.json({
                        message: "⚠️ The AI Copilot backend is not running. Please start the Python service.",
                        viewerActions: [],
                        references: [],
                    });
                }
                throw fetchErr;
            }

            if (!pythonResponse.ok || !pythonResponse.body) {
                safeError("Python SSE backend error", { status: pythonResponse.status });
                return NextResponse.json({
                    message: "⚠️ Could not reach the AI Copilot streaming service.",
                    viewerActions: [],
                    references: [],
                    sessionId: activeSessionId,
                }, { status: 200 });
            }

            // Create a TransformStream to intercept the 'complete' event for DB saving
            const reader = pythonResponse.body.getReader();
            const decoder = new TextDecoder();
            let sseBuffer = "";
            
            const stream = new ReadableStream({
                async start(controller) {
                    try {
                        while (true) {
                            const { done, value } = await reader.read();
                            if (done) break;
                            
                            sseBuffer += decoder.decode(value, { stream: true });
                            const segments = sseBuffer.split("\n\n");
                            sseBuffer = segments.pop() || "";

                            for (const segment of segments) {
                                const line = segment.trim();
                                if (!line.startsWith("data: ")) {
                                    // Forward non-data lines as-is
                                    controller.enqueue(new TextEncoder().encode(segment + "\n\n"));
                                    continue;
                                }

                                try {
                                    const data = JSON.parse(line.slice(6));
                                    
                                    if (data.type === "complete") {
                                        // Enrich with sessionId and forward
                                        const enriched = { ...data, sessionId: activeSessionId };
                                        controller.enqueue(new TextEncoder().encode(
                                            `data: ${JSON.stringify(enriched)}\n\n`
                                        ));

                                        // Save assistant message to SQLite
                                        try {
                                            const insertStmt = sqlite.prepare(
                                                "INSERT INTO chat_messages (session_id, role, content, viewer_actions, references_data, patient_id, created_at) VALUES (?, 'assistant', ?, ?, ?, ?, ?)"
                                            );
                                            insertStmt.run(
                                                activeSessionId,
                                                data.message || "",
                                                JSON.stringify(data.viewer_actions || []),
                                                JSON.stringify(data.references || []),
                                                patientContext?.patientId || null,
                                                new Date().toISOString()
                                            );
                                        } catch (dbErr) {
                                            safeError("Error saving streamed assistant message:", dbErr);
                                        }
                                    } else {
                                        // Forward status/error events as-is
                                        controller.enqueue(new TextEncoder().encode(segment + "\n\n"));
                                    }
                                } catch {
                                    // Not valid JSON, forward as-is
                                    controller.enqueue(new TextEncoder().encode(segment + "\n\n"));
                                }
                            }
                        }
                    } catch (err) {
                        safeError("SSE stream error:", err);
                    } finally {
                        controller.close();
                    }
                },
            });

            return new Response(stream, {
                headers: {
                    "Content-Type": "text/event-stream",
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                    "X-Accel-Buffering": "no",
                },
            });
        }

        // ─── Non-Streaming Mode (original behavior) ─────────────────────
        const pythonUrl = "http://localhost:8001/copilot/chat";
        const pythonResponse = await fetch(pythonUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: requestBody,
        });

        if (!pythonResponse.ok) {
            safeError("Python backend error", { status: pythonResponse.status });
            return NextResponse.json(
                {
                    message: "⚠️ Could not reach the AI Copilot service. Make sure the Python backend is running (`npm run dev`).",
                    viewer_actions: [],
                    references: [],
                    sessionId: activeSessionId,
                },
                { status: 200 }
            );
        }

        const result = await pythonResponse.json();

        // Save assistant message to SQLite
        try {
            const insertStmt = sqlite.prepare(
                "INSERT INTO chat_messages (session_id, role, content, viewer_actions, references_data, patient_id, created_at) VALUES (?, 'assistant', ?, ?, ?, ?, ?)"
            );
            insertStmt.run(
                activeSessionId,
                result.message || "",
                JSON.stringify(result.viewer_actions || []),
                JSON.stringify(result.references || []),
                patientContext?.patientId || null,
                new Date().toISOString()
            );
        } catch (dbErr) {
            safeError("Error saving assistant message:", dbErr);
        }

        return NextResponse.json({
            message: result.message,
            viewerActions: result.viewer_actions || [],
            references: result.references || [],
            sessionId: activeSessionId,
        });
    } catch (error: any) {
        if ((error as any)?.statusCode) return handleAuthError(error);

        // Check if it's a connection error
        if (error?.cause?.code === 'ECONNREFUSED' || error?.message?.includes('ECONNREFUSED')) {
            return NextResponse.json({
                message: "⚠️ The AI Copilot backend is not running. Please start the Python service with `npm run dev` (it runs both Next.js and the AI service).",
                viewerActions: [],
                references: [],
            });
        }

        safeError("Copilot chat error:", error);
        return NextResponse.json({
            message: "⚠️ An unexpected error occurred. Please try again.",
            viewerActions: [],
            references: [],
        });
    }
}
