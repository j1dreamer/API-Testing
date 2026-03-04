from fastapi import APIRouter, HTTPException, Request
from app.features.overview.service import overview_service
from app.shared.aruba import aruba_service

router = APIRouter(prefix="/api/v1/overview", tags=["Overview"])


@router.get("/sites")
async def get_live_sites(request: Request):
    """
    Return all sites for the authenticated Aruba token with live role mapping.
    Stateless: data is fetched directly from Aruba API — no DB cache.
    """
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Header Authorization không hợp lệ.")
    token = auth_header.split(" ", 1)[1]

    caller_email = request.headers.get("X-Insight-User", "").strip()
    sites = await overview_service.get_live_sites(token, caller_email)
    return {"status": "success", "sites": sites}


@router.get("/sites/{site_id}")
async def get_site_detail(site_id: str, request: Request):
    """Fetch single site detail from Aruba API."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Header Authorization không hợp lệ.")
    token = auth_header.split(" ", 1)[1]

    response = await aruba_service.call_api(
        method="GET",
        endpoint=f"/api/sites/{site_id}",
        aruba_token=token,
    )
    if response.status_code == 401:
        raise HTTPException(status_code=401, detail="Phiên làm việc Aruba đã hết hạn.")
    if response.status_code != 200:
        raise HTTPException(status_code=response.status_code, detail="Aruba API error.")

    return response.json()
