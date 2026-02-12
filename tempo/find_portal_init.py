from src.database.connection import get_database, connect_to_mongo
import asyncio
import json

async def q():
    await connect_to_mongo()
    db = get_database()
    # Find any PUT to guestPortalSettings that resulted in success
    cursor = db.raw_logs.find({
        "url": {"$regex": "guestPortalSettings"},
        "method": "PUT",
        "status_code": 200
    }).sort("timestamp", 1).limit(5) # Look at OLDEST first to see initialization
    
    async for doc in cursor:
        print(f"Timestamp: {doc['timestamp']}")
        body = doc.get("request_body")
        if body:
             print(json.dumps(body, indent=2))
        print("-" * 20)

if __name__ == "__main__":
    asyncio.run(q())
