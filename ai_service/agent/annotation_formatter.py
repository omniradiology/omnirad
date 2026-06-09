"""
OmniRad AI Copilot — Annotation Formatter

Converts raw segmentation and geometry results into structured
viewer action payloads for the OmniRad frontend.
"""

import uuid
from typing import Any, Dict, List, Optional

try:
    from models.medsam3_service import load_segmentation_config
    def _get_model_type() -> str:
        config = load_segmentation_config()
        return config.get("model_type", "medsam3") if config else "medsam3"
except ImportError:
    def _get_model_type() -> str:
        return "medsam3"


def format_annotation_response(
    segmentation_result: Dict[str, Any],
    prompt: str,
    slice_index: int = 0,
    confidence: float = 0.0,
) -> Dict[str, Any]:
    """Format a segmentation result into a complete annotate response.
    
    Returns the shape expected by the frontend:
    {
        "reply": str,
        "viewer_actions": [...],
        "findings_summary": [...]
    }
    """
    if not segmentation_result.get("found", False):
        return {
            "reply": segmentation_result.get("message", f"No findings for '{prompt}'."),
            "viewer_actions": [],
            "findings_summary": [],
        }
    
    viewer_actions: List[Dict[str, Any]] = []
    findings: List[Dict[str, Any]] = []
    
    ann_id = f"ai_ann_{uuid.uuid4().hex[:8]}"
    seg_id = f"ai_seg_{uuid.uuid4().hex[:8]}"
    conf = segmentation_result.get("confidence", confidence)
    
    # Navigate
    viewer_actions.append({
        "type": "navigate",
        "action": "jump_to_slice",
        "slice": slice_index,
    })
    
    # Bounding box annotation
    box = segmentation_result.get("box_annotation")
    if box:
        viewer_actions.append({
            "type": "annotation",
            "action": "create_bounding_box_annotation",
            "annotation_id": ann_id,
            "slice": slice_index,
            "x": box["x"],
            "y": box["y"],
            "width": box["width"],
            "height": box["height"],
            "label": prompt,
            "label_mode": "always",
            "color": "#ff4d4f",
            "confidence": conf,
            "metadata": {
                "source": "ai",
                "model": _get_model_type(),
                "prompt": prompt,
            },
        })
    
    # Circle annotation
    circle = segmentation_result.get("circle_annotation")
    if circle:
        viewer_actions.append({
            "type": "annotation",
            "action": "create_circle_annotation",
            "annotation_id": f"{ann_id}_circle",
            "slice": slice_index,
            "center_x": circle["center_x"],
            "center_y": circle["center_y"],
            "radius": circle["radius"],
            "label": prompt,
            "label_mode": "always",
            "color": "#ff6b6b",
            "confidence": conf,
            "metadata": {
                "source": "ai",
                "model": _get_model_type(),
                "prompt": prompt,
            },
        })
    
    # Segmentation overlay
    seg = segmentation_result.get("segmentation", {})
    if seg.get("bbox"):
        viewer_actions.append({
            "type": "segmentation",
            "action": "render_mask_overlay",
            "segmentation_id": seg_id,
            "slice": slice_index,
            "label": prompt,
            "label_mode": "always",
            "color": "#ff4d4f",
            "opacity": 0.25,
            "bbox": seg["bbox"],
            "contour_points": segmentation_result.get("contour_points", []),
            "metadata": {
                "source": "ai",
                "model": _get_model_type(),
                "prompt": prompt,
            },
        })
    
    # Finding summary
    findings.append({
        "name": prompt,
        "confidence": conf,
        "annotation_id": ann_id,
        "segmentation_id": seg_id,
        "slice": slice_index,
        "prompt": prompt,
    })
    
    # Compose reply text
    conf_pct = f"{int(conf * 100)}%" if conf > 0 else ""
    reply_parts = [
        f"I found and highlighted **{prompt}**" + (f" ({conf_pct} confidence)" if conf_pct else "") + " on the current study.",
        "",
        "The following annotations have been rendered in the viewer:",
    ]
    if box:
        reply_parts.append(f"- 📦 Bounding box around the region")
    if circle:
        reply_parts.append(f"- ⭕ Circle marker at the center of the finding")
    if seg.get("bbox"):
        reply_parts.append(f"- 🔴 Semi-transparent segmentation overlay")
    
    return {
        "reply": "\n".join(reply_parts),
        "viewer_actions": viewer_actions,
        "findings_summary": findings,
    }
