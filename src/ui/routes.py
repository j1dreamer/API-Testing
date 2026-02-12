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
    """Proxy endpoint for Swagger UI 'Try it out'.

    Features:
    - Smart Cookie Management: Persists cookies across requests (DB + In-memory).
    - Dynamic Header Spoofing: Forces correct Origin/Referer for SSO or Target.
    - Auto-Auth Injection: Uses latest captured tokens.
    """
    global PROXY_SESSION_COOKIES

    # 1. Determine Target URL
    target_url = request.headers.get("X-Target-URL", "")
    target_domain = request.query_params.get("domain", "")

    if not target_url:
        if target_domain:
            target_url = f"https://{target_domain}/{path}"
        else:
            # Default fallback
            target_url = f"https://portal.instant-on.hpe.com/{path}"

    # 2. Prepare Headers & Cookies
    forward_headers = {}
    
    # Filter out sensitive/hop-by-hop headers from the incoming request
    skip_headers = {
        "host", "connection", "content-length", "content-type", # Content-Type handled by httpx/body
        "x-target-url", "origin", "referer", "accept-encoding", "cookie", "user-agent"
    }
    for key, value in request.headers.items():
        if key.lower() not in skip_headers:
            forward_headers[key] = value

    # --- COOKIE MERGING STRATEGY ---
    # Priority: 
    # 1. Incoming Request Cookies (Explicitly set in Swagger)
    # 2. In-Memory Proxy Session (Recent updates from Set-Cookie or Extension)
    # 3. Database Snapshot (Baseline login state)
    
    final_cookies = {}
    
    # A. Load from Database (Baseline)
    all_sessions = await get_all_auth_sessions()
    latest_bearer = next((s for s in all_sessions if s.get("token_type") == "bearer"), None)
    
    if latest_bearer:
        # Inject Bearer Token
        token_val = latest_bearer.get("token_value")
        if token_val:
            forward_headers["Authorization"] = f"Bearer {token_val}"

        # Inject CSRF Token
        snapshot = latest_bearer.get("headers_snapshot", {})
        csrf_val = None
        # Check dedicated sessions
        csrf_session = next((s for s in all_sessions if s.get("token_type") == "csrf"), None)
        if csrf_session:
            csrf_val = csrf_session.get("token_value")
        # Check snapshot
        if not csrf_val:
            for k, v in snapshot.items():
                if k.lower() in ["x-csrf-token", "x-xsrf-token", "csrf-token"]:
                    csrf_val = v
                    break
        if csrf_val:
            forward_headers["X-CSRF-Token"] = csrf_val

        # Load snapshot cookies
        if "Cookie" in snapshot:
            for item in snapshot["Cookie"].split(";"):
                if "=" in item:
                    k, v = item.split("=", 1)
                    final_cookies[k.strip()] = v.strip()

    # B. Load from In-Memory Proxy Session (Recent from Proxy or Extension)
    final_cookies.update(PROXY_SESSION_COOKIES)

    # C. Load from Incoming Request (Swagger)
    final_cookies.update(request.cookies)

    # --- DYNAMIC HEADER SPOOFING ---
    from urllib.parse import urlparse
    parsed_target = urlparse(target_url)
    
    # Check for SSO flow
    is_sso = "sso.arubainstanton.com" in target_url or "google.com" in target_url
    
    if is_sso:
        # SSO Strict Spoofing
        origin_val = STRICT_ORIGIN
        referer_val = STRICT_REFERER
        print(f"[SPOOFING] Target is SSO/Google. Forcing Origin: {origin_val}")
    else:
        # General Spoofing: Mimic the target domain
        origin_val = f"{parsed_target.scheme}://{parsed_target.netloc}"
        referer_val = f"{origin_val}/"
        print(f"[SPOOFING] Target is General. Spoofing Origin: {origin_val}")

    forward_headers["Origin"] = origin_val
    forward_headers["Referer"] = referer_val
    forward_headers["Host"] = parsed_target.netloc
    forward_headers["User-Agent"] = CHROME_USER_AGENT

    # Read Request Body
    body = await request.body()
    
    # [LOGGING] Detailed Debug Info
    print(f"\n{'='*20} PROXY REQUEST {'='*20}")
    print(f"URL     : {target_url}")
    print(f"Method  : {request.method}")
    print(f"Headers : {json.dumps(forward_headers, indent=2, default=str)}")
    print(f"Cookies : {json.dumps(final_cookies, indent=2, default=str)}")
    if body:
        try:
            print(f"Body    : {body.decode('utf-8')[:500]}...")
        except:
            print(f"Body    : <binary> ({len(body)} bytes)")
    print(f"{'='*56}\n")

    # Make the Request
    async with httpx.AsyncClient(
        timeout=30.0,
        follow_redirects=True, # Smart handling of redirects
        verify=False,
        cookies=final_cookies, # httpx handles formatting the Cookie header
    ) as client:
        try:
            resp = await client.request(
                method=request.method,
                url=target_url,
                headers=forward_headers,
                content=body,
            )

            # --- SMART SESSION CAPTURE ---
            # Extract Set-Cookie headers and update global session
            if resp.cookies:
                for cookie in resp.cookies.jar:
                    PROXY_SESSION_COOKIES[cookie.name] = cookie.value
                    print(f"[PROXY COOKIE] Captured from Response: {cookie.name}={cookie.value[:10]}...")

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

            print(f"[PROXY RESPONSE] Status: {resp.status_code}")
            
            return Response(
                content=resp.content,
                status_code=resp.status_code,
                headers=resp_headers,
                media_type=resp.headers.get("content-type", "application/json"),
            )

        except httpx.RequestError as e:
            print(f"[PROXY ERROR] {str(e)}")
            return Response(
                content=json.dumps({"error": f"Proxy Error: {str(e)}"}),
                status_code=502,
                media_type="application/json",
            )
