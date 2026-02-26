from pymongo import MongoClient
import json

client = MongoClient("mongodb://localhost:27017")
db = client["aruba_capture"]

doc = db.raw_logs.find_one({"url": "https://portal.instant-on.hpe.com/api/sites"})

if doc:
    body = doc.get("response_body")
    if isinstance(body, dict) and "elements" in body:
        site = body["elements"][0]
        with open("site_sample.json", "w") as f:
            json.dump(site, f, indent=2)
        print("Saved to site_sample.json")
