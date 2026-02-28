import httpx
import json
from typing import Optional, Dict, Any
from urllib.parse import urlparse
from app.database.crud import get_all_auth_sessions, delete_all_auth_sessions
from app.config import MONGODB_URL # Not used directly but ensured config loaded

# Constants
STRICT_ORIGIN = "https://portal.instant-on.hpe.com"
STRICT_REFERER = "https://portal.instant-on.hpe.com/"
CHROME_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
DEFAULT_BASE_URL = "https://portal.instant-on.hpe.com"

class ArubaService:
    def __init__(self):
        pass

    async def _get_auth_headers(self, aruba_token: Optional[str]) -> Dict[str, str]:
        """Prepare headers based on the provided token."""
        headers = {}
        if aruba_token:
            headers["Authorization"] = f"Bearer {aruba_token}"
        return headers

    async def call_api(
        self, 
        method: str, 
        endpoint: str, 
        aruba_token: Optional[str] = None,
        data: Any = None, 
        json_data: Any = None,
        headers: Optional[Dict[str, str]] = None,
        target_domain: Optional[str] = None
    ) -> httpx.Response:
        """
        Executes a request to the Aruba API with automatic auth injection and header spoofing.
        """
        base_url = f"https://{target_domain}" if target_domain else DEFAULT_BASE_URL
        if not endpoint.startswith("http"):
             url = f"{base_url}/{endpoint.lstrip('/')}"
        else:
            url = endpoint
        
        # Prepare Auth
        auth_headers = await self._get_auth_headers(aruba_token)
        
        # Prepare Request Headers
        final_headers = {
            "User-Agent": CHROME_USER_AGENT,
            "Accept": "application/json, text/plain, */*",
        }
        final_headers.update(auth_headers)
        if headers:
            final_headers.update(headers)

        # Dynamic Header Spoofing
        parsed_target = urlparse(url)
        target_host = parsed_target.netloc
        
        origin_val = f"{parsed_target.scheme}://{target_host}"
        referer_val = f"{origin_val}/"

        final_headers["Origin"] = origin_val
        final_headers["Referer"] = referer_val
        final_headers["Host"] = target_host

        print(f"[ARUBA SERVICE] Final URL: {url}")
        print(f"[ARUBA SERVICE] Target Host: {target_host}")
        token_present = "Yes" if final_headers.get("Authorization") or final_headers.get("authorization") else "No"
        print(f"[ARUBA SERVICE] Token Presence: {token_present}")

        # Execute Request
        async with httpx.AsyncClient(
            timeout=30.0,
            follow_redirects=True,
            verify=False
        ) as client:
            resp = await client.request(
                method=method,
                url=url,
                headers=final_headers,
                data=data,
                json=json_data
            )
            
            # If we get unauthorized
            if resp.status_code in [401, 403]:
                print(f"[ARUBA SERVICE] Received {resp.status_code}. Token might be expired.")
            
            return resp

# Singleton instance
aruba_service = ArubaService()
