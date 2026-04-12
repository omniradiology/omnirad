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


COPILOT_SYSTEM_PROMPT = """You are OpenRad AI Copilot, an expert radiology assistant integrated into a medical imaging workspace.

You have access to the following capabilities:
- Search for patients by name
- Retrieve patient reports (all, latest, or specific)
- Compare two reports side by side
- List patient imaging studies
- Open reports, images, and patient metadata in the viewer panel

## Rules:
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
) -> Dict[str, Any]:
    """Execute a copilot chat message through the LangGraph agent.
    
    Returns:
        {
            "message": str,           # AI text response
            "viewer_actions": [...],    # List of viewer action commands
            "references": [...],        # List of clickable references
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
            
            if tool_func:
                try:
                    result = tool_func.invoke(tool_args)
                except Exception as e:
                    result = json.dumps({"error": str(e)})
                
                # Extract viewer actions from tool results
                try:
                    parsed = json.loads(result) if isinstance(result, str) else result
                    if isinstance(parsed, dict) and "viewer_action" in parsed:
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
    }
