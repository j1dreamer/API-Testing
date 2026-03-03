from fastapi import APIRouter, Body, HTTPException, Request
from app.core.fernet import encrypt_credentials, decrypt_credentials
from app.core.replay_service import replay_login

router = APIRouter(prefix="/api/auth", tags=["Stateless Auth"])


@router.get("/session")
async def session(request: Request):
    """
    Kiểm tra phiên stateless — echo lại token nếu Authorization header hợp lệ.
    Dùng cho heartbeat poll (App.jsx) và khởi động app. Không truy vấn DB.
    """
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return {"token_value": None}
    token = auth.split(" ", 1)[1]
    return {"token_value": token, "status": "active"}


@router.post("/login")
async def login(username: str = Body(..., embed=True), password: str = Body(..., embed=True)):
    """Đăng nhập: trả về access_token + Fernet refresh_token."""
    from app.core.allowed_emails import is_email_allowed
    if not is_email_allowed(username):
        raise HTTPException(status_code=401, detail="Email không có quyền truy cập.")

    result = await replay_login(username, password)
    if result.get("status") == "error":
        raise HTTPException(status_code=401, detail=result.get("message", "Login failed"))

    from app.database.auth_crud import get_user_by_email, create_user
    from datetime import datetime, timezone

    user = await get_user_by_email(username)
    if user is None:
        # First-time login: auto-register with default viewer role, pending approval.
        # An admin must set isApproved=True before the user gets full access.
        # NOTE: internalWebRole (role field here) controls access to this INSIGHT
        # dashboard only. It is completely separate from the user's Aruba Instant On
        # cloud role, which is determined per-site by the Aruba API itself.
        await create_user({
            "email":      username,
            "role":       "viewer",   # internalWebRole — NOT an Aruba cloud role
            "isApproved": False,
            "created_at": datetime.now(timezone.utc),
        })
        user = await get_user_by_email(username)

    # internalWebRole: dictates which tabs/features this user sees in INSIGHT.
    internal_web_role = user.get("role", "viewer") if user else "viewer"

    return {
        "status":        "success",
        "token_value":   result.get("data", {}).get("access_token"),
        "refresh_token": encrypt_credentials(username, password),
        "email":         username,
        "role":          internal_web_role,
    }


@router.post("/refresh")
async def refresh(refresh_token: str = Body(..., embed=True)):
    """Stateless refresh: giải mã blob → đăng nhập lại Aruba → trả token mới."""
    creds = decrypt_credentials(refresh_token)
    u, p = creds.get("u"), creds.get("p")

    result = await replay_login(u, p)
    if result.get("status") == "error":
        raise HTTPException(status_code=401, detail="Token refresh failed.")

    return {
        "status":        "success",
        "token_value":   result.get("data", {}).get("access_token"),
        "refresh_token": encrypt_credentials(u, p),
    }


@router.post("/logout")
async def logout():
    """Logout stateless: client tự xóa sessionStorage."""
    return {"status": "success"}
