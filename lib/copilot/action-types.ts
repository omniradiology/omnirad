// ─── Copilot Viewer Action Types & Utilities ─────────────────────────────────
// Central definitions and type guards for all viewer actions.

import type {
    AIViewerAction,
    NavigateAction,
    AnnotationAction,
    SegmentationAction,
    ViewportAction,
    ClearAction,
} from "@/types/copilot-viewer";

// ── Type Guards ──────────────────────────────────────────────────────────────

export function isNavigateAction(a: AIViewerAction): a is NavigateAction {
    return a.type === "navigate";
}

export function isAnnotationAction(a: AIViewerAction): a is AnnotationAction {
    return a.type === "annotation";
}

export function isSegmentationAction(a: AIViewerAction): a is SegmentationAction {
    return a.type === "segmentation";
}

export function isViewportAction(a: AIViewerAction): a is ViewportAction {
    return a.type === "viewport";
}

export function isClearAction(a: AIViewerAction): a is ClearAction {
    return a.type === "clear";
}

// ── Action Sorting ───────────────────────────────────────────────────────────
// Execution order: clear → navigate → segment → annotate → viewport

const ACTION_PRIORITY: Record<string, number> = {
    clear: 0,
    navigate: 1,
    segmentation: 2,
    annotation: 3,
    viewport: 4,
};

export function sortViewerActions(actions: AIViewerAction[]): AIViewerAction[] {
    return [...actions].sort(
        (a, b) => (ACTION_PRIORITY[a.type] ?? 99) - (ACTION_PRIORITY[b.type] ?? 99)
    );
}

// ── Default Styling ──────────────────────────────────────────────────────────

export const AI_ANNOTATION_DEFAULTS = {
    color: "#ff4d4f",         // Red for abnormal findings
    normalColor: "#52c41a",   // Green for normal findings
    labelMode: "always" as const,
    segmentationOpacity: 0.3,
    segmentationColor: "#ff4d4f",
    contourColor: "#ff6b6b",
    contourWidth: 2,
};

// ── Label Formatting ─────────────────────────────────────────────────────────

export function formatAILabel(name: string, confidence?: number): string {
    const base = name || "Finding";
    if (confidence !== undefined && confidence > 0) {
        return `${base} (AI) — ${Math.round(confidence * 100)}%`;
    }
    return `${base} (AI)`;
}
