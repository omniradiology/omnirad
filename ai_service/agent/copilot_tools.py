"""
OmniRad AI Copilot — LangChain Tools

SQLite query tools and viewer action tools for the radiology copilot agent.
These tools allow the AI to query patient data and control the viewer panel.
"""

import sqlite3
import json
import os
from typing import Optional
from langchain_core.tools import tool


def _get_db_path() -> str:
    """Get the path to the OmniRad SQLite database."""
    # The database is in the project root's data/ directory
    base = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    return os.path.join(base, "data", "omnirad.db")


def _query_db(sql: str, params: tuple = ()) -> list[dict]:
    """Execute a read-only query and return results as list of dicts."""
    db_path = _get_db_path()
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    try:
        cursor = conn.execute(sql, params)
        return [dict(row) for row in cursor.fetchall()]
    finally:
        conn.close()


# ─── SQLite Data Retrieval Tools ──────────────────────────────────────────────

@tool
def search_patient_by_name(name: str) -> str:
    """Search for patients by name (case-insensitive, partial match).
    Use this when the user mentions a patient by name and you need to find their ID.
    Returns a list of matching patients with their IDs and basic information."""
    results = _query_db(
        "SELECT id, patient_name, age, gender, date_of_birth, created_at "
        "FROM patients WHERE LOWER(patient_name) LIKE LOWER(?) ORDER BY created_at DESC LIMIT 10",
        (f"%{name}%",)
    )
    if not results:
        return json.dumps({"found": False, "message": f"No patients found matching '{name}'."})
    return json.dumps({"found": True, "patients": results, "count": len(results)})


@tool
def get_patient_reports(patient_id: str) -> str:
    """Get all radiology reports for a specific patient, ordered by date (newest first).
    Use this to see a patient's full report history and timeline.
    Returns report IDs, dates, modalities, statuses, and key findings summaries."""
    results = _query_db(
        "SELECT id, patient_name, modality, urgency, report_status, report_data, created_at "
        "FROM reports WHERE patient_id = ? ORDER BY created_at DESC",
        (patient_id,)
    )
    if not results:
        return json.dumps({"found": False, "message": "No reports found for this patient."})

    # Parse report_data JSON and extract summaries
    summaries = []
    for r in results:
        try:
            rd = json.loads(r["report_data"]) if isinstance(r["report_data"], str) else r["report_data"]
            summary = {
                "report_id": rd.get("report_header", {}).get("report_id", r["id"]),
                "db_id": r["id"],
                "date": rd.get("report_header", {}).get("report_date", r["created_at"]),
                "modality": rd.get("study", {}).get("modality", r.get("modality", "Unknown")),
                "status": r.get("report_status", "Pending"),
                "impression": rd.get("impression", []),
                "findings_count": len(rd.get("findings", [])),
                "urgency": rd.get("urgency", r.get("urgency", "Routine")),
            }
            summaries.append(summary)
        except (json.JSONDecodeError, TypeError):
            summaries.append({
                "report_id": r["id"],
                "db_id": r["id"],
                "date": r["created_at"],
                "modality": r.get("modality", "Unknown"),
                "status": r.get("report_status", "Pending"),
            })

    return json.dumps({
        "found": True,
        "patient_id": patient_id,
        "total_reports": len(summaries),
        "reports": summaries
    })


@tool
def get_latest_report(patient_id: str) -> str:
    """Get the most recent radiology report for a patient with full detail.
    Use this when the user asks about the current or latest report."""
    results = _query_db(
        "SELECT id, report_data, created_at FROM reports "
        "WHERE patient_id = ? ORDER BY created_at DESC LIMIT 1",
        (patient_id,)
    )
    if not results:
        return json.dumps({"found": False, "message": "No reports found for this patient."})

    row = results[0]
    try:
        rd = json.loads(row["report_data"]) if isinstance(row["report_data"], str) else row["report_data"]
        # Remove heavy image data from response to keep context manageable
        rd.pop("image_data", None)
        rd.pop("images_data", None)
        return json.dumps({
            "found": True,
            "db_id": row["id"],
            "report_id": rd.get("report_header", {}).get("report_id", row["id"]),
            "report": rd
        })
    except (json.JSONDecodeError, TypeError):
        return json.dumps({"found": False, "message": "Could not parse report data."})


@tool
def get_report_by_id(report_id: str) -> str:
    """Get a specific radiology report by its report ID (like RAD-XXXXXXX) or database ID.
    Returns the full report including findings, impression, recommendations, and all clinical data."""
    # Try matching on the report_header.report_id inside report_data JSON, or on the DB primary key
    results = _query_db(
        "SELECT id, patient_id, report_data, created_at FROM reports WHERE id = ?",
        (report_id,)
    )
    
    # If not found by DB id, try searching in report_data JSON
    if not results:
        all_reports = _query_db("SELECT id, patient_id, report_data, created_at FROM reports")
        for r in all_reports:
            try:
                rd = json.loads(r["report_data"]) if isinstance(r["report_data"], str) else r["report_data"]
                if rd.get("report_header", {}).get("report_id") == report_id:
                    results = [r]
                    break
            except (json.JSONDecodeError, TypeError):
                continue

    if not results:
        return json.dumps({"found": False, "message": f"No report found with ID '{report_id}'."})

    row = results[0]
    try:
        rd = json.loads(row["report_data"]) if isinstance(row["report_data"], str) else row["report_data"]
        rd.pop("image_data", None)
        rd.pop("images_data", None)
        return json.dumps({
            "found": True,
            "db_id": row["id"],
            "patient_id": row["patient_id"],
            "report_id": rd.get("report_header", {}).get("report_id", row["id"]),
            "report": rd
        })
    except (json.JSONDecodeError, TypeError):
        return json.dumps({"found": False, "message": "Could not parse report data."})


@tool
def compare_reports(report_id_1: str, report_id_2: str) -> str:
    """Compare two radiology reports side by side.
    Use this when the user asks to compare current vs previous reports, or any two reports.
    Returns a structured comparison of findings, impressions, and any changes."""
    r1_raw = get_report_by_id.invoke(report_id_1)
    r2_raw = get_report_by_id.invoke(report_id_2)
    
    r1 = json.loads(r1_raw)
    r2 = json.loads(r2_raw)
    
    if not r1.get("found") or not r2.get("found"):
        return json.dumps({
            "error": "Could not find one or both reports.",
            "report_1_found": r1.get("found", False),
            "report_2_found": r2.get("found", False),
        })
    
    comparison = {
        "report_1": {
            "id": r1["report_id"],
            "date": r1["report"].get("report_header", {}).get("report_date", "Unknown"),
            "modality": r1["report"].get("study", {}).get("modality", "Unknown"),
            "findings": r1["report"].get("findings", []),
            "impression": r1["report"].get("impression", []),
            "urgency": r1["report"].get("urgency", "Unknown"),
            "recommendations": r1["report"].get("recommendations", []),
        },
        "report_2": {
            "id": r2["report_id"],
            "date": r2["report"].get("report_header", {}).get("report_date", "Unknown"),
            "modality": r2["report"].get("study", {}).get("modality", "Unknown"),
            "findings": r2["report"].get("findings", []),
            "impression": r2["report"].get("impression", []),
            "urgency": r2["report"].get("urgency", "Unknown"),
            "recommendations": r2["report"].get("recommendations", []),
        }
    }
    return json.dumps(comparison)


@tool
def get_patient_studies(patient_id: str) -> str:
    """Get a list of all imaging studies (with modalities and dates) for a patient.
    Useful for understanding what imaging has been done over time."""
    results = _query_db(
        "SELECT id, modality, report_data, pacs_study_uid, pacs_source, created_at "
        "FROM reports WHERE patient_id = ? ORDER BY created_at DESC",
        (patient_id,)
    )
    if not results:
        return json.dumps({"found": False, "message": "No studies found for this patient."})

    studies = []
    for r in results:
        try:
            rd = json.loads(r["report_data"]) if isinstance(r["report_data"], str) else r["report_data"]
            studies.append({
                "db_id": r["id"],
                "report_id": rd.get("report_header", {}).get("report_id", r["id"]),
                "date": rd.get("report_header", {}).get("report_date", r["created_at"]),
                "modality": rd.get("study", {}).get("modality", r.get("modality", "Unknown")),
                "examination": rd.get("study", {}).get("examination", ""),
                "has_pacs": bool(r.get("pacs_study_uid")),
                "pacs_source": r.get("pacs_source"),
            })
        except (json.JSONDecodeError, TypeError):
            studies.append({
                "db_id": r["id"],
                "date": r["created_at"],
                "modality": r.get("modality", "Unknown"),
            })

    return json.dumps({"found": True, "patient_id": patient_id, "studies": studies})


# ─── Viewer Action Tools ─────────────────────────────────────────────────────
# These return structured JSON commands for the frontend viewer.
# They do NOT actually open anything server-side.

@tool
def open_report_in_viewer(report_id: str, patient_name: Optional[str] = None) -> str:
    """Open a specific report in the viewer panel for the user to see.
    Use this whenever you discuss or reference a specific report — always show it to the user.
    The viewer will automatically switch to the REPORT tab and display the report."""
    return json.dumps({
        "viewer_action": {
            "type": "OPEN_REPORT",
            "reportId": report_id,
            "patientName": patient_name or ""
        },
        "narration": f"Opening report {report_id}{' for ' + patient_name if patient_name else ''} in the viewer."
    })


@tool
def open_dicom_in_viewer(report_id: str, slice_number: Optional[int] = None) -> str:
    """Open the DICOM/medical images associated with a report in the image viewer.
    Use this when the user wants to see scan images, X-rays, CT, or MRI images.
    The viewer will switch to the DICOM tab and display the images."""
    return json.dumps({
        "viewer_action": {
            "type": "OPEN_DICOM",
            "studyId": report_id,
            "reportId": report_id,
            "slice": slice_number or 1
        },
        "narration": f"Switching to DICOM viewer for report {report_id}{f', slice {slice_number}' if slice_number else ''}."
    })


@tool
def open_metadata_in_viewer(patient_id: str) -> str:
    """Open patient metadata and demographics in the viewer panel.
    Use this when the user asks about patient information, demographics, or study history.
    The viewer will switch to the METADATA tab."""
    return json.dumps({
        "viewer_action": {
            "type": "OPEN_METADATA",
            "patientId": patient_id
        },
        "narration": f"Opening patient metadata for patient {patient_id} in the viewer."
    })


# ─── All tools list ──────────────────────────────────────────────────────────

ALL_DATA_TOOLS = [
    search_patient_by_name,
    get_patient_reports,
    get_latest_report,
    get_report_by_id,
    compare_reports,
    get_patient_studies,
]

ALL_VIEWER_TOOLS = [
    open_report_in_viewer,
    open_dicom_in_viewer,
    open_metadata_in_viewer,
]

from agent.segmentation_tools import ALL_SEGMENTATION_TOOLS

ALL_TOOLS = ALL_DATA_TOOLS + ALL_VIEWER_TOOLS + ALL_SEGMENTATION_TOOLS
