"use client"

import WorkspaceLayout from "@/components/copilot/WorkspaceLayout";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function CopilotContent() {
    const searchParams = useSearchParams();
    const patientId = searchParams.get("patientId") || undefined;
    const reportId = searchParams.get("reportId") || undefined;

    return (
        <WorkspaceLayout
            initialPatientId={patientId}
            initialReportId={reportId}
        />
    );
}

export default function CopilotPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center h-full">
                <div className="text-text-muted animate-pulse">Loading AI Copilot...</div>
            </div>
        }>
            <CopilotContent />
        </Suspense>
    );
}
