from src.database.connection import get_database, connect_to_mongo
import asyncio
import json

async def q():
    await connect_to_mongo()
    db = get_database()
    doc = await db.raw_logs.find_one({"response_body_text": {"$regex": "Hoang-Guest-2"}})
    if doc:
        # Print keys and some samples
        print(f"Keys: {list(doc.keys())}")
        print("-" * 20)
        # Sample of request/response
        for k in ["url", "method", "status_code", "request_body", "response_body", "request_content", "response_content"]:
            if k in doc:
                val = doc[k]
                if isinstance(val, (dict, list)):
                    print(f"{k}: {json.dumps(val, indent=2)[:500]}...")
                else:
                    print(f"{k}: {val}")
    else:
        print("None")

if __name__ == "__main__":
    asyncio.run(q())
