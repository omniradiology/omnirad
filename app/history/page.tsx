"use client"

import * as React from "react"
import { getReports } from "@/lib/api";
import { ReportData } from "@/types";
import { Button } from "@/components/ui/basic";
import { Badge } from "@/components/ui/badge";
import { FileText, Calendar, User, Clock, ChevronRight, Search, Filter, Database } from "lucide-react";
import { ReportView } from "@/components/dashboard/ReportView";

export default function HistoryPage() {
    const [reports, setReports] = React.useState<any[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [selectedReportId, setSelectedReportId] = React.useState<string | null>(null);
    const [searchQuery, setSearchQuery] = React.useState("");
    const [sourceFilter, setSourceFilter] = React.useState<string>("Local SQLite");
    React.useEffect(() => {
        loadReports();
    }, []);

    const loadReports = async () => {
        setLoading(true);
        try {
            const allReports = await getReports();

            // Sort by Date DESC (Newest First)
            allReports.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

            setReports(allReports || []);
        } catch (err) {
            console.error("Error loading reports:", err);
            setReports([]);
        } finally {
            setLoading(false);
        }
    };

    // Filter reports based on search and source
    const filteredReports = reports.filter(report => {
        const reportData = report.report_data;
        if (!reportData) return false;

        // Search filter
        const matchesSearch = searchQuery === "" ||
            reportData.patient?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            reportData.study?.examination?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            reportData.study?.modality?.toLowerCase().includes(searchQuery.toLowerCase());

        // Source filter
        let matchesSource = false;
        if (sourceFilter === "Local SQLite") {
            // Include 'Local' and 'Synced' (since Synced means it's available locally too)
            matchesSource = report._source === 'Local' || report._source === 'Synced';
        } else if (sourceFilter === "Supabase Cloud") {
            // Include 'Supabase' and 'Synced' (since Synced means it's available in cloud too)
            matchesSource = report._source === 'Supabase' || report._source === 'Synced';
        }

        return matchesSearch && matchesSource;
    });

    const selectedReportObj = reports.find(r => r.id === selectedReportId);

    if (selectedReportObj) {
        return (
            <div className="h-full flex flex-col p-4 bg-bg-primary overflow-hidden">
                <Button variant="ghost" onClick={() => setSelectedReportId(null)} className="mb-2 self-start gap-2 text-text-secondary hover:text-text-primary">
                    ← Back to History
                </Button>
                <div className="flex-1 overflow-hidden rounded-xl border border-border-primary bg-bg-surface shadow-sm">
                    <ReportView
                        report={selectedReportObj.report_data}
                        onNewPatient={() => setSelectedReportId(null)}
                        reportId={selectedReportObj.id}
                        onStatusChange={loadReports}
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 h-full flex flex-col gap-6 overflow-hidden bg-bg-primary text-text-primary font-sans">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-text-heading tracking-tight">Report History</h2>
                    <p className="text-text-secondary text-sm">Manage and view your generated radiology reports.</p>
                </div>
            </div>

            {/* Controls Bar */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted group-focus-within:text-primary-main transition-colors" />
                    <input
                        type="text"
                        placeholder="Search patient, modality, or exam..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-bg-surface border border-border-primary rounded-lg text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary-main/20 focus:border-primary-main transition-all shadow-sm"
                    />
                </div>
                <div className="relative w-full md:w-56">
                    <Database className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                    <select
                        value={sourceFilter}
                        onChange={(e) => setSourceFilter(e.target.value)}
                        className="w-full pl-10 pr-8 py-2.5 bg-bg-surface border border-border-primary rounded-lg text-sm text-text-primary appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-main/20 focus:border-primary-main shadow-sm"
                    >
                        <option value="Local SQLite">Local SQLite</option>
                        <option value="Supabase Cloud">Supabase Cloud</option>
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                        <svg className="w-4 h-4 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                    </div>
                </div>
            </div>

            {/* Table Section */}
            <div className="flex-1 overflow-hidden bg-bg-surface rounded-xl border border-border-primary shadow-sm flex flex-col">
                {/* Table Header */}
                <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-bg-panel border-b border-border-primary text-xs font-semibold text-text-muted uppercase tracking-wider">
                    <div className="col-span-3">Patient</div>
                    <div className="col-span-3">Examination</div>
                    <div className="col-span-2">Date & Time</div>
                    <div className="col-span-2">Urgency</div>
                    <div className="col-span-2 text-right">Status & Source</div>
                </div>

                {/* Table Body */}
                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-48 gap-3 text-text-muted">
                            <div className="w-6 h-6 border-2 border-primary-main border-t-transparent rounded-full animate-spin" />
                            <p className="text-sm">Loading reports...</p>
                        </div>
                    ) : filteredReports.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
                            <div className="p-4 bg-bg-panel rounded-full">
                                <FileText className="w-8 h-8 text-text-muted" />
                            </div>
                            <div>
                                <h3 className="text-base font-medium text-text-heading">No reports found</h3>
                                <p className="text-sm text-text-secondary mt-1">
                                    {searchQuery || sourceFilter !== "Local SQLite" ? "Try adjusting your filters" : "Generate a new report to get started"}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="divide-y divide-border-primary/50">
                            {filteredReports.map((report) => {
                                const reportData = report.report_data;
                                const status = reportData?.report_footer?.report_status || 'Pending';
                                const urgency = reportData.urgency || 'Routine';
                                const source = report._source || 'Local';

                                return (
                                    <div
                                        key={report.id}
                                        onClick={() => setSelectedReportId(report.id)}
                                        className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-bg-panel/50 transition-colors cursor-pointer group"
                                    >
                                        {/* Patient Column (3) */}
                                        <div className="col-span-3">
                                            <div className="font-medium text-text-heading text-sm group-hover:text-primary-main transition-colors">
                                                {reportData.patient?.name || report.patient_name || "Unknown Patient"}
                                            </div>
                                            <div className="flex items-center gap-1.5 mt-1 text-xs text-text-secondary">
                                                <User size={12} />
                                                <span>{reportData.patient.age}y</span>
                                                <span className="w-0.5 h-0.5 bg-text-muted rounded-full" />
                                                <span>{reportData.patient.gender}</span>
                                            </div>
                                        </div>

                                        {/* Exam Column (3) */}
                                        <div className="col-span-3">
                                            <div className="font-medium text-text-primary text-sm flex items-center gap-2">
                                                {reportData.study.modality}
                                            </div>
                                            <div className="text-xs text-text-secondary mt-1 truncate pr-4" title={reportData.study.examination}>
                                                {reportData.study.examination}
                                            </div>
                                        </div>

                                        {/* Date Column (2) */}
                                        <div className="col-span-2">
                                            <div className="flex items-center gap-1.5 text-sm text-text-primary">
                                                <Calendar size={12} className="text-text-muted" />
                                                {new Date(report.created_at).toLocaleDateString()}
                                            </div>
                                            <div className="flex items-center gap-1.5 mt-1 text-xs text-text-secondary">
                                                <Clock size={12} />
                                                {new Date(report.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>

                                        {/* Urgency Column (2) */}
                                        <div className="col-span-2">
                                            <Badge
                                                variant="outline"
                                                className={`
                                                    text-[10px] font-bold uppercase tracking-wider border px-2 py-0.5
                                                    ${urgency === 'Critical' ? 'bg-red-600 text-white border-transparent' :
                                                        urgency === 'Urgent' ? 'bg-orange-500 text-white border-transparent' :
                                                            'bg-green-600 text-white border-transparent'}
                                                `}
                                            >
                                                {urgency}
                                            </Badge>
                                        </div>

                                        {/* Status & Source Column (2) */}
                                        <div className="col-span-2 flex flex-col items-end justify-center gap-1.5">
                                            <Badge
                                                variant="outline"
                                                className={`
                                                    text-[10px] font-bold uppercase tracking-wider border px-2 py-0.5
                                                    ${status === 'Approved' ? 'bg-green-50 text-green-700 border-green-200' :
                                                        status === 'Rejected' ? 'bg-red-50 text-red-700 border-red-200' :
                                                            'bg-gray-50 text-gray-600 border-gray-200'}
                                                `}
                                            >
                                                {status}
                                            </Badge>
                                            
                                            <div className="flex items-center gap-1 text-[9px] font-semibold tracking-wider text-text-muted">
                                                <Database size={10} />
                                                {source.toUpperCase()}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
