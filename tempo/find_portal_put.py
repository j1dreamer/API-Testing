from src.database.connection import get_database, connect_to_mongo
import asyncio
import json

async def q():
    await connect_to_mongo()
    db = get_database()
    # Find any PUT to guestPortalSettings
    cursor = db.raw_logs.find({
        "url": {"$regex": "guestPortalSettings"},
        "method": "PUT",
        "status_code": 200
    }).sort("timestamp", -1).limit(5)
    
    async for doc in cursor:
        print(f"Timestamp: {doc['timestamp']}")
        req = doc.get("request_body")
        if req:
            print("Request Payload:")
            print(json.dumps(req, indent=2))
        print("-" * 40)

if __name__ == "__main__":
    asyncio.run(q())
