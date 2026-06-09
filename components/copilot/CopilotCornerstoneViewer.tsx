"use client";

import {
    useEffect,
    useRef,
    useState,
    useImperativeHandle,
    forwardRef,
    useCallback,
} from "react";
import type { CopilotViewerRef, AnnotationAction, SegmentationAction } from "@/types/copilot-viewer";
import { formatAILabel, AI_ANNOTATION_DEFAULTS } from "@/lib/copilot/action-types";
import { MonitorDot } from "lucide-react";

interface CopilotCornerstoneViewerProps {
    images: string[];          // base64 image data URLs
    currentSlice?: number;
    onSliceChange?: (slice: number) => void;
}

// ── Internal annotation storage (canvas-rendered AI overlays) ────────────────
interface StoredAnnotation {
    id: string;
    type: AnnotationAction["action"];
    slice: number;
    label: string;
    color: string;
    confidence?: number;
    // geometry
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    center_x?: number;
    center_y?: number;
    radius?: number;
    start_x?: number;
    start_y?: number;
    end_x?: number;
    end_y?: number;
}

interface StoredSegmentation {
    id: string;
    slice: number;
    label: string;
    color: string;
    opacity: number;
    bbox?: [number, number, number, number];
    contour_points?: [number, number][];
}

const CopilotCornerstoneViewer = forwardRef<CopilotViewerRef, CopilotCornerstoneViewerProps>(
    function CopilotCornerstoneViewer({ images, currentSlice = 0, onSliceChange }, ref) {
        const canvasRef = useRef<HTMLCanvasElement>(null);
        const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
        const containerRef = useRef<HTMLDivElement>(null);

        const [sliceIndex, setSliceIndex] = useState(currentSlice);
        const [annotations, setAnnotations] = useState<StoredAnnotation[]>([]);
        const [segmentations, setSegmentations] = useState<StoredSegmentation[]>([]);
        const [loadedImage, setLoadedImage] = useState<HTMLImageElement | null>(null);
        const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

        // ── Viewport zoom/pan state ──────────────────────────────────────────
        const [viewportZoom, setViewportZoom] = useState(1);
        const [viewportPanX, setViewportPanX] = useState(0);
        const [viewportPanY, setViewportPanY] = useState(0);
        const isZoomed = viewportZoom > 1.05;

        // Sync external slice changes
        useEffect(() => {
            if (currentSlice >= 0 && currentSlice < images.length) {
                setSliceIndex(currentSlice);
            }
        }, [currentSlice, images.length]);

        // Observe container size
        useEffect(() => {
            const container = containerRef.current;
            if (!container) return;

            const observer = new ResizeObserver((entries) => {
                for (const entry of entries) {
                    setContainerSize({
                        width: entry.contentRect.width,
                        height: entry.contentRect.height,
                    });
                }
            });
            observer.observe(container);
            return () => observer.disconnect();
        }, []);

        // Load the current image
        useEffect(() => {
            if (!images[sliceIndex]) {
                setLoadedImage(null);
                return;
            }

            const img = new Image();
            img.onload = () => setLoadedImage(img);
            img.onerror = () => setLoadedImage(null);
            img.src = images[sliceIndex];
        }, [images, sliceIndex]);

        // Render the medical image on the main canvas
        useEffect(() => {
            const canvas = canvasRef.current;
            if (!canvas || !loadedImage || containerSize.width === 0) return;

            canvas.width = containerSize.width;
            canvas.height = containerSize.height;

            const ctx = canvas.getContext("2d");
            if (!ctx) return;

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = "#000";
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Fit image to canvas maintaining aspect ratio
            const imgW = loadedImage.naturalWidth;
            const imgH = loadedImage.naturalHeight;
            const scale = Math.min(canvas.width / imgW, canvas.height / imgH);
            const drawW = imgW * scale;
            const drawH = imgH * scale;
            const offsetX = (canvas.width - drawW) / 2;
            const offsetY = (canvas.height - drawH) / 2;

            // Apply slight brightness/contrast for medical imaging feel
            ctx.filter = "brightness(1.1) contrast(1.05)";
            ctx.drawImage(loadedImage, offsetX, offsetY, drawW, drawH);
            ctx.filter = "none";
        }, [loadedImage, containerSize]);

        // ── Coordinate mapping helper ────────────────────────────────────────
        const mapCoords = useCallback(
            (x: number, y: number): { x: number; y: number } | null => {
                if (!loadedImage || containerSize.width === 0) return null;
                const imgW = loadedImage.naturalWidth;
                const imgH = loadedImage.naturalHeight;
                const scale = Math.min(containerSize.width / imgW, containerSize.height / imgH);
                const offsetX = (containerSize.width - imgW * scale) / 2;
                const offsetY = (containerSize.height - imgH * scale) / 2;
                return { x: x * scale + offsetX, y: y * scale + offsetY };
            },
            [loadedImage, containerSize]
        );

        const mapSize = useCallback(
            (size: number): number => {
                if (!loadedImage || containerSize.width === 0) return size;
                const imgW = loadedImage.naturalWidth;
                const imgH = loadedImage.naturalHeight;
                const scale = Math.min(containerSize.width / imgW, containerSize.height / imgH);
                return size * scale;
            },
            [loadedImage, containerSize]
        );

        // Render AI overlay annotations and segmentations
        useEffect(() => {
            const overlay = overlayCanvasRef.current;
            if (!overlay || containerSize.width === 0) return;

            overlay.width = containerSize.width;
            overlay.height = containerSize.height;

            const ctx = overlay.getContext("2d");
            if (!ctx) return;

            ctx.clearRect(0, 0, overlay.width, overlay.height);

            // Draw segmentations for current slice
            const sliceSegs = segmentations.filter((s) => s.slice === sliceIndex);
            for (const seg of sliceSegs) {
                const hasContours = seg.contour_points && seg.contour_points.length > 1;

                if (seg.bbox && !hasContours) {
                    const tl = mapCoords(seg.bbox[0], seg.bbox[1]);
                    const br = mapCoords(seg.bbox[2], seg.bbox[3]);
                    if (tl && br) {
                        // Semi-transparent fill
                        ctx.fillStyle = hexToRgba(seg.color || AI_ANNOTATION_DEFAULTS.segmentationColor, seg.opacity || AI_ANNOTATION_DEFAULTS.segmentationOpacity);
                        ctx.fillRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
                        // Contour border
                        ctx.strokeStyle = seg.color || AI_ANNOTATION_DEFAULTS.contourColor;
                        ctx.lineWidth = AI_ANNOTATION_DEFAULTS.contourWidth;
                        ctx.setLineDash([6, 3]);
                        ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
                        ctx.setLineDash([]);
                    }
                }

                if (seg.contour_points && seg.contour_points.length > 1) {
                    const mapped = seg.contour_points.map(([px, py]) => mapCoords(px, py)).filter(Boolean) as { x: number; y: number }[];
                    if (mapped.length > 1) {
                        ctx.beginPath();
                        ctx.moveTo(mapped[0].x, mapped[0].y);
                        for (let i = 1; i < mapped.length; i++) {
                            ctx.lineTo(mapped[i].x, mapped[i].y);
                        }
                        ctx.closePath();
                        ctx.fillStyle = hexToRgba(seg.color || AI_ANNOTATION_DEFAULTS.segmentationColor, seg.opacity || AI_ANNOTATION_DEFAULTS.segmentationOpacity);
                        ctx.fill();
                        ctx.strokeStyle = seg.color || AI_ANNOTATION_DEFAULTS.contourColor;
                        ctx.lineWidth = AI_ANNOTATION_DEFAULTS.contourWidth;
                        ctx.stroke();
                    }
                }

                // Segmentation label
                if (seg.label && seg.bbox) {
                    const labelPos = mapCoords(seg.bbox[0], seg.bbox[1]);
                    if (labelPos) {
                        drawLabel(ctx, seg.label, labelPos.x, labelPos.y - 8);
                    }
                }
            }

            // Draw annotations for current slice
            const sliceAnns = annotations.filter((a) => a.slice === sliceIndex);
            for (const ann of sliceAnns) {
                const color = ann.color || AI_ANNOTATION_DEFAULTS.color;
                ctx.strokeStyle = color;
                ctx.lineWidth = 2;

                switch (ann.type) {
                    case "create_bounding_box_annotation":
                    case "create_rectangle_annotation": {
                        if (ann.x !== undefined && ann.y !== undefined && ann.width && ann.height) {
                            const tl = mapCoords(ann.x, ann.y);
                            const w = mapSize(ann.width);
                            const h = mapSize(ann.height);
                            if (tl) {
                                ctx.strokeRect(tl.x, tl.y, w, h);
                                drawLabel(ctx, formatAILabel(ann.label, ann.confidence), tl.x, tl.y - 8);
                            }
                        }
                        break;
                    }
                    case "create_circle_annotation": {
                        if (ann.center_x !== undefined && ann.center_y !== undefined && ann.radius) {
                            const center = mapCoords(ann.center_x, ann.center_y);
                            const r = mapSize(ann.radius);
                            if (center) {
                                ctx.beginPath();
                                ctx.arc(center.x, center.y, r, 0, Math.PI * 2);
                                ctx.stroke();
                                drawLabel(ctx, formatAILabel(ann.label, ann.confidence), center.x - r, center.y - r - 8);
                            }
                        }
                        break;
                    }
                    case "create_arrow_annotation": {
                        if (ann.start_x !== undefined && ann.start_y !== undefined && ann.end_x !== undefined && ann.end_y !== undefined) {
                            const start = mapCoords(ann.start_x, ann.start_y);
                            const end = mapCoords(ann.end_x, ann.end_y);
                            if (start && end) {
                                drawArrow(ctx, start.x, start.y, end.x, end.y, color);
                                drawLabel(ctx, formatAILabel(ann.label, ann.confidence), end.x + 8, end.y - 8);
                            }
                        }
                        break;
                    }
                    case "create_probe_annotation": {
                        if (ann.x !== undefined && ann.y !== undefined) {
                            const pos = mapCoords(ann.x, ann.y);
                            if (pos) {
                                ctx.beginPath();
                                ctx.arc(pos.x, pos.y, 4, 0, Math.PI * 2);
                                ctx.fillStyle = color;
                                ctx.fill();
                                drawLabel(ctx, formatAILabel(ann.label, ann.confidence), pos.x + 8, pos.y - 4);
                            }
                        }
                        break;
                    }
                }
            }
        }, [annotations, segmentations, sliceIndex, containerSize, mapCoords, mapSize, loadedImage]);

        // ── Imperative API exposed via ref ───────────────────────────────────
        useImperativeHandle(ref, () => ({
            jumpToSlice(slice: number) {
                const idx = Math.max(0, Math.min(slice, images.length - 1));
                setSliceIndex(idx);
                onSliceChange?.(idx);
            },

            addAnnotation(action: AnnotationAction) {
                const ann: StoredAnnotation = {
                    id: action.annotation_id || `ai_ann_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                    type: action.action,
                    slice: action.slice ?? sliceIndex,
                    label: action.label || "Finding",
                    color: action.color || AI_ANNOTATION_DEFAULTS.color,
                    confidence: action.confidence,
                    x: action.x,
                    y: action.y,
                    width: action.width,
                    height: action.height,
                    center_x: action.center_x,
                    center_y: action.center_y,
                    radius: action.radius,
                    start_x: action.start_x,
                    start_y: action.start_y,
                    end_x: action.end_x,
                    end_y: action.end_y,
                };
                setAnnotations((prev) => {
                    // Prevent duplicates when replaying actions
                    const existingIdx = prev.findIndex(a => a.id === ann.id);
                    if (existingIdx >= 0) {
                        const copy = [...prev];
                        copy[existingIdx] = ann;
                        return copy;
                    }
                    return [...prev, ann];
                });
            },

            addSegmentation(action: SegmentationAction) {
                if (action.action === "clear_ai_segmentations") {
                    setSegmentations([]);
                    return;
                }
                const seg: StoredSegmentation = {
                    id: action.segmentation_id || `ai_seg_${Date.now()}`,
                    slice: action.slice ?? sliceIndex,
                    label: action.label || "Segmentation",
                    color: action.color || AI_ANNOTATION_DEFAULTS.segmentationColor,
                    opacity: action.opacity ?? AI_ANNOTATION_DEFAULTS.segmentationOpacity,
                    bbox: action.bbox,
                    contour_points: action.contour_points,
                };
                setSegmentations((prev) => {
                    // Prevent duplicates when replaying actions
                    const existingIdx = prev.findIndex(s => s.id === seg.id);
                    if (existingIdx >= 0) {
                        const copy = [...prev];
                        copy[existingIdx] = seg;
                        return copy;
                    }
                    return [...prev, seg];
                });
            },

            clearAIFindings() {
                setAnnotations([]);
                setSegmentations([]);
            },

            zoomToRegion(x: number, y: number, w: number, h: number) {
                if (!loadedImage || containerSize.width === 0) return;

                const imgW = loadedImage.naturalWidth;
                const imgH = loadedImage.naturalHeight;
                const baseScale = Math.min(containerSize.width / imgW, containerSize.height / imgH);
                const offsetX = (containerSize.width - imgW * baseScale) / 2;
                const offsetY = (containerSize.height - imgH * baseScale) / 2;

                // Center of the region in image pixel coords
                const regionCenterX = x + w / 2;
                const regionCenterY = y + h / 2;

                // Map to canvas coords
                const canvasCX = regionCenterX * baseScale + offsetX;
                const canvasCY = regionCenterY * baseScale + offsetY;

                // Calculate zoom to fit the region with padding
                const regionScreenW = w * baseScale;
                const regionScreenH = h * baseScale;
                const zoomX = containerSize.width / (regionScreenW * 1.6);
                const zoomY = containerSize.height / (regionScreenH * 1.6);
                const zoom = Math.min(Math.max(Math.min(zoomX, zoomY), 1.5), 5);

                // Pan so the region center maps to container center
                const panX = containerSize.width / 2 - canvasCX * zoom;
                const panY = containerSize.height / 2 - canvasCY * zoom;

                setViewportZoom(zoom);
                setViewportPanX(panX);
                setViewportPanY(panY);
            },

            resetViewport() {
                setViewportZoom(1);
                setViewportPanX(0);
                setViewportPanY(0);
            },

            getCurrentSlice() {
                return sliceIndex;
            },

            getTotalSlices() {
                return images.length;
            },

            getCurrentImageBase64() {
                return images[sliceIndex] || null;
            },
        }), [sliceIndex, images, images.length, onSliceChange, loadedImage, containerSize]);

        // ── Empty State ──────────────────────────────────────────────────────
        if (images.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center h-full text-text-muted gap-4 p-8">
                    <MonitorDot size={48} className="opacity-30" />
                    <div className="text-center">
                        <p className="font-medium text-text-secondary">No DICOM Images</p>
                        <p className="text-sm mt-1">Ask the copilot to show a scan or select a report with images.</p>
                    </div>
                </div>
            );
        }

        const findingsCount = annotations.filter((a) => a.slice === sliceIndex).length +
            segmentations.filter((s) => s.slice === sliceIndex).length;

        return (
            <div className="flex flex-col h-full bg-black/90">
                {/* Image Canvas Area */}
                <div ref={containerRef} className="flex-1 relative overflow-hidden">
                    <canvas
                        ref={canvasRef}
                        className="absolute inset-0 w-full h-full"
                        style={{
                            transform: `translate(${viewportPanX}px, ${viewportPanY}px) scale(${viewportZoom})`,
                            transformOrigin: '0 0',
                            transition: 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                        }}
                    />
                    <canvas
                        ref={overlayCanvasRef}
                        className="absolute inset-0 w-full h-full pointer-events-none"
                        style={{
                            transform: `translate(${viewportPanX}px, ${viewportPanY}px) scale(${viewportZoom})`,
                            transformOrigin: '0 0',
                            transition: 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                        }}
                    />

                    {/* Reset Zoom button */}
                    {isZoomed && (
                        <button
                            onClick={() => { setViewportZoom(1); setViewportPanX(0); setViewportPanY(0); }}
                            className="absolute top-4 left-4 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-black/70 text-white hover:bg-black/90 backdrop-blur-sm border border-white/10 transition-all cursor-pointer"
                            title="Reset zoom to fit"
                        >
                            🔍 Reset Zoom
                        </button>
                    )}

                    {/* Slice indicator */}
                    {images.length > 1 && (
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 text-white text-sm px-4 py-1.5 rounded-full backdrop-blur-sm">
                            Slice {sliceIndex + 1} / {images.length}
                        </div>
                    )}

                    {/* AI Findings badge */}
                    {findingsCount > 0 && (
                        <div className="absolute top-4 right-4 flex items-center gap-2 bg-red-500/90 text-white text-xs px-3 py-1.5 rounded-full backdrop-blur-sm font-semibold shadow-lg">
                            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                            {findingsCount} AI Finding{findingsCount > 1 ? "s" : ""}
                        </div>
                    )}
                </div>

                {/* Slice Navigation */}
                {images.length > 1 && (
                    <div className="px-6 py-3 bg-bg-surface border-t border-border-primary flex items-center gap-4">
                        <span className="text-xs text-text-muted font-medium">SLICE</span>
                        <input
                            type="range"
                            min={0}
                            max={images.length - 1}
                            value={sliceIndex}
                            onChange={(e) => {
                                const idx = parseInt(e.target.value);
                                setSliceIndex(idx);
                                onSliceChange?.(idx);
                            }}
                            className="flex-1 h-1.5 bg-border-primary rounded-full appearance-none cursor-pointer accent-primary"
                        />
                        <span className="text-xs text-text-secondary font-mono w-12 text-right">
                            {sliceIndex + 1}/{images.length}
                        </span>
                    </div>
                )}
            </div>
        );
    }
);

// ── Canvas Drawing Helpers ───────────────────────────────────────────────────

function drawLabel(ctx: CanvasRenderingContext2D, text: string, x: number, y: number) {
    ctx.font = "bold 11px Inter, system-ui, sans-serif";
    const metrics = ctx.measureText(text);
    const padding = 4;
    const bgW = metrics.width + padding * 2;
    const bgH = 16;

    // Dark translucent background
    ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
    const radius = 4;
    ctx.beginPath();
    ctx.roundRect(x, y - bgH, bgW, bgH, radius);
    ctx.fill();

    // White text
    ctx.fillStyle = "#ffffff";
    ctx.textBaseline = "bottom";
    ctx.fillText(text, x + padding, y - 2);
}

function drawArrow(
    ctx: CanvasRenderingContext2D,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    color: string
) {
    const headLen = 10;
    const angle = Math.atan2(toY - fromY, toX - fromX);

    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(
        toX - headLen * Math.cos(angle - Math.PI / 6),
        toY - headLen * Math.sin(angle - Math.PI / 6)
    );
    ctx.lineTo(
        toX - headLen * Math.cos(angle + Math.PI / 6),
        toY - headLen * Math.sin(angle + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fill();
}

function hexToRgba(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default CopilotCornerstoneViewer;
