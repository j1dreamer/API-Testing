import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import json

async def main():
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client["AITC_Inspector"]
    cursor = db.raw_logs.find({"url": {"$regex": "api/sites"}}).limit(5)
    logs = await cursor.to_list(5)
    for log in logs:
        print("URL:", log.get("url"))
        body = log.get("response_body", {})
        if "elements" in body and len(body["elements"]) > 0:
            print("First Element sample:", json.dumps(body["elements"][0], indent=2))
        elif isinstance(body, list) and len(body) > 0:
            print("First Element sample:", json.dumps(body[0], indent=2))
        else:
            print("Body keys:", list(body.keys()) if isinstance(body, dict) else type(body))

if __name__ == "__main__":
    asyncio.run(main())
