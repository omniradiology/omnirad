const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, 'data', 'omnirad.db');
const db = new Database(dbPath);

try {
    const cols = db.pragma('table_info(segmentation_configurations)');
    const hasModelType = cols.some(c => c.name === 'model_type');
    if (!hasModelType) {
        db.exec(`ALTER TABLE segmentation_configurations ADD COLUMN model_type TEXT DEFAULT 'medsam3';`);
        console.log("Migration successful: Added model_type column");
    } else {
        console.log("Migration skipped: model_type already exists");
    }
} catch (e) {
    if (e.message.includes("no such table")) {
        console.log("Table does not exist. Creating table...");
        db.exec(`
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
        `);
        console.log("Table created.");
    } else {
        console.error("Error migrating:", e);
    }
}
