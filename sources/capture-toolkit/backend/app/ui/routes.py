from fastapi import APIRouter, Request, Response, WebSocket, WebSocketDisconnect
import httpx
import json
from fastapi.responses import HTMLResponse, FileResponse
from pathlib import Path
from app.database.crud import get_latest_auth, get_all_auth_sessions
from app.core.websocket.manager import manager

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


@router.get("/test-login", response_class=HTMLResponse)
async def serve_login_test():
    """Serve the Login Test page."""
    login_path = STATIC_DIR / "test-login.html"
    return FileResponse(login_path, media_type="text/html")


@router.get("/offline", response_class=HTMLResponse)
async def serve_offline_view():
    """Serve the Offline Traffic Explorer."""
    offline_path = STATIC_DIR / "offline.html"
    return FileResponse(offline_path, media_type="text/html")


@router.get("/detail/{log_id}", response_class=HTMLResponse)
async def serve_detail_view(log_id: str):
    """Serve the Request Detail page."""
    detail_path = STATIC_DIR / "detail.html"
    return FileResponse(detail_path, media_type="text/html")


@router.get("/cloner", response_class=HTMLResponse)
async def serve_cloner_view():
    """Serve the Site Config Cloner page."""
    cloner_path = STATIC_DIR / "cloner.html"
    return FileResponse(cloner_path, media_type="text/html")


# In-memory cookie jar for the proxy session (cleared on restart)
PROXY_SESSION_COOKIES = {}

# Constants
STRICT_ORIGIN = "https://portal.instant-on.hpe.com"
STRICT_REFERER = "https://portal.instant-on.hpe.com/"
CHROME_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"


@router.api_route(
    "/api/proxy/{path:path}",
    methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"],
)
async def proxy_request(path: str, request: Request):
    """Proxy endpoint using ArubaService."""
    # 1. Determine Target URL/Domain
    target_url = request.headers.get("X-Target-URL", "")
    target_domain = request.query_params.get("domain", "")
    
    if not target_url:
        if target_domain:
            target_url = f"https://{target_domain}/{path}"
        else:
            target_url = f"https://portal.instant-on.hpe.com/{path}"

    try:
        # Read Body
        body = await request.body()
        
        # Delegate to ArubaService
        from app.services.aruba import aruba_service
        
        # Extract relevant headers to forward (client-specific, excluding auth/host)
        forward_headers = {}
        skip_headers = {
            "host", "connection", "content-length", "content-type", 
            "x-target-url", "origin", "referer", "accept-encoding", "cookie", "user-agent",
            "authorization", "x-csrf-token" # aruba_service handles these
        }
        for key, value in request.headers.items():
            if key.lower() not in skip_headers:
                forward_headers[key] = value

        resp = await aruba_service.call_api(
            method=request.method,
            endpoint=target_url,
            data=body,
            headers=forward_headers
        )

        # Build Response
        resp_headers = {}
        skip_resp = {"transfer-encoding", "connection", "content-encoding", "content-length"}
        for key, value in resp.headers.items():
            if key.lower() not in skip_resp:
                resp_headers[key] = value

        # Add CORS
        resp_headers["Access-Control-Allow-Origin"] = "*"
        resp_headers["Access-Control-Allow-Headers"] = "*"
        resp_headers["Access-Control-Allow-Methods"] = "*"

        return Response(
            content=resp.content,
            status_code=resp.status_code,
            headers=resp_headers,
            media_type=resp.headers.get("content-type", "application/json"),
        )

    except Exception as e:
        print(f"[PROXY ERROR] {str(e)}")
        return Response(
            content=json.dumps({"error": f"Proxy Error: {str(e)}"}),
            status_code=502,
            media_type="application/json",
        )
