import React, { useState } from "react";
import { DicomStudy } from "@/types/pacs";
import { ChevronDown, ChevronRight, Loader2, Hospital } from "lucide-react";
import { PacsSeriesViewer } from "./PacsSeriesViewer";

interface PacsStudyTableProps {
    studies: DicomStudy[];
    isLoading: boolean;
}

export function PacsStudyTable({ studies, isLoading }: PacsStudyTableProps) {
    const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

    const toggleRow = (uid: string) => {
        setExpandedRows(prev => ({
            ...prev,
            [uid]: !prev[uid]
        }));
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 bg-bg-surface/50 rounded-2xl border border-border-primary">
                <Loader2 className="w-10 h-10 text-primary-main animate-spin" />
                <p className="mt-4 text-text-secondary font-medium">Querying PACS Server...</p>
            </div>
        );
    }

    if (studies.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 bg-bg-surface/50 rounded-2xl border border-border-primary text-center px-6">
                <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center mb-4">
                    <Hospital className="w-8 h-8 text-slate-400 dark:text-slate-500" />
                </div>
                <h3 className="text-xl font-bold text-text-heading mb-2">No Studies Found</h3>
                <p className="text-text-secondary max-w-sm">
                    Enter search criteria on the left to query the PACS server, or ensure your DICOMweb configuration is correct.
                </p>
            </div>
        );
    }

    return (
        <div className="rounded-xl border border-border-primary bg-bg-surface overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs uppercase bg-bg-panel text-text-secondary border-b border-border-primary">
                        <tr>
                            <th className="px-4 py-3 w-10"></th>
                            <th className="px-4 py-3 font-semibold">Patient Name</th>
                            <th className="px-4 py-3 font-semibold">Patient ID</th>
                            <th className="px-4 py-3 font-semibold">Study Date</th>
                            <th className="px-4 py-3 font-semibold">Modality</th>
                            <th className="px-4 py-3 font-semibold">Description</th>
                            <th className="px-4 py-3 font-semibold whitespace-nowrap text-right">Series / Instances</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border-card">
                        {studies.map((study) => (
                            <React.Fragment key={study.studyInstanceUid}>
                                <tr 
                                    className={`hover:bg-bg-panel/50 transition-colors cursor-pointer ${expandedRows[study.studyInstanceUid] ? 'bg-primary-main/5' : ''}`}
                                    onClick={() => toggleRow(study.studyInstanceUid)}
                                >
                                    <td className="px-4 py-4 text-center">
                                        <button className="text-text-muted hover:text-text-primary p-1 rounded-md transition-colors">
                                            {expandedRows[study.studyInstanceUid] ? (
                                                <ChevronDown size={18} />
                                            ) : (
                                                <ChevronRight size={18} />
                                            )}
                                        </button>
                                    </td>
                                    <td className="px-4 py-4 font-medium text-text-primary">
                                        {study.patientName}
                                    </td>
                                    <td className="px-4 py-4 text-text-secondary">
                                        {study.patientId}
                                    </td>
                                    <td className="px-4 py-4 text-text-secondary">
                                        {study.studyDate}
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-text-primary text-xs font-medium border border-border-card">
                                            {study.modalitiesInStudy.join(", ") || "-"}
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 text-text-secondary truncate max-w-[200px]" title={study.studyDescription}>
                                        {study.studyDescription}
                                    </td>
                                    <td className="px-4 py-4 text-right text-text-secondary">
                                        <span className="font-medium text-text-primary">{study.numberOfStudyRelatedSeries}</span> / {study.numberOfStudyRelatedInstances}
                                    </td>
                                </tr>
                                
                                {expandedRows[study.studyInstanceUid] && (
                                    <tr>
                                        <td colSpan={7} className="p-0 border-b border-border-primary bg-slate-50 dark:bg-black/20">
                                            <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                                                <PacsSeriesViewer study={study} />
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
