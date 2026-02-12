import logging
from datetime import datetime, timezone
import json
from src.database.models import CapturePayload
from src.database.crud import upsert_auth_session, get_latest_auth
from src.core.websocket.manager import manager

logger = logging.getLogger(__name__)

async def analyze_traffic_for_auth(payload: CapturePayload):
    """
    Analyze captured traffic to detect Aruba authentication flows.
    """
    try:
        # Check Response for Tokens
        # We look for JSON responses containing 'access_token' and 'expires_in'
        response_data = payload.response_body
        
        # Ensure it's a dict (it might be a string in some cases)
        if isinstance(response_data, str):
            try:
                response_data = json.loads(response_data)
            except:
                pass

        if isinstance(response_data, dict) and "access_token" in response_data:
            expires_in = response_data.get("expires_in")
            access_token = response_data.get("access_token")
            token_type = response_data.get("token_type", "Bearer")
            
            if expires_in:
                expires_in_int = int(expires_in)
                
                # Logic 1: 120s Session Token
                if 100 < expires_in_int < 150:
                    logger.info(f"Captured 120s Pre-Auth Token from {payload.url}")
                    await upsert_auth_session(
                        token_type="pre-auth-bearer",
                        token_value=access_token,
                        expires_in=expires_in_int,
                        source_url=payload.url,
                        headers_snapshot=payload.request_headers
                    )
                    await manager.broadcast({
                        "type": "AUTH_EVENT",
                        "data": {"message": "Captured 120s Pre-Auth Token", "step": "1"}
                    })

                # Logic 2: 1799s Access Token (Full Session)
                elif expires_in_int > 1700:
                    logger.info(f"Captured Full Access Token from {payload.url}")
                    await upsert_auth_session(
                        token_type="bearer",
                        token_value=access_token,
                        expires_in=expires_in_int,
                        source_url=payload.url,
                        headers_snapshot=payload.request_headers
                    )
                    await manager.broadcast({
                        "type": "AUTH_EVENT",
                        "data": {"message": "Captured Full Access Token (1799s)", "step": "2"}
                    })

        # Check Request for Exchange (Grant Type)
        # This is purely for logging/mapping the flow
        request_data = payload.request_body
        if isinstance(request_data, str):
            try:
                request_data = json.loads(request_data)
            except:
                pass

        if isinstance(request_data, dict) and request_data.get("grant_type") == "urn:ietf:params:oauth:grant-type:token-exchange":
            logger.info(f"Detected Token Exchange Request at {payload.url}")
            # We could extract the subject_token here if needed
            
    except Exception as e:
        logger.error(f"Error analyzing Auth traffic: {e}")

