import httpx
import sys
import asyncio

BASE_URL = "http://localhost:8000"
PROTECTED_ENDPOINT = "/api/capture/logs" # Assuming this exists and is protected
AUTH_HEADER = {"X-Internal-App-Auth": "secret-internal-key-change-me"}

async def test_auth():
    print(f"Testing Auth on {BASE_URL}")
    
    async with httpx.AsyncClient() as client:
        # 1. Health Check
        try:
            resp = await client.get(f"{BASE_URL}/health")
            print(f"Health Check: {resp.status_code} (Expected 200)")
        except Exception as e:
            print(f"Health Check Failed: {e}")
            return

        # 2. Unauthorized Request
        try:
            resp = await client.get(f"{BASE_URL}{PROTECTED_ENDPOINT}")
            print(f"Unauthorized Request: {resp.status_code} (Expected 403)")
            if resp.status_code == 403:
                print("PASS: Unauthorized request blocked.")
            else:
                print(f"FAIL: Unauthorized request got {resp.status_code}")
        except Exception as e:
            print(f"Unauthorized Request Failed: {e}")

        # 3. Authorized Request
        try:
            resp = await client.get(f"{BASE_URL}{PROTECTED_ENDPOINT}", headers=AUTH_HEADER)
            print(f"Authorized Request: {resp.status_code} (Expected 200 or 404/401 but NOT 403)")
            if resp.status_code != 403:
                print("PASS: Authorized request allowed through middleware.")
            else:
                print("FAIL: Authorized request blocked.")
        except Exception as e:
            print(f"Authorized Request Failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_auth())
