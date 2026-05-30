"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { ChatMessage as ChatMessageType, Reference, CopilotPatientContext, QuickAction, ActivityState } from "@/types/copilot";
import ChatMessage from "./ChatMessage";
import ChatHistoryPanel from "./ChatHistoryPanel";
import ActivityIndicator from "./ActivityIndicator";
import { Bot, Send, Plus, Trash2, Sparkles, FileText, GitCompare, Clock, Stethoscope } from "lucide-react";

interface CopilotPanelProps {
    messages: ChatMessageType[];
    isLoading: boolean;
    activityState: ActivityState;
    onSendMessage: (message: string) => void;
    onReferenceClick: (ref: Reference) => void;
    onExecuteActions?: (actions: any[]) => void;
    onNewChat: () => void;
    onLoadSession: (sessionId: string) => void;
    patientContext: CopilotPatientContext;
    findingsCount?: number;
}

const QUICK_ACTIONS: QuickAction[] = [
    { label: "Summarize history", prompt: "Summarize this patient's report history", icon: "📋" },
    { label: "Compare with previous", prompt: "Compare the current report with the previous one", icon: "🔄" },
    { label: "Highlight findings", prompt: "Highlight the findings from the report on the image", icon: "🎯" },
    { label: "Where is the lesion?", prompt: "Where is the lesion in this image?", icon: "🔍" },
    { label: "Point to abnormality", prompt: "Point to the abnormal area", icon: "👆" },
    { label: "Show suspicious region", prompt: "Highlight the suspicious region", icon: "⚠️" },
    { label: "Clear AI findings", prompt: "Clear all AI findings", icon: "🧹" },
];

export default function CopilotPanel({
    messages,
    isLoading,
    activityState,
    onSendMessage,
    onReferenceClick,
    onExecuteActions,
    onNewChat,
    onLoadSession,
    patientContext,
    findingsCount = 0,
}: CopilotPanelProps) {
    const [inputValue, setInputValue] = useState("");
    const [showHistory, setShowHistory] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Prevent hydration mismatch
    useEffect(() => {
        setIsMounted(true);
    }, []);

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isLoading]);

    // Auto-focus input
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const handleSend = useCallback(() => {
        if (!inputValue.trim() || isLoading) return;
        onSendMessage(inputValue.trim());
        setInputValue("");
        // Reset textarea height
        if (inputRef.current) {
            inputRef.current.style.height = "auto";
        }
    }, [inputValue, isLoading, onSendMessage]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    // Auto-resize textarea
    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInputValue(e.target.value);
        e.target.style.height = "auto";
        e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
    };

    return (
        <div className="flex flex-col h-full relative overflow-hidden">
            {/* Header */}
            <div className="shrink-0 px-5 py-4 border-b border-border-primary bg-bg-surface">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                            <Bot size={18} className="text-white" />
                        </div>
                        <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-text-heading">AI Copilot</h3>
                            {findingsCount > 0 && (
                                <span className="flex items-center gap-1 text-[10px] font-bold text-red-400 bg-red-500/15 px-2 py-0.5 rounded-full">
                                    <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                                    {findingsCount}
                                </span>
                            )}
                        </div>
                            <p className="text-[11px] text-text-muted">
                                {patientContext.patientName
                                    ? `Patient: ${patientContext.patientName}`
                                    : "Ready to assist"}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={() => setShowHistory(true)}
                            className="p-2 rounded-lg text-text-muted hover:text-primary hover:bg-bg-panel transition-all"
                            title="Chat History"
                        >
                            <Clock size={16} />
                        </button>
                        <button
                            onClick={onNewChat}
                            className="p-2 rounded-lg text-text-muted hover:text-primary hover:bg-bg-panel transition-all"
                            title="New chat"
                        >
                            <Plus size={16} />
                        </button>
                    </div>
                </div>
            </div>

            {/* History Panel Overlay */}
            {showHistory && (
                <ChatHistoryPanel 
                    onClose={() => setShowHistory(false)}
                    onSelectSession={(id) => {
                        onLoadSession(id);
                        setShowHistory(false);
                    }}
                />
            )}

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                {!isMounted ? (
                    <div className="flex-1 opacity-0" />
                ) : messages.length === 0 ? (
                    <WelcomeMessage
                        onQuickAction={onSendMessage}
                        patientContext={patientContext}
                    />
                ) : (
                    <>
                        {messages.map((msg) => (
                            <ChatMessage
                                key={msg.id}
                                message={msg}
                                onReferenceClick={onReferenceClick}
                                onExecuteActions={onExecuteActions}
                            />
                        ))}

                        {/* Streaming Activity Indicator */}
                        {(isLoading || activityState.isActive) && (
                            <ActivityIndicator activityState={activityState} />
                        )}
                    </>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Quick Actions (shown when there's context) */}
            {messages.length > 0 && patientContext.patientId && !isLoading && (
                <div className="shrink-0 px-4 pb-2 flex gap-1.5 overflow-x-auto">
                    {QUICK_ACTIONS.map((action) => (
                        <button
                            key={action.label}
                            onClick={() => onSendMessage(action.prompt)}
                            className="shrink-0 text-xs px-3 py-1.5 rounded-full border border-border-card
                                text-text-secondary hover:text-primary hover:border-primary/30 hover:bg-primary/5
                                transition-all duration-150 whitespace-nowrap"
                        >
                            {action.icon} {action.label}
                        </button>
                    ))}
                </div>
            )}

            {/* Input Area */}
            <div className="shrink-0 px-4 py-3 border-t border-border-primary bg-bg-surface">
                <div className="flex items-end gap-2 bg-bg-panel rounded-xl border border-border-card p-2 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
                    <textarea
                        ref={inputRef}
                        value={inputValue}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask about a patient, report, or scan..."
                        rows={1}
                        className="flex-1 bg-transparent text-sm text-text-primary placeholder-text-muted resize-none outline-none px-2 py-1.5 max-h-[120px]"
                        disabled={isLoading}
                    />
                    <button
                        onClick={handleSend}
                        disabled={!inputValue.trim() || isLoading}
                        className={`
                            shrink-0 p-2 rounded-lg transition-all duration-200
                            ${inputValue.trim() && !isLoading
                                ? "bg-primary text-white hover:bg-primary-hover shadow-md shadow-primary/25"
                                : "bg-border-card text-text-muted cursor-not-allowed"
                            }
                        `}
                    >
                        <Send size={16} />
                    </button>
                </div>
                <p className="text-[10px] text-text-muted mt-1.5 text-center opacity-60">
                    Press Enter to send • Shift+Enter for new line
                </p>
            </div>
        </div>
    );
}

// ─── Welcome Message ─────────────────────────────────────────────────────────
function WelcomeMessage({
    onQuickAction,
    patientContext,
}: {
    onQuickAction: (prompt: string) => void;
    patientContext: CopilotPatientContext;
}) {
    return (
        <div className="flex flex-col items-center justify-center h-full text-center px-6 py-8">
            {/* Logo */}
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center mb-6 shadow-2xl shadow-emerald-500/20">
                <Sparkles size={28} className="text-white" />
            </div>

            <h3 className="text-xl font-bold text-text-heading mb-2">
                OpenRad AI Copilot
            </h3>
            <p className="text-sm text-text-muted mb-8 max-w-sm">
                I can help you navigate patient reports, compare studies, summarize findings, and more.
            </p>

            {/* Suggestion Cards */}
            <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
                <SuggestionCard
                    icon={<FileText size={18} />}
                    title="View Report"
                    description="Show me the report for patient..."
                    onClick={() => onQuickAction("Show me the latest report")}
                />
                <SuggestionCard
                    icon={<GitCompare size={18} />}
                    title="Compare Studies"
                    description="Compare current with previous"
                    onClick={() => onQuickAction("Compare current report with previous")}
                />
                <SuggestionCard
                    icon={<Clock size={18} />}
                    title="Patient History"
                    description="Summarize patient timeline"
                    onClick={() => onQuickAction("Summarize this patient's history")}
                />
                <SuggestionCard
                    icon={<Stethoscope size={18} />}
                    title="Clinical Query"
                    description="What changed from the last study?"
                    onClick={() => onQuickAction("What changed from the previous report?")}
                />
            </div>
        </div>
    );
}

function SuggestionCard({
    icon,
    title,
    description,
    onClick,
}: {
    icon: React.ReactNode;
    title: string;
    description: string;
    onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className="
                group flex flex-col items-start gap-2 p-4 rounded-xl
                bg-bg-panel border border-border-card
                hover:border-primary/30 hover:bg-primary/5
                transition-all duration-200 text-left
            "
        >
            <span className="text-primary group-hover:scale-110 transition-transform duration-200">
                {icon}
            </span>
            <div>
                <p className="text-sm font-semibold text-text-heading">{title}</p>
                <p className="text-xs text-text-muted mt-0.5">{description}</p>
            </div>
        </button>
    );
}
