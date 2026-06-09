/**
 * OmniRad PHI Redaction & Safe Logging Module
 * 
 * Prevents Protected Health Information from leaking into server logs.
 * All PHI API routes must use safeLog/safeError instead of console.log/console.error.
 */

// ─── PHI Field Names ────────────────────────────────────────────────────────

const PHI_FIELD_NAMES = new Set([
    // Patient demographics
    "patientName", "patient_name", "patientname", "name", "fullName", "full_name",
    "dob", "date_of_birth", "dateOfBirth", "birthDate",
    "mobile", "phone", "phoneNumber", "phone_number",
    "address", "streetAddress", "street_address",
    "contactInfo", "contact_info", "email",
    "notes", "patientNotes",
    "patientIdNumber", "patient_id_number", "mrn",
    // Report content
    "reportData", "report_data",
    "findings", "impression", "conclusion", "technique",
    "clinical_history", "clinicalHistory",
    "recommendation", "recommendations",
    // Images
    "imageData", "image_data", "imageBase64",
    "signature",
    // AI
    "rawLlmResponse", "raw_llm_response",
    "content", // copilot chat content
    "message",
    "prompt", "systemPrompt", "system_prompt",
    // Secrets
    "apiSecretKey", "api_secret_key", "apiKey", "api_key",
    "password", "passwordHash", "password_hash",
    "token", "bearerToken", "bearer_token",
    "pacsBearerToken", "pacs_bearer_token",
    "pacsPassword", "pacs_password",
    "supabaseAnonKey", "supabase_anon_key",
    "langsmithApiKey", "langsmith_api_key",
    "externalFhirClientSecret", "external_fhir_client_secret",
    "externalFhirBearerToken", "external_fhir_bearer_token",
    "apiTokenHash", "api_token_hash",
    "tokenHash", "token_hash",
    // FHIR payloads
    "rawFhir", "raw_fhir",
    // DICOM
    "dicomMetadata", "dicom_metadata",
    "viewerActions", "viewer_actions",
    "references_data",
]);

// ─── Base64 Detection ────────────────────────────────────────────────────────

const BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4}){10,}(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

function isLikelyBase64(value: string): boolean {
    if (value.length < 100) return false;
    return BASE64_PATTERN.test(value.substring(0, 200));
}

// ─── Redaction ───────────────────────────────────────────────────────────────

const REDACTED = "[PHI_REDACTED]";
const SECRET_REDACTED = "[SECRET_REDACTED]";

/**
 * Recursively redacts known PHI fields and base64 data from an object.
 * Returns a safe copy of the value.
 */
export function redactPhi(value: unknown, depth: number = 0): unknown {
    // Prevent infinite recursion
    if (depth > 10) return REDACTED;

    if (value === null || value === undefined) return value;

    if (typeof value === "string") {
        // Redact base64 strings
        if (isLikelyBase64(value)) return "[BASE64_REDACTED]";
        // Redact long strings that look like they could contain PHI
        if (value.length > 500) return `[LONG_STRING length=${value.length}]`;
        return value;
    }

    if (typeof value === "number" || typeof value === "boolean") return value;

    if (Array.isArray(value)) {
        if (value.length > 20) return `[ARRAY length=${value.length}]`;
        return value.map((item) => redactPhi(item, depth + 1));
    }

    if (typeof value === "object") {
        const result: Record<string, unknown> = {};
        for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
            if (PHI_FIELD_NAMES.has(key)) {
                // Show type/length but not content
                if (typeof val === "string") {
                    result[key] = val.length > 0 ? `${REDACTED} (${val.length} chars)` : "";
                } else if (val === null || val === undefined) {
                    result[key] = val;
                } else {
                    result[key] = REDACTED;
                }
            } else {
                result[key] = redactPhi(val, depth + 1);
            }
        }
        return result;
    }

    return REDACTED;
}

// ─── Safe Logging ────────────────────────────────────────────────────────────

/**
 * Logs a message with automatic PHI redaction.
 * Use instead of console.log in PHI-handling code.
 */
export function safeLog(message: string, metadata?: unknown): void {
    if (metadata !== undefined) {
        console.log(`[OmniRad] ${message}`, redactPhi(metadata));
    } else {
        console.log(`[OmniRad] ${message}`);
    }
}

/**
 * Logs an error with automatic PHI redaction.
 * Use instead of console.error in PHI-handling code.
 */
export function safeError(message: string, error?: unknown): void {
    if (error instanceof Error) {
        // Only log the message and stack, not the full error object which may contain PHI
        console.error(`[OmniRad] ${message}`, {
            errorMessage: error.message,
            errorName: error.name,
            // Don't include stack in production
            ...(process.env.NODE_ENV !== "production" && { stack: error.stack }),
        });
    } else if (error !== undefined) {
        console.error(`[OmniRad] ${message}`, redactPhi(error));
    } else {
        console.error(`[OmniRad] ${message}`);
    }
}

/**
 * Logs a warning with automatic PHI redaction.
 */
export function safeWarn(message: string, metadata?: unknown): void {
    if (metadata !== undefined) {
        console.warn(`[OmniRad] ${message}`, redactPhi(metadata));
    } else {
        console.warn(`[OmniRad] ${message}`);
    }
}
