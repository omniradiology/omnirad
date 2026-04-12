Complete Implementation Plan for OpenRad AI Copilot



Part 1: Pre-Implementation Preparation

1.1 — Understand the Existing Codebase

Before writing any code, the developer must fully internalize the current architecture:
- Study the current database schema in db/ — understand every table, column, and relationship managed by Drizzle ORM with SQLite
- Study the existing AI integration in ai_service/ — understand how the current n8n webhook flow works, what data is sent, and what is returned
- Study the settings system — understand how settings are persisted to SQLite (API keys, webhook URLs, Supabase credentials) so the new chat model settings follow the same pattern
- Study the existing component architecture in components/ — understand the naming conventions, styling patterns (Tailwind CSS v4 with CSS variable-based theming), and component composition
- Study the existing API routes in app/api/ — understand how the current routes are structured in the Next.js App Router convention

-------------------------

Part 2: Phase 1 — Database Schema Extension

Goal: Extend the SQLite database to support chat conversations and a separate AI model configuration for the copilot.
2.1 — Add Chat Messages Table

Create a new table called chat_messages with the following columns:
- Auto-incrementing integer primary key (id)
- A session identifier string (session_id) — this groups messages belonging to the same conversation session
- A role string (role) — values will be user or assistant
- A content text field (content) — the actual message text
- A JSON text field (viewer_actions) — stores the serialized array of viewer action objects that the AI returned with this message (nullable)
- A JSON text field (references) — stores serialized clickable reference objects (nullable)
- A patient ID text field (patient_id) — optional, links the conversation to a patient context
- A timestamp field (created_at) with a default of current timestamp
2.2 — Add AI Chat Settings Table

Create a new table called ai_chat_settings with:
- Auto-incrementing integer primary key (id)
- Provider string (provider) — e.g., openai, google, anthropic
- Model name string (model_name) — e.g., gpt-4o, gemini-pro
- API key text (api_key) — stored encrypted or at least not in plain config files
- LangSmith API key text (langsmith_api_key) — nullable
- LangSmith project name text (langsmith_project) — nullable
- An updated-at timestamp field
2.3 — Create and Run Migrations

- Use Drizzle Kit to generate the migration SQL files from the updated schema
- Test the migration against a fresh SQLite database
- Test the migration against an existing database with data to ensure no breaking changes
- Verify that all existing tables and their data remain untouched
-------------------------

Part 3: Phase 2 — Type Definitions and Shared Contracts

Goal: Define all TypeScript types that will be shared between the backend (AI agent, API routes) and frontend (workspace components).
3.1 — Viewer Action Types

Create a file in types/ that defines a discriminated union type for viewer actions. The supported action types are:
- OPEN_REPORT — contains a reportId and optional patientName; instructs the viewer to switch to the Report tab and load that specific report
- OPEN_DICOM — contains a studyId and optional slice number; instructs the viewer to switch to the DICOM tab and load that study, optionally navigating to a specific slice
- OPEN_METADATA — contains a patientId; instructs the viewer to switch to the Metadata tab and display that patient's information
- SWITCH_TAB — contains a tab value (dicom, report, or metadata); simply switches the active tab without loading new data
- HIGHLIGHT_REGION — contains a slice number and optional bounding box coordinates; for future DICOM annotation support
- COMPARE_VIEW — contains two report IDs; for future side-by-side comparison
Also define a null option for when no viewer action is needed.
3.2 — Chat Response Types

Define an AIChatResponse interface containing:
- message — the text response to display in the chat
- viewerAction — a single ViewerAction or null
- references — an array of Reference objects
Define a Reference interface containing:
- id — unique identifier
- type — one of report, study, or scan
- label — display text for the clickable link
- viewerAction — the ViewerAction to execute when the user clicks this reference
3.3 — Chat Message Types

Define types for chat message objects used in the frontend state:
- role (user or assistant)
- content (text)
- viewerActions (array of ViewerAction)
- references (array of Reference)
- timestamp
-------------------------

Part 4: Phase 3 — Database Query Layer

Goal: Build reusable, well-tested database query functions that the AI agent's tools will call.
4.1 — Report Queries

Create a queries module in db/queries/ (or extend existing query patterns) with the following functions:
- getPatientReports(patientId) — Returns all reports for a given patient, ordered by date descending. Should return report ID, date, modality, status, and a summary/snippet of findings.
- getLatestReport(patientId) — Returns only the most recent report for a patient with full detail.
- getReportById(reportId) — Returns the complete report data (all fields from report_data JSONB, including findings, impression, recommendations, patient info, modality, dates).
- compareReports(reportId1, reportId2) — Retrieves both reports and returns them in a structured format suitable for the LLM to compare. Include dates, findings, impressions, and any quantitative measurements if available.
- searchPatientByName(name) — Fuzzy search for patients by name, returning matching patient IDs and basic info. This is critical because users will say "show me Ahmed's report" and the AI needs to resolve "Ahmed" to a patient ID.
4.2 — Scan/Image Queries

- getScanPath(reportId) — Returns the file path or blob reference for the DICOM/image associated with a report.
- getStudyMetadata(studyId) — Returns metadata about a study (modality, date, number of slices if DICOM, file size, etc.)
- getPatientStudies(patientId) — Returns a list of all imaging studies for a patient, with dates and modalities.
4.3 — Chat Persistence Queries

- saveChatMessage(sessionId, role, content, viewerActions, references, patientId) — Inserts a new chat message
- getChatHistory(sessionId) — Retrieves all messages for a session, ordered chronologically
- getChatSessions() — Returns a list of all chat sessions with the most recent message timestamp and associated patient
4.4 — Testing

- Write unit tests for every query function using a test SQLite database with seed data
- Seed data should include at least 3 patients with multiple reports each, spanning different dates, to test longitudinal queries
- Verify that searchPatientByName handles partial matches and case insensitivity
-------------------------

Part 5: Phase 4 — LangGraph AI Agent

Goal: Build the AI copilot agent using LangGraph with tool-calling capabilities.
5.1 — Agent State Definition

Define the LangGraph agent state with the following fields:
- messages — array of LangChain BaseMessage objects, with a reducer that appends new messages
- patientContext — object containing optional patientId and currentReportId representing what the user is currently viewing
- viewerActions — accumulator array of ViewerAction objects produced during the agent's reasoning
- references — accumulator array of Reference objects
5.2 — Tool Definitions

Create each tool as a LangChain tool with proper name, description, and Zod schema:
Data retrieval tools:
- get_patient_reports — Takes a patient ID or patient name. If given a name, first resolves it to an ID using searchPatientByName. Returns a formatted list of all reports with dates, modality, and key findings summary.
- get_latest_report — Takes a patient ID or name. Returns the most recent report in full detail.
- get_report_by_id — Takes a report ID. Returns the full report text.
- compare_reports — Takes two report IDs. Returns a structured comparison highlighting what changed between them (findings, measurements, impressions).
- get_patient_studies — Takes a patient ID. Returns a list of all imaging studies.
- get_scan_path — Takes a report ID. Returns the file path for the associated image/scan.
Viewer action tools:
7. open_report_in_viewer — Takes a report ID and optional patient name. Does NOT actually open anything server-side. Returns a JSON object containing the OPEN_REPORT viewer action and a narration string. The narration is what the AI will include in its text response (e.g., "I'm opening the report from March 1st in the viewer for you.").
8. open_dicom_in_viewer — Takes a study ID and optional slice number. Returns an OPEN_DICOM viewer action and narration.
9. open_metadata_in_viewer — Takes a patient ID. Returns an OPEN_METADATA viewer action and narration.
Important tool design principles:
- Every tool must have a clear, specific description so the LLM knows when to use it
- Viewer action tools must be described as "use this when the user wants to SEE something in the viewer" so the AI learns to combine data retrieval (for answering questions) with viewer actions (for showing things)
- The compare_reports tool should format its output in a way that makes it easy for the LLM to narrate the differences
5.3 — System Prompt

Craft a detailed system prompt for the agent that includes:
- Identity: "You are OpenRad AI Copilot, a radiology assistant integrated into a medical imaging workspace."
- Behavior rules:
  - When discussing a specific report, ALWAYS call the viewer action tool to open it
  - When comparing studies, retrieve both reports first, then use the compare tool, then open the relevant report in the viewer
  - When the user mentions a patient by name, resolve the name to a patient ID using the search tool
  - Always cite specific dates when referencing reports
  - Be concise and clinically relevant
  - Never fabricate medical data — only reference what the tools return
  - If a query returns no results, clearly tell the user that no matching data was found
- Context awareness: The system prompt should include the current patient context (if any) so the agent knows what the user is looking at
5.4 — Graph Construction

Build the LangGraph state graph with the following nodes and edges:
- Agent node — Invokes the LLM with the system prompt, full message history, and all tools bound. Returns the LLM's response (which may include tool calls).
- Tool node — Executes any tool calls that the agent requested. Uses LangGraph's built-in ToolNode.
- Conditional edge from Agent — If the agent's response contains tool calls, route to the Tool node. If not, route to END.
- Edge from Tool to Agent — After tools execute, go back to the Agent so it can reason about the tool results and produce a final response (or call more tools).
Compile the graph and export it.
5.5 — LangSmith Integration

- Set the environment variables LANGCHAIN_TRACING_V2=true, LANGCHAIN_API_KEY, and LANGCHAIN_PROJECT at process startup
- This requires no code changes to the graph itself — LangGraph automatically traces to LangSmith when these env vars are set
- Ensure these variables can be configured from the settings page (loaded from the ai_chat_settings table) and set at runtime
5.6 — Model Configuration

- The agent must read the model provider, model name, and API key from the ai_chat_settings table at invocation time (not at module load time) so that the user can change models from the settings page without restarting the server
- Support at minimum: OpenAI (ChatOpenAI), Google (ChatGoogleGenerativeAI), and Anthropic (ChatAnthropic) via LangChain's model abstractions
- The tool bindings are model-agnostic since all major providers support tool calling
-------------------------

Part 6: Phase 5 — API Routes

Goal: Create the backend API endpoints that the frontend will call.
6.1 — Chat Streaming Endpoint

Create app/api/chat/route.ts as a POST endpoint:
Request body:
- message — the user's new message text
- patientContext — object with optional patientId and currentReportId
- chatHistory — array of previous messages in the session
- sessionId — identifier for this chat session
Processing flow:
- Read the chat model configuration from the database
- Set LangSmith environment variables if configured
- Construct the LangGraph input: convert chat history to LangChain message format, add the new user message, set patient context
- Invoke the compiled graph
- Parse the final response: extract the assistant's text response, collect all viewer actions from tool call results, collect all references
- Save both the user's message and the assistant's response to the chat_messages table
- Return a JSON response containing: message (text), viewerActions (array), references (array)
Streaming consideration: Initially implement as a standard request-response. Later, upgrade to streaming using ReadableStream/Server-Sent Events so the user sees the response as it's generated. The streaming version would send incremental text chunks followed by a final structured object with viewer actions and references.
6.2 — Report Data Endpoint

Create app/api/tools/reports/route.ts as a GET endpoint:
- Accepts query parameters: id (report ID), patientId, action (e.g., latest, all, compare)
- Returns the requested report data as JSON
- This is used by the viewer panel to fetch report content when the AI instructs it to display a report
6.3 — Scan/Image Data Endpoint

Create app/api/tools/scans/route.ts:
- Accepts query parameters: reportId, studyId
- Returns the image file path or serves the image data
- For DICOM files, returns metadata about available slices
6.4 — Settings Extension Endpoint

Extend the existing settings API route to support reading and writing the new ai_chat_settings fields:
- GET returns the current chat model configuration (with the API key partially masked)
- POST/PUT saves new chat model configuration
6.5 — Chat History Endpoint

Create app/api/chat/history/route.ts:
- GET with sessionId — returns all messages for that session
- GET without parameters — returns a list of all sessions
- DELETE with sessionId — clears a session's history
-------------------------

Part 7: Phase 6 — Frontend Workspace UI

Goal: Build the Cursor-style split-panel workspace interface.
7.1 — Workspace Page

Create app/workspace/page.tsx as the main entry point. This page renders the WorkspaceLayout component and handles any page-level concerns (auth checks, initial data loading).
Add a navigation link to this page from the existing dashboard/sidebar so users can access the workspace.
7.2 — WorkspaceLayout Component

This is the master layout component managing all state:
State variables:
- activeTab — which viewer tab is active (dicom, report, or metadata)
- currentReportId — the report currently loaded in the report viewer
- currentStudyId — the study currently loaded in the DICOM viewer
- currentSlice — the current slice number for DICOM viewing
- currentPatientId — the patient whose metadata is displayed
- chatSessionId — the current chat session identifier
- chatMessages — array of chat messages in the current session
Core function — executeViewerAction:
This is the bridge function. It takes a ViewerAction object and updates the appropriate state variables:
- OPEN_REPORT → sets currentReportId, switches activeTab to report
- OPEN_DICOM → sets currentStudyId and optionally currentSlice, switches activeTab to dicom
- OPEN_METADATA → sets currentPatientId, switches activeTab to metadata
- SWITCH_TAB → only changes activeTab
- HIGHLIGHT_REGION → sets slice, switches to DICOM (annotation handled later)
- COMPARE_VIEW → future implementation
Layout structure:
- Outer container is a flex row taking full viewport height
- Left child takes 60% width, right child takes 40% width
- A draggable divider between them would be a nice enhancement but is not required for the first version
7.3 — ViewerPanel Component (Left Side)

Structure:
- Top section: Tab bar with three tabs (DICOM, REPORT, METADATA)
- Middle section (flex-grow): The active tab's content
- Bottom section: Associated files list
Tab switching:
- Tabs are rendered as buttons; clicking one calls onTabChange (passed from WorkspaceLayout)
- The active tab is visually indicated with a bottom border and primary color
Tab content:
- When activeTab is report: render the ReportViewer sub-component, passing currentReportId. This component fetches the report data from /api/tools/reports and displays it in a formatted, readable layout matching the existing report display style in OpenRad.
- When activeTab is dicom: render the DicomViewer sub-component, passing currentStudyId and currentSlice. For the initial implementation, display the stored image from the SQLite database (OpenRad already stores image data). For future enhancement, integrate Cornerstone.js for true DICOM slice navigation.
- When activeTab is metadata: render the MetadataViewer sub-component, passing currentPatientId. Display patient name, age, gender, study history list, and any other available metadata.
Associated files section:
- Fetches the list of files associated with the current patient/report (report PDFs, DICOM images)
- Each file is clickable; clicking a file calls executeViewerAction with the appropriate action to open it in the viewer
7.4 — CopilotPanel Component (Right Side)

Structure:
- Top header: "AI Copilot" title and session controls (new chat, clear history)
- Middle section (flex-grow, scrollable): Chat messages list
- Bottom section: Input area
Chat messages:
- Each message is rendered as a ChatMessage component
- User messages appear on the right with one style
- Assistant messages appear on the left with a different style
- Assistant messages may contain inline references — these are rendered as ClickableReference components (styled as colored pills or links) that the user can click
- When an assistant message has associated viewer actions, show a subtle indicator (e.g., "📄 Opened report in viewer" below the message)
ClickableReference component:
- Rendered inline within the chat message text
- Styled as a highlighted, clickable span (e.g., blue text with an underline, or a pill-shaped badge)
- On click, calls onReferenceClick which executes the reference's viewerAction
Input area:
- A text input (or textarea for multi-line) with a send button
- On submit: add the user message to the local chatMessages state, send the message to /api/chat with the current patientContext and chatHistory, receive the response, add the assistant message to state, execute any viewer actions from the response
Auto-scroll: The message list should auto-scroll to the bottom when new messages are added.
Loading state: While waiting for the AI response, show a typing indicator (animated dots or a skeleton message).
7.5 — Styling Guidelines

- Follow the existing OpenRad design language: use the same Tailwind CSS v4 variables for colors, spacing, and typography
- Support both dark and light themes using the existing theme switching mechanism
- The workspace should feel like a professional medical application — clean, minimal, with good information density
- The chat panel should have a subtle background difference from the viewer panel to create visual separation
- Use the existing component library patterns (if OpenRad uses shadcn/ui or similar, follow those patterns)
7.6 — Settings Page Extension

Add a new section to the existing settings page with the fields for:
- AI Chat Provider (dropdown: OpenAI, Google Gemini, Anthropic)
- Model Name (text input with placeholder showing example model names)
- API Key (password input)
- LangSmith API Key (password input, marked as optional)
- LangSmith Project Name (text input, marked as optional)
This section should save to and load from the ai_chat_settings table using the extended settings API endpoint. Follow the exact same UI patterns used for the existing webhook URL and Supabase settings.
-------------------------

Part 8: Phase 7 — Integration and Wiring

Goal: Connect all the pieces together and ensure the end-to-end flow works.
8.1 — End-to-End Flow Verification

Test these specific scenarios:
Scenario 1: User asks about a patient's previous report
- User types: "Show me the previous report for patient Ahmed"
- Chat endpoint receives the message
- LangGraph agent calls searchPatientByName("Ahmed") → gets patient ID
- Agent calls getPatientReports(patientId) → gets list of reports
- Agent calls open_report_in_viewer(reportId, "Ahmed") → gets viewer action
- Agent formulates response: "The previous report from 2026-03-01 shows bilateral infiltrates. I've opened it in the viewer for you."
- Response includes text + OPEN_REPORT viewer action + reference to the report
- Frontend receives response, displays message, executes viewer action
- Viewer panel switches to Report tab and loads the specified report
- The report reference in the chat message is clickable
Scenario 2: User asks to compare reports
- User types: "Compare current scan with the previous one"
- Agent uses patient context to identify current and previous reports
- Agent calls getReportById for both reports
- Agent calls compareReports with both IDs
- Agent formulates a comparison narrative
- Agent calls open_report_in_viewer for the comparison view
- Frontend displays the comparison text and opens the relevant report
Scenario 3: User asks to see a DICOM scan
- User types: "Show me the current CT scan"
- Agent resolves the current study from context
- Agent calls open_dicom_in_viewer(studyId)
- Frontend switches to DICOM tab and displays the image
Scenario 4: User asks for patient history summary
- User types: "Summarize this patient's history"
- Agent calls getPatientReports to get all reports
- Agent synthesizes a timeline: "3 reports over 6 months. Lesion size progressively increased from 2.1cm to 3.4cm."
- Each report mentioned in the summary is a clickable reference
8.2 — Error Handling

- If the AI model API call fails, show a user-friendly error in the chat ("I'm having trouble connecting to the AI service. Please check your settings.")
- If a database query returns no results, the AI should respond conversationally ("I couldn't find any reports for that patient.")
- If the viewer action references a report that doesn't exist in the database, show a toast notification rather than crashing
8.3 — Context Awareness

- When the user navigates to a report through the existing dashboard (outside the workspace), and then opens the workspace, the patient context should be carried over
- Consider using URL query parameters or a React context to maintain state: app/workspace?patientId=xxx&reportId=yyy
-------------------------

Part 9: Phase 8 — Docker Deployment

Goal: Package the entire application as a Docker image that can be hosted anywhere.
9.1 — Next.js Configuration for Docker

Modify next.config.ts:
- Add output: 'standalone' — this is critical for Docker as it creates a self-contained build
- Add serverComponentsExternalPackages array including better-sqlite3 (the native SQLite driver used by Drizzle), @langchain/core, and @langchain/langgraph — these packages need to be bundled differently for server components
9.2 — Dockerfile

Use a multi-stage build with three stages:
Stage 1: Dependencies
- Base image: node:20-alpine
- Copy only package.json and package-lock.json
- Run npm ci (clean install) to install all dependencies
- This stage is cached separately so dependencies are only reinstalled when package files change
Stage 2: Build
- Base image: node:20-alpine
- Copy node_modules from Stage 1
- Copy all source code
- Run npm run build to create the Next.js production build
- Set NEXT_TELEMETRY_DISABLED=1 to disable telemetry during build
Stage 3: Production Runner
- Base image: node:20-alpine
- Create a non-root user (nextjs) for security
- Copy the standalone build output from Stage 2: .next/standalone, .next/static, and public
- Copy Drizzle migration files so they can be run on first startup
- Create a /app/data directory for SQLite database and DICOM file storage
- Set ownership of the data directory to the non-root user
- Set DATABASE_URL environment variable to point to /app/data/openrad.db
- Expose port 3000
- Run the standalone server with node server.js
9.3 — Docker Compose

Create a docker-compose.yml that defines:
Service: openrad
- Builds from the Dockerfile
- Maps port 3000 to host port 3000
- Mounts a named volume openrad-data to /app/data — this is critical for data persistence across container restarts
- Environment variables (all configurable):
  - DATABASE_URL pointing to the volume-mounted SQLite path
  - NODE_ENV=production
  - OPENAI_API_KEY (optional, can also be set from UI)
  - LANGCHAIN_TRACING_V2 (default: false)
  - LANGCHAIN_API_KEY (optional)
  - LANGCHAIN_PROJECT (default: openrad-copilot)
  - Supabase URL and anon key (optional)
- Restart policy: unless-stopped
- Health check: HTTP request to http://localhost:3000 every 30 seconds
Volume: openrad-data
- Named volume with local driver
- This ensures SQLite database and DICOM files persist across container restarts, updates, and redeployments
9.4 — SQLite Docker Considerations

- Enable WAL mode: Add PRAGMA journal_mode=WAL; to the Drizzle configuration. WAL (Write-Ahead Logging) mode provides better concurrent read/write performance, which is important in a server environment
- File permissions: Ensure the non-root user has read/write access to the SQLite database file and its WAL/SHM journal files
- Volume backup: Document that backing up the Docker volume (or the /app/data directory) is sufficient for a complete backup of all data including reports, images, chat history, and settings
9.5 — Database Migration on Startup

Create a startup script (or use an entrypoint script) that:
- Checks if the SQLite database file exists at the expected path
- If not, creates it and runs all Drizzle migrations to initialize the schema
- If it exists, checks if there are pending migrations and runs them
- Then starts the Next.js server
This ensures the database is always up to date when the container starts, even after a version upgrade.
9.6 — DICOM File Storage in Docker

- DICOM files should be stored on the filesystem within the /app/data/dicom/ directory (inside the persistent volume), NOT as blobs in SQLite
- The SQLite database should store only the file path reference
- This keeps the database small and performant
- The persistent volume handles durability
- Note: The current OpenRad codebase stores image data in SQLite. For Docker deployment, consider migrating to file-based storage or at minimum ensure the SQLite file can handle the size
9.7 — Environment Variable Documentation

Create a .env.example file documenting all environment variables:

# Database
DATABASE_URL=file:/app/data/openrad.db

# AI Report Generation (existing)
N8N_WEBHOOK_URL=

# AI Copilot Chat (new)
CHAT_AI_PROVIDER=openai
CHAT_AI_MODEL=gpt-4o
CHAT_AI_API_KEY=

# LangSmith Tracing (optional)
LANGCHAIN_TRACING_V2=false
LANGCHAIN_API_KEY=
LANGCHAIN_PROJECT=openrad-copilot

# Supabase (optional)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=


-------------------------

Part 10: Phase 9 — DICOM Viewer Enhancement (Future Phase)

Goal: Upgrade from basic image display to true DICOM viewing. This is listed as a future phase because it requires specialized libraries and more complex implementation.
10.1 — Library Selection

- Cornerstone.js is the recommended library for web-based DICOM viewing
- It supports: multi-slice navigation, windowing/leveling, zoom, pan, measurements, and annotations
- Alternative: OHIF Viewer (built on Cornerstone) provides a more complete out-of-the-box viewer but is heavier
10.2 — Integration Plan

- Replace the basic image display in the DicomViewer component with a Cornerstone.js canvas
- Parse DICOM files to extract individual slices and metadata
- Implement slice navigation (slider or scroll wheel)
- Wire the currentSlice state from WorkspaceLayout to the Cornerstone viewer so AI-directed slice navigation works
- The HIGHLIGHT_REGION viewer action would use Cornerstone's annotation tools to draw a bounding box or circle on the specified coordinates
10.3 — Realistic Scope Note

The "AI highlights slice 32" feature requires the AI to understand spatial information in DICOM data. This is a computer vision task that general-purpose LLMs cannot do. For the initial version:
- The AI can reference slice numbers mentioned in report text
- The viewer can navigate to that slice
- Actual automated detection and highlighting of lesions would require a specialized radiology AI model (not part of this plan)
-------------------------

Part 11: Testing Strategy

11.1 — Unit Tests

- All database query functions
- ViewerAction type parsing and validation
- LangGraph tool functions (mock the database, verify correct return format)
- Chat message serialization/deserialization
11.2 — Integration Tests

- Chat API endpoint: send a message, verify the response format includes text, viewer actions, and references
- Settings API: verify read/write of chat model settings
- Report API: verify correct report data is returned for a given ID
11.3 — End-to-End Tests

- Full chat flow: type a message → receive AI response → verify viewer switches tab and loads content
- Clickable reference flow: click a reference → verify viewer updates
- Settings flow: change AI model → send a chat message → verify the new model is used
11.4 — Docker Tests

- Build the Docker image successfully
- Start the container with a fresh volume → verify database is created and migrations run
- Stop and restart the container → verify all data persists
- Test the full chat flow inside the container
- Test with different LLM providers configured via environment variables
-------------------------

Part 12: Important Warnings and Risk Mitigations

12.1 — Medical Data Safety

- The AI agent must NEVER fabricate medical information. The system prompt must explicitly instruct it to only reference data returned by tools
- All tool responses should be factual, directly from the database
- Add validation: if a tool returns no data, the AI must say so rather than guessing
12.2 — SQLite Concurrency

- SQLite handles concurrent reads well but only one write at a time
- Enable WAL mode to allow concurrent reads during writes
- For a single-user or low-concurrency deployment (which is the expected use case for a radiology workstation), this is not a problem
- If scaling to multiple concurrent users is needed in the future, consider migrating to PostgreSQL
12.3 — API Key Security

- API keys stored in SQLite should be encrypted at rest (use a library like crypto to encrypt/decrypt with a server-side key)
- Never return full API keys to the frontend — always mask them (show only last 4 characters)
- In Docker, support both UI-configured keys and environment variable-configured keys, with environment variables taking precedence
12.4 — LLM Cost Management

- Each chat message triggers one or more LLM API calls (potentially multiple if the agent uses tool calling in multiple rounds)
- Consider adding a maximum tool-call depth (e.g., max 5 tool calls per user message) to prevent runaway costs
- Log all LLM calls via LangSmith for cost monitoring
-------------------------

Part 13: Implementation Priority Summary

| Priority | Task | Estimated Effort |
|----------|------|-----------------|
| 1 | Database schema extension + migrations | 1-2 days |
| 2 | Type definitions (ViewerAction, ChatResponse, Reference) | 0.5 days |
| 3 | Database query functions | 2-3 days |
| 4 | LangGraph agent (state, tools, graph, system prompt) | 3-4 days |
| 5 | Chat API endpoint | 1-2 days |
| 6 | WorkspaceLayout + ViewerPanel (Report tab first) | 2-3 days |
| 7 | CopilotPanel (chat UI with references) | 2-3 days |
| 8 | Viewer action bridge (executeViewerAction function) | 1 day |
| 9 | Settings page extension | 1 day |
| 10 | End-to-end integration testing | 2-3 days |
| 11 | Docker setup (Dockerfile, docker-compose, startup script) | 1-2 days |
| 12 | DICOM viewer (Cornerstone.js) | 3-5 days (future) |




-------------------------

Final Confirmation

Will this plan work with the OpenRad codebase? Yes. The existing Next.js App Router architecture, Drizzle ORM + SQLite database layer, Tailwind CSS v4 styling, and the already-present LangGraph migration document all confirm full compatibility.
Will this work in Docker? Yes. The standalone Next.js output mode, SQLite with persistent volumes, and standard npm-based build process are all Docker-friendly. The key requirements are: persistent volume for SQLite and DICOM files, WAL mode for SQLite, multi-stage build for small image size, and proper environment variable handling.
What should be deferred? True DICOM slice navigation (Cornerstone.js integration) and AI-powered spatial highlighting should be implemented after the core copilot is working. Start with the report viewer and basic image display, then add sophistication.