import asyncio
import json
from src.database.connection import get_database, connect_to_mongo

async def check():
    await connect_to_mongo()
    db = get_database()
    # Find any log with Hoang-Guest-2
    print("Searching for any log with Hoang-Guest-2...")
    cursor = db.raw_logs.find({
        "response_body_text": {"$regex": "Hoang-Guest-2"}
    }).sort("timestamp", -1).limit(5)
    
    async for doc in cursor:
        print(f"[{doc['status_code']}] URL: {doc['url']}")
        rb = doc.get("response_body")
        print(f"Response Body: {json.dumps(rb, indent=2)[:2000] if rb else 'None'}")
        print("-" * 40)

if __name__ == "__main__":
    asyncio.run(check())
