import time
import json
import re
from typing import Dict, Any
from agent.parsers import StructuredReport, normalize_urgency


async def execute_report_generation(req: Any) -> Dict[str, Any]:
    """Execute the full report generation pipeline."""
    patient = req.patient
    clinical_info = req.clinical_information
    study = req.study
    image = req.image
    config = req.ai_config or {}
    header = req.report_header or {}

    # Check if we have an API key and Provider
    provider = config.get("providerType", "mock")
    api_key = config.get("apiSecretKey", "")
    is_ollama = (provider == "ollama")

    if not api_key and not is_ollama:
        raise ValueError("No API Key provided. Please configure your AI provider in Settings → AI Configuration.")

    # ──────────────────── Build the Prompt ────────────────────
    modality = study.get("modality", "Unknown")
    system_prompt = (
        "You are an expert board-certified radiologist AI assistant. "
        "Analyze the provided patient information and generate a detailed, "
        "clinically accurate radiology report. "
        "You MUST respond with a valid JSON object matching this EXACT schema:\n"
        "{\n"
        '  "study": { "modality": "<string>", "examination": "<string>", "views": "<string>" },\n'
        '  "findings": [ { "anatomical_region": "<string>", "observation": "<string>", "status": "normal|abnormal|indeterminate|post_procedural" } ],\n'
        '  "impression": ["<string>"],\n'
        '  "urgency": "Routine|Urgent|Critical",\n'
        '  "recommendations": ["<string>"]\n'
        "}\n"
        "Do NOT include any text outside the JSON object. Only output valid JSON."
    )

    user_prompt = (
        f"Patient Name: {patient.get('name', 'Unknown')}\n"
        f"Patient Age: {patient.get('age', 'Unknown')}\n"
        f"Patient Gender: {patient.get('gender', 'Unknown')}\n"
        f"Symptoms: {clinical_info.get('symptoms', 'Not specified')}\n"
        f"Clinical History: {clinical_info.get('history', 'Not specified')}\n"
        f"Indication: {clinical_info.get('indication', 'Not specified')}\n"
        f"Imaging Modality: {modality}\n\n"
        "Generate a comprehensive radiology report for this case."
    )

    # ──────────────────── Call the LLM ────────────────────
    ai_output = None
    
    model_name = config.get("modelName", "gemini-2.5-flash")
    temperature = config.get("temperature", 0.3)
    max_tokens = config.get("maxTokens", 4096)
    endpoint_url = (config.get("apiEndpointUrl") or "").strip().rstrip("/")
    
    is_gemini = (
        "googleapis.com" in endpoint_url
        or "generativelanguage" in endpoint_url
        or "google" in config.get("providerName", "").lower()
    )

    if is_gemini:
        from langchain_google_genai import ChatGoogleGenerativeAI
        from langchain_core.messages import HumanMessage, SystemMessage

        llm = ChatGoogleGenerativeAI(
            model=model_name,
            api_key=api_key,
            temperature=temperature,
            max_output_tokens=max_tokens,
        )
    elif is_ollama:
        from langchain_ollama import ChatOllama
        from langchain_core.messages import HumanMessage, SystemMessage
        
        # Normalize endpoint — strip /api or /v1 suffixes so native Ollama API works
        ollama_base = endpoint_url
        for suffix in ["/api", "/v1"]:
            if ollama_base.endswith(suffix):
                ollama_base = ollama_base[:-len(suffix)]
        
        llm = ChatOllama(
            model=model_name,
            base_url=ollama_base,       # e.g. http://localhost:11434
            temperature=temperature,
            num_predict=max_tokens,
        )
    else:
        from langchain_openai import ChatOpenAI
        from langchain_core.messages import HumanMessage, SystemMessage
        
        kwargs = {
            "model": model_name,
            "api_key": api_key,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if endpoint_url:
            kwargs["base_url"] = endpoint_url
            
        llm = ChatOpenAI(**kwargs)

    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=user_prompt),
    ]

    # Try structured output first, fall back to raw text parsing
    try:
        structured_llm = llm.with_structured_output(StructuredReport)
        result = structured_llm.invoke(messages)
        ai_output = result.dict()
    except Exception as e:
        print(f"[AI] Structured output failed ({e}), falling back to raw text parsing...")
        raw_result = llm.invoke(messages)
        ai_output = _parse_raw_response(raw_result.content)

    if ai_output is None:
        raise ValueError("AI returned no usable output after all parsing attempts.")

    # ──────────────────── Assemble the Full Report ────────────────────
    report_id = f"RAD-{int(time.time())}"
    report_date = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

    # Normalize urgency
    raw_urgency = ai_output.get("urgency", "Routine")
    urgency = normalize_urgency(raw_urgency)

    # Ensure findings is never empty
    findings = ai_output.get("findings", [])
    if not findings:
        findings = [{"anatomical_region": "", "observation": "No significant findings.", "status": "normal"}]

    report = {
        "report_header": {
            "hospital_name": header.get("hospital_name", "OpenRad Hospital"),
            "department": header.get("department", "Radiology Department"),
            "report_title": "Radiology Report",
            "report_id": report_id,
            "report_date": report_date,
        },
        "patient": {
            "name": patient.get("name"),
            "age": patient.get("age"),
            "gender": patient.get("gender"),
        },
        "clinical_information": {
            "symptoms": clinical_info.get("symptoms"),
            "history": clinical_info.get("history"),
            "indication": clinical_info.get("indication"),
        },
        "study": {
            "modality": modality,  # Always from the original request
            "examination": ai_output.get("study", {}).get("examination", f"{modality} Scan"),
            "views": ai_output.get("study", {}).get("views", "Standard Views"),
        },
        "findings": findings,
        "impression": ai_output.get("impression", ["No significant impression."]),
        "urgency": urgency,
        "recommendations": ai_output.get("recommendations", []),
        "report_footer": {
            "prepared_by": "OpenRad AI (LangGraph Engine)",
            "department": header.get("department", "Radiology Department"),
            "report_status": "Pending",
        },
        "disclaimer": "This report is generated by an AI system and must be reviewed by a qualified radiologist.",
    }

    return report


def _parse_raw_response(text: str) -> dict:
    """Multi-layer JSON extraction from raw LLM text output."""
    # Layer 1: Direct parse
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Layer 2: Extract from markdown code block
    match = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass

    # Layer 3: Find first { ... } block
    match = re.search(r"\{[\s\S]*\}", text)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            pass

    raise ValueError(f"Could not parse JSON from LLM response: {text[:200]}...")
