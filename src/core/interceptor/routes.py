from fastapi import APIRouter
from datetime import datetime
from urllib.parse import urlparse, parse_qs
from src.database.models import CapturePayload, BatchCapturePayload, AuthSessionPayload
from src.database.crud import upsert_endpoint, insert_raw_log, upsert_auth_session
from src.core.interceptor.normalizer import normalize_url, generate_api_key
from src.core.interceptor.dependency import resolve_dependencies
from src.core.websocket.manager import manager

router = APIRouter(prefix="/api", tags=["Capture"])


async def _process_capture(payload: CapturePayload) -> dict:
    """Process a single captured request — normalize, store endpoint, store raw log."""
    method = payload.method.upper()
    domain, normalized_path, _ = normalize_url(payload.url)
    api_key = generate_api_key(domain, normalized_path, method)

    # Extract query params from URL
    parsed_url = urlparse(payload.url)
    query_params = {k: v[0] for k, v in parse_qs(parsed_url.query).items()}

    # Extract cookies from headers
    cookies = payload.request_headers.get("Cookie", payload.request_headers.get("cookie", ""))

    # Detect content type
    content_type = payload.mime_type or payload.response_headers.get(
        "content-type",
        payload.response_headers.get("Content-Type", "application/json"),
    )

    # Detect dependencies (Heuristics for SiteID, etc.)
    dependencies = await resolve_dependencies(payload.url, payload.request_body)

    # 1. Upsert endpoint (aggregated)
    endpoint_id = await upsert_endpoint(
        api_key=api_key,
        domain=domain,
        path=normalized_path,
        method=method,
        request_headers=payload.request_headers,
        mandatory_headers=payload.mandatory_headers,
        execution_context=payload.execution_context,
        dependencies=dependencies,
        cookies_str=cookies,
        query_params=query_params,
        request_body=payload.request_body,
        response_body=payload.response_body,
        status_code=payload.status_code,
        content_type=content_type.split(";")[0].strip(),
        duration_ms=payload.duration_ms,
    )

    # 2. Insert raw log (for full-text search)
    log_id = await insert_raw_log(
        url=payload.url,
        method=method,
        domain=domain,
        path=normalized_path,
        request_headers=payload.request_headers,
        mandatory_headers=payload.mandatory_headers,
        execution_context=payload.execution_context,
        request_body=payload.request_body,
        status_code=payload.status_code,
        response_headers=payload.response_headers,
        response_body=payload.response_body,
        duration_ms=payload.duration_ms,
        cookies=cookies,
        query_params=query_params,
    )

    # 3. Broadcast to Web Dashboard
    await manager.broadcast({
        "type": "NEW_REQUEST",
        "data": {
            "id": log_id,
            "url": payload.url,
            "method": method,
            "status_code": payload.status_code,
            "duration_ms": payload.duration_ms,
            "timestamp": payload.timestamp or datetime.now().timestamp()
        }
    })

    return {"id": endpoint_id, "log_id": log_id, "api_key": api_key}


@router.post("/capture", status_code=201)
async def capture_request(payload: CapturePayload):
    """Receive a single captured request/response from the extension."""
    result = await _process_capture(payload)
    return result


@router.post("/capture/batch", status_code=201)
async def capture_batch(payload: BatchCapturePayload):
    """Receive a batch of captured requests from the extension."""
    results = []
    for req in payload.requests:
        result = await _process_capture(req)
        results.append(result)
    return {"count": len(results), "results": results}


@router.post("/auth-session", status_code=201)
async def store_auth_session(payload: AuthSessionPayload):
    """Store a captured authentication session (tokens, cookies, CSRF)."""
    session_id = await upsert_auth_session(
        token_type=payload.token_type,
        token_value=payload.token_value,
        refresh_token=payload.refresh_token,
        expires_in=payload.expires_in,
        source_url=payload.source_url,
        headers_snapshot=payload.headers_snapshot,
    )
    return {"id": session_id, "token_type": payload.token_type}
