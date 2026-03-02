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

    from app.database.auth_crud import get_user_by_email
    user = await get_user_by_email(username)
    internal_role = user.get("role", "guest") if user else "guest"

    return {
        "status":        "success",
        "token_value":   result.get("data", {}).get("access_token"),
        "refresh_token": encrypt_credentials(username, password),
        "email":         username,
        "role":          internal_role,
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
