import { PatientContext, ReportData, ReportStatus } from "@/types";
import { getSupabaseClient, ensureSupabaseConfig } from "./supabase";

// ─── Helper: fetch settings from the local SQLite API ────────────────────────
async function fetchSettings(type: string) {
    try {
        const res = await fetch(`/api/settings?type=${type}`);
        if (res.ok) return await res.json();
    } catch (e) {
        console.warn(`[OmniRad] Could not fetch settings/${type}:`, e);
    }
    return null;
}

// ─── Generate Report ─────────────────────────────────────────────────────────
export async function generateReport(data: PatientContext, dicomBase64?: string | null, dicomSlices?: string[]): Promise<ReportData[]> {
    // 1. Send to local Python FastAPI Microservice
    let webhookUrl: string = "http://localhost:8001/generate_report";
    console.log("[OmniRad] Using backend Python microservice at:", webhookUrl);


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
        
        if (data.isPacs && data.pacsData) {
            formData.append("isPacs", "true");
            formData.append("pacsMetadata", JSON.stringify(data.pacsData));
            
            try {
                // Fetch the default rendered representation by omitting frame parameter (handles single-frame and defaults to first frame for multi-frame)
                const url = `/api/pacs/wado/render?studyUid=${data.pacsData.pacsStudyUid}&seriesUid=${data.pacsData.pacsSeriesUid}&instanceUid=${data.pacsData.firstInstanceUid}`;
                const res = await fetch(url);
                if (res.ok) {
                    const blob = await res.blob();
                    formData.append("image", blob, `pacs-instance.jpg`);
                    
                    const b64 = await new Promise<string>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result as string);
                        reader.onerror = reject;
                        reader.readAsDataURL(blob);
                    });
                    imageBase64 = b64;
                    imagesBase64.push(b64);
                }
            } catch (e) {
                console.error("[OmniRad] Error fetching PACS image:", e);
            }
        } else if (data.isDicom && dicomSlices && dicomSlices.length > 0) {
            // Multi-slice DICOM: send each captured slice as a separate binary image
            formData.append("sliceCount", String(dicomSlices.length));
            for (let i = 0; i < dicomSlices.length; i++) {
                const response = await fetch(dicomSlices[i]);
                const blob = await response.blob();
                formData.append(i === 0 ? "image" : `image_${i}`, blob, `dicom-slice-${i + 1}.jpg`);
                imagesBase64.push(dicomSlices[i]);
                if (i === 0) imageBase64 = dicomSlices[i];
            }
            console.log(`[OmniRad] Sending ${dicomSlices.length} DICOM slices to webhook`);
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

        // Load active AI configuration (with real API key) for forwarding to Python backend
        let aiConfig: any = null;
        try {
            const configRes = await fetch('/api/ai-config?mode=active_internal');
            if (configRes.ok) {
                aiConfig = await configRes.json();
                console.log("[OmniRad] Loaded active AI config:", aiConfig.providerName, aiConfig.modelName);
            } else {
                console.warn("[OmniRad] No active AI configuration found. The Python backend may fail.");
            }
        } catch (e) {
            console.warn("[OmniRad] Could not fetch AI config:", e);
        }

        // Load profile info for report header
        let hospitalName = 'OmniRad Hospital';
        let department = 'Radiology';
        try {
            const profileData = await fetchSettings("profile");
            if (profileData) {
                if (profileData.hospitalName) hospitalName = profileData.hospitalName;
                if (profileData.department) department = profileData.department;
            }
        } catch (e) { /* ignore */ }

        // Create proper JSON payload for Python Backend
        const payload = {
            patient: {
                name: data.fullName,
                age: data.age,
                dob: data.dob,
                gender: data.gender,
                patient_id: data.patientId || ""
            },
            clinical_information: {
                symptoms: data.symptoms,
                history: data.history,
                indication: data.indication
            },
            study: {
                modality: data.modality,
                is_dicom: data.isDicom,
                is_pacs: data.isPacs
            },
            image: imageBase64 ? { type: "base64", data: imageBase64 } : null,
            report_header: { hospital_name: hospitalName, department: department },
            ai_config: aiConfig ? {
                providerType: aiConfig.providerType,
                providerName: aiConfig.providerName,
                apiEndpointUrl: aiConfig.apiEndpointUrl,
                apiSecretKey: aiConfig.apiSecretKey,
                modelName: aiConfig.modelName,
                maxTokens: aiConfig.maxTokens,
                temperature: aiConfig.temperature,
                timeoutSeconds: aiConfig.timeoutSeconds,
                isVisionCapable: aiConfig.isVisionCapable,
            } : null
        };

        console.log("[OmniRad] Sending request to Python Backend:", webhookUrl);

        const response = await fetch(webhookUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload),
        });

        console.log("[OmniRad] Backend response status:", response.status, response.statusText);

        if (!response.ok) {
            const errorText = await response.text().catch(() => 'Could not read error body');
            console.error("[OmniRad] Backend error response body:", errorText);
            throw new Error(`API call failed: ${response.status} ${response.statusText}`);
        }

        const rawResponse = await response.json();
        console.log("[OmniRad] Backend raw response:", rawResponse);

        // Check if the Python backend returned an error
        if (rawResponse.failed || rawResponse.error) {
            throw new Error(rawResponse.error || 'AI generation failed');
        }

        // Handle various response formats
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
                console.warn("[OmniRad] Unexpected response format:", rawResponse);
                reports = [rawResponse as ReportData];
            }
        } else {
            throw new Error('Invalid response format from webhook');
        }

        console.log("[OmniRad] Parsed reports count:", reports.length);

        const normalizeStatus = (status: string | undefined): ReportStatus => {
            if (!status) return 'Pending';
            const upper = status.toUpperCase().trim();
            if (upper === 'APPROVED') return 'Approved';
            if (upper === 'REJECTED') return 'Rejected';
            if (upper === 'FINAL') return 'Final';
            return 'Pending';
        };

        // Load profile info for report footer defaults
        let defaultPreparedBy = 'OmniRad AI';
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
                pacs_info: data.isPacs && data.pacsData ? {
                    study_uid: data.pacsData.pacsStudyUid,
                    series_uid: data.pacsData.pacsSeriesUid,
                    source: data.pacsData.pacsSource || 'Orthanc'
                } : report.pacs_info,
            };
        });

        // Attach true base64 image data (overriding any string descriptors sent back by the AI webhook)
        if (reports.length > 0) {
            if (imageBase64) reports[0].image_data = imageBase64;
            if (imagesBase64.length > 0) reports[0].images_data = imagesBase64;
        }

        // Save the first report
        if (reports.length > 0) {
            await saveReport(reports[0]);
        }

        return reports;
    } catch (error) {
        console.error("[OmniRad] Report generation error:", error);
        throw error;
    }
}

// ─── Save Report ─────────────────────────────────────────────────────────────
export async function saveReport(report: ReportData) {
    const reportId = `local_${Date.now()}`;
    let linkedPatientId: string | null = null;

    // 1. Save to local SQLite via API
    try {
        const res = await fetch('/api/reports', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: reportId, report_data: report }),
        });
        if (res.ok) {
            const data = await res.json();
            linkedPatientId = data.patientId || null;
            console.log("Report saved to SQLite:", reportId, "Linked Patient:", linkedPatientId);
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

    // Upsert Patient to Supabase first if we linked one locally
    if (linkedPatientId) {
        try {
            const pRes = await fetch(`/api/patients/${linkedPatientId}`);
            if (pRes.ok) {
                const pData = await pRes.json();
                const { error: pErr } = await supabase.from('patients').upsert({
                    id: pData.id,
                    patient_name: pData.patientName,
                    patient_id_number: pData.patientIdNumber,
                    date_of_birth: pData.dob,
                    gender: pData.gender,
                    contact_info: pData.contactInfo,
                    notes: pData.notes,
                    created_at: pData.createdAt,
                    updated_at: pData.updatedAt
                }, { onConflict: 'id' });
                if (pErr) console.error("Error syncing patient to Supabase:", pErr);
            }
        } catch (e) {
            console.error("Error fetching local patient for Supabase sync:", e);
        }
    }

    // Strip heavy base64 image data to save Supabase storage space
    const cloudReportData = { ...report };
    delete cloudReportData.image_data;
    delete cloudReportData.images_data;

    try {
        const { data, error } = await supabase.from('reports').insert({
            patient_id: linkedPatientId,
            patient_name: report.patient.name,
            modality: report.study.examination,
            urgency: report.urgency,
            report_status: report.report_footer?.report_status || 'Pending',
            report_data: cloudReportData,
            pacs_study_uid: report.pacs_info?.study_uid || null,
            pacs_series_uid: report.pacs_info?.series_uid || null,
            pacs_source: report.pacs_info?.source || null,
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
        const res = await fetch('/api/auth/me');
        if (res.ok) {
            const data = await res.json();
            if (data.fullName) userName = data.fullName;
            if (data.position || data.role) userRole = data.position || data.role;
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
            console.log("[OmniRad] SQLite report status updated:", status);
        }
    } catch (err) {
        console.error("[OmniRad] Error updating SQLite status:", err);
    }

    // 2. Update Supabase (if configured)
    const isLocalReport = id.startsWith('local_');
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    let supabaseRowId: string | null = isUUID ? id : null;

    if (supabase && !isLocalReport) {
        // Resolve non-UUID ids (like RAD-XXXX)
        let updatedData: any = null;

        if (!supabaseRowId) {
            console.log("[OmniRad] Looking up Supabase row by report_id:", id);
            const { data: found, error: lookupError } = await supabase
                .from('reports')
                .select('id, report_data')
                .filter('report_data->report_header->>report_id', 'eq', id)
                .limit(1)
                .single();

            if (!lookupError && found) {
                supabaseRowId = found.id;
                updatedData = { ...found.report_data };
                console.log("[OmniRad] Found Supabase row UUID:", supabaseRowId);
            } else {
                console.warn("[OmniRad] Could not find Supabase row for report_id:", id);
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
                console.warn("[OmniRad] Supabase update with report_status failed:", err1.message);
                // Fallback without the column
                const { error: err2 } = await supabase
                    .from('reports')
                    .update({ report_data: updatedData })
                    .eq('id', supabaseRowId);
                if (err2) {
                    console.error("[OmniRad] Supabase fallback update also failed:", err2.message);
                } else {
                    console.log("[OmniRad] Fallback update succeeded (report_status column may be missing).");
                }
            } else {
                console.log("[OmniRad] Supabase report status updated successfully:", status);
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
