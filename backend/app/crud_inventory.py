"""CRUD operations for API Inventory (Phase 7)."""
from datetime import datetime
from typing import Optional, List
from bson import ObjectId
from app.database import get_database
from app.normalizer import normalize_url, generate_api_key
from app.schemas_inventory import ApiDefinitionUpdate


async def upsert_api_definition(
    url: str,
    method: str,
    status_code: int,
    request_body: Optional[dict] = None,
    response_body: Optional[dict] = None
) -> str:
    """
    Create or update an API definition based on normalized URL and method.
    
    Returns the ID of the created/updated definition.
    """
    db = get_database()
    domain, normalized_path = normalize_url(url)
    method = method.upper()
    api_key = generate_api_key(domain, normalized_path, method)
    
    # Check if API definition exists
    existing = await db.api_definitions.find_one({"api_key": api_key})
    
    now = datetime.utcnow()
    
    if existing:
        # Update existing definition
        update_doc = {
            "$set": {
                "last_seen_at": now,
                f"method_coverage.{method}": "Captured"
            },
            "$inc": {"request_count": 1}
        }
        
        # Add new status code if not present
        if status_code and status_code not in existing.get("status_codes", []):
            update_doc["$addToSet"] = {"status_codes": status_code}
        
        # Update examples if provided and current ones are empty
        if response_body and not existing.get("response_example"):
            update_doc["$set"]["response_example"] = response_body
        if request_body and not existing.get("request_example"):
            update_doc["$set"]["request_example"] = request_body
        
        await db.api_definitions.update_one({"_id": existing["_id"]}, update_doc)
        return str(existing["_id"])
    else:
        # Create new API definition
        new_def = {
            "api_key": api_key,
            "domain": domain,
            "path": normalized_path,
            "method": method,
            "method_coverage": {
                "GET": "Captured" if method == "GET" else "Missing",
                "POST": "Captured" if method == "POST" else "Missing",
                "PUT": "Captured" if method == "PUT" else "Missing",
                "DELETE": "Captured" if method == "DELETE" else "Missing",
                "PATCH": "Captured" if method == "PATCH" else "Missing"
            },
            "api_name": None,
            "description_vi": None,
            "notes_vi": None,
            "request_example": request_body,
            "response_example": response_body,
            "status_codes": [status_code] if status_code else [],
            "request_count": 1,
            "created_at": now,
            "last_seen_at": now
        }
        result = await db.api_definitions.insert_one(new_def)
        return str(result.inserted_id)


async def get_api_definitions(
    domain: Optional[str] = None,
    incomplete_only: bool = False,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 50
) -> tuple[List[dict], int]:
    """Retrieve API definitions with optional filters."""
    db = get_database()
    query = {}
    
    if domain:
        query["domain"] = domain
    
    if incomplete_only:
        # Find APIs where at least one method is missing
        query["$or"] = [
            {"method_coverage.GET": "Missing"},
            {"method_coverage.POST": "Missing"},
            {"method_coverage.PUT": "Missing"},
            {"method_coverage.DELETE": "Missing"}
        ]
    
    if search:
        query["path"] = {"$regex": search, "$options": "i"}
    
    total = await db.api_definitions.count_documents(query)
    cursor = db.api_definitions.find(query).sort("path", 1).skip(skip).limit(limit)
    apis = await cursor.to_list(length=limit)
    
    for api in apis:
        api["_id"] = str(api["_id"])
    
    return apis, total


async def get_api_definition_by_id(api_id: str) -> Optional[dict]:
    """Get a single API definition by ID."""
    db = get_database()
    if not ObjectId.is_valid(api_id):
        return None
    api = await db.api_definitions.find_one({"_id": ObjectId(api_id)})
    if api:
        api["_id"] = str(api["_id"])
    return api


async def update_api_documentation(api_id: str, update_data: ApiDefinitionUpdate) -> bool:
    """Update Vietnamese documentation for an API definition."""
    db = get_database()
    if not ObjectId.is_valid(api_id):
        return False
    
    update_doc = {}
    if update_data.api_name is not None:
        update_doc["api_name"] = update_data.api_name
    if update_data.description_vi is not None:
        update_doc["description_vi"] = update_data.description_vi
    if update_data.notes_vi is not None:
        update_doc["notes_vi"] = update_data.notes_vi
    
    if not update_doc:
        return True  # Nothing to update
    
    result = await db.api_definitions.update_one(
        {"_id": ObjectId(api_id)},
        {"$set": update_doc}
    )
    return result.modified_count > 0


async def refresh_api_inventory() -> dict:
    """
    Rebuild the entire API inventory from logs.
    Clears existing definitions and re-processes all logs.
    """
    db = get_database()
    
    # Store existing documentation to preserve it
    existing_docs = {}
    async for api in db.api_definitions.find():
        key = api.get("api_key")
        if key:
            existing_docs[key] = {
                "api_name": api.get("api_name"),
                "description_vi": api.get("description_vi"),
                "notes_vi": api.get("notes_vi")
            }
    
    # Clear API definitions
    await db.api_definitions.delete_many({})
    
    # Re-process all logs
    processed = 0
    async for log in db.logs.find():
        await upsert_api_definition(
            url=log.get("url", ""),
            method=log.get("method", "GET"),
            status_code=log.get("status_code", 0),
            request_body=log.get("request_body"),
            response_body=log.get("response_body")
        )
        processed += 1
    
    # Restore documentation
    for api_key, docs in existing_docs.items():
        await db.api_definitions.update_one(
            {"api_key": api_key},
            {"$set": docs}
        )
    
    # Get final count
    final_count = await db.api_definitions.count_documents({})
    
    return {
        "logs_processed": processed,
        "apis_created": final_count,
        "documentation_preserved": len(existing_docs)
    }


async def get_domains() -> List[str]:
    """Get list of unique domains in the inventory."""
    db = get_database()
    domains = await db.api_definitions.distinct("domain")
    return domains
