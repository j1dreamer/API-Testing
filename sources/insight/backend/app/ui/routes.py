from fastapi import APIRouter, Request, Response
import httpx
import json
from app.services.aruba import aruba_service

router = APIRouter(tags=["Proxy"])

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

# --- Toolkit Proxy (Forwarding to Port 8001) ---
TOOLKIT_BASE_URL = "http://localhost:8001"

@router.api_route(
    "/api/cloner/{path:path}",
    methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"],
)
async def proxy_cloner(path: str, request: Request):
    """Forward /api/cloner/* to Toolkit Backend (8001)."""
    return await _forward_to_toolkit(f"/api/cloner/{path}", request)

@router.api_route(
    "/api/logs/{path:path}",
    methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"],
)
async def proxy_logs(path: str, request: Request):
    """Forward /api/logs/* to Toolkit Backend (8001)."""
    return await _forward_to_toolkit(f"/api/logs/{path}", request)

async def _forward_to_toolkit(target_path: str, request: Request):
    url = f"{TOOLKIT_BASE_URL}{target_path}"
    
    # Exclude headers that confuse the forwarding
    # We DO want to forward Auth/Content headers usually, but the Toolkit might not need X-Internal-App-Auth
    # The Toolkit might expect its own headers? 
    # Actually, the Frontend sends headers. We just pass them along.
    
    forward_headers = {}
    skip_headers = {"host", "content-length", "connection"}
    for key, value in request.headers.items():
        if key.lower() not in skip_headers:
            forward_headers[key] = value

    try:
        async with httpx.AsyncClient() as client:
            body = await request.body()
            resp = await client.request(
                method=request.method,
                url=url,
                content=body,
                headers=forward_headers,
                params=request.query_params,
                timeout=30.0
            )
            
            # Prepare response headers
            resp_headers = {}
            for key, value in resp.headers.items():
                if key.lower() not in skip_headers and key.lower() != "content-encoding":
                     resp_headers[key] = value
            
            return Response(
                content=resp.content,
                status_code=resp.status_code,
                headers=resp_headers,
                media_type=resp.headers.get("content-type")
            )
    except Exception as e:
        return JSONResponse(
            status_code=502,
            content={"error": f"Toolkit Proxy Error: {str(e)}"}
        )
