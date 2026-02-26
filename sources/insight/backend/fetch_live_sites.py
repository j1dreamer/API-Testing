import requests
import json

try:
    res = requests.get('http://localhost:8001/api/cloner/live-sites')
    if res.status_code == 200:
        sites = res.json()
        if sites:
            print(json.dumps(sites[0], indent=2))
        else:
            print("No sites found")
    else:
        print(f"Error {res.status_code}: {res.text}")
except Exception as e:
    print(f"Connection failed: {e}")
