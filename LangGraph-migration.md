

# 🏗️ OpenRad AI Backend Migration Plan: n8n → LangGraph

## Executive Summary

> **Goal:** Replace the external n8n webhook-based AI backend with an **in-app LangGraph-powered AI engine** that supports both cloud AI APIs (Gemini, OpenAI, Anthropic, etc.) and local models via Ollama — while maintaining the exact same report JSON schema and workflow logic currently handled by n8n.

---

## 📊 Current Architecture Analysis

### How It Works Today

```
┌──────────────┐    HTTP POST     ┌──────────────────────────────────────────┐
│  OpenRad App  │ ──────────────► │  n8n (External)                          │
│  (Frontend)   │                 │  ┌─────────┐  ┌──────────┐  ┌────────┐  │
│               │                 │  │ Webhook  │→ │ LLM Chain│→ │ Code   │  │
│               │ ◄────────────── │  │         │  │ + Parser │  │ Node   │  │
│               │   JSON Report   │  └─────────┘  └──────────┘  └────────┘  │
└──────────────┘                  └──────────────────────────────────────────┘
```

### Problems Identified

| # | Issue | Impact |
|---|-------|--------|
| 1 | **External dependency on n8n** | App cannot function without n8n running; adds deployment complexity |
| 2 | **No local model support** | Cannot run offline or in air-gapped hospital environments |
| 3 | **API keys managed outside app** | Security risk; split configuration across systems |
| 4 | **No model selection flexibility** | Hardcoded to single Gemini model in n8n workflow |
| 5 | **Fragile structured output parsing** | n8n's output parser + post-processing JS is brittle and hard to debug |
| 6 | **No retry/fallback logic** | If LLM returns malformed JSON, the entire flow fails |
| 7 | **Latency overhead** | Extra network hop through n8n webhook adds unnecessary latency |
| 8 | **No streaming support** | User waits for entire report; no progressive feedback |

---

## 🎯 Target Architecture

```
┌───────────────────────────────────────────────────────────────────┐
│  OpenRad Application                                              │
│                                                                   │
│  ┌────────────┐     ┌──────────────────────────────────────────┐  │
│  │  Frontend   │     │  AI Backend (LangGraph Engine)           │  │
│  │  (React/    │ ──► │                                          │  │
│  │   Next.js)  │     │  ┌─────────┐  ┌──────────┐  ┌────────┐ │  │
│  │            │     │  │ Intake  │→ │ LLM Node │→ │ Report │ │  │
│  │            │ ◄── │  │ Node    │  │ (Graph)  │  │ Builder│ │  │
│  │            │     │  └─────────┘  └──────────┘  └────────┘ │  │
│  └────────────┘     │       │                          │       │  │
│                      │  ┌────▼──────────────────────────▼────┐ │  │
│                      │  │     Provider Abstraction Layer     │ │  │
│                      │  │  ┌────────┐ ┌───────┐ ┌────────┐  │ │  │
│                      │  │  │ Cloud  │ │Ollama │ │ Custom │  │ │  │
│                      │  │  │ APIs   │ │(Local)│ │Endpoint│  │ │  │
│                      │  │  └────────┘ └───────┘ └────────┘  │ │  │
│                      │  └────────────────────────────────────┘ │  │
│                      └──────────────────────────────────────────┘  │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Settings / Admin Panel                                      │  │
│  │  - AI Provider Config (API URL, Key, Model Name)             │  │
│  │  - Ollama Connection Config                                  │  │
│  │  - Prompt Template Editor                                    │  │
│  │  - Output Schema Validator                                   │  │
│  └──────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────┘
```

---

## 📋 Implementation Plan

### Phase 1: Foundation — AI Configuration System

**Objective:** Build the settings infrastructure so users can configure AI providers from within the app.

---

#### Task 1.1: Database Schema for AI Configuration

**What to build:**
- A new database table/collection: `ai_configurations`
- Fields:

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `provider_type` | ENUM | `cloud_api` \| `ollama` \| `custom_endpoint` |
| `provider_name` | STRING | Display name (e.g., "Google Gemini", "Ollama Local") |
| `api_endpoint_url` | STRING | Base URL for the API (e.g., `https://generativelanguage.googleapis.com`, `http://localhost:11434`) |
| `api_secret_key` | STRING (encrypted) | API key — **must be encrypted at rest** |
| `model_name` | STRING | e.g., `gemini-2.5-flash-preview`, `llama3.2-vision`, `gpt-4o` |
| `is_active` | BOOLEAN | Which config is currently active |
| `is_vision_capable` | BOOLEAN | Whether this model can process images |
| `max_tokens` | INTEGER | Max output tokens (default: 4096) |
| `temperature` | FLOAT | Generation temperature (default: 0.3) |
| `timeout_seconds` | INTEGER | Request timeout (default: 120) |
| `created_at` | TIMESTAMP | |
| `updated_at` | TIMESTAMP | |

**Acceptance Criteria:**
- [ ] Encrypted storage for API keys (use AES-256 or app-level encryption)
- [ ] Only one configuration can be `is_active = true` at a time
- [ ] Migration script for the database schema
- [ ] Seed data for at least: Google Gemini, OpenAI, Ollama (without keys)

---

#### Task 1.2: AI Settings Admin Panel (Frontend)

**What to build:**
- A new settings page at `/settings/ai-configuration`
- UI components:

```
┌──────────────────────────────────────────────────────┐
│  AI Configuration                                     │
│                                                       │
│  Provider Type:  [Cloud API ▾]                       │
│                                                       │
│  Provider Name:  [Google Gemini          ]           │
│  API Endpoint:   [https://generative...  ]           │
│  API Secret Key: [••••••••••••••••••••   ] 👁️        │
│  Model Name:     [gemini-2.5-flash-preview ▾]       │
│                                                       │
│  ── Advanced ──                                       │
│  Temperature:    [0.3      ]                         │
│  Max Tokens:     [4096     ]                         │
│  Timeout (sec):  [120      ]                         │
│  Vision Capable: [✓]                                 │
│                                                       │
│  [Test Connection]  [Save & Activate]                │
│                                                       │
│  ── Ollama Quick Setup ──                            │
│  Status: 🟢 Connected (localhost:11434)              │
│  Available Models: llama3.2-vision, mistral          │
│  [Refresh Models]  [Use Selected]                    │
└──────────────────────────────────────────────────────┘
```

**Acceptance Criteria:**
- [ ] Form validates all fields before submission
- [ ] "Test Connection" button pings the API and reports success/failure
- [ ] For Ollama: auto-discover available models via `GET /api/tags`
- [ ] API key field is masked by default with toggle visibility
- [ ] Save triggers backend validation + encryption + storage

---

#### Task 1.3: AI Configuration REST API

**Endpoints to build:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/ai-config` | Get active configuration (key masked) |
| `GET` | `/api/ai-config/all` | List all saved configurations |
| `POST` | `/api/ai-config` | Create new configuration |
| `PUT` | `/api/ai-config/:id` | Update existing configuration |
| `PUT` | `/api/ai-config/:id/activate` | Set as active configuration |
| `DELETE` | `/api/ai-config/:id` | Delete a configuration |
| `POST` | `/api/ai-config/test` | Test connection to provider |
| `GET` | `/api/ai-config/ollama/models` | List models from Ollama instance |

**Acceptance Criteria:**
- [ ] All endpoints require authentication (admin role)
- [ ] API keys are never returned in full (return masked version)
- [ ] Test endpoint performs actual health check against provider
- [ ] Ollama models endpoint handles connection failures gracefully

---

### Phase 2: LangGraph AI Engine

**Objective:** Build the LangGraph-based report generation engine that replaces the entire n8n workflow.

---

#### Task 2.1: Provider Abstraction Layer

**What to build:**
A unified interface that wraps multiple AI providers so the LangGraph workflow doesn't care which provider is active.

**Architecture:**

```
ProviderFactory
├── CloudProvider (Gemini, OpenAI, Anthropic, etc.)
│   └── Uses: LangChain ChatModel adapters
├── OllamaProvider
│   └── Uses: LangChain ChatOllama / direct REST
└── CustomEndpointProvider
    └── Uses: Generic HTTP with configurable auth
```

**Interface Contract:**

```
Provider Interface:
  - initialize(config: AIConfiguration): void
  - generateReport(input: RadiologyInput): Promise<RadiologyReport>
  - testConnection(): Promise<{success: boolean, message: string}>
  - supportsVision(): boolean
  - getModelInfo(): ModelInfo
```

**Key decisions for the developer:**

> ⚠️ The provider layer must handle **vision (multimodal) inputs** because radiology images are core to the workflow. When configuring a model, the system must verify the model supports image input. For text-only models, the workflow should skip image analysis and note this limitation in the report.

**Acceptance Criteria:**
- [ ] Factory pattern selects provider based on `provider_type` from active config
- [ ] All providers implement the same interface
- [ ] Cloud provider supports at minimum: Google Gemini, OpenAI GPT-4o, Anthropic Claude
- [ ] Ollama provider supports both text and vision models
- [ ] Error handling wraps provider-specific errors into unified error types

---

#### Task 2.2: LangGraph Workflow Definition

**What to build:**
A LangGraph `StateGraph` that replicates and improves upon the n8n workflow.

**Graph Structure:**

```
                    ┌──────────────┐
                    │    START     │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │   validate   │  ← Validate incoming patient data
                    │    _input    │     and image format
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │   prepare    │  ← Build prompt from template
                    │   _prompt    │     + patient context + image
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │   invoke     │  ← Call LLM via provider layer
                    │   _llm      │     (with retry logic)
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │   parse      │  ← Structured output parsing
                    │   _output    │     with validation + repair
                    └──────┬───────┘
                           │
                   ┌───────▼────────┐
                   │  Valid JSON?   │
                   └──┬──────────┬──┘
                   Yes│          │No (≤3 retries)
                      │   ┌──────▼───────┐
                      │   │   repair     │  ← Ask LLM to fix its
                      │   │   _output    │     JSON output
                      │   └──────┬───────┘
                      │          │
                      │          ▼ (back to parse_output)
                      │
                ┌─────▼────────┐
                │   assemble   │  ← Merge AI output with patient data,
                │   _report    │     normalize urgency, build final JSON
                └──────┬───────┘
                       │
                ┌──────▼───────┐
                │     END      │  → Return final report JSON
                └──────────────┘
```

**State Schema:**

```
GraphState:
  - patient_data: object          # From incoming request
  - clinical_information: object  # From incoming request  
  - study_metadata: object        # From incoming request
  - image_data: string | null     # Base64 encoded image
  - prompt: string                # Assembled prompt
  - llm_raw_response: string      # Raw LLM text output
  - parsed_output: object | null  # Parsed JSON from LLM
  - parse_errors: string[]        # Validation errors
  - retry_count: number           # Current retry attempt
  - final_report: object | null   # Assembled report
  - error: string | null          # Fatal error message
```

**Acceptance Criteria:**
- [ ] Graph handles the complete flow from input to final report
- [ ] Maximum 3 retry attempts for malformed LLM output
- [ ] Each node is independently testable
- [ ] Graph state is serializable for debugging/logging
- [ ] Timeout handling at the graph level (configurable)

---

#### Task 2.3: Structured Output Parser

**What to build:**
A robust JSON parser + validator that ensures LLM output matches the expected schema **exactly**.

**This is the most critical component** — it replaces both n8n's `Structured Output Parser` node and the JavaScript `Code` node.

**Required Schema (matches current n8n output):**

```json
{
  "study": {
    "modality": "<string>",
    "examination": "<string>",
    "views": "<string>"
  },
  "findings": [
    {
      "anatomical_region": "<string>",
      "observation": "<string>",
      "status": "<normal | abnormal | indeterminate | post_procedural>"
    }
  ],
  "impression": ["<string>"],
  "urgency": "<Routine | Urgent | Critical>",
  "recommendations": ["<string>"]
}
```

**Parsing Strategy (multi-layer):**

```
Layer 1: Direct JSON.parse()
         ↓ (fails?)
Layer 2: Extract JSON from markdown code blocks (```json ... ```)
         ↓ (fails?)
Layer 3: Regex-based JSON extraction from mixed text
         ↓ (fails?)
Layer 4: Ask LLM to repair its own output (retry node)
         ↓ (fails after 3 attempts?)
Layer 5: Return error report with raw LLM output for manual review
```

**Validation Rules:**

| Field | Rule |
|-------|------|
| `study.modality` | Non-empty string |
| `study.examination` | Non-empty string |
| `study.views` | String (can be empty) |
| `findings` | Array with ≥1 item |
| `findings[].anatomical_region` | Non-empty string |
| `findings[].observation` | Non-empty string |
| `findings[].status` | Must be one of: `normal`, `abnormal`, `indeterminate`, `post_procedural` |
| `impression` | Array of strings, ≥1 item |
| `urgency` | Must be one of: `Routine`, `Urgent`, `Critical` |
| `recommendations` | Array of strings (can be empty) |

**Urgency Normalization Logic** (port from n8n Code node):

| LLM Output | Normalized To |
|-------------|---------------|
| `critical`, `stat`, `immediate`, `emergent`, `life-threatening`, `3`, `high` | **Critical** |
| `urgent`, `moderate`, `soon`, `priority`, `2`, `medium` | **Urgent** |
| `routine`, `low`, `normal`, `non-urgent`, `elective`, `1` | **Routine** |
| Any unrecognized value | **Routine** (default) |

**Acceptance Criteria:**
- [ ] Successfully parses ≥95% of typical LLM outputs without retries
- [ ] Handles all known edge cases from the n8n Code node
- [ ] Returns detailed validation errors for debugging
- [ ] Status values are normalized to exact enum values
- [ ] Urgency normalization matches the n8n logic exactly

---

#### Task 2.4: Report Assembly Module

**What to build:**
The final report builder that merges AI output with system/patient data — direct port of the n8n JavaScript Code node.

**Final Report JSON Schema (exact match to current output):**

```json
{
  "report_header": {
    "hospital_name": "<string>",
    "department": "Radiology Department",
    "report_title": "Radiology Report",
    "report_id": "RAD-<timestamp>",
    "report_date": "<ISO 8601 timestamp>"
  },
  "patient": {
    "name": "<string | null>",
    "age": "<string | null>",
    "gender": "<string | null>"
  },
  "clinical_information": {
    "symptoms": "<string | null>",
    "history": "<string | null>",
    "indication": "<string | null>"
  },
  "study": {
    "modality": "<from original request>",
    "examination": "<from AI output>",
    "views": "<from AI output>"
  },
  "findings": [
    {
      "anatomical_region": "<string>",
      "observation": "<string>",
      "status": "<string>"
    }
  ],
  "impression": ["<string>"],
  "urgency": "<Routine | Urgent | Critical>",
  "recommendations": ["<string>"],
  "report_footer": {
    "prepared_by": "Radiology AI Assistant",
    "department": "Radiology Department",
    "report_status": "Preliminary"
  },
  "disclaimer": "This report is generated by an AI system and must be reviewed by a qualified radiologist."
}
```

> ⚠️ **Critical:** The modality in `study.modality` must come from the **original request** (not the AI output), matching the n8n workflow behavior. The AI provides `examination` and `views` only.

**Acceptance Criteria:**
- [ ] Output JSON schema is 100% backward compatible with current n8n output
- [ ] Default values match exactly those in the n8n Code node
- [ ] Patient data is passed through from request (never AI-generated)
- [ ] Empty findings array results in `[{anatomical_region: "", observation: "", status: "normal"}]`
- [ ] Report ID format: `RAD-<unix timestamp>`

---

#### Task 2.5: Prompt Template System

**What to build:**
An editable prompt template engine that stores the radiology prompt (currently hardcoded in n8n) in the database.

**Default Prompt Template** (port from n8n):

```
Store the exact prompt from the n8n "Basic LLM Chain" node as the default template
with variable placeholders:

{{patient_name}}, {{patient_age}}, {{patient_gender}},
{{patient_symptoms}}, {{patient_history}}, {{patient_indication}},
{{imaging_modality}}, {{image_type}}
```

**Features:**
- Store prompt templates in database (table: `prompt_templates`)
- Support template variables with `{{variable_name}}` syntax
- Allow editing from admin panel
- Version history (keep last 10 versions)
- "Reset to Default" button

**Acceptance Criteria:**
- [ ] Default template matches n8n prompt exactly
- [ ] Template variables are replaced at runtime
- [ ] Invalid template variables produce clear errors
- [ ] Admin can edit and preview templates before saving

---

### Phase 3: API Integration & Migration

**Objective:** Wire the LangGraph engine into the existing OpenRad API and deprecate n8n dependency.

---

#### Task 3.1: New Report Generation Endpoint

**What to build:**
A new internal API endpoint that the frontend calls instead of the n8n webhook.

| Aspect | Detail |
|--------|--------|
| **Method** | `POST` |
| **Path** | `/api/reports/generate` |
| **Auth** | Required (existing app auth) |
| **Input** | Same JSON body currently sent to n8n webhook |
| **Output** | Same JSON schema currently returned by n8n |

**Request Body (unchanged from current):**

```json
{
  "patient": {
    "name": "John Doe",
    "age": "45",
    "gender": "Male"
  },
  "clinical_information": {
    "symptoms": "Chest pain",
    "history": "Smoker for 20 years",
    "indication": "Rule out pneumonia"
  },
  "study": {
    "modality": "X-Ray"
  },
  "image": {
    "type": "base64",
    "data": "<base64_encoded_image>"
  },
  "report_header": {
    "hospital_name": "General Hospital"
  }
}
```

**Endpoint Flow:**

```
1. Receive request
2. Validate input
3. Load active AI configuration
4. Load active prompt template
5. Execute LangGraph workflow
6. Return assembled report JSON
```

**Acceptance Criteria:**
- [ ] Request/response schema is identical to current n8n webhook
- [ ] Frontend requires minimal changes (just URL swap)
- [ ] Proper HTTP status codes (200 success, 422 validation, 500 error, 504 timeout)
- [ ] Request logging for audit trail
- [ ] Rate limiting to prevent abuse

---

#### Task 3.2: Frontend Migration

**What to change:**

```
BEFORE:
  fetch("https://n8n-instance.com/webhook/7f5f5775-...", { ... })

AFTER:
  fetch("/api/reports/generate", { ... })
```

**Detailed changes:**

1. **Remove** the n8n webhook URL configuration from frontend
2. **Replace** with internal API call to `/api/reports/generate`
3. **Add** loading states with progress indication
4. **Add** error handling for new error response format
5. **Add** a "Retry" button when generation fails
6. **Add** display of which AI model was used (in report metadata)

**Acceptance Criteria:**
- [ ] No calls to external n8n webhooks
- [ ] Report display works identically to before
- [ ] Loading state shows while report generates
- [ ] Errors are displayed with actionable messages
- [ ] Works with both cloud and Ollama providers

---

#### Task 3.3: Ollama Integration Specifics

**What to build:**
Specific handling for Ollama local models.

**Ollama API Interactions:**

| OpenRad Action | Ollama API Call |
|----------------|-----------------|
| List available models | `GET http://<host>:11434/api/tags` |
| Check if model is loaded | `POST http://<host>:11434/api/show` |
| Generate with vision | `POST http://<host>:11434/api/chat` with image in message |
| Health check | `GET http://<host>:11434/` |

**Special Considerations for Ollama:**

1. **Model Pull UI**: Add a button to pull/download models directly from the settings panel
2. **Vision Detection**: Check model capabilities via `/api/show` — only models with `vision` in their capabilities should be selectable for radiology
3. **Performance Warning**: Display estimated generation time based on model size
4. **Connection Recovery**: Auto-reconnect if Ollama server restarts

**Recommended Ollama Vision Models for Radiology:**

| Model | Size | Quality | Speed |
|-------|------|---------|-------|
| `llama3.2-vision` | 11B | Good | Moderate |
| `llava` | 7B/13B | Good | Fast/Moderate |
| `bakllava` | 7B | Decent | Fast |
| `moondream2` | 1.8B | Basic | Very Fast |

**Acceptance Criteria:**
- [ ] Auto-discover models from Ollama
- [ ] Filter to only show vision-capable models for radiology use
- [ ] Handle Ollama being offline gracefully
- [ ] Image encoding works correctly for Ollama's expected format
- [ ] Timeout is configurable and appropriate for local model speed

---

### Phase 4: Robustness & Quality

**Objective:** Add reliability features that n8n didn't provide.

---

#### Task 4.1: Retry & Fallback System

**Logic:**

```
Attempt 1: Use active provider
  ↓ (fails?)
Attempt 2: Retry same provider with simplified prompt
  ↓ (fails?)
Attempt 3: Retry with output repair prompt
  ↓ (fails?)
Return error with partial results if any
```

**Acceptance Criteria:**
- [ ] Configurable retry count (default: 3)
- [ ] Exponential backoff between retries
- [ ] Each retry logged with error details
- [ ] Partial results preserved (e.g., if JSON is 80% valid)

---

#### Task 4.2: Report Generation Audit Log

**What to build:**
- Table: `report_generation_logs`

| Field | Type |
|-------|------|
| `id` | UUID |
| `report_id` | STRING |
| `ai_config_id` | FK → ai_configurations |
| `model_used` | STRING |
| `prompt_template_version` | INTEGER |
| `raw_llm_response` | TEXT |
| `parsed_successfully` | BOOLEAN |
| `retry_count` | INTEGER |
| `generation_time_ms` | INTEGER |
| `error_message` | TEXT \| NULL |
| `created_at` | TIMESTAMP |

**Acceptance Criteria:**
- [ ] Every generation attempt is logged
- [ ] Logs are searchable by date, model, success/failure
- [ ] Admins can view raw LLM output for debugging
- [ ] Logs auto-purge after configurable retention period (default: 90 days)

---

#### Task 4.3: Input Validation & Sanitization

**What to build:**
Pre-generation validation at the API endpoint level.

**Validation Rules:**

| Field | Rule |
|-------|------|
| `patient.name` | Required, string, ≤200 chars |
| `patient.age` | Optional, string or number |
| `patient.gender` | Optional, string |
| `clinical_information.symptoms` | Optional, string, ≤2000 chars |
| `study.modality` | Required, must be valid modality |
| `image.data` | Optional, valid base64, ≤ 20MB decoded |
| `image.type` | If image present, must be `base64` |

**Valid Modalities:**
`X-Ray`, `CT`, `MRI`, `Ultrasound`, `Mammography`, `Fluoroscopy`, `Nuclear Medicine`, `PET-CT`, `Angiography`

**Acceptance Criteria:**
- [ ] Invalid requests return 422 with detailed field-level errors
- [ ] Image data is validated for format (JPEG, PNG, DICOM) before sending to LLM
- [ ] XSS/injection prevention on all text fields

---

## 📅 Implementation Timeline

```
Phase 1: Foundation (AI Config)
├── Task 1.1: DB Schema .......................... 2 days
├── Task 1.2: Admin Panel UI .................... 3 days
└── Task 1.3: Config REST API ................... 2 days
                                          Subtotal: 7 days

Phase 2: LangGraph Engine
├── Task 2.1: Provider Abstraction Layer ........ 4 days
├── Task 2.2: LangGraph Workflow ................ 5 days
├── Task 2.3: Structured Output Parser .......... 3 days
├── Task 2.4: Report Assembly Module ............ 2 days
└── Task 2.5: Prompt Template System ............ 2 days
                                          Subtotal: 16 days

Phase 3: Integration & Migration
├── Task 3.1: New API Endpoint .................. 2 days
├── Task 3.2: Frontend Migration ................ 3 days
└── Task 3.3: Ollama Integration ................ 3 days
                                          Subtotal: 8 days

Phase 4: Robustness & Quality
├── Task 4.1: Retry & Fallback .................. 2 days
├── Task 4.2: Audit Logging ..................... 2 days
└── Task 4.3: Input Validation .................. 2 days
                                          Subtotal: 6 days

Testing & QA ................................... 5 days

────────────────────────────────────────────────────
TOTAL ESTIMATED: ~42 working days (8-9 weeks)
```

---

## 🧪 Testing Strategy

### Unit Tests Required

| Component | Test Coverage |
|-----------|--------------|
| Provider Factory | Correct provider instantiation per type |
| Output Parser | Parse valid JSON, markdown-wrapped JSON, malformed JSON, edge cases |
| Urgency Normalizer | All mappings from table above (port n8n test cases) |
| Report Assembler | Schema compliance, default values, null handling |
| Prompt Template Engine | Variable substitution, missing variables, escaping |

### Integration Tests Required

| Test | Description |
|------|-------------|
| Cloud API E2E | Send full request → receive valid report (Gemini/OpenAI) |
| Ollama E2E | Send full request → receive valid report (local model) |
| Schema Backward Compat | Compare new output against 10+ saved n8n outputs |
| Retry Flow | Mock LLM failure → verify retry → verify eventual success |
| Config Swap | Switch active provider mid-session → verify next request uses new provider |

### Validation Test

> 📋 **Critical Test:** Take 20 real report outputs from the current n8n workflow and verify the new LangGraph engine produces output with an **identical JSON structure** (values will differ, but schema and field types must match exactly).

---

## 📁 Suggested File/Folder Structure

```
openrad/
├── src/
│   ├── ai/                           # NEW: AI engine
│   │   ├── providers/
│   │   │   ├── provider.interface.ts   # Provider contract
│   │   │   ├── provider.factory.ts     # Factory pattern
│   │   │   ├── cloud.provider.ts       # Gemini, OpenAI, Anthropic
│   │   │   ├── ollama.provider.ts      # Ollama local
│   │   │   └── custom.provider.ts      # Custom endpoint
│   │   ├── graph/
│   │   │   ├── workflow.ts             # LangGraph StateGraph definition
│   │   │   ├── nodes/
│   │   │   │   ├── validate-input.ts   # Input validation node
│   │   │   │   ├── prepare-prompt.ts   # Prompt assembly node
│   │   │   │   ├── invoke-llm.ts       # LLM invocation node
│   │   │   │   ├── parse-output.ts     # JSON parsing node
│   │   │   │   ├── repair-output.ts    # Output repair node
│   │   │   │   └── assemble-report.ts  # Final report builder
│   │   │   └── state.ts               # Graph state type definition
│   │   ├── parsers/
│   │   │   ├── structured-parser.ts    # Multi-layer JSON parser
│   │   │   ├── urgency-normalizer.ts   # Urgency mapping logic
│   │   │   └── schema-validator.ts     # JSON schema validation
│   │   ├── templates/
│   │   │   ├── template-engine.ts      # Template variable substitution
│   │   │   └── default-prompt.ts       # Default radiology prompt
│   │   └── index.ts                    # Public API
│   ├── api/
│   │   ├── routes/
│   │   │   ├── ai-config.routes.ts     # AI configuration CRUD
│   │   │   └── report-generate.routes.ts # Report generation endpoint
│   │   └── middleware/
│   │       └── validate-report-input.ts
│   ├── models/
│   │   ├── ai-configuration.model.ts
│   │   ├── prompt-template.model.ts
│   │   └── generation-log.model.ts
│   └── frontend/
│       └── components/
│           └── settings/
│               ├── AIConfigPanel.tsx
│               ├── OllamaSetup.tsx
│               └── PromptEditor.tsx
├── tests/
│   ├── ai/
│   │   ├── parser.test.ts
│   │   ├── urgency.test.ts
│   │   ├── workflow.test.ts
│   │   └── providers.test.ts
│   └── fixtures/
│       └── n8n-sample-outputs/         # Real n8n outputs for comparison
└── docs/
    └── ai-migration-guide.md
```

---

## ⚡ Key Technical Decisions for Developer

| Decision | Recommendation | Rationale |
|----------|---------------|-----------|
| **LangGraph runtime** | LangGraph.js (TypeScript) | OpenRad appears to be a Node/TS app; avoid Python microservice complexity |
| **If Python needed** | LangGraph (Python) + FastAPI microservice | Only if team prefers Python; requires inter-process communication |
| **LLM SDK** | LangChain.js chat models | Unified interface for all providers; LangGraph built on LangChain |
| **Schema validation** | Zod (TypeScript) or Ajv | Runtime type checking for LLM output |
| **API key encryption** | Node.js `crypto.createCipheriv` (AES-256-GCM) | Built-in, no extra dependencies |
| **Prompt templating** | Handlebars or custom `{{var}}` replacement | Simple, well-understood |

---

## 🚨 Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| LLM output schema drift | Multi-layer parser + retry + schema validation |
| Ollama model too slow | Show estimated time; allow cancellation; recommend specific models |
| Cloud API rate limits | Implement request queuing + backoff |
| Image too large for LLM | Auto-resize images to max 1024px before sending |
| Breaking existing workflow | Keep n8n webhook URL as fallback option (configurable in settings) |
| Vision model unavailable | Graceful degradation: generate text-only report with note |

---

## ✅ Definition of Done (Overall)

- [ ] All n8n workflow logic is replicated in LangGraph
- [ ] Report JSON output is **structurally identical** to n8n output
- [ ] AI provider is configurable from the UI (no code changes needed to switch)
- [ ] Ollama local models work for report generation
- [ ] Cloud APIs (Gemini, OpenAI, Anthropic) work for report generation
- [ ] Structured output parsing handles ≥95% of LLM outputs without errors
- [ ] All tests pass
- [ ] n8n is no longer required to run the application
- [ ] Documentation updated with setup instructions for both cloud and local AI

---

> 💡 **For the developer:** Start with **Phase 1 (Task 1.1 → 1.3)** and **Phase 2 (Task 2.1)** in parallel. The provider abstraction layer is the critical foundation — everything else builds on it. Ship Phase 1 + 2 as the first milestone, then Phase 3 (frontend migration) can be done incrementally.