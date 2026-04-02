const Database = require("better-sqlite3");
const path = require("path");

const dbPath = path.join(process.cwd(), "data", "openrad.db");
const db = new Database(dbPath);

console.log("Migrating database...");

try {
  db.exec(`
    ALTER TABLE reports ADD COLUMN pacs_study_uid TEXT;
    ALTER TABLE reports ADD COLUMN pacs_series_uid TEXT;
    ALTER TABLE reports ADD COLUMN pacs_source TEXT;
  `);
  console.log("Added columns to reports");
} catch (e) {
  if (e.message.includes("duplicate column name")) {
    console.log("Columns already exist in reports");
  } else {
    console.error("Error altering reports:", e);
  }
}

try {
  db.exec(`
    ALTER TABLE config ADD COLUMN pacs_orthanc_url TEXT DEFAULT '';
    ALTER TABLE config ADD COLUMN pacs_auth_type TEXT DEFAULT 'none';
    ALTER TABLE config ADD COLUMN pacs_username TEXT DEFAULT '';
    ALTER TABLE config ADD COLUMN pacs_password TEXT DEFAULT '';
    ALTER TABLE config ADD COLUMN pacs_bearer_token TEXT DEFAULT '';
    ALTER TABLE config ADD COLUMN pacs_ae_title TEXT DEFAULT '';
  `);
  console.log("Added columns to config");
} catch (e) {
  if (e.message.includes("duplicate column name")) {
    console.log("Columns already exist in config");
  } else {
    console.error("Error altering config:", e);
  }
}

console.log("Done");
