import { NextRequest, NextResponse } from "next/server";
import { db, sqlite } from "@/db";

// POST /api/copilot/chat — proxy to Python backend + save messages
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { message, patientContext, chatHistory, sessionId } = body;

        if (!message) {
            return NextResponse.json({ error: "Message is required" }, { status: 400 });
        }

        const activeSessionId = sessionId || `session_${Date.now()}`;

        // Save user message to SQLite
        try {
            sqlite.exec(`
                INSERT INTO chat_messages (session_id, role, content, patient_id, created_at)
                VALUES (?, 'user', ?, ?, ?)
            `.replace(/\?/g, () => '?'));

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
            console.error("[Copilot] Error saving user message:", dbErr);
        }

        // Sanitize incoming history to ensure content is always a string (prevents 422 errors)
        const sanitizedHistory = (chatHistory || []).map((msg: any) => ({
            role: msg.role,
            content: typeof msg.content === "string" 
                ? msg.content 
                : Array.isArray(msg.content)
                    ? msg.content.map((c: any) => c.text || JSON.stringify(c)).join("\n")
                    : JSON.stringify(msg.content)
        }));

        // Proxy to Python backend
        const pythonUrl = "http://localhost:8000/copilot/chat";
        const pythonResponse = await fetch(pythonUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                message,
                chat_history: sanitizedHistory,
                patient_context: patientContext || {},
                session_id: activeSessionId,
            }),
        });

        if (!pythonResponse.ok) {
            const errorText = await pythonResponse.text().catch(() => "Unknown error");
            console.error("[Copilot] Python backend error:", errorText);
            return NextResponse.json(
                {
                    message: "⚠️ Could not reach the AI Copilot service. Make sure the Python backend is running (`npm run dev`).",
                    viewer_actions: [],
                    references: [],
                    sessionId: activeSessionId,
                },
                { status: 200 } // Return 200 so the UI displays the error message nicely
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
            console.error("[Copilot] Error saving assistant message:", dbErr);
        }

        return NextResponse.json({
            message: result.message,
            viewerActions: result.viewer_actions || [],
            references: result.references || [],
            sessionId: activeSessionId,
        });
    } catch (error: any) {
        console.error("[Copilot] Chat error:", error);

        // Check if it's a connection error (Python backend not running)
        if (error?.cause?.code === 'ECONNREFUSED' || error?.message?.includes('ECONNREFUSED')) {
            return NextResponse.json({
                message: "⚠️ The AI Copilot backend is not running. Please start the Python service with `npm run dev` (it runs both Next.js and the AI service).",
                viewerActions: [],
                references: [],
            });
        }

        return NextResponse.json({
            message: "⚠️ An unexpected error occurred. Please try again.",
            viewerActions: [],
            references: [],
            error: error.message,
        });
    }
}
