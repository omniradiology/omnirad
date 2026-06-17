import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

// ─── Patients Table ────────────────────────────────────────────────────────────
export const patients = sqliteTable("patients", {
    id: text("id").primaryKey(),
    patientIdNumber: text("patient_id_number"),
    patientName: text("patient_name").notNull(),
    dob: text("date_of_birth"),
    age: integer("age"),
    gender: text("gender"),
    mobile: text("mobile"),
    address: text("address"),
    contactInfo: text("contact_info"),
    notes: text("notes"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at")
});

// ─── Reports Table ───────────────────────────────────────────────────────────
export const reports = sqliteTable("reports", {
    id: text("id").primaryKey(),
    patientId: text("patient_id").references(() => patients.id, { onDelete: 'cascade' }),
    patientName: text("patient_name"),
    modality: text("modality"),
    urgency: text("urgency"),
    reportStatus: text("report_status").default("Pending"),
    reportData: text("report_data").notNull(),           // JSON string of ReportData
    imageData: text("image_data"),                        // base64 image (can be large)
    pacsStudyUid: text("pacs_study_uid"),
    pacsSeriesUid: text("pacs_series_uid"),
    pacsSource: text("pacs_source"),
    createdAt: text("created_at").notNull(),
});

// ─── Config Table (singleton) ────────────────────────────────────────────────
export const config = sqliteTable("config", {
    id: integer("id").primaryKey().default(1),
    n8nWebhookUrl: text("n8n_webhook_url").default(""),
    supabaseUrl: text("supabase_url").default(""),
    supabaseAnonKey: text("supabase_anon_key").default(""),
    pacsOrthancUrl: text("pacs_orthanc_url").default(""),
    pacsAuthType: text("pacs_auth_type").default("none"),
    pacsUsername: text("pacs_username").default(""),
    pacsPassword: text("pacs_password").default(""),
    pacsBearerToken: text("pacs_bearer_token").default(""),
    pacsAeTitle: text("pacs_ae_title").default(""),
});

// ─── Profile Table (singleton) ───────────────────────────────────────────────
export const profile = sqliteTable("profile", {
    id: integer("id").primaryKey().default(1),
    fullName: text("full_name").default(""),
    role: text("role").default(""),
    hospitalName: text("hospital_name").default(""),
    department: text("department").default(""),
});

// ─── Appearance Table (singleton) ────────────────────────────────────────────
export const appearance = sqliteTable("appearance", {
    id: integer("id").primaryKey().default(1),
    theme: text("theme").default("dark"),
    template: text("template").default("standard"),
    hospitalName: text("hospital_name").default(""),
    logo: text("logo").default(""),
});

// ─── Security Table (singleton) ──────────────────────────────────────────────
export const security = sqliteTable("security", {
    id: integer("id").primaryKey().default(1),
    appLockEnabled: integer("app_lock_enabled", { mode: 'boolean' }).default(true), // true = locked (login required)
    defaultUserId: text("default_user_id"),  // user to auto-login when unlocked (null = first admin)
    updatedBy: text("updated_by"),    // user ID of admin who last changed this
    updatedAt: text("updated_at"),    // ISO timestamp of last change
});

// ─── Users Table ─────────────────────────────────────────────────────────────
export const users = sqliteTable("users", {
    id: text("id").primaryKey(),
    fullName: text("full_name").notNull(),
    username: text("username").notNull().unique(),
    email: text("email").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    role: text("role").default("User"), // Admin or User
    position: text("position").default(""), // Doctor, Nurse, Technician etc
    createdAt: text("created_at").notNull(),
});

// ─── Sessions Table ──────────────────────────────────────────────────────────
export const sessions = sqliteTable("sessions", {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id),
    expiresAt: integer("expires_at").notNull() // Unix timestamp
});

// ─── AI Settings & LangGraph Logs ───────────────────────────────────────────
export const aiConfigurations = sqliteTable("ai_configurations", {
    id: text("id").primaryKey(),
    providerType: text("provider_type").notNull(), // 'cloud_api' | 'ollama' | 'custom_endpoint'
    providerName: text("provider_name").notNull(), // e.g. "Google Gemini"
    apiEndpointUrl: text("api_endpoint_url"),
    apiSecretKey: text("api_secret_key"),
    modelName: text("model_name").notNull(),
    isActive: integer("is_active", { mode: 'boolean' }).default(false),
    isVisionCapable: integer("is_vision_capable", { mode: 'boolean' }).default(false),
    maxTokens: integer("max_tokens").default(4096),
    temperature: real("temperature").default(0.3),
    timeoutSeconds: integer("timeout_seconds").default(120),
    purpose: text("purpose").default("report_generation"), // 'report_generation' | 'copilot'
    langsmithApiKey: text("langsmith_api_key"),
    langsmithProject: text("langsmith_project"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at")
});

export const promptTemplates = sqliteTable("prompt_templates", {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    template: text("template").notNull(),
    isActive: integer("is_active", { mode: 'boolean' }).default(false),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at")
});

export const reportGenerationLogs = sqliteTable("report_generation_logs", {
    id: text("id").primaryKey(),
    reportId: text("report_id"),
    aiConfigId: text("ai_config_id").references(() => aiConfigurations.id),
    modelUsed: text("model_used"),
    promptTemplateId: text("prompt_template_id"),
    rawLlmResponse: text("raw_llm_response"),
    parsedSuccessfully: integer("parsed_successfully", { mode: 'boolean' }),
    retryCount: integer("retry_count"),
    generationTimeMs: integer("generation_time_ms"),
    errorMessage: text("error_message"),
    createdAt: text("created_at").notNull()
});

// ─── Chat Messages Table (AI Copilot) ────────────────────────────────────────
export const chatMessages = sqliteTable("chat_messages", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sessionId: text("session_id").notNull(),
    role: text("role").notNull(), // 'user' | 'assistant'
    content: text("content").notNull(),
    viewerActions: text("viewer_actions"), // JSON string of ViewerAction[]
    references: text("references"),        // JSON string of Reference[]
    patientId: text("patient_id"),
    createdAt: text("created_at").default("CURRENT_TIMESTAMP"),
});

// ─── Compliance Settings Table (singleton) ───────────────────────────────────
export const complianceSettings = sqliteTable("compliance_settings", {
    id: integer("id").primaryKey().default(1),
    dataRetentionDays: integer("data_retention_days").default(2555),
    auditRetentionDays: integer("audit_retention_days").default(2555),
    sessionTimeoutMinutes: integer("session_timeout_minutes").default(15),
    idleTimeoutMinutes: integer("idle_timeout_minutes").default(30),
    enableGdprExport: integer("enable_gdpr_export", { mode: 'boolean' }).default(true),
    enableGdprAnonymize: integer("enable_gdpr_anonymize", { mode: 'boolean' }).default(true),
    enableGdprRestriction: integer("enable_gdpr_restriction", { mode: 'boolean' }).default(true),
    legalBasis: text("legal_basis").default("legitimate_interest"),
    privacyPolicyUrl: text("privacy_policy_url"),
    dpoContactEmail: text("dpo_contact_email"),
    updatedAt: text("updated_at"),
});

// ─── FHIR Integration Config Table (singleton) ──────────────────────────────
export const fhirIntegrationConfig = sqliteTable("fhir_integration_config", {
    id: integer("id").primaryKey().default(1),
    enabled: integer("enabled", { mode: 'boolean' }).default(false),
    publicBaseUrl: text("public_base_url").default(""),
    authMode: text("auth_mode").default("bearer_token"),
    inboundServiceRequestEnabled: integer("inbound_service_request_enabled", { mode: 'boolean' }).default(false),
    outboundReadEnabled: integer("outbound_read_enabled", { mode: 'boolean' }).default(true),
    externalFhirBaseUrl: text("external_fhir_base_url").default(""),
    externalFhirAuthType: text("external_fhir_auth_type").default("none"),
    externalFhirClientId: text("external_fhir_client_id").default(""),
    externalFhirClientSecret: text("external_fhir_client_secret"),
    externalFhirBearerToken: text("external_fhir_bearer_token"),
    apiTokenHash: text("api_token_hash"),
    createdAt: text("created_at"),
    updatedAt: text("updated_at"),
});

// ─── Worklist Orders Table (FHIR ServiceRequest inbound) ─────────────────────
export const worklistOrders = sqliteTable("worklist_orders", {
    id: text("id").primaryKey(),
    sourceSystem: text("source_system").default("FHIR"),
    fhirServiceRequestId: text("fhir_service_request_id"),
    patientId: text("patient_id").references(() => patients.id, { onDelete: 'cascade' }),
    patientName: text("patient_name"),
    patientIdentifier: text("patient_identifier"),
    status: text("status").default("active"),
    intent: text("intent").default("order"),
    priority: text("priority").default("routine"),
    urgency: text("urgency").default("Routine"),
    modality: text("modality"),
    requestedProcedure: text("requested_procedure"),
    reason: text("reason"),
    authoredOn: text("authored_on"),
    requesterDisplay: text("requester_display"),
    rawFhir: text("raw_fhir"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at"),
});

// ─── Patient Privacy Controls Table (GDPR compliance tracking) ───────────────
export const patientPrivacyControls = sqliteTable("patient_privacy_controls", {
    id: text("id").primaryKey(),
    patientId: text("patient_id").notNull().references(() => patients.id, { onDelete: 'cascade' }),
    restriction: text("restriction"),
    consentStatus: text("consent_status"),
    anonymizedAt: text("anonymized_at"),
    anonymizedBy: text("anonymized_by"),
    lastExportedAt: text("last_exported_at"),
    lastExportedBy: text("last_exported_by"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at"),
});

// ─── Audit Logs Table ────────────────────────────────────────────────────────
export const auditLogs = sqliteTable("audit_logs", {
    id: text("id").primaryKey(),
    actorUserId: text("actor_user_id"),
    actorRole: text("actor_role"),
    actorType: text("actor_type").default("user"),
    action: text("action").notNull(),
    resourceType: text("resource_type").notNull(),
    resourceId: text("resource_id"),
    patientId: text("patient_id"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    success: integer("success", { mode: 'boolean' }).default(true),
    reason: text("reason"),
    metadata: text("metadata"), // JSON string
    createdAt: text("created_at").notNull(),
});



