import httpx
import json
from typing import Optional, Dict, Any
from urllib.parse import urlparse
from app.database.crud import get_all_auth_sessions
from app.config import MONGODB_URL # Not used directly but ensured config loaded

# Constants
STRICT_ORIGIN = "https://portal.instant-on.hpe.com"
STRICT_REFERER = "https://portal.instant-on.hpe.com/"
CHROME_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
DEFAULT_BASE_URL = "https://portal.instant-on.hpe.com"

class ArubaService:
    def __init__(self):
        self.session_cookies: Dict[str, str] = {}

    async def _get_auth_headers_and_cookies(self) -> (Dict[str, str], Dict[str, str]):
        """
        Retrieves the latest authentication tokens from the database and merges them 
        with any in-memory session cookies.
        """
        headers = {}
        cookies = self.session_cookies.copy()

        # Load from Database (Baseline)
        all_sessions = await get_all_auth_sessions()
        latest_bearer = next((s for s in all_sessions if s.get("token_type") == "bearer"), None)

        if latest_bearer:
            # Inject Bearer Token
            token_val = latest_bearer.get("token_value")
            if token_val:
                headers["Authorization"] = f"Bearer {token_val}"

            # Inject CSRF Token
            snapshot = latest_bearer.get("headers_snapshot", {})
            csrf_val = None
            
            # Check dedicated sessions
            csrf_session = next((s for s in all_sessions if s.get("token_type") == "csrf"), None)
            if csrf_session:
                csrf_val = csrf_session.get("token_value")
            
            # Check snapshot
            if not csrf_val:
                for k, v in snapshot.items():
                    if k.lower() in ["x-csrf-token", "x-xsrf-token", "csrf-token"]:
                        csrf_val = v
                        break
            if csrf_val:
                headers["X-CSRF-Token"] = csrf_val

            # Load snapshot cookies
            if "Cookie" in snapshot:
                for item in snapshot["Cookie"].split(";"):
                    if "=" in item:
                        k, v = item.split("=", 1)
                        cookies[k.strip()] = v.strip()

        return headers, cookies

    async def call_api(
        self, 
        method: str, 
        endpoint: str, 
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
        auth_headers, auth_cookies = await self._get_auth_headers_and_cookies()
        
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
        is_sso = "sso.arubainstanton.com" in url or "google.com" in url
        
        if is_sso:
            origin_val = STRICT_ORIGIN
            referer_val = STRICT_REFERER
        else:
            origin_val = f"{parsed_target.scheme}://{parsed_target.netloc}"
            referer_val = f"{origin_val}/"

        final_headers["Origin"] = origin_val
        final_headers["Referer"] = referer_val
        final_headers["Host"] = parsed_target.netloc

        # Execute Request
        async with httpx.AsyncClient(
            timeout=30.0,
            follow_redirects=True,
            verify=False,
            cookies=auth_cookies
        ) as client:
            resp = await client.request(
                method=method,
                url=url,
                headers=final_headers,
                data=data,
                json=json_data
            )
            
            # Update session cookies from response
            if resp.cookies:
                for cookie in resp.cookies.jar:
                    self.session_cookies[cookie.name] = cookie.value
            
            return resp

# Singleton instance
aruba_service = ArubaService()
