"use client";

import { Reference, ViewerAction } from "@/types/copilot";
import { FileText, MonitorDot, User } from "lucide-react";

interface ClickableReferenceProps {
    reference: Reference;
    onClick: (ref: Reference) => void;
}

export default function ClickableReference({ reference, onClick }: ClickableReferenceProps) {
    const iconMap: Record<string, React.ReactNode> = {
        report: <FileText size={12} />,
        study: <MonitorDot size={12} />,
        scan: <MonitorDot size={12} />,
        patient: <User size={12} />,
    };

    const colorMap: Record<string, string> = {
        report: "bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 border-blue-500/20",
        study: "bg-purple-500/15 text-purple-400 hover:bg-purple-500/25 border-purple-500/20",
        scan: "bg-purple-500/15 text-purple-400 hover:bg-purple-500/25 border-purple-500/20",
        patient: "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border-emerald-500/20",
    };

    return (
        <button
            onClick={() => onClick(reference)}
            className={`
                inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
                border cursor-pointer transition-all duration-150
                ${colorMap[reference.type] || colorMap.report}
            `}
            title={`Click to open: ${reference.label}`}
        >
            {iconMap[reference.type] || iconMap.report}
            <span>{reference.label}</span>
        </button>
    );
}
