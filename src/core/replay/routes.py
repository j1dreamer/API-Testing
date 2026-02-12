from typing import Optional
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from src.core.replay_service import replay_login, proxy_api_call

router = APIRouter()

class ReplayLoginPayload(BaseModel):
    username: str
    password: str
    client_id: Optional[str] = None

@router.post("/api/replay/login", tags=["Replay"])
async def login(payload: ReplayLoginPayload):
    """
    Aruba SSO Login Replay.
    Target: https://sso.arubainstanton.com/aio/api/v1/mfa/validate/full
    """
    return await replay_login(payload.username, payload.password, payload.client_id)

@router.api_route(
    "/api/replay/{path:path}", 
    methods=["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"],
    tags=["Replay"]
)
async def proxy(path: str, request: Request):
    """
    Aruba API Proxy.
    Target: https://sso.arubainstanton.com/{path}
    Injects: Authorization: Bearer <token>
    """
    return await proxy_api_call(path, request.method, request)
