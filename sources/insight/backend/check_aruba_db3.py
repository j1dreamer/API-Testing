from pymongo import MongoClient

client = MongoClient("mongodb://localhost:27017")
db = client["aruba_capture"]

doc = db.raw_logs.find_one({"url": "https://portal.instant-on.hpe.com/api/sites"})

if doc:
    body = doc.get("response_body")
    if isinstance(body, dict) and "elements" in body:
        site = body["elements"][0]
        print("KEYS:", list(site.keys()))
        print("===")
        for k in ["id", "siteId", "name", "siteName", "role", "permissions", "accessLevel", "admin", "rights"]:
            if k in site:
                print(f"{k}: {site[k]}")
        
        # also check nested objects
        for k, v in site.items():
            if isinstance(v, dict) or isinstance(v, list):
                print(f"{k}: {type(v)}")
