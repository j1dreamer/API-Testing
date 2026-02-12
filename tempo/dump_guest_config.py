import asyncio
import json
from src.database.connection import get_database, connect_to_mongo

async def check():
    await connect_to_mongo()
    db = get_database()
    # Find any network config with Captive Portal enabled
    cursor = db.raw_logs.find({
        "url": {"$regex": "networksSummary"},
        "response_body_text": {"$regex": "isCaptivePortalEnabled.:.true"}
    }).sort("timestamp", -1).limit(1)
    
    async for doc in cursor:
        print(f"Timestamp: {doc['timestamp']}")
        body = doc.get("response_body")
        if isinstance(body, dict) and "elements" in body:
            for net in body["elements"]:
                if net.get("isCaptivePortalEnabled"):
                    print("Found Guest Network Config:")
                    print(json.dumps(net, indent=2))
                    return
        elif isinstance(body, list):
             for net in body:
                if net.get("isCaptivePortalEnabled"):
                    print("Found Guest Network Config:")
                    print(json.dumps(net, indent=2))
                    return
        else:
             print("Found body (not list/elements):")
             print(json.dumps(body, indent=2))

if __name__ == "__main__":
    asyncio.run(check())
