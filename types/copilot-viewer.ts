// ─── Copilot Viewer Action Types ─────────────────────────────────────────────
// Expanded viewer action system supporting annotations, segmentations, and AI findings.

// ── Navigate Action ──────────────────────────────────────────────────────────
export interface NavigateAction {
    type: "navigate";
    action: "jump_to_slice";
    slice: number;
}

// ── Annotation Action ────────────────────────────────────────────────────────
export interface AnnotationAction {
    type: "annotation";
    action:
        | "create_bounding_box_annotation"
        | "create_circle_annotation"
        | "create_arrow_annotation"
        | "create_probe_annotation"
        | "create_rectangle_annotation";
    annotation_id: string;
    slice?: number;
    label: string;
    label_mode?: "always" | "on_select" | "hidden";
    color?: string;
    confidence?: number;
    // Bounding box / rectangle
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    // Circle
    center_x?: number;
    center_y?: number;
    radius?: number;
    // Arrow / probe
    start_x?: number;
    start_y?: number;
    end_x?: number;
    end_y?: number;
    metadata?: AnnotationMetadata;
}

// ── Segmentation Action ──────────────────────────────────────────────────────
export interface SegmentationAction {
    type: "segmentation";
    action: "render_mask_overlay" | "render_contour_overlay" | "clear_ai_segmentations";
    segmentation_id?: string;
    slice?: number;
    label?: string;
    label_mode?: "always" | "on_select" | "hidden";
    color?: string;
    opacity?: number;
    bbox?: [number, number, number, number];
    mask_reference?: string;
    contour_points?: [number, number][];
    metadata?: AnnotationMetadata;
}

// ── Viewport Action ──────────────────────────────────────────────────────────
export interface ViewportAction {
    type: "viewport";
    action: "zoom_to_region" | "reset_viewport";
    x?: number;
    y?: number;
    width?: number;
    height?: number;
}

// ── Clear Action ─────────────────────────────────────────────────────────────
export interface ClearAction {
    type: "clear";
    action: "clear_ai_annotations" | "clear_ai_segmentations" | "clear_all_ai_findings";
}

// ── Annotation Metadata ──────────────────────────────────────────────────────
export interface AnnotationMetadata {
    source: "ai" | "manual";
    model?: "medsam3" | "llm" | string;
    prompt?: string;
    prompt_variants?: string[];
}

// ── Union of all AI viewer actions ───────────────────────────────────────────
export type AIViewerAction =
    | NavigateAction
    | AnnotationAction
    | SegmentationAction
    | ViewportAction
    | ClearAction;

// ── Finding Summary ──────────────────────────────────────────────────────────
export interface FindingSummary {
    name: string;
    confidence?: number;
    annotation_id: string;
    segmentation_id?: string;
    slice?: number;
    prompt?: string;
}

// ── Annotate API Request ─────────────────────────────────────────────────────
export interface CopilotAnnotateRequest {
    message: string;
    session_id?: string;
    patient_id?: string;
    report_id?: string;
    study_uid?: string;
    series_uid?: string;
    current_slice?: number;
    total_slices?: number;
    modality?: string;
    report_text?: string;
    viewport_image?: string; // base64 of current viewport
}

// ── Annotate API Response ────────────────────────────────────────────────────
export interface CopilotAnnotateResponse {
    reply: string;
    viewer_actions: AIViewerAction[];
    findings_summary: FindingSummary[];
    error?: string;
}

// ── Segmentation Backend Config ──────────────────────────────────────────────
export interface SegmentationConfig {
    id?: string;
    deploymentMode: "localhost" | "custom_api";
    providerName: string;
    modelName: string;
    baseUrl: string;
    healthEndpoint: string;
    predictEndpoint: string;
    apiSecretKey?: string;
    timeoutSeconds: number;
    supportsContours: boolean;
    supports3D: boolean;
    returnsMask: boolean;
    returnsBox: boolean;
    isActive: boolean;
    createdAt?: string;
    updatedAt?: string;
}

// ── Cornerstone Viewer Ref API ───────────────────────────────────────────────
export interface CopilotViewerRef {
    jumpToSlice: (slice: number) => void;
    addAnnotation: (action: AnnotationAction) => void;
    addSegmentation: (action: SegmentationAction) => void;
    clearAIFindings: () => void;
    zoomToRegion: (x: number, y: number, width: number, height: number) => void;
    resetViewport: () => void;
    getCurrentSlice: () => number;
    getTotalSlices: () => number;
    getCurrentImageBase64: () => string | null;
}
