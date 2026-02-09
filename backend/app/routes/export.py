import json
from fastapi import APIRouter, HTTPException
from app import crud

router = APIRouter(prefix="/logs", tags=["Export"])


@router.get("/{log_id}/export/postman")
async def export_postman(log_id: str):
    """
    Export a captured request as Postman Collection v2.1 format.
    
    Returns a JSON object that can be imported into Postman.
    """
    log = await crud.get_log_by_id(log_id)
    if not log:
        raise HTTPException(status_code=404, detail="Log not found")

    # Build Postman Collection v2.1 format
    postman_request = {
        "info": {
            "name": f"Captured Request - {log['method']} {log['url'].split('/')[-1]}",
            "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
        },
        "item": [
            {
                "name": log["url"],
                "request": {
                    "method": log["method"],
                    "header": [
                        {"key": k, "value": v}
                        for k, v in log.get("request_headers", {}).items()
                    ],
                    "url": {
                        "raw": log["url"],
                        "protocol": log["url"].split("://")[0] if "://" in log["url"] else "https",
                        "host": log["url"].split("://")[1].split("/")[0].split(".") if "://" in log["url"] else [],
                        "path": log["url"].split("://")[1].split("/")[1:] if "://" in log["url"] and "/" in log["url"].split("://")[1] else []
                    }
                },
                "response": []
            }
        ]
    }

    # Add body if present
    if log.get("request_body"):
        body_content = log["request_body"]
        if isinstance(body_content, dict):
            postman_request["item"][0]["request"]["body"] = {
                "mode": "raw",
                "raw": json.dumps(body_content, indent=2),
                "options": {
                    "raw": {
                        "language": "json"
                    }
                }
            }
        else:
            postman_request["item"][0]["request"]["body"] = {
                "mode": "raw",
                "raw": str(body_content)
            }

    return postman_request


@router.get("/{log_id}/export/curl")
async def export_curl(log_id: str):
    """
    Export a captured request as a cURL command.
    
    Returns a string that can be executed in a terminal.
    """
    log = await crud.get_log_by_id(log_id)
    if not log:
        raise HTTPException(status_code=404, detail="Log not found")

    # Build cURL command
    curl_parts = [f"curl -X {log['method']}"]

    # Add headers
    for key, value in log.get("request_headers", {}).items():
        # Escape single quotes in header values
        escaped_value = value.replace("'", "\\'")
        curl_parts.append(f"-H '{key}: {escaped_value}'")

    # Add body if present
    if log.get("request_body"):
        body_content = log["request_body"]
        if isinstance(body_content, dict):
            body_str = json.dumps(body_content)
        else:
            body_str = str(body_content)
        # Escape single quotes in body
        escaped_body = body_str.replace("'", "\\'")
        curl_parts.append(f"-d '{escaped_body}'")

    # Add URL
    curl_parts.append(f"'{log['url']}'")

    curl_command = " \\\n  ".join(curl_parts)
    return {"curl": curl_command}
