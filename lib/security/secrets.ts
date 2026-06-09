/**
 * OmniRad Secret Management Module
 * 
 * Handles encryption, hashing, masking, and secure storage of secrets
 * like API keys, PACS passwords, and integration tokens.
 */
import { createCipheriv, createDecipheriv, randomBytes, createHash } from "crypto";
import path from "path";
import fs from "fs";

// ─── Encryption Key Management ──────────────────────────────────────────────

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 12; // 96 bits for GCM
const AUTH_TAG_LENGTH = 16;

/**
 * Gets or creates the master encryption key.
 * Priority: 1) OMNIRAD_ENCRYPTION_KEY env var, 2) Auto-generated key file
 */
function getEncryptionKey(): Buffer {
    // Check environment variable first
    const envKey = process.env.OMNIRAD_ENCRYPTION_KEY;
    if (envKey) {
        // If it's hex-encoded
        if (/^[0-9a-fA-F]{64}$/.test(envKey)) {
            return Buffer.from(envKey, "hex");
        }
        // Hash the env key to get exactly 32 bytes
        return createHash("sha256").update(envKey).digest();
    }

    // Auto-generate and store key in data directory
    const dataDir = path.join(process.cwd(), "data");
    const keyFile = path.join(dataDir, ".encryption_key");

    try {
        if (fs.existsSync(keyFile)) {
            const keyHex = fs.readFileSync(keyFile, "utf-8").trim();
            return Buffer.from(keyHex, "hex");
        }
    } catch {
        // File doesn't exist or can't be read — generate new key
    }

    // Generate new key
    const newKey = randomBytes(KEY_LENGTH);

    // Ensure data directory exists
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    // Write key file with restrictive permissions
    fs.writeFileSync(keyFile, newKey.toString("hex"), { mode: 0o600 });

    return newKey;
}

// Cache the key in memory
let _cachedKey: Buffer | null = null;
function getCachedKey(): Buffer {
    if (!_cachedKey) {
        _cachedKey = getEncryptionKey();
    }
    return _cachedKey;
}

// ─── Encryption / Decryption ─────────────────────────────────────────────────

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Returns a string in format: iv:authTag:ciphertext (all hex-encoded)
 */
export function encryptSecret(plaintext: string): string {
    if (!plaintext) return "";

    const key = getCachedKey();
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(plaintext, "utf8", "hex");
    encrypted += cipher.final("hex");
    const authTag = cipher.getAuthTag();

    return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

/**
 * Decrypts a ciphertext string encrypted by encryptSecret.
 * Returns the original plaintext.
 */
export function decryptSecret(ciphertext: string): string {
    if (!ciphertext) return "";

    // If it doesn't look encrypted (no colons), return as-is for backward compat
    if (!ciphertext.includes(":")) return ciphertext;

    try {
        const parts = ciphertext.split(":");
        if (parts.length !== 3) return ciphertext; // Not encrypted format

        const [ivHex, authTagHex, encryptedHex] = parts;
        const key = getCachedKey();
        const iv = Buffer.from(ivHex, "hex");
        const authTag = Buffer.from(authTagHex, "hex");

        const decipher = createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(encryptedHex, "hex", "utf8");
        decrypted += decipher.final("utf8");

        return decrypted;
    } catch {
        // If decryption fails, return as-is (might be a plaintext from before encryption was added)
        return ciphertext;
    }
}

// ─── Hashing (for verification-only tokens) ──────────────────────────────────

/**
 * Creates a SHA-256 hash of a token (for verification-only use cases).
 * Use this for integration tokens where we only need to verify, not recover.
 */
export function hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
}

/**
 * Verifies a token against its hash.
 */
export function verifyToken(token: string, hash: string): boolean {
    const computed = hashToken(token);
    // Constant-time comparison to prevent timing attacks
    if (computed.length !== hash.length) return false;
    let result = 0;
    for (let i = 0; i < computed.length; i++) {
        result |= computed.charCodeAt(i) ^ hash.charCodeAt(i);
    }
    return result === 0;
}

// ─── Masking ─────────────────────────────────────────────────────────────────

/**
 * Masks a secret value for display, showing only the last 4 characters.
 * Returns "********last4" format.
 */
export function maskSecret(value: string | null | undefined): string {
    if (!value || value.length === 0) return "";
    if (value.length <= 4) return "********";

    const last4 = value.slice(-4);
    return `********${last4}`;
}

/**
 * Returns an object indicating whether a secret is set and its masked value.
 * Use this when building API responses that reference secrets.
 */
export function secretSummary(value: string | null | undefined): { hasSecret: boolean; maskedValue: string } {
    return {
        hasSecret: !!value && value.length > 0,
        maskedValue: maskSecret(value),
    };
}

// ─── Token Generation ────────────────────────────────────────────────────────

/**
 * Generates a cryptographically secure random token.
 * Default length is 48 bytes (96 hex chars).
 */
export function generateSecureToken(byteLength: number = 48): string {
    return randomBytes(byteLength).toString("hex");
}
