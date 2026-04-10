from pydantic import BaseModel, Field
from typing import List, Literal, Optional

class StudyInfo(BaseModel):
    modality: str = Field(..., description="The modality of the study (e.g. X-Ray, CT, MRI)")
    examination: str = Field(..., description="The name of the examination")
    views: str = Field("", description="The views taken")

class Finding(BaseModel):
    anatomical_region: str = Field(..., description="The region of the body")
    observation: str = Field(..., description="What was observed clinically")
    status: Literal["normal", "abnormal", "indeterminate", "post_procedural"] = Field(...)

class StructuredReport(BaseModel):
    study: StudyInfo
    findings: List[Finding] = Field(..., min_length=1)
    impression: List[str] = Field(..., min_length=1)
    urgency: Literal["Routine", "Urgent", "Critical"]
    recommendations: List[str] = Field(default_factory=list)

def normalize_urgency(val: str) -> str:
    val = val.lower().strip()
    critical = ["critical", "stat", "immediate", "emergent", "life-threatening", "3", "high"]
    urgent = ["urgent", "moderate", "soon", "priority", "2", "medium"]
    if val in critical:
        return "Critical"
    if val in urgent:
        return "Urgent"
    return "Routine"
