import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ImageViewer } from "@/components/dashboard/ImageViewer";
import { Loader2, X } from "lucide-react";
import { fetchRenderedJpegUrl } from "@/lib/pacs/dicomweb";

interface PacsImageViewerModalProps {
    studyUid: string;
    seriesUid: string;
    onClose: () => void;
}

export function PacsImageViewerModal({ studyUid, seriesUid, onClose }: PacsImageViewerModalProps) {
    const [images, setImages] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;
        const loadImages = async () => {
            setIsLoading(true);
            try {
                // Fetch instances for this series
                const instancesRes = await fetch(`/api/pacs/qido/instances?studyUid=${studyUid}&seriesUid=${seriesUid}`);
                if (!instancesRes.ok) throw new Error("Failed to fetch instances");
                const instancesData = await instancesRes.json();
                
                if (instancesData && instancesData.length > 0) {
                    // Build a list of all (instanceUid, frameNumber) pairs
                    // Multi-frame DICOM files have NumberOfFrames (0028,0008) > 1
                    const frameRequests: { uid: string; frame?: number }[] = [];
                    
                    for (const inst of instancesData) {
                        const uid = inst["00080018"]?.Value?.[0];
                        if (!uid) continue;
                        
                        const numFrames = parseInt(inst["00280008"]?.Value?.[0] || "1", 10);
                        
                        if (numFrames > 1) {
                            // Multi-frame instance: fetch each frame individually (1-indexed)
                            for (let f = 1; f <= numFrames; f++) {
                                frameRequests.push({ uid, frame: f });
                            }
                        } else {
                            // Single-frame instance
                            frameRequests.push({ uid });
                        }
                    }
                    
                    // Fetch rendered JPEGs for all frames
                    const urls = await Promise.all(frameRequests.map(async (req) => {
                        try {
                            return await fetchRenderedJpegUrl(studyUid, seriesUid, req.uid, req.frame);
                        } catch(e) {
                            return null;
                        }
                    }));
                    
                    if (isMounted) {
                        setImages(urls.filter(Boolean) as string[]);
                    }
                } else {
                    if (isMounted) setError("No images found in this series.");
                }
            } catch (err: any) {
                if (isMounted) setError(err.message || "Failed to load sequence.");
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };
        loadImages();
        
        return () => { isMounted = false; };
    }, [studyUid, seriesUid]);

    // Force ESC key to close modal entirely
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    if (isLoading) {
        return createPortal(
            <div className="fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center">
                <Loader2 className="w-10 h-10 animate-spin mb-4 text-primary" />
                <p>Loading frames from PACS...</p>
            </div>,
            document.body
        );
    }

    if (error) {
        return createPortal(
            <div className="fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center">
                <div className="text-red-500 text-center">
                    <p className="mb-4">{error}</p>
                    <button onClick={onClose} className="px-4 py-2 border border-red-500/50 rounded hover:bg-red-500/10 text-white">Back</button>
                </div>
            </div>,
            document.body
        );
    }

    if (images.length > 0) {
        return (
            <ImageViewer 
                images={images} 
                isCollapsed={false} 
                onToggleCollapse={() => {}} 
                forceFullscreen={true}
                onCloseFullscreen={onClose}
                className="hidden" // hide the inline embedded element, only show the fullscreen portal
            />
        );
    }

    return null;
}
