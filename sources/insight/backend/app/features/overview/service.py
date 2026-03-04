"""
Dịch vụ Overview — lấy danh sách site trực tiếp từ Aruba API.

Kiến trúc Stateless (stateless_architecture.md):
  - TUYỆT ĐỐI không cache site hay token xuống database.
  - Role Aruba (userRoleOnSite) được map theo thời gian thực (Live Mapping).
  - insight_app_role lấy từ DB insight (Track 1), chỉ tra một lần mỗi request.
  - 401/403 từ Aruba → raise HTTPException(401) để frontend interceptor kích hoạt /refresh.
"""
from typing import List, Dict, Any

from fastapi import HTTPException
from app.services.aruba import aruba_service

# Map Aruba role verbatim → shorthand nội bộ
_ARUBA_ROLE_MAP: Dict[str, str] = {
    "administrator": "admin",
    "operator":      "op",
    "viewer":        "view",
    "guest":         "guest",
}

# Các endpoint Aruba cần thử theo thứ tự (mới → cũ)
_SITES_ENDPOINTS = ["/api/sites", "/api/v1/sites"]


class OverviewService:

    async def get_live_sites(
        self,
        aruba_token: str,
        caller_email: str = ""
    ) -> List[Dict[str, Any]]:
        """
        Lấy danh sách site từ Aruba API và map role theo thời gian thực.

        Args:
            aruba_token:   Bearer token do trình duyệt gửi lên.
            caller_email:  Email người dùng (từ header X-Insight-User) để tra
                           insight_app_role từ DB (Track 1).

        Returns:
            Danh sách site đã chuẩn hoá; raise HTTPException(401) nếu token hết hạn.
        """
        # --- Bước 1: Gọi Aruba API, thử từng endpoint ---
        response = None
        for endpoint in _SITES_ENDPOINTS:
            response = await aruba_service.call_api(
                method="GET",
                endpoint=endpoint,
                aruba_token=aruba_token,
            )
            if response.status_code == 200:
                break
            if response.status_code in (401, 403):
                # Token hết hạn — báo ngay, không thử endpoint tiếp theo
                raise HTTPException(
                    status_code=401,
                    detail="Phiên làm việc Aruba đã hết hạn. Vui lòng làm mới token."
                )

        if response is None or response.status_code != 200:
            print(f"[OVERVIEW] Aruba API trả về lỗi: {response.status_code if response else 'no response'}")
            return []

        # --- Bước 2: Tra insight_app_role một lần (Track 1) ---
        insight_app_role = "guest"
        if caller_email:
            from app.database.auth_crud import get_user_by_email
            user = await get_user_by_email(caller_email)
            if user:
                insight_app_role = user.get("role", "guest")

        # --- Bước 3: Parse JSON và map role theo thời gian thực ---
        try:
            data = response.json()
            raw_elements: list = data if isinstance(data, list) else data.get("elements", [])

            sites: List[Dict[str, Any]] = []
            for node in raw_elements:
                # Extract verbatim from each site element — never fall back to app-level role
                aruba_role_raw: str = node.get("userRoleOnSite") or ""
                raw_role: str = aruba_role_raw.strip().lower()
                sites.append({
                    "siteId":                node.get("id") or node.get("siteId"),
                    "siteName":              node.get("name") or node.get("siteName", "Unknown"),
                    "role":                  _ARUBA_ROLE_MAP.get(raw_role, "view"),
                    "aruba_role_raw":        aruba_role_raw if aruba_role_raw else "unknown",
                    "insight_app_role":      insight_app_role,
                    # Enriched fields for Sites Grid UI
                    "status":                node.get("status", "up"),
                    "healthScore":           node.get("currentHealthScore", {}),
                    "healthScoreTrend":      node.get("healthScoreTrend", "stable"),
                    "activeAlertsCounters":  node.get("activeAlertsCounters", {}),
                    "historyDurationSeconds": node.get("historyDurationSeconds", 86400),
                })

            return sites

        except Exception as exc:
            print(f"[OVERVIEW] Lỗi parse response: {exc}")
            return []


overview_service = OverviewService()
