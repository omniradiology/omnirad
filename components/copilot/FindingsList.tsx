"use client";

import type { FindingSummary, CopilotViewerRef } from "@/types/copilot-viewer";
import { Target, Trash2, Crosshair, X } from "lucide-react";

interface FindingsListProps {
    findings: FindingSummary[];
    viewerRef: CopilotViewerRef | null;
    onClearAll: () => void;
}

export default function FindingsList({ findings, viewerRef, onClearAll }: FindingsListProps) {
    if (findings.length === 0) return null;

    const handleFocusFinding = (finding: FindingSummary) => {
        if (!viewerRef) return;
        if (finding.slice !== undefined) {
            viewerRef.jumpToSlice(finding.slice);
        }
    };

    return (
        <div className="border-t border-border-primary bg-bg-surface shrink-0">
            {/* Header */}
            <div className="px-4 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-text-muted uppercase tracking-wider">
                    <Target size={14} className="text-red-400" />
                    AI Findings
                    <span className="bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full text-[10px] font-bold">
                        {findings.length}
                    </span>
                </div>
                <button
                    onClick={onClearAll}
                    className="flex items-center gap-1 text-[10px] font-medium text-text-muted hover:text-red-400 transition-colors px-2 py-1 rounded-md hover:bg-red-500/10"
                    title="Clear all AI findings"
                >
                    <Trash2 size={11} />
                    CLEAR
                </button>
            </div>

            {/* Findings List */}
            <div className="px-2 pb-2 space-y-0.5 max-h-[140px] overflow-auto">
                {findings.map((finding, idx) => (
                    <button
                        key={finding.annotation_id || idx}
                        onClick={() => handleFocusFinding(finding)}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-left
                            text-text-primary hover:bg-red-500/5 hover:border-red-500/20
                            transition-all duration-150 group border border-transparent"
                    >
                        <Crosshair size={14} className="shrink-0 text-red-400 group-hover:scale-110 transition-transform" />
                        <div className="flex-1 min-w-0">
                            <div className="truncate font-medium text-text-heading text-[13px]">
                                {finding.name}
                            </div>
                            {finding.confidence !== undefined && finding.confidence > 0 && (
                                <div className="text-[11px] text-text-muted">
                                    {Math.round(finding.confidence * 100)}% confidence
                                    {finding.slice !== undefined && ` · Slice ${finding.slice + 1}`}
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-1">
                            <span className="text-[9px] font-bold text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">
                                AI
                            </span>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}
