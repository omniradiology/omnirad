"use client";

import { useState, useCallback, useEffect } from "react";
import { ViewerAction, ViewerTab, ChatMessage, CopilotPatientContext, Reference } from "@/types/copilot";
import ViewerPanel from "./ViewerPanel";
import CopilotPanel from "./CopilotPanel";

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

    // Persist chat state
    useEffect(() => {
        if (typeof window !== "undefined") {
            sessionStorage.setItem("copilot_session_id", chatSessionId);
            sessionStorage.setItem("copilot_messages", JSON.stringify(chatMessages));
        }
    }, [chatSessionId, chatMessages]);

    // ─── Core Bridge Function: AI → Viewer ───────────────────────────────────
    const executeViewerAction = useCallback((action: ViewerAction) => {
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

    const handleReferenceClick = useCallback((ref: Reference) => {
        executeViewerAction(ref.viewerAction);
    }, [executeViewerAction]);

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

        try {
            const response = await fetch("/api/copilot/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: messageText,
                    patientContext: {
                        patientId: currentPatientId,
                        currentReportId: currentReportId,
                        patientName: currentPatientName,
                    },
                    chatHistory: chatMessages.map(m => ({
                        role: m.role,
                        content: m.content,
                    })),
                    sessionId: chatSessionId,
                }),
            });

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

            // Execute viewer actions from the AI response
            if (data.viewerActions && data.viewerActions.length > 0) {
                for (const action of data.viewerActions) {
                    executeViewerAction(action);
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
        }
    }, [isLoading, currentPatientId, currentReportId, currentPatientName, chatMessages, chatSessionId, executeViewerAction]);

    // ─── New Chat Session ────────────────────────────────────────────────────
    const startNewChat = useCallback(() => {
        setChatSessionId(`session_${Date.now()}`);
        setChatMessages([]);
    }, []);

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
                // Future: We could auto-load the latest patient Context here,
                // but for now, just viewing the chat is enough.
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
                />
            </div>

            {/* Right Panel — 40% AI Copilot */}
            <div className="w-[40%] min-w-[340px] flex flex-col bg-bg-surface overflow-hidden">
                <CopilotPanel
                    messages={chatMessages}
                    isLoading={isLoading}
                    onSendMessage={sendMessage}
                    onReferenceClick={handleReferenceClick}
                    onNewChat={startNewChat}
                    onLoadSession={loadSession}
                    patientContext={patientContext}
                />
            </div>
        </div>
    );
}
