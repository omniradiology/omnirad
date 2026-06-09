import React, { useEffect, useState } from "react";
import { searchSeries, fetchRenderedJpegUrl, fetchStudyMetadata } from "@/lib/pacs/dicomweb";
import { DicomSeries, DicomStudy } from "@/types/pacs";
import { Loader2, Send, Eye } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/basic";
import { PacsImageViewerModal } from "./PacsImageViewerModal";

interface PacsSeriesViewerProps {
    study: DicomStudy;
}

export function PacsSeriesViewer({ study }: PacsSeriesViewerProps) {
    const [series, setSeries] = useState<DicomSeries[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
    const [seriesImageCounts, setSeriesImageCounts] = useState<Record<string, number>>({});
    const [isSending, setIsSending] = useState(false);
    const [viewingSeriesUid, setViewingSeriesUid] = useState<string | null>(null);
    const router = useRouter();

    useEffect(() => {
        let isMounted = true;
        const loadSeries = async () => {
            try {
                const data = await searchSeries(study.studyInstanceUid);
                if (isMounted) setSeries(data);

                // Fetch a thumbnail for each series
                data.forEach(async (s) => {
                    if (s.numberOfSeriesRelatedInstances > 0) {
                        try {
                            // First get the real instance UIDs
                            const instancesRes = await fetch(`/api/pacs/qido/instances?studyUid=${study.studyInstanceUid}&seriesUid=${s.seriesInstanceUid}`);
                            const instancesData = await instancesRes.json();
                            
                            let firstInstanceUid = "";
                            if (instancesData && instancesData.length > 0) {
                                firstInstanceUid = instancesData[0]["00080018"]?.Value?.[0];
                            }
                            
                            if (firstInstanceUid) {
                                const url = await fetchRenderedJpegUrl(study.studyInstanceUid, s.seriesInstanceUid, firstInstanceUid);
                                
                                // Calculate total frames across all instances
                                // Multi-frame DICOM files have NumberOfFrames (0028,0008) > 1
                                let totalFrames = 0;
                                for (const inst of instancesData) {
                                    const numFrames = parseInt(inst["00280008"]?.Value?.[0] || "1", 10);
                                    totalFrames += numFrames;
                                }
                                
                                if (isMounted) {
                                    setThumbnails(prev => ({ ...prev, [s.seriesInstanceUid]: url }));
                                    setSeriesImageCounts(prev => ({ ...prev, [s.seriesInstanceUid]: totalFrames }));
                                }
                            }
                        } catch (e) {
                            console.error("Failed to load thumbnail for series", s.seriesInstanceUid);
                        }
                    }
                });
            } catch (e) {
                console.error("Failed to load series for study", study.studyInstanceUid);
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };
        loadSeries();
        return () => { isMounted = false; };
    }, [study.studyInstanceUid]);

    const handleSendToOmniRad = async (selectedSeries: DicomSeries) => {
        setIsSending(true);
        try {
            // Wait, we need the exact first instance UID of the series to fetch it for the report
            // So we fetch /instances for this series
            const instancesRes = await fetch(`/api/pacs/qido/instances?studyUid=${study.studyInstanceUid}&seriesUid=${selectedSeries.seriesInstanceUid}`);
            const instancesData = await instancesRes.json();
            
            let firstInstanceUid = "";
            if (instancesData && instancesData.length > 0) {
                firstInstanceUid = instancesData[0]["00080018"]?.Value?.[0]; // SOPInstanceUID
            }

            if (!firstInstanceUid) throw new Error("Could not find any instances in this series.");

            // Calculate age safely
            let ageNum = 0;
            if (study.patientAge) {
                const parsed = parseInt(study.patientAge.replace(/\D/g, ''), 10);
                if (!isNaN(parsed)) ageNum = parsed;
            } else if (study.patientBirthDate && study.patientBirthDate.length >= 8) {
                const year = parseInt(study.patientBirthDate.substring(0, 4), 10);
                if (!isNaN(year)) ageNum = new Date().getFullYear() - year;
            }

            // Combine descriptions for indication (matching exact behavior of local DICOM parser)
            const descParts = [];
            if (study.studyDescription && study.studyDescription !== "No Description") descParts.push(study.studyDescription);
            if (selectedSeries.seriesDescription && selectedSeries.seriesDescription !== "No Description") descParts.push(selectedSeries.seriesDescription);

            // Get metadata
            const metadata = {
                patientName: study.patientName,
                patientId: study.patientId,
                modality: selectedSeries.modality,
                studyDate: study.studyDate,
                indication: descParts.join(' - '),
                age: ageNum,
                gender: study.patientSex === 'F' ? 'F' : 'M',
                pacsStudyUid: study.studyInstanceUid,
                pacsSeriesUid: selectedSeries.seriesInstanceUid,
                firstInstanceUid: firstInstanceUid,
                pacsSource: "Orthanc"
            };

            // Store this temporarily in localStorage so the report generation form can pick it up
            localStorage.setItem("omnirad_pending_pacs_import", JSON.stringify(metadata));

            // Navigate to Dashboard Generate Report
            router.push('/?source=pacs');
        } catch (e: any) {
            alert(`Error preparing DICOM study: ${e.message}`);
        } finally {
            setIsSending(false);
        }
    };

    if (isLoading) {
        return <div className="p-8 flex items-center justify-center text-text-muted"><Loader2 className="animate-spin w-5 h-5 mr-2"/> Loading series...</div>;
    }

    if (series.length === 0) {
        return <div className="p-8 text-center text-text-muted">No series found for this study.</div>;
    }

    return (
        <div className="p-4 bg-bg-surface border-t border-border-primary rounded-b-lg">
            <h4 className="text-sm font-semibold mb-3 text-text-heading border-b border-border-primary pb-2">Series List</h4>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {series.map(s => (
                    <div key={s.seriesInstanceUid} className="border border-border-card bg-bg-panel rounded-lg overflow-hidden flex flex-col group relative">
                        <div className="aspect-square bg-slate-900 flex items-center justify-center overflow-hidden">
                            {thumbnails[s.seriesInstanceUid] ? (
                                <img src={thumbnails[s.seriesInstanceUid]} alt="Series Thumbnail" className="w-full h-full object-contain" />
                            ) : (
                                <span className="text-xs text-slate-500">No Img preview</span>
                            )}
                        </div>
                        <div className="p-3">
                            <div className="font-semibold text-sm truncate" title={s.seriesDescription}>{s.seriesDescription}</div>
                            <div className="text-xs text-text-muted mt-1">Modality: {s.modality}</div>
                            <div className="text-xs text-text-muted">Images: {seriesImageCounts[s.seriesInstanceUid] || s.numberOfSeriesRelatedInstances}</div>
                        </div>

                        {/* Hover Overlay */}
                        <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-4 gap-3">
                            <Button 
                                size="sm" 
                                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white gap-2 border-none shadow-lg"
                                onClick={(e) => { e.stopPropagation(); setViewingSeriesUid(s.seriesInstanceUid); }}
                                disabled={isSending}
                            >
                                <Eye size={14} /> View Slices
                            </Button>
                            <Button 
                                size="sm" 
                                className="w-full bg-primary-main hover:bg-primary-hover text-white gap-2 border-none shadow-lg"
                                onClick={(e) => { e.stopPropagation(); handleSendToOmniRad(s); }}
                                disabled={isSending}
                            >
                                <Send size={14} /> Send to AI
                            </Button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Fullscreen Viewer Modal */}
            {viewingSeriesUid && (
                <PacsImageViewerModal 
                    studyUid={study.studyInstanceUid}
                    seriesUid={viewingSeriesUid}
                    onClose={() => setViewingSeriesUid(null)}
                />
            )}
        </div>
    );
}
