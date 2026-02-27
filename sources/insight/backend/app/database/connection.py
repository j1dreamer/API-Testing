"""MongoDB connection manager using Motor async driver."""
from motor.motor_asyncio import AsyncIOMotorClient
from app.config import MONGODB_URL, DATABASE_NAME

client: AsyncIOMotorClient = None
db = None


async def connect_to_mongo():
    """Connect to MongoDB and set up indexes for performance."""
    global client, db
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DATABASE_NAME]
    await client.admin.command("ping")
    print(f"Connected to MongoDB: {DATABASE_NAME}")

    # === Endpoints Collection Indexes ===
    await db.endpoints.create_index("api_key", unique=True)
    await db.endpoints.create_index([("domain", 1), ("method", 1)])
    await db.endpoints.create_index("last_seen_at")

    # === Raw Logs Collection Indexes ===
    await db.raw_logs.create_index("timestamp")
    await db.raw_logs.create_index([("domain", 1), ("method", 1), ("status_code", 1)])
    # Text index for full-text keyword search across URL and body text
    await db.raw_logs.create_index(
        [("url", "text"), ("request_body_text", "text"), ("response_body_text", "text")],
        name="raw_logs_text_search",
    )

    # === Auth Sessions Collection Indexes ===
    await db.auth_sessions.create_index("captured_at")
    await db.auth_sessions.create_index("token_type")

    # === Users and Audit Logs ===
    await db.users.create_index("email", unique=True)
    # TTL Index: Expire after 90 days (7776000 seconds)
    await db.audit_logs.create_index("timestamp", expireAfterSeconds=7776000)


async def close_mongo_connection():
    """Close MongoDB connection."""
    global client
    if client:
        client.close()
        print("MongoDB connection closed.")


def get_database():
    """Get the database instance."""
    return db
