/**
 * OmniRad Rate Limiting Module
 * 
 * Simple in-memory rate limiter for auth endpoints.
 * Protects against brute-force login attempts.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

interface RateLimitEntry {
    count: number;
    resetAt: number; // Unix timestamp in ms
}

interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetAt: number;
}

// ─── In-Memory Store ─────────────────────────────────────────────────────────

const store = new Map<string, RateLimitEntry>();

// Cleanup interval — remove expired entries every 60 seconds
const CLEANUP_INTERVAL_MS = 60_000;
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function startCleanup(): void {
    if (cleanupTimer) return;
    cleanupTimer = setInterval(() => {
        const now = Date.now();
        for (const [key, entry] of store.entries()) {
            if (entry.resetAt <= now) {
                store.delete(key);
            }
        }
    }, CLEANUP_INTERVAL_MS);

    // Don't prevent process exit
    if (cleanupTimer && typeof cleanupTimer === "object" && "unref" in cleanupTimer) {
        cleanupTimer.unref();
    }
}

// ─── Rate Limit Function ─────────────────────────────────────────────────────

/**
 * Checks and enforces a rate limit for a given key.
 * 
 * @param key - Unique identifier (e.g., IP address, "login:192.168.1.1")
 * @param maxAttempts - Maximum number of attempts allowed in the window
 * @param windowMs - Time window in milliseconds
 * @returns Object with allowed flag, remaining attempts, and reset timestamp
 */
export function rateLimit(
    key: string,
    maxAttempts: number = 5,
    windowMs: number = 60_000
): RateLimitResult {
    startCleanup();

    const now = Date.now();
    const entry = store.get(key);

    // No entry or expired — create fresh
    if (!entry || entry.resetAt <= now) {
        store.set(key, {
            count: 1,
            resetAt: now + windowMs,
        });
        return {
            allowed: true,
            remaining: maxAttempts - 1,
            resetAt: now + windowMs,
        };
    }

    // Increment count
    entry.count += 1;

    if (entry.count > maxAttempts) {
        return {
            allowed: false,
            remaining: 0,
            resetAt: entry.resetAt,
        };
    }

    return {
        allowed: true,
        remaining: maxAttempts - entry.count,
        resetAt: entry.resetAt,
    };
}

/**
 * Creates a rate limit key from a request's IP address.
 */
export function rateLimitKey(prefix: string, request: Request): string {
    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim() || 
               request.headers.get("x-real-ip") || 
               "unknown";
    return `${prefix}:${ip}`;
}
