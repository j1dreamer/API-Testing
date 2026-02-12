from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from src.database.connection import connect_to_mongo, close_mongo_connection
from src.core.replay.routes import router as replay_router
from src.core.capture.routes import router as capture_router
from src.core.cloner.routes import router as cloner_router
from src.ui.routes import router as ui_router
from src.core.swagger.generator import get_dynamic_openapi

import asyncio

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle — connect/disconnect MongoDB."""
    await connect_to_mongo()
    yield
    await close_mongo_connection()

app = FastAPI(
    title="Aruba Replay API",
    version="1.0",
    lifespan=lifespan,
    docs_url=None, # Disable default docs to serve custom one
    redoc_url=None,
    openapi_url=None # Disable default openapi.json
)

# Custom Swagger UI to point to our dynamic openapi.json
from fastapi.openapi.docs import get_swagger_ui_html

@app.get("/internal/docs", include_in_schema=False)
async def custom_swagger_ui_html():
    return get_swagger_ui_html(
        openapi_url="/internal/openapi.json",
        title=app.title + " - Docs",
        swagger_js_url="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js",
        swagger_css_url="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css",
    )

# Custom endpoint to REFRESH and GET dynamic openapi
@app.get("/internal/openapi.json", include_in_schema=False)
async def get_openapi_endpoint():
    # Use the generator directly
    return await get_dynamic_openapi(app)

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
app.include_router(replay_router)
app.include_router(capture_router)
app.include_router(cloner_router)
app.include_router(ui_router)

@app.get("/health", tags=["System"])
async def health():
    return {"status": "healthy", "version": "1.0.0"}
