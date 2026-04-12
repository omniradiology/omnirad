import { NextRequest, NextResponse } from "next/server";
import { sqlite } from "@/db";

// GET /api/copilot/history — get chat history
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");

    try {
        if (sessionId) {
            // Return all messages for a specific session
            const stmt = sqlite.prepare(
                "SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC"
            );
            const messages = stmt.all(sessionId);

            return NextResponse.json(
                messages.map((m: any) => ({
                    id: m.id,
                    role: m.role,
                    content: m.content,
                    viewerActions: m.viewer_actions ? JSON.parse(m.viewer_actions) : [],
                    references: m.references_data ? JSON.parse(m.references_data) : [],
                    timestamp: m.created_at,
                }))
            );
        }

        // Return list of all sessions (grouped)
        const stmt = sqlite.prepare(`
            SELECT 
                session_id,
                MAX(patient_id) as patient_id,
                MIN(created_at) as first_message,
                MAX(created_at) as last_message,
                COUNT(*) as message_count
            FROM chat_messages 
            GROUP BY session_id
            ORDER BY MAX(created_at) DESC
            LIMIT 50
        `);
        const sessions = stmt.all();

        // Get the latest message content for each session
        const result = (sessions as any[]).map((s: any) => {
            const lastMsg = sqlite.prepare(
                "SELECT content FROM chat_messages WHERE session_id = ? ORDER BY created_at DESC LIMIT 1"
            ).get(s.session_id) as any;

            // Get patient name if patient_id exists
            let patientName = null;
            if (s.patient_id) {
                const patient = sqlite.prepare(
                    "SELECT patient_name FROM patients WHERE id = ?"
                ).get(s.patient_id) as any;
                if (patient) patientName = patient.patient_name;
            }

            return {
                sessionId: s.session_id,
                patientId: s.patient_id,
                patientName,
                lastMessage: lastMsg?.content || "",
                messageCount: s.message_count,
                createdAt: s.first_message,
                updatedAt: s.last_message,
            };
        });

        return NextResponse.json(result);
    } catch (error: any) {
        console.error("[Copilot] History error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// DELETE /api/copilot/history — clear session history
export async function DELETE(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");

    try {
        if (sessionId) {
            sqlite.prepare("DELETE FROM chat_messages WHERE session_id = ?").run(sessionId);
            return NextResponse.json({ success: true, message: `Session ${sessionId} cleared.` });
        }

        // Clear all chat history
        sqlite.exec("DELETE FROM chat_messages");
        return NextResponse.json({ success: true, message: "All chat history cleared." });
    } catch (error: any) {
        console.error("[Copilot] Delete error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
