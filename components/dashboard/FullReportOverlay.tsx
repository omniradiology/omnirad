import * as React from "react";
import { ReportData, Comment, AuditLog } from "@/types";
import { Button } from "@/components/ui/basic";
import { Download, Printer, Edit, XCircle, CheckCircle, ChevronUp, ChevronDown, X } from "lucide-react";
import { ImageViewer } from "@/components/dashboard/ImageViewer";
import { CollaborationPanel } from "@/components/dashboard/CollaborationPanel";
import { StandardTemplate, ModernTemplate, MinimalTemplate } from "@/components/dashboard/ReportTemplates";

interface FullReportOverlayProps {
    report: ReportData;
    onClose: () => void;
    onNewPatient: () => void;
    onPrint: () => void;
    onDownloadPDF: () => void;
    onEdit: () => void;
    onReject: () => void;
    onApprove: () => void;
    onUnreject: () => void;
    onAddComment: (text: string) => void;
    currentUser: { name: string; role: string };
    reportId?: string;
    imageSrc?: string | null;
    images?: string[];
}

export function FullReportOverlay({
    report,
    onClose,
    onNewPatient,
    onPrint,
    onDownloadPDF,
    onEdit,
    onReject,
    onApprove,
    onUnreject,
    onAddComment,
    currentUser,
    reportId,
    imageSrc,
    images = []
}: FullReportOverlayProps) {
    const [isImageCollapsed, setIsImageCollapsed] = React.useState(false);
    const [selectedTemplate, setSelectedTemplate] = React.useState<string>('standard');

    // Local state for collaboration to ensure immediate UI updates
    const [localComments, setLocalComments] = React.useState<Comment[]>(report.collaboration?.comments || []);
    const [localLogs, setLocalLogs] = React.useState<AuditLog[]>(report.collaboration?.logs || []);

    React.useEffect(() => {
        setLocalComments(report.collaboration?.comments || []);
        setLocalLogs(report.collaboration?.logs || []);

        // Load template preference
        fetch('/api/settings?type=appearance')
            .then(res => res.json())
            .then(config => {
                if (config.template) {
                    setSelectedTemplate(config.template);
                }
            })
            .catch(e => console.error("Error loading template preference:", e));
    }, [report.collaboration]);

    const handleLocalAddComment = (text: string) => {
        // Optimistic update
        const newComment: Comment = {
            id: Date.now().toString(),
            author: currentUser.name,
            role: currentUser.role,
            text,
            timestamp: new Date().toISOString()
        };
        const newLog: AuditLog = {
            id: Date.now().toString() + "_log",
            action: "Comment Added",
            user: currentUser.name,
            timestamp: new Date().toISOString(),
            details: text.substring(0, 50) + (text.length > 50 ? "..." : "")
        };
        setLocalComments(prev => [...prev, newComment]);
        setLocalLogs(prev => [...prev, newLog]);

        // Call parent handler (which updates backend)
        onAddComment(text);
    };

    const urgencyColor = report.urgency === 'Critical' ? 'text-red-600' :
        report.urgency === 'Urgent' ? 'text-orange-600' : 'text-green-600';

    const statusColor = report.report_footer.report_status === 'Approved' ? 'bg-green-100 text-green-800' :
        report.report_footer.report_status === 'Rejected' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800';

    // --- TEMPLATE RENDERERS ---

    const getSelectedTemplateId = () => {
        return selectedTemplate === 'modern' ? 'report-full-content-modern' :
            selectedTemplate === 'minimal' ? 'report-full-content-minimal' :
                'report-full-content-standard';
    };

    return (
        <div className="fixed inset-0 z-50 bg-bg-surface flex flex-col animate-in fade-in duration-200">
            {/* Global Header */}
            <div className="h-16 px-4 border-b border-border-primary bg-bg-panel flex items-center justify-between shrink-0 shadow-sm z-50">
                <div className="flex items-center gap-4">
                    <div className="flex flex-col">
                        <h1 className="text-xl font-bold text-text-heading">{report.patient.name}</h1>
                        <span className="text-xs text-text-muted">{report.study.modality} • {report.study.examination}</span>
                    </div>
                    <div className={`px-2 py-0.5 rounded-full ${statusColor} text-xs font-bold uppercase`}>
                        {report.report_footer.report_status}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className="h-8 w-px bg-border-primary mx-2" />

                    {report.report_footer.report_status === 'Pending' && (
                        <>
                            <Button
                                variant="danger"
                                size="sm"
                                onClick={onReject}
                                className="bg-red-100 text-red-700 hover:bg-red-200 border-red-200"
                            >
                                Reject
                            </Button>
                            <Button
                                variant="success"
                                size="sm"
                                onClick={onApprove}
                                className="bg-green-100 text-green-700 hover:bg-green-200 border-green-200"
                            >
                                Approve
                            </Button>
                            <Button variant="outline" size="sm" onClick={onEdit} className="text-blue-600 border-blue-200 hover:bg-blue-50">
                                Edit
                            </Button>
                        </>
                    )}

                    {report.report_footer.report_status === 'Rejected' && (
                        <Button
                            variant="danger"
                            size="sm"
                            onClick={onUnreject}
                            className="bg-red-600 text-white hover:bg-red-700 border-red-600"
                            title="Click to Unreject"
                        >
                            Rejected
                        </Button>
                    )}

                    {report.report_footer.report_status === 'Approved' && (
                        <Button
                            variant="success"
                            size="sm"
                            className="bg-green-600 text-white hover:bg-green-700 border-green-600 cursor-default"
                        >
                            Approved
                        </Button>
                    )}

                    <div className="h-8 w-px bg-border-primary mx-2" />

                    <Button
                        variant="outline"
                        size="icon"
                        onClick={onPrint}
                        title="Print"
                        className="transition-all hover:bg-blue-50 hover:text-blue-600 hover:scale-105 active:scale-95"
                    >
                        <Printer size={18} />
                    </Button>
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={onDownloadPDF}
                        title="Download PDF"
                        className="transition-all hover:bg-blue-50 hover:text-blue-600 hover:scale-105 active:scale-95"
                    >
                        <Download size={18} />
                    </Button>

                    <div className="h-8 w-px bg-border-primary mx-2" />

                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onClose}
                        className="hover:bg-red-100 hover:text-red-600 transition-all hover:rotate-90 active:scale-90"
                    >
                        <X size={24} />
                    </Button>
                </div>
            </div>

            {/* Top Section: Collapsible Image Viewer */}
            <div className={`relative transition-all duration-300 ease-in-out border-b border-border-primary bg-black ${isImageCollapsed ? 'h-[0px] border-b-0' : 'h-[45vh]'} shrink-0 group`}>
                <div className={`absolute top-0 left-0 w-full h-full ${isImageCollapsed ? 'invisible' : 'visible'}`}>
                    <ImageViewer
                        imageSrc={imageSrc || report.image_data || null}
                        images={
                            images.length > 0 ? images :
                            report.images_data && report.images_data.length > 0 ? report.images_data :
                            report.image_data ? [report.image_data] : []
                        }
                        className="w-full h-full"
                        isCollapsed={isImageCollapsed}
                        onToggleCollapse={() => { }}
                    />
                </div>

                {/* Redesigned Collapse/Expand Toggle - Floating Pill */}
                <div className={`absolute ${isImageCollapsed ? '-bottom-8' : 'bottom-4'} left-1/2 -translate-x-1/2 z-50 transition-all duration-300`}>
                    <button
                        onClick={() => setIsImageCollapsed(!isImageCollapsed)}
                        className="flex items-center gap-2 bg-bg-panel/90 backdrop-blur border border-border-primary px-4 py-1.5 rounded-full shadow-lg text-xs font-semibold text-text-primary hover:bg-bg-panel transition-all transform hover:scale-105"
                    >
                        {isImageCollapsed ? (
                            <>
                                <ChevronDown size={14} /> Show Image Viewer
                            </>
                        ) : (
                            <>
                                <ChevronUp size={14} /> Hide Image Viewer
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Bottom Section: Split Pane */}
            <div className="flex-1 overflow-hidden flex flex-row">
                {/* Left Column: Collaboration (30%) */}
                <div className="w-[30%] min-w-[300px] border-r border-border-primary bg-bg-panel/50 flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-border-primary bg-bg-surface">
                        <h3 className="font-bold text-text-heading">Collaboration & Audit</h3>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4">
                        <CollaborationPanel
                            comments={localComments}
                            logs={localLogs}
                            onAddComment={handleLocalAddComment}
                            currentUser={currentUser}
                        />
                    </div>
                </div>

                {/* Right Column: Report (70%) */}
                <div className="flex-1 bg-gray-100 overflow-y-auto p-8 relative">
                    {/* Render selected template */}
                    <div className="animate-in fade-in duration-300">
                        {selectedTemplate === 'modern' ? <ModernTemplate report={report} /> :
                            selectedTemplate === 'minimal' ? <MinimalTemplate report={report} /> :
                                <StandardTemplate report={report} />}
                    </div>
                </div>
            </div>
        </div>
    );
}
