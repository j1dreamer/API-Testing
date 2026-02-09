"""Pydantic schemas for API Inventory (Phase 7)."""
from datetime import datetime
from typing import Optional, Dict, Any, List, Literal
from pydantic import BaseModel, Field


class MethodCoverage(BaseModel):
    """Tracks which HTTP methods have been captured for an endpoint."""
    GET: Literal["Captured", "Missing"] = "Missing"
    POST: Literal["Captured", "Missing"] = "Missing"
    PUT: Literal["Captured", "Missing"] = "Missing"
    DELETE: Literal["Captured", "Missing"] = "Missing"
    PATCH: Literal["Captured", "Missing"] = "Missing"


class ApiDefinitionCreate(BaseModel):
    """Schema for creating/updating an API definition internally."""
    domain: str
    path: str
    method: str
    status_codes: List[int] = Field(default_factory=list)
    request_example: Optional[Any] = None
    response_example: Optional[Any] = None


class ApiDefinitionUpdate(BaseModel):
    """Schema for user-editable fields (Vietnamese documentation)."""
    api_name: Optional[str] = Field(None, description="User-defined API name")
    description_vi: Optional[str] = Field(None, description="Vietnamese description")
    notes_vi: Optional[str] = Field(None, description="Vietnamese notes")


class ApiDefinitionResponse(BaseModel):
    """Schema for API definition response."""
    id: str = Field(..., alias="_id")
    domain: str
    path: str
    method: str
    method_coverage: MethodCoverage
    api_name: Optional[str] = None
    description_vi: Optional[str] = None
    notes_vi: Optional[str] = None
    request_example: Optional[Any] = None
    response_example: Optional[Any] = None
    status_codes: List[int] = Field(default_factory=list)
    request_count: int = 0
    created_at: datetime
    last_seen_at: datetime

    class Config:
        populate_by_name = True


class ApiInventoryListResponse(BaseModel):
    """Schema for paginated API inventory list."""
    total: int
    apis: List[ApiDefinitionResponse]


class MethodCoverageStats(BaseModel):
    """Statistics about method coverage across all APIs."""
    total_apis: int
    complete_apis: int
    incomplete_apis: int
