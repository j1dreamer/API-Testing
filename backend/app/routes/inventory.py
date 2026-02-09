"""API routes for API Inventory (Phase 7)."""
from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from app.schemas_inventory import (
    ApiDefinitionResponse,
    ApiDefinitionUpdate,
    ApiInventoryListResponse
)
from app import crud_inventory

router = APIRouter(prefix="/api-definitions", tags=["API Inventory"])


@router.get("/", response_model=ApiInventoryListResponse)
async def list_api_definitions(
    domain: Optional[str] = Query(None, description="Filter by domain"),
    incomplete: bool = Query(False, description="Show only incomplete APIs"),
    search: Optional[str] = Query(None, description="Search by path keyword"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100)
):
    """
    List all API definitions in the inventory.
    
    Supports filtering by domain, completeness status, and path search.
    """
    apis, total = await crud_inventory.get_api_definitions(
        domain=domain,
        incomplete_only=incomplete,
        search=search,
        skip=skip,
        limit=limit
    )
    return {"total": total, "apis": apis}


@router.get("/domains")
async def list_domains():
    """Get list of unique domains in the inventory."""
    domains = await crud_inventory.get_domains()
    return {"domains": domains}


@router.get("/incomplete", response_model=ApiInventoryListResponse)
async def list_incomplete_apis(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100)
):
    """
    List APIs that are missing one or more HTTP methods.
    
    Useful for identifying research opportunities.
    """
    apis, total = await crud_inventory.get_api_definitions(
        incomplete_only=True,
        skip=skip,
        limit=limit
    )
    return {"total": total, "apis": apis}


@router.get("/{api_id}", response_model=ApiDefinitionResponse)
async def get_api_definition(api_id: str):
    """Get a single API definition by ID."""
    api = await crud_inventory.get_api_definition_by_id(api_id)
    if not api:
        raise HTTPException(status_code=404, detail="API definition not found")
    return api


@router.put("/{api_id}")
async def update_api_documentation(api_id: str, update_data: ApiDefinitionUpdate):
    """
    Update Vietnamese documentation for an API definition.
    
    Allows setting API name, description, and notes in Vietnamese.
    """
    success = await crud_inventory.update_api_documentation(api_id, update_data)
    if not success:
        raise HTTPException(status_code=404, detail="API definition not found")
    return {"message": "Documentation updated successfully"}


@router.post("/refresh")
async def refresh_inventory():
    """
    Manually refresh the entire API inventory.
    
    Re-processes all logs and rebuilds the inventory.
    Preserves existing Vietnamese documentation.
    """
    result = await crud_inventory.refresh_api_inventory()
    return {
        "message": "API inventory refreshed",
        **result
    }
