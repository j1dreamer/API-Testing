from fastapi import Depends, HTTPException
from typing import Dict, Any, List
from app.database.auth_crud import get_user_by_email

async def get_current_user() -> Dict[str, Any]:
    from app.core import replay_service
    # If no active Aruba session, we are unauthenticated
    if not replay_service.ACTIVE_TOKEN:
        raise HTTPException(status_code=401, detail="No active session. Please login first.")
    
    email = getattr(replay_service, "ACTIVE_USER_EMAIL", None)
    if not email:
        raise HTTPException(status_code=401, detail="Session email not found.")

    user = await get_user_by_email(email)
    if user is None:
        raise HTTPException(status_code=403, detail="Local user not configured for this email.")
    return user

async def get_current_approved_user(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    if not current_user.get("isApproved"):
        raise HTTPException(status_code=403, detail="Pending Admin Approval")
    return current_user

class RoleChecker:
    def __init__(self, allowed_roles: List[str]):
        self.allowed_roles = allowed_roles

    def __call__(self, user: Dict[str, Any] = Depends(get_current_approved_user)):
        if user.get("role") not in self.allowed_roles:
            raise HTTPException(status_code=403, detail=f"Operation not permitted. Requires one of: {self.allowed_roles}")
        return user

# Convenience dependencies
require_admin = RoleChecker(["admin"])
require_user_or_admin = RoleChecker(["admin", "user"])
