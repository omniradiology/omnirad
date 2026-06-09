import { db } from "../db";
import { users, patients, reports, auditLogs, complianceSettings } from "../db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { auditLog, auditSuccess } from "../lib/security/audit";
import { encryptSecret, decryptSecret, maskSecret } from "../lib/security/secrets";

async function runTests() {
    console.log("Starting Compliance & Security Verification...");
    let passed = 0;
    let failed = 0;

    const assert = (condition: boolean, message: string) => {
        if (condition) {
            console.log(`✅ PASS: ${message}`);
            passed++;
        } else {
            console.error(`❌ FAIL: ${message}`);
            failed++;
        }
    };

    try {
        // --- Test 1: Secret Management ---
        console.log("\n--- Testing Secret Management ---");
        const rawSecret = "super_secret_api_key_12345";
        const encrypted = encryptSecret(rawSecret);
        assert(encrypted !== rawSecret, "Encrypted secret is different from raw");
        assert(encrypted.includes(":"), "Encrypted secret has expected IV:AuthTag format");
        
        const decrypted = decryptSecret(encrypted);
        assert(decrypted === rawSecret, "Decrypted secret matches original");

        const masked = maskSecret(rawSecret);
        assert(masked === "********2345", "Secret is correctly masked");

        // --- Test 2: Audit Logging ---
        console.log("\n--- Testing Audit Logging ---");
        const mockAuditId = randomUUID();
        const testPatientId = "test-patient-id-123";
        
        await auditSuccess({
            actorUserId: "test-admin",
            actorRole: "Admin",
            action: "test.event",
            resourceType: "system",
            patientId: testPatientId,
            metadata: { 
                safeData: "hello",
                phiData: "John Doe" // This shouldn't be saved due to safe keys filter
            }
        });

        // Verify it was saved to DB
        const logs = await db.select().from(auditLogs).where(eq(auditLogs.action, "test.event")).limit(1);
        assert(logs.length > 0, "Audit log was saved to database");
        if (logs.length > 0) {
            assert(logs[0].actorRole === "Admin", "Actor role was saved");
            assert(logs[0].patientId === testPatientId, "Patient ID was saved");
            assert(logs[0].success === 1, "Success flag was set to 1");
            
            // Check metadata PHI stripping
            const savedMetadata = JSON.parse(logs[0].metadataJson || "{}");
            assert(savedMetadata.phiData === undefined, "Unsafe metadata keys (PHI) were stripped");
            assert(savedMetadata.safeData === undefined, "safeData is not a whitelisted key so it was stripped");
        }

        // Clean up test audit log
        if (logs.length > 0) {
            const dbSqlite = (db as any).session.client;
            dbSqlite.prepare("DELETE FROM audit_logs WHERE action = 'test.event'").run();
        }

        // --- Test 3: Compliance Settings Table ---
        console.log("\n--- Testing Compliance Settings ---");
        let settings = await db.select().from(complianceSettings).limit(1);
        if (settings.length === 0) {
            // Initialize if empty
            await db.insert(complianceSettings).values({
                id: 1, // ID is integer primary key
                dataRetentionDays: 2555,
                auditRetentionDays: 2555,
                sessionTimeoutMinutes: 15,
                idleTimeoutMinutes: 30,
                enableGdprExport: 1, // SQLite integers for booleans
                enableGdprRestriction: 1,
                enableGdprAnonymize: 1,
                legalBasis: "legitimate_interest",
                updatedAt: new Date().toISOString()
            });
            settings = await db.select().from(complianceSettings).limit(1);
        }
        
        assert(settings.length > 0, "Compliance settings table is accessible and has data");
        if (settings.length > 0) {
            assert(settings[0].dataRetentionDays >= 365, "Data retention is at least 1 year");
        }

        console.log(`\nVerification Complete! Passed: ${passed}, Failed: ${failed}`);
        process.exit(failed > 0 ? 1 : 0);

    } catch (e: any) {
        console.error("Test execution failed with error:", e);
        process.exit(1);
    }
}

runTests();
