from fastapi import APIRouter, HTTPException, Depends
from typing import List
from app.schemas.device import DeviceResponse
from app.core.inventory.service import inventory_service

router = APIRouter(prefix="/api/inventory", tags=["Inventory"])

@router.get("/sites/{site_id}/devices", response_model=List[DeviceResponse])
async def get_devices(site_id: str):
    """
    Get a sanitized list of devices for a site.
    Values are scrubbed and normalized by the backend.
    """
    devices = await inventory_service.get_site_devices(site_id)
    return devices
