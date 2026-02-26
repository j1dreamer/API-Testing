from pymongo import MongoClient
import json

client = MongoClient("mongodb://localhost:27017")
db = client["aruba_capture"]

target_url = "https://portal.instant-on.hpe.com/api/sites"
doc = db.raw_logs.find_one({"url": {"$regex": "api/sites$"}})

if doc:
    body = doc.get("response_body")
    if isinstance(body, dict) and "elements" in body:
        for element in body["elements"][:3]:
            print(f"Site: {element.get('name')}")
            print(f"Role: {element.get('role')}")
            print(f"Permissions: {element.get('permissions')}")
            print("-" * 20)
