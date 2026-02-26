from pymongo import MongoClient

client = MongoClient("mongodb://localhost:27017")
db = client["aruba_capture"]

print(f"Total logs: {db.raw_logs.count_documents({})}")
urls = db.raw_logs.distinct("url")
site_urls = [u for u in urls if "sites" in u]
print("Some site URLs:", site_urls[:10])

target_url = None
for u in site_urls:
    if "api" in u and "sites" in u and "networksSummary" not in u:
        target_url = u
        break

if target_url:
    print(f"\nLooking at URL {target_url}...")
    doc = db.raw_logs.find_one({"url": target_url})
    if doc:
        body = doc.get("response_body")
        if isinstance(body, dict) and "elements" in body:
            elements = body["elements"]
            if elements:
                print("KEYS inside first element:", list(elements[0].keys()))
                permissions = {k: v for k, v in elements[0].items() if "perm" in k.lower() or "role" in k.lower() or "admin" in k.lower()}
                print("Permission/Role fields:", permissions)
        elif isinstance(body, list):
            if body:
                print("KEYS inside first element:", list(body[0].keys()))
                permissions = {k: v for k, v in body[0].items() if "perm" in k.lower() or "role" in k.lower() or "admin" in k.lower()}
                print("Permission/Role fields:", permissions)
