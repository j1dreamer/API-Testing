from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
import json
import asyncio
from datetime import datetime, timezone
from app.database.auth_crud import insert_audit_log
from app.core import replay_service

class GlobalLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Only log state-changing methods for config/sync operations
        if request.method not in ["POST", "PUT", "PATCH", "DELETE"]:
            return await call_next(request)
            
        endpoint_path = str(request.url.path)
        
        # Define the specific config/clone endpoints we want to log
        config_endpoints = {
            "/api/cloner/apply": "Clone Complete Config",
            "/api/cloner/sync-password": "Update PSK (Password)",
            "/api/cloner/sync-config": "Sync SSID Config",
            "/api/cloner/sync-delete": "Delete SSID",
            "/api/cloner/sync-create": "Create SSID"
        }
        
        # Skip logging if it's not a config endpoint and determine the friendly action name
        action_name = "API_CALL"
        is_config_action = False
        
        for ep, friendly_name in config_endpoints.items():
            if endpoint_path.endswith(ep) or endpoint_path == ep:
                action_name = friendly_name
                is_config_action = True
                break
                
        if not is_config_action:
            return await call_next(request)

        # 1. Try to identify actor from Request Token
        auth_header = request.headers.get("Authorization")
        actor_email = "anonymous"
        if auth_header and auth_header.startswith("Bearer "):
            try:
                token = auth_header.split(" ")[1]
                from app.database.connection import get_database
                db = get_database()
                session = await db.auth_sessions.find_one({"token_value": token})
                if session and session.get("email"):
                    actor_email = session.get("email")
            except Exception:
                pass

        # 2. Extract basic info
        method = request.method
        endpoint = str(request.url.path)
        ip_address = request.client.host if request.client else None

        # 3. Read request body safely
        body_bytes = await request.body()
        payload_data = None
        if body_bytes:
            try:
                payload_data = json.loads(body_bytes.decode('utf-8'))
                # Completely remove sensitive fields
                if isinstance(payload_data, dict):
                    keys_to_delete = [
                        k for k in payload_data.keys() 
                        if "password" in k.lower() or "token" in k.lower()
                    ]
                    for key in keys_to_delete:
                        del payload_data[key]
            except Exception:
                payload_data = {"raw": body_bytes.decode('utf-8', errors='ignore')}

        # Since we consumed the body, we must create a new receive fn for the stream to read it again
        async def receive():
            return {"type": "http.request", "body": body_bytes}

        request._receive = receive

        # 4. Proceed with the request
        try:
            response = await call_next(request)
            status_code = response.status_code
        except Exception as e:
            status_code = 500
            raise e
        finally:
            # 5. Save audit log asynchronously using asyncio.create_task (Fire and Forget)
            log_entry = {
                "timestamp": datetime.now(timezone.utc),
                "actor_email": actor_email,
                "method": method,
                "endpoint": endpoint,
                "payload": payload_data,
                "ip_address": ip_address,
                "statusCode": status_code,
                "action": action_name
            }
            asyncio.create_task(insert_audit_log(log_entry))

        return response
