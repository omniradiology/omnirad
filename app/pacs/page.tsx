"use client"

import React, { useState, useEffect } from "react";
import { searchStudies } from "@/lib/pacs/dicomweb";
import { DicomStudy } from "@/types/pacs";
import { PacsSearchFilters } from "@/components/pacs/PacsSearchFilters";
import { PacsStudyTable } from "@/components/pacs/PacsStudyTable";
import { Server, AlertCircle } from "lucide-react";

export default function PacsBrowserPage() {
    const [studies, setStudies] = useState<DicomStudy[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Initial load: Fetch recent studies
    useEffect(() => {
        handleSearch({});
    }, []);

    const handleSearch = async (filters: Record<string, string>) => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await searchStudies(filters);
            setStudies(data);
        } catch (e: any) {
            console.error(e);
            setError(e.message || "Failed to search PACS");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="shrink-0 p-6 border-b border-border-primary bg-bg-surface/50">
                <div className="max-w-[1600px] mx-auto flex items-center gap-3">
                    <div className="p-2.5 bg-blue-500/10 rounded-xl">
                        <Server className="w-6 h-6 text-blue-500" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-text-heading">PACS Browser</h1>
                        <p className="text-sm text-text-muted mt-1">Search, view, and import DICOM studies from your connected server.</p>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left Sidebar: Filters */}
                <div className="w-[320px] shrink-0 border-r border-border-primary bg-bg-surface/30 overflow-y-auto">
                    <div className="p-6">
                        <PacsSearchFilters onSearch={handleSearch} isLoading={isLoading} />
                    </div>
                </div>

                {/* Right Area: Results */}
                <div className="flex-1 bg-bg-canvas overflow-y-auto p-6">
                    <div className="max-w-[1200px] mx-auto">
                        {error && (
                            <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-start gap-3">
                                <AlertCircle className="shrink-0 w-5 h-5 mt-0.5" />
                                <div>
                                    <h3 className="font-medium">Connection Error</h3>
                                    <p className="text-sm opacity-90 mt-1">{error}</p>
                                    <p className="text-sm opacity-90 mt-2">Check your PACS Settings to ensure the DICOMweb API is reachable.</p>
                                </div>
                            </div>
                        )}

                        <PacsStudyTable studies={studies} isLoading={isLoading} />
                    </div>
                </div>
            </div>
        </div>
    );
}
