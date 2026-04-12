"use client";

import { useState, useEffect } from "react";
import { Clock, MessageSquare, Trash2, ChevronRight, User } from "lucide-react";

interface SessionHistory {
    sessionId: string;
    patientId: string | null;
    patientName: string | null;
    lastMessage: string;
    messageCount: number;
    createdAt: string;
    updatedAt: string;
}

interface ChatHistoryPanelProps {
    onSelectSession: (sessionId: string) => void;
    onClose: () => void;
}

export default function ChatHistoryPanel({ onSelectSession, onClose }: ChatHistoryPanelProps) {
    const [sessions, setSessions] = useState<SessionHistory[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchHistory = () => {
        setIsLoading(true);
        fetch("/api/copilot/history")
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) {
                    setSessions(data);
                }
            })
            .catch(err => console.error("Error fetching copilot history:", err))
            .finally(() => setIsLoading(false));
    };

    useEffect(() => {
        fetchHistory();
    }, []);

    const handleClearAll = async () => {
        if (!confirm("Are you sure you want to clear all Copilot chat history? This cannot be undone.")) return;
        
        try {
            await fetch("/api/copilot/history", { method: "DELETE" });
            setSessions([]);
        } catch (err) {
            console.error("Error clearing history:", err);
            alert("Failed to clear history.");
        }
    };

    // Format relative time (e.g., "2 hours ago")
    const getRelativeTime = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
        
        if (diffInSeconds < 60) return "Just now";
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
        if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
        return date.toLocaleDateString();
    };

    return (
        <div className="absolute inset-0 z-50 bg-bg-surface flex flex-col animate-in slide-in-from-right-4 duration-200">
            {/* Header */}
            <div className="shrink-0 px-5 py-4 border-b border-border-primary flex items-center justify-between bg-bg-panel/50">
                <div className="flex items-center gap-2">
                    <button 
                        onClick={onClose}
                        className="p-1 -ml-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-black/5 transition-all"
                    >
                        <ChevronRight size={20} className="rotate-180" />
                    </button>
                    <h3 className="text-sm font-bold text-text-heading flex items-center gap-2">
                        <Clock size={16} className="text-primary" />
                        Chat History
                    </h3>
                </div>
                {sessions.length > 0 && (
                    <button
                        onClick={handleClearAll}
                        className="text-xs flex items-center gap-1.5 text-text-muted hover:text-red-500 transition-colors px-2 py-1 rounded"
                    >
                        <Trash2 size={14} />
                        Clear All
                    </button>
                )}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {isLoading ? (
                    <div className="flex justify-center p-8 text-text-muted">
                        <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                    </div>
                ) : sessions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 text-center text-text-muted">
                        <MessageSquare size={32} className="opacity-20 mb-3" />
                        <p className="text-sm">No chat history found.</p>
                    </div>
                ) : (
                    sessions.map(session => (
                        <button
                            key={session.sessionId}
                            onClick={() => onSelectSession(session.sessionId)}
                            className="w-full text-left p-3 rounded-xl border border-border-card bg-bg-panel hover:border-primary/30 hover:bg-primary/5 transition-all group"
                        >
                            <div className="flex justify-between items-start mb-1.5">
                                <div className="flex items-center gap-1.5 text-xs font-semibold text-text-heading">
                                    <MessageSquare size={12} className="text-primary" />
                                    {session.messageCount} messages
                                </div>
                                <span className="text-[10px] text-text-muted font-medium">
                                    {getRelativeTime(session.updatedAt)}
                                </span>
                            </div>
                            
                            <p className="text-sm text-text-primary line-clamp-2 leading-relaxed mb-2">
                                {session.lastMessage || "No text"}
                            </p>
                            
                            {session.patientId && (
                                <div className="flex items-center gap-1.5 text-xs text-text-secondary bg-black/5 dark:bg-white/5 w-fit px-2 py-1 rounded-md">
                                    <User size={12} />
                                    <span className="truncate max-w-[150px]">
                                        {session.patientName || session.patientId}
                                    </span>
                                </div>
                            )}
                        </button>
                    ))
                )}
            </div>
        </div>
    );
}
