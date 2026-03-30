import { PatientContext, ReportData, ReportStatus } from "@/types";
import { getSupabaseClient, ensureSupabaseConfig } from "./supabase";

// ─── Helper: fetch settings from the local SQLite API ────────────────────────
async function fetchSettings(type: string) {
    try {
        const res = await fetch(`/api/settings?type=${type}`);
        if (res.ok) return await res.json();
    } catch (e) {
        console.warn(`[OpenRad] Could not fetch settings/${type}:`, e);
    }
    return null;
}

// ─── Generate Report ─────────────────────────────────────────────────────────
export async function generateReport(data: PatientContext, dicomBase64?: string | null, dicomSlices?: string[]): Promise<ReportData[]> {
    // 1. Try to get webhook URL from SQLite config
    let webhookUrl: string | undefined = undefined;

    try {
        const cfg = await fetchSettings("config");
        if (cfg?.n8nWebhookUrl?.trim()) {
            webhookUrl = cfg.n8nWebhookUrl.trim();
            console.log("[OpenRad] Using webhook URL from settings:", webhookUrl);
        }
    } catch (e) {
        console.error("[OpenRad] Error reading config:", e);
    }

    // Fallback to env variable
    if (!webhookUrl && process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL) {
        webhookUrl = process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL;
        console.log("[OpenRad] Using webhook URL from env variable:", webhookUrl);
    }

    if (!webhookUrl) {
        console.error("[OpenRad] No webhook URL configured.");
        throw new Error("No webhook URL configured. Please enter your n8n webhook URL in Settings.");
    }

    try {
        const formData = new FormData();
        formData.append("patient_name", data.fullName);
        formData.append("patient_age", String(data.age));
        formData.append("patient_gender", data.gender);
        formData.append("symptoms", data.symptoms);
        formData.append("history", data.history);
        formData.append("indication", data.indication);
        formData.append("modality", data.modality);
        
        formData.append("isDicom", data.isDicom ? "true" : "false");
        if (data.isDicom && data.dicomMetadata) {
             formData.append("dicomMetadata", JSON.stringify(data.dicomMetadata));
        }

        let imageBase64: string | null = null;
        let imagesBase64: string[] = [];
        
        const filesToProcess = data.images && data.images.length > 0 ? data.images : (data.image ? [data.image] : []);
        
        if (data.isDicom && dicomSlices && dicomSlices.length > 0) {
            // Multi-slice DICOM: send each captured slice as a separate binary image
            formData.append("sliceCount", String(dicomSlices.length));
            for (let i = 0; i < dicomSlices.length; i++) {
                const response = await fetch(dicomSlices[i]);
                const blob = await response.blob();
                formData.append(i === 0 ? "image" : `image_${i}`, blob, `dicom-slice-${i + 1}.jpg`);
                imagesBase64.push(dicomSlices[i]);
                if (i === 0) imageBase64 = dicomSlices[i];
            }
            console.log(`[OpenRad] Sending ${dicomSlices.length} DICOM slices to webhook`);
        } else if (data.isDicom && dicomBase64) {
            // Single-frame DICOM fallback
            const response = await fetch(dicomBase64);
            const blob = await response.blob();
            formData.append("image", blob, "dicom-preview.jpg");
            imageBase64 = dicomBase64;
            imagesBase64.push(dicomBase64);
        } else {
            for (let i = 0; i < filesToProcess.length; i++) {
                const file = filesToProcess[i] as File;
                formData.append(i === 0 ? "image" : `image_${i}`, file, file.name);

                const b64 = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result as string);
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });
                imagesBase64.push(b64);
                if (i === 0) imageBase64 = b64;
            }
        }

        console.log("[OpenRad] Sending request to webhook:", webhookUrl);
        console.log("[OpenRad] Payload fields:", {
            patient_name: data.fullName,
            patient_age: data.age,
            patient_gender: data.gender,
            symptoms: data.symptoms,
            history: data.history,
            indication: data.indication,
            modality: data.modality,
            images: filesToProcess.length > 0 ? filesToProcess.map((f: File) => `[binary file: ${f.name}, ${f.size} bytes]`) : null,
        });

        const response = await fetch(webhookUrl, {
            method: "POST",
            body: formData,
        });

        console.log("[OpenRad] Webhook response status:", response.status, response.statusText);

        if (!response.ok) {
            const errorText = await response.text().catch(() => 'Could not read error body');
            console.error("[OpenRad] Webhook error response body:", errorText);
            throw new Error(`API call failed: ${response.status} ${response.statusText}`);
        }

        const rawResponse = await response.json();
        console.log("[OpenRad] Webhook raw response:", rawResponse);

        // Handle various response formats from n8n
        let reports: ReportData[];
        if (Array.isArray(rawResponse)) {
            reports = rawResponse;
        } else if (rawResponse && typeof rawResponse === 'object') {
            if (rawResponse.output && typeof rawResponse.output === 'object') {
                reports = Array.isArray(rawResponse.output) ? rawResponse.output : [rawResponse.output];
            } else if (rawResponse.data && typeof rawResponse.data === 'object') {
                reports = Array.isArray(rawResponse.data) ? rawResponse.data : [rawResponse.data];
            } else if (rawResponse.report_header || rawResponse.patient || rawResponse.findings) {
                reports = [rawResponse as ReportData];
            } else {
                console.warn("[OpenRad] Unexpected response format:", rawResponse);
                reports = [rawResponse as ReportData];
            }
        } else {
            throw new Error('Invalid response format from webhook');
        }

        console.log("[OpenRad] Parsed reports count:", reports.length);

        const normalizeStatus = (status: string | undefined): ReportStatus => {
            if (!status) return 'Pending';
            const upper = status.toUpperCase().trim();
            if (upper === 'APPROVED') return 'Approved';
            if (upper === 'REJECTED') return 'Rejected';
            if (upper === 'FINAL') return 'Final';
            return 'Pending';
        };

        // Load profile info for report footer defaults
        let defaultPreparedBy = 'OpenRad AI';
        let defaultDepartment = 'Radiology';
        let defaultHospitalName = 'Hospital';
        try {
            const profileData = await fetchSettings("profile");
            if (profileData) {
                if (profileData.fullName) defaultPreparedBy = profileData.fullName;
                if (profileData.department) defaultDepartment = profileData.department;
                if (profileData.hospitalName) defaultHospitalName = profileData.hospitalName;
            }
        } catch (e) { /* ignore */ }

        // Ensure report has required structure
        reports = reports.map(report => {
            const footer = report.report_footer || {};
            return {
                report_header: report.report_header || {
                    hospital_name: defaultHospitalName,
                    department: defaultDepartment,
                    report_title: 'Radiology Report',
                    report_id: `RAD-${Date.now()}`,
                    report_date: new Date().toISOString(),
                },
                patient: {
                    name: report.patient?.name || data.fullName || 'Unknown Patient',
                    patient_id: data.patientId || report.patient?.patient_id || '',
                    age: report.patient?.age || data.age || 0,
                    gender: report.patient?.gender || data.gender || 'Unknown'
                },
                clinical_information: report.clinical_information || {
                    symptoms: data.symptoms,
                    history: data.history,
                    indication: data.indication,
                },
                study: report.study || { modality: data.modality, examination: `${data.modality} Scan`, views: 'Standard Views' },
                findings: report.findings || [],
                impression: report.impression || [],
                urgency: report.urgency || 'Routine',
                recommendations: report.recommendations || [],
                report_footer: {
                    prepared_by: footer.prepared_by || defaultPreparedBy,
                    department: footer.department || defaultDepartment,
                    report_status: normalizeStatus(footer.report_status),
                    approved_by: footer.approved_by,
                    approved_at: footer.approved_at,
                    signature: footer.signature,
                    rejection_reason: footer.rejection_reason,
                },
                disclaimer: report.disclaimer || 'This AI-generated report is for reference only and must be verified by a licensed radiologist.',
                image_data: report.image_data,
                images_data: report.images_data,
                collaboration: report.collaboration,
            };
        });

        // Attach image data
        if (reports.length > 0) {
            if (imageBase64 && !reports[0].image_data) reports[0].image_data = imageBase64;
            if (imagesBase64.length > 0 && (!reports[0].images_data || reports[0].images_data.length === 0)) {
                reports[0].images_data = imagesBase64;
            }
        }

        // Save the first report
        if (reports.length > 0) {
            await saveReport(reports[0]);
        }

        return reports;
    } catch (error) {
        console.error("[OpenRad] Report generation error:", error);
        throw error;
    }
}

// ─── Save Report ─────────────────────────────────────────────────────────────
export async function saveReport(report: ReportData) {
    const reportId = `local_${Date.now()}`;

    // 1. Save to local SQLite via API
    try {
        const res = await fetch('/api/reports', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: reportId, report_data: report }),
        });
        if (res.ok) {
            console.log("Report saved to SQLite:", reportId);
        } else {
            console.error("Error saving to SQLite:", await res.text());
        }
    } catch (err) {
        console.error("Error saving to SQLite:", err);
    }

    // 2. Then save to Supabase (if configured)
    await ensureSupabaseConfig();
    const supabase = getSupabaseClient();
    if (!supabase) {
        console.warn("Supabase not configured. Report saved locally only.");
        return null;
    }

    // Strip heavy base64 image data to save Supabase storage space
    const cloudReportData = { ...report };
    delete cloudReportData.image_data;
    delete cloudReportData.images_data;

    try {
        const { data, error } = await supabase.from('reports').insert({
            patient_name: report.patient.name,
            modality: report.study.examination,
            urgency: report.urgency,
            report_status: report.report_footer?.report_status || 'Pending',
            report_data: cloudReportData,
            created_at: new Date().toISOString()
        }).select();

        if (error) {
            console.error("Error saving report to Supabase:", {
                message: error.message,
                code: error.code,
                details: error.details,
                hint: error.hint
            });

            if (error.code === '42501') {
                console.warn("⚠️ PERMISSION DENIED: RLS issue. Run the SQL setup script.");
            }
            return null;
        }

        console.log("Report saved to Supabase:", data);
        return data;
    } catch (err) {
        console.error("Exception saving report to Supabase:", err);
        return null;
    }
}

// ─── Get Reports ─────────────────────────────────────────────────────────────
export async function getReports() {
    // 1. Get reports from local SQLite
    let localReports: any[] = [];
    try {
        const res = await fetch('/api/reports');
        if (res.ok) {
            localReports = await res.json();
        }
    } catch (err) {
        console.error("Error loading from SQLite:", err);
    }

    // 2. Get reports from Supabase
    await ensureSupabaseConfig();
    const supabase = getSupabaseClient();
    let supabaseReports: any[] = [];

    if (supabase) {
        const { data, error } = await supabase
            .from('reports')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error("Error fetching reports from Supabase:", error);
        } else {
            supabaseReports = data || [];
        }
    }

    // 3. Merge both sources (Supabase reports first, then local-only reports)
    const allReports = [];
    const existingIds = new Set();
    const localReportsMap = new Map();

    // Map local reports by ID for quick lookup
    for (const local of localReports) {
        const localId = local.report_data?.report_header?.report_id || local.id;
        localReportsMap.set(localId, local);
    }

    // Process Supabase reports, merging in image_data from local if it's missing
    for (const sRep of supabaseReports) {
        // Create a shallow copy so we can mutate report_data
        const rep = { ...sRep, _source: 'Supabase' };
        const repId = rep.report_data?.report_header?.report_id || rep.id;

        // If Supabase report is missing image_data, see if we have it locally
        if (localReportsMap.has(repId)) {
            rep._source = 'Synced';
            const local = localReportsMap.get(repId);
            if (local.report_data?.image_data) {
                // Also clone report_data to avoid mutating the original fetched object
                rep.report_data = { ...rep.report_data, image_data: local.report_data.image_data };
            }
        }

        allReports.push(rep);
        existingIds.add(repId);
    }

    // Add remaining local-only reports
    for (const local of localReports) {
        const localId = local.report_data?.report_header?.report_id || local.id;
        if (!existingIds.has(localId)) {
            allReports.push({ ...local, _source: 'Local' });
            existingIds.add(localId);
        }
    }

    console.log(`Loaded ${supabaseReports.length} from Supabase, ${localReports.length} from SQLite. Total deduplicated: ${allReports.length}`);

    return allReports;
}

// ─── Update Report Data ──────────────────────────────────────────────────────
export async function updateReportData(id: string, updates: Partial<ReportData>) {
    // Update local SQLite
    try {
        await fetch(`/api/reports/${encodeURIComponent(id)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ updates }),
        });
    } catch (err) {
        console.error("Error updating SQLite report:", err);
    }

    // Also update Supabase if configured
    await ensureSupabaseConfig();
    const supabase = getSupabaseClient();
    if (!supabase || id.startsWith('local_')) return true;

    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    let supabaseRowId: string | null = isUUID ? id : null;

    if (!supabaseRowId) {
        const { data: found } = await supabase
            .from('reports')
            .select('id')
            .filter('report_data->report_header->>report_id', 'eq', id)
            .limit(1)
            .single();
        if (found) {
            supabaseRowId = found.id;
        } else {
            return true; // Local update succeeded
        }
    }

    const { data: current, error: fetchError } = await supabase
        .from('reports')
        .select('report_data')
        .eq('id', supabaseRowId)
        .single();

    if (fetchError || !current) return true;

    const updatedData = { ...current.report_data, ...updates };

    // Strip base64 image data to ensure it never accidentally inflates the cloud row size during updates
    delete updatedData.image_data;
    delete updatedData.images_data;

    const { error } = await supabase
        .from('reports')
        .update({ report_data: updatedData })
        .eq('id', supabaseRowId);

    return !error;
}

// ─── Update Report Status ────────────────────────────────────────────────────
export async function updateReportStatus(
    id: string,
    status: ReportStatus,
    data?: { signature?: string, rejectionReason?: string, notes?: string }
) {
    await ensureSupabaseConfig();
    const supabase = getSupabaseClient();

    // Get current user info from profile
    let userName = "System";
    let userRole = "System";
    try {
        const profileData = await fetchSettings("profile");
        if (profileData) {
            if (profileData.fullName) userName = profileData.fullName;
            if (profileData.role) userRole = profileData.role;
        }
    } catch (e) { /* ignore */ }

    // 1. Update local SQLite via API
    let localSuccess = false;
    try {
        const res = await fetch(`/api/reports/${encodeURIComponent(id)}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                status,
                signature: data?.signature,
                rejectionReason: data?.rejectionReason,
                notes: data?.notes,
                userName,
                userRole,
            }),
        });
        localSuccess = res.ok;
        if (res.ok) {
            console.log("[OpenRad] SQLite report status updated:", status);
        }
    } catch (err) {
        console.error("[OpenRad] Error updating SQLite status:", err);
    }

    // 2. Update Supabase (if configured)
    const isLocalReport = id.startsWith('local_');
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    let supabaseRowId: string | null = isUUID ? id : null;

    if (supabase && !isLocalReport) {
        // Resolve non-UUID ids (like RAD-XXXX)
        let updatedData: any = null;

        if (!supabaseRowId) {
            console.log("[OpenRad] Looking up Supabase row by report_id:", id);
            const { data: found, error: lookupError } = await supabase
                .from('reports')
                .select('id, report_data')
                .filter('report_data->report_header->>report_id', 'eq', id)
                .limit(1)
                .single();

            if (!lookupError && found) {
                supabaseRowId = found.id;
                updatedData = { ...found.report_data };
                console.log("[OpenRad] Found Supabase row UUID:", supabaseRowId);
            } else {
                console.warn("[OpenRad] Could not find Supabase row for report_id:", id);
            }
        } else {
            const { data: current } = await supabase
                .from('reports')
                .select('report_data')
                .eq('id', supabaseRowId)
                .single();
            if (current) updatedData = { ...current.report_data };
        }

        if (updatedData && supabaseRowId) {
            // Apply status changes
            updatedData.report_footer.report_status = status;
            if (!updatedData.collaboration) updatedData.collaboration = { comments: [], logs: [] };

            const timestamp = new Date().toISOString();
            updatedData.collaboration.logs.push({
                id: `log_${Date.now()}`,
                action: `Status Changed to ${status}`,
                user: userName,
                timestamp,
                details: status === 'Rejected' ? `Reason: ${data?.rejectionReason}` :
                    status === 'Approved' ? 'Report Approved' : 'Status reset'
            });

            if (data?.notes || data?.rejectionReason) {
                updatedData.collaboration.comments.push({
                    id: `comment_${Date.now()}`,
                    author: userName,
                    role: userRole,
                    text: data?.notes || data?.rejectionReason || "",
                    timestamp,
                });
            }

            if (status === 'Approved') {
                updatedData.report_footer.approved_at = timestamp;
                if (data?.signature) updatedData.report_footer.signature = data.signature;
                updatedData.report_footer.approved_by = userName;
            }

            if (status === 'Rejected' && data?.rejectionReason) {
                updatedData.report_footer.rejection_reason = data.rejectionReason;
            }

            // Try update with report_status column
            const { error: err1 } = await supabase
                .from('reports')
                .update({ report_data: updatedData, report_status: status })
                .eq('id', supabaseRowId);

            if (err1) {
                console.warn("[OpenRad] Supabase update with report_status failed:", err1.message);
                // Fallback without the column
                const { error: err2 } = await supabase
                    .from('reports')
                    .update({ report_data: updatedData })
                    .eq('id', supabaseRowId);
                if (err2) {
                    console.error("[OpenRad] Supabase fallback update also failed:", err2.message);
                } else {
                    console.log("[OpenRad] Fallback update succeeded (report_status column may be missing).");
                }
            } else {
                console.log("[OpenRad] Supabase report status updated successfully:", status);
            }
        }
    }

    return localSuccess;
}

// ─── Clear All Reports ───────────────────────────────────────────────────────
export async function clearAllReports() {
    // 1. Clear local SQLite
    try {
        await fetch('/api/reports/clear', { method: 'DELETE' });
        console.log("Cleared SQLite reports");
    } catch (e) {
        console.error("Error clearing SQLite:", e);
    }

    // 2. Clear Supabase
    await ensureSupabaseConfig();
    const supabase = getSupabaseClient();
    if (supabase) {
        const { error } = await supabase
            .from('reports')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000');

        if (error) {
            console.error("Error clearing Supabase reports:", error);
            return false;
        }
    }

    return true;
}
