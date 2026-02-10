"""FastAPI application entry point — Aruba API Capture System."""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from src.database.connection import connect_to_mongo, close_mongo_connection
from src.core.interceptor.routes import router as capture_router
from src.swagger.routes import router as swagger_router
from src.ui.routes import router as ui_router


from fastapi.openapi.utils import get_openapi
from src.database.crud import get_all_endpoints, get_latest_auth

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle — connect/disconnect MongoDB."""
    await connect_to_mongo()
    yield
    await close_mongo_connection()

app = FastAPI(
    title="Aruba API Research Engine",
    description="System-wide API documentation including captured Aruba traffic.",
    version="1.0.0",
    lifespan=lifespan,
    docs_url=None,       # Disable default docs
    openapi_url=None     # Disable default openapi
)

# 1. Custom Merged OpenAPI Route
@app.get("/internal/openapi.json", include_in_schema=False)
async def get_merged_openapi():
    # 1. Base spec (System APIs)
    spec = get_openapi(
        title="Aruba API Research Engine",
        version="1.0.0",
        description="Consolidated system and captured API documentation.",
        routes=app.routes,
    )
    
    # 2. Add captured endpoints from MongoDB
    endpoints, total = await get_all_endpoints(limit=2000)
    
    if endpoints:
        from src.swagger.generator import generate_openapi_spec
        auth = await get_latest_auth("bearer")
        domain = endpoints[0].get("domain", "captured.arubainstanton.com")
        captured_spec = generate_openapi_spec(endpoints, domain=domain, auth_session=auth)
        
        captured_paths = captured_spec.get("paths", {})
            
        # Merge paths
        if "paths" not in spec: spec["paths"] = {}
        for path, methods in captured_paths.items():
            for method, op in methods.items():
                old_tags = op.get("tags", ["General"])
                op["tags"] = ["Instant On: " + t for t in old_tags]
            
            # Merge (Captured paths overwrite system ones ONLY if they collide)
            spec["paths"][path] = methods 
        
        # Merge security
        if "components" not in spec: spec["components"] = {}
        if "securitySchemes" not in spec["components"]: spec["components"]["securitySchemes"] = {}
        spec["components"]["securitySchemes"].update(captured_spec.get("components", {}).get("securitySchemes", {}))
        
        # Merge servers
        if "servers" not in spec: spec["servers"] = []
        spec["servers"].extend(captured_spec.get("servers", []))

    return spec

# 2. Custom Swagger UI Route
from fastapi.openapi.docs import get_swagger_ui_html
@app.get("/internal/docs", include_in_schema=False)
async def custom_swagger_ui_html():
    return get_swagger_ui_html(
        openapi_url="/internal/openapi.json",
        title=app.title + " - Docs",
        swagger_js_url="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js",
        swagger_css_url="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css",
    )

# CORS — allow all
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Register routers
app.include_router(capture_router)   # POST /api/capture
app.include_router(swagger_router)   # GET  /api/swagger.json
app.include_router(ui_router)        # Dashboard

@app.get("/health", tags=["System"])
async def health():
    return {"status": "healthy", "version": "1.0.0"}
