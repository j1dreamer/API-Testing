from src.database.connection import get_database, connect_to_mongo
import asyncio
import json

async def q():
    await connect_to_mongo()
    db = get_database()
    # Find any PUT to guestPortalSettings
    cursor = db.raw_logs.find({
        "url": {"$regex": "guestPortalSettings"},
        "method": "PUT"
    }).sort("timestamp", -1).limit(5)
    
    async for doc in cursor:
        print(f"URL: {doc['url']} | Status: {doc.get('status_code')}")
        body = doc.get("request_body")
        if body:
            print("Payload Keys:", list(body.keys()))
            # Specifically look for enablement flags
            for k in ["isEnabled", "isCaptivePortalEnabled", "guestPortalType"]:
                if k in body:
                    print(f"  {k}: {body[k]}")
        print("-" * 20)

if __name__ == "__main__":
    asyncio.run(q())
