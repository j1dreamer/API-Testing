from datetime import datetime
from typing import Optional, Dict, Any, Literal
from pydantic import BaseModel, Field
from bson import ObjectId


class PyObjectId(str):
    """Custom type for MongoDB ObjectId."""
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v, handler):
        if isinstance(v, ObjectId):
            return str(v)
        if isinstance(v, str) and ObjectId.is_valid(v):
            return v
        raise ValueError("Invalid ObjectId")


class LogCreate(BaseModel):
    """Schema for creating a new log entry."""
    url: str = Field(..., description="Full target URL")
    method: str = Field(..., description="HTTP verb (GET, POST, etc.)")
    request_headers: Dict[str, str] = Field(default_factory=dict, description="Request headers")
    request_body: Optional[Any] = Field(None, description="Request payload (null for GET)")
    status_code: int = Field(..., description="HTTP response code")
    response_headers: Dict[str, str] = Field(default_factory=dict, description="Response headers")
    response_body: Optional[Any] = Field(None, description="Response payload")
    duration_ms: int = Field(..., description="Round-trip time in milliseconds")
    initiator_type: Literal["fetch", "xhr"] = Field(..., description="Type of request initiator")

    class Config:
        json_schema_extra = {
            "example": {
                "url": "https://api.example.com/users",
                "method": "GET",
                "request_headers": {"Content-Type": "application/json"},
                "request_body": None,
                "status_code": 200,
                "response_headers": {"Content-Type": "application/json"},
                "response_body": {"users": []},
                "duration_ms": 150,
                "initiator_type": "fetch"
            }
        }


class LogResponse(BaseModel):
    """Schema for log response."""
    id: str = Field(..., alias="_id", description="Unique identifier")
    url: str
    method: str
    request_headers: Dict[str, str]
    request_body: Optional[Any]
    status_code: int
    response_headers: Dict[str, str]
    response_body: Optional[Any]
    duration_ms: int
    initiator_type: str
    timestamp: datetime

    class Config:
        populate_by_name = True
        json_schema_extra = {
            "example": {
                "_id": "65c1234567890abcdef12345",
                "url": "https://api.example.com/users",
                "method": "GET",
                "request_headers": {"Content-Type": "application/json"},
                "request_body": None,
                "status_code": 200,
                "response_headers": {"Content-Type": "application/json"},
                "response_body": {"users": []},
                "duration_ms": 150,
                "initiator_type": "fetch",
                "timestamp": "2024-02-09T12:00:00Z"
            }
        }


class LogListResponse(BaseModel):
    """Schema for paginated log list."""
    total: int
    logs: list[LogResponse]
