"use client";

import React from "react";
import { ReportData } from "@/types";
import { Calendar, FileText, CheckCircle, Clock, XCircle, Download, ExternalLink, Stethoscope, Activity, ClipboardList } from "lucide-react";
import Link from "next/link";

export function PatientTimeline({ reports }: { reports: any[] }) {
    if (!reports || reports.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-zinc-800 rounded-xl bg-zinc-900/20">
                <div className="w-16 h-16 rounded-full bg-zinc-800/50 flex items-center justify-center text-zinc-500 mb-4">
                    <FileText className="w-8 h-8 opacity-50" />
                </div>
                <h3 className="text-lg font-medium text-zinc-300">No Reports Yet</h3>
                <p className="text-zinc-500 mt-2 max-w-sm">This patient does not have any generated reports. Return to the dashboard to generate one.</p>
            </div>
        );
    }

    // Group by month
    const grouped = reports.reduce((acc: any, report) => {
        const date = new Date(report.createdAt || report.created_at || Date.now());
        const month = date.toLocaleString('default', { month: 'long', year: 'numeric' });
        if (!acc[month]) acc[month] = [];
        acc[month].push(report);
        return acc;
    }, {});

    const getStatusIcon = (status: string) => {
        const s = (status || "").toUpperCase();
        if (s === 'APPROVED' || s === 'FINAL') return <CheckCircle className="w-4 h-4 text-emerald-500" />;
        if (s === 'REJECTED') return <XCircle className="w-4 h-4 text-red-500" />;
        return <Clock className="w-4 h-4 text-yellow-500" />;
    };

    return (
        <div className="relative pl-4 md:pl-0">
            {/* Timeline Spine */}
            <div className="absolute left-4 md:left-[120px] top-0 bottom-0 w-px bg-zinc-800 hidden md:block" />

            {Object.keys(grouped).map((month, mIdx) => (
                <div key={month} className="mb-12 relative animate-in fade-in slide-in-from-bottom-4" style={{ animationDelay: `${mIdx * 100}ms` }}>
                    <div className="sticky top-4 z-10 w-max bg-bg-primary/95 backdrop-blur-sm md:ml-[56px] px-3 py-1.5 rounded-full border border-zinc-800/80 mb-6 text-sm font-semibold text-zinc-400 flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-zinc-500" />
                        {month}
                    </div>

                    <div className="space-y-6">
                        {grouped[month].map((report: any, idx: number) => {
                            const data = typeof report.reportData === 'string' ? JSON.parse(report.reportData) : (report.reportData || report.report_data);
                            const date = new Date(report.createdAt || report.created_at);
                            const status = data.report_footer?.report_status || report.reportStatus || 'Pending';
                            const modality = report.modality || data.study?.modality || "Imaging";
                            const urgency = data.urgency || report.urgency || "Routine";
                            const indication = data.clinical_information?.indication || "";

                            return (
                                <div key={report.id} className="relative flex flex-col md:flex-row gap-4 md:gap-8 group">
                                    {/* Date Left Column */}
                                    <div className="md:w-[100px] shrink-0 text-left md:text-right pt-2 hidden md:block">
                                        <div className="text-sm font-medium text-zinc-300">{date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</div>
                                        <div className="text-xs text-zinc-500">{date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</div>
                                    </div>

                                    {/* Timeline Node */}
                                    <div className="absolute left-0 md:left-[120px] top-4 w-2.5 h-2.5 rounded-full bg-zinc-700 border-2 border-bg-primary -translate-x-[5px] group-hover:bg-indigo-500 group-hover:scale-125 transition-all shadow-sm hidden md:block" />

                                    {/* Event Card */}
                                    <div className="flex-1 bg-zinc-900 border border-zinc-800/80 rounded-xl p-5 hover:bg-zinc-800/40 hover:border-zinc-700 transition-all ml-4 md:ml-0 shadow-sm relative overflow-hidden">
                                        <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500/50" />
                                        <div className="md:hidden mb-2 pb-2 border-b border-zinc-800/50 flex justify-between">
                                            <span className="text-xs text-zinc-400">{date.toLocaleString()}</span>
                                        </div>

                                        <div className="flex justify-between items-start gap-4 mb-3">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="px-2.5 py-1 rounded text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                                    {modality}
                                                </span>
                                                <span className="px-2.5 py-1 rounded text-xs font-medium bg-zinc-950 border border-zinc-800 flex items-center gap-1.5 shadow-xs">
                                                    {getStatusIcon(status)}
                                                    {status}
                                                </span>
                                                {urgency && urgency !== 'Routine' && (
                                                    <span className={`px-2.5 py-1 rounded text-xs font-semibold border ${
                                                        urgency.toUpperCase() === 'STAT' || urgency.toUpperCase() === 'EMERGENCY'
                                                            ? 'bg-red-500/10 text-red-400 border-red-500/20'
                                                            : urgency.toUpperCase() === 'URGENT'
                                                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                                                : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                                                    }`}>
                                                        {urgency}
                                                    </span>
                                                )}
                                            </div>
                                            <Link href={`/reports?id=${report.id}`} className="text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 p-1.5 rounded-lg transition-colors shrink-0" title="View Full Report">
                                                <ExternalLink className="w-4 h-4" />
                                            </Link>
                                        </div>

                                        {/* Metadata Row: Modality, Urgency */}
                                        <div className="flex flex-wrap gap-x-6 gap-y-1 mt-1 mb-4">
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">Modality:</span>
                                                <span className="text-sm text-zinc-200 font-medium">{data.study?.modality || modality}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">Urgency:</span>
                                                <span className={`text-sm font-medium ${
                                                    urgency.toUpperCase() === 'STAT' || urgency.toUpperCase() === 'EMERGENCY' || urgency.toUpperCase() === 'CRITICAL' ? 'text-red-400' :
                                                    urgency.toUpperCase() === 'URGENT' || urgency.toUpperCase() === 'ASAP' ? 'text-amber-400' : 
                                                    urgency.toUpperCase() === 'ROUTINE' || urgency.toUpperCase() === 'NORMAL' ? 'text-emerald-400' :
                                                    'text-zinc-300'
                                                }`}>{urgency}</span>
                                            </div>
                                        </div>

                                        {/* Indication */}
                                        {indication && (
                                            <div className="mb-4">
                                                <div className="flex items-center gap-1.5 mb-1 text-zinc-400">
                                                    <Stethoscope className="w-3.5 h-3.5 opacity-80" />
                                                    <p className="text-[11px] font-bold uppercase tracking-widest">Indication</p>
                                                </div>
                                                <p className="text-sm text-zinc-300 leading-relaxed">{indication}</p>
                                            </div>
                                        )}

                                        {/* Impression */}
                                        <div className="space-y-2 mt-4">
                                            {data.impression && data.impression.length > 0 && (
                                                <div>
                                                    <div className="flex items-center gap-1.5 mb-1 text-indigo-400/90">
                                                        <ClipboardList className="w-3.5 h-3.5" />
                                                        <p className="text-[11px] font-bold uppercase tracking-widest">Impression</p>
                                                    </div>
                                                    <p className="text-sm text-zinc-200 leading-relaxed">
                                                        {Array.isArray(data.impression) ? data.impression.join(". ") : data.impression}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
}
