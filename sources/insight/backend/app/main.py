from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
import asyncio

from app.database.connection import connect_to_mongo, close_mongo_connection
from app.config import INTERNAL_APP_AUTH

# Core Product Routes
from app.ui.routes import router as ui_router
from app.core.inventory.routes import router as inventory_router
from app.core.cloner.routes import router as cloner_router
from app.core.replay.routes import router as replay_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle — connect/disconnect MongoDB."""
    await connect_to_mongo()
    yield
    await close_mongo_connection()

app = FastAPI(
    title="Instant Insight Backend",
    version="1.0",
    lifespan=lifespan,
    docs_url=None, # DISABLED in Production
    redoc_url=None,
    openapi_url=None # DISABLED in Production
)

# CORS — allow all (Restricted by Auth Middleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Internal Auth Middleware - REMOVED per user request
# class InternalAuthMiddleware(BaseHTTPMiddleware):
#     async def dispatch(self, request: Request, call_next):
#         return await call_next(request)

# app.add_middleware(InternalAuthMiddleware)

# Register routers
# Register routers
app.include_router(ui_router)       # Proxy Logic
app.include_router(inventory_router) # Data Scrubbing Logic
app.include_router(cloner_router)    # Site Cloner Logic
app.include_router(replay_router)    # Replay/Login Logic

@app.get("/health", tags=["System"])
async def health():
    return {"status": "healthy", "version": "1.0.0"}
