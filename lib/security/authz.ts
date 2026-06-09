/**
 * OmniRad Authorization & RBAC Module
 * 
 * Centralized authentication and role-based access control.
 * Every PHI API route MUST use one of these helpers.
 */
import { db } from "@/db";
import { users, sessions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";

// ─── Types ───────────────────────────────────────────────────────────────────

export type UserRole = "Admin" | "Radiologist" | "Technician" | "Viewer" | "User";

export type Permission =
    | "patient.read" | "patient.create" | "patient.update" | "patient.delete"
    | "report.read" | "report.create" | "report.update" | "report.finalize" | "report.delete"
    | "image.view" | "pacs.query" | "pacs.retrieve"
    | "copilot.use" | "ai.configure"
    | "fhir.read" | "fhir.write"
    | "settings.read" | "settings.write"
    | "users.manage" | "compliance.manage"
    | "data.clear" | "data.wipe";

export interface AuthContext {
    userId: string;
    role: UserRole;
    fullName: string;
    username: string;
    email: string;
    sessionId: string;
    ipAddress: string;
    userAgent: string;
}

// ─── Role-Permission Matrix ─────────────────────────────────────────────────

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
    Admin: [
        "patient.read", "patient.create", "patient.update", "patient.delete",
        "report.read", "report.create", "report.update", "report.finalize", "report.delete",
        "image.view", "pacs.query", "pacs.retrieve",
        "copilot.use", "ai.configure",
        "fhir.read", "fhir.write",
        "settings.read", "settings.write",
        "users.manage", "compliance.manage",
        "data.clear", "data.wipe",
    ],
    Radiologist: [
        "patient.read", "patient.create", "patient.update",
        "report.read", "report.create", "report.update", "report.finalize",
        "image.view", "pacs.query", "pacs.retrieve",
        "copilot.use",
        "fhir.read",
        "settings.read",
    ],
    Technician: [
        "patient.read", "patient.create", "patient.update",
        "report.read", "report.create",
        "image.view", "pacs.query", "pacs.retrieve",
        "settings.read",
    ],
    Viewer: [
        "patient.read",
        "report.read",
        "image.view",
        "settings.read",
    ],
    // Legacy "User" role — maps to Radiologist-level access for backward compat
    User: [
        "patient.read", "patient.create", "patient.update",
        "report.read", "report.create", "report.update", "report.finalize",
        "image.view", "pacs.query", "pacs.retrieve",
        "copilot.use",
        "fhir.read",
        "settings.read",
    ],
};

// ─── Errors ──────────────────────────────────────────────────────────────────

export class AuthError extends Error {
    constructor(
        message: string,
        public statusCode: number = 401,
        public code: string = "UNAUTHORIZED"
    ) {
        super(message);
        this.name = "AuthError";
    }
}

export class ForbiddenError extends AuthError {
    constructor(message: string = "Forbidden") {
        super(message, 403, "FORBIDDEN");
        this.name = "ForbiddenError";
    }
}

// ─── Helper: Extract IP & User-Agent ─────────────────────────────────────────

function extractClientInfo(request?: NextRequest | Request): { ipAddress: string; userAgent: string } {
    if (!request) return { ipAddress: "unknown", userAgent: "unknown" };
    
    const headers = request.headers;
    const ipAddress =
        headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        headers.get("x-real-ip") ||
        "unknown";
    const userAgent = headers.get("user-agent") || "unknown";
    
    return { ipAddress, userAgent };
}

// ─── Core: Validate Session & Get User ───────────────────────────────────────

/**
 * Validates the session cookie and returns the authenticated user context.
 * Throws AuthError if not authenticated.
 */
export async function requireUser(request?: NextRequest | Request): Promise<AuthContext> {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get("omnirad_session_id")?.value;

    if (!sessionId) {
        throw new AuthError("Authentication required");
    }

    // Look up session
    const sessionList = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1);
    const session = sessionList[0];

    if (!session) {
        throw new AuthError("Invalid session");
    }

    // Check expiration
    if (session.expiresAt * 1000 < Date.now()) {
        // Clean up expired session
        await db.delete(sessions).where(eq(sessions.id, sessionId));
        throw new AuthError("Session expired");
    }

    // Look up user
    const userList = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
    const user = userList[0];

    if (!user) {
        throw new AuthError("User not found");
    }

    const { ipAddress, userAgent } = extractClientInfo(request);

    return {
        userId: user.id,
        role: (user.role as UserRole) || "User",
        fullName: user.fullName,
        username: user.username,
        email: user.email,
        sessionId,
        ipAddress,
        userAgent,
    };
}

/**
 * Optionally gets the user context without throwing.
 * Returns null if not authenticated.
 */
export async function getOptionalUser(request?: NextRequest | Request): Promise<AuthContext | null> {
    try {
        return await requireUser(request);
    } catch {
        return null;
    }
}

// ─── Role Checks ─────────────────────────────────────────────────────────────

/**
 * Requires the user to have one of the specified roles.
 * Throws ForbiddenError if not authorized.
 */
export function requireRole(ctx: AuthContext, roles: UserRole[]): void {
    if (!roles.includes(ctx.role)) {
        throw new ForbiddenError(
            `Role '${ctx.role}' is not authorized. Required: ${roles.join(", ")}`
        );
    }
}

/**
 * Requires the user to have a specific permission based on their role.
 * Throws ForbiddenError if not authorized.
 */
export function requirePermission(ctx: AuthContext, permission: Permission): void {
    const permissions = ROLE_PERMISSIONS[ctx.role];
    if (!permissions || !permissions.includes(permission)) {
        throw new ForbiddenError(
            `Permission '${permission}' not granted for role '${ctx.role}'`
        );
    }
}

/**
 * Checks if a user has a specific permission (non-throwing).
 */
export function hasPermission(ctx: AuthContext, permission: Permission): boolean {
    const permissions = ROLE_PERMISSIONS[ctx.role];
    return permissions?.includes(permission) ?? false;
}

// ─── Valid Roles List ────────────────────────────────────────────────────────

export const VALID_ROLES: UserRole[] = ["Admin", "Radiologist", "Technician", "Viewer", "User"];

/**
 * Validates that a role string is a valid UserRole.
 */
export function isValidRole(role: string): role is UserRole {
    return VALID_ROLES.includes(role as UserRole);
}

// ─── Error Response Helper ───────────────────────────────────────────────────

import { NextResponse } from "next/server";

/**
 * Wraps an API handler with auth error handling.
 * Returns appropriate JSON error responses for auth failures.
 */
export function handleAuthError(error: unknown): NextResponse {
    if (error instanceof AuthError) {
        return NextResponse.json(
            { error: error.message, code: error.code },
            { status: error.statusCode }
        );
    }
    // Unknown error — don't leak details
    return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
    );
}
