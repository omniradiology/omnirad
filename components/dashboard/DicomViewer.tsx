"use client";

import React, { useEffect, useRef, useImperativeHandle, forwardRef, useState, useCallback } from 'react';
import * as dicomParser from 'dicom-parser';

export interface DicomViewerHandle {
    captureFrame: () => Promise<string | null>;
}

interface DicomViewerProps {
    file: File;
    className?: string;
    onReady?: () => void;
}

interface PixelData {
    values: Float32Array;
    rows: number;
    columns: number;
    minPixel: number;
    maxPixel: number;
    defaultWC: number;
    defaultWW: number;
}

export const DicomViewer = forwardRef<DicomViewerHandle, DicomViewerProps>(({ file, className, onReady }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const pixelDataRef = useRef<PixelData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    // View state
    const [windowCenter, setWindowCenter] = useState(0);
    const [windowWidth, setWindowWidth] = useState(0);
    const [zoom, setZoom] = useState(1);
    const [panX, setPanX] = useState(0);
    const [panY, setPanY] = useState(0);
    const isDraggingRef = useRef(false);
    const dragButtonRef = useRef(0);
    const lastPosRef = useRef({ x: 0, y: 0 });

    useImperativeHandle(ref, () => ({
        captureFrame: async () => {
            if (canvasRef.current) {
                return canvasRef.current.toDataURL('image/jpeg', 0.92);
            }
            return null;
        }
    }));

    // Parse DICOM pixel data
    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);

        (async () => {
            try {
                const arrayBuffer = await file.arrayBuffer();
                const byteArray = new Uint8Array(arrayBuffer);
                const dataSet = dicomParser.parseDicom(byteArray);

                const rows = dataSet.uint16('x00280010');
                const columns = dataSet.uint16('x00280011');
                const bitsAllocated = dataSet.uint16('x00280100');
                const pixelRepresentation = dataSet.uint16('x00280103') || 0;
                const samplesPerPixel = dataSet.uint16('x00280002') || 1;
                const photometricInterpretation = dataSet.string('x00280004')?.trim() || '';

                let wc = dataSet.string('x00281050') ? parseFloat(dataSet.string('x00281050')!) : undefined;
                let ww = dataSet.string('x00281051') ? parseFloat(dataSet.string('x00281051')!) : undefined;

                if (!rows || !columns) {
                    if (cancelled) return;
                    setError("Missing image dimensions in DICOM header.");
                    setLoading(false);
                    return;
                }

                const pixelDataElement = dataSet.elements.x7fe00010;
                if (!pixelDataElement) {
                    if (cancelled) return;
                    setError("No pixel data found. This may be a compressed DICOM format.");
                    setLoading(false);
                    return;
                }

                const pixelBytes = byteArray.slice(pixelDataElement.dataOffset, pixelDataElement.dataOffset + pixelDataElement.length);

                // Check if this is an RGB image
                const isRGB = samplesPerPixel === 3 || photometricInterpretation === 'RGB' || photometricInterpretation === 'YBR_FULL';

                if (isRGB && bitsAllocated === 8) {
                    // Handle RGB directly — render to canvas
                    if (cancelled) return;
                    const canvas = canvasRef.current;
                    if (!canvas) return;
                    canvas.width = columns;
                    canvas.height = rows;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) return;
                    const imageData = ctx.createImageData(columns, rows);
                    const data = imageData.data;
                    for (let i = 0; i < rows * columns; i++) {
                        data[i * 4]     = pixelBytes[i * 3];
                        data[i * 4 + 1] = pixelBytes[i * 3 + 1];
                        data[i * 4 + 2] = pixelBytes[i * 3 + 2];
                        data[i * 4 + 3] = 255;
                    }
                    ctx.putImageData(imageData, 0, 0);
                    // Store dummy pixel data for frame capture
                    pixelDataRef.current = {
                        values: new Float32Array(0), rows, columns,
                        minPixel: 0, maxPixel: 255, defaultWC: 128, defaultWW: 256
                    };
                    setLoading(false);
                    if (onReady) onReady();
                    return;
                }

                // Grayscale processing
                let minPixel = Infinity;
                let maxPixel = -Infinity;
                const pixelValues = new Float32Array(rows * columns);

                if (bitsAllocated === 16) {
                    const dataView = new DataView(pixelBytes.buffer, pixelBytes.byteOffset, pixelBytes.byteLength);
                    for (let i = 0; i < rows * columns; i++) {
                        const val = pixelRepresentation === 1 ? dataView.getInt16(i * 2, true) : dataView.getUint16(i * 2, true);
                        pixelValues[i] = val;
                        if (val < minPixel) minPixel = val;
                        if (val > maxPixel) maxPixel = val;
                    }
                } else if (bitsAllocated === 8) {
                    for (let i = 0; i < rows * columns; i++) {
                        const val = pixelBytes[i];
                        pixelValues[i] = val;
                        if (val < minPixel) minPixel = val;
                        if (val > maxPixel) maxPixel = val;
                    }
                } else {
                    if (cancelled) return;
                    setError(`Unsupported bit depth: ${bitsAllocated}`);
                    setLoading(false);
                    return;
                }

                if (wc === undefined || ww === undefined) {
                    wc = (maxPixel + minPixel) / 2;
                    ww = maxPixel - minPixel;
                    if (ww === 0) ww = 1;
                }

                if (cancelled) return;

                pixelDataRef.current = {
                    values: pixelValues, rows, columns,
                    minPixel, maxPixel, defaultWC: wc, defaultWW: ww
                };
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

    // Render grayscale image whenever W/L, zoom, or pan changes
    const renderImage = useCallback(() => {
        const pd = pixelDataRef.current;
        const canvas = canvasRef.current;
        if (!pd || !canvas || pd.values.length === 0) return;

        canvas.width = pd.columns;
        canvas.height = pd.rows;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const imageData = ctx.createImageData(pd.columns, pd.rows);
        const data = imageData.data;

        const lower = windowCenter - 0.5 - (windowWidth - 1) / 2;
        const upper = windowCenter - 0.5 + (windowWidth - 1) / 2;
        const range = upper - lower;

        for (let i = 0; i < pd.values.length; i++) {
            const val = pd.values[i];
            let lum: number;
            if (val <= lower) lum = 0;
            else if (val >= upper) lum = 255;
            else lum = ((val - lower) / range) * 255;

            const offset = i * 4;
            data[offset]     = lum;
            data[offset + 1] = lum;
            data[offset + 2] = lum;
            data[offset + 3] = 255;
        }

        ctx.putImageData(imageData, 0, 0);
    }, [windowCenter, windowWidth]);

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
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        setZoom(prev => Math.max(0.1, Math.min(10, prev * delta)));
    }, []);

    const handleReset = useCallback(() => {
        const pd = pixelDataRef.current;
        if (pd) {
            setWindowCenter(pd.defaultWC);
            setWindowWidth(pd.defaultWW);
        }
        setZoom(1);
        setPanX(0);
        setPanY(0);
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
        <div className={`relative bg-black rounded-lg overflow-hidden select-none ${className}`}
            onContextMenu={e => e.preventDefault()}
        >
            {/* Canvas viewport */}
            <div className="w-full h-full flex items-center justify-center overflow-hidden"
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

            {/* Overlay info */}
            <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-3 py-1.5 bg-gradient-to-t from-black/80 to-transparent pointer-events-none">
                <span className="text-[10px] text-white/50 font-mono">
                    WC: {Math.round(windowCenter)} | WW: {Math.round(windowWidth)} | Zoom: {(zoom * 100).toFixed(0)}%
                </span>
            </div>

            {/* Reset button */}
            <button
                onClick={handleReset}
                className="absolute top-2 right-2 bg-black/70 hover:bg-black/90 text-white/60 hover:text-white text-[10px] px-2 py-1 rounded border border-white/10 transition-colors"
            >
                Reset
            </button>
        </div>
    );
});

DicomViewer.displayName = 'DicomViewer';

export default DicomViewer;
