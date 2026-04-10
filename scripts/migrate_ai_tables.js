const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(process.cwd(), 'data', 'openrad.db'));

// Check existing tables
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log("Existing tables:", tables.map(t => t.name));

// Create the AI tables if they don't exist
try {
    db.exec(`
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
            created_at TEXT NOT NULL
        );
    `);
    console.log("AI tables created successfully!");
} catch (e) {
    console.error("Error creating tables:", e.message);
}

// Verify
const tablesAfter = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log("Tables after migration:", tablesAfter.map(t => t.name));
