import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timezone

from app.database.connection import connect_to_mongo, close_mongo_connection, get_database
from app.config import INTERNAL_APP_AUTH, SUPER_ADMIN_EMAILS
from app.shared.logging_middleware import GlobalLoggingMiddleware

# Feature-first routers — all under /api/v1/
from app.features.auth.routes import router as auth_router
from app.features.cloner.routes import router as cloner_router
from app.features.replay.routes import router as replay_router
from app.features.admin.routes import router as admin_router
from app.features.inventory.routes import router as inventory_router
from app.features.overview.routes import router as overview_router
from app.features.config.routes import router as config_router
from app.features.capture.routes import router as capture_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle — connect/disconnect MongoDB."""
    await connect_to_mongo()

    # Super Admin Init Logic
    db = get_database()
    for email in SUPER_ADMIN_EMAILS:
        existing = await db.users.find_one({"email": email})
        if not existing:
            await db.users.insert_one({
                "email": email,
                "role": "admin",
                "isApproved": True,
                "created_at": datetime.now(timezone.utc)
            })
            print(f"Super Admin initialized: {email}")
        else:
            await db.users.update_one(
                {"email": email},
                {"$set": {"role": "admin", "isApproved": True}}
            )
            print(f"Super Admin ensured: {email}")

    yield
    await close_mongo_connection()


app = FastAPI(
    title="Instant Insight Backend",
    version="2.0",
    lifespan=lifespan,
    docs_url=None,
    redoc_url=None,
    openapi_url=None
)

# CORS — origins loaded from CORS_ORIGINS env var
_cors_raw = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
_cors_origins = [o.strip() for o in _cors_raw.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

app.add_middleware(GlobalLoggingMiddleware)

# Feature-first routers
app.include_router(auth_router)                                           # /api/v1/auth
app.include_router(cloner_router)                                         # /api/v1/cloner
app.include_router(replay_router)                                         # /api/v1/replay
app.include_router(admin_router, prefix="/api/v1/admin", tags=["Admin"]) # /api/v1/admin
app.include_router(inventory_router)                                      # /api/v1/inventory
app.include_router(overview_router)                                       # /api/v1/overview
app.include_router(config_router)                                         # /api/v1/config
app.include_router(capture_router)                                        # /api/v1/capture* (hidden)


@app.get("/health", tags=["System"])
async def health():
    return {"status": "healthy", "version": "2.0.0"}
