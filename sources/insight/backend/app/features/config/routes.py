"""
Router cho tính năng Config — cung cấp cấu hình site trực tiếp từ Aruba API.

Endpoints:
  GET /api/config/sites/{site_id}           → toàn bộ config (networks + guest_portal)
  GET /api/config/sites/{site_id}/ssids     → chỉ danh sách SSID wireless
  GET /api/config/sites/{site_id}/overview  → tóm tắt network cho SmartSync table
"""
from fastapi import APIRouter, HTTPException, Request
from app.features.config.service import config_service

router = APIRouter(prefix="/api/config", tags=["Config"])


def _get_token(request: Request) -> str:
    """Lấy Bearer token từ Authorization header."""
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Header Authorization không hợp lệ.")
    return auth.split(" ", 1)[1]


@router.get("/sites/{site_id}")
async def get_site_config(site_id: str, request: Request):
    """
    Trả về toàn bộ cấu hình của một site.
    Response: { networks: [...], guest_portal: {...} | null }
    """
    token = _get_token(request)
    return await config_service.get_site_config(site_id, token)


@router.get("/sites/{site_id}/ssids")
async def get_site_ssids(site_id: str, request: Request):
    """
    Trả về danh sách SSID wireless của site.
    Response: [{ networkId, networkName, security, isGuestPortalEnabled }]
    Khớp với SmartSync SSID compilation (uniqueSSIDMap bằng networkName).
    """
    token = _get_token(request)
    return await config_service.get_site_ssids(site_id, token)


@router.get("/sites/{site_id}/overview")
async def get_site_overview(site_id: str, request: Request):
    """
    Trả về tóm tắt danh sách mạng cho bảng SmartSync.
    Response: { status: "success", networks: [{ id, name, type, vlanId, isEnabled, isWireless }] }
    Khớp trực tiếp với SmartSync line 723-739.
    """
    token = _get_token(request)
    return await config_service.get_site_overview(site_id, token)
