"""Postman Collection v2.1 generator."""
import uuid
from typing import List, Dict, Any, Optional

def generate_postman_collection(endpoints: List[dict], domain: str) -> dict:
    """Convert captured endpoints into a Postman Collection v2.1.0."""
    collection_id = str(uuid.uuid4())
    
    items = []
    
    # Group by Tags (Folders)
    folders: Dict[str, List[dict]] = {}
    for ep in endpoints:
        tag = ep.get("path", "/").split("/")[2] if len(ep.get("path", "").split("/")) > 2 else "General"
        if tag not in folders:
            folders[tag] = []
        folders[tag].append(ep)

    for folder_name, eps in folders.items():
        folder_items = []
        for ep in eps:
            method = ep["method"].upper()
            path = ep["path"]
            
            # Build request
            request = {
                "method": method,
                "header": [
                    {"key": k, "value": v, "type": "text"} 
                    for k, v in ep.get("request_headers", {}).items()
                    if k.lower() not in ("content-length", "host")
                ],
                "url": {
                    "raw": f"https://{domain}{path}",
                    "protocol": "https",
                    "host": domain.split("."),
                    "path": [p for p in path.split("/") if p]
                }
            }
            
            # Add body if JSON
            if ep.get("request_body_sample") and method in ("POST", "PUT", "PATCH"):
                request["body"] = {
                    "mode": "raw",
                    "raw": ep["request_body_sample"] if isinstance(ep["request_body_sample"], str) else f"{ep['request_body_sample']}",
                    "options": {"raw": {"language": "json"}}
                }

            folder_items.append({
                "name": f"{method} {path}",
                "request": request,
                "response": []
            })
            
        items.append({
            "name": folder_name.title(),
            "item": folder_items
        })

    return {
        "info": {
            "_postman_id": collection_id,
            "name": f"Aruba API Blueprint - {domain}",
            "description": "Auto-captured collection from Aruba API Capture Engine.",
            "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
        },
        "item": items
    }
