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

# --- Toolkit Proxy (MOVED TO LOCAL) ---
# Routes are now handled directly by cloner_router in main.py

