"""OpenAPI 3.0 specification generator optimized for Aruba API documentation."""
from typing import Any, Dict, List, Optional


def _infer_schema(value: Any) -> dict:
    """Infer a JSON Schema from a sample value (recursive)."""
    if value is None:
        return {"type": "string", "nullable": True}
    if isinstance(value, bool):
        return {"type": "boolean"}
    if isinstance(value, int):
        return {"type": "integer"}
    if isinstance(value, float):
        return {"type": "number"}
    if isinstance(value, str):
        return {"type": "string"}
    if isinstance(value, list):
        if len(value) > 0:
            return {"type": "array", "items": _infer_schema(value[0])}
        return {"type": "array", "items": {"type": "string"}}
    if isinstance(value, dict):
        properties = {}
        for k, v in value.items():
            properties[k] = _infer_schema(v)
        return {
            "type": "object",
            "properties": properties,
        }
    return {"type": "string"}


def _build_parameters(query_params: Dict[str, str]) -> List[dict]:
    """Build OpenAPI parameters from captured query params."""
    params = []
    for name, example_value in query_params.items():
        params.append({
            "name": name,
            "in": "query",
            "required": False,
            "schema": {"type": "string"},
            "example": example_value,
        })
    return params


def _extract_path_params(path: str) -> List[dict]:
    """Extract path parameters from a normalized path like /api/sites/{id}."""
    import re
    params = []
    for match in re.finditer(r"\{(\w+)\}", path):
        params.append({
            "name": match.group(1),
            "in": "path",
            "required": True,
            "schema": {"type": "string"},
        })
    return params


def _infer_tag(path: str) -> str:
    """Infer a meaningful tag from the API path.
    
    Examples:
        /api/sites/{id}/devices -> Sites
        /api/inventories -> Inventories
        /api/monitoring/clients -> Monitoring
    """
    parts = [p for p in path.split("/") if p and p != "api" and not p.startswith("{")]
    if parts:
        # Use first meaningful segment as tag
        tag = parts[0].replace("-", " ").replace("_", " ").title()
        return tag
    return "General"


def _build_security_schemes(endpoints: List[dict], auth_session: Optional[dict] = None) -> dict:
    """Detect authentication schemes from captured headers."""
    schemes = {}

    # Always add Bearer if we have an auth session
    if auth_session and auth_session.get("token_type") == "bearer":
        schemes["BearerAuth"] = {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT",
            "description": f"Auto-captured token from {auth_session.get('source_url', 'unknown')}",
        }

    for ep in endpoints:
        headers = ep.get("request_headers", {})
        for key in headers:
            key_lower = key.lower()
            if key_lower == "authorization" and "BearerAuth" not in schemes:
                schemes["BearerAuth"] = {
                    "type": "http",
                    "scheme": "bearer",
                    "bearerFormat": "JWT",
                }
            elif key_lower == "x-csrf-token":
                schemes["CsrfToken"] = {
                    "type": "apiKey",
                    "in": "header",
                    "name": "X-CSRF-Token",
                }

    return schemes


def generate_openapi_spec(
    endpoints: List[dict],
    domain: str,
    auth_session: Optional[dict] = None,
    server_url: Optional[str] = None,
) -> dict:
    """Generate a complete OpenAPI 3.0 spec from captured endpoint documents.
    
    Includes auto-injected auth from latest captured session.
    """
    # Base Proxy URL
    if not server_url:
        server_url = "http://localhost:8000/api/proxy"

    paths: Dict[str, dict] = {}

    for ep in endpoints:
        path = ep["path"]
        method = ep["method"].lower()

        if path not in paths:
            paths[path] = {}

        # Tag from path
        tag = _infer_tag(path)

        # Build operation
        operation: dict = {
            "summary": f"{ep['method']} {path}",
            "operationId": f"{method}_{path.replace('/', '_').strip('_')}",
            "tags": [tag],
            "description": (
                f"Captured {ep.get('request_count', 1)} time(s). "
                f"Status codes observed: {ep.get('status_codes', [])}"
            ),
        }

        # Path parameters
        path_params = _extract_path_params(path)

        # Query parameters
        qp = ep.get("query_params", {})
        all_params = path_params + (_build_parameters(qp) if qp else [])
        if all_params:
            operation["parameters"] = all_params

        # Request body
        req_body = ep.get("request_body_sample")
        if req_body and method in ("post", "put", "patch"):
            headers = ep.get("request_headers", {})
            content_type = "application/json"
            for k, v in headers.items():
                if k.lower() == "content-type":
                    content_type = v.split(";")[0].strip()
                    break

            # Schema Generation
            is_form = content_type == "application/x-www-form-urlencoded"
            final_schema = {"type": "string"} # Default fallback

            if is_form and isinstance(req_body, str):
                try:
                    from urllib.parse import parse_qsl
                    # parse_qsl returns list of (key, value) tuples, preserving order better than parse_qs for simple forms
                    parsed = parse_qsl(req_body)
                    properties = {}
                    
                    if parsed:
                         for key, val in parsed:
                             properties[key] = {"type": "string", "default": val}
                         
                         final_schema = {
                             "type": "object",
                             "properties": properties
                         }
                    else:
                         # Maybe raw string acting as form? Fallback
                         final_schema = _infer_schema(req_body)
                except:
                    final_schema = _infer_schema(req_body)
            else:
                final_schema = _infer_schema(req_body)

            operation["requestBody"] = {
                "required": True,
                "content": {
                    content_type: {
                        "schema": final_schema,
                        "example": req_body
                    }
                }
            }

        # Responses
        responses = {}
        for status_code in ep.get("status_codes", [200]):
            resp_obj: dict = {"description": f"Status {status_code}"}
            res_body = ep.get("response_body_sample")
            if res_body and 200 <= status_code < 300:
                resp_obj["content"] = {
                    ep.get("content_type", "application/json"): {
                        "schema": _infer_schema(res_body),
                        "example": res_body,
                    }
                }
            responses[str(status_code)] = resp_obj

        if not responses:
            responses["200"] = {"description": "Success"}

        operation["responses"] = responses

        # Security per-operation
        headers = ep.get("request_headers", {})
        security = []
        for key in headers:
            key_lower = key.lower()
            if key_lower == "authorization":
                security.append({"BearerAuth": []})
            elif key_lower == "x-csrf-token":
                security.append({"CsrfToken": []})
        if security:
            operation["security"] = security

        # Add Server block specifically for this operation's domain
        ep_domain = ep.get("domain", domain)
        operation["servers"] = [
            {
                "url": f"http://localhost:8000/api/proxy?domain={ep_domain}",
                "description": f"Proxy via {ep_domain}"
            }
        ]

        # Store captured headers for proxy
        operation["x-captured-headers"] = headers
        operation["x-captured-cookies"] = ep.get("cookies", {})

        paths[path][method] = operation

    # Build security schemes
    security_schemes = _build_security_schemes(endpoints, auth_session)

    # Build spec
    spec = {
        "openapi": "3.0.3",
        "info": {
            "title": f"Aruba Instant On API — {domain}",
            "description": (
                f"**Auto-captured API documentation** from real browser traffic on `{domain}`.\n\n"
                "This spec is generated automatically by the Aruba API Capture tool. "
                "Use **'Try it out'** to replay requests with captured authentication.\n\n"
                f"**Unique endpoints:** {len(endpoints)} | "
                f"**Total requests captured:** {sum(ep.get('request_count', 0) for ep in endpoints)}"
            ),
            "version": "1.0.0",
        },
        "servers": [
            {
                "url": server_url,
                "description": "Proxy (auto-injects captured auth headers)",
            },
            {
                "url": f"https://{domain}",
                "description": "Direct Aruba API (requires manual auth)",
            },
        ],
        "paths": paths,
    }

    if security_schemes:
        spec["components"] = {"securitySchemes": security_schemes}
        # Default security for all operations
        spec["security"] = [{name: []} for name in security_schemes]

    return spec
