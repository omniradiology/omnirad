"""
OpenRad AI Copilot — LangGraph Workflow

The core AI agent that processes user messages, queries patient data,
and returns responses with viewer action commands.
"""

import json
import os
import sqlite3
from typing import Any, Dict, List, Optional

from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage, AIMessage
from agent.copilot_tools import ALL_TOOLS


# ─── Tool → Activity Status Mapping ──────────────────────────────────────────
TOOL_STATUS_MAP = {
    "search_patient_by_name": {"status": "searching", "label": "Searching patients..."},
    "get_patient_reports": {"status": "fetching", "label": "Fetching reports..."},
    "get_latest_report": {"status": "fetching", "label": "Fetching latest report..."},
    "get_report_by_id": {"status": "fetching", "label": "Fetching report details..."},
    "compare_reports": {"status": "comparing", "label": "Comparing studies..."},
    "get_patient_studies": {"status": "analyzing", "label": "Analyzing studies..."},
    "open_report_in_viewer": {"status": "viewer", "label": "Opening report viewer..."},
    "open_dicom_in_viewer": {"status": "viewer", "label": "Opening DICOM viewer..."},
    "open_metadata_in_viewer": {"status": "viewer", "label": "Opening patient data..."},
    "run_segmentation": {"status": "segmenting", "label": "Segmenting image..."},
    "annotate_report_findings": {"status": "segmenting", "label": "Annotating findings..."},
    "find_slice_with_finding": {"status": "analyzing", "label": "Locating finding..."},
    "clear_ai_findings": {"status": "viewer", "label": "Clearing findings..."},
}


COPILOT_SYSTEM_PROMPT = """You are OpenRad AI Copilot, an expert radiology assistant integrated into a medical imaging workspace.

You have access to the following capabilities:
- Search for patients by name
- Retrieve patient reports (all, latest, or specific)
- Compare two reports side by side
- List patient imaging studies
- Open reports, images, and patient metadata in the viewer panel
- **Run AI segmentation** on medical images to find and highlight structures
- **Annotate multiple findings from a report** on the image
- **Clear AI findings** from the viewer

## General Rules:
1. When discussing a SINGLE specific report in depth, use the open_report_in_viewer tool so the user can see it.
2. DO NOT use open_report_in_viewer if you are just listing multiple reports or showing a timeline! Only use open_metadata_in_viewer in that case.
3. When the user mentions a patient by name, use search_patient_by_name first to resolve their ID.
4. When comparing studies, retrieve both reports first, then use compare_reports, and open one in the viewer.
5. ALWAYS cite specific dates when referencing reports.
6. Be concise and clinically relevant in your responses.
7. NEVER fabricate medical data — only reference what the tools return.
8. If a query returns no results, clearly tell the user that no matching data was found.
9. When showing images or scans, use open_dicom_in_viewer.
10. When the user asks about a patient's timeline, demographics, or history overview, use open_metadata_in_viewer.

## Image Segmentation & Annotation Rules:
11. When the user asks to "check", "find", "segment", "highlight", "show me", "point to", "mark", "locate", or "where is" a structure or finding, use the **run_segmentation** tool.
12. For segmentation, extract the SPECIFIC medical concept from the user's message as the prompt (e.g. "liver lesion", "left kidney", "hemorrhage", "fracture"). Be precise.
13. Always pass the current report_id (from context) when calling run_segmentation.
14. If the user asks to clear/remove/reset AI findings, use **clear_ai_findings**.
15. After segmentation, summarize what was found and describe where the annotations are placed.

## Annotation Type Awareness:
The run_segmentation tool automatically picks the best annotation style based on the user's words:
- **"point to"**, **"where exactly"**, **"where should I look"**, **fractures** → Arrow annotation pointing to the finding
- **"highlight"**, **hemorrhage**, **effusion**, **edema** → Circle + segmentation overlay
- **"lesion"**, **"tumor"**, **"nodule"**, **"abnormality"** → Circle annotation around the finding
- **"where is"**, **"find"**, **"locate"**, **"check"** → Bounding box annotation
- You can override by passing `annotation_style` parameter: "arrow", "circle", "bbox", "overlay", or "full"

## Report-Grounded Annotation:
16. When the user asks to "highlight the findings", "show findings from the report", or "annotate what the report describes", use the **annotate_report_findings** tool with the current report_id.
17. This tool reads the report text, extracts key medical terms, and creates labeled color-coded annotations for each finding.

## Slice Navigation Rules:
21. When the user asks to navigate to a specific slice by finding, use **find_slice_with_finding**:
    - "Take me to the slice with the lesion" → find_slice_with_finding(prompt="lesion", report_id=...)
    - "Show the slice where the abnormality starts" → find_slice_with_finding(prompt="abnormality", report_id=..., search_direction="forward")
    - "Which slice has the tumor?" → find_slice_with_finding(prompt="tumor", report_id=...)
    - "Go to the relevant slice" → find_slice_with_finding using the most relevant finding from context
    - "Show me where the hemorrhage first appears" → find_slice_with_finding(prompt="hemorrhage", report_id=..., search_direction="forward")
22. For "first appearance" or "where it starts" queries, the tool will scan backward to find the earliest slice.
23. Always tell the user which slice number was found and describe its position (e.g. "slice 37 of 120, near the middle").
24. If a study has only one image, find_slice_with_finding still works — it will segment on that image.

## Ambiguous & Follow-up Behavior:
25. If the user says something ambiguous like "I don't see the issue" or "Where should I look?", FIRST ask a clarifying follow-up like "Would you like me to highlight the suspected findings from the report?", then use the appropriate tool.
26. If the user says "I don't see the issue" and there IS a loaded report, offer to annotate the report findings.
27. If the user says vague things like "Where should I focus?", use run_segmentation with annotation_style="arrow" to create pointing arrows.

## Context:
{context}
"""


def _get_db_path() -> str:
    base = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    return os.path.join(base, "data", "openrad.db")


def _get_copilot_config() -> Optional[Dict[str, Any]]:
    """Load the active copilot AI configuration from SQLite."""
    db_path = _get_db_path()
    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.execute(
            "SELECT * FROM ai_configurations WHERE purpose = 'copilot' AND is_active = 1 LIMIT 1"
        )
        row = cursor.fetchone()
        conn.close()
        if row:
            return dict(row)
    except Exception as e:
        print(f"[Copilot] Error loading copilot config: {e}")
    
    # Fallback: try any active config
    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.execute(
            "SELECT * FROM ai_configurations WHERE is_active = 1 LIMIT 1"
        )
        row = cursor.fetchone()
        conn.close()
        if row:
            return dict(row)
    except Exception as e:
        print(f"[Copilot] Error loading fallback config: {e}")
    
    return None


def _create_llm(config: Dict[str, Any]):
    """Create the appropriate LangChain LLM based on config."""
    provider = config.get("provider_type", "custom_api")
    api_key = config.get("api_secret_key", "")
    model_name = config.get("model_name", "gpt-4o")
    temperature = config.get("temperature", 0.3)
    max_tokens = config.get("max_tokens", 4096)
    endpoint_url = (config.get("api_endpoint_url") or "").strip().rstrip("/")
    provider_name = config.get("provider_name", "").lower()
    
    is_ollama = (provider == "ollama")
    is_gemini = (
        "googleapis.com" in endpoint_url
        or "generativelanguage" in endpoint_url
        or "google" in provider_name
    )
    
    # Set LangSmith tracing if configured
    langsmith_key = config.get("langsmith_api_key")
    langsmith_project = config.get("langsmith_project")
    if langsmith_key:
        os.environ["LANGCHAIN_TRACING_V2"] = "true"
        os.environ["LANGCHAIN_API_KEY"] = langsmith_key
        if langsmith_project:
            os.environ["LANGCHAIN_PROJECT"] = langsmith_project
        else:
            os.environ["LANGCHAIN_PROJECT"] = "openrad-copilot"
    
    if is_gemini:
        from langchain_google_genai import ChatGoogleGenerativeAI
        return ChatGoogleGenerativeAI(
            model=model_name,
            api_key=api_key,
            temperature=temperature,
            max_output_tokens=max_tokens,
        )
    elif is_ollama:
        from langchain_ollama import ChatOllama
        ollama_base = endpoint_url
        for suffix in ["/api", "/v1"]:
            if ollama_base.endswith(suffix):
                ollama_base = ollama_base[:-len(suffix)]
        return ChatOllama(
            model=model_name,
            base_url=ollama_base,
            temperature=temperature,
            num_predict=max_tokens,
        )
    else:
        from langchain_openai import ChatOpenAI
        kwargs = {
            "model": model_name,
            "api_key": api_key,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if endpoint_url:
            kwargs["base_url"] = endpoint_url
        return ChatOpenAI(**kwargs)


async def execute_copilot_chat(
    message: str,
    chat_history: List[Dict[str, str]],
    patient_context: Optional[Dict[str, Any]] = None,
    study_context: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Execute a copilot chat message through the LangGraph agent.
    
    Returns:
        {
            "message": str,           # AI text response
            "viewer_actions": [...],    # List of viewer action commands
            "references": [...],        # List of clickable references
            "findings_summary": [...],  # List of AI findings
        }
    """
    config = _get_copilot_config()
    if not config:
        return {
            "message": "⚠️ AI Copilot is not configured. Please go to **Settings → AI Configuration** and set up a copilot AI provider.",
            "viewer_actions": [],
            "references": [],
        }
    
    try:
        llm = _create_llm(config)
    except Exception as e:
        return {
            "message": f"⚠️ Failed to initialize AI model: {str(e)}. Please check your copilot configuration in Settings.",
            "viewer_actions": [],
            "references": [],
        }
    
    # Bind tools to the LLM
    llm_with_tools = llm.bind_tools(ALL_TOOLS)
    
    # Build context string
    context_parts = []
    if patient_context:
        if patient_context.get("patientId"):
            context_parts.append(f"Currently viewing patient ID: {patient_context['patientId']}")
        if patient_context.get("currentReportId"):
            context_parts.append(f"Currently viewing report ID: {patient_context['currentReportId']}")
        if patient_context.get("patientName"):
            context_parts.append(f"Current patient name: {patient_context['patientName']}")
    context_str = "\n".join(context_parts) if context_parts else "No specific patient context."

    # Add study context for segmentation
    if study_context:
        if study_context.get("reportId"):
            context_parts.append(f"Current report ID for segmentation: {study_context['reportId']}")
        if study_context.get("currentSlice") is not None:
            context_parts.append(f"Current slice index: {study_context['currentSlice']}")
        if study_context.get("totalSlices"):
            context_parts.append(f"Total slices: {study_context['totalSlices']}")
        if study_context.get("modality"):
            context_parts.append(f"Modality: {study_context['modality']}")
        context_str = "\n".join(context_parts)
    
    # Build message history
    messages: List[BaseMessage] = [
        SystemMessage(content=COPILOT_SYSTEM_PROMPT.format(context=context_str))
    ]
    
    for msg in chat_history:
        if msg.get("role") == "user":
            messages.append(HumanMessage(content=msg["content"]))
        elif msg.get("role") == "assistant":
            messages.append(AIMessage(content=msg["content"]))
    
    messages.append(HumanMessage(content=message))
    
    # Run the agent loop (tool calling)
    viewer_actions = []
    references = []
    findings_summary = []
    max_iterations = 8  # Safety limit to prevent runaway costs
    
    for iteration in range(max_iterations):
        try:
            response = await llm_with_tools.ainvoke(messages)
        except Exception as e:
            return {
                "message": f"⚠️ AI model error: {str(e)}",
                "viewer_actions": viewer_actions,
                "references": references,
            }
        
        messages.append(response)
        
        # Check if there are tool calls
        tool_calls = getattr(response, "tool_calls", None) or []
        
        if not tool_calls:
            # No more tool calls — agent is done
            break
        
        # Execute each tool call
        from langchain_core.messages import ToolMessage
        for tc in tool_calls:
            tool_name = tc["name"]
            tool_args = tc["args"]
            
            # Find and execute the tool
            tool_func = None
            for t in ALL_TOOLS:
                if t.name == tool_name:
                    tool_func = t
                    break
            
            # Inject viewport_image if available
            viewport_image = patient_context.get("imageBase64")
            if viewport_image and tool_name in ["run_segmentation", "annotate_report_findings"]:
                tool_args["viewport_image"] = viewport_image
            
            if tool_func:
                try:
                    result = tool_func.invoke(tool_args)
                except Exception as e:
                    result = json.dumps({"error": str(e)})
                
                # Extract viewer actions from tool results
                try:
                    parsed = json.loads(result) if isinstance(result, str) else result
                    if isinstance(parsed, dict):
                        # Handle legacy viewer_action format
                        if "viewer_action" in parsed:
                            va = parsed["viewer_action"]
                            viewer_actions.append(va)
                            
                            # Create a clickable reference for this action
                            ref_type = "report"
                            ref_label = ""
                            if va.get("type") == "OPEN_REPORT":
                                ref_type = "report"
                                ref_label = f"Report {va.get('reportId', '')}"
                            elif va.get("type") == "OPEN_DICOM":
                                ref_type = "study"
                                ref_label = f"Study {va.get('studyId', '')}"
                            elif va.get("type") == "OPEN_METADATA":
                                ref_type = "patient"
                                ref_label = f"Patient {va.get('patientId', '')}"
                            
                            references.append({
                                "id": f"ref_{len(references)}",
                                "type": ref_type,
                                "label": ref_label,
                                "viewerAction": va,
                            })
                        
                        # Handle new AI viewer_actions format (segmentation tools)
                        if "viewer_actions" in parsed:
                            for va in parsed["viewer_actions"]:
                                viewer_actions.append(va)

                        # Extract findings summary
                        if "findings_summary" in parsed:
                            findings_summary.extend(parsed["findings_summary"])
                except (json.JSONDecodeError, TypeError):
                    pass
                
                messages.append(ToolMessage(content=result, tool_call_id=tc["id"]))
            else:
                messages.append(ToolMessage(
                    content=json.dumps({"error": f"Unknown tool: {tool_name}"}),
                    tool_call_id=tc["id"]
                ))
    
    # Extract final text response
    final_message = ""
    if messages and hasattr(messages[-1], "content"):
        content = messages[-1].content
        if isinstance(content, list):
            # Extract text from complex content blocks
            final_message = "\n".join([c.get("text", "") if isinstance(c, dict) else str(c) for c in content])
        elif isinstance(content, dict):
            final_message = content.get("text", "")
        else:
            final_message = str(content)
    
    return {
        "message": final_message,
        "viewer_actions": viewer_actions,
        "references": references,
        "findings_summary": findings_summary,
    }


async def execute_copilot_chat_stream(
    message: str,
    chat_history: List[Dict[str, str]],
    patient_context: Optional[Dict[str, Any]] = None,
    study_context: Optional[Dict[str, Any]] = None,
):
    """Stream copilot chat as SSE events.
    
    Yields JSON strings for each event:
      {"type": "status", "status": "...", "label": "...", "tool": ...}
      {"type": "complete", "message": "...", "viewer_actions": [...], ...}
      {"type": "error", "message": "..."}
    """
    config = _get_copilot_config()
    if not config:
        yield json.dumps({
            "type": "error",
            "message": "⚠️ AI Copilot is not configured. Please go to **Settings → AI Configuration** and set up a copilot AI provider.",
        })
        return
    
    try:
        llm = _create_llm(config)
    except Exception as e:
        yield json.dumps({
            "type": "error",
            "message": f"⚠️ Failed to initialize AI model: {str(e)}. Please check your copilot configuration in Settings.",
        })
        return
    
    llm_with_tools = llm.bind_tools(ALL_TOOLS)
    
    context_parts = []
    if patient_context:
        if patient_context.get("patientId"):
            context_parts.append(f"Currently viewing patient ID: {patient_context['patientId']}")
        if patient_context.get("currentReportId"):
            context_parts.append(f"Currently viewing report ID: {patient_context['currentReportId']}")
        if patient_context.get("patientName"):
            context_parts.append(f"Current patient name: {patient_context['patientName']}")
    context_str = "\n".join(context_parts) if context_parts else "No specific patient context."

    if study_context:
        if study_context.get("reportId"):
            context_parts.append(f"Current report ID for segmentation: {study_context['reportId']}")
        if study_context.get("currentSlice") is not None:
            context_parts.append(f"Current slice index: {study_context['currentSlice']}")
        if study_context.get("totalSlices"):
            context_parts.append(f"Total slices: {study_context['totalSlices']}")
        if study_context.get("modality"):
            context_parts.append(f"Modality: {study_context['modality']}")
        context_str = "\n".join(context_parts)
    
    messages: List[BaseMessage] = [
        SystemMessage(content=COPILOT_SYSTEM_PROMPT.format(context=context_str))
    ]
    
    for msg in chat_history:
        if msg.get("role") == "user":
            messages.append(HumanMessage(content=msg["content"]))
        elif msg.get("role") == "assistant":
            messages.append(AIMessage(content=msg["content"]))
    
    messages.append(HumanMessage(content=message))
    
    viewer_actions = []
    references = []
    findings_summary = []
    max_iterations = 8
    
    for iteration in range(max_iterations):
        yield json.dumps({
            "type": "status",
            "status": "thinking",
            "label": "Thinking..." if iteration == 0 else "Processing results...",
            "tool": None,
        })
        
        try:
            response = await llm_with_tools.ainvoke(messages)
        except Exception as e:
            yield json.dumps({
                "type": "error",
                "message": f"⚠️ AI model error: {str(e)}",
            })
            return
        
        messages.append(response)
        
        tool_calls = getattr(response, "tool_calls", None) or []
        
        if not tool_calls:
            break
        
        from langchain_core.messages import ToolMessage
        for tc in tool_calls:
            tool_name = tc["name"]
            tool_args = tc["args"]
            
            tool_info = TOOL_STATUS_MAP.get(tool_name, {"status": "working", "label": f"Running {tool_name}..."})
            yield json.dumps({
                "type": "status",
                "status": tool_info["status"],
                "label": tool_info["label"],
                "tool": tool_name,
            })
            
            tool_func = None
            for t in ALL_TOOLS:
                if t.name == tool_name:
                    tool_func = t
                    break
            
            viewport_image = patient_context.get("imageBase64") if patient_context else None
            if viewport_image and tool_name in ["run_segmentation", "annotate_report_findings"]:
                tool_args["viewport_image"] = viewport_image
            
            if tool_func:
                try:
                    result = tool_func.invoke(tool_args)
                except Exception as e:
                    result = json.dumps({"error": str(e)})
                
                try:
                    parsed = json.loads(result) if isinstance(result, str) else result
                    if isinstance(parsed, dict):
                        if "viewer_action" in parsed:
                            va = parsed["viewer_action"]
                            viewer_actions.append(va)
                            ref_type = "report"
                            ref_label = ""
                            if va.get("type") == "OPEN_REPORT":
                                ref_type = "report"
                                ref_label = f"Report {va.get('reportId', '')}"
                            elif va.get("type") == "OPEN_DICOM":
                                ref_type = "study"
                                ref_label = f"Study {va.get('studyId', '')}"
                            elif va.get("type") == "OPEN_METADATA":
                                ref_type = "patient"
                                ref_label = f"Patient {va.get('patientId', '')}"
                            references.append({
                                "id": f"ref_{len(references)}",
                                "type": ref_type,
                                "label": ref_label,
                                "viewerAction": va,
                            })
                        if "viewer_actions" in parsed:
                            for va in parsed["viewer_actions"]:
                                viewer_actions.append(va)
                        if "findings_summary" in parsed:
                            findings_summary.extend(parsed["findings_summary"])
                except (json.JSONDecodeError, TypeError):
                    pass
                
                messages.append(ToolMessage(content=result, tool_call_id=tc["id"]))
            else:
                messages.append(ToolMessage(
                    content=json.dumps({"error": f"Unknown tool: {tool_name}"}),
                    tool_call_id=tc["id"]
                ))
    
    yield json.dumps({
        "type": "status",
        "status": "generating",
        "label": "Generating response...",
        "tool": None,
    })
    
    final_message = ""
    if messages and hasattr(messages[-1], "content"):
        content = messages[-1].content
        if isinstance(content, list):
            final_message = "\n".join([c.get("text", "") if isinstance(c, dict) else str(c) for c in content])
        elif isinstance(content, dict):
            final_message = content.get("text", "")
        else:
            final_message = str(content)
    
    yield json.dumps({
        "type": "complete",
        "message": final_message,
        "viewer_actions": viewer_actions,
        "references": references,
        "findings_summary": findings_summary,
    })
