from fastapi import FastAPI, Request
from pydantic import BaseModel
from typing import Dict, Any, Optional, List
import uvicorn
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class CopilotChatRequest(BaseModel):
    message: str
    chat_history: List[Dict[str, str]] = []
    patient_context: Optional[Dict[str, Any]] = None
    session_id: Optional[str] = None

class GenerateRequest(BaseModel):
    patient: Dict[str, Any]
    clinical_information: Dict[str, Any]
    study: Dict[str, Any]
    image: Optional[Dict[str, Any]] = None
    report_header: Optional[Dict[str, Any]] = None
    ai_config: Optional[Dict[str, Any]] = None

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/generate_report")
async def generate_report(req: GenerateRequest):
    from agent.workflow import execute_report_generation
    
    try:
        report = await execute_report_generation(req)
        return report
    except Exception as e:
        return {"error": str(e), "failed": True}

@app.get("/copilot/health")
def copilot_health():
    return {"status": "ok", "service": "copilot"}

@app.post("/copilot/chat")
async def copilot_chat(req: CopilotChatRequest):
    from agent.copilot_workflow import execute_copilot_chat
    
    try:
        result = await execute_copilot_chat(
            message=req.message,
            chat_history=req.chat_history,
            patient_context=req.patient_context,
        )
        return result
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {
            "message": f"⚠️ Copilot error: {str(e)}",
            "viewer_actions": [],
            "references": [],
            "error": str(e),
        }

@app.post("/test_ai_connection")
async def test_ai_connection(req: Dict[str, Any]):
    import urllib.request
    import urllib.error
    import json

    config = req.get("ai_config", {})
    provider = config.get("providerType", "custom_api")
    api_key = config.get("apiSecretKey", "")
    
    is_ollama = (provider == "ollama")
    
    if not is_ollama and not api_key:
        return {"success": False, "error": "No API Key provided."}
        
    base_url = config.get("apiEndpointUrl", "").strip().rstrip("/")
    if not base_url:
        return {"success": False, "error": "Endpoint URL is required."}

    # Detect Google's Gemini API (uses a completely different path and auth)
    is_google = "googleapis.com" in base_url or "generativelanguage" in base_url
    
    if is_ollama:
        # Normalize any Ollama URL variation to the correct base
        # Strips /api, /v1, /v1/ suffixes so we always hit /api/tags correctly
        ollama_base = base_url
        for suffix in ["/api", "/v1"]:
            if ollama_base.endswith(suffix):
                ollama_base = ollama_base[:-len(suffix)]
        target_url = f"{ollama_base}/api/tags"
    elif is_google:
        target_url = f"{base_url}/v1beta/models?key={api_key}"
    else:
        target_url = f"{base_url}/models"
    
    try:
        req_obj = urllib.request.Request(target_url)
        
        # Only set Bearer auth for non-Google, non-Ollama endpoints
        if not is_ollama and not is_google and api_key:
            req_obj.add_header("Authorization", f"Bearer {api_key}")
            
        with urllib.request.urlopen(req_obj, timeout=15) as response:
            resp_data = json.loads(response.read().decode())
            
            models = []
            if is_ollama:
                models = [m["name"] for m in resp_data.get("models", [])]
            elif is_google:
                # Google returns {"models": [{"name": "models/gemini-...", ...}]}
                for m in resp_data.get("models", []):
                    name = m.get("name", "")
                    # Strip the "models/" prefix
                    if name.startswith("models/"):
                        name = name[7:]
                    # Only include generative models (not embedding models)
                    methods = m.get("supportedGenerationMethods", [])
                    if "generateContent" in methods:
                        models.append(name)
            else:
                # Standard OpenAI-compatible /models response
                models = [m.get("id", "unknown") for m in resp_data.get("data", [])]
                
            return {"success": True, "message": "Connection successful.", "models": models}
            
    except urllib.error.HTTPError as e:
        err_body = ""
        try:
            err_body = e.read().decode()
        except:
            pass
        
        if is_ollama:
            if e.code == 404:
                return {
                    "success": False,
                    "error": (
                        f"Ollama returned 404. The model may not be pulled yet. "
                        f"Run: ollama pull <model-name> in your terminal."
                    )
                }
            return {"success": False, "error": f"Ollama HTTP {e.code}: {err_body[:200]}"}
        
        return {"success": False, "error": f"HTTP Error {e.code}: {err_body[:200]}"}
    
    except urllib.error.URLError as e:
        reason = str(e.reason).lower()
        
        if is_ollama:
            if "connection refused" in reason or "actively refused" in reason:
                return {
                    "success": False,
                    "error": (
                        "Connection refused — Ollama does not appear to be running. "
                        "Start Ollama on your machine, then verify it's up by visiting "
                        "http://127.0.0.1:11434 in your browser (you should see 'Ollama is running')."
                    )
                }
            if "cors" in reason or "preflight" in reason or "origin" in reason:
                return {
                    "success": False,
                    "error": (
                        "CORS error — Ollama is blocking requests from this app. "
                        "Set the environment variable OLLAMA_ORIGINS=* and restart the Ollama service."
                    )
                }
            return {"success": False, "error": f"Network error reaching Ollama: {str(e.reason)}"}
        
        return {"success": False, "error": f"Network error: {str(e.reason)}"}
    
    except Exception as e:
        err_str = str(e).lower()
        if is_ollama and ("connection refused" in err_str or "actively refused" in err_str):
            return {
                "success": False,
                "error": (
                    "Connection refused — Ollama does not appear to be running. "
                    "Start Ollama then visit http://127.0.0.1:11434 to confirm it's active."
                )
            }
        return {"success": False, "error": f"Failed to connect: {str(e)}"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
