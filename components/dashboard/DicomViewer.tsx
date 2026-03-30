"use client";

import React, { useEffect, useRef, useImperativeHandle, forwardRef, useState, useCallback } from 'react';
import * as dicomParser from 'dicom-parser';

export interface DicomViewerHandle {
    captureFrame: () => Promise<string | null>;
    captureMultipleFrames: (maxSlices?: number) => Promise<string[]>;
    getTotalFrames: () => number;
}

interface DicomViewerProps {
    file: File;
    className?: string;
    onReady?: () => void;
}

interface FrameData {
    values: Float32Array;
}

interface PixelInfo {
    rows: number;
    columns: number;
    minPixel: number;
    maxPixel: number;
    defaultWC: number;
    defaultWW: number;
    isMonochrome1: boolean;
    frames: FrameData[];
    isRGB: boolean;
    rgbFrames?: Uint8Array[];
}

// Helper: render a specific frame to an offscreen canvas and return JPEG base64
function renderFrameToCanvas(
    pi: PixelInfo, frameIdx: number, wc: number, ww: number
): string | null {
    const offscreen = document.createElement('canvas');
    offscreen.width = pi.columns;
    offscreen.height = pi.rows;
    const ctx = offscreen.getContext('2d');
    if (!ctx) return null;

    const imageData = ctx.createImageData(pi.columns, pi.rows);
    const data = imageData.data;

    if (pi.isRGB && pi.rgbFrames) {
        const rgb = pi.rgbFrames[frameIdx];
        for (let i = 0; i < pi.rows * pi.columns; i++) {
            data[i * 4]     = rgb[i * 3];
            data[i * 4 + 1] = rgb[i * 3 + 1];
            data[i * 4 + 2] = rgb[i * 3 + 2];
            data[i * 4 + 3] = 255;
        }
    } else {
        const frame = pi.frames[frameIdx];
        if (!frame) return null;
        const vals = frame.values;
        const lower = wc - 0.5 - (ww - 1) / 2;
        const upper = wc - 0.5 + (ww - 1) / 2;
        const range = upper - lower;

        for (let i = 0; i < vals.length; i++) {
            let lum: number;
            if (vals[i] <= lower) lum = 0;
            else if (vals[i] >= upper) lum = 255;
            else lum = ((vals[i] - lower) / range) * 255;
            if (pi.isMonochrome1) lum = 255 - lum;
            data[i * 4] = lum;
            data[i * 4 + 1] = lum;
            data[i * 4 + 2] = lum;
            data[i * 4 + 3] = 255;
        }
    }

    ctx.putImageData(imageData, 0, 0);
    return offscreen.toDataURL('image/jpeg', 0.85);
}

export const DicomViewer = forwardRef<DicomViewerHandle, DicomViewerProps>(({ file, className, onReady }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const pixelInfoRef = useRef<PixelInfo | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    // View state
    const windowCenterRef = useRef(0);
    const windowWidthRef = useRef(0);
    const [windowCenter, setWindowCenter] = useState(0);
    const [windowWidth, setWindowWidth] = useState(0);
    const [zoom, setZoom] = useState(1);
    const [panX, setPanX] = useState(0);
    const [panY, setPanY] = useState(0);
    const [currentFrame, setCurrentFrame] = useState(0);
    const [totalFrames, setTotalFrames] = useState(1);
    const isDraggingRef = useRef(false);
    const dragButtonRef = useRef(0);
    const lastPosRef = useRef({ x: 0, y: 0 });

    // Keep refs in sync with state for imperative access
    useEffect(() => { windowCenterRef.current = windowCenter; }, [windowCenter]);
    useEffect(() => { windowWidthRef.current = windowWidth; }, [windowWidth]);

    useImperativeHandle(ref, () => ({
        captureFrame: async () => {
            if (canvasRef.current) {
                return canvasRef.current.toDataURL('image/jpeg', 0.92);
            }
            return null;
        },

        // Capture up to maxSlices evenly-spaced frames as JPEG base64 strings
        captureMultipleFrames: async (maxSlices: number = 5): Promise<string[]> => {
            const pi = pixelInfoRef.current;
            if (!pi) return [];

            const total = pi.isRGB ? (pi.rgbFrames?.length || 0) : pi.frames.length;
            if (total <= 1) {
                // Single frame — just capture the current canvas
                if (canvasRef.current) return [canvasRef.current.toDataURL('image/jpeg', 0.85)];
                return [];
            }

            // Pick evenly-spaced frame indices
            const count = Math.min(maxSlices, total);
            const indices: number[] = [];
            for (let i = 0; i < count; i++) {
                indices.push(Math.round((i / (count - 1)) * (total - 1)));
            }

            const results: string[] = [];
            const wc = windowCenterRef.current;
            const ww = windowWidthRef.current;

            for (const idx of indices) {
                const jpeg = renderFrameToCanvas(pi, idx, wc, ww);
                if (jpeg) results.push(jpeg);
            }
            return results;
        },

        getTotalFrames: () => {
            const pi = pixelInfoRef.current;
            if (!pi) return 1;
            return pi.isRGB ? (pi.rgbFrames?.length || 1) : pi.frames.length;
        }
    }));

    // Parse DICOM pixel data
    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);
        setCurrentFrame(0);

        (async () => {
            try {
                const arrayBuffer = await file.arrayBuffer();
                const byteArray = new Uint8Array(arrayBuffer);
                const dataSet = dicomParser.parseDicom(byteArray);

                const rows = dataSet.uint16('x00280010');
                const columns = dataSet.uint16('x00280011');
                const bitsAllocated = dataSet.uint16('x00280100') || 16;
                const bitsStored = dataSet.uint16('x00280101') || bitsAllocated;
                const pixelRepresentation = dataSet.uint16('x00280103') || 0;
                const samplesPerPixel = dataSet.uint16('x00280002') || 1;
                const photometricInterpretation = dataSet.string('x00280004')?.trim() || '';

                // Rescale Slope & Intercept (critical for CT Hounsfield units & MR display)
                const rescaleSlope = dataSet.string('x00281053') ? parseFloat(dataSet.string('x00281053')!) : 1;
                const rescaleIntercept = dataSet.string('x00281052') ? parseFloat(dataSet.string('x00281052')!) : 0;

                // Window Center / Width (may have multiple values, take first)
                let wcStr = dataSet.string('x00281050');
                let wwStr = dataSet.string('x00281051');
                let wc = wcStr ? parseFloat(wcStr.split('\\')[0]) : undefined;
                let ww = wwStr ? parseFloat(wwStr.split('\\')[0]) : undefined;

                // Number of frames
                const numFramesStr = dataSet.string('x00280008');
                const numFrames = numFramesStr ? parseInt(numFramesStr.trim(), 10) : 1;

                const isMonochrome1 = photometricInterpretation === 'MONOCHROME1';

                if (!rows || !columns) {
                    if (cancelled) return;
                    setError("Missing image dimensions in DICOM header.");
                    setLoading(false);
                    return;
                }

                const pixelDataElement = dataSet.elements.x7fe00010;
                if (!pixelDataElement) {
                    if (cancelled) return;
                    setError("No pixel data found. This may be a compressed DICOM format not yet supported.");
                    setLoading(false);
                    return;
                }

                // Check for encapsulated (compressed) pixel data
                if (pixelDataElement.encapsulatedPixelData) {
                    if (cancelled) return;
                    setError("Compressed DICOM transfer syntax (JPEG/JPEG2000) is not yet supported in this viewer. Use uncompressed DICOM files.");
                    setLoading(false);
                    return;
                }

                const pixelBytes = byteArray.slice(
                    pixelDataElement.dataOffset,
                    pixelDataElement.dataOffset + pixelDataElement.length
                );

                // Determine if RGB
                const isRGB = samplesPerPixel === 3 ||
                    photometricInterpretation === 'RGB' ||
                    photometricInterpretation === 'YBR_FULL' ||
                    photometricInterpretation === 'YBR_FULL_422';

                const framePixelCount = rows * columns;
                const frameSizeBytes = isRGB
                    ? framePixelCount * 3 * (bitsAllocated / 8)
                    : framePixelCount * (bitsAllocated / 8);

                // Determine actual frame count from data
                const actualFrameCount = Math.max(1, Math.min(numFrames, Math.floor(pixelBytes.length / frameSizeBytes)));

                if (isRGB && bitsAllocated === 8) {
                    // Handle RGB frames
                    const rgbFrames: Uint8Array[] = [];
                    for (let f = 0; f < actualFrameCount; f++) {
                        const offset = f * frameSizeBytes;
                        rgbFrames.push(pixelBytes.slice(offset, offset + frameSizeBytes));
                    }

                    if (cancelled) return;

                    pixelInfoRef.current = {
                        rows, columns,
                        minPixel: 0, maxPixel: 255,
                        defaultWC: 128, defaultWW: 256,
                        isMonochrome1: false,
                        frames: [],
                        isRGB: true,
                        rgbFrames
                    };
                    setTotalFrames(actualFrameCount);
                    setWindowCenter(128);
                    setWindowWidth(256);
                    setLoading(false);
                    if (onReady) onReady();
                    return;
                }

                // ── Grayscale processing ──
                let globalMin = Infinity;
                let globalMax = -Infinity;
                const frames: FrameData[] = [];

                for (let f = 0; f < actualFrameCount; f++) {
                    const pixelValues = new Float32Array(framePixelCount);
                    const frameByteOffset = f * frameSizeBytes;

                    if (bitsAllocated === 16) {
                        const dataView = new DataView(pixelBytes.buffer, pixelBytes.byteOffset + frameByteOffset, frameSizeBytes);
                        for (let i = 0; i < framePixelCount; i++) {
                            let raw: number;
                            if (pixelRepresentation === 1) {
                                raw = dataView.getInt16(i * 2, true);
                            } else {
                                raw = dataView.getUint16(i * 2, true);
                            }
                            // Apply rescale slope/intercept
                            const val = raw * rescaleSlope + rescaleIntercept;
                            pixelValues[i] = val;
                            if (val < globalMin) globalMin = val;
                            if (val > globalMax) globalMax = val;
                        }
                    } else if (bitsAllocated === 8) {
                        for (let i = 0; i < framePixelCount; i++) {
                            const raw = pixelBytes[frameByteOffset + i];
                            const val = raw * rescaleSlope + rescaleIntercept;
                            pixelValues[i] = val;
                            if (val < globalMin) globalMin = val;
                            if (val > globalMax) globalMax = val;
                        }
                    } else if (bitsAllocated === 32) {
                        const dataView = new DataView(pixelBytes.buffer, pixelBytes.byteOffset + frameByteOffset, frameSizeBytes);
                        for (let i = 0; i < framePixelCount; i++) {
                            let raw: number;
                            if (pixelRepresentation === 1) {
                                raw = dataView.getInt32(i * 4, true);
                            } else {
                                raw = dataView.getUint32(i * 4, true);
                            }
                            const val = raw * rescaleSlope + rescaleIntercept;
                            pixelValues[i] = val;
                            if (val < globalMin) globalMin = val;
                            if (val > globalMax) globalMax = val;
                        }
                    } else {
                        if (cancelled) return;
                        setError(`Unsupported bit depth: ${bitsAllocated}`);
                        setLoading(false);
                        return;
                    }

                    frames.push({ values: pixelValues });
                }

                // Compute default window if not provided
                if (wc === undefined || ww === undefined || isNaN(wc) || isNaN(ww)) {
                    wc = (globalMax + globalMin) / 2;
                    ww = globalMax - globalMin;
                    if (ww === 0) ww = 1;
                }

                if (cancelled) return;

                pixelInfoRef.current = {
                    rows, columns,
                    minPixel: globalMin, maxPixel: globalMax,
                    defaultWC: wc, defaultWW: ww,
                    isMonochrome1,
                    frames,
                    isRGB: false
                };
                setTotalFrames(actualFrameCount);
                setWindowCenter(wc);
                setWindowWidth(ww);
                setLoading(false);
                if (onReady) onReady();

            } catch (e: any) {
                if (cancelled) return;
                console.error("DICOM parse error:", e);
                setError(e?.message || "Failed to parse DICOM file.");
                setLoading(false);
            }
        })();

        return () => { cancelled = true; };
    }, [file]);

    // Render image to canvas
    const renderImage = useCallback(() => {
        const pi = pixelInfoRef.current;
        const canvas = canvasRef.current;
        if (!pi || !canvas) return;

        canvas.width = pi.columns;
        canvas.height = pi.rows;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const imageData = ctx.createImageData(pi.columns, pi.rows);
        const data = imageData.data;
        const frameIdx = Math.min(currentFrame, pi.frames.length - 1, (pi.rgbFrames?.length ?? 1) - 1);

        if (pi.isRGB && pi.rgbFrames) {
            // RGB rendering
            const rgb = pi.rgbFrames[Math.max(0, frameIdx)];
            for (let i = 0; i < pi.rows * pi.columns; i++) {
                data[i * 4]     = rgb[i * 3];
                data[i * 4 + 1] = rgb[i * 3 + 1];
                data[i * 4 + 2] = rgb[i * 3 + 2];
                data[i * 4 + 3] = 255;
            }
        } else {
            // Grayscale rendering with W/L
            const frame = pi.frames[Math.max(0, Math.min(frameIdx, pi.frames.length - 1))];
            if (!frame) return;
            const vals = frame.values;

            const lower = windowCenter - 0.5 - (windowWidth - 1) / 2;
            const upper = windowCenter - 0.5 + (windowWidth - 1) / 2;
            const range = upper - lower;

            for (let i = 0; i < vals.length; i++) {
                const val = vals[i];
                let lum: number;
                if (val <= lower) lum = 0;
                else if (val >= upper) lum = 255;
                else lum = ((val - lower) / range) * 255;

                // Invert for MONOCHROME1
                if (pi.isMonochrome1) lum = 255 - lum;

                const offset = i * 4;
                data[offset]     = lum;
                data[offset + 1] = lum;
                data[offset + 2] = lum;
                data[offset + 3] = 255;
            }
        }

        ctx.putImageData(imageData, 0, 0);
    }, [windowCenter, windowWidth, currentFrame]);

    useEffect(() => {
        renderImage();
    }, [renderImage]);

    // Mouse interactions
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        isDraggingRef.current = true;
        dragButtonRef.current = e.button;
        lastPosRef.current = { x: e.clientX, y: e.clientY };
    }, []);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (!isDraggingRef.current) return;
        const dx = e.clientX - lastPosRef.current.x;
        const dy = e.clientY - lastPosRef.current.y;
        lastPosRef.current = { x: e.clientX, y: e.clientY };

        if (dragButtonRef.current === 0) {
            // Left drag: Window/Level
            setWindowWidth(prev => Math.max(1, prev + dx * 2));
            setWindowCenter(prev => prev + dy * 2);
        } else if (dragButtonRef.current === 2) {
            // Right drag: Pan
            setPanX(prev => prev + dx);
            setPanY(prev => prev + dy);
        }
    }, []);

    const handleMouseUp = useCallback(() => {
        isDraggingRef.current = false;
    }, []);

    const handleWheel = useCallback((e: React.WheelEvent) => {
        e.preventDefault();
        // If multi-frame, scroll through slices; otherwise zoom
        if (totalFrames > 1) {
            setCurrentFrame(prev => {
                const next = e.deltaY > 0 ? prev + 1 : prev - 1;
                return Math.max(0, Math.min(totalFrames - 1, next));
            });
        } else {
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            setZoom(prev => Math.max(0.1, Math.min(10, prev * delta)));
        }
    }, [totalFrames]);

    const handleReset = useCallback(() => {
        const pi = pixelInfoRef.current;
        if (pi) {
            setWindowCenter(pi.defaultWC);
            setWindowWidth(pi.defaultWW);
        }
        setZoom(1);
        setPanX(0);
        setPanY(0);
    }, []);

    const goToFrame = useCallback((delta: number) => {
        setCurrentFrame(prev => Math.max(0, Math.min(totalFrames - 1, prev + delta)));
    }, [totalFrames]);

    // ── Cine loop (play/pause) ──
    const [isPlaying, setIsPlaying] = useState(false);
    const [fps, setFps] = useState(8);
    const playIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        if (isPlaying && totalFrames > 1) {
            playIntervalRef.current = setInterval(() => {
                setCurrentFrame(prev => {
                    const next = prev + 1;
                    return next >= totalFrames ? 0 : next; // loop back to start
                });
            }, 1000 / fps);
        } else {
            if (playIntervalRef.current) {
                clearInterval(playIntervalRef.current);
                playIntervalRef.current = null;
            }
        }
        return () => {
            if (playIntervalRef.current) {
                clearInterval(playIntervalRef.current);
                playIntervalRef.current = null;
            }
        };
    }, [isPlaying, fps, totalFrames]);

    const togglePlay = useCallback(() => {
        setIsPlaying(prev => !prev);
    }, []);

    if (error) {
        return (
            <div className={`flex items-center justify-center bg-black/90 rounded-lg p-6 ${className}`}>
                <p className="text-red-400 text-sm text-center">{error}</p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className={`flex flex-col items-center justify-center bg-[#0a0b0e] rounded-lg ${className}`}>
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
                <p className="text-white/40 text-xs">Decoding pixel data...</p>
            </div>
        );
    }

    return (
        <div className={`relative bg-black rounded-lg overflow-hidden select-none flex flex-col ${className}`}
            onContextMenu={e => e.preventDefault()}
        >
            {/* Canvas viewport */}
            <div className="flex-1 flex items-center justify-center overflow-hidden"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onWheel={handleWheel}
            >
                <canvas
                    ref={canvasRef}
                    style={{
                        transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
                        imageRendering: 'pixelated',
                        maxWidth: '100%',
                        maxHeight: '100%',
                        objectFit: 'contain',
                        cursor: isDraggingRef.current ? 'grabbing' : 'crosshair',
                    }}
                />
            </div>

            {/* ── Top-right controls ── */}
            <div className="absolute top-2 right-2 flex items-center gap-1.5">
                {/* Zoom controls (always visible for multi-frame since scroll = slice nav) */}
                {totalFrames > 1 && (
                    <>
                        <button onClick={() => setZoom(prev => Math.min(10, prev * 1.2))}
                            className="bg-black/70 hover:bg-black/90 text-white/60 hover:text-white text-[11px] w-7 h-7 rounded border border-white/10 transition-colors flex items-center justify-center font-bold"
                            title="Zoom In">+</button>
                        <button onClick={() => setZoom(prev => Math.max(0.1, prev * 0.8))}
                            className="bg-black/70 hover:bg-black/90 text-white/60 hover:text-white text-[11px] w-7 h-7 rounded border border-white/10 transition-colors flex items-center justify-center font-bold"
                            title="Zoom Out">−</button>
                    </>
                )}
                <button
                    onClick={handleReset}
                    className="bg-black/70 hover:bg-black/90 text-white/60 hover:text-white text-[10px] px-2 py-1 rounded border border-white/10 transition-colors"
                >
                    Reset
                </button>
            </div>

            {/* ── Top-left: W/L + Zoom info ── */}
            <div className="absolute top-2 left-2 pointer-events-none">
                <div className="text-[10px] text-white/50 font-mono leading-relaxed bg-black/40 rounded px-1.5 py-0.5">
                    <div>W: {Math.round(windowWidth)}  L: {Math.round(windowCenter)}</div>
                    <div>Zoom: {(zoom * 100).toFixed(0)}%</div>
                </div>
            </div>

            {/* ── Bottom panel: Slice navigation (OHIF-style) ── */}
            {totalFrames > 1 && (
                <div className="relative bg-[#0d1117] border-t border-white/10 px-3 py-2 flex flex-col gap-1.5">
                    {/* Scrub bar */}
                    <div className="flex items-center gap-2">
                        {/* Play/Pause */}
                        <button
                            onClick={togglePlay}
                            className={`w-7 h-7 flex items-center justify-center rounded transition-all text-sm
                                ${isPlaying
                                    ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'
                                    : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
                                }`}
                            title={isPlaying ? 'Pause' : 'Play cine loop'}
                        >
                            {isPlaying ? '⏸' : '▶'}
                        </button>

                        {/* Slice slider */}
                        <input
                            type="range"
                            min={0}
                            max={totalFrames - 1}
                            value={currentFrame}
                            onChange={e => setCurrentFrame(parseInt(e.target.value, 10))}
                            className="flex-1 h-1.5 appearance-none bg-white/10 rounded-full cursor-pointer
                                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5
                                [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:shadow-lg
                                [&::-webkit-slider-thumb]:shadow-blue-500/40 [&::-webkit-slider-thumb]:cursor-grab
                                [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:h-3.5
                                [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-blue-500 [&::-moz-range-thumb]:border-0
                                [&::-moz-range-thumb]:cursor-grab"
                            style={{
                                background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${(currentFrame / (totalFrames - 1)) * 100}%, rgba(255,255,255,0.1) ${(currentFrame / (totalFrames - 1)) * 100}%, rgba(255,255,255,0.1) 100%)`
                            }}
                        />

                        {/* Slice counter */}
                        <span className="text-[11px] text-white/70 font-mono tabular-nums min-w-[5rem] text-right select-none">
                            {currentFrame + 1} / {totalFrames}
                        </span>
                    </div>

                    {/* FPS control (only visible when playing) */}
                    {isPlaying && (
                        <div className="flex items-center gap-2 pl-9">
                            <span className="text-[9px] text-white/40 uppercase tracking-wider">Speed</span>
                            <input
                                type="range"
                                min={1}
                                max={30}
                                value={fps}
                                onChange={e => setFps(parseInt(e.target.value, 10))}
                                className="w-20 h-1 appearance-none bg-white/10 rounded-full cursor-pointer
                                    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5
                                    [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white/50
                                    [&::-moz-range-thumb]:w-2.5 [&::-moz-range-thumb]:h-2.5
                                    [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white/50 [&::-moz-range-thumb]:border-0"
                            />
                            <span className="text-[9px] text-white/40 font-mono">{fps} fps</span>
                        </div>
                    )}
                </div>
            )}

            {/* ── Single-frame bottom info bar ── */}
            {totalFrames <= 1 && (
                <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-3 py-1.5 bg-gradient-to-t from-black/80 to-transparent pointer-events-none">
                    <span className="text-[10px] text-white/50 font-mono">
                        W: {Math.round(windowWidth)}  L: {Math.round(windowCenter)} | Zoom: {(zoom * 100).toFixed(0)}%
                    </span>
                </div>
            )}
        </div>
    );
});

DicomViewer.displayName = 'DicomViewer';

export default DicomViewer;

