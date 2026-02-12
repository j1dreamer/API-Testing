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


def generate_postman_from_logs(logs: List[dict], collection_name: str = "Captured Traffic") -> dict:
    """Convert a list of raw raw_logs into a Postman Collection v2.1.0."""
    collection_id = str(uuid.uuid4())
    
    items = []
    # Group by domain to create folders
    domain_folders: Dict[str, List[dict]] = {}
    
    for log in logs:
        domain = log.get("domain", "Unknown")
        if domain not in domain_folders:
            domain_folders[domain] = []
        domain_folders[domain].append(log)
        
    for domain, domain_logs in domain_folders.items():
        domain_items = []
        for log in domain_logs:
            method = log["method"].upper()
            url_str = log["url"]
            path = log.get("path", "")
            
            # Build headers
            headers = [
                {"key": k, "value": v, "type": "text"} 
                for k, v in log.get("request_headers", {}).items()
                if k.lower() not in ("content-length", "host")
            ]
            
            # Build request object
            from urllib.parse import urlparse
            u = urlparse(url_str)
            
            request = {
                "method": method,
                "header": headers,
                "url": {
                    "raw": url_str,
                    "protocol": u.scheme,
                    "host": u.netloc.split("."),
                    "path": [p for p in u.path.split("/") if p],
                    "query": [
                        {"key": k, "value": v} for k, v in log.get("query_params", {}).items()
                    ] if log.get("query_params") else []
                }
            }
            
            # Add body for mutating methods
            if log.get("request_body") and method in ("POST", "PUT", "PATCH"):
                body_content = log["request_body"]
                if not isinstance(body_content, str):
                    import json
                    try:
                        body_content = json.dumps(body_content, indent=2)
                    except:
                        body_content = str(body_content)
                
                request["body"] = {
                    "mode": "raw",
                    "raw": body_content,
                    "options": {"raw": {"language": "json"}}
                }

            domain_items.append({
                "name": f"{method} {path or url_str}",
                "request": request,
                "response": []
            })
            
        items.append({
            "name": domain,
            "item": domain_items
        })

    return {
        "info": {
            "_postman_id": collection_id,
            "name": collection_name,
            "description": f"Bulk capture of {len(logs)} requests.",
            "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
        },
        "item": items
    }
