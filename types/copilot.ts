// ─── AI Copilot Types ────────────────────────────────────────────────────────

// Viewer Action — structured command from AI to control the viewer panel
export type ViewerAction =
    | { type: 'OPEN_REPORT'; reportId: string; patientName?: string }
    | { type: 'OPEN_DICOM'; studyId: string; reportId?: string; slice?: number }
    | { type: 'OPEN_METADATA'; patientId: string }
    | { type: 'SWITCH_TAB'; tab: ViewerTab }
    | { type: 'COMPARE_VIEW'; reportId1: string; reportId2: string }
    | null;

export type ViewerTab = 'dicom' | 'report' | 'metadata';

// Reference — clickable link in chat messages
export interface Reference {
    id: string;
    type: 'report' | 'study' | 'scan' | 'patient';
    label: string;
    viewerAction: ViewerAction;
}

// AI Chat Response from the backend
export interface AIChatResponse {
    message: string;
    viewerActions: ViewerAction[];
    references: Reference[];
    error?: string;
}

// Chat message stored in state / database
export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string | any[];
    viewerActions?: ViewerAction[];
    references?: Reference[];
    timestamp: string;
}

// Chat session summary
export interface ChatSession {
    sessionId: string;
    patientId?: string;
    patientName?: string;
    lastMessage: string;
    messageCount: number;
    createdAt: string;
    updatedAt: string;
}

// Patient context passed to the AI
export interface CopilotPatientContext {
    patientId?: string | null;
    currentReportId?: string | null;
    patientName?: string | null;
}

// Quick action presets
export interface QuickAction {
    label: string;
    prompt: string;
    icon: string;
}

// ─── Activity Indicator Types ────────────────────────────────────────────────

export interface ActivityStep {
    label: string;
    tool: string | null;
    timestamp: number;
}

export interface ActivityState {
    isActive: boolean;
    currentStatus: string;
    currentLabel: string;
    currentTool: string | null;
    completedSteps: ActivityStep[];
    startedAt: number;
}

export const INITIAL_ACTIVITY_STATE: ActivityState = {
    isActive: false,
    currentStatus: "",
    currentLabel: "",
    currentTool: null,
    completedSteps: [],
    startedAt: 0,
};

// Re-export copilot viewer types for convenient access
export type {
    AIViewerAction,
    NavigateAction,
    AnnotationAction,
    SegmentationAction,
    ViewportAction as ViewportAIAction,
    ClearAction,
    AnnotationMetadata,
    FindingSummary,
    CopilotAnnotateRequest,
    CopilotAnnotateResponse,
    SegmentationConfig,
    CopilotViewerRef,
} from "./copilot-viewer";
