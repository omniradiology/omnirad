"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import {
    ZoomIn, ZoomOut, RotateCcw, RotateCw,
    Sun, Contrast, Ruler, Expand,
    ChevronLeft, ChevronRight, X,
    FlipHorizontal, FlipVertical,
    Maximize2, RefreshCw, SlidersHorizontal
} from "lucide-react"

interface ImageViewerProps {
    imageSrc?: string | null;
    className?: string;
    isCollapsed: boolean;
    onToggleCollapse: () => void;
    images?: string[];
    forceFullscreen?: boolean;
    onCloseFullscreen?: () => void;
}

interface MeasurementPoint { x: number; y: number; }

// ─────────────────────────────────────────────────────────────────────────────
// MINIMAL EMBEDDED TOOLBAR  (pill style, used in side panel & full report)
// ─────────────────────────────────────────────────────────────────────────────
const Sep = () => <div className="w-px h-4 bg-white/15 shrink-0" />;

function PillBtn({ onClick, title, active = false, children }: {
    onClick: () => void; title: string; active?: boolean; children: React.ReactNode;
}) {
    return (
        <button onClick={onClick} title={title}
            className={`flex items-center justify-center w-7 h-7 rounded-md transition-all duration-150
                ${active ? 'bg-white/20 text-white' : 'text-white/60 hover:text-white hover:bg-white/10'}`}>
            {children}
        </button>
    );
}

function MinimalToolbar({
    currentImageIndex, imagesCount, onPrev, onNext,
    onZoomIn, onZoomOut, onRotateLeft, onRotateRight,
    measurementMode, onToggleMeasure, onReset,
    onOpenFullscreen,
    showSliders, onToggleSliders,
    brightness, onBrightness, contrast, onContrast,
}: {
    onZoomIn: () => void; onZoomOut: () => void;
    currentImageIndex: number; imagesCount: number; onPrev: () => void; onNext: () => void;
    onRotateLeft: () => void; onRotateRight: () => void;
    measurementMode: boolean; onToggleMeasure: () => void;
    onReset: () => void; onOpenFullscreen: () => void;
    showSliders: boolean; onToggleSliders: () => void;
    brightness: number; onBrightness: (v: number) => void;
    contrast: number; onContrast: (v: number) => void;
}) {
    return (
        <div className="relative">
            <div className="flex items-center gap-1 px-2 py-1.5 rounded-xl bg-black/60 border border-white/10 backdrop-blur-md shadow-2xl">
                {/* Zoom */}
                <PillBtn onClick={onZoomIn} title="Zoom In"><ZoomIn className="w-3.5 h-3.5" /></PillBtn>
                <PillBtn onClick={onZoomOut} title="Zoom Out"><ZoomOut className="w-3.5 h-3.5" /></PillBtn>

                {/* Navigation */}
                {imagesCount > 1 && (<>
                    <Sep />
                    <PillBtn onClick={onPrev} title="Previous"><ChevronLeft className="w-3.5 h-3.5" /></PillBtn>
                    <span className="text-[11px] font-medium text-white/80 tabular-nums min-w-[2.2rem] text-center select-none">
                        {currentImageIndex + 1}/{imagesCount}
                    </span>
                    <PillBtn onClick={onNext} title="Next"><ChevronRight className="w-3.5 h-3.5" /></PillBtn>
                </>)}

                <Sep />

                {/* Rotate */}
                <PillBtn onClick={onRotateLeft} title="Rotate Left"><RotateCcw className="w-3.5 h-3.5" /></PillBtn>
                <PillBtn onClick={onRotateRight} title="Rotate Right"><RotateCw className="w-3.5 h-3.5" /></PillBtn>

                <Sep />

                {/* Measure + Reset */}
                <PillBtn onClick={onToggleMeasure} title="Measure" active={measurementMode}><Ruler className="w-3.5 h-3.5" /></PillBtn>
                <PillBtn onClick={onReset} title="Reset"><RotateCcw className="w-3.5 h-3.5 opacity-60" /></PillBtn>

                <Sep />

                {/* Sliders toggle */}
                <PillBtn onClick={onToggleSliders} title="Brightness & Contrast" active={showSliders}>
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                </PillBtn>

                {/* Open Fullscreen DICOM viewer */}
                <PillBtn onClick={onOpenFullscreen} title="Open Fullscreen Viewer">
                    <Expand className="w-3.5 h-3.5" />
                </PillBtn>
            </div>

            {/* Sliders dropdown */}
            {showSliders && (
                <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 z-30 bg-black/70 border border-white/10 backdrop-blur-md rounded-xl p-3 shadow-2xl flex flex-col gap-3 min-w-[190px]">
                    <div className="flex items-center gap-2">
                        <Sun className="w-3.5 h-3.5 text-white/50 shrink-0" />
                        <input type="range" min="50" max="200" value={brightness}
                            onChange={e => onBrightness(Number(e.target.value))}
                            className="flex-1 h-1 appearance-none bg-white/20 rounded-full cursor-pointer" style={{ accentColor: '#60a5fa' }} />
                        <span className="text-[10px] text-white/40 w-6 text-right tabular-nums">{brightness}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Contrast className="w-3.5 h-3.5 text-white/50 shrink-0" />
                        <input type="range" min="50" max="200" value={contrast}
                            onChange={e => onContrast(Number(e.target.value))}
                            className="flex-1 h-1 appearance-none bg-white/20 rounded-full cursor-pointer" style={{ accentColor: '#60a5fa' }} />
                        <span className="text-[10px] text-white/40 w-6 text-right tabular-nums">{contrast}</span>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// FULL DICOM TOOLBAR  (fullscreen portal only)
// ─────────────────────────────────────────────────────────────────────────────
function DicomIconBtn({ onClick, title, active = false, label, children }: {
    onClick: () => void; title: string; active?: boolean; label?: string; children: React.ReactNode;
}) {
    return (
        <button onClick={onClick} title={title}
            className={`flex flex-col items-center justify-center gap-0.5 px-2 py-1.5 rounded-lg transition-all min-w-[2.5rem]
                ${active ? 'bg-blue-600/80 text-white' : 'text-white/55 hover:text-white hover:bg-white/10'}`}>
            <span className="w-4 h-4 flex items-center justify-center">{children}</span>
            {label && <span className="text-[8px] font-medium uppercase tracking-wide opacity-75">{label}</span>}
        </button>
    );
}

const DicomSep = () => <div className="w-px h-9 bg-white/10 shrink-0 mx-0.5" />;

function DicomSlider({ icon, label, value, onChange, min = 50, max = 200 }: {
    icon: React.ReactNode; label: string;
    value: number; onChange: (v: number) => void; min?: number; max?: number;
}) {
    return (
        <div className="flex flex-col gap-0.5 items-center min-w-[76px]">
            <div className="flex items-center gap-1 text-white/45">
                <span className="w-3 h-3">{icon}</span>
                <span className="text-[8px] uppercase tracking-wide font-medium">{label}</span>
                <span className="text-[8px] text-white/35 tabular-nums">{value}</span>
            </div>
            <input type="range" min={min} max={max} value={value}
                onChange={e => onChange(Number(e.target.value))}
                className="w-full h-1 rounded-full appearance-none cursor-pointer bg-white/15"
                style={{ accentColor: '#60a5fa' }} />
        </div>
    );
}

function DicomToolbar({
    currentImageIndex, imagesCount, onPrev, onNext,
    onZoomIn, onZoomOut, scale,
    onRotateLeft, onRotateRight, onFlipH, onFlipV,
    measurementMode, onToggleMeasure, onReset,
    onClose,
    brightness, onBrightness, contrast, onContrast,
}: {
    onZoomIn: () => void; onZoomOut: () => void; scale: number;
    currentImageIndex: number; imagesCount: number; onPrev: () => void; onNext: () => void;
    onRotateLeft: () => void; onRotateRight: () => void; onFlipH: () => void; onFlipV: () => void;
    measurementMode: boolean; onToggleMeasure: () => void; onReset: () => void;
    onClose: () => void;
    brightness: number; onBrightness: (v: number) => void;
    contrast: number; onContrast: (v: number) => void;
}) {
    return (
        <div className="shrink-0 flex items-center gap-0.5 px-2 py-1 bg-[#111318] border-b border-white/8 overflow-x-auto scrollbar-none">

            {/* Navigate */}
            {imagesCount > 1 && (<>
                <DicomIconBtn onClick={onPrev} title="Previous Frame" label="Prev"><ChevronLeft className="w-4 h-4" /></DicomIconBtn>
                <div className="flex flex-col items-center px-2">
                    <span className="text-white font-bold text-sm tabular-nums leading-none">
                        {currentImageIndex + 1}<span className="text-white/30">/{imagesCount}</span>
                    </span>
                    <span className="text-[8px] text-white/30 uppercase tracking-wider mt-0.5">Frame</span>
                </div>
                <DicomIconBtn onClick={onNext} title="Next Frame" label="Next"><ChevronRight className="w-4 h-4" /></DicomIconBtn>
                <DicomSep />
            </>)}

            {/* Zoom */}
            <DicomIconBtn onClick={onZoomIn} title="Zoom In" label="In"><ZoomIn className="w-4 h-4" /></DicomIconBtn>
            <div className="flex flex-col items-center px-1.5">
                <span className="text-white/70 font-semibold text-[11px] tabular-nums leading-none">{Math.round(scale * 100)}%</span>
                <span className="text-[8px] text-white/30 uppercase tracking-wider mt-0.5">Zoom</span>
            </div>
            <DicomIconBtn onClick={onZoomOut} title="Zoom Out" label="Out"><ZoomOut className="w-4 h-4" /></DicomIconBtn>

            <DicomSep />

            {/* Rotate & Flip */}
            <DicomIconBtn onClick={onRotateLeft} title="Rotate Left 90°" label="L-Rot"><RotateCcw className="w-4 h-4" /></DicomIconBtn>
            <DicomIconBtn onClick={onRotateRight} title="Rotate Right 90°" label="R-Rot"><RotateCw className="w-4 h-4" /></DicomIconBtn>
            <DicomIconBtn onClick={onFlipH} title="Flip Horizontal" label="Flip H"><FlipHorizontal className="w-4 h-4" /></DicomIconBtn>
            <DicomIconBtn onClick={onFlipV} title="Flip Vertical" label="Flip V"><FlipVertical className="w-4 h-4" /></DicomIconBtn>

            <DicomSep />

            {/* Window / Level */}
            <div className="flex items-center gap-3 px-2">
                <DicomSlider icon={<Sun className="w-3 h-3" />} label="Bright" value={brightness} onChange={onBrightness} />
                <DicomSlider icon={<Contrast className="w-3 h-3" />} label="Contrast" value={contrast} onChange={onContrast} />
            </div>

            <DicomSep />

            {/* Tools */}
            <DicomIconBtn onClick={onToggleMeasure} title="Measure Distance" label="Measure" active={measurementMode}><Ruler className="w-4 h-4" /></DicomIconBtn>
            <DicomIconBtn onClick={onReset} title="Reset All" label="Reset"><RefreshCw className="w-4 h-4" /></DicomIconBtn>

            <DicomSep />

            {/* Close fullscreen */}
            <DicomIconBtn onClick={onClose} title="Exit Fullscreen (Esc)" label="Close"><X className="w-4 h-4" /></DicomIconBtn>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export function ImageViewer({ imageSrc, className, isCollapsed, images = [], forceFullscreen, onCloseFullscreen }: ImageViewerProps) {
    const [scale, setScale] = React.useState(1);
    const [position, setPosition] = React.useState({ x: 0, y: 0 });
    const [brightness, setBrightness] = React.useState(100);
    const [contrast, setContrast] = React.useState(100);
    const [rotation, setRotation] = React.useState(0);
    const [flipH, setFlipH] = React.useState(false);
    const [flipV, setFlipV] = React.useState(false);
    const [isDragging, setIsDragging] = React.useState(false);
    const [dragStart, setDragStart] = React.useState({ x: 0, y: 0 });
    const [measurementMode, setMeasurementMode] = React.useState(false);
    const [measurementPoints, setMeasurementPoints] = React.useState<MeasurementPoint[]>([]);
    const [currentImageIndex, setCurrentImageIndex] = React.useState(0);
    const [isFullscreen, setIsFullscreen] = React.useState(forceFullscreen || false);
    const [showSliders, setShowSliders] = React.useState(false);
    const [mounted, setMounted] = React.useState(false);

    const containerRef = React.useRef<HTMLDivElement>(null);
    const imageRef = React.useRef<HTMLImageElement>(null);

    React.useEffect(() => { setMounted(true); }, []);

    const activeImage = images.length > 0 ? images[currentImageIndex] : imageSrc;

    const handleZoomIn = () => setScale(s => Math.min(s + 0.25, 6));
    const handleZoomOut = () => setScale(s => Math.max(s - 0.25, 0.25));
    const handleRotateLeft = () => setRotation(r => (r - 90 + 360) % 360);
    const handleRotateRight = () => setRotation(r => (r + 90) % 360);
    const handleFlipH = () => setFlipH(f => !f);
    const handleFlipV = () => setFlipV(f => !f);

    const handleReset = () => {
        setScale(1); setPosition({ x: 0, y: 0 });
        setBrightness(100); setContrast(100);
        setRotation(0); setFlipH(false); setFlipV(false);
        setMeasurementPoints([]); setMeasurementMode(false);
    };

    const handleNextImage = () => {
        if (images.length > 1) { setCurrentImageIndex(p => (p + 1) % images.length); handleReset(); }
    };
    const handlePrevImage = () => {
        if (images.length > 1) { setCurrentImageIndex(p => (p - 1 + images.length) % images.length); handleReset(); }
    };

    React.useEffect(() => {
        if (!isFullscreen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setIsFullscreen(false);
            if (e.key === 'ArrowRight') handleNextImage();
            if (e.key === 'ArrowLeft') handlePrevImage();
            if (e.key === '+') handleZoomIn();
            if (e.key === '-') handleZoomOut();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isFullscreen, images.length, currentImageIndex]);

    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        e.deltaY < 0 ? handleZoomIn() : handleZoomOut();
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (measurementMode) {
            const rect = imageRef.current?.getBoundingClientRect();
            if (rect) {
                const x = e.clientX - rect.left, y = e.clientY - rect.top;
                if (measurementPoints.length < 2) setMeasurementPoints(prev => [...prev, { x, y }]);
                else setMeasurementPoints([{ x, y }]);
            }
        } else {
            setIsDragging(true);
            setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
        }
    };
    const handleMouseMove = (e: React.MouseEvent) => {
        if (isDragging && !measurementMode) setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    };
    const handleMouseUp = () => setIsDragging(false);
    const toggleMeasure = () => { setMeasurementMode(m => !m); setMeasurementPoints([]); };

    const distance = (() => {
        if (measurementPoints.length === 2) {
            const dx = measurementPoints[1].x - measurementPoints[0].x;
            const dy = measurementPoints[1].y - measurementPoints[0].y;
            return Math.sqrt(dx * dx + dy * dy).toFixed(1);
        }
        return null;
    })();

    const transform = `translate(${position.x}px,${position.y}px) scale(${scale}) rotate(${rotation}deg) scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1})`;

    const minimalProps = {
        currentImageIndex, imagesCount: images.length,
        onPrev: handlePrevImage, onNext: handleNextImage,
        onZoomIn: handleZoomIn, onZoomOut: handleZoomOut,
        onRotateLeft: handleRotateLeft, onRotateRight: handleRotateRight,
        measurementMode, onToggleMeasure: toggleMeasure,
        onReset: handleReset,
        onOpenFullscreen: () => setIsFullscreen(true),
        showSliders, onToggleSliders: () => setShowSliders(s => !s),
        brightness, onBrightness: setBrightness,
        contrast, onContrast: setContrast,
    };

    const dicomProps = {
        currentImageIndex, imagesCount: images.length,
        onPrev: handlePrevImage, onNext: handleNextImage,
        onZoomIn: handleZoomIn, onZoomOut: handleZoomOut, scale,
        onRotateLeft: handleRotateLeft, onRotateRight: handleRotateRight,
        onFlipH: handleFlipH, onFlipV: handleFlipV,
        measurementMode, onToggleMeasure: toggleMeasure,
        onReset: handleReset,
        onClose: () => {
            if (onCloseFullscreen) onCloseFullscreen();
            else setIsFullscreen(false);
        },
        brightness, onBrightness: setBrightness,
        contrast, onContrast: setContrast,
    };

    // Shared image canvas
    const makeCanvas = (extraClass = "") => (
        <div ref={containerRef}
            className={`flex-1 flex items-center justify-center overflow-hidden ${measurementMode ? 'cursor-crosshair' : 'cursor-move'} ${isCollapsed ? 'opacity-40 pointer-events-none' : ''} ${extraClass}`}
            onMouseDown={handleMouseDown} onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} onWheel={handleWheel}>
            {activeImage ? (
                <div className="relative select-none">
                    <img ref={imageRef} src={activeImage} alt="Radiology Scan"
                        className="max-w-none max-h-none block"
                        style={{ transform, filter: `brightness(${brightness}%) contrast(${contrast}%)`, transition: isDragging ? 'none' : 'transform 0.05s' }}
                        draggable={false} />
                    {/* Measurement SVG */}
                    {measurementMode && measurementPoints.length > 0 && (
                        <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible"
                            style={{ transform: `translate(${position.x}px,${position.y}px) scale(${scale})` }}>
                            {measurementPoints.length === 2 && (
                                <>
                                    <line x1={measurementPoints[0].x} y1={measurementPoints[0].y}
                                        x2={measurementPoints[1].x} y2={measurementPoints[1].y}
                                        stroke="#3b82f6" strokeWidth="1.5" strokeDasharray="5 3" />
                                    {distance && (
                                        <text x={(measurementPoints[0].x + measurementPoints[1].x) / 2}
                                            y={(measurementPoints[0].y + measurementPoints[1].y) / 2 - 8}
                                            fill="white" fontSize="11" textAnchor="middle"
                                            style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.9))' }}>
                                            {distance}px
                                        </text>
                                    )}
                                </>
                            )}
                            <circle cx={measurementPoints[0].x} cy={measurementPoints[0].y} r="4" fill="#3b82f6" fillOpacity="0.9" />
                            {measurementPoints.length === 2 && <circle cx={measurementPoints[1].x} cy={measurementPoints[1].y} r="4" fill="#3b82f6" fillOpacity="0.9" />}
                        </svg>
                    )}
                </div>
            ) : (
                <p className="text-white/20 text-sm">No image loaded</p>
            )}
        </div>
    );

    // ── Cine loop (play/pause for multi-image) ──
    const [isPlaying, setIsPlaying] = React.useState(false);
    const [fps, setFps] = React.useState(8);
    const playIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

    React.useEffect(() => {
        if (isPlaying && images.length > 1) {
            playIntervalRef.current = setInterval(() => {
                setCurrentImageIndex(prev => {
                    const next = prev + 1;
                    return next >= images.length ? 0 : next;
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
    }, [isPlaying, fps, images.length]);

    // ── Slice navigation bar (OHIF-style) — shared between embedded and fullscreen ──
    const sliceNavBar = images.length > 1 && (
        <div className="shrink-0 bg-[#0d1117] border-t border-white/10 px-3 py-2 flex flex-col gap-1.5">
            {/* Main row: play + slider + counter */}
            <div className="flex items-center gap-2">
                {/* Play/Pause */}
                <button
                    onClick={() => setIsPlaying(p => !p)}
                    className={`w-7 h-7 flex items-center justify-center rounded transition-all text-sm shrink-0
                        ${isPlaying
                            ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'
                            : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
                        }`}
                    title={isPlaying ? 'Pause' : 'Play cine loop'}
                >
                    {isPlaying ? '⏸' : '▶'}
                </button>

                {/* Scrub slider */}
                <input
                    type="range"
                    min={0}
                    max={images.length - 1}
                    value={currentImageIndex}
                    onChange={e => { setCurrentImageIndex(parseInt(e.target.value, 10)); setMeasurementPoints([]); }}
                    className="flex-1 h-1.5 appearance-none bg-white/10 rounded-full cursor-pointer
                        [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5
                        [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:shadow-lg
                        [&::-webkit-slider-thumb]:shadow-blue-500/40 [&::-webkit-slider-thumb]:cursor-grab
                        [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:h-3.5
                        [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-blue-500 [&::-moz-range-thumb]:border-0
                        [&::-moz-range-thumb]:cursor-grab"
                    style={{
                        background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${(currentImageIndex / (images.length - 1)) * 100}%, rgba(255,255,255,0.1) ${(currentImageIndex / (images.length - 1)) * 100}%, rgba(255,255,255,0.1) 100%)`
                    }}
                />

                {/* Slice counter */}
                <span className="text-[11px] text-white/70 font-mono tabular-nums min-w-[5rem] text-right select-none shrink-0">
                    {currentImageIndex + 1} / {images.length}
                </span>
            </div>

            {/* FPS control (only when playing) */}
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
    );

    // Status bar (fullscreen only)
    const statusBar = (
        <div className="shrink-0 flex items-center justify-between px-3 py-0.5 bg-[#0d0f13] border-t border-white/8 text-[9px] text-white/30 font-mono">
            <span>ZOOM {Math.round(scale * 100)}%  ROT {rotation}°</span>
            {measurementMode ? (
                <span className="text-blue-400">
                    {measurementPoints.length === 0 ? '● Set start point' : measurementPoints.length === 1 ? '● Set end point' : `✓ ${distance} px`}
                </span>
            ) : <span />}
            <span>W:{brightness}  L:{contrast}</span>
        </div>
    );

    // ─── FULLSCREEN PORTAL — full DICOM viewer ────────────────────────────────
    const fullscreenPortal = mounted && isFullscreen ? createPortal(
        <div className="fixed inset-0 z-[9999] bg-[#0a0b0e] flex flex-col" style={{ isolation: 'isolate' }}>
            <DicomToolbar {...dicomProps} />
            {makeCanvas()}
            {sliceNavBar}
            {statusBar}
        </div>,
        document.body
    ) : null;

    // ─── EMBEDDED — minimal pill toolbar ─────────────────────────────────────
    return (
        <>
            {fullscreenPortal}
            <div className={`relative bg-black overflow-hidden flex flex-col ${className}`}>
                {/* Centered floating pill toolbar */}
                <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20">
                    <MinimalToolbar {...minimalProps} />
                </div>

                {/* Measurement hint overlay */}
                {measurementMode && measurementPoints.length > 0 && (
                    <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 bg-black/60 border border-white/10 backdrop-blur-md px-3 py-1.5 rounded-lg pointer-events-none">
                        <p className="text-xs text-white/70">
                            {measurementPoints.length === 1 ? 'Click to set endpoint' : `Distance: ${distance} px`}
                        </p>
                    </div>
                )}

                {makeCanvas()}

                {/* Slice nav bar (replaces old thumbnails) */}
                {!isCollapsed && sliceNavBar}
            </div>
        </>
    );
}

