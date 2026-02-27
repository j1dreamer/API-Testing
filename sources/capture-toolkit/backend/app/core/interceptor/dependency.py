"""Dependency mapping logic for API reverse-engineering."""
import re
from typing import List, Optional
from app.database.connection import get_database

# UUID pattern
UUID_PATTERN = re.compile(r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', re.I)

async def resolve_dependencies(url: str, request_body: any) -> List[str]:
    """Find other endpoints that might provide IDs used in this request.
    
    Heuristic:
    1. Extract potential IDs from the URL and Request Body.
    2. Search the database for GET requests that contain these IDs in their response bodies.
    3. Return the api_keys of those source endpoints.
    """
    db = get_database()
    potential_ids = set(UUID_PATTERN.findall(url))
    
    if isinstance(request_body, str):
        potential_ids.update(UUID_PATTERN.findall(request_body))
    elif isinstance(request_body, dict):
        # Shallow check of dict values for IDs
        for value in request_body.values():
            if isinstance(value, str) and UUID_PATTERN.match(value):
                potential_ids.add(value)

    dependencies = []
    for id_val in potential_ids:
        # Search for endpoints that returned this ID in their latest response sample
        # This is a simplified heuristic
        cursor = db.endpoints.find({
            "method": "GET",
            "response_body_sample": {"$regex": id_val} if isinstance(id_val, str) else id_val
        }).limit(5)
        
        async for doc in cursor:
            dependencies.append(doc["api_key"])
            
    return list(set(dependencies))
