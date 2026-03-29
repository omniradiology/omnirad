import bcrypt from "bcryptjs";

/**
 * Hashes a plaintext password using bcrypt.
 */
export async function hashPassword(password: string): Promise<string> {
    return await bcrypt.hash(password, 10);
}

/**
 * Verifies a plaintext password against a stored bcrypt hash.
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(password, hash);
}

/**
 * Generates a secure random session ID.
 */
export function generateSessionId(): string {
    return crypto.randomUUID();
}
