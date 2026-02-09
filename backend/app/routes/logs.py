from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from app.schemas import LogCreate, LogResponse, LogListResponse
from app import crud
from app import crud_inventory

router = APIRouter(prefix="/logs", tags=["Logs"])


@router.post("/", response_model=dict, status_code=201)
async def create_log(log_data: LogCreate):
    """
    Create a new captured request log.
    
    Receives captured request/response data from the browser extension.
    Also triggers auto-update of API Inventory.
    """
    log_id = await crud.create_log(log_data)
    
    # Auto-update API Inventory
    await crud_inventory.upsert_api_definition(
        url=log_data.url,
        method=log_data.method,
        status_code=log_data.status_code,
        request_body=log_data.request_body if isinstance(log_data.request_body, dict) else None,
        response_body=log_data.response_body if isinstance(log_data.response_body, dict) else None
    )
    
    return {"id": log_id, "message": "Log created successfully"}


@router.get("/", response_model=LogListResponse)
async def get_logs(
    method: Optional[str] = Query(None, description="Filter by HTTP method (GET, POST, etc.)"),
    status_group: Optional[str] = Query(None, description="Filter by status group (2xx, 4xx, 5xx)"),
    search: Optional[str] = Query(None, description="Search by URL keyword"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(50, ge=1, le=100, description="Maximum number of records to return")
):
    """
    Retrieve captured logs with optional filters.
    
    Supports filtering by HTTP method, status code group, and URL search.
    """
    logs, total = await crud.get_logs(
        method=method,
        status_group=status_group,
        search=search,
        skip=skip,
        limit=limit
    )
    return {"total": total, "logs": logs}


@router.get("/{log_id}", response_model=LogResponse)
async def get_log(log_id: str):
    """
    Retrieve a single log by ID.
    
    Returns full details of the captured request/response.
    """
    log = await crud.get_log_by_id(log_id)
    if not log:
        raise HTTPException(status_code=404, detail="Log not found")
    return log


@router.delete("/{log_id}")
async def delete_log(log_id: str):
    """
    Delete a single log by ID.
    """
    deleted = await crud.delete_log(log_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Log not found")
    return {"message": "Log deleted successfully"}


@router.delete("/")
async def clear_logs():
    """
    Delete all captured logs.
    """
    count = await crud.clear_all_logs()
    return {"message": f"Deleted {count} logs"}
