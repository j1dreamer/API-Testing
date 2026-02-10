from fastapi import APIRouter, Request, Response, WebSocket, WebSocketDisconnect
import httpx
import json
from fastapi.responses import HTMLResponse, FileResponse
from pathlib import Path
from src.database.crud import get_latest_auth, get_all_auth_sessions
from src.core.websocket.manager import manager

router = APIRouter(tags=["UI"])


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time traffic updates."""
    await manager.connect(websocket)
    print(f"[WS] Client connected: {websocket.client}")
    try:
        while True:
            # Keep connection alive
            await websocket.receive_text()
    except WebSocketDisconnect:
        print(f"[WS] Client disconnected: {websocket.client}")
        manager.disconnect(websocket)
    except Exception as e:
        print(f"[WS] Error: {str(e)}")
        manager.disconnect(websocket)

STATIC_DIR = Path(__file__).parent / "static"


@router.get("/", response_class=HTMLResponse)
async def serve_dashboard():
    """Serve the Aruba API Explorer dashboard."""
    index_path = STATIC_DIR / "index.html"
    return FileResponse(index_path, media_type="text/html")


@router.api_route(
    "/api/proxy/{path:path}",
    methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"],
)
async def proxy_request(path: str, request: Request):
    """Proxy endpoint for Swagger UI 'Try it out'.

    Automatically injects the latest captured authentication headers
    (Bearer token, CSRF token, cookies) into the forwarded request.
    This solves CORS issues and ensures auth is always current.
    """
    # Determine target URL
    target_url = request.headers.get("X-Target-URL", "")
    if not target_url:
        # Fallback: construct from path + first known domain
        # The Swagger spec uses this proxy as the server base URL
        # so the path here IS the actual API path
        target_url = f"https://nb.portal.arubainstanton.com/{path}"

    # Read request body
    body = await request.body()

    # === AUTO-INJECT AUTH HEADERS ===
    forward_headers = {}

    # 1. Start with headers from the Swagger UI request
    skip_headers = {
        "host", "connection", "content-length",
        "x-target-url", "origin", "referer", "accept-encoding",
    }
    for key, value in request.headers.items():
        if key.lower() not in skip_headers:
            forward_headers[key] = value

    # 2. Inject latest captured auth tokens
    all_sessions = await get_all_auth_sessions()
    for session in all_sessions:
        token_type = session.get("token_type", "")
        token_value = session.get("token_value", "")

        if token_type == "bearer" and token_value:
            forward_headers["Authorization"] = f"Bearer {token_value}"

        elif token_type == "csrf" and token_value:
            forward_headers["X-CSRF-Token"] = token_value

        elif token_type == "cookie" and token_value:
            # Merge with existing cookies
            existing = forward_headers.get("Cookie", "")
            if existing:
                forward_headers["Cookie"] = f"{existing}; {token_value}"
            else:
                forward_headers["Cookie"] = token_value

        # Also inject from headers_snapshot (Referer, Origin, etc.)
        snapshot = session.get("headers_snapshot", {})
        for hkey in ["Referer", "referer", "Origin", "origin"]:
            if hkey in snapshot and hkey.lower() not in forward_headers:
                forward_headers[hkey] = snapshot[hkey]

    # Make the actual request to Aruba
    async with httpx.AsyncClient(
        timeout=30.0,
        follow_redirects=True,
        verify=False,  # Some Aruba endpoints may have cert issues
    ) as client:
        try:
            resp = await client.request(
                method=request.method,
                url=target_url,
                headers=forward_headers,
                content=body if body else None,
            )

            # Build response headers
            resp_headers = {}
            skip_resp = {"transfer-encoding", "connection", "content-encoding"}
            for key, value in resp.headers.items():
                if key.lower() not in skip_resp:
                    resp_headers[key] = value

            # Add CORS headers
            resp_headers["Access-Control-Allow-Origin"] = "*"
            resp_headers["Access-Control-Allow-Headers"] = "*"

            return Response(
                content=resp.content,
                status_code=resp.status_code,
                headers=resp_headers,
                media_type=resp.headers.get("content-type", "application/json"),
            )
        except httpx.RequestError as e:
            return Response(
                content=json.dumps({"error": f"Proxy request failed: {str(e)}"}),
                status_code=502,
                media_type="application/json",
            )
