from fastapi import APIRouter, HTTPException, Depends, Request
from typing import List
from app.schemas.device import DeviceResponse
from app.core.inventory.service import inventory_service

router = APIRouter(prefix="/api/inventory", tags=["Inventory"])

@router.get("/sites/{site_id}/devices", response_model=List[DeviceResponse])
async def get_devices(site_id: str, request: Request):
    """
    Get a sanitized list of devices for a site.
    """
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
         raise HTTPException(status_code=401, detail="Missing authorization")
    
    token = auth_header.split(" ")[1]
    devices = await inventory_service.get_site_devices(site_id, token)
    return devices
