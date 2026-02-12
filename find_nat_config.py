from src.database.connection import get_database, connect_to_mongo
import asyncio
import json

async def q():
    await connect_to_mongo()
    db = get_database()
    # Find any network config with NAT mode
    cursor = db.raw_logs.find({
        "url": {"$regex": "networksSummary"},
        "response_body_text": {"$regex": "NAT"}
    }).sort("timestamp", -1).limit(5)
    
    async for doc in cursor:
        body = doc.get("response_body")
        if isinstance(body, dict) and "elements" in body:
            for net in body["elements"]:
                if net.get("ipAddressingMode") == "NAT":
                    print("Found NAT Network Config:")
                    print(json.dumps(net, indent=2))
                    return
        elif isinstance(body, list):
             for net in body:
                if net.get("ipAddressingMode") == "NAT":
                    print("Found NAT Network Config:")
                    print(json.dumps(net, indent=2))
                    return

if __name__ == "__main__":
    asyncio.run(q())
