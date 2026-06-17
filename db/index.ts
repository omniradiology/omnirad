import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import path from "path";
import fs from "fs";

// Ensure the data directory exists
const dataDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, "omnirad.db");

// Singleton pattern - reuse connection across hot reloads in dev
const globalForDb = globalThis as unknown as {
    __omniradDb: ReturnType<typeof drizzle> | undefined;
    __omniradSqlite: Database.Database | undefined;
};

if (!globalForDb.__omniradSqlite) {
    globalForDb.__omniradSqlite = new Database(dbPath);
    globalForDb.__omniradSqlite.pragma("journal_mode = WAL");
    globalForDb.__omniradSqlite.pragma("foreign_keys = ON");
    globalForDb.__omniradSqlite.pragma("busy_timeout = 5000"); // 5 seconds to wait for lock

    // Auto-create tables if they don't exist
    // Wrap in try/catch to avoid build-time crashes if another worker is creating them
    try {
        globalForDb.__omniradSqlite.exec(`
        CREATE TABLE IF NOT EXISTS patients (
            id TEXT PRIMARY KEY,
            patient_id_number TEXT,
            patient_name TEXT NOT NULL,
            date_of_birth TEXT,
            age INTEGER,
            gender TEXT,
            mobile TEXT,
            address TEXT,
            contact_info TEXT,
            notes TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT
        );

        CREATE TABLE IF NOT EXISTS reports (
            id TEXT PRIMARY KEY,
            patient_id TEXT REFERENCES patients(id) ON DELETE CASCADE,
            patient_name TEXT,
            modality TEXT,
            urgency TEXT,
            report_status TEXT DEFAULT 'Pending',
            report_data TEXT NOT NULL,
            image_data TEXT,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS config (
            id INTEGER PRIMARY KEY DEFAULT 1,
            n8n_webhook_url TEXT DEFAULT '',
            supabase_url TEXT DEFAULT '',
            supabase_anon_key TEXT DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS profile (
            id INTEGER PRIMARY KEY DEFAULT 1,
            full_name TEXT DEFAULT '',
            role TEXT DEFAULT '',
            hospital_name TEXT DEFAULT '',
            department TEXT DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS appearance (
            id INTEGER PRIMARY KEY DEFAULT 1,
            theme TEXT DEFAULT 'dark',
            template TEXT DEFAULT 'standard',
            hospital_name TEXT DEFAULT '',
            logo TEXT DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            full_name TEXT NOT NULL,
            username TEXT NOT NULL UNIQUE,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            role TEXT DEFAULT 'User',
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            expires_at INTEGER NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS ai_configurations (
            id TEXT PRIMARY KEY,
            provider_type TEXT NOT NULL,
            provider_name TEXT NOT NULL,
            api_endpoint_url TEXT,
            api_secret_key TEXT,
            model_name TEXT NOT NULL,
            is_active INTEGER DEFAULT 0,
            is_vision_capable INTEGER DEFAULT 0,
            max_tokens INTEGER DEFAULT 4096,
            temperature REAL DEFAULT 0.3,
            timeout_seconds INTEGER DEFAULT 120,
            created_at TEXT NOT NULL,
            updated_at TEXT
        );

        CREATE TABLE IF NOT EXISTS segmentation_configurations (
            id TEXT PRIMARY KEY,
            deployment_mode TEXT,
            provider_name TEXT,
            model_name TEXT,
            model_type TEXT DEFAULT 'medsam3',
            base_url TEXT,
            health_endpoint TEXT,
            predict_endpoint TEXT,
            api_secret_key TEXT,
            timeout_seconds INTEGER,
            supports_contours INTEGER,
            supports_3d INTEGER,
            returns_mask INTEGER,
            returns_box INTEGER,
            is_active INTEGER,
            created_at TEXT,
            updated_at TEXT
        );

        CREATE TABLE IF NOT EXISTS prompt_templates (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            template TEXT NOT NULL,
            is_active INTEGER DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT
        );

        CREATE TABLE IF NOT EXISTS report_generation_logs (
            id TEXT PRIMARY KEY,
            report_id TEXT,
            ai_config_id TEXT,
            model_used TEXT,
            prompt_template_id TEXT,
            raw_llm_response TEXT,
            parsed_successfully INTEGER,
            retry_count INTEGER,
            generation_time_ms INTEGER,
            error_message TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY (ai_config_id) REFERENCES ai_configurations(id)
        );

        CREATE TABLE IF NOT EXISTS chat_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            viewer_actions TEXT,
            references_data TEXT,
            patient_id TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
    `);

        // ─── Migrations for existing databases ──────────────────────────────
        // Add patient_id column to reports if it doesn't already exist
        try {
            const cols = globalForDb.__omniradSqlite!.pragma('table_info(reports)') as any[];
            const hasPatientId = cols.some((c: any) => c.name === 'patient_id');
            if (!hasPatientId) {
                globalForDb.__omniradSqlite!.exec(`ALTER TABLE reports ADD COLUMN patient_id TEXT REFERENCES patients(id) ON DELETE CASCADE;`);
                console.log('[OmniRad Db] Migrated: Added patient_id column to reports table.');
            }
        } catch (migErr) {
            console.warn('[OmniRad Db] Migration check for patient_id skipped:', migErr);
        }

        // Add age column to patients if it doesn't already exist
        try {
            const cols = globalForDb.__omniradSqlite!.pragma('table_info(patients)') as any[];
            const hasAge = cols.some((c: any) => c.name === 'age');
            if (!hasAge) {
                globalForDb.__omniradSqlite!.exec(`ALTER TABLE patients ADD COLUMN age INTEGER;`);
                console.log('[OmniRad Db] Migrated: Added age column to patients table.');
            }
        } catch (migErr) {
            console.warn('[OmniRad Db] Migration check for patients age skipped:', migErr);
        }

        // Add mobile and address columns to patients if they don't already exist
        try {
            const cols = globalForDb.__omniradSqlite!.pragma('table_info(patients)') as any[];
            if (!cols.some((c: any) => c.name === 'mobile')) {
                globalForDb.__omniradSqlite!.exec(`ALTER TABLE patients ADD COLUMN mobile TEXT;`);
                console.log('[OmniRad Db] Migrated: Added mobile column to patients table.');
            }
            if (!cols.some((c: any) => c.name === 'address')) {
                globalForDb.__omniradSqlite!.exec(`ALTER TABLE patients ADD COLUMN address TEXT;`);
                console.log('[OmniRad Db] Migrated: Added address column to patients table.');
            }
        } catch (migErr) {
            console.warn('[OmniRad Db] Migration check for patients mobile/address skipped:', migErr);
        }

        // Also ensure position column exists on users (from a prior migration)
        try {
            const userCols = globalForDb.__omniradSqlite!.pragma('table_info(users)') as any[];
            const hasPosition = userCols.some((c: any) => c.name === 'position');
            if (!hasPosition) {
                globalForDb.__omniradSqlite!.exec(`ALTER TABLE users ADD COLUMN position TEXT DEFAULT '';`);
            }
        } catch (migErr) { /* ignore */ }

        // Ensure PACS columns exist on reports (from a prior migration)
        try {
            const repCols = globalForDb.__omniradSqlite!.pragma('table_info(reports)') as any[];
            const hasPacsStudy = repCols.some((c: any) => c.name === 'pacs_study_uid');
            if (!hasPacsStudy) {
                globalForDb.__omniradSqlite!.exec(`
                    ALTER TABLE reports ADD COLUMN pacs_study_uid TEXT;
                    ALTER TABLE reports ADD COLUMN pacs_series_uid TEXT;
                    ALTER TABLE reports ADD COLUMN pacs_source TEXT;
                `);
            }
        } catch (migErr) { /* ignore */ }

        // Ensure PACS columns exist on the config table (migration for databases created before PACS support)
        try {
            const cfgCols = globalForDb.__omniradSqlite!.pragma('table_info(config)') as any[];
            const addIfMissing = (col: string, def: string) => {
                if (!cfgCols.some((c: any) => c.name === col)) {
                    globalForDb.__omniradSqlite!.exec(`ALTER TABLE config ADD COLUMN ${col} TEXT DEFAULT '${def}';`);
                    console.log(`[OmniRad Db] Migrated: Added ${col} column to config table.`);
                }
            };
            addIfMissing('pacs_orthanc_url', '');
            addIfMissing('pacs_auth_type', 'none');
            addIfMissing('pacs_username', '');
            addIfMissing('pacs_password', '');
            addIfMissing('pacs_bearer_token', '');
            addIfMissing('pacs_ae_title', '');
        } catch (migErr) {
            console.warn('[OmniRad Db] Migration check for config PACS columns skipped:', migErr);
        }

        // Add purpose, langsmith_api_key, langsmith_project columns to ai_configurations
        try {
            const aiCols = globalForDb.__omniradSqlite!.pragma('table_info(ai_configurations)') as any[];
            if (!aiCols.some((c: any) => c.name === 'purpose')) {
                globalForDb.__omniradSqlite!.exec(`ALTER TABLE ai_configurations ADD COLUMN purpose TEXT DEFAULT 'report_generation';`);
                console.log('[OmniRad Db] Migrated: Added purpose column to ai_configurations table.');
            }
            if (!aiCols.some((c: any) => c.name === 'langsmith_api_key')) {
                globalForDb.__omniradSqlite!.exec(`ALTER TABLE ai_configurations ADD COLUMN langsmith_api_key TEXT;`);
                console.log('[OmniRad Db] Migrated: Added langsmith_api_key column to ai_configurations table.');
            }
            if (!aiCols.some((c: any) => c.name === 'langsmith_project')) {
                globalForDb.__omniradSqlite!.exec(`ALTER TABLE ai_configurations ADD COLUMN langsmith_project TEXT;`);
                console.log('[OmniRad Db] Migrated: Added langsmith_project column to ai_configurations table.');
            }
        } catch (migErr) {
            console.warn('[OmniRad Db] Migration check for ai_configurations copilot columns skipped:', migErr);
        }

    } catch (e: any) {
        if (e.code === 'SQLITE_BUSY') {
            console.warn('[OmniRad Db] SQLite is busy during auto-creation (another worker might be creating tables). Ignoring.');
        } else {
            console.error('[OmniRad Db] Error auto-creating tables:', e);
        }
    }
}

if (!globalForDb.__omniradDb) {
    globalForDb.__omniradDb = drizzle(globalForDb.__omniradSqlite!, { schema });
}

export const db = globalForDb.__omniradDb;
export const sqlite = globalForDb.__omniradSqlite!;
