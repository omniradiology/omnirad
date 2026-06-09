/**
 * OmniRad Audit Logging Module
 * 
 * Central immutable audit trail for all PHI access and modifications.
 * HIPAA §164.312(b) — Audit controls.
 */
import { db, sqlite } from "@/db";
import { randomUUID } from "crypto";
import type { AuthContext } from "./authz";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AuditEvent {
    actorUserId?: string;
    actorRole?: string;
    actorType?: "user" | "system" | "integration";
    action: string;
    resourceType: string;
    resourceId?: string;
    patientId?: string;
    ipAddress?: string;
    userAgent?: string;
    success?: boolean;
    reason?: string;
    metadata?: Record<string, unknown>;
}

// ─── Table Creation (called from db/index.ts) ────────────────────────────────

export const AUDIT_LOGS_CREATE_SQL = `
    CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        actor_user_id TEXT,
        actor_role TEXT,
        actor_type TEXT DEFAULT 'user',
        action TEXT NOT NULL,
        resource_type TEXT NOT NULL,
        resource_id TEXT,
        patient_id TEXT,
        ip_address TEXT,
        user_agent TEXT,
        success INTEGER DEFAULT 1,
        reason TEXT,
        metadata_json TEXT,
        created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_patient_id ON audit_logs(patient_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
`;

// ─── Core Logging Function ───────────────────────────────────────────────────

// Prepare statement once for performance (lazy init)
let _insertStmt: ReturnType<typeof sqlite.prepare> | null = null;

function getInsertStmt() {
    if (!_insertStmt) {
        try {
            _insertStmt = sqlite.prepare(`
                INSERT INTO audit_logs 
                (id, actor_user_id, actor_role, actor_type, action, resource_type, resource_id, patient_id, ip_address, user_agent, success, reason, metadata_json, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
        } catch {
            // Table might not exist yet during initial setup
            return null;
        }
    }
    return _insertStmt;
}

/**
 * Writes an immutable audit log entry.
 * Never stores raw PHI in metadata — only IDs, counts, route names, model names, and status codes.
 */
export async function auditLog(event: AuditEvent): Promise<void> {
    try {
        const stmt = getInsertStmt();
        if (!stmt) return; // Table not ready yet

        const id = randomUUID();
        const now = new Date().toISOString();

        // Sanitize metadata — ensure no PHI sneaks in
        let metadataJson: string | null = null;
        if (event.metadata) {
            const safeMetadata = sanitizeAuditMetadata(event.metadata);
            metadataJson = JSON.stringify(safeMetadata);
        }

        (stmt as any).run(
            id,
            event.actorUserId || null,
            event.actorRole || null,
            event.actorType || "user",
            event.action,
            event.resourceType,
            event.resourceId || null,
            event.patientId || null,
            event.ipAddress || null,
            event.userAgent || null,
            event.success !== false ? 1 : 0,
            event.reason || null,
            metadataJson,
            now
        );
    } catch (err) {
        // Audit logging should never crash the application
        console.error("[Audit] Failed to write audit log:", err instanceof Error ? err.message : "Unknown error");
    }
}

/**
 * Shorthand for logging a successful event.
 */
export async function auditSuccess(event: AuditEvent): Promise<void> {
    return auditLog({ ...event, success: true });
}

/**
 * Shorthand for logging a failed event.
 */
export async function auditFailure(event: AuditEvent, error?: unknown): Promise<void> {
    const reason = event.reason || (error instanceof Error ? error.message : "Unknown error");
    return auditLog({ ...event, success: false, reason });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Creates an AuditEvent from an AuthContext + action details.
 */
export function auditEventFromContext(
    ctx: AuthContext,
    action: string,
    resourceType: string,
    extra?: Partial<AuditEvent>
): AuditEvent {
    return {
        actorUserId: ctx.userId,
        actorRole: ctx.role,
        actorType: "user",
        action,
        resourceType,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        ...extra,
    };
}

/**
 * Sanitize metadata to ensure no PHI is stored.
 * Only allow safe primitive values and known-safe keys.
 */
function sanitizeAuditMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
    const SAFE_KEYS = new Set([
        "method", "route", "statusCode", "status",
        "count", "total", "page", "limit",
        "modelName", "model_name", "providerName", "provider_name",
        "purpose", "modality", "urgency", "reportStatus", "report_status",
        "format", "exportFormat",
        "restriction", "legalBasis", "consentStatus",
        "tokenCount", "generationTimeMs",
        "oldRole", "newRole", "targetUserId",
        "scope", "clientType", "integrationId",
    ]);

    const safe: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(metadata)) {
        if (!SAFE_KEYS.has(key)) continue;
        // Only allow primitives
        if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
            safe[key] = value;
        }
    }
    return safe;
}
