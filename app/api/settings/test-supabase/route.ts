import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * POST /api/settings/test-supabase
 *
 * Tests a Supabase connection with the provided URL and anon key.
 * Returns success status, report count, and whether the patients table exists.
 */
export async function POST(request: NextRequest) {
    try {
        const { supabaseUrl, supabaseAnonKey } = await request.json();

        if (!supabaseUrl?.trim() || !supabaseAnonKey?.trim()) {
            return NextResponse.json(
                { success: false, error: "Both Project URL and Anon Key are required." },
                { status: 400 }
            );
        }

        // Validate URL format
        try {
            const url = new URL(supabaseUrl.trim());
            if (url.protocol !== "http:" && url.protocol !== "https:") {
                throw new Error("Invalid protocol");
            }
        } catch {
            return NextResponse.json(
                { success: false, error: "Invalid URL format. Expected https://your-project.supabase.co" },
                { status: 400 }
            );
        }

        const client = createClient(supabaseUrl.trim(), supabaseAnonKey.trim());

        // 1. Test: query the reports table
        let reportCount = 0;
        let reportsTableExists = false;
        const { data: reports, error: reportsError } = await client
            .from("reports")
            .select("id", { count: "exact", head: true });

        if (reportsError) {
            // Check if the error is "table doesn't exist" vs auth/network error
            const msg = reportsError.message?.toLowerCase() || "";
            const code = reportsError.code || "";

            if (msg.includes("does not exist") || code === "42P01") {
                // Table doesn't exist yet — connection works but schema not set up
                return NextResponse.json({
                    success: true,
                    connected: true,
                    reportsTableExists: false,
                    patientsTableExists: false,
                    reportCount: 0,
                    message: "Connected to Supabase, but the reports table does not exist yet. Please run the SQL setup script.",
                });
            }

            // Auth or network error
            return NextResponse.json({
                success: false,
                error: `Connection failed: ${reportsError.message}`,
                hint: reportsError.hint || undefined,
            });
        }

        reportsTableExists = true;
        // The count is returned via the response header when using head: true
        // We need to use a different approach to get the count
        const { count } = await client
            .from("reports")
            .select("*", { count: "exact", head: true });
        reportCount = count ?? 0;

        // 2. Test: check if patients table exists
        let patientsTableExists = false;
        const { error: patientsError } = await client
            .from("patients")
            .select("id", { count: "exact", head: true });

        if (!patientsError) {
            patientsTableExists = true;
        }

        return NextResponse.json({
            success: true,
            connected: true,
            reportsTableExists,
            patientsTableExists,
            reportCount,
            message: patientsTableExists
                ? `Connected! ${reportCount} report(s) in cloud.`
                : `Connected! ${reportCount} report(s) found. Patients table missing — run the full SQL setup for patient sync.`,
        });
    } catch (err) {
        console.error("[API] test-supabase error:", err);
        return NextResponse.json(
            { success: false, error: `Unexpected error: ${err instanceof Error ? err.message : String(err)}` },
            { status: 500 }
        );
    }
}
