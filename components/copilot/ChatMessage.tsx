"use client";

import { ChatMessage as ChatMessageType, Reference } from "@/types/copilot";
import ClickableReference from "./ClickableReference";
import { Bot, User, Eye, Scan, FileText, ClipboardList, ZoomIn, Sparkles, Layers } from "lucide-react";

import React from "react";

// A simple local markdown renderer
function SimpleMarkdown({ content }: { content: string }) {
    if (!content) return null;
    
    // Split by lines to handle list item blocks and paragraphs
    const lines = content.split('\n');
    const elements: React.ReactNode[] = [];
    
    let inList = false;
    let currentList: React.ReactNode[] = [];
    
    const parseInline = (text: string, key: string) => {
        // Handle bold **text**
        let parts = text.split(/(\*\*.*?\*\*)/g);
        return parts.map((part, i) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={`${key}-b-${i}`}>{part.slice(2, -2)}</strong>;
            }
            // Handle italic *text* or _text_ inside
            let subParts = part.split(/(\*.*?\*|_.*?_)/g);
            return subParts.map((sp, j) => {
                if ((sp.startsWith('*') && sp.endsWith('*')) || (sp.startsWith('_') && sp.endsWith('_'))) {
                    return <em key={`${key}-i-${i}-${j}`}>{sp.slice(1, -1)}</em>;
                }
                // Handle inline code `code`
                let codeParts = sp.split(/(`.*?`)/g);
                return codeParts.map((cp, k) => {
                    if (cp.startsWith('`') && cp.endsWith('`')) {
                        return <code key={`${key}-c-${i}-${j}-${k}`} className="bg-black/10 dark:bg-white/10 px-1 py-0.5 rounded text-xs mx-0.5 font-mono">{cp.slice(1, -1)}</code>;
                    }
                    return cp;
                });
            });
        });
    };

    lines.forEach((line, index) => {
        const trimmed = line.trim();
        const isBulletList = trimmed.startsWith('* ') || trimmed.startsWith('- ');
        const isNumList = /^\d+\.\s/.test(trimmed);
        
        if (isBulletList || isNumList) {
            if (!inList) inList = true;
            // remove the marker
            const cleanLine = trimmed.replace(/^(\* |- |\d+\.\s)/, '');
            currentList.push(
                <li key={`li-${index}`} className="ml-4 mt-1 list-inside">
                    {isBulletList ? <span className="mr-2 opacity-70">•</span> : null}
                    {parseInline(cleanLine, `li-inline-${index}`)}
                </li>
            );
        } else {
            // End list if we were in one
            if (inList) {
                elements.push(<ul key={`ul-${index}`} className="my-2">{currentList}</ul>);
                inList = false;
                currentList = [];
            }
            
            if (trimmed === '') {
                // empty line = spacer
                elements.push(<div key={`br-${index}`} className="h-2" />);
            } else {
                elements.push(
                    <p key={`p-${index}`} className="mb-2 last:mb-0">
                        {parseInline(line, `p-inline-${index}`)}
                    </p>
                );
            }
        }
    });

    if (inList) {
        elements.push(<ul key="ul-last" className="my-2">{currentList}</ul>);
    }

    return <div className="markdown-body">{elements}</div>;
}

// ── Determine label + style for a single replay button ───────────────────────
function getActionButtonStyle(actions: any[]): {
    label: string;
    icon: React.ReactNode;
    bgClass: string;
    textClass: string;
    borderClass: string;
    hoverClass: string;
} | null {
    if (!actions || actions.length === 0) return null;

    const hasFindings = actions.some(
        (a) => a?.type === "annotation" || a?.type === "segmentation"
    );
    const hasReport = actions.some((a) => a?.type === "OPEN_REPORT");
    const hasMetadata = actions.some((a) => a?.type === "OPEN_METADATA");
    const hasViewport = actions.some((a) => a?.type === "viewport");
    const hasClear = actions.some((a) => a?.type === "clear");

    if (hasFindings) {
        return {
            label: "View AI Findings",
            icon: <Sparkles size={13} />,
            bgClass: "bg-emerald-500/10",
            textClass: "text-emerald-400",
            borderClass: "border-emerald-500/25",
            hoverClass: "hover:bg-emerald-500/20 hover:border-emerald-500/40",
        };
    }
    if (hasViewport) {
        return {
            label: "Zoom to Region",
            icon: <ZoomIn size={13} />,
            bgClass: "bg-rose-500/10",
            textClass: "text-rose-400",
            borderClass: "border-rose-500/25",
            hoverClass: "hover:bg-rose-500/20 hover:border-rose-500/40",
        };
    }
    if (hasReport) {
        return {
            label: "View Report",
            icon: <FileText size={13} />,
            bgClass: "bg-violet-500/10",
            textClass: "text-violet-400",
            borderClass: "border-violet-500/25",
            hoverClass: "hover:bg-violet-500/20 hover:border-violet-500/40",
        };
    }
    if (hasMetadata) {
        return {
            label: "View Patient Info",
            icon: <ClipboardList size={13} />,
            bgClass: "bg-amber-500/10",
            textClass: "text-amber-400",
            borderClass: "border-amber-500/25",
            hoverClass: "hover:bg-amber-500/20 hover:border-amber-500/40",
        };
    }
    if (hasClear) {
        return {
            label: "Clear Findings",
            icon: <Layers size={13} />,
            bgClass: "bg-slate-500/10",
            textClass: "text-slate-400",
            borderClass: "border-slate-500/25",
            hoverClass: "hover:bg-slate-500/20 hover:border-slate-500/40",
        };
    }

    // Default for OPEN_DICOM / navigate / other
    return {
        label: "Open in Viewer",
        icon: <Scan size={13} />,
        bgClass: "bg-sky-500/10",
        textClass: "text-sky-400",
        borderClass: "border-sky-500/25",
        hoverClass: "hover:bg-sky-500/20 hover:border-sky-500/40",
    };
}

interface ChatMessageProps {
    message: ChatMessageType;
    onReferenceClick: (ref: Reference) => void;
    onExecuteActions?: (actions: any[]) => void;
}

export default function ChatMessage({ message, onReferenceClick, onExecuteActions }: ChatMessageProps) {
    const isUser = message.role === "user";
    const hasViewerActions = message.viewerActions && message.viewerActions.length > 0;
    const hasReferences = message.references && message.references.length > 0;

    const actionStyle = hasViewerActions ? getActionButtonStyle(message.viewerActions!) : null;

    return (
        <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
            {/* Avatar */}
            <div className={`
                shrink-0 w-8 h-8 rounded-full flex items-center justify-center
                ${isUser
                    ? "bg-primary/20 text-primary"
                    : "bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 text-emerald-400"
                }
            `}>
                {isUser ? <User size={16} /> : <Bot size={16} />}
            </div>

            {/* Message Content */}
            <div className={`flex flex-col max-w-[85%] ${isUser ? "items-end" : "items-start"}`}>
                {/* Bubble */}
                <div className={`
                    rounded-2xl px-4 py-3 text-sm leading-relaxed
                    ${isUser
                        ? "bg-primary text-white rounded-br-md"
                        : "bg-bg-panel border border-border-card text-text-primary rounded-bl-md"
                    }
                `}>
                    {/* Render message with simple markdown */}
                    <SimpleMarkdown content={
                        typeof message.content === "string" 
                            ? message.content 
                            : Array.isArray(message.content)
                                ? message.content.map((c: any) => c.text || JSON.stringify(c)).join("\n")
                                : JSON.stringify(message.content)
                    } />
                </div>

                {/* References */}
                {hasReferences && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                        {message.references!.map((ref) => (
                            <ClickableReference
                                key={ref.id}
                                reference={ref}
                                onClick={onReferenceClick}
                            />
                        ))}
                    </div>
                )}

                {/* Single Viewer Action Button */}
                {actionStyle && (
                    <button
                        onClick={() => onExecuteActions?.(message.viewerActions!)}
                        className={`
                            flex items-center gap-1.5 px-3 py-1.5 mt-2 rounded-lg text-xs font-medium
                            border transition-all duration-200 cursor-pointer
                            ${actionStyle.bgClass} ${actionStyle.textClass} ${actionStyle.borderClass} ${actionStyle.hoverClass}
                        `}
                    >
                        {actionStyle.icon}
                        {actionStyle.label}
                    </button>
                )}

                {/* Timestamp */}
                <p className="text-[10px] text-text-muted mt-1 opacity-60">
                    {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
            </div>
        </div>
    );
}

