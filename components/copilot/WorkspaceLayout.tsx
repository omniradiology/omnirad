"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { ViewerAction, ViewerTab, ChatMessage, CopilotPatientContext, Reference, ActivityState, INITIAL_ACTIVITY_STATE } from "@/types/copilot";
import type { AIViewerAction, CopilotViewerRef, FindingSummary } from "@/types/copilot-viewer";
import { executeViewerActions } from "@/lib/copilot/action-executor";
import ViewerPanel from "./ViewerPanel";
import CopilotPanel from "./CopilotPanel";
import FindingsList from "./FindingsList";

interface WorkspaceLayoutProps {
    initialPatientId?: string;
    initialReportId?: string;
}

export default function WorkspaceLayout({ initialPatientId, initialReportId }: WorkspaceLayoutProps) {
    // ─── Viewer State ────────────────────────────────────────────────────────
    const [activeTab, setActiveTab] = useState<ViewerTab>("report");
    const [currentReportId, setCurrentReportId] = useState<string | null>(initialReportId || null);
    const [currentStudyId, setCurrentStudyId] = useState<string | null>(null);
    const [currentSlice, setCurrentSlice] = useState<number>(1);
    const [currentPatientId, setCurrentPatientId] = useState<string | null>(initialPatientId || null);
    const [currentPatientName, setCurrentPatientName] = useState<string | null>(null);

    // ─── Cornerstone Viewer Ref ──────────────────────────────────────────────
    const viewerRef = useRef<CopilotViewerRef | null>(null);

    // ─── AI Findings State ───────────────────────────────────────────────────
    const [aiFindings, setAiFindings] = useState<FindingSummary[]>([]);

    // ─── Chat State ──────────────────────────────────────────────────────────
    const [chatSessionId, setChatSessionId] = useState<string>(() => {
        if (typeof window !== "undefined") {
            return sessionStorage.getItem("copilot_session_id") || `session_${Date.now()}`;
        }
        return `session_${Date.now()}`;
    });
    
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
        if (typeof window !== "undefined") {
            const saved = sessionStorage.getItem("copilot_messages");
            if (saved) {
                try { return JSON.parse(saved); } catch (e) { console.error(e); }
            }
        }
        return [];
    });
    
    const [isLoading, setIsLoading] = useState(false);
    const [activityState, setActivityState] = useState<ActivityState>(INITIAL_ACTIVITY_STATE);

    // Persist chat state
    useEffect(() => {
        if (typeof window !== "undefined") {
            sessionStorage.setItem("copilot_session_id", chatSessionId);
            sessionStorage.setItem("copilot_messages", JSON.stringify(chatMessages));
        }
    }, [chatSessionId, chatMessages]);

    // ─── Core Bridge Function: Legacy AI → Viewer ────────────────────────────
    const executeLegacyViewerAction = useCallback((action: ViewerAction) => {
        if (!action) return;

        switch (action.type) {
            case "OPEN_REPORT":
                setCurrentReportId(action.reportId);
                if (action.patientName) setCurrentPatientName(action.patientName);
                setActiveTab("report");
                break;
            case "OPEN_DICOM":
                setCurrentStudyId(action.studyId);
                if (action.reportId) setCurrentReportId(action.reportId);
                if (action.slice) setCurrentSlice(action.slice);
                setActiveTab("dicom");
                break;
            case "OPEN_METADATA":
                setCurrentPatientId(action.patientId);
                setActiveTab("metadata");
                break;
            case "SWITCH_TAB":
                setActiveTab(action.tab);
                break;
            case "COMPARE_VIEW":
                // Future: side-by-side comparison
                setCurrentReportId(action.reportId1);
                setActiveTab("report");
                break;
        }
    }, []);

    // ─── New AI Viewer Actions Executor ──────────────────────────────────────
    const executeAIViewerActions = useCallback(async (actions: AIViewerAction[]) => {
        if (!actions || actions.length === 0) return;

        // Switch to DICOM tab when we have annotation/segmentation actions
        const hasVisualActions = actions.some(
            (a) => a.type === "annotation" || a.type === "segmentation" || a.type === "navigate" || a.type === "viewport"
        );
        if (hasVisualActions) {
            setActiveTab("dicom");
        }

        // Small delay to let the tab switch and viewer mount
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Execute through the action executor
        await executeViewerActions(actions, viewerRef.current);
    }, []);

    const handleReferenceClick = useCallback((ref: Reference) => {
        executeLegacyViewerAction(ref.viewerAction);
    }, [executeLegacyViewerAction]);

    // ─── Unified Action Executor ─────────────────────────────────────────────
    const handleExecuteActions = useCallback(async (actions: any[]) => {
        if (!actions || actions.length === 0) return;

        const legacyActions: ViewerAction[] = [];
        const aiActions: AIViewerAction[] = [];

        for (const action of actions) {
            if (action.type === "OPEN_REPORT" || action.type === "OPEN_DICOM" || 
                action.type === "OPEN_METADATA" || action.type === "SWITCH_TAB" || 
                action.type === "COMPARE_VIEW") {
                legacyActions.push(action as ViewerAction);
            } else if (action.type === "annotation" || action.type === "segmentation" || 
                       action.type === "navigate" || action.type === "viewport" || 
                       action.type === "clear") {
                aiActions.push(action as AIViewerAction);
            }
        }

        // Execute legacy actions first (e.g. mounting the right study)
        for (const action of legacyActions) {
            executeLegacyViewerAction(action);
        }

        // If there are visual overlay actions, clear old ones so they don't stack visually
        if (aiActions.some(a => a.type === "annotation" || a.type === "segmentation")) {
            viewerRef.current?.clearAIFindings();
        }

        // Execute new AI viewer actions
        if (aiActions.length > 0) {
            await executeAIViewerActions(aiActions);
        }
    }, [executeLegacyViewerAction, executeAIViewerActions]);

    // ─── Send Chat Message ───────────────────────────────────────────────────
    const sendMessage = useCallback(async (messageText: string) => {
        if (!messageText.trim() || isLoading) return;

        const userMessage: ChatMessage = {
            id: `msg_${Date.now()}`,
            role: "user",
            content: messageText,
            timestamp: new Date().toISOString(),
        };

        setChatMessages(prev => [...prev, userMessage]);
        setIsLoading(true);
        setActivityState({
            isActive: true,
            currentStatus: "thinking",
            currentLabel: "Thinking...",
            currentTool: null,
            completedSteps: [],
            startedAt: Date.now(),
        });

        try {
            const response = await fetch("/api/copilot/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: messageText,
                    stream: true,
                    patientContext: {
                        patientId: currentPatientId,
                        currentReportId: currentReportId,
                        patientName: currentPatientName,
                        imageBase64: viewerRef.current?.getCurrentImageBase64?.() || undefined,
                    },
                    study_context: {
                        reportId: currentReportId,
                        currentSlice: currentSlice > 0 ? currentSlice - 1 : 0,
                        totalSlices: viewerRef.current?.getTotalSlices?.() || 0,
                        modality: null,
                    },
                    chatHistory: chatMessages.map(m => ({
                        role: m.role,
                        content: m.content,
                    })),
                    sessionId: chatSessionId,
                }),
            });

            // Check if we got an SSE stream back
            const contentType = response.headers.get("content-type") || "";
            
            if (contentType.includes("text/event-stream") && response.body) {
                // ─── SSE Streaming Mode ──────────────────────────────────
                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = "";

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split("\n");
                    buffer = lines.pop() || "";

                    for (const line of lines) {
                        if (!line.startsWith("data: ")) continue;
                        try {
                            const event = JSON.parse(line.slice(6));

                            if (event.type === "status") {
                                setActivityState(prev => ({
                                    ...prev,
                                    currentStatus: event.status,
                                    currentLabel: event.label,
                                    currentTool: event.tool,
                                    completedSteps: prev.currentLabel && prev.currentLabel !== event.label
                                        ? [...prev.completedSteps, { label: prev.currentLabel, tool: prev.currentTool, timestamp: Date.now() }]
                                        : prev.completedSteps,
                                }));
                            } else if (event.type === "complete") {
                                if (event.sessionId) {
                                    setChatSessionId(event.sessionId);
                                }

                                const assistantMessage: ChatMessage = {
                                    id: `msg_${Date.now()}_assistant`,
                                    role: "assistant",
                                    content: event.message || "No response received.",
                                    viewerActions: event.viewer_actions || [],
                                    references: event.references || [],
                                    timestamp: new Date().toISOString(),
                                };

                                setChatMessages(prev => [...prev, assistantMessage]);

                                if (event.viewer_actions && event.viewer_actions.length > 0) {
                                    await handleExecuteActions(event.viewer_actions);
                                }

                                if (event.findings_summary && event.findings_summary.length > 0) {
                                    setAiFindings(prev => [...prev, ...event.findings_summary]);
                                }
                            } else if (event.type === "error") {
                                const errorMessage: ChatMessage = {
                                    id: `msg_${Date.now()}_error`,
                                    role: "assistant",
                                    content: event.message || "⚠️ An error occurred.",
                                    timestamp: new Date().toISOString(),
                                };
                                setChatMessages(prev => [...prev, errorMessage]);
                            }
                        } catch {
                            // Skip malformed JSON lines
                        }
                    }
                }
            } else {
                // ─── Fallback: Non-Streaming JSON Mode ──────────────────
                const data = await response.json();

                if (data.sessionId) {
                    setChatSessionId(data.sessionId);
                }

                const assistantMessage: ChatMessage = {
                    id: `msg_${Date.now()}_assistant`,
                    role: "assistant",
                    content: data.message || "No response received.",
                    viewerActions: data.viewerActions || [],
                    references: data.references || [],
                    timestamp: new Date().toISOString(),
                };

                setChatMessages(prev => [...prev, assistantMessage]);

                if (data.viewerActions && data.viewerActions.length > 0) {
                    await handleExecuteActions(data.viewerActions);
                }

                if (data.findingsSummary && data.findingsSummary.length > 0) {
                    setAiFindings(prev => [...prev, ...data.findingsSummary]);
                }
            }
        } catch (error) {
            console.error("[Copilot] Chat error:", error);
            const errorMessage: ChatMessage = {
                id: `msg_${Date.now()}_error`,
                role: "assistant",
                content: "⚠️ Could not connect to the AI Copilot. Make sure the backend is running.",
                timestamp: new Date().toISOString(),
            };
            setChatMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
            setActivityState(prev => ({ ...prev, isActive: false }));
        }
    }, [isLoading, currentPatientId, currentReportId, currentPatientName, currentSlice, chatMessages, chatSessionId, handleExecuteActions]);

    // ─── Clear AI Findings ───────────────────────────────────────────────────
    const clearAllFindings = useCallback(() => {
        viewerRef.current?.clearAIFindings();
        setAiFindings([]);
    }, []);

    // ─── New Chat Session ────────────────────────────────────────────────────
    const startNewChat = useCallback(() => {
        setChatSessionId(`session_${Date.now()}`);
        setChatMessages([]);
        clearAllFindings();
    }, [clearAllFindings]);

    // ─── Patient Context ─────────────────────────────────────────────────────
    const patientContext: CopilotPatientContext = {
        patientId: currentPatientId,
        currentReportId: currentReportId,
        patientName: currentPatientName,
    };

    // ─── Load Chat Session ───────────────────────────────────────────────────
    const loadSession = useCallback(async (sessionId: string) => {
        setIsLoading(true);
        try {
            const res = await fetch(`/api/copilot/history?sessionId=${encodeURIComponent(sessionId)}`);
            const data = await res.json();
            if (Array.isArray(data)) {
                setChatSessionId(sessionId);
                setChatMessages(data);
            }
        } catch (err) {
            console.error("[Copilot] Error loading session:", err);
        } finally {
            setIsLoading(false);
        }
    }, [setChatSessionId, setChatMessages, setIsLoading]);

    const handleReportSelect = useCallback((reportId: string) => {
        setCurrentReportId(reportId);
        setActiveTab("report");
    }, []);

    const handlePatientContext = useCallback((pid: string, pname?: string) => {
        setCurrentPatientId(prev => prev !== pid ? pid : prev);
        if (pname) {
            setCurrentPatientName(prev => prev !== pname ? pname : prev);
        }
    }, []);

    return (
        <div className="flex h-full overflow-hidden">
            {/* Left Panel — 60% Viewer */}
            <div className="w-[60%] min-w-[400px] border-r border-border-primary flex flex-col bg-bg-primary overflow-hidden">
                <ViewerPanel
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                    currentReportId={currentReportId}
                    currentStudyId={currentStudyId}
                    currentSlice={currentSlice}
                    currentPatientId={currentPatientId}
                    onReportSelect={handleReportSelect}
                    onPatientContext={handlePatientContext}
                    viewerRef={viewerRef}
                />
                {/* AI Findings List (below viewer when findings exist) */}
                <FindingsList
                    findings={aiFindings}
                    viewerRef={viewerRef.current}
                    onClearAll={clearAllFindings}
                />
            </div>

            {/* Right Panel — 40% AI Copilot */}
            <div className="w-[40%] min-w-[340px] flex flex-col bg-bg-surface overflow-hidden">
                <CopilotPanel
                    messages={chatMessages}
                    isLoading={isLoading}
                    activityState={activityState}
                    onSendMessage={sendMessage}
                    onReferenceClick={handleReferenceClick}
                    onExecuteActions={handleExecuteActions}
                    onNewChat={startNewChat}
                    onLoadSession={loadSession}
                    patientContext={patientContext}
                    findingsCount={aiFindings.length}
                />
            </div>
        </div>
    );
}
