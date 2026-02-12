import asyncio
import json
from src.database.connection import get_database, connect_to_mongo

async def check():
    await connect_to_mongo()
    db = get_database()
    # Find networksSummary containing Hoang-Guest-2
    cursor = db.raw_logs.find({
        "url": {"$regex": "networksSummary"},
        "response_body_text": {"$regex": "Hoang-Guest-2"}
    }).sort("timestamp", -1).limit(1)
    
    async for doc in cursor:
        body = doc.get("response_body")
        net_to_dump = None
        if isinstance(body, dict) and "elements" in body:
            for net in body["elements"]:
                if net.get("isCaptivePortalEnabled"):
                    net_to_dump = net
                    break
        elif isinstance(body, list):
             for net in body:
                if net.get("isCaptivePortalEnabled"):
                    net_to_dump = net
                    break
        
        if net_to_dump:
            with open("guest_config_dump.json", "w", encoding="utf-8") as f:
                json.dump(net_to_dump, f, indent=2)
            print("Successfully dumped Hoang-Guest-2 config to guest_config_dump.json")
            return
        else:
            print("No captive portal network found in this record.")

if __name__ == "__main__":
    asyncio.run(check())
