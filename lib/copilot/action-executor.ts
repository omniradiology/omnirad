// ─── Viewer Action Executor ──────────────────────────────────────────────────
// Deterministic executor that processes AI viewer actions against the
// CopilotCornerstoneViewer ref in the correct order.

import type {
    AIViewerAction,
    CopilotViewerRef,
    AnnotationAction,
    SegmentationAction,
} from "@/types/copilot-viewer";
import {
    sortViewerActions,
    isNavigateAction,
    isAnnotationAction,
    isSegmentationAction,
    isViewportAction,
    isClearAction,
} from "./action-types";

/**
 * Execute a list of AI viewer actions against the viewer ref.
 * Actions are sorted by priority: clear → navigate → segment → annotate → viewport
 * and executed sequentially with a small delay between groups.
 */
export async function executeViewerActions(
    actions: AIViewerAction[],
    viewerRef: CopilotViewerRef | null,
): Promise<void> {
    if (!viewerRef || !actions || actions.length === 0) return;

    const sorted = sortViewerActions(actions);

    for (const action of sorted) {
        try {
            executeSingleAction(action, viewerRef);
            // Small delay between actions for visual feedback
            await sleep(50);
        } catch (err) {
            console.error("[ActionExecutor] Error executing action:", action, err);
        }
    }
}

/**
 * Execute a single viewer action.
 */
function executeSingleAction(
    action: AIViewerAction,
    viewer: CopilotViewerRef,
): void {
    if (isClearAction(action)) {
        switch (action.action) {
            case "clear_ai_annotations":
            case "clear_ai_segmentations":
            case "clear_all_ai_findings":
                viewer.clearAIFindings();
                break;
        }
        return;
    }

    if (isNavigateAction(action)) {
        viewer.jumpToSlice(action.slice);
        return;
    }

    if (isSegmentationAction(action)) {
        viewer.addSegmentation(action as SegmentationAction);
        return;
    }

    if (isAnnotationAction(action)) {
        viewer.addAnnotation(action as AnnotationAction);
        return;
    }

    if (isViewportAction(action)) {
        switch (action.action) {
            case "zoom_to_region":
                if (action.x !== undefined && action.y !== undefined && action.width !== undefined && action.height !== undefined) {
                    viewer.zoomToRegion(action.x, action.y, action.width, action.height);
                }
                break;
            case "reset_viewport":
                viewer.resetViewport();
                break;
        }
        return;
    }
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
