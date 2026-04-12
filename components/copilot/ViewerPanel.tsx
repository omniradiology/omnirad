"use client";

import { useEffect, useState } from "react";
import { ViewerTab } from "@/types/copilot";
import { MonitorDot, FileText, ClipboardList, FolderOpen, User, Calendar, Stethoscope, Activity, ExternalLink } from "lucide-react";

interface ViewerPanelProps {
    activeTab: ViewerTab;
    onTabChange: (tab: ViewerTab) => void;
    currentReportId: string | null;
    currentStudyId: string | null;
    currentSlice: number;
    currentPatientId: string | null;
    onReportSelect: (reportId: string) => void;
    onPatientContext: (patientId: string, patientName?: string) => void;
}

interface ReportData {
    id: string;
    reportData: any;
    imageData?: string | null;
    patientId?: string;
    patientName?: string;
}

export default function ViewerPanel({
    activeTab,
    onTabChange,
    currentReportId,
    currentStudyId,
    currentSlice,
    currentPatientId,
    onReportSelect,
    onPatientContext,
}: ViewerPanelProps) {
    const [reportData, setReportData] = useState<ReportData | null>(null);
    const [patientReports, setPatientReports] = useState<any[]>([]);
    const [patientInfo, setPatientInfo] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);

    // Fetch report data when currentReportId changes
    useEffect(() => {
        if (!currentReportId) return;
        setIsLoading(true);
        fetch(`/api/copilot/reports?id=${encodeURIComponent(currentReportId)}`)
            .then(r => r.json())
            .then(data => {
                if (!data.error) {
                    setReportData(data);
                    // Update patient context if we got patient info
                    if (data.patientId) {
                        onPatientContext(data.patientId, data.patientName);
                    }
                }
            })
            .catch(e => console.error("[Viewer] Error fetching report:", e))
            .finally(() => setIsLoading(false));
    }, [currentReportId, onPatientContext]);

    // Fetch patient reports list when currentPatientId changes
    useEffect(() => {
        if (!currentPatientId) return;
        fetch(`/api/copilot/reports?patientId=${encodeURIComponent(currentPatientId)}`)
            .then(r => r.json())
            .then(data => {
                if (Array.isArray(data)) setPatientReports(data);
            })
            .catch(e => console.error("[Viewer] Error fetching patient reports:", e));

        // Also fetch patient info
        fetch(`/api/patients/${encodeURIComponent(currentPatientId)}`)
            .then(r => r.json())
            .then(data => {
                if (!data.error) setPatientInfo(data);
            })
            .catch(e => console.error("[Viewer] Error fetching patient:", e));
    }, [currentPatientId]);

    const tabs: { id: ViewerTab; label: string; icon: React.ReactNode }[] = [
        { id: "dicom", label: "DICOM", icon: <MonitorDot size={16} /> },
        { id: "report", label: "REPORT", icon: <FileText size={16} /> },
        { id: "metadata", label: "METADATA", icon: <ClipboardList size={16} /> },
    ];

    return (
        <div className="flex flex-col h-full">
            {/* Tab Bar */}
            <div className="flex border-b border-border-primary bg-bg-surface shrink-0">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => onTabChange(tab.id)}
                        className={`
                            flex items-center gap-2 px-5 py-3 text-sm font-semibold uppercase tracking-wider
                            transition-all duration-200 relative
                            ${activeTab === tab.id
                                ? "text-primary"
                                : "text-text-muted hover:text-text-primary hover:bg-bg-panel/50"
                            }
                        `}
                    >
                        {tab.icon}
                        {tab.label}
                        {activeTab === tab.id && (
                            <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary rounded-t-full" />
                        )}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-auto">
                {isLoading && (
                    <div className="flex items-center justify-center h-full">
                        <div className="flex items-center gap-3 text-text-muted">
                            <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                            Loading...
                        </div>
                    </div>
                )}

                {!isLoading && activeTab === "dicom" && (
                    <DicomTab reportData={reportData} currentSlice={currentSlice} />
                )}

                {!isLoading && activeTab === "report" && (
                    <ReportTab reportData={reportData} />
                )}

                {!isLoading && activeTab === "metadata" && (
                    <MetadataTab patientInfo={patientInfo} patientReports={patientReports} />
                )}
            </div>

            {/* Associated Files (bottom) */}
            <div className="border-t border-border-primary bg-bg-surface shrink-0 max-h-[180px] overflow-auto">
                <div className="px-4 py-2 flex items-center gap-2 text-xs font-semibold text-text-muted uppercase tracking-wider">
                    <FolderOpen size={14} />
                    Associated Files
                </div>
                {patientReports.length > 0 ? (
                    <div className="px-2 pb-2 space-y-0.5">
                        {patientReports.map((r: any) => (
                            <div
                                key={r.id}
                                className={`
                                    w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-left
                                    transition-all duration-150 group
                                    ${currentReportId === r.id
                                        ? "bg-primary/10 text-primary border border-primary/20"
                                        : "text-text-primary hover:bg-bg-panel"
                                    }
                                `}
                            >
                                {/* Clickable area for viewer panel */}
                                <div 
                                    className="flex-1 min-w-0 flex items-center gap-3 cursor-pointer"
                                    onClick={() => onReportSelect(r.id)}
                                >
                                    <FileText size={14} className="shrink-0 text-text-muted" />
                                    <div className="flex-1 min-w-0">
                                        <div className="truncate font-medium">{r.reportId || r.id}</div>
                                        <div className="text-xs text-text-muted truncate">
                                            {r.modality} • {r.date ? new Date(r.date).toLocaleDateString() : "N/A"}
                                        </div>
                                    </div>
                                    {r.hasImages && (
                                        <MonitorDot size={12} className="shrink-0 text-blue-500" />
                                    )}
                                </div>

                                {/* Status Tag */}
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide shrink-0 ${
                                    r.status === 'Approved' ? 'bg-green-500/15 text-green-500' :
                                    r.status === 'Rejected' ? 'bg-red-500/15 text-red-500' :
                                    'bg-yellow-500/15 text-yellow-600'
                                }`}>
                                    {r.status || "Pending"}
                                </span>

                                {/* Open Original Button */}
                                <a
                                    href={`/reports?id=${r.id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1.5 rounded-md text-text-muted hover:text-primary hover:bg-primary/10 transition-colors opacity-0 group-hover:opacity-100"
                                    title="Open Full Report view securely"
                                >
                                    <ExternalLink size={14} />
                                </a>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="px-4 pb-3 text-xs text-text-muted italic">
                        No files loaded. Ask the AI copilot about a patient to see their files here.
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── DICOM Tab ───────────────────────────────────────────────────────────────
function DicomTab({ reportData, currentSlice }: { reportData: ReportData | null; currentSlice: number }) {
    const imageData = reportData?.reportData?.image_data || reportData?.imageData;
    const imagesData = reportData?.reportData?.images_data;
    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        if (currentSlice > 0) setCurrentIndex(currentSlice - 1);
    }, [currentSlice]);

    const images: string[] = imagesData && imagesData.length > 0
        ? imagesData
        : imageData ? [imageData] : [];

    if (images.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-text-muted gap-4 p-8">
                <MonitorDot size={48} className="opacity-30" />
                <div className="text-center">
                    <p className="font-medium text-text-secondary">No DICOM Images</p>
                    <p className="text-sm mt-1">Ask the copilot to show a scan or select a report with images.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-black/90">
            {/* Image Display */}
            <div className="flex-1 flex items-center justify-center p-4 relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src={images[currentIndex]}
                    alt={`Medical image ${currentIndex + 1}`}
                    className="max-w-full max-h-full object-contain rounded-lg"
                    style={{ filter: "brightness(1.1) contrast(1.05)" }}
                />
                {/* Slice indicator */}
                {images.length > 1 && (
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/70 text-white text-sm px-4 py-1.5 rounded-full backdrop-blur-sm">
                        Slice {currentIndex + 1} / {images.length}
                    </div>
                )}
            </div>

            {/* Slice Navigation */}
            {images.length > 1 && (
                <div className="px-6 py-3 bg-bg-surface border-t border-border-primary flex items-center gap-4">
                    <span className="text-xs text-text-muted font-medium">SLICE</span>
                    <input
                        type="range"
                        min={0}
                        max={images.length - 1}
                        value={currentIndex}
                        onChange={(e) => setCurrentIndex(parseInt(e.target.value))}
                        className="flex-1 h-1.5 bg-border-primary rounded-full appearance-none cursor-pointer accent-primary"
                    />
                    <span className="text-xs text-text-secondary font-mono w-12 text-right">
                        {currentIndex + 1}/{images.length}
                    </span>
                </div>
            )}
        </div>
    );
}

// ─── Report Tab ──────────────────────────────────────────────────────────────
function ReportTab({ reportData }: { reportData: ReportData | null }) {
    if (!reportData?.reportData) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-text-muted gap-4 p-8">
                <FileText size={48} className="opacity-30" />
                <div className="text-center">
                    <p className="font-medium text-text-secondary">No Report Loaded</p>
                    <p className="text-sm mt-1">Ask the copilot to show a patient&apos;s report, or click a file below.</p>
                </div>
            </div>
        );
    }

    const rd = reportData.reportData;
    const findings = rd.findings || [];
    const impression = rd.impression || [];
    const recommendations = rd.recommendations || [];

    return (
        <div className="p-6 space-y-6 max-w-3xl mx-auto">
            {/* Report Header */}
            <div className="border-b border-border-primary pb-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-text-heading">
                            {rd.report_header?.report_title || "Radiology Report"}
                        </h2>
                        <p className="text-sm text-text-muted mt-1">
                            {rd.report_header?.hospital_name} • {rd.report_header?.department}
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-sm font-mono text-text-secondary">{rd.report_header?.report_id}</p>
                        <p className="text-xs text-text-muted">
                            {rd.report_header?.report_date ? new Date(rd.report_header.report_date).toLocaleString() : ""}
                        </p>
                    </div>
                </div>
            </div>

            {/* Patient Info */}
            <div className="grid grid-cols-2 gap-4 bg-bg-panel/50 rounded-xl p-4 border border-border-card">
                <InfoRow label="Patient" value={rd.patient?.name} icon={<User size={14} />} />
                <InfoRow label="Age / Gender" value={`${rd.patient?.age || "?"} / ${rd.patient?.gender || "?"}`} icon={<Calendar size={14} />} />
                <InfoRow label="Modality" value={rd.study?.modality} icon={<MonitorDot size={14} />} />
                <InfoRow label="Urgency" value={rd.urgency} icon={<Activity size={14} />} />
            </div>

            {/* Clinical Information */}
            {rd.clinical_information && (
                <Section title="Clinical Information" icon={<Stethoscope size={16} />}>
                    <div className="space-y-2 text-sm text-text-primary">
                        {rd.clinical_information.symptoms && (
                            <p><span className="font-medium text-text-secondary">Symptoms:</span> {rd.clinical_information.symptoms}</p>
                        )}
                        {rd.clinical_information.history && (
                            <p><span className="font-medium text-text-secondary">History:</span> {rd.clinical_information.history}</p>
                        )}
                        {rd.clinical_information.indication && (
                            <p><span className="font-medium text-text-secondary">Indication:</span> {rd.clinical_information.indication}</p>
                        )}
                    </div>
                </Section>
            )}

            {/* Findings */}
            {findings.length > 0 && (
                <Section title="Findings" icon={<ClipboardList size={16} />}>
                    <div className="space-y-3">
                        {findings.map((f: any, i: number) => (
                            <div key={i} className="flex gap-3 items-start">
                                <span className={`mt-0.5 w-2.5 h-2.5 rounded-full shrink-0 ${
                                    f.status === 'abnormal' ? 'bg-red-500' : 'bg-green-500'
                                }`} />
                                <div>
                                    <p className="text-sm font-medium text-text-heading">{f.anatomical_region}</p>
                                    <p className="text-sm text-text-primary">{f.observation}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </Section>
            )}

            {/* Impression */}
            {impression.length > 0 && (
                <Section title="Impression" icon={<Activity size={16} />}>
                    <ul className="space-y-1.5">
                        {impression.map((item: string, i: number) => (
                            <li key={i} className="text-sm text-text-primary flex gap-2">
                                <span className="text-primary font-bold shrink-0">•</span>
                                {item}
                            </li>
                        ))}
                    </ul>
                </Section>
            )}

            {/* Recommendations */}
            {recommendations.length > 0 && (
                <Section title="Recommendations" icon={<FileText size={16} />}>
                    <ul className="space-y-1.5">
                        {recommendations.map((item: string, i: number) => (
                            <li key={i} className="text-sm text-text-primary flex gap-2">
                                <span className="text-warning font-bold shrink-0">→</span>
                                {item}
                            </li>
                        ))}
                    </ul>
                </Section>
            )}

            {/* Footer */}
            {rd.report_footer && (
                <div className="border-t border-border-primary pt-4 text-xs text-text-muted space-y-1">
                    <p>Prepared by: {rd.report_footer.prepared_by}</p>
                    {rd.report_footer.approved_by && <p>Approved by: {rd.report_footer.approved_by}</p>}
                    <p className="italic">{rd.disclaimer}</p>
                </div>
            )}
        </div>
    );
}

// ─── Metadata Tab ────────────────────────────────────────────────────────────
function MetadataTab({ patientInfo, patientReports }: { patientInfo: any; patientReports: any[] }) {
    if (!patientInfo) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-text-muted gap-4 p-8">
                <ClipboardList size={48} className="opacity-30" />
                <div className="text-center">
                    <p className="font-medium text-text-secondary">No Patient Selected</p>
                    <p className="text-sm mt-1">Ask the copilot about a patient to see their metadata here.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6 max-w-3xl mx-auto">
            {/* Patient Demographics */}
            <div>
                <h3 className="text-lg font-bold text-text-heading mb-4 flex items-center gap-2">
                    <User size={18} className="text-primary" />
                    Patient Information
                </h3>
                <div className="grid grid-cols-2 gap-4 bg-bg-panel/50 rounded-xl p-4 border border-border-card">
                    <InfoRow label="Full Name" value={patientInfo.patientName} icon={<User size={14} />} />
                    <InfoRow label="Patient ID" value={patientInfo.patientIdNumber || patientInfo.id} icon={<ClipboardList size={14} />} />
                    <InfoRow label="Age" value={patientInfo.age?.toString()} icon={<Calendar size={14} />} />
                    <InfoRow label="Gender" value={patientInfo.gender} icon={<User size={14} />} />
                    <InfoRow label="Date of Birth" value={patientInfo.dob} icon={<Calendar size={14} />} />
                    <InfoRow label="Mobile" value={patientInfo.mobile} icon={<User size={14} />} />
                </div>
            </div>

            {/* Study Timeline */}
            <div>
                <h3 className="text-lg font-bold text-text-heading mb-4 flex items-center gap-2">
                    <Activity size={18} className="text-primary" />
                    Study Timeline ({patientReports.length} reports)
                </h3>
                {patientReports.length > 0 ? (
                    <div className="space-y-3">
                        {patientReports.map((r: any, i: number) => (
                            <div key={r.id} className="flex items-start gap-4">
                                <div className="flex flex-col items-center">
                                    <div className={`w-3 h-3 rounded-full ${i === 0 ? 'bg-primary' : 'bg-border-card'}`} />
                                    {i < patientReports.length - 1 && (
                                        <div className="w-0.5 h-8 bg-border-card" />
                                    )}
                                </div>
                                <div className="flex-1 pb-3">
                                    <p className="text-sm font-medium text-text-heading">
                                        {r.modality || "Study"} — {r.reportId || r.id}
                                    </p>
                                    <p className="text-xs text-text-muted">
                                        {r.date ? new Date(r.date).toLocaleString() : "Date unknown"}
                                    </p>
                                    <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                                        r.status === 'Approved' ? 'bg-green-500/15 text-green-500' :
                                        r.status === 'Rejected' ? 'bg-red-500/15 text-red-500' :
                                        'bg-yellow-500/15 text-yellow-600'
                                    }`}>
                                        {r.status || "Pending"}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-text-muted italic">No studies found for this patient.</p>
                )}
            </div>

            {/* Notes */}
            {patientInfo.notes && (
                <div>
                    <h3 className="text-lg font-bold text-text-heading mb-2">Notes</h3>
                    <p className="text-sm text-text-primary bg-bg-panel/50 rounded-lg p-4 border border-border-card">
                        {patientInfo.notes}
                    </p>
                </div>
            )}
        </div>
    );
}

// ─── Helper Components ───────────────────────────────────────────────────────
function InfoRow({ label, value, icon }: { label: string; value?: string; icon?: React.ReactNode }) {
    return (
        <div className="flex items-center gap-2">
            {icon && <span className="text-text-muted">{icon}</span>}
            <div>
                <p className="text-xs text-text-muted">{label}</p>
                <p className="text-sm font-medium text-text-primary">{value || "—"}</p>
            </div>
        </div>
    );
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
    return (
        <div>
            <h3 className="text-base font-bold text-text-heading mb-3 flex items-center gap-2">
                {icon && <span className="text-primary">{icon}</span>}
                {title}
            </h3>
            {children}
        </div>
    );
}
