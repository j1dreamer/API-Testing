from fastapi.openapi.utils import get_openapi
from app.database.crud import get_all_endpoints

async def get_dynamic_openapi(app):
    """
    Generate dynamic OpenAPI schema by merging static routes 
    with discovered endpoints from the database.
    """
    print("[SWAGGER] Generating dynamic openapi...")
    
    openapi_schema = get_openapi(
        title=app.title,
        version=app.version,
        routes=app.routes,
    )
    
    # 2. Fetch captured endpoints from DB
    try:
        endpoints, total = await get_all_endpoints(limit=500)
        print(f"[SWAGGER] Found {len(endpoints)} endpoints in DB")
    except Exception as e:
        print(f"[SWAGGER GENERATOR ERROR] {e}")
        endpoints = []

    # 3. Inject discovered endpoints into the schema
    # We map them to the Replay Proxy: /api/replay/api/{path}
    for ep in endpoints:
        path = ep.get("path", "")
        method = ep.get("method", "GET").lower()
        domain = ep.get("domain", "")
        
        # Format the display path in Swagger
        # We use the proxy prefix /api/replay
        display_path = f"/api/replay{path}"
        
        if display_path not in openapi_schema["paths"]:
            openapi_schema["paths"][display_path] = {}
            
        openapi_schema["paths"][display_path][method] = {
            "tags": ["Discovered APIs"],
            "summary": f"[{domain}] {path}",
            "description": f"Proxied request to {domain}{path} via Aruba Replay System.",
            "responses": {
                "200": {"description": "Successful response"},
                "401": {"description": "Token expired or missing"}
            },
            "parameters": [
                {
                    "name": "domain",
                    "in": "query",
                    "required": False,
                    "schema": {"type": "string", "default": domain},
                    "description": "Target domain for this request."
                }
            ]
        }
        
    app.openapi_schema = openapi_schema
    return app.openapi_schema
