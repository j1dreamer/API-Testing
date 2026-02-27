from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
import asyncio

from app.database.connection import connect_to_mongo, close_mongo_connection, get_database
from app.config import INTERNAL_APP_AUTH, SUPER_ADMIN_EMAILS
from app.core.logging_middleware import GlobalLoggingMiddleware
from datetime import datetime, timezone

# Core Product Routes
from app.ui.routes import router as ui_router
from app.core.inventory.routes import router as inventory_router
from app.core.cloner.routes import router as cloner_router
from app.core.replay.routes import router as replay_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle — connect/disconnect MongoDB."""
    await connect_to_mongo()
    
    # Super Admin Init Logic
    db = get_database()
    for email in SUPER_ADMIN_EMAILS:
        existing = await db.users.find_one({"email": email})
        if not existing:
            # Create if it doesn't exist
            admin_doc = {
                "email": email,
                "role": "admin",
                "isApproved": True,
                "created_at": datetime.now(timezone.utc)
            }
            await db.users.insert_one(admin_doc)
            print(f"Super Admin initialized: {email}")
        else:
            # Ensure it has admin rights and is approved
            await db.users.update_one(
                {"email": email},
                {"$set": {"role": "admin", "isApproved": True}}
            )
            print(f"Super Admin ensured: {email}")
            
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

app.add_middleware(GlobalLoggingMiddleware)

# Internal Auth Middleware - REMOVED per user request
# class InternalAuthMiddleware(BaseHTTPMiddleware):
#     async def dispatch(self, request: Request, call_next):
#         return await call_next(request)

# app.add_middleware(InternalAuthMiddleware)

# Register routers
from app.core.admin.routes import router as admin_router

app.include_router(ui_router)       # Proxy Logic
app.include_router(inventory_router) # Data Scrubbing Logic
app.include_router(cloner_router)    # Site Cloner Logic
app.include_router(replay_router)    # Replay/Login Logic

# New Admin Routes
app.include_router(admin_router, prefix="/api/admin", tags=["Admin"])

@app.get("/health", tags=["System"])
async def health():
    return {"status": "healthy", "version": "1.0.0"}
