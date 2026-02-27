from fastapi import Depends, HTTPException, Request
from typing import Dict, Any, List
from app.database.auth_crud import get_user_by_email

async def get_current_user(request: Request) -> Dict[str, Any]:
    # Extract token from header
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Header Authorization không hợp lệ.")
    
    token = auth_header.split(" ")[1]
    
    # Find the session in DB to get the email associated with this specific token
    from app.database.connection import get_database
    db = get_database()
    session = await db.auth_sessions.find_one({"token_value": token})
    
    if not session:
        raise HTTPException(status_code=401, detail="Phiên làm việc không tồn tại hoặc đã hết hạn.")

    email = session.get("email")
    if not email:
        raise HTTPException(status_code=401, detail="Không thể xác định tài khoản từ phiên này.")

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
