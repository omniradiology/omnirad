"use client"

import * as React from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { updateReportStatus, getReports } from "@/lib/api";
import { ReportData, ReportStatus } from "@/types";
import { Card, CardContent, Button } from "@/components/ui/basic";
import { Badge } from "@/components/ui/badge";
import { Eye, Check, X, Clock, RefreshCw, Trash2, Calendar } from "lucide-react";
import { ReportView } from "@/components/dashboard/ReportView";
import { ImageViewer } from "@/components/dashboard/ImageViewer";

// Helper to filter reports by status
// Defaults to 'Pending' if status is missing or 'Preliminary'
const getStatus = (r: any): ReportStatus => {
    const s = r.report_data?.report_footer?.report_status;
    if (s === 'Approved') return 'Approved';
    if (s === 'Rejected') return 'Rejected';
    return 'Pending';
};

import { Suspense } from "react";
import { ApprovalModal } from "@/components/dashboard/ApprovalModal";
import { RejectionModal } from "@/components/dashboard/RejectionModal";

function ReportsContent() {
    const router = useRouter();
    const [reports, setReports] = React.useState<any[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [selectedReport, setSelectedReport] = React.useState<{ data: ReportData, id: string } | null>(null);
    const [processingId, setProcessingId] = React.useState<string | null>(null);
    const [cameFromExternal, setCameFromExternal] = React.useState(false);

    // Modal State
    const [actionReport, setActionReport] = React.useState<{ id: string, name: string } | null>(null);
    const [showApproval, setShowApproval] = React.useState(false);
    const [showRejection, setShowRejection] = React.useState(false);

    // Get current user from localStorage
    const [currentUser, setCurrentUser] = React.useState({ name: "Dr. User", role: "Radiologist" });

    React.useEffect(() => {
        fetch('/api/settings?type=profile')
            .then(res => res.json())
            .then(data => {
                setCurrentUser({
                    name: data.fullName || "Dr. User",
                    role: data.role || "Radiologist"
                });
            })
            .catch(e => console.error("Error loading profile:", e));
    }, []);

    const loadReports = async () => {
        setLoading(true);
        try {
            // Use getReports() which merges Supabase (real UUIDs) + localStorage
            // This ensures we pass real UUIDs to updateReportStatus so Supabase gets updated
            const data = await getReports();
            console.log("Reports loaded:", data?.length || 0, "reports");
            setReports(data || []);
        } catch (e) {
            console.error("Error loading reports", e);
            setReports([]);
        }
        setLoading(false);
    };

    const searchParams = useSearchParams();
    const autoOpenId = searchParams.get('id');

    React.useEffect(() => {
        if (autoOpenId) setCameFromExternal(true);
        loadReports();
    }, []);

    // Auto-open a report if ?id= is in the URL
    React.useEffect(() => {
        if (autoOpenId && reports.length > 0 && !selectedReport) {
            const target = reports.find(r => r.id === autoOpenId);
            if (target) {
                setSelectedReport({ data: target.report_data, id: target.id });
            }
        }
    }, [autoOpenId, reports]);

    React.useEffect(() => {
        if (selectedReport && reports.length > 0) {
            const fresh = reports.find(r => r.id === selectedReport.id);
            if (fresh && fresh.report_data && JSON.stringify(fresh.report_data) !== JSON.stringify(selectedReport.data)) {
                setSelectedReport({ data: fresh.report_data, id: fresh.id });
            }
        }
    }, [reports]);

    const openApproval = (id: string, name: string) => {
        setActionReport({ id, name });
        setShowApproval(true);
    };

    const openRejection = (id: string, name: string) => {
        setActionReport({ id, name });
        setShowRejection(true);
    };

    const handleApprovalConfirm = async (signature: string, comments?: string) => {
        if (!actionReport) return;
        setProcessingId(actionReport.id);
        const success = await updateReportStatus(actionReport.id, 'Approved', { signature, notes: comments });
        if (success) {
            await loadReports();
            setShowApproval(false);
            setActionReport(null);
        }
        setProcessingId(null);
    };

    const handleRejectionConfirm = async (reason: string) => {
        if (!actionReport) return;
        setProcessingId(actionReport.id);
        const success = await updateReportStatus(actionReport.id, 'Rejected', { rejectionReason: reason });
        if (success) {
            await loadReports();
            setShowRejection(false);
            setActionReport(null);
        }
        setProcessingId(null);
    };

    const handleClearAll = async () => {
        if (confirm("Are you sure you want to clear the board? This will hide the reports from this view but keep them in your history.")) {
            setReports([]);
        }
    };

    const handleView = (reportData: ReportData, reportId: string) => {
        setSelectedReport({ data: reportData, id: reportId });
    };

    // Sorting logic helpers
    const sortNewest = (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    const sortOldest = (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime();

    // Pending: Queue (Oldest First)
    const pendingReports = reports.filter(r => getStatus(r) === 'Pending').sort(sortOldest);
    // Approved/Rejected: History (Newest First)
    const approvedReports = reports.filter(r => getStatus(r) === 'Approved').sort(sortNewest);
    const rejectedReports = reports.filter(r => getStatus(r) === 'Rejected').sort(sortNewest);

    if (selectedReport) {
        // Ensure report has proper status
        const reportData = selectedReport.data;
        if (!reportData.report_footer) {
            reportData.report_footer = {
                prepared_by: "OmniRad AI",
                department: "Radiology",
                report_status: "Pending"
            };
        }
        if (!reportData.report_footer.report_status) {
            reportData.report_footer.report_status = "Pending";
        }


        return (
            <div className="h-full flex flex-col md:flex-row overflow-hidden bg-bg-primary">
                {/* Left Panel - Image Viewer */}
                <div className="w-full md:w-[450px] md:min-w-[450px] h-auto md:h-full border-b md:border-b-0 md:border-r border-border-primary bg-bg-primary overflow-hidden">
                    <ImageViewer
                        imageSrc={reportData.image_data || null}
                        images={reportData.images_data && reportData.images_data.length > 0 ? reportData.images_data : (reportData.image_data ? [reportData.image_data] : [])}
                        className="w-full h-full"
                        isCollapsed={false}
                        onToggleCollapse={() => { }}
                    />
                </div>

                {/* Right Panel - Report View */}
                <div className="flex-1 h-full bg-bg-primary p-4 overflow-hidden flex flex-col">
                    <Button
                        variant="ghost"
                        onClick={() => {
                            if (cameFromExternal) {
                                router.back();
                            } else {
                                setSelectedReport(null);
                            }
                        }}
                        className="mb-2 self-start gap-2"
                    >
                        ← {cameFromExternal ? 'Back' : 'Back to Board'}
                    </Button>
                    <div className="flex-1 overflow-hidden">
                        <ReportView
                            report={reportData}
                            onNewPatient={() => setSelectedReport(null)}
                            reportId={selectedReport.id}
                            onStatusChange={loadReports}
                        />
                    </div>
                </div>
            </div>
        );
    }

    // If we arrived via ?id= and the report hasn't been selected yet, show a loader
    // instead of flashing the board view
    if (autoOpenId && !selectedReport) {
        return (
            <div className="h-full flex items-center justify-center bg-bg-primary">
                <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
            </div>
        );
    }

    return (
        <div className="p-6 h-full flex flex-col gap-6 overflow-hidden bg-bg-primary text-text-primary">
            <div className="flex justify-between items-center shrink-0">
                <div>
                    <h2 className="text-2xl font-semibold text-text-heading">Reports Board</h2>
                    <p className="text-text-secondary text-sm">Manage radiology reports workflow.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={handleClearAll} disabled={loading || reports.length === 0} className="text-red-500 hover:text-red-600 hover:bg-red-50 border-red-200">
                        <Trash2 size={16} className="mr-2" /> Clear Board
                    </Button>
                    <Button variant="outline" onClick={loadReports} disabled={loading}>
                        <RefreshCw size={16} className={`mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
                    </Button>
                </div>
            </div>

            <div className="flex-1 overflow-x-auto overflow-y-hidden">
                <div className="flex h-full gap-6 min-w-[1000px]">
                    {/* Pending Column */}
                    <KanbanColumn
                        title="Pending"
                        count={pendingReports.length}
                        color="border-yellow-500/50"
                        headerColor="text-yellow-500"
                    >
                        {pendingReports.map(report => (
                            <ReportCard
                                key={report.id}
                                report={report}
                                onView={() => handleView(report.report_data, report.id)}
                                onApprove={() => openApproval(report.id, report.report_data.patient.name)}
                                onReject={() => openRejection(report.id, report.report_data.patient.name)}
                                processing={processingId === report.id}
                            />
                        ))}
                    </KanbanColumn>

                    {/* Approved Column */}
                    <KanbanColumn
                        title="Approved"
                        count={approvedReports.length}
                        color="border-green-500/50"
                        headerColor="text-green-500"
                    >
                        {approvedReports.map(report => (
                            <ReportCard
                                key={report.id}
                                report={report}
                                onView={() => handleView(report.report_data, report.id)}
                                status="approved"
                            />
                        ))}
                    </KanbanColumn>

                    {/* Rejected Column */}
                    <KanbanColumn
                        title="Rejected"
                        count={rejectedReports.length}
                        color="border-red-500/50"
                        headerColor="text-red-500"
                    >
                        {rejectedReports.map(report => (
                            <ReportCard
                                key={report.id}
                                report={report}
                                onView={() => handleView(report.report_data, report.id)}
                                status="rejected"
                            />
                        ))}
                    </KanbanColumn>
                </div>
            </div>

            {/* Modals */}
            <ApprovalModal
                isOpen={showApproval}
                onClose={() => {
                    setShowApproval(false);
                    setActionReport(null);
                }}
                onConfirm={handleApprovalConfirm}
                currentUser={currentUser}
            />
            <RejectionModal
                isOpen={showRejection}
                onClose={() => {
                    setShowRejection(false);
                    setActionReport(null);
                }}
                onConfirm={handleRejectionConfirm}
            />
        </div>
    );
}

export default function ReportsPage() {
    return (
        <Suspense fallback={<div className="h-full flex items-center justify-center p-8">Loading Reports...</div>}>
            <ReportsContent />
        </Suspense>
    );
}

function KanbanColumn({ title, count, children, color, headerColor }: { title: string, count: number, children: React.ReactNode, color: string, headerColor: string }) {
    return (
        <div className={`flex-1 flex flex-col bg-bg-surface rounded-lg border ${color} h-full overflow-hidden`}>
            <div className={`p-4 font-semibold flex justify-between items-center border-b border-border-primary bg-bg-panel/50 ${headerColor}`}>
                <span>{title}</span>
                <Badge variant="secondary" className="bg-bg-primary text-text-primary">{count}</Badge>
            </div>
            <div className="p-4 flex-1 overflow-y-auto space-y-4">
                {count === 0 ? (
                    <div className="text-center text-text-muted text-sm py-8 opacity-50">No reports</div>
                ) : children}
            </div>
        </div>
    );
}

function ReportCard({ report, onView, onApprove, onReject, processing, status }: {
    report: any,
    onView: () => void,
    onApprove?: () => void,
    onReject?: () => void,
    processing?: boolean,
    status?: 'approved' | 'rejected'
}) {
    const data = report.report_data;
    return (
        <Card className="bg-bg-panel border-border-primary hover:border-text-muted/50 transition-all duration-200 hover:shadow-lg">
            <CardContent className="p-4 space-y-3">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="font-medium text-text-heading">{data.patient?.name || report.patient_name || 'Unknown Patient'}</p>
                        <p className="text-xs text-text-secondary">{data.patient.age}y • {data.patient.gender}</p>
                    </div>
                    <Badge variant="outline" className={`text-[10px] ${data.urgency === 'Critical' ? 'border-red-500 text-red-500' :
                        data.urgency === 'Urgent' ? 'border-yellow-500 text-yellow-500' :
                            'border-green-500 text-green-500'
                        }`}>
                        {data.urgency}
                    </Badge>
                </div>

                <div className="flex flex-col gap-1 mt-2">
                    <p className="text-xs font-medium text-text-primary">{data.study.modality}</p>
                    <div className="flex justify-between items-center text-[10px] text-text-muted">
                        <div className="flex items-center gap-1">
                            <Calendar size={12} />
                            <span>{new Date(report.created_at).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <Clock size={12} />
                            <span>{new Date(report.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                    </div>
                </div>

                <div className="pt-2 flex gap-2 justify-end flex-wrap">
                    {/* View Button - Always visible */}
                    <Button
                        size="sm"
                        variant="outline"
                        className="h-8 px-3 gap-2 text-xs hover:bg-bg-hover transition-all duration-200 hover:scale-105 active:scale-95"
                        onClick={onView}
                    >
                        <Eye size={14} />
                        <span>View</span>
                    </Button>

                    {/* Approve Button - Only for pending reports */}
                    {onApprove && (
                        <Button
                            size="sm"
                            variant="outline"
                            className="h-8 px-3 gap-2 text-xs text-green-500 border-green-500/50 hover:bg-green-950/20 hover:border-green-500 transition-all duration-200 hover:scale-105 active:scale-95"
                            onClick={onApprove}
                            disabled={processing}
                        >
                            <Check size={14} />
                            <span>Approve</span>
                        </Button>
                    )}

                    {/* Reject Button - Only for pending reports */}
                    {onReject && (
                        <Button
                            size="sm"
                            variant="outline"
                            className="h-8 px-3 gap-2 text-xs text-red-500 border-red-500/50 hover:bg-red-950/20 hover:border-red-500 transition-all duration-200 hover:scale-105 active:scale-95"
                            onClick={onReject}
                            disabled={processing}
                        >
                            <X size={14} />
                            <span>Reject</span>
                        </Button>
                    )}

                    {/* Status indicators for approved/rejected */}
                    {status === 'approved' && (
                        <div className="flex items-center gap-1 text-green-500 text-xs px-2 py-1 bg-green-950/20 rounded-md border border-green-500/50">
                            <Check size={14} />
                            <span>Approved</span>
                        </div>
                    )}
                    {status === 'rejected' && (
                        <div className="flex items-center gap-1 text-red-500 text-xs px-2 py-1 bg-red-950/20 rounded-md border border-red-500/50">
                            <X size={14} />
                            <span>Rejected</span>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
