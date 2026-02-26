import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client["AITC_Inspector"]
    # Look for the GET api/sites request
    cursor = db.raw_logs.find({"url": {"$regex": "api/sites$"}}).limit(2)
    logs = await cursor.to_list(2)
    for log in logs:
        print("URL:", log.get("url"))
        print("Body elements count:", len(log.get("response_body", {}).get("elements", [])))
        if log.get("response_body", {}).get("elements"):
            print("First Element sample:", log["response_body"]["elements"][0])

if __name__ == "__main__":
    asyncio.run(main())
