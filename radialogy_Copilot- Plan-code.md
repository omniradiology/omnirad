Comprehensive Analysis of Your OpenRad AI Copilot Plan

I've thoroughly analyzed the OpenRad repository and your development plan. Let me give you a detailed verification and the best approach to make this work.
-------------------------

1. Repository Analysis Summary

Current OpenRad Architecture:
- Framework: Next.js (App Router, React 19)
- Styling: Tailwind CSS v4
- Database: Local SQLite (Drizzle ORM) + Supabase (optional cloud sync)
- AI Integration: Currently uses n8n webhook → external AI model (Gemini/OpenAI)
- Storage: DICOM images cached locally in SQLite, text-only to Supabase
- Notable file: LangGraph-migration.md — This tells me the repo is already considering or has started a LangGraph migration, which aligns perfectly with your plan.
-------------------------

2. Plan Verification: Will It Work? ✅

Short answer: YES — your plan is architecturally sound and compatible with OpenRad. But there are critical adjustments needed to make it work cleanly. Let me break it down:
✅ What Works Well

| Plan Item | Compatibility | Notes |
|---|---|---|
| Split-panel Cursor-style UI | ✅ | Next.js App Router + Tailwind CSS v4 fully supports this |
| Tab-based viewer (DICOM, REPORT, METADATA) | ✅ | Can be built as React components with state-driven tab switching |
| AI Chat panel | ✅ | Streaming chat fits Next.js API routes / Server Actions |
| SQLite tool calls (get_patient_reports, etc.) | ✅ | Drizzle ORM is already configured — just add new query functions |
| LangGraph agent | ✅ | The repo already has `LangGraph-migration.md` — this was planned |
| LangSmith tracing | ✅ | Drop-in with LangGraph — just set env vars |
| Viewer action tools (AI → UI bridge) | ✅ | Achievable via structured JSON responses + React state |
| Second AI model credential in settings | ✅ | Settings already save to SQLite — just extend the schema |
| Docker hosting | ✅ | Requires specific adjustments (see below) |



⚠️ What Needs Careful Design


- "AI highlights slice 32" — This requires the AI to have spatial understanding of DICOM data, which is a complex computer vision task. You'd need a specialized model or pre-processing pipeline.
- Real-time viewer sync — The AI response → viewer update bridge needs a robust event system.
-------------------------

3. Best Architecture Implementation

Here's how I recommend building this to work cleanly with OpenRad:
A. Folder Structure Changes


openrad/
├── app/
│   ├── workspace/              # NEW - Main copilot workspace page
│   │   └── page.tsx
│   ├── api/
│   │   ├── chat/              # NEW - Chat streaming endpoint
│   │   │   └── route.ts
│   │   ├── tools/             # NEW - AI tool endpoints
│   │   │   ├── reports/
│   │   │   │   └── route.ts
│   │   │   ├── scans/
│   │   │   │   └── route.ts
│   │   │   └── compare/
│   │   │       └── route.ts
│   │   └── settings/
│   │       └── route.ts       # EXTEND - Add chat model credentials
│   ├── dashboard/
│   └── settings/
├── components/
│   ├── workspace/             # NEW
│   │   ├── WorkspaceLayout.tsx      # Split panel container
│   │   ├── ViewerPanel.tsx          # Left 60%
│   │   ├── CopilotPanel.tsx         # Right 40%
│   │   ├── DicomViewer.tsx          # DICOM tab
│   │   ├── ReportViewer.tsx         # Report tab
│   │   ├── MetadataViewer.tsx       # Metadata tab
│   │   ├── FilesList.tsx            # Associated files
│   │   ├── ChatMessage.tsx          # Chat bubble with references
│   │   ├── ClickableReference.tsx   # Clickable study/report link
│   │   └── ViewerTabSwitcher.tsx    # Tab control
│   └── ... (existing components)
├── ai_service/                # EXTEND
│   ├── langgraph/             # NEW
│   │   ├── agent.ts           # Main LangGraph agent definition
│   │   ├── nodes/
│   │   │   ├── chat_node.ts
│   │   │   ├── tool_node.ts
│   │   │   └── viewer_action_node.ts  # Returns UI commands
│   │   ├── tools/
│   │   │   ├── get_patient_reports.ts
│   │   │   ├── get_latest_report.ts
│   │   │   ├── get_report_by_id.ts
│   │   │   ├── compare_reports.ts
│   │   │   ├── get_scan_path.ts
│   │   │   └── load_dicom_image.ts
│   │   ├── state.ts           # LangGraph state definition
│   │   └── graph.ts           # Graph compilation
│   └── webhook.ts             # Existing n8n integration
├── db/
│   ├── schema.ts              # EXTEND - Add chat_messages table
│   ├── queries/               # NEW - Reusable DB query functions
│   │   ├── reports.ts
│   │   ├── patients.ts
│   │   └── scans.ts
│   └── ...
├── lib/
│   ├── viewer-actions.ts      # NEW - Viewer action type definitions
│   ├── chat-context.tsx       # NEW - React context for chat state
│   └── ...
├── types/
│   ├── chat.ts                # NEW
│   ├── viewer-action.ts       # NEW
│   └── ...


B. The Viewer Action System (Core Innovation)

This is the most critical part — the bridge between AI and UI:

// types/viewer-action.ts
export type ViewerAction = 
  | { type: 'OPEN_REPORT'; reportId: string; patientName?: string }
  | { type: 'OPEN_DICOM'; studyId: string; slice?: number }
  | { type: 'OPEN_METADATA'; patientId: string }
  | { type: 'SWITCH_TAB'; tab: 'dicom' | 'report' | 'metadata' }
  | { type: 'HIGHLIGHT_REGION'; slice: number; coordinates?: { x: number; y: number; w: number; h: number } }
  | { type: 'COMPARE_VIEW'; reportId1: string; reportId2: string }
  | null;

export interface AIChatResponse {
  message: string;            // Text response to user
  viewerAction: ViewerAction; // UI instruction
  references: Reference[];    // Clickable references
}

export interface Reference {
  id: string;
  type: 'report' | 'study' | 'scan';
  label: string;              // Display text
  viewerAction: ViewerAction; // What happens on click
}



// ai_service/langgraph/tools/viewer_action_tool.ts
import { tool } from "@langchain/core/tools";
import { z } from "zod";

export const openReportInViewer = tool(
  async ({ reportId, patientName }) => {
    // This doesn't actually open anything server-side
    // It returns a structured command that the frontend will execute
    return JSON.stringify({
      viewerAction: {
        type: 'OPEN_REPORT',
        reportId,
        patientName
      },
      narration: `Opening report ${reportId} for ${patientName} in the viewer.`
    });
  },
  {
    name: "open_report_in_viewer",
    description: "Opens a specific report in the viewer panel for the user to see",
    schema: z.object({
      reportId: z.string().describe("The report ID to display"),
      patientName: z.string().optional().describe("Patient name for context"),
    }),
  }
);

export const openDicomInViewer = tool(
  async ({ studyId, slice }) => {
    return JSON.stringify({
      viewerAction: {
        type: 'OPEN_DICOM',
        studyId,
        slice: slice ?? 1
      },
      narration: `Switching to DICOM viewer for study ${studyId}${slice ? `, slice ${slice}` : ''}.`
    });
  },
  {
    name: "open_dicom_in_viewer",
    description: "Opens a DICOM study in the image viewer, optionally at a specific slice",
    schema: z.object({
      studyId: z.string().describe("The study/scan ID"),
      slice: z.number().optional().describe("Specific slice number to navigate to"),
    }),
  }
);


C. LangGraph Agent Architecture


// ai_service/langgraph/state.ts
import { Annotation } from "@langchain/langgraph";
import { BaseMessage } from "@langchain/core/messages";
import { ViewerAction, Reference } from "@/types/viewer-action";

export const AgentState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({ reducer: (a, b) => [...a, ...b] }),
  patientContext: Annotation<{ patientId?: string; currentReportId?: string }>(),
  viewerActions: Annotation<ViewerAction[]>({ reducer: (a, b) => [...a, ...b] }),
  references: Annotation<Reference[]>({ reducer: (a, b) => [...a, ...b] }),
});



// ai_service/langgraph/graph.ts
import { StateGraph } from "@langchain/langgraph";
import { AgentState } from "./state";
import { ChatOpenAI } from "@langchain/openai";  // or ChatGoogleGenerativeAI
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { 
  getPatientReports, getLatestReport, getReportById, 
  compareReports, getScanPath 
} from "./tools";
import { openReportInViewer, openDicomInViewer } from "./tools/viewer_action_tool";

// All tools available to the agent
const tools = [
  getPatientReports,
  getLatestReport,
  getReportById,
  compareReports,
  getScanPath,
  openReportInViewer,
  openDicomInViewer,
];

const model = new ChatOpenAI({
  model: "gpt-4o",  // or configured model from settings
  temperature: 0,
}).bindTools(tools);

const toolNode = new ToolNode(tools);

// Define nodes
async function agentNode(state: typeof AgentState.State) {
  const systemPrompt = `You are OpenRad AI Copilot, a radiology assistant.
You have access to patient reports, scans, and viewer controls.
When discussing specific reports or scans, ALWAYS use the viewer tools to open them.
When comparing studies, retrieve both reports and use compare_reports tool.
Be concise, clinically relevant, and always cite report dates.`;

  const response = await model.invoke([
    { role: "system", content: systemPrompt },
    ...state.messages
  ]);
  
  return { messages: [response] };
}

function shouldContinue(state: typeof AgentState.State) {
  const lastMessage = state.messages[state.messages.length - 1];
  if (lastMessage.additional_kwargs?.tool_calls?.length > 0) {
    return "tools";
  }
  return "end";
}

// Build graph
const graph = new StateGraph(AgentState)
  .addNode("agent", agentNode)
  .addNode("tools", toolNode)
  .addEdge("__start__", "agent")
  .addConditionalEdges("agent", shouldContinue, {
    tools: "tools",
    end: "__end__",
  })
  .addEdge("tools", "agent");

export const compiledGraph = graph.compile();


D. Streaming API Route


// app/api/chat/route.ts
import { NextRequest } from "next/server";
import { compiledGraph } from "@/ai_service/langgraph/graph";
import { HumanMessage } from "@langchain/core/messages";
import { Client } from "langsmith";  // LangSmith tracing

// Enable LangSmith
process.env.LANGCHAIN_TRACING_V2 = "true";

export async function POST(req: NextRequest) {
  const { message, patientContext, chatHistory } = await req.json();
  
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const result = await compiledGraph.invoke({
          messages: [
            ...chatHistory.map((m: any) => 
              m.role === 'user' ? new HumanMessage(m.content) : m
            ),
            new HumanMessage(message)
          ],
          patientContext,
          viewerActions: [],
          references: [],
        });
        
        // Parse viewer actions from tool call results
        const viewerActions: any[] = [];
        const references: any[] = [];
        
        for (const msg of result.messages) {
          if (msg.content && typeof msg.content === 'string') {
            try {
              const parsed = JSON.parse(msg.content);
              if (parsed.viewerAction) {
                viewerActions.push(parsed.viewerAction);
              }
            } catch { /* not JSON, that's fine */ }
          }
        }
        
        const finalMessage = result.messages[result.messages.length - 1];
        
        controller.enqueue(encoder.encode(JSON.stringify({
          type: 'response',
          message: finalMessage.content,
          viewerActions,
          references,
        })));
        
        controller.close();
      } catch (error) {
        controller.enqueue(encoder.encode(JSON.stringify({
          type: 'error',
          message: 'AI processing failed',
        })));
        controller.close();
      }
    }
  });
  
  return new Response(stream, {
    headers: { 'Content-Type': 'application/json' },
  });
}


E. Frontend Workspace Component


// components/workspace/WorkspaceLayout.tsx
"use client";
import { useState, useCallback } from "react";
import { ViewerAction, AIChatResponse, Reference } from "@/types/viewer-action";
import ViewerPanel from "./ViewerPanel";
import CopilotPanel from "./CopilotPanel";

type ViewerTab = "dicom" | "report" | "metadata";

export default function WorkspaceLayout() {
  const [activeTab, setActiveTab] = useState<ViewerTab>("report");
  const [currentReportId, setCurrentReportId] = useState<string | null>(null);
  const [currentStudyId, setCurrentStudyId] = useState<string | null>(null);
  const [currentSlice, setCurrentSlice] = useState<number>(1);
  const [currentPatientId, setCurrentPatientId] = useState<string | null>(null);

  // This is the core bridge function: AI response → Viewer update
  const executeViewerAction = useCallback((action: ViewerAction) => {
    if (!action) return;
    
    switch (action.type) {
      case 'OPEN_REPORT':
        setCurrentReportId(action.reportId);
        setActiveTab('report');
        break;
      case 'OPEN_DICOM':
        setCurrentStudyId(action.studyId);
        if (action.slice) setCurrentSlice(action.slice);
        setActiveTab('dicom');
        break;
      case 'OPEN_METADATA':
        setCurrentPatientId(action.patientId);
        setActiveTab('metadata');
        break;
      case 'SWITCH_TAB':
        setActiveTab(action.tab);
        break;
      case 'HIGHLIGHT_REGION':
        setCurrentSlice(action.slice);
        setActiveTab('dicom');
        // TODO: Pass highlight coordinates to DICOM viewer
        break;
      case 'COMPARE_VIEW':
        // TODO: Side-by-side comparison mode
        break;
    }
  }, []);

  const handleReferenceClick = useCallback((ref: Reference) => {
    executeViewerAction(ref.viewerAction);
  }, [executeViewerAction]);

  return (
    <div className="flex h-screen bg-background">
      {/* Left Panel - 60% */}
      <div className="w-[60%] border-r border-border flex flex-col">
        <ViewerPanel
          activeTab={activeTab}
          onTabChange={setActiveTab}
          currentReportId={currentReportId}
          currentStudyId={currentStudyId}
          currentSlice={currentSlice}
          currentPatientId={currentPatientId}
        />
      </div>
      
      {/* Right Panel - 40% */}
      <div className="w-[40%] flex flex-col">
        <CopilotPanel
          onViewerAction={executeViewerAction}
          onReferenceClick={handleReferenceClick}
          patientContext={{
            patientId: currentPatientId,
            currentReportId: currentReportId,
          }}
        />
      </div>
    </div>
  );
}



// components/workspace/ViewerPanel.tsx
"use client";
import { useEffect, useState } from "react";

type ViewerTab = "dicom" | "report" | "metadata";

interface ViewerPanelProps {
  activeTab: ViewerTab;
  onTabChange: (tab: ViewerTab) => void;
  currentReportId: string | null;
  currentStudyId: string | null;
  currentSlice: number;
  currentPatientId: string | null;
}

export default function ViewerPanel({
  activeTab, onTabChange, currentReportId, 
  currentStudyId, currentSlice, currentPatientId
}: ViewerPanelProps) {
  const [reportData, setReportData] = useState<any>(null);
  const [files, setFiles] = useState<any[]>([]);

  useEffect(() => {
    if (currentReportId && activeTab === 'report') {
      fetch(`/api/tools/reports?id=${currentReportId}`)
        .then(r => r.json())
        .then(setReportData);
    }
  }, [currentReportId, activeTab]);

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="flex border-b border-border">
        {(['dicom', 'report', 'metadata'] as ViewerTab[]).map(tab => (
          <button
            key={tab}
            onClick={() => onTabChange(tab)}
            className={`px-4 py-2 text-sm font-medium uppercase tracking-wide
              ${activeTab === tab 
                ? 'border-b-2 border-primary text-primary' 
                : 'text-muted-foreground hover:text-foreground'}`}
          >
            {tab === 'dicom' ? '🔬 DICOM' : tab === 'report' ? '📄 REPORT' : '📋 METADATA'}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto p-4">
        {activeTab === 'dicom' && (
          <DicomViewerTab studyId={currentStudyId} slice={currentSlice} />
        )}
        {activeTab === 'report' && (
          <ReportViewerTab reportData={reportData} />
        )}
        {activeTab === 'metadata' && (
          <MetadataViewerTab patientId={currentPatientId} />
        )}
      </div>

      {/* Files List (bottom section) */}
      <div className="border-t border-border p-3 max-h-[200px] overflow-auto">
        <h4 className="text-xs font-semibold text-muted-foreground mb-2">ASSOCIATED FILES</h4>
        {files.map(file => (
          <div key={file.id} className="flex items-center gap-2 py-1 px-2 rounded hover:bg-muted cursor-pointer text-sm">
            <span>{file.type === 'dicom' ? '🔬' : '📄'}</span>
            <span>{file.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}


F. Database Schema Extensions


// db/schema.ts — ADD these to existing schema
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

// Existing tables remain unchanged...

// NEW: Chat messages table
export const chatMessages = sqliteTable("chat_messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: text("session_id").notNull(),
  role: text("role").notNull(), // 'user' | 'assistant'
  content: text("content").notNull(),
  viewerActions: text("viewer_actions"), // JSON string of ViewerAction[]
  references: text("references"),        // JSON string of Reference[]
  patientId: text("patient_id"),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP"),
});

// NEW: AI model settings (extends existing settings)
export const aiChatSettings = sqliteTable("ai_chat_settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  provider: text("provider").notNull(),        // 'openai' | 'google' | 'anthropic'
  modelName: text("model_name").notNull(),     // 'gpt-4o' | 'gemini-pro' etc.
  apiKey: text("api_key").notNull(),           // encrypted
  langsmithApiKey: text("langsmith_api_key"),  // for tracing
  langsmithProject: text("langsmith_project"),
  updatedAt: text("updated_at"),
});


G. Settings Page Extension


// In existing settings page, add a new section:
<section className="space-y-4">
  <h3 className="text-lg font-semibold">AI Copilot Chat Settings</h3>
  
  <div>
    <label>AI Provider</label>
    <select value={chatProvider} onChange={e => setChatProvider(e.target.value)}>
      <option value="openai">OpenAI</option>
      <option value="google">Google Gemini</option>
      <option value="anthropic">Anthropic Claude</option>
    </select>
  </div>
  
  <div>
    <label>Model Name</label>
    <input value={chatModel} onChange={e => setChatModel(e.target.value)} 
           placeholder="gpt-4o" />
  </div>
  
  <div>
    <label>API Key</label>
    <input type="password" value={chatApiKey} 
           onChange={e => setChatApiKey(e.target.value)} />
  </div>
  
  <div>
    <label>LangSmith API Key (optional - for tracing)</label>
    <input type="password" value={langsmithKey} 
           onChange={e => setLangsmithKey(e.target.value)} />
  </div>
  
  <div>
    <label>LangSmith Project Name</label>
    <input value={langsmithProject} 
           onChange={e => setLangsmithProject(e.target.value)}
           placeholder="openrad-copilot" />
  </div>
</section>


-------------------------

4. Docker Deployment Plan ✅

Your plan absolutely works with Docker. Here's the optimal Dockerfile and considerations:
Critical Docker Considerations for OpenRad

- SQLite in Docker — SQLite files need a persistent volume, otherwise data is lost on container restart
- DICOM images — Can be large; need persistent storage
- LangGraph/LangChain — These are Python/JS libraries, no special Docker needs
- Next.js — Has excellent Docker support with standalone output
Dockerfile


# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Stage 2: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build Next.js with standalone output
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Stage 3: Production
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone build
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy Drizzle migrations
COPY --from=builder /app/db/migrations ./db/migrations
COPY --from=builder /app/drizzle.config.ts ./

# Create data directory for SQLite (will be volume-mounted)
RUN mkdir -p /app/data && chown -R nextjs:nodejs /app/data

# SQLite database will live here
ENV DATABASE_URL="file:/app/data/openrad.db"

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]


docker-compose.yml


version: '3.8'

services:
  openrad:
    build: .
    ports:
      - "3000:3000"
    volumes:
      # Persistent SQLite database + DICOM images
      - openrad-data:/app/data
    environment:
      - DATABASE_URL=file:/app/data/openrad.db
      - NODE_ENV=production
      # AI Chat settings (can also be set from UI)
      - OPENAI_API_KEY=${OPENAI_API_KEY:-}
      - LANGCHAIN_TRACING_V2=${LANGCHAIN_TRACING_V2:-false}
      - LANGCHAIN_API_KEY=${LANGCHAIN_API_KEY:-}
      - LANGCHAIN_PROJECT=${LANGCHAIN_PROJECT:-openrad-copilot}
      # Supabase (optional)
      - NEXT_PUBLIC_SUPABASE_URL=${SUPABASE_URL:-}
      - NEXT_PUBLIC_SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY:-}
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  openrad-data:
    driver: local


next.config.ts modification for Docker


// next.config.ts
const nextConfig = {
  output: 'standalone',  // CRITICAL for Docker
  experimental: {
    serverComponentsExternalPackages: ['better-sqlite3', '@langchain/core', '@langchain/langgraph'],
  },
  // ... existing config
};

export default nextConfig;


-------------------------

5. Implementation Phases (Recommended Order)

Phase 1: Foundation (Week 1-2)

- Extend DB schema (chat_messages, ai_chat_settings tables)
- Run Drizzle migrations
- Build the workspace page layout (WorkspaceLayout.tsx)
- Implement tab-based viewer (Report tab first, it's the easiest)
- Add settings UI for chat model credentials
Phase 2: AI Agent Core (Week 2-3)

- Set up LangGraph agent with state definition
- Implement SQLite tools (get_patient_reports, get_latest_report, compare_reports, etc.)
- Implement viewer action tools
- Create /api/chat streaming route
- Connect LangSmith tracing
Phase 3: Chat UI (Week 3-4)

- Build CopilotPanel with message history
- Implement clickable references in chat messages
- Wire viewer action execution (AI response → tab switch)
- Chat history persistence to SQLite
Phase 4: DICOM Viewer (Week 4-5)

- Integrate Cornerstone.js for DICOM viewing
- Implement slice navigation
- Wire DICOM viewer actions from AI
Phase 5: Docker & Polish (Week 5-6)

- Create Dockerfile and docker-compose.yml
- Test SQLite persistence with Docker volumes
- Test full workflow in container
- Performance optimization
-------------------------

6. Key Risks & Mitigations

| Risk | Mitigation |
|---|---|
| SQLite concurrent access in Docker | Use WAL mode: `PRAGMA journal_mode=WAL;` in Drizzle config |
| DICOM files too large for SQLite | Store DICOM files on disk (`/app/data/dicom/`), store only path in SQLite |
| LangGraph cold start latency | Pre-compile graph on server startup, use edge runtime where possible |
| AI hallucinating report data | Always ground responses in tool results; add system prompt guardrails |
| Docker container size too large | Use multi-stage build (shown above); Alpine base image |



-------------------------

Summary

Your plan is solid and fully compatible with OpenRad. The key architectural decisions are:
- Viewer Action system — The structured JSON bridge between AI and UI is the right approach
- LangGraph — Perfect choice, especially since the repo already has migration plans for it
- LangSmith — Drop-in tracing, no architectural impact
- Docker — Works great, just need persistent volumes for SQLite + DICOM data
- Settings-based model config — Extends existing pattern cleanly
The main area to be realistic about is the DICOM slice highlighting ("AI highlights slice 32") — start with simpler viewer actions (open report, switch tab) and iterate toward spatial intelligence later.
Do you want me to dive deeper into any specific component, or shall I write the complete implementation code for any particular phase?