"""
OmniRad — MedSAM3 Segmentation Service

Client wrapper for the real MedSAM3 FastAPI backend.

Real API (from OpenAPI spec):
  POST /v1/segmentations
    Request: { model, prompt, image_base64, roi_box?, return_mask_png_base64 }
    Response: { mask_png_base64, ... }

  GET  /v1/models           — list available models (requires Bearer)
  GET  /healthz             — health check (no auth)
"""

import base64
import io
import json
import os
import re
import sqlite3
import urllib.request
import urllib.error
from typing import Any, Dict, List, Optional

import numpy as np
from PIL import Image

from models.image_preprocessor import (
    decode_base64_image,
    encode_image_to_base64,
    preprocess_medical_image,
)


def _get_db_path() -> str:
    base = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    return os.path.join(base, "data", "omnirad.db")


def load_segmentation_config() -> Optional[Dict[str, Any]]:
    """Load the active segmentation backend configuration from SQLite."""
    db_path = _get_db_path()
    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.execute(
            "SELECT * FROM segmentation_configurations WHERE is_active = 1 LIMIT 1"
        )
        row = cursor.fetchone()
        conn.close()
        if row:
            return dict(row)
    except Exception as e:
        print(f"[MedSAM3] Error loading segmentation config: {e}")
    return None


# ─── Prompt Normalization ─────────────────────────────────────────────────────

def normalize_prompt(prompt: str) -> str:
    """Normalize a medical segmentation prompt for MedSAM3."""
    p = prompt.strip().lower()
    p = p.replace("_", " ")
    p = re.sub(r"\s+", " ", p)
    return p


def generate_prompt_variants(prompt: str) -> List[str]:
    """Generate a small set of prompt variants to improve MedSAM3 hit rate."""
    normalized = normalize_prompt(prompt)
    variants = [normalized]

    synonyms = {
        "liver": ["hepatic"],
        "kidney": ["renal"],
        "lung": ["pulmonary"],
        "brain": ["cerebral", "intracranial"],
        "heart": ["cardiac"],
        "bone": ["osseous"],
        "tumor": ["tumour", "mass", "neoplasm"],
        "lesion": ["abnormality", "mass"],
        "hemorrhage": ["haemorrhage", "bleeding"],
        "fracture": ["break"],
        "opacity": ["consolidation", "opacification"],
    }

    for term, syns in synonyms.items():
        if term in normalized:
            variant = normalized.replace(term, syns[0])
            if variant not in variants:
                variants.append(variant)

    return variants[:4]


# ─── Geometry Builder ─────────────────────────────────────────────────────────

def mask_to_geometry(mask: np.ndarray, text_prompt: str) -> Dict[str, Any]:
    """Convert a binary segmentation mask to annotation geometry."""
    if mask is None or mask.size == 0:
        return {"found": False, "message": "No segmentation mask generated."}

    pos = np.where(mask > 0)
    if len(pos[0]) == 0:
        return {"found": False, "message": f"No region found for '{text_prompt}'."}

    y_min, y_max = int(np.min(pos[0])), int(np.max(pos[0]))
    x_min, x_max = int(np.min(pos[1])), int(np.max(pos[1]))
    bbox = [x_min, y_min, x_max, y_max]

    center_x = (x_min + x_max) / 2
    center_y = (y_min + y_max) / 2
    radius = max(x_max - x_min, y_max - y_min) / 2

    contour_points = _extract_simple_contour(mask)

    mask_area = int(np.sum(mask > 0))
    total_area = mask.shape[0] * mask.shape[1]
    area_ratio = mask_area / total_area if total_area > 0 else 0

    # Confidence proxy: larger relative area = more confident hit
    # Clamp to [0.5, 0.95] — MedSAM3 doesn't directly return a score
    confidence = min(0.95, max(0.5, 0.5 + area_ratio * 3))

    return {
        "found": True,
        "confidence": confidence,
        "segmentation": {
            "mask_available": True,
            "bbox": bbox,
            "mask_area": mask_area,
            "area_ratio": area_ratio,
        },
        "box_annotation": {
            "type": "bounding_box",
            "x": x_min,
            "y": y_min,
            "width": x_max - x_min,
            "height": y_max - y_min,
            "label": text_prompt,
        },
        "circle_annotation": {
            "type": "circle",
            "center_x": center_x,
            "center_y": center_y,
            "radius": radius,
            "label": text_prompt,
        },
        "contour_points": contour_points,
        "label_anchor": {"x": center_x, "y": center_y},
    }


def _extract_simple_contour(mask: np.ndarray, max_points: int = 100) -> List[List[int]]:
    """Extract a simplified contour from a binary mask."""
    try:
        import cv2
        contours, _ = cv2.findContours(
            mask.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
        )
        if not contours:
            return []
        largest = max(contours, key=cv2.contourArea)
        epsilon = 0.005 * cv2.arcLength(largest, True)
        approx = cv2.approxPolyDP(largest, epsilon, True)
        points = approx.reshape(-1, 2).tolist()
        if len(points) > max_points:
            step = len(points) // max_points
            points = points[::step]
        return points
    except ImportError:
        pos = np.where(mask > 0)
        if len(pos[0]) == 0:
            return []
        y_min, y_max = int(np.min(pos[0])), int(np.max(pos[0]))
        x_min, x_max = int(np.min(pos[1])), int(np.max(pos[1]))
        return [[x_min, y_min], [x_max, y_min], [x_max, y_max], [x_min, y_max]]


# ─── MedSAM3 Client ──────────────────────────────────────────────────────────

class MedSAM3Service:
    """Client for the MedSAM3 FastAPI segmentation backend.

    Real API endpoints:
      GET  /healthz                     — health check
      GET  /v1/models                   — list available models
      POST /v1/segmentations            — run segmentation (JSON, image_base64)
      POST /v1/segmentations/upload     — run segmentation (multipart, file upload)
    """

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        if config is None:
            config = load_segmentation_config()
        self.config = config or {}

        # Strip path segments from base_url (origins only)
        raw_base = self.config.get("base_url", "http://localhost:5000").rstrip("/")
        try:
            from urllib.parse import urlparse
            parsed = urlparse(raw_base)
            self.base_url = f"{parsed.scheme}://{parsed.netloc}"
        except Exception:
            self.base_url = raw_base

        self.api_key = self.config.get("api_secret_key", "")
        
        configured_model = self.config.get("model_name")
        # Ensure we default to medsam3-t4 if empty or legacy "medsam3" without the -t4 suffix
        self.model_name = configured_model if configured_model and configured_model != "medsam3" else "medsam3-t4"
        
        self.timeout = int(self.config.get("timeout_seconds", 120))
        self.model_type = self.config.get("model_type", "medsam3")  # 'medsam2' or 'medsam3'

    def _headers(self, include_auth: bool = True) -> Dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if include_auth and self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers

    # ── Health ────────────────────────────────────────────────────────────────

    def health_check(self) -> Dict[str, Any]:
        """Check if the segmentation backend is reachable via GET /healthz."""
        url = f"{self.base_url}/healthz"
        try:
            req = urllib.request.Request(url, headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode())
                return {"healthy": True, "details": data}
        except Exception as e:
            return {"healthy": False, "error": str(e)}

    # ── List Models ───────────────────────────────────────────────────────────

    def list_models(self) -> List[str]:
        """Fetch available model names from GET /v1/models."""
        url = f"{self.base_url}/v1/models"
        try:
            req = urllib.request.Request(url, headers=self._headers())
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode())
                # Response may be {"data": [{"id": "medsam3-t4", ...}]} (OpenAI-style)
                # or a plain list ["medsam3-t4", ...]
                if isinstance(data, list):
                    return [m if isinstance(m, str) else m.get("id", str(m)) for m in data]
                if isinstance(data, dict):
                    items = data.get("data", data.get("models", []))
                    return [m if isinstance(m, str) else m.get("id", str(m)) for m in items]
        except Exception as e:
            print(f"[MedSAM3] list_models error: {e}")
        return []

    # ── Predict ───────────────────────────────────────────────────────────────

    def predict(
        self,
        image_data: str,
        text_prompt: str,
        slice_index: Optional[int] = None,
        roi_box: Optional[List[int]] = None,
    ) -> Dict[str, Any]:
        """Run MedSAM3 segmentation.

        Args:
            image_data: base64 image or data-URL
            text_prompt: natural language prompt (e.g. "brain lesion")
            slice_index: used for logging only
            roi_box: optional [x1, y1, x2, y2] hint

        Returns:
            Dict with found, confidence, annotations, contour_points, etc.
        """
        # Preprocess image to standard format
        try:
            if image_data.startswith("/uploads/"):
                base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
                file_path = os.path.join(base_dir, "public", image_data.lstrip("/"))
                with open(file_path, "rb") as f:
                    import base64
                    image_data = base64.b64encode(f.read()).decode("utf-8")

            image_array = decode_base64_image(image_data)
            processed = preprocess_medical_image(image_array)
        except Exception as e:
            return {"error": f"Image preprocessing failed: {str(e)}", "found": False}

        # Encode as clean base64 (no data: prefix)
        processed_b64 = encode_image_to_base64(processed)
        if "," in processed_b64:
            processed_b64 = processed_b64.split(",", 1)[1]

        # MedSAM2 uses spatial prompts (box/point), not text variants
        if self.model_type == "medsam2":
            variants = [text_prompt]  # Keep original for logging only
        else:
            variants = generate_prompt_variants(text_prompt)
        best_result = None

        for variant in variants:
            try:
                result = self._call_segmentation(processed_b64, variant, roi_box)
                if result and result.get("found"):
                    result["prompt_used"] = variant
                    result["prompt_variants"] = variants
                    return result
                elif result and "error" in result:
                    best_result = result  # capture the exact network/HTTP error
                elif result and not best_result:
                    best_result = result
            except Exception as e:
                print(f"[{self.model_type.upper()}] Variant '{variant}' failed: {e}")

        # MedSAM2 fallback: retry with point prompt if box-based failed
        if self.model_type == "medsam2" and (not best_result or not best_result.get("found")):
            point_result = self._retry_with_point(processed_b64, roi_box)
            if point_result and point_result.get("found"):
                point_result["prompt_used"] = "point_fallback"
                point_result["prompt_variants"] = variants
                return point_result

        return best_result or {
            "found": False,
            "message": f"No segmentation result for '{text_prompt}'.",
            "prompt_variants": variants,
            "error": best_result.get("error") if best_result else "All attempts failed.",
        }

    def _call_segmentation(
        self,
        image_b64: str,
        text_prompt: str,
        roi_box: Optional[List[int]] = None,
    ) -> Optional[Dict[str, Any]]:
        """POST /v1/segmentations — the real MedSAM3 endpoint."""
        url = f"{self.base_url}/v1/segmentations"

        if self.model_type == "medsam2":
            # MedSAM2: spatial prompts (box or point)
            if roi_box and len(roi_box) >= 4:
                box = roi_box
            else:
                # Full-image bounding box as default when no specific ROI provided
                box = [0, 0, 1024, 1024]
            payload: Dict[str, Any] = {
                "model": self.model_name,
                "box": box,
                "image_base64": image_b64,
                "return_mask_png_base64": True,
            }
        else:
            # MedSAM3: text-guided segmentation
            payload: Dict[str, Any] = {
                "model": self.model_name,
                "prompt": text_prompt,
                "image_base64": image_b64,
                "return_mask_png_base64": True,
            }
            if roi_box:
                payload["roi_box"] = roi_box

        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(url, data=data, headers=self._headers(), method="POST")

        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                response_data = json.loads(resp.read().decode())
                return self._process_response(response_data, text_prompt)
        except urllib.error.HTTPError as e:
            body = ""
            try:
                body = e.read().decode()[:500]
            except Exception:
                pass
            print(f"[MedSAM3] HTTP {e.code} from {url}: {body}")
            return {"found": False, "error": f"HTTP {e.code}: {body}"}
        except urllib.error.URLError as e:
            print(f"[MedSAM3] Connection error: {e.reason}")
            return {"found": False, "error": f"Connection error: {e.reason}"}

    def _retry_with_point(
        self,
        image_b64: str,
        roi_box: Optional[List[int]] = None,
    ) -> Optional[Dict[str, Any]]:
        """Retry MedSAM2 segmentation with a center-point prompt instead of box."""
        if self.model_type != "medsam2":
            return None

        url = f"{self.base_url}/v1/segmentations"

        # Derive center point from ROI or use image center
        if roi_box and len(roi_box) >= 4:
            cx = (roi_box[0] + roi_box[2]) // 2
            cy = (roi_box[1] + roi_box[3]) // 2
        else:
            cx, cy = 512, 512  # Default to image center

        payload: Dict[str, Any] = {
            "model": self.model_name,
            "point_coords": [[cx, cy]],
            "point_labels": [1],
            "image_base64": image_b64,
            "return_mask_png_base64": True,
        }

        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(url, data=data, headers=self._headers(), method="POST")

        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                response_data = json.loads(resp.read().decode())
                return self._process_response(response_data, "point_prompt")
        except Exception as e:
            print(f"[MedSAM2] Point-prompt retry failed: {e}")
            return None

    def _process_response(
        self,
        response: Dict[str, Any],
        text_prompt: str,
    ) -> Dict[str, Any]:
        """Parse the MedSAM3 /v1/segmentations response.

        Real response contains: mask_png_base64 (PNG of the segmentation mask)
        May also contain: bbox, score, confidence, etc.
        """
        # ── Flatten wrappers (e.g., {"data": {"mask...}} or {"data": [{"mask...}]})
        if "data" in response:
            if isinstance(response["data"], list) and len(response["data"]) > 0:
                response.update(response["data"][0])
            elif isinstance(response["data"], dict):
                response.update(response["data"])
        elif "result" in response and isinstance(response["result"], dict):
            response.update(response["result"])

        # ── Priority 1: mask_png_base64 (real MedSAM3 response) ──────────────
        mask_b64 = response.get("mask_png_base64") or response.get("mask_base64") or response.get("mask")
        if mask_b64 and isinstance(mask_b64, str):
            try:
                # Strip data URL prefix if present
                if "," in mask_b64:
                    mask_b64 = mask_b64.split(",", 1)[1]
                mask_bytes = base64.b64decode(mask_b64)
                mask_img = Image.open(io.BytesIO(mask_bytes)).convert("L")
                mask_array = np.array(mask_img)
                mask_binary = (mask_array > 127).astype(np.uint8)

                geometry = mask_to_geometry(mask_binary, text_prompt)

                # Use server confidence if provided
                server_conf = response.get("confidence") or response.get("score")
                if server_conf is not None:
                    geometry["confidence"] = float(server_conf)

                # Attach the mask itself for overlay rendering
                geometry["mask_png_base64"] = response.get("mask_png_base64", "")
                return geometry

            except Exception as e:
                print(f"[MedSAM3] Failed to decode mask: {e}")

        # ── Priority 2: bounding box only ────────────────────────────────────
        bbox = response.get("bbox") or response.get("bounding_box")
        if isinstance(bbox, list) and len(bbox) >= 4:
            x_min, y_min, x_max, y_max = [int(v) for v in bbox[:4]]
            center_x = (x_min + x_max) / 2
            center_y = (y_min + y_max) / 2
            radius = max(x_max - x_min, y_max - y_min) / 2
            return {
                "found": True,
                "confidence": float(response.get("confidence") or response.get("score", 0.7)),
                "segmentation": {"mask_available": False, "bbox": [x_min, y_min, x_max, y_max]},
                "box_annotation": {
                    "type": "bounding_box",
                    "x": x_min, "y": y_min,
                    "width": x_max - x_min, "height": y_max - y_min,
                    "label": text_prompt,
                },
                "circle_annotation": {
                    "type": "circle",
                    "center_x": center_x, "center_y": center_y,
                    "radius": radius, "label": text_prompt,
                },
                "contour_points": [],
            }

        # ── Priority 3: explicit not-found or errors ──────────────────────────
        if response.get("found") is False or response.get("detected") is False:
            return {"found": False, "message": f"No region found for '{text_prompt}'."}
            
        if "error" in response:
            return {"found": False, "error": str(response["error"])}

        # ── Fallback ──────────────────────────────────────────────────────────
        print(f"[MedSAM3] Unexpected response format: {list(response.keys())}")
        return {
            "found": False,
            "message": "Unexpected response format from segmentation backend.",
            "raw_keys": list(response.keys()),
        }


def get_medsam3_service() -> MedSAM3Service:
    """Get a MedSAM3 service instance with config loaded from DB."""
    return MedSAM3Service()
