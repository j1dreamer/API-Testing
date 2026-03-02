"""MongoDB connection manager using Motor async driver.

Architecture constraint (stateless_architecture.md):
  - Connect ONLY to insight DB at localhost:27017.
  - NEVER store tokens, passwords, or sessions in the database.
  - Only `users` (identity + app role) and `audit_logs` collections are permitted.
"""
from motor.motor_asyncio import AsyncIOMotorClient
from app.config import MONGODB_URL, DATABASE_NAME

client: AsyncIOMotorClient = None
db = None


async def connect_to_mongo():
    """Connect to MongoDB insight DB and set up required indexes."""
    global client, db
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DATABASE_NAME]
    await client.admin.command("ping")
    node_info = client.address
    host_port = f"{node_info[0]}:{node_info[1]}" if node_info else "localhost:27017"
    print(f"INFO: Connected to MongoDB at {host_port} (Database: {DATABASE_NAME})")

    # === Permitted collections: users + audit_logs ONLY (Strict Policy) ===
    await db.users.create_index("email", unique=True)
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
