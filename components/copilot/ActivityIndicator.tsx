"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { ActivityState } from "@/types/copilot";
import {
    Brain,
    Search,
    FileText,
    GitCompare,
    BarChart3,
    Monitor,
    Crosshair,
    PenTool,
    Check,
    Loader2,
    Bot,
} from "lucide-react";

// ─── Status → Icon mapping ──────────────────────────────────────────────────
const STATUS_ICONS: Record<string, React.ReactNode> = {
    thinking: <Brain size={14} />,
    searching: <Search size={14} />,
    fetching: <FileText size={14} />,
    comparing: <GitCompare size={14} />,
    analyzing: <BarChart3 size={14} />,
    viewer: <Monitor size={14} />,
    segmenting: <Crosshair size={14} />,
    generating: <PenTool size={14} />,
    working: <Loader2 size={14} />,
};

// ─── Status → gradient color mapping ────────────────────────────────────────
const STATUS_COLORS: Record<string, { from: string; to: string; glow: string }> = {
    thinking: { from: "#a78bfa", to: "#818cf8", glow: "rgba(167,139,250,0.3)" },
    searching: { from: "#38bdf8", to: "#22d3ee", glow: "rgba(56,189,248,0.3)" },
    fetching: { from: "#34d399", to: "#10b981", glow: "rgba(52,211,153,0.3)" },
    comparing: { from: "#fb923c", to: "#f97316", glow: "rgba(251,146,60,0.3)" },
    analyzing: { from: "#60a5fa", to: "#3b82f6", glow: "rgba(96,165,250,0.3)" },
    viewer: { from: "#a78bfa", to: "#8b5cf6", glow: "rgba(167,139,250,0.3)" },
    segmenting: { from: "#f472b6", to: "#ec4899", glow: "rgba(244,114,182,0.3)" },
    generating: { from: "#34d399", to: "#10b981", glow: "rgba(52,211,153,0.3)" },
    working: { from: "#94a3b8", to: "#64748b", glow: "rgba(148,163,184,0.3)" },
};

// Inject keyframe animations once
const STYLE_ID = "activity-indicator-styles";
function ensureStyles() {
    if (typeof document === "undefined") return;
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
        @keyframes actStepFadeIn {
            from { opacity: 0; transform: translateX(-4px); }
            to { opacity: 1; transform: translateX(0); }
        }
        @keyframes actIconPulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.1); opacity: 0.85; }
        }
        @keyframes actDotBounce {
            0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
            40% { opacity: 1; transform: scale(1.2); }
        }
        @keyframes actFadeIn {
            from { opacity: 0; }
            to { opacity: 0.6; }
        }
    `;
    document.head.appendChild(style);
}

interface ActivityIndicatorProps {
    activityState: ActivityState;
}

export default function ActivityIndicator({ activityState }: ActivityIndicatorProps) {
    const { isActive, currentStatus, currentLabel, completedSteps, startedAt } = activityState;
    const [elapsed, setElapsed] = useState(0);
    const [isCollapsing, setIsCollapsing] = useState(false);
    const [isVisible, setIsVisible] = useState(false);

    // Inject keyframe styles on mount
    useEffect(() => { ensureStyles(); }, []);

    // Animate in when becoming active
    useEffect(() => {
        if (isActive) {
            setIsCollapsing(false);
            requestAnimationFrame(() => setIsVisible(true));
        } else if (isVisible) {
            setIsCollapsing(true);
            const timer = setTimeout(() => {
                setIsVisible(false);
                setIsCollapsing(false);
            }, 400);
            return () => clearTimeout(timer);
        }
    }, [isActive]);

    // Elapsed timer
    useEffect(() => {
        if (!isActive || !startedAt) {
            setElapsed(0);
            return;
        }
        const interval = setInterval(() => {
            setElapsed(Math.floor((Date.now() - startedAt) / 1000));
        }, 1000);
        return () => clearInterval(interval);
    }, [isActive, startedAt]);

    const colors = useMemo(
        () => STATUS_COLORS[currentStatus] || STATUS_COLORS.working,
        [currentStatus]
    );
    const icon = STATUS_ICONS[currentStatus] || STATUS_ICONS.working;

    if (!isVisible && !isActive) return null;

    const formatElapsed = (s: number) => {
        if (s < 60) return `${s}s`;
        return `${Math.floor(s / 60)}m ${s % 60}s`;
    };

    return (
        <div className="flex gap-3">
            {/* Bot avatar */}
            <div className="shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 flex items-center justify-center">
                <Bot size={16} className="text-emerald-400" />
            </div>

            {/* Activity card */}
            <div
                style={{
                    opacity: isCollapsing ? 0 : 1,
                    transform: isCollapsing ? "translateY(-8px) scale(0.95)" : "translateY(0) scale(1)",
                    maxHeight: isCollapsing ? "0px" : "300px",
                    transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                    overflow: "hidden",
                }}
                className="bg-bg-panel border border-border-card rounded-2xl rounded-bl-md min-w-[200px] max-w-[320px]"
            >
                <div className="flex flex-col gap-1.5 px-4 py-3">
                    {/* Completed steps */}
                    {completedSteps.length > 0 && (
                        <div className="flex flex-col gap-1">
                            {completedSteps.map((step, i) => (
                                <div
                                    key={i}
                                    className="flex items-center gap-2"
                                    style={{
                                        animation: `actStepFadeIn 0.3s ease-out ${i * 50}ms forwards`,
                                        opacity: 0,
                                    }}
                                >
                                    <span className="flex items-center justify-center w-[18px] h-[18px] rounded-full shrink-0"
                                        style={{ background: "rgba(52, 211, 153, 0.15)" }}>
                                        <Check size={10} strokeWidth={3} className="text-emerald-400" />
                                    </span>
                                    <span className="text-xs text-text-muted line-through"
                                        style={{ textDecorationColor: "rgba(100, 116, 139, 0.3)" }}>
                                        {step.label}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Current active step */}
                    {currentLabel && (
                        <div className="flex items-center gap-2 py-1">
                            <span
                                className="flex items-center justify-center w-[22px] h-[22px] rounded-md text-white shrink-0"
                                style={{
                                    background: `linear-gradient(135deg, ${colors.from}, ${colors.to})`,
                                    boxShadow: `0 0 12px ${colors.glow}`,
                                    animation: "actIconPulse 2s ease-in-out infinite",
                                }}
                            >
                                {icon}
                            </span>
                            <span className="text-[13px] font-medium text-text-primary whitespace-nowrap">
                                {currentLabel}
                            </span>
                            <span className="flex gap-[3px] items-center ml-0.5">
                                {[0, 200, 400].map(delay => (
                                    <span
                                        key={delay}
                                        className="w-1 h-1 rounded-full bg-text-muted"
                                        style={{ animation: `actDotBounce 1.4s ease-in-out ${delay}ms infinite` }}
                                    />
                                ))}
                            </span>
                        </div>
                    )}

                    {/* Elapsed timer — shows after 2 seconds */}
                    {elapsed > 2 && (
                        <div
                            className="text-[10px] text-text-muted text-right mt-0.5"
                            style={{
                                fontVariantNumeric: "tabular-nums",
                                animation: "actFadeIn 0.5s ease-out",
                                opacity: 0.6,
                            }}
                        >
                            {formatElapsed(elapsed)}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
