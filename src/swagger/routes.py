"""API routes for Swagger spec, filtering, search, and auth access."""
from typing import Optional, List
from fastapi import APIRouter, Query
from src.database.crud import (
    get_all_endpoints, get_domains, search_logs,
    clear_all_data, get_latest_auth, get_all_auth_sessions,
)
from src.swagger.generator import generate_openapi_spec
from src.export.postman import generate_postman_collection

router = APIRouter(prefix="/api", tags=["Swagger"])


@router.get("/swagger.json")
async def get_swagger_spec(
    domain: Optional[str] = Query(None, description="Filter by domain"),
    method: Optional[str] = Query(None, description="Comma-separated methods: GET,POST"),
    status: Optional[str] = Query(None, description="Comma-separated status codes: 200,401"),
):
    """Generate and return an OpenAPI 3.0 spec from captured endpoints.
    
    Supports filtering by domain, method, and status code.
    """
    # Parse comma-separated filters
    method_list = [m.strip().upper() for m in method.split(",")] if method else None
    status_list = [int(s.strip()) for s in status.split(",")] if status else None

    if not domain:
        domains = await get_domains()
        if not domains:
            return {
                "openapi": "3.0.3",
                "info": {
                    "title": "No APIs Captured Yet",
                    "description": (
                        "Start browsing the Aruba portal with the extension active.\n\n"
                        "1. Click the extension icon → Start Capture\n"
                        "2. Login to portal.arubainstanton.com\n"
                        "3. Browse around — APIs will appear here automatically"
                    ),
                    "version": "1.0.0",
                },
                "paths": {},
            }
        domain = domains[0]

    # Get filtered endpoints
    endpoints, _ = await get_all_endpoints(
        domain=domain,
        method=method_list,
        status_code=status_list,
        limit=500,
    )

    # Get latest auth for auto-injection
    auth_session = await get_latest_auth("bearer")

    return generate_openapi_spec(endpoints, domain=domain, auth_session=auth_session)


@router.get("/domains")
async def list_domains():
    """Get list of all captured domains."""
    domains = await get_domains()
    return {"domains": domains}


@router.get("/endpoints")
async def list_endpoints(
    domain: Optional[str] = Query(None, description="Filter by domain"),
    method: Optional[str] = Query(None, description="Comma-separated methods"),
    status: Optional[str] = Query(None, description="Comma-separated status codes"),
    skip: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=500),
):
    """List all captured endpoints with optional filtering."""
    method_list = [m.strip().upper() for m in method.split(",")] if method else None
    status_list = [int(s.strip()) for s in status.split(",")] if status else None

    endpoints, total = await get_all_endpoints(
        domain=domain, method=method_list, status_code=status_list,
        skip=skip, limit=limit,
    )
    return {"total": total, "endpoints": endpoints}


@router.get("/logs")
async def search_request_logs(
    keyword: Optional[str] = Query(None, description="Full-text search keyword"),
    method: Optional[str] = Query(None, description="Comma-separated methods"),
    status: Optional[str] = Query(None, description="Comma-separated status codes"),
    domain: Optional[str] = Query(None, description="Filter by domain"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    """Full-text search across raw request logs.
    
    Searches URL, request body, and response body text.
    """
    method_list = [m.strip().upper() for m in method.split(",")] if method else None
    status_list = [int(s.strip()) for s in status.split(",")] if status else None

    logs, total = await search_logs(
        keyword=keyword, method=method_list, status_code=status_list,
        domain=domain, skip=skip, limit=limit,
    )
    return {"total": total, "logs": logs}


@router.get("/logs/{log_id}")
async def get_log_details(log_id: str):
    """Get full details of a single request log."""
    from src.database.crud import get_log_by_id
    log = await get_log_by_id(log_id)
    if not log:
        return {"error": "Log not found"}
    return log


@router.get("/export/openapi")
async def export_openapi(domain: Optional[str] = Query(None)):
    """Export the current blueprint as a downloadable OpenAPI 3.0 JSON file."""
    spec = await get_swagger_spec(domain=domain)
    return spec

@router.get("/export/postman")
async def export_postman(domain: Optional[str] = Query(None)):
    """Export the current blueprint as a Postman Collection v2.1."""
    if not domain:
        domains = await get_domains()
        if not domains: return {"error": "No data"}
        domain = domains[0]
        
    endpoints, _ = await get_all_endpoints(domain=domain, limit=500)
    collection = generate_postman_collection(endpoints, domain)
    return collection

@router.post("/clear-all")
@router.delete("/data")
async def wipe_all_data():
    """Delete all captured data (endpoints, logs, auth sessions)."""
    result = await clear_all_data()
    return {"message": "All data cleared", **result}
