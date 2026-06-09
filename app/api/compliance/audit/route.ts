import { NextRequest, NextResponse } from "next/server";
import { sqlite } from "@/db";
import { requireUser, requireRole, requirePermission, handleAuthError } from "@/lib/security/authz";
import { safeError } from "@/lib/security/phi-redaction";

// GET /api/compliance/audit — Query audit logs (Admin only)
export async function GET(request: NextRequest) {
    try {
        const ctx = await requireUser(request);
        requireRole(ctx, ["Admin"]);

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get("page") || "1");
        const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200);
        const action = searchParams.get("action");
        const resourceType = searchParams.get("resourceType");
        const actorUserId = searchParams.get("actorUserId");
        const patientId = searchParams.get("patientId");
        const startDate = searchParams.get("startDate");
        const endDate = searchParams.get("endDate");
        const success = searchParams.get("success");

        // Build dynamic query
        const conditions: string[] = [];
        const params: any[] = [];

        if (action) {
            conditions.push("action LIKE ?");
            params.push(`%${action}%`);
        }
        if (resourceType) {
            conditions.push("resource_type = ?");
            params.push(resourceType);
        }
        if (actorUserId) {
            conditions.push("actor_user_id = ?");
            params.push(actorUserId);
        }
        if (patientId) {
            conditions.push("patient_id = ?");
            params.push(patientId);
        }
        if (startDate) {
            conditions.push("created_at >= ?");
            params.push(startDate);
        }
        if (endDate) {
            conditions.push("created_at <= ?");
            params.push(endDate);
        }
        if (success !== null && success !== undefined) {
            conditions.push("success = ?");
            params.push(success === "true" ? 1 : 0);
        }

        const whereClause = conditions.length > 0
            ? `WHERE ${conditions.join(" AND ")}`
            : "";

        // Count total
        const countRow = sqlite.prepare(`SELECT COUNT(*) as total FROM audit_logs ${whereClause}`).get(...params) as any;
        const total = countRow?.total || 0;

        // Fetch page
        const offset = (page - 1) * limit;
        const rows = sqlite.prepare(
            `SELECT * FROM audit_logs ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`
        ).all(...params, limit, offset) as any[];

        // Enrich with user names
        const enriched = rows.map((row: any) => {
            let actorName = "System";
            if (row.actor_user_id) {
                const user = sqlite.prepare("SELECT full_name, username FROM users WHERE id = ?").get(row.actor_user_id) as any;
                actorName = user?.full_name || user?.username || row.actor_user_id;
            }

            return {
                id: row.id,
                actorUserId: row.actor_user_id,
                actorName,
                actorRole: row.actor_role,
                actorType: row.actor_type,
                action: row.action,
                resourceType: row.resource_type,
                resourceId: row.resource_id,
                patientId: row.patient_id,
                ipAddress: row.ip_address,
                success: !!row.success,
                reason: row.reason,
                metadata: row.metadata_json ? JSON.parse(row.metadata_json) : null,
                createdAt: row.created_at,
            };
        });

        return NextResponse.json({
            data: enriched,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        if ((error as any)?.statusCode) return handleAuthError(error);
        safeError("Error fetching audit logs:", error);
        return NextResponse.json({ error: "Failed to fetch audit logs" }, { status: 500 });
    }
}
