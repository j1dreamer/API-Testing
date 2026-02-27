import httpx
import re
import logging
import json
from typing import Dict, Any, List

logger = logging.getLogger(__name__)

class ArubaAuthSimulator:
    """
    Simulates the Aruba Instant On header/token exchange flow.
    """
    def __init__(self):
        self.client = httpx.AsyncClient(
            verify=False, 
            follow_redirects=True,
            timeout=30.0,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
        )
        self.logs = []
        self.base_url = "https://portal.instant-on.hpe.com"
        # Known endpoints
        self.login_url = "https://portal.instant-on.hpe.com/"  # Changed from /login (which 404s) to root
        self.auth_url = "https://portal.instant-on.hpe.com/api/v1/auth" # Hypothetical
    
    def _log(self, step: str, message: str, data: Any = None):
        """Add a log entry."""
        entry = {
            "step": step,
            "message": message,
            "data": str(data) if data else None,
            "timestamp":  __import__("datetime").datetime.now().isoformat()
        }
        self.logs.append(entry)
        logger.info(f"[{step}] {message}")

    async def close(self):
        await self.client.aclose()

    async def _parse_json_safely(self, response) -> Dict:
        try:
            return response.json()
        except Exception:
            return {}

    async def execute_login(self, username, password) -> List[Dict]:
        """
        Executes the full login flow:
        1. GET Login Page -> Extract Context (CSRF, ClientID, etc.)
        2. POST Credentials -> Get 120s Token
        3. Exchange Token -> Get 1799s Access Token
        """
        try:
            # --- STEP 1: GET Login Page ---
            self._log("Step 1", "Fetching Login Page (RELOADED) to extract context...")
            resp = await self.client.get(self.login_url)
            self._log("Step 1", f"Login Page Status: {resp.status_code}")
            
            if resp.status_code != 200:
                self._log("Step 1", f"Failed body: {resp.text[:200]}")
                raise Exception(f"Failed to load login page. Status: {resp.status_code}")

            # Extract dynamic secrets (Regex for common patterns)
            html = resp.text
            context = {}
            
            # Example patterns to look for:
            client_id_match = re.search(r'client_id["\']?\s*[:=]\s*["\']([^"\']+)["\']', html, re.IGNORECASE)
            csrf_match = re.search(r'csrf["\']?\s*[:=]\s*["\']([^"\']+)["\']', html, re.IGNORECASE)
            
            if client_id_match:
                context['client_id'] = client_id_match.group(1)
                self._log("Step 1", f"Extracted client_id: {context['client_id']}")
            
            if csrf_match:
                context['csrf'] = csrf_match.group(1)
                self._log("Step 1", f"Extracted CSRF: {context['csrf']}")

            # Check cookies
            cookies = dict(resp.cookies)
            self._log("Step 1", f"Cookies received: {list(cookies.keys())}")

            # --- STEP 2: POST Credentials ---
            # Simple heuristic for form action
            action_match = re.search(r'<form[^>]+action=["\']([^"\']+)["\']', html, re.IGNORECASE)
            
            # If no form found, assume API endpoint pattern which is common for SPAs
            login_post_url = action_match.group(1) if action_match else "/api/v1/auth/login"
            
            if not login_post_url.startswith("http"):
                login_post_url = self.base_url + login_post_url
            
            self._log("Step 2", f"Posting credentials to {login_post_url}...")
            
            payload = {
                "username": username,
                "password": password,
            }
            if 'client_id' in context:
                payload['client_id'] = context['client_id']
                
            headers = {}
            if 'csrf' in context:
                headers['X-CSRF-Token'] = context['csrf']

            resp2 = await self.client.post(login_post_url, json=payload, headers=headers)
            self._log("Step 2", f"Auth Response Status: {resp2.status_code}")
            
            response_data = await self._parse_json_safely(resp2)
            
            if resp2.status_code != 200:
                 self._log("Step 2", f"Error body: {resp2.text[:200]}")

            token_120s = None
            if "access_token" in response_data:
                token_120s = response_data["access_token"]
                expires_in = response_data.get("expires_in")
                self._log("Step 2", f"Token received. Expires in: {expires_in}s")
                
                if expires_in and int(expires_in) <= 120:
                     self._log("Step 2", "Confirmed 120s Session Token.")
                else:
                     self._log("Step 2", "Received token, but expiry doesn't match 120s pattern.")

            elif resp2.status_code == 302:
                # Handle redirect flow if applicable
                self._log("Step 2", f"Redirected to {resp2.headers.get('Location')}")
            
            if not token_120s:
                 self._log("Step 2", "No access token found in step 2 response.", response_data)
                 # We continue for debugging, or return
                 # return self.logs

            # --- STEP 3: Exchange for 1799s Token ---
            if token_120s:
                self._log("Step 3", "Exchanging 120s token for full Access Token...")
                
                exchange_url = f"{self.base_url}/api/v1/oauth/token" 
                
                exchange_payload = {
                    "grant_type": "urn:ietf:params:oauth:grant-type:token-exchange",
                    "subject_token": token_120s,
                    "subject_token_type": "urn:ietf:params:oauth:token-type:access_token",
                    "client_id": context.get("client_id", "unknown_client_id") 
                }
                
                resp3 = await self.client.post(exchange_url, json=exchange_payload)
                self._log("Step 3", f"Exchange Response Status: {resp3.status_code}")
                
                final_data = await self._parse_json_safely(resp3)
                
                if "access_token" in final_data:
                    final_token = final_data["access_token"]
                    final_expires = final_data.get("expires_in")
                    self._log("Step 3", f"Success! Final Token: Bearer {final_token[:10]}... (Expires: {final_expires}s)")
                else:
                    self._log("Step 3", "Exchange failed.", final_data)

        except Exception as e:
            self._log("Error", f"Exception during flow: {str(e)}")
        
        return self.logs
