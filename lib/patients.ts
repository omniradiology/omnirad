import { randomUUID } from "crypto";

import { Patient } from "@/types";

// Ensure the local patients table has parity with existing reports
export async function ensurePatientsMigrated() {
    try {
        // We do this by hitting an API route because server components / client components
        // might not have direct SQLite access if we are running edge / separating concerns.
        // Actually, we should just call an API route that does this so it accesses the DB securely.
        const res = await fetch('/api/patients/merge', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: "auto-migrate" }),
        });
        if (res.ok) {
            const data = await res.json();
            if (data.migrated > 0) {
                console.log(`[OmniRad] Migrated ${data.migrated} local reports to patient records.`);
            }
        }
    } catch (e) {
        console.warn("[OmniRad] Failed to auto-migrate patients:", e);
    }
}
