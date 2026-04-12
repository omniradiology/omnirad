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
    content: string;
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
