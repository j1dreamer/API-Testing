import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import json

async def run():
    client = AsyncIOMotorClient('mongodb://localhost:27017')
    db = client['ArubaInsights']
    
    # Let's find any POST request related to networks
    cursor = db.raw_logs.find({
        "method": "POST",
        "url": {"$regex": "networks", "$options": "i"}
    }).limit(10)
    
    logs = await cursor.to_list(length=10)
    for log in logs:
        print(f"URL: {log['url']}")
        print(f"Status: {log.get('status_code')}")
        print(f"Payload: {json.dumps(log.get('request_body', {}), indent=2)}")
        print("-" * 40)

    # Let's also check for POST requests overall
    print("ALL POST REQUESTS RECENTLY:")
    cursor2 = db.raw_logs.find({
        "method": "POST",
    }).sort("timestamp", -1).limit(10)
    logs2 = await cursor2.to_list(length=10)
    for log in logs2:
        print(f"URL: {log['url']}")
        print(f"Status: {log.get('status_code')}")
        print("-" * 40)

if __name__ == '__main__':
    asyncio.run(run())
