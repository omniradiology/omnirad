"""
OmniRad AI Copilot — Segmentation Tools

LangChain tools for MedSAM2/MedSAM3 segmentation, used by the copilot agent
to localize and segment medical structures from natural language prompts.

Supports context-aware annotation type selection:
- "point to" / "mark the fracture" → arrow
- "highlight" / "show the hemorrhage" → circle + overlay
- "where is" / "find" → bbox + circle
- "segment" → full overlay
"""

import json
import os
import sqlite3
from typing import Optional, List
from langchain_core.tools import tool

from models.medsam3_service import get_medsam3_service, normalize_prompt, generate_prompt_variants, load_segmentation_config


def _get_model_type() -> str:
    """Get the configured model type from the segmentation config."""
    config = load_segmentation_config()
    return config.get("model_type", "medsam3") if config else "medsam3"


def _get_db_path() -> str:
    base = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    return os.path.join(base, "data", "omnirad.db")

def _fetch_report_row(report_id: str, conn: sqlite3.Connection) -> Optional[sqlite3.Row]:
    """Fetch report row by UUID or by internal report_id inside the JSON."""
    cursor = conn.execute("SELECT id, report_data, image_data FROM reports WHERE id = ?", (report_id,))
    row = cursor.fetchone()
    if row:
        return row
        
    try:
        # Fallback using SQLite json_extract
        cursor = conn.execute(
            "SELECT id, report_data, image_data FROM reports WHERE json_extract(report_data, '$.report_header.report_id') = ?",
            (report_id,)
        )
        row = cursor.fetchone()
        if row:
            return row
    except Exception:
        pass
        
    # Manual fallback if JSON1 extension is missing
    cursor = conn.execute("SELECT id, report_data, image_data FROM reports")
    for r in cursor.fetchall():
        try:
            rd = json.loads(r["report_data"]) if isinstance(r["report_data"], str) else r["report_data"]
            if rd and rd.get("report_header", {}).get("report_id") == report_id:
                return r
        except Exception:
            pass
    return None


def _get_report_image(report_id: str) -> Optional[str]:
    """Get the base64 image data from a report."""
    db_path = _get_db_path()
    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        row = _fetch_report_row(report_id, conn)
        conn.close()
        if row:
            if row["image_data"]:
                return row["image_data"]
            try:
                rd = json.loads(row["report_data"]) if isinstance(row["report_data"], str) else row["report_data"]
                if rd.get("images_data") and len(rd["images_data"]) > 0:
                    return rd["images_data"][0]
                if rd.get("image_data"):
                    return rd["image_data"]
            except (json.JSONDecodeError, TypeError):
                pass
    except Exception as e:
        print(f"[SegTools] Error loading report image: {e}")
    return None


def _get_report_image_at_slice(report_id: str, slice_index: int = 0) -> Optional[str]:
    """Get a specific slice image from a multi-image report."""
    db_path = _get_db_path()
    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        row = _fetch_report_row(report_id, conn)
        conn.close()
        if row:
            try:
                rd = json.loads(row["report_data"]) if isinstance(row["report_data"], str) else row["report_data"]
                images = rd.get("images_data", [])
                if images and 0 <= slice_index < len(images):
                    return images[slice_index]
                elif images:
                    return images[0]
            except (json.JSONDecodeError, TypeError):
                pass
            if row["image_data"]:
                return row["image_data"]
    except Exception as e:
        print(f"[SegTools] Error loading slice image: {e}")
    return None


def _get_report_findings(report_id: str) -> dict:
    """Load report data + findings text from a report."""
    db_path = _get_db_path()
    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        row = _fetch_report_row(report_id, conn)
        conn.close()
        if row:
            rd = json.loads(row["report_data"]) if isinstance(row["report_data"], str) else row["report_data"]
            return {
                "findings": rd.get("findings", ""),
                "impression": rd.get("impression", ""),
                "conclusion": rd.get("conclusion", ""),
                "body": rd.get("body", ""),
                "image_data": row["image_data"] or (rd.get("images_data", [None])[0] if rd.get("images_data") else rd.get("image_data")),
                "images_data": rd.get("images_data", []),
            }
    except Exception as e:
        print(f"[SegTools] Error loading report findings: {e}")
    return {}


def _get_all_slices(report_id: str) -> List[str]:
    """Load all slice images from a report. Returns list of base64 images."""
    db_path = _get_db_path()
    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        row = _fetch_report_row(report_id, conn)
        conn.close()
        if row:
            try:
                rd = json.loads(row["report_data"]) if isinstance(row["report_data"], str) else row["report_data"]
                images = rd.get("images_data", [])
                if images:
                    return images
            except (json.JSONDecodeError, TypeError):
                pass
            # Fallback: single image
            if row["image_data"]:
                return [row["image_data"]]
    except Exception as e:
        print(f"[SegTools] Error loading all slices: {e}")
    return []

def _localize_finding_with_vision(image_b64: str, prompt: str) -> Optional[List[int]]:
    """Use the Copilot LLM (Gemini Vision) to localize a finding and return a bounding box."""
    try:
        from PIL import Image
        import io
        import base64
        import re

        # Check if it's a file path
        if image_b64.startswith("/uploads/"):
            # Load from file system
            base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            file_path = os.path.join(base_dir, "public", image_b64.lstrip("/"))
            with open(file_path, "rb") as f:
                img_bytes = f.read()
            b64 = base64.b64encode(img_bytes).decode("utf-8")
        else:
            # Extract base64 without data URI scheme if present
            b64 = image_b64.split(",")[1] if "," in image_b64 else image_b64
            img_bytes = base64.b64decode(b64)
            
        # Get image dimensions
        img = Image.open(io.BytesIO(img_bytes))
        width, height = img.size
        
        # Load LLM
        from agent.copilot_workflow import _get_copilot_config, _create_llm
        from langchain_core.messages import HumanMessage
        
        config = _get_copilot_config()
        if not config:
            return None
            
        llm = _create_llm(config)
        
        # We need a vision-capable LLM to do this
        msg = HumanMessage(content=[
            {
                "type": "text", 
                "text": f"Locate the '{prompt}' in this medical image. Return ONLY a JSON array of four integers [ymin, xmin, ymax, xmax] where each value is between 0 and 1000 representing the bounding box scaled to 1000x1000. Example: [250, 300, 450, 500]. Do not include any other text."
            },
            {
                "type": "image_url", 
                "image_url": {"url": f"data:image/jpeg;base64,{b64}"}
            }
        ])
        
        resp = llm.invoke([msg])
        text = str(resp.content)
        
        # Parse JSON array
        match = re.search(r"\[([\d\.,\s]+)\]", text)
        if match:
            coords = json.loads(f"[{match.group(1)}]")
            if len(coords) == 4:
                ymin, xmin, ymax, xmax = coords
                # Convert from 0-1000 scale to absolute pixel coordinates
                return [
                    int((xmin / 1000.0) * width),
                    int((ymin / 1000.0) * height),
                    int((xmax / 1000.0) * width),
                    int((ymax / 1000.0) * height)
                ]
    except Exception as e:
        print(f"[Vision Localization] Failed to localize '{prompt}': {e}")
    
    return None

# ─── Slice Navigation Tool ────────────────────────────────────────────────────

@tool
def find_slice_with_finding(
    prompt: str,
    report_id: str,
    annotation_style: Optional[str] = None,
    search_from_slice: Optional[int] = None,
    search_direction: Optional[str] = None,
) -> str:
    """Find which slice in a multi-slice study contains a specific finding,
    then jump to it and annotate it.

    Use this tool when the user asks:
    - "Take me to the slice with the lesion"
    - "Show the slice where the abnormality starts"
    - "Which slice has the tumor?"
    - "Go to the relevant slice"
    - "Find the slice with the hemorrhage"
    - "Show me where the finding first appears"

    The tool will:
    1. Load all slices from the report
    2. Run segmentation on each slice (or a subset) to find where the finding appears
    3. Select the BEST slice — the one where the model has highest confidence
    4. Jump to that slice and create an annotation on the finding

    Args:
        prompt: What to find (e.g. "lesion", "tumor", "hemorrhage", "fracture")
        report_id: The report ID to scan slices from.
        annotation_style: Optional override: 'arrow', 'circle', 'bbox', 'overlay', 'full'.
                          Auto-detected from prompt if not provided.
        search_from_slice: Optional starting slice index (for "starts at" queries).
        search_direction: Optional 'forward' or 'backward' search direction.

    Returns:
        JSON with the best slice index, confidence, and viewer actions.
    """
    # Load all slices
    all_slices = _get_all_slices(report_id)

    if not all_slices:
        return json.dumps({
            "error": "No images found in this report. Make sure a report with images is loaded.",
            "viewer_actions": [],
        })

    total_slices = len(all_slices)

    # Single-slice report — fall back to regular segmentation
    if total_slices == 1:
        image_data = all_slices[0]
        try:
            service = get_medsam3_service()
            if not service.config or not service.config.get("is_active"):
                return json.dumps({
                    "error": "Segmentation model is not configured. Go to Settings → Segmentation Model Integration.",
                    "viewer_actions": [],
                })
            result = service.predict(image_data, prompt, 0)
            if result.get("found"):
                style = annotation_style or _detect_annotation_style(prompt)
                actions = _build_viewer_actions(result, prompt, 0, style)
                return json.dumps({
                    "best_slice": 0,
                    "total_slices": total_slices,
                    "confidence": result.get("confidence", 0.0),
                    "message": f"Found '{prompt}' on the only available image.",
                    "viewer_actions": actions,
                    "findings_summary": [{
                        "name": prompt,
                        "confidence": result.get("confidence", 0.0),
                        "slice": 0,
                    }],
                })
            else:
                return json.dumps({
                    "message": f"Could not find '{prompt}' in the image.",
                    "viewer_actions": [],
                })
        except Exception as e:
            return json.dumps({"error": str(e), "viewer_actions": []})

    # Multi-slice: scan slices strategically
    try:
        service = get_medsam3_service()
        if not service.config or not service.config.get("is_active"):
            return json.dumps({
                "error": "Segmentation model is not configured. Go to Settings → Segmentation Model Integration.",
                "viewer_actions": [],
            })

        # Determine which slices to scan
        # Strategy: scan every Nth slice first, then refine around best hit
        MAX_FULL_SCAN = 20      # Scan all slices if <= 20 total
        SAMPLE_STEP = max(1, total_slices // 12)  # Sample ~12 slices for larger volumes

        # Build candidate slice indices
        start_idx = search_from_slice or 0
        if search_direction == "backward":
            candidates = list(range(start_idx, -1, -SAMPLE_STEP))
        else:
            candidates = list(range(start_idx, total_slices, SAMPLE_STEP))

        # Always include first, middle, last
        must_include = [0, total_slices // 4, total_slices // 2, (3 * total_slices) // 4, total_slices - 1]
        for idx in must_include:
            if idx not in candidates:
                candidates.append(idx)
        candidates = sorted(set(candidates))

        print(f"[SliceFinder] Scanning {len(candidates)}/{total_slices} slices for '{prompt}'")

        # Scan candidates
        best_slice = None
        best_confidence = -1.0
        best_result = None
        slice_results = []

        for slice_idx in candidates:
            if slice_idx >= total_slices:
                continue
            image_data = all_slices[slice_idx]
            try:
                result = service.predict(image_data, prompt, slice_idx)
                conf = result.get("confidence", 0.0) if result.get("found") else 0.0
                slice_results.append({"slice": slice_idx, "confidence": conf, "found": result.get("found", False)})

                if result.get("found") and conf > best_confidence:
                    best_confidence = conf
                    best_slice = slice_idx
                    best_result = result
                    print(f"[SliceFinder] New best: slice {slice_idx}, confidence={conf:.2f}")
            except Exception as e:
                print(f"[SliceFinder] Error on slice {slice_idx}: {e}")
                continue

        # Refine: scan neighbors around best hit for "first appearance" queries
        is_first_appearance = any(w in prompt.lower() for w in [
            "start", "first", "begin", "earliest", "initial"
        ])

        if best_slice is not None and is_first_appearance and SAMPLE_STEP > 1:
            # Scan backward from best to find first slice where it appears
            refine_start = max(0, best_slice - SAMPLE_STEP)
            refine_end = best_slice
            print(f"[SliceFinder] Refining: scanning slices {refine_start}–{refine_end} for first appearance")
            for slice_idx in range(refine_start, refine_end + 1):
                if slice_idx >= total_slices:
                    continue
                image_data = all_slices[slice_idx]
                try:
                    result = service.predict(image_data, prompt, slice_idx)
                    if result.get("found"):
                        # Found an earlier occurrence — this is now the first
                        best_slice = slice_idx
                        best_result = result
                        best_confidence = result.get("confidence", 0.0)
                        break
                except Exception:
                    continue

        if best_slice is None or best_result is None:
            return json.dumps({
                "message": f"Scanned {len(candidates)} slices but could not find '{prompt}' in this study.",
                "total_slices": total_slices,
                "slices_scanned": len(candidates),
                "viewer_actions": [],
            })

        # Build viewer actions for the best slice
        style = annotation_style or _detect_annotation_style(prompt)
        viewer_actions = _build_viewer_actions(best_result, prompt, best_slice, style)

        if report_id:
            viewer_actions.insert(0, {
                "type": "OPEN_DICOM",
                "studyId": report_id,
                "reportId": report_id,
            })

        # Human-readable slice description
        slice_pct = int((best_slice / max(total_slices - 1, 1)) * 100)
        position_desc = (
            "early in the volume" if slice_pct < 25 else
            "in the upper portion" if slice_pct < 40 else
            "near the middle" if slice_pct < 60 else
            "in the lower portion" if slice_pct < 75 else
            "late in the volume"
        )

        return json.dumps({
            "best_slice": best_slice,
            "best_slice_human": best_slice + 1,  # 1-indexed for display
            "total_slices": total_slices,
            "slices_scanned": len(candidates),
            "confidence": best_confidence,
            "position_description": position_desc,
            "message": f"Found '{prompt}' on slice {best_slice + 1} of {total_slices} ({position_desc}), confidence {int(best_confidence * 100)}%.",
            "viewer_actions": viewer_actions,
            "findings_summary": [{
                "name": prompt,
                "confidence": best_confidence,
                "slice": best_slice,
                "annotation_id": f"ai_slice_find_{hash(prompt) % 10000}",
            }],
        })

    except Exception as e:
        return json.dumps({
            "error": f"Slice search failed: {str(e)}",
            "viewer_actions": [],
        })


# ─── Annotation Strategy ─────────────────────────────────────────────────────

def _detect_annotation_style(user_prompt: str) -> str:
    """Detect the best annotation style based on the user's intent.
    
    Returns one of: 'arrow', 'circle', 'bbox', 'overlay', 'full'
    """
    prompt_lower = user_prompt.lower()
    
    # Arrow: pointing, marking lines, fractures
    arrow_keywords = [
        "point to", "point at", "mark the", "where exactly",
        "fracture", "fracture line", "show me where",
        "where should i look", "where should i focus",
        "take me to", "direct me", "indicate",
    ]
    if any(kw in prompt_lower for kw in arrow_keywords):
        return "arrow"
    
    # Overlay: highlight, hemorrhage, segment
    overlay_keywords = [
        "highlight", "segment", "overlay", "mask",
        "hemorrhage", "bleeding", "effusion", "edema",
        "consolidation", "opacity", "mass",
    ]
    if any(kw in prompt_lower for kw in overlay_keywords):
        return "overlay"
    
    # Circle: lesion, tumor, nodule, abnormality (round things)
    circle_keywords = [
        "lesion", "tumor", "tumour", "nodule", "cyst",
        "abnormal", "suspicious", "finding",
        "circle", "mark",
    ]
    if any(kw in prompt_lower for kw in circle_keywords):
        return "circle"
    
    # Bbox: locate, where is, find, check
    bbox_keywords = [
        "where is", "find", "locate", "check", "detect",
        "look for", "search",
    ]
    if any(kw in prompt_lower for kw in bbox_keywords):
        return "bbox"
    
    # Default: full annotation set
    return "full"


# ─── Main Segmentation Tool ──────────────────────────────────────────────────

@tool
def run_segmentation(
    prompt: str,
    report_id: Optional[str] = None,
    slice_index: Optional[int] = None,
    viewport_image: Optional[str] = None,
    annotation_style: Optional[str] = None,
    zoom_to_finding: Optional[bool] = None,
) -> str:
    """Run AI segmentation on a medical image using MedSAM2 or MedSAM3.
    Use this tool when the user asks to find, segment, highlight, point to,
    mark, check, or locate a specific structure or finding in the medical image.
    
    The tool will:
    1. Load the medical image from the current report
    2. Run segmentation with the given prompt
    3. Return the appropriate annotation type based on context:
       - Arrow annotations for "point to", "where exactly", fractures
       - Circle annotations for lesions, tumors, nodules
       - Overlay annotations for highlights, hemorrhage, segmentation
       - Bounding box for "where is", "find", "locate"
    
    Args:
        prompt: Natural language description of what to segment (e.g. "liver lesion", "left kidney", "hemorrhage")
        report_id: Optional report ID to load the image from. If not provided, uses the viewport image.
        slice_index: Optional slice index for multi-slice studies (0-indexed)
        viewport_image: Optional base64 image of the current viewport
        annotation_style: Optional override: 'arrow', 'circle', 'bbox', 'overlay', or 'full'. 
                          If not provided, auto-detected from the prompt.
        zoom_to_finding: Set to True to zoom the viewer into the finding region. 
                         Use when the user says "zoom in", "zoom to", "close up", "magnify" etc.
    
    Returns:
        JSON with segmentation results and viewer actions for rendering.
    """
    image_data = None
    
    if viewport_image:
        image_data = viewport_image
    elif report_id:
        if slice_index is not None:
            image_data = _get_report_image_at_slice(report_id, slice_index)
        else:
            image_data = _get_report_image(report_id)
    
    if not image_data:
        return json.dumps({
            "error": "No image available for segmentation. Please ensure a report with images is loaded.",
            "viewer_actions": [],
        })
    
    try:
        service = get_medsam3_service()
        
        config = service.config
        if not config or not config.get("is_active"):
            return json.dumps({
                "error": "Segmentation model is not configured. Please go to Settings → Segmentation Model Integration to set up MedSAM2/MedSAM3.",
                "viewer_actions": [],
            })
        
        # Pre-localize for MedSAM2 to provide spatial coordinates
        roi_box = None
        if _get_model_type() == "medsam2":
            roi_box = _localize_finding_with_vision(image_data, prompt)
            if roi_box:
                print(f"[SegTools] Localized '{prompt}' at {roi_box} for MedSAM2")
        
        result = service.predict(image_data, prompt, slice_index, roi_box=roi_box)
        
        if not result.get("found", False):
            return json.dumps({
                "message": result.get("message", f"No findings for '{prompt}' in the current image."),
                "viewer_actions": [],
                "prompt_variants": result.get("prompt_variants", []),
            })
        
        # Determine annotation style
        style = annotation_style or _detect_annotation_style(prompt)
        
        # Detect zoom intent from prompt if not explicitly set
        should_zoom = zoom_to_finding or False
        
        # Build viewer actions with the appropriate style
        viewer_actions = _build_viewer_actions(result, prompt, slice_index, style, zoom=should_zoom)
        
        if report_id:
            viewer_actions.insert(0, {
                "type": "OPEN_DICOM",
                "studyId": report_id,
                "reportId": report_id,
            })
        
        return json.dumps({
            "message": f"Found and segmented: {prompt}",
            "viewer_actions": viewer_actions,
            "segmentation": result.get("segmentation", {}),
            "confidence": result.get("confidence", 0.0),
            "annotation_style": style,
            "prompt_used": result.get("prompt_used", prompt),
            "prompt_variants": result.get("prompt_variants", []),
        })
    
    except Exception as e:
        return json.dumps({
            "error": f"Segmentation failed: {str(e)}",
            "viewer_actions": [],
        })


# ─── Report-Grounded Annotation Tool ─────────────────────────────────────────

@tool
def annotate_report_findings(
    report_id: str,
    findings_text: Optional[str] = None,
    slice_index: Optional[int] = None,
    viewport_image: Optional[str] = None,
) -> str:
    """Annotate the medical image with findings from the radiology report.
    Use this when the user asks to:
    - "highlight the findings"
    - "show me what the report describes"
    - "annotate the findings from the report"
    - "show the finding area that corresponds to the report"
    
    This tool reads the report text, extracts key findings, and runs segmentation
    for each finding to create labeled annotations on the image.
    
    Args:
        report_id: The report ID to load findings and image from.
        findings_text: Optional explicit findings text. If not provided, loaded from report.
        slice_index: Optional slice index for multi-slice studies.
    
    Returns:
        JSON with viewer actions for all findings annotations.
    """
    # Load report data
    report_data = _get_report_findings(report_id) or {}
    
    if not report_data and not viewport_image:
        return json.dumps({
            "error": "Could not load report data or find a current image. Make sure a report or images are loaded.",
            "viewer_actions": [],
        })
    
    # Get findings text
    text_raw = findings_text or report_data.get("findings", "") or report_data.get("impression", "") or report_data.get("body", "")
    
    # Ensure text is a string (report_data['findings'] is often a list of dicts)
    if isinstance(text_raw, list):
        text = " ".join([str(t.get("observation", t)) if isinstance(t, dict) else str(t) for t in text_raw])
    else:
        text = str(text_raw)
        
    if not text.strip():
        return json.dumps({
            "message": "No findings text found in the report to annotate.",
            "viewer_actions": [],
        })
    
    # Get image: Prioritize securely stored report image over viewport screen for accurate context
    image_data = None
    if report_data:
        image_data = report_data.get("image_data")
        
    if not image_data and viewport_image:
        image_data = viewport_image
        
    if not image_data:
        return json.dumps({
            "error": "No image available in this report for annotation.",
            "viewer_actions": [],
        })
    
    # Extract key medical terms from findings
    finding_terms = _extract_finding_terms(text)
    
    if not finding_terms:
        return json.dumps({
            "message": "Could not extract specific finding terms from the report text. Try asking me to segment a specific structure.",
            "viewer_actions": [],
        })
    
    # Run segmentation for each finding term
    service = get_medsam3_service()
    config = service.config
    if not config or not config.get("is_active"):
        return json.dumps({
            "error": "Segmentation model is not configured. Go to Settings → Segmentation Model Integration.",
            "viewer_actions": [],
        })
    
    all_actions = []
    
    # Prepend OPEN_DICOM to ensure the UI mounts the correct report first
    if report_id:
        all_actions.append({
            "type": "OPEN_DICOM",
            "studyId": report_id,
            "reportId": report_id,
        })
        
    findings_summary = []
    successful = 0
    target_slice = slice_index or 0
    
    # Navigate first
    all_actions.append({
        "type": "navigate",
        "action": "jump_to_slice",
        "slice": target_slice,
    })
    
    # Unique colors for multiple findings
    colors = ["#ff4d4f", "#ff7a45", "#ffa940", "#fadb14", "#52c41a", "#13c2c2", "#1890ff", "#722ed1"]
    
    is_medsam2 = _get_model_type() == "medsam2"
    
    for i, term in enumerate(finding_terms[:6]):  # Cap at 6 findings
        try:
            roi_box = None
            if is_medsam2:
                roi_box = _localize_finding_with_vision(image_data, term)
                
            result = service.predict(image_data, term, slice_index, roi_box=roi_box)
            if result.get("found", False):
                color = colors[i % len(colors)]
                confidence = result.get("confidence", 0.0)
                ann_id = f"ai_finding_{i}_{hash(term) % 10000}"
                
                # Add bbox with label
                box = result.get("box_annotation")
                if box:
                    all_actions.append({
                        "type": "annotation",
                        "action": "create_bounding_box_annotation",
                        "annotation_id": ann_id,
                        "slice": target_slice,
                        "x": box["x"],
                        "y": box["y"],
                        "width": box["width"],
                        "height": box["height"],
                        "label": term,
                        "label_mode": "always",
                        "color": color,
                        "confidence": confidence,
                        "metadata": {"source": "ai", "model": _get_model_type(), "prompt": term},
                    })
                
                # Add arrow pointing to center
                circle = result.get("circle_annotation")
                if circle:
                    cx, cy, r = circle["center_x"], circle["center_y"], circle["radius"]
                    all_actions.append({
                        "type": "annotation",
                        "action": "create_arrow_annotation",
                        "annotation_id": f"{ann_id}_arrow",
                        "slice": target_slice,
                        "start_x": cx - r * 1.8,
                        "start_y": cy - r * 1.8,
                        "end_x": cx,
                        "end_y": cy,
                        "label": term,
                        "label_mode": "always",
                        "color": color,
                        "confidence": confidence,
                        "metadata": {"source": "ai", "model": _get_model_type(), "prompt": term},
                    })
                
                findings_summary.append({
                    "name": term,
                    "confidence": confidence,
                    "annotation_id": ann_id,
                    "slice": target_slice,
                    "prompt": term,
                })
                successful += 1
        except Exception as e:
            print(f"[SegTools] Failed to segment finding '{term}': {e}")
    
    if successful == 0:
        return json.dumps({
            "message": f"Analyzed the report findings but could not localize any of the {len(finding_terms)} terms in the image.",
            "viewer_actions": all_actions,
            "finding_terms": finding_terms,
        })
    
    return json.dumps({
        "message": f"Annotated {successful} of {len(finding_terms)} findings from the report.",
        "viewer_actions": all_actions,
        "findings_summary": findings_summary,
        "finding_terms": finding_terms,
    })


def _extract_finding_terms(text: str) -> List[str]:
    """Extract segmentable medical terms from report findings text.
    
    Handles all radiology specialties: chest, dental, MSK, neuro, abdominal, etc.
    """
    import re
    
    text_lower = text.lower()
    
    # Step 1: Split into sentences
    sentences = re.split(r'[.;]\s*', text_lower)
    
    negation_patterns = [
        r'\bno\s+(?:evidence\s+of\s+)?',
        r'\bwithout\s+',
        r'\bnot\s+(?:identified|seen|demonstrated|observed|noted)\b',
        r'\bdenies\s+',
        r'\babsent\b',
        r'\bunremarkable\b',
        r'\bclear\b',
        r'\bintact\b',
        r'\bpreserved\b',
    ]
    
    # Step 2: Classify sentences
    positive_sentences = []
    for sent in sentences:
        sent = sent.strip()
        if not sent or len(sent) < 10:
            continue
        is_negated = False
        for neg in negation_patterns:
            if re.search(neg, sent):
                is_negated = True
                break
        if 'normal' in sent and not any(w in sent for w in ['abnormal', 'abnormality', 'not normal']):
            is_negated = True
        if not is_negated:
            positive_sentences.append(sent)
    
    search_text = " ".join(positive_sentences) if positive_sentences else text_lower
    
    terms = []
    
    # Step 3: Multi-word compound patterns (all specialties)
    compound_patterns = [
        # Chest / Thoracic
        r'((?:left|right|bilateral)\s+(?:upper|lower|middle)\s+(?:lobe|lung)\s+\w+)',
        r'((?:left|right)\s+(?:hemidiaphragm|hilum|ventricle|atrium|kidney|lung))',
        r'((?:focal|diffuse|bilateral|large|small|increased|decreased)\s+(?:consolidation|opacity|opacification|effusion|edema|oedema|hemorrhage|mass|lesion|nodule|atelectasis))',
        # Dental / Oral
        r'((?:mesially|distally|buccally|lingually|vertically|horizontally)\s+(?:tilted|impacted|displaced|angulated)\s+[\w\s]*?(?:molar|premolar|canine|incisor|tooth|teeth))',
        r'((?:impacted|unerupted|supernumerary|partially\s+impacted|partially\s+erupted|fully\s+impacted)\s+[\w\s]*?(?:molar|premolar|canine|incisor|tooth|teeth|third\s+molar))',
        r'((?:mandibular|maxillary)\s+(?:third\s+)?(?:molar|premolar|canine|incisor)s?)',
        r'((?:periapical|radicular|dentigerous|residual)\s+(?:cyst|lesion|abscess|radiolucency|pathology))',
        r'((?:dental|alveolar|periapical)\s+(?:caries|abscess|fracture|resorption))',
        # MSK / Orthopedic
        r'((?:displaced|non-displaced|comminuted|spiral|transverse|oblique)\s+fracture)',
        r'((?:rotator\s+cuff|labral|meniscal|ligament(?:ous)?)\s+(?:tear|rupture|injury|degeneration))',
        r'((?:anterior|posterior|medial|lateral)\s+(?:cruciate|collateral|meniscus|labrum)\s+(?:tear|rupture|injury))',
        # Neuro
        r'((?:subdural|epidural|subarachnoid|intraparenchymal|intraventricular)\s+(?:hemorrhage|hematoma|collection))',
        r'((?:midline)\s+(?:shift|deviation))',
        # Abdominal
        r'((?:hepatic|renal|splenic|pancreatic|adrenal)\s+(?:mass|lesion|cyst|calcification|enlargement))',
        r'((?:bowel|intestinal)\s+(?:obstruction|perforation|dilatation|wall\s+thickening))',
        # General location + pathology
        r'((?:consolidation|opacity|mass|lesion|effusion|hemorrhage)\s+(?:in|of|at)\s+the\s+[\w\s]{3,25})',
    ]
    
    for pattern in compound_patterns:
        matches = re.findall(pattern, search_text)
        for match in matches:
            clean = match.strip()
            if clean and len(clean) > 4 and clean not in terms:
                terms.append(clean)
    
    # Step 4: Single-word pathology terms (broad dictionary)
    pathology_terms = [
        # Chest
        r'(consolidation)', r'(opacification)', r'(atelectasis)',
        r'(pneumothorax)', r'(effusion)', r'(edema|oedema)',
        # General
        r'(mass(?:es)?)', r'(lesion(?:s)?)', r'(tumor|tumour)',
        r'(nodule(?:s)?)', r'(cyst(?:s)?)', r'(abscess)',
        r'(hemorrhage|haemorrhage|hematoma)',
        r'(fracture(?:s)?)', r'(dislocation(?:s)?)', r'(subluxation)',
        r'(stenosis)', r'(thrombosis)', r'(aneurysm)',
        r'(calcification(?:s)?)', r'(hernia)', r'(obstruction)',
        r'(erosion(?:s)?)', r'(sclerosis)', r'(necrosis)',
        # Dental
        r'(caries)', r'(radiolucency)', r'(resorption)',
        r'(impaction)', r'(malocclusion)', r'(periodontitis)',
        # MSK
        r'(osteophyte(?:s)?)', r'(spondylolisthesis)', r'(scoliosis)',
        r'(arthritis)', r'(bursitis)', r'(tendinopathy|tendinosis)',
        # Neuro
        r'(infarct(?:ion)?)', r'(ischemia)', r'(glioma)', r'(meningioma)',
        r'(hydrocephalus)',
    ]
    
    for pattern in pathology_terms:
        matches = re.findall(pattern, search_text)
        for match in matches:
            clean = match.strip()
            if clean and clean not in terms and not any(clean in t for t in terms):
                terms.append(clean)
    
    # Step 5: Context-aware extraction
    context_patterns = [
        r'(?:showing|reveals?|demonstrat(?:es|ing)|consistent with|suggestive of|indicative of|compatible with)\s+(?:a\s+)?([^,\.;]{5,50})',
    ]
    for pattern in context_patterns:
        matches = re.findall(pattern, search_text)
        for match in matches:
            clean = match.strip()
            clean = re.sub(r'\s+(?:given|in|and|the|of)$', '', clean).strip()
            if clean and len(clean) > 4 and clean not in terms and not any(clean in t or t in clean for t in terms):
                terms.append(clean)
    
    # Step 6: Adjective+noun fallback for specialties not covered above
    if not terms:
        adj_noun_pattern = (
            r'((?:impacted|displaced|enlarged|dilated|thickened|narrowed|compressed|eroded|'
            r'irregular|distorted|disrupted|ruptured|torn|fractured|deviated|tilted|angulated|'
            r'partially\s+impacted|partially\s+erupted)\s+'
            r'[\w\s]{3,40}?(?:molar|tooth|teeth|bone|nerve|vessel|artery|vein|duct|gland|'
            r'node|lobe|ligament|tendon|muscle|disc|disk|sinus|canal|wall|tissue|joint|'
            r'space|cavity|valve|root|crown|ridge|ramus|condyle|foramen)s?)'
        )
        matches = re.findall(adj_noun_pattern, search_text)
        for match in matches:
            clean = match.strip()
            if clean and len(clean) > 4 and clean not in terms:
                terms.append(clean)
    
    # Step 7: Ultimate fallback — extract key noun phrases from positive sentences
    if not terms and positive_sentences:
        for sent in positive_sentences[:3]:
            cleaned = re.sub(r'\b(the|a|an|are|is|was|were|has|have|been|and|or|with|from|this|that|these|those|present|seen)\b', ' ', sent)
            cleaned = re.sub(r'\s+', ' ', cleaned).strip()
            chunks = [c.strip() for c in cleaned.split(',') if len(c.strip()) > 8]
            if chunks:
                term = chunks[-1][:60]
                if term not in terms:
                    terms.append(term)
    
    # Step 8: Deduplicate — remove substrings of longer terms
    final_terms = []
    for term in terms:
        is_substring = False
        for other in terms:
            if term != other and term in other and len(other) > len(term):
                is_substring = True
                break
        if not is_substring:
            final_terms.append(term)
    
    return final_terms[:8]


# ─── Clear Tool ──────────────────────────────────────────────────────────────

@tool
def clear_ai_findings() -> str:
    """Clear all AI-generated annotations and segmentation overlays from the viewer.
    Use this when the user asks to remove, clear, or reset AI findings."""
    return json.dumps({
        "message": "Cleared all AI annotations and segmentations.",
        "viewer_actions": [
            {
                "type": "clear",
                "action": "clear_all_ai_findings",
            }
        ],
    })


# ─── Action Builder with Smart Annotation Style ──────────────────────────────

def _build_viewer_actions(
    result: dict,
    prompt: str,
    slice_index: Optional[int] = None,
    style: str = "full",
    zoom: bool = False,
) -> list:
    """Convert segmentation geometry into viewer actions using the appropriate annotation style.
    
    Styles:
    - 'arrow': Navigate + arrow pointing to finding
    - 'circle': Navigate + circle around finding
    - 'bbox': Navigate + bounding box
    - 'overlay': Navigate + segmentation overlay only
    - 'full': Navigate + bbox + circle + overlay (default)
    """
    actions = []
    target_slice = slice_index or 0
    confidence = result.get("confidence", 0.0)
    box = result.get("box_annotation")
    circle = result.get("circle_annotation")
    seg = result.get("segmentation", {})
    
    # 1. Always navigate to the slice
    actions.append({
        "type": "navigate",
        "action": "jump_to_slice",
        "slice": target_slice,
    })
    
    # 2. Arrow annotation (for 'arrow' or 'full')
    if style in ("arrow", "full") and circle:
        cx, cy, r = circle["center_x"], circle["center_y"], circle["radius"]
        # Arrow from outside the region pointing inward
        actions.append({
            "type": "annotation",
            "action": "create_arrow_annotation",
            "annotation_id": f"ai_arrow_{hash(prompt) % 10000}",
            "slice": target_slice,
            "start_x": cx - r * 2.0,
            "start_y": cy - r * 2.0,
            "end_x": cx,
            "end_y": cy,
            "label": prompt,
            "label_mode": "always",
            "color": "#ff4d4f",
            "confidence": confidence,
            "metadata": {
                "source": "ai",
                "model": _get_model_type(),
                "prompt": prompt,
            },
        })
    
    # 3. Circle annotation (for 'circle' or 'full')
    if style in ("circle", "full") and circle:
        actions.append({
            "type": "annotation",
            "action": "create_circle_annotation",
            "annotation_id": f"ai_circle_{hash(prompt) % 10000}",
            "slice": target_slice,
            "center_x": circle["center_x"],
            "center_y": circle["center_y"],
            "radius": circle["radius"],
            "label": prompt,
            "label_mode": "always",
            "color": "#ff6b6b",
            "confidence": confidence,
            "metadata": {
                "source": "ai",
                "model": _get_model_type(),
                "prompt": prompt,
            },
        })
    
    # 4. Bounding box annotation (for 'bbox' or 'full')
    if style in ("bbox", "full") and box:
        actions.append({
            "type": "annotation",
            "action": "create_bounding_box_annotation",
            "annotation_id": f"ai_bbox_{hash(prompt) % 10000}",
            "slice": target_slice,
            "x": box["x"],
            "y": box["y"],
            "width": box["width"],
            "height": box["height"],
            "label": prompt,
            "label_mode": "always",
            "color": "#ff4d4f",
            "confidence": confidence,
            "metadata": {
                "source": "ai",
                "model": _get_model_type(),
                "prompt": prompt,
                "prompt_variants": result.get("prompt_variants", []),
            },
        })
    
    # 5. Segmentation overlay (for 'overlay' or 'full')
    if style in ("overlay", "full") and seg.get("bbox"):
        actions.append({
            "type": "segmentation",
            "action": "render_mask_overlay",
            "segmentation_id": f"ai_seg_{hash(prompt) % 10000}",
            "slice": target_slice,
            "label": prompt,
            "label_mode": "always",
            "color": "#ff4d4f",
            "opacity": 0.25,
            "bbox": seg["bbox"],
            "contour_points": result.get("contour_points", []),
            "metadata": {
                "source": "ai",
                "model": _get_model_type(),
                "prompt": prompt,
            },
        })
    
    # 6. Zoom to region — only when explicitly requested
    if zoom and box:
        actions.append({
            "type": "viewport",
            "action": "zoom_to_region",
            "x": box["x"],
            "y": box["y"],
            "width": box["width"],
            "height": box["height"],
        })
    
    return actions


# ─── All segmentation tools ──────────────────────────────────────────────────

ALL_SEGMENTATION_TOOLS = [
    run_segmentation,
    find_slice_with_finding,
    annotate_report_findings,
    clear_ai_findings,
]
