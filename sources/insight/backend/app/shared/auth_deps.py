"""Auth dependencies — Two-Track stateless pattern.

Track 1 — Internal (require_internal_admin):
  Reads X-Insight-User header → looks up users collection → checks role + isApproved.
  Zero Aruba token dependency. Used by Admin, User Management routes.

Track 2 — Aruba (get_stateless_user / StatelessRoleChecker):
  Reads Authorization: Bearer <aruba_token> + X-Insight-User header.
  Identity resolved from the header; token used directly against Aruba API.
  Used by Cloner, Backup, Rollback, SSID management routes.
"""
from fastapi import Depends, HTTPException, Request
from typing import Dict, Any, List
from app.database.auth_crud import get_user_by_email


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def _extract_bearer(request: Request) -> str:
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Header Authorization không hợp lệ.")
    return auth_header.split(" ", 1)[1]


def _extract_user_email(request: Request) -> str:
    email = request.headers.get("X-Insight-User", "").strip()
    if not email:
        raise HTTPException(status_code=401, detail="Thiếu header X-Insight-User.")
    return email


# ---------------------------------------------------------------------------
# Track 1 — Internal Admin (DB-only, no Aruba dependency)
# ---------------------------------------------------------------------------

async def require_internal_admin(request: Request) -> Dict[str, Any]:
    """Dep for Admin / User-Management routes. Only checks insight DB."""
    email = _extract_user_email(request)
    user = await get_user_by_email(email)
    if not user:
        raise HTTPException(status_code=403, detail="Tài khoản chưa được đăng ký trong hệ thống.")
    if not user.get("isApproved"):
        raise HTTPException(status_code=403, detail="Tài khoản chưa được phê duyệt.")
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Yêu cầu quyền Admin.")
    return user


# ---------------------------------------------------------------------------
# Track 2 — Stateless Aruba (Bearer token + X-Insight-User header)
# ---------------------------------------------------------------------------

async def get_stateless_user(request: Request) -> Dict[str, Any]:
    """
    Resolves identity from X-Insight-User header against insight DB.
    Confirms a Bearer token is present (validated by Aruba on actual API calls).
    """
    _extract_bearer(request)           # ensure token is present
    email = _extract_user_email(request)

    user = await get_user_by_email(email)
    if not user:
        raise HTTPException(status_code=403, detail="Tài khoản chưa được đăng ký trong hệ thống.")
    if not user.get("isApproved"):
        raise HTTPException(status_code=403, detail="Tài khoản chưa được phê duyệt.")
    return user


class StatelessRoleChecker:
    def __init__(self, allowed_roles: List[str]):
        self.allowed_roles = allowed_roles

    async def __call__(self, user: Dict[str, Any] = Depends(get_stateless_user)) -> Dict[str, Any]:
        if user.get("role") not in self.allowed_roles:
            raise HTTPException(
                status_code=403,
                detail=f"Thao tác không được phép. Yêu cầu một trong các quyền: {self.allowed_roles}"
            )
        return user


# Convenience stateless deps
require_operator_stateless = StatelessRoleChecker(["admin", "operator"])
require_admin_stateless    = StatelessRoleChecker(["admin"])
