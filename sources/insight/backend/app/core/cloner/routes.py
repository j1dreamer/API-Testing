from fastapi import APIRouter, HTTPException, Body, Response, Request
from typing import List, Dict, Any
from app.core.cloner_service import (
    get_captured_sites, 
    get_live_account_sites, 
    fetch_site_config_live,
    fetch_site_config, 
    apply_config_to_site,
    apply_config_live,
    get_site_ssids,
    sync_ssids_passwords,
    sync_ssids_create
)
from app.core.replay_service import replay_login

router = APIRouter(prefix="/api/cloner", tags=["Site Cloner"])

@router.get("/sites")
async def list_sites():
    """Get unique sites found in captured logs."""
    return await get_captured_sites()

@router.get("/live-sites")
async def list_live_sites(request: Request):
    """Get all sites for the provided token."""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    token = auth_header.split(" ")[1]
    return await get_live_account_sites(token)

@router.get("/target-sites")
async def list_target_sites(request: Request):
    """Alias for /live-sites."""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    token = auth_header.split(" ")[1]
    return await get_live_account_sites(token)

@router.get("/auth-session")
async def cloner_auth_session(request: Request, response: Response):
    """Check if we have an active session for the cloner based on the request token."""
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return {"token_value": None}
    
    token = auth_header.split(" ")[1]
    
    # Find session in database
    from app.database.connection import get_database
    db = get_database()
    session = await db.auth_sessions.find_one({"token_value": token})
    
    if session:
        role = "guest"
        email = session.get("email")
        if email:
            try:
                from app.database.auth_crud import get_user_by_email
                user = await get_user_by_email(email)
                if user:
                    role = user.get("role", "guest")
            except Exception:
                pass
            
        # Optional: Calculate remaining time
        expires_in = session.get("expires_in", 0)
        captured_at = session.get("captured_at")
        if captured_at:
            if captured_at.tzinfo is None:
                from datetime import timezone
                captured_at = captured_at.replace(tzinfo=timezone.utc)
            from datetime import datetime, timezone
            elapsed = (datetime.now(timezone.utc) - captured_at).total_seconds()
            expires_in = max(0, int(expires_in - elapsed))

        return {
            "token_value": token,
            "expires_in": expires_in,
            "role": role,
            "email": email
        }
    
    return {"token_value": None}

@router.post("/login")
async def cloner_login(
    username: str = Body(..., embed=True),
    password: str = Body(..., embed=True)
):
    """Trigger a portal login to refresh the ACTIVE_TOKEN."""
    from app.core.allowed_emails import is_email_allowed
    if not is_email_allowed(username):
        raise HTTPException(status_code=401, detail="Email không có quyền truy cập vào hệ thống Insight.")
        
    try:
        from app.core.replay_service import replay_login
        import app.core.replay_service as rs
        token = await replay_login(username, password)
        if token.get("status") == "error":
            raise HTTPException(status_code=401, detail=token.get("message", "Login failed"))
        
        role = "guest"
        try:
            from app.database.auth_crud import get_user_by_email
            user = await get_user_by_email(username)
            if user:
                role = user.get("role", "guest")
        except Exception:
            pass
            
        return {"status": "success", "token_type": "Bearer", "expires_in": token.get("expires_in"), "role": role}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))

@router.post("/logout")
async def cloner_logout(request: Request):
    """Clear the session for the current token."""
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        from app.database.crud import delete_auth_session_by_token
        await delete_auth_session_by_token(token)
    
    return {"status": "success"}

@router.post("/preview")
async def preview_clone(
    request: Request,
    site_id: str = Body(..., embed=True),
    source: str = Body("captured", embed=True)
):
    """Convert site config into a list of cloneable operations."""
    if source == "live":
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Unauthorized")
        token = auth_header.split(" ")[1]
        config = await fetch_site_config_live(site_id, token)
    else:
        config = await fetch_site_config(site_id)

    if not config or "error" in config:
        raise HTTPException(status_code=404, detail=config.get("error") if config else "Source config not found")
    
    # Generate list of ops
    ops = await apply_config_to_site("preview-only", config)
    return {"site_id": site_id, "source": source, "operations": ops}

@router.post("/apply")
async def execute_clone(
    request: Request,
    target_site_ids: List[str] = Body(None),
    target_site_id: str = Body(None),
    operations: List[Dict[str, Any]] = Body(...)
):
    """Execute cloning by pushing configurations."""
    import asyncio
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    token = auth_header.split(" ")[1]
    
    # Support both single siteId (backward compatibility) and multiple siteIds
    site_ids = target_site_ids or ([target_site_id] if target_site_id else [])
    
    if not site_ids:
        raise HTTPException(status_code=400, detail="No target site IDs provided.")

    # Execute all clones in parallel
    tasks = [apply_config_live(sid, operations, token) for sid in site_ids]
    execution_results = await asyncio.gather(*tasks)

    # Flatten results for the UI to consume easily per site
    batch_report = {}
    for sid, result in zip(site_ids, execution_results):
        batch_report[sid] = result

    return {
        "status": "success",
        "results": batch_report
    }

@router.get("/sites/{site_id}/ssids")
async def fetch_site_ssids_api(site_id: str, request: Request):
    """Get list of wireless networks for a site"""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    token = auth_header.split(" ")[1]
    return await get_site_ssids(site_id, token)

@router.post("/sync-password")
async def execute_password_sync(
    request: Request,
    source_network_name: str = Body(...),
    new_password: str = Body(...),
    target_site_ids: List[str] = Body(...)
):
    """Batch update password for matching SSIDs"""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    token = auth_header.split(" ")[1]

    if not target_site_ids:
        raise HTTPException(status_code=400, detail="No target site IDs provided.")
    
    results = await sync_ssids_passwords(source_network_name, new_password, target_site_ids, token)
    return {
        "status": "success",
        "results": results
    }

@router.post("/sync-config")
async def execute_config_sync(
    request: Request,
    source_site_id: str = Body(...),
    source_network_name: str = Body(...),
    target_site_ids: List[str] = Body(...)
):
    """Batch deep sync configuration for matching SSIDs from a source site"""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    token = auth_header.split(" ")[1]

    from app.core import cloner_service
    if not target_site_ids:
        raise HTTPException(status_code=400, detail="No target site IDs provided.")
    
    results = await cloner_service.sync_ssids_config(source_site_id, source_network_name, target_site_ids, token)
    return {
        "status": "success",
        "results": results
    }

@router.post("/sync-delete")
async def execute_delete_sync(
    request: Request,
    source_network_name: str = Body(...),
    target_site_ids: List[str] = Body(...)
):
    """Batch delete matching SSIDs across target sites"""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    token = auth_header.split(" ")[1]

    from app.core import cloner_service
    if not target_site_ids:
        raise HTTPException(status_code=400, detail="No target site IDs provided.")
    
    results = await cloner_service.sync_ssids_delete(source_network_name, target_site_ids, token)
    return {
        "status": "success",
        "results": results
    }

@router.post("/sync-create")
async def execute_create_sync(
    request: Request,
    network_name: str = Body(...),
    network_type: str = Body(...),
    security: str = Body(...),
    password: str = Body(""),
    is_hidden: bool = Body(False),
    is_wifi6_enabled: bool = Body(True),
    band_24: bool = Body(True),
    band_5: bool = Body(True),
    band_6: bool = Body(True),
    client_isolation: bool = Body(False),
    vlan_id: int = Body(None),
    target_site_ids: List[str] = Body(...)
):
    """Batch create a new SSID across target sites with advanced capabilities"""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    token = auth_header.split(" ")[1]

    from app.core import cloner_service
    if not target_site_ids:
        raise HTTPException(status_code=400, detail="No target site IDs provided.")
    
    advanced_options = {
        "is_hidden": is_hidden,
        "is_wifi6_enabled": is_wifi6_enabled,
        "band_24": band_24,
        "band_5": band_5,
        "band_6": band_6,
        "client_isolation": client_isolation,
        "vlan_id": vlan_id
    }
    
    results = await cloner_service.sync_ssids_create(
        network_name, network_type, security, password, advanced_options, target_site_ids, token
    )
    return {
        "status": "success",
        "results": results
    }

@router.get("/site-overview/{site_id}")
async def get_site_overview(site_id: str, request: Request):
    """Fetch network overview for a specific site."""
    from app.core import cloner_service
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    token = auth_header.split(" ")[1]
    
    try:
        config = await cloner_service.fetch_site_config_live(site_id, token)
        if "error" in config:
            raise HTTPException(status_code=400, detail=config["error"])
            
        networks = config.get("networks", [])
        if isinstance(networks, dict):
            networks = networks.get("elements", [])
            
        network_details = []
        for net in networks:
            network_details.append({
                "id": net.get("id"),
                "name": net.get("networkName", "Unnamed Network"),
                "type": net.get("type", "UNKNOWN"),
                "isWireless": net.get("isWireless", False),
                "vlanId": net.get("vlanId"),
                "isEnabled": net.get("isEnabled", True)
            })
            
        return {
            "status": "success",
            "networks": network_details
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

