import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

// ─── Reports Table ───────────────────────────────────────────────────────────
export const reports = sqliteTable("reports", {
    id: text("id").primaryKey(),
    patientName: text("patient_name"),
    modality: text("modality"),
    urgency: text("urgency"),
    reportStatus: text("report_status").default("Pending"),
    reportData: text("report_data").notNull(),           // JSON string of ReportData
    imageData: text("image_data"),                        // base64 image (can be large)
    createdAt: text("created_at").notNull(),
});

// ─── Config Table (singleton) ────────────────────────────────────────────────
export const config = sqliteTable("config", {
    id: integer("id").primaryKey().default(1),
    n8nWebhookUrl: text("n8n_webhook_url").default(""),
    supabaseUrl: text("supabase_url").default(""),
    supabaseAnonKey: text("supabase_anon_key").default(""),
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
