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

const dbPath = path.join(dataDir, "openrad.db");

// Singleton pattern - reuse connection across hot reloads in dev
const globalForDb = globalThis as unknown as {
    __openradDb: ReturnType<typeof drizzle> | undefined;
    __openradSqlite: Database.Database | undefined;
};

if (!globalForDb.__openradSqlite) {
    globalForDb.__openradSqlite = new Database(dbPath);
    globalForDb.__openradSqlite.pragma("journal_mode = WAL");
    globalForDb.__openradSqlite.pragma("foreign_keys = ON");
    globalForDb.__openradSqlite.pragma("busy_timeout = 5000"); // 5 seconds to wait for lock

    // Auto-create tables if they don't exist
    // Wrap in try/catch to avoid build-time crashes if another worker is creating them
    try {
        globalForDb.__openradSqlite.exec(`
        CREATE TABLE IF NOT EXISTS reports (
            id TEXT PRIMARY KEY,
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
    `);
    } catch (e: any) {
        if (e.code === 'SQLITE_BUSY') {
            console.warn('[OpenRad Db] SQLite is busy during auto-creation (another worker might be creating tables). Ignoring.');
        } else {
            console.error('[OpenRad Db] Error auto-creating tables:', e);
        }
    }
}

if (!globalForDb.__openradDb) {
    globalForDb.__openradDb = drizzle(globalForDb.__openradSqlite!, { schema });
}

export const db = globalForDb.__openradDb;
export const sqlite = globalForDb.__openradSqlite!;
