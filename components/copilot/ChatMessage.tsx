"use client";

import { ChatMessage as ChatMessageType, Reference } from "@/types/copilot";
import ClickableReference from "./ClickableReference";
import { Bot, User, Eye } from "lucide-react";

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

interface ChatMessageProps {
    message: ChatMessageType;
    onReferenceClick: (ref: Reference) => void;
}

export default function ChatMessage({ message, onReferenceClick }: ChatMessageProps) {
    const isUser = message.role === "user";
    const hasViewerActions = message.viewerActions && message.viewerActions.length > 0;
    const hasReferences = message.references && message.references.length > 0;

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

                {/* Viewer Action Indicator */}
                {hasViewerActions && (
                    <div className="flex items-center gap-1.5 mt-1.5 text-xs text-text-muted">
                        <Eye size={12} className="text-primary" />
                        <span>
                            {message.viewerActions!.map((a: any) => {
                                if (!a) return "";
                                switch (a.type) {
                                    case "OPEN_REPORT": return `📄 Opened report in viewer`;
                                    case "OPEN_DICOM": return `🔬 Opened scan in viewer`;
                                    case "OPEN_METADATA": return `📋 Opened patient info`;
                                    default: return `Updated viewer`;
                                }
                            }).filter(Boolean).join(" • ")}
                        </span>
                    </div>
                )}

                {/* Timestamp */}
                <p className="text-[10px] text-text-muted mt-1 opacity-60">
                    {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
            </div>
        </div>
    );
}
