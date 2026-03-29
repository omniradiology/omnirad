import * as React from "react";
import { ReportData } from "@/types";
import { Card, CardContent } from "@/components/ui/basic";
import { Download, Printer, Edit, XCircle, CheckCircle, FileText, Share2 } from "lucide-react";
import { Button } from "@/components/ui/basic";
import { CollaborationPanel } from "@/components/dashboard/CollaborationPanel";
import { FullReportOverlay } from "@/components/dashboard/FullReportOverlay";
import { RejectionModal } from "@/components/dashboard/RejectionModal";
import { ApprovalModal } from "@/components/dashboard/ApprovalModal";
import { ReportEditor } from "@/components/dashboard/ReportEditor";
import { Comment, AuditLog } from "@/types";
import { updateReportData, updateReportStatus } from "@/lib/api";
import { StandardTemplate, PdfStandardTemplate } from "@/components/dashboard/ReportTemplates";

interface ReportViewProps {
    report: ReportData;
    onNewPatient: () => void;
    reportId?: string;
    imagePreview?: string | null;
    imagesPreviews?: string[];
    onStatusChange?: () => void;
}

export function ReportView({ report, onNewPatient, reportId, imagePreview, imagesPreviews = [], onStatusChange }: ReportViewProps) {
    const [currentUser, setCurrentUser] = React.useState({ name: "Dr. User", role: "Doctor" });

    // Local state for the report footer and collaboration so UI re-renders immediately
    const [footer, setFooter] = React.useState({ ...report.report_footer });
    const [collaboration, setCollaboration] = React.useState({
        comments: report.collaboration?.comments || [],
        logs: report.collaboration?.logs || []
    });

    // Keep state in sync if a completely new report is passed in
    React.useEffect(() => {
        setFooter({ ...report.report_footer });
        setCollaboration({
            comments: report.collaboration?.comments || [],
            logs: report.collaboration?.logs || []
        });
    }, [report]);

    React.useEffect(() => {
        // Load current user from profile via API
        fetch('/api/settings?type=profile')
            .then(res => res.json())
            .then(data => {
                setCurrentUser({
                    name: data.fullName || "Dr. User",
                    role: data.role || "Doctor"
                });
            })
            .catch(e => console.error("Error loading profile:", e));
    }, []);

    const handleAddComment = async (text: string) => {
        if (!reportId) return;

        const newComment: Comment = {
            id: Date.now().toString(),
            author: currentUser.name,
            role: currentUser.role,
            text,
            timestamp: new Date().toISOString()
        };

        const updatedComments = [...collaboration.comments, newComment];
        const updatedLogs = [...collaboration.logs, {
            id: Date.now().toString() + "_log",
            action: "Comment Added",
            user: currentUser.name,
            timestamp: new Date().toISOString(),
            details: text.substring(0, 50) + (text.length > 50 ? "..." : "")
        } as AuditLog];

        await updateReportData(reportId, {
            collaboration: {
                comments: updatedComments,
                logs: updatedLogs
            }
        });

        // Optimistically update local state
        setCollaboration({ comments: updatedComments, logs: updatedLogs });

        // Notify parent
        if (onStatusChange) onStatusChange();
    };

    const handleUnreject = async () => {
        if (!reportId) return;

        const success = await updateReportStatus(reportId, 'Pending');
        if (success) {
            setFooter(prev => ({ ...prev, report_status: 'Pending', rejection_reason: undefined }));

            // Add audit log optimistically
            setCollaboration(prev => ({
                ...prev,
                logs: [...prev.logs, {
                    id: `log_${Date.now()}`,
                    action: "Status Changed to Pending",
                    user: currentUser.name,
                    timestamp: new Date().toISOString(),
                    details: "Status reset"
                }]
            }));

            if (onStatusChange) onStatusChange();
        }
    };

    const handlePrint = () => window.print();

    const handleDownloadPDF = async () => {
        // Use the Clean Slate PDF generator which creates a fresh HTML structure
        // This bypasses any UI state or visibility issues with the React components.

        const filename = `${report.patient.name.replace(/\s+/g, '_')}_Report.pdf`;

        // Determine template preference
        let template: 'standard' | 'modern' | 'minimal' = 'standard';
        try {
            const savedConfig = localStorage.getItem("openrad_appearance");
            if (savedConfig) {
                const config = JSON.parse(savedConfig);
                if (config.reportTemplate) {
                    template = config.reportTemplate;
                }
            }
        } catch (e) {
            console.error("Error reading template preference", e);
        }

        const { generatePDF } = await import('@/lib/pdfHelper');
        await generatePDF(report, filename, template);
    };
    const urgencyColor = report.urgency === 'Critical' ? 'text-red-600' :
        report.urgency === 'Urgent' ? 'text-orange-600' : 'text-green-600';

    // Use local footer state for all status-driven UI
    const statusColor = footer.report_status === 'Approved' ? 'bg-green-100 text-green-800' :
        footer.report_status === 'Rejected' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800';



    // ... imports

    const [isFullReport, setIsFullReport] = React.useState(false);
    const [isRejectModalOpen, setIsRejectModalOpen] = React.useState(false);
    const [isApproveModalOpen, setIsApproveModalOpen] = React.useState(false);
    const [isEditing, setIsEditing] = React.useState(false);

    const handleSaveReport = async (updatedReport: ReportData) => {
        if (!reportId) return;

        // Optimistic update locally
        Object.assign(report, updatedReport);
        setIsEditing(false);

        // Update backend
        await updateReportData(reportId, {
            findings: updatedReport.findings,
            impression: updatedReport.impression,
            recommendations: updatedReport.recommendations,
            urgency: updatedReport.urgency
        });

        // Reload or update callback
        if (onStatusChange) onStatusChange();
    };

    const handleRejectConfirm = async (reason: string, comment: string) => {
        if (!reportId) return;
        const success = await updateReportStatus(reportId, 'Rejected', { rejectionReason: reason, notes: comment });
        if (success) {
            setFooter(prev => ({ ...prev, report_status: 'Rejected', rejection_reason: reason }));

            // Optmistic logs and comments updates
            const timestamp = new Date().toISOString();
            const newLogs = [...collaboration.logs, {
                id: `log_${Date.now()}`,
                action: "Status Changed to Rejected",
                user: currentUser.name,
                timestamp,
                details: `Reason: ${reason}`
            }];
            let newComments = [...collaboration.comments];
            if (comment) {
                newComments.push({
                    id: `comment_${Date.now()}`,
                    author: currentUser.name,
                    role: currentUser.role,
                    text: comment,
                    timestamp
                });
            }
            setCollaboration({ logs: newLogs, comments: newComments });

            setIsRejectModalOpen(false);
            if (onStatusChange) onStatusChange();
        }
    };

    const handleApproveConfirm = async (signature: string, comment: string) => {
        if (!reportId) return;
        const success = await updateReportStatus(reportId, 'Approved', { signature, notes: comment });
        if (success) {
            const timestamp = new Date().toISOString();
            setFooter(prev => ({
                ...prev,
                report_status: 'Approved',
                signature,
                approved_by: currentUser.name,
                approved_at: timestamp,
            }));

            // Optmistic logs and comments updates
            const newLogs = [...collaboration.logs, {
                id: `log_${Date.now()}`,
                action: "Status Changed to Approved",
                user: currentUser.name,
                timestamp,
                details: "Report Approved"
            }];
            let newComments = [...collaboration.comments];
            if (comment) {
                newComments.push({
                    id: `comment_${Date.now()}`,
                    author: currentUser.name,
                    role: currentUser.role,
                    text: comment,
                    timestamp
                });
            }
            setCollaboration({ logs: newLogs, comments: newComments });

            setIsApproveModalOpen(false);
            if (onStatusChange) onStatusChange();
        }
    };

    return (
        <div className="h-full relative">
            <RejectionModal
                isOpen={isRejectModalOpen}
                onClose={() => setIsRejectModalOpen(false)}
                onConfirm={handleRejectConfirm}
            />
            <ApprovalModal
                isOpen={isApproveModalOpen}
                onClose={() => setIsApproveModalOpen(false)}
                onConfirm={handleApproveConfirm}
                currentUser={currentUser}
            />

            {isFullReport && (
                <FullReportOverlay
                    report={{ ...report, report_footer: footer, collaboration }}
                    reportId={reportId}
                    imageSrc={imagePreview || report.image_data}
                    images={
                        imagesPreviews.length > 0 ? imagesPreviews :
                        report.images_data && report.images_data.length > 0 ? report.images_data :
                        []
                    }
                    onClose={() => setIsFullReport(false)}
                    onNewPatient={onNewPatient}
                    onPrint={handlePrint}
                    onDownloadPDF={handleDownloadPDF}
                    onEdit={() => {
                        setIsFullReport(false);
                        setIsEditing(true);
                    }}
                    onReject={() => setIsRejectModalOpen(true)}
                    onApprove={() => setIsApproveModalOpen(true)}
                    onUnreject={handleUnreject}
                    onAddComment={handleAddComment}
                    currentUser={currentUser}
                />
            )}

            {isEditing ? (
                <div className="h-full bg-bg-surface rounded-xl shadow-sm border border-border-primary overflow-hidden">
                    <ReportEditor
                        report={report}
                        onSave={handleSaveReport}
                        onCancel={() => setIsEditing(false)}
                    />
                </div>
            ) : (
                <div className="h-full flex flex-col overflow-hidden bg-bg-surface rounded-xl shadow-sm border border-border-primary">
                    <div className="flex flex-col border-b border-border-primary bg-bg-panel shrink-0">
                        {/* Top Row: Patient Info */}
                        <div className="p-4 pb-2 flex justify-between items-start">
                            <div className="flex flex-col gap-1">
                                <h1 className="text-2xl font-bold text-text-heading">{report.patient.name}</h1>
                                <div className="flex items-center gap-2 text-sm text-text-muted">
                                    <span>{report.study.modality}</span>
                                    <span>•</span>
                                    <span>{report.study.examination}</span>
                                </div>
                            </div>
                            <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${statusColor}`}>
                                {footer.report_status}
                            </div>
                        </div>

                        {/* Bottom Row: Action Toolbar */}
                        <div className="px-4 pb-4 pt-2 flex items-center justify-between gap-4">
                            {/* Left Group: View & Export */}
                            <div className="flex items-center gap-2">
                                <Button
                                    variant={isFullReport ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setIsFullReport(!isFullReport)}
                                    className="transition-all hover:shadow-md active:scale-95 hover:bg-blue-50 text-blue-700 border-blue-200"
                                >
                                    {isFullReport ? "Exit Full View" : "Full Report"}
                                </Button>
                                <div className="h-6 w-px bg-border-primary mx-1" />
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={handleDownloadPDF}
                                    title="Download PDF"
                                    className="w-8 h-8 transition-all hover:bg-gray-100 hover:text-blue-600 active:scale-95"
                                >
                                    <Download size={16} />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={handlePrint}
                                    title="Print"
                                    className="w-8 h-8 transition-all hover:bg-gray-100 hover:text-blue-600 active:scale-95"
                                >
                                    <Printer size={16} />
                                </Button>
                            </div>

                            {/* Right Group: Workflow Actions */}
                            <div className="flex items-center gap-2">
                                {footer.report_status === 'Pending' && (
                                    <>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="text-blue-600 border-blue-200 hover:bg-blue-50"
                                            onClick={() => setIsEditing(true)}
                                        >
                                            <Edit size={14} className="mr-1.5" /> Edit
                                        </Button>
                                        <Button
                                            variant="danger"
                                            size="sm"
                                            onClick={() => setIsRejectModalOpen(true)}
                                            className="bg-red-50 text-red-600 border-red-200 hover:bg-red-100"
                                        >
                                            <XCircle size={14} className="mr-1.5" /> Reject
                                        </Button>
                                        <Button
                                            variant="success"
                                            size="sm"
                                            onClick={() => setIsApproveModalOpen(true)}
                                            className="bg-green-600 text-white hover:bg-green-700 hover:shadow-md border-transparent"
                                        >
                                            <CheckCircle size={14} className="mr-1.5" /> Approve
                                        </Button>
                                    </>
                                )}

                                {footer.report_status === 'Rejected' && (
                                    <Button
                                        variant="danger"
                                        size="sm"
                                        onClick={handleUnreject}
                                        className="bg-red-100 text-red-700 hover:bg-red-200 border-red-200"
                                        title="Click to Unreject"
                                    >
                                        <XCircle size={14} className="mr-1.5" /> Unreject
                                    </Button>
                                )}

                                {footer.report_status === 'Approved' && (
                                    <Button
                                        variant="success"
                                        size="sm"
                                        className="bg-green-100 text-green-800 border-green-200 cursor-default"
                                    >
                                        <CheckCircle size={14} className="mr-1.5" /> Approved
                                    </Button>
                                )}

                                <div className="h-6 w-px bg-border-primary mx-1" />

                                <Button variant="default" size="sm" onClick={onNewPatient} className="bg-blue-600 hover:bg-blue-700 shadow-sm active:scale-95">
                                    New Patient
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Scrollable Report Content */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-8" id="report-container">

                        {/* Findings */}
                        <section>
                            <h3 className="text-sm font-bold text-text-muted uppercase tracking-wider mb-3">Findings</h3>
                            <div className="space-y-4">
                                {report.findings.map((finding, idx) => {
                                    const status = finding.status?.toLowerCase() || 'normal';

                                    let badgeColor = 'bg-gray-100 text-gray-700 border-gray-200';
                                    let statusLabel = 'NORMAL';

                                    if (status === 'abnormal') {
                                        badgeColor = 'bg-red-100 text-red-700 border-red-200';
                                        statusLabel = 'ABNORMAL';
                                    } else if (status === 'normal') {
                                        badgeColor = 'bg-green-100 text-green-700 border-green-200';
                                        statusLabel = 'NORMAL';
                                    } else if (status === 'indeterminate') {
                                        badgeColor = 'bg-yellow-100 text-yellow-800 border-yellow-200';
                                        statusLabel = 'INDETERMINATE';
                                    } else if (status === 'post_procedural' || status === 'post-procedural') {
                                        badgeColor = 'bg-blue-100 text-blue-700 border-blue-200';
                                        statusLabel = 'POST-PROCEDURAL';
                                    }

                                    return (
                                        <div key={idx} className="pb-3 border-b border-border-primary/30 last:border-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-bold text-text-heading underline decoration-gray-300 underline-offset-4">
                                                    {finding.anatomical_region}
                                                </span>
                                                <span className={`text-[10px] px-2 py-0.5 rounded border font-bold uppercase tracking-wider ${badgeColor}`}>
                                                    {statusLabel}
                                                </span>
                                            </div>
                                            <p className="text-text-primary leading-relaxed">
                                                {finding.observation}
                                            </p>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>

                        {/* Impression */}
                        <section className="bg-blue-50/50 p-4 rounded-lg border border-blue-100/50">
                            <h3 className="text-sm font-bold text-blue-900 uppercase tracking-wider mb-2">Impression</h3>
                            <div className="space-y-2">
                                {report.impression.map((imp, idx) => (
                                    <p key={idx} className="text-text-heading font-medium leading-relaxed">{imp}</p>
                                ))}
                            </div>
                        </section>

                        {/* Urgency Level - Moved here per request */}
                        <div className="p-4 rounded-lg border border-border-primary bg-bg-panel/50">
                            <span className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1">Urgency Level</span>
                            <span className={`text-lg font-bold ${urgencyColor}`}>{report.urgency}</span>
                        </div>

                        {/* Recommendations */}
                        {report.recommendations && report.recommendations.length > 0 && (
                            <section>
                                <h3 className="text-sm font-bold text-text-muted uppercase tracking-wider mb-2">Recommendations</h3>
                                <ul className="list-disc list-inside space-y-1 text-text-primary">
                                    {report.recommendations.map((rec, idx) => (
                                        <li key={idx}>{rec}</li>
                                    ))}
                                </ul>
                            </section>
                        )}

                        {/* Footer Info */}
                        <div className="pt-8 border-t border-border-primary text-sm text-text-muted grid grid-cols-2 gap-4">
                            <div className="text-left">
                                <p>Prepared by: {footer.prepared_by}</p>
                                <p>{new Date(report.report_header.report_date).toLocaleDateString()}</p>
                                {footer.report_status === 'Rejected' && footer.rejection_reason && (
                                    <div className="mt-2 text-red-600 font-medium">
                                        Rejection Reason: {footer.rejection_reason}
                                    </div>
                                )}
                            </div>
                            {/* Approval Sig in Footer */}
                            {footer.report_status === 'Approved' && footer.approved_by && (
                                <div className="text-right">
                                    <p className="text-xs uppercase font-bold mb-2">Electronically Signed By</p>
                                    <p className="font-bold text-lg">{footer.approved_by}</p>
                                    {footer.signature && (
                                        <img src={footer.signature} alt="Signature" className="h-12 ml-auto opacity-80 mt-1 dark:invert" />
                                    )}
                                    <p className="text-xs mt-1">{new Date(footer.approved_at || "").toLocaleString()}</p>
                                </div>
                            )}
                        </div>

                        {/* Collaboration (Included at bottom for utility) */}
                        <div className="pt-8 border-t border-border-primary">
                            <h3 className="text-sm font-bold text-text-muted uppercase tracking-wider mb-4">Collaboration & Logs</h3>
                            <CollaborationPanel
                                comments={collaboration.comments}
                                logs={collaboration.logs}
                                onAddComment={handleAddComment}
                                currentUser={currentUser}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
