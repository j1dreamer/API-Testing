from fastapi import APIRouter, HTTPException, Body, Response
from typing import List, Dict, Any
from app.core.cloner_service import (
    get_captured_sites, 
    get_live_account_sites, 
    fetch_site_config_live,
    fetch_site_config, 
    apply_config_to_site,
    apply_config_live
)
from app.core.replay_service import replay_login

router = APIRouter(prefix="/api/cloner", tags=["Site Cloner"])

@router.get("/sites")
async def list_sites():
    """Get unique sites found in captured logs."""
    return await get_captured_sites()

@router.get("/live-sites")
async def list_live_sites():
    """Get all sites from the currently logged-in account session."""
    return await get_live_account_sites()

@router.get("/target-sites")
async def list_target_sites():
    """Alias for /live-sites to maintain compatibility with older UI parts."""
    return await get_live_account_sites()

@router.get("/auth-session")
async def cloner_auth_session(response: Response):
    """Check if we have an active session for the cloner."""
    # Ensure browse doesn't cache this auth check
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    
    from app.core import replay_service
    if replay_service.ACTIVE_TOKEN:
        return {
            "token_value": replay_service.ACTIVE_TOKEN.get("access_token"),
            "expires_in": replay_service.ACTIVE_TOKEN.get("expires_in")
        }
    return {"token_value": None}

@router.post("/login")
async def cloner_login(
    username: str = Body(..., embed=True),
    password: str = Body(..., embed=True)
):
    """Trigger a portal login to refresh the ACTIVE_TOKEN."""
    try:
        from app.core.replay_service import replay_login
        token = await replay_login(username, password)
        return {"status": "success", "token_type": "Bearer", "expires_in": token.get("expires_in")}
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))

@router.post("/logout")
async def cloner_logout():
    """Clear the active cloner session (memory and DB)."""
    from app.core import replay_service
    from app.database.crud import delete_all_auth_sessions
    replay_service.ACTIVE_TOKEN = None
    await delete_all_auth_sessions()
    return {"status": "success"}

@router.post("/preview")
async def preview_clone(
    site_id: str = Body(..., embed=True),
    source: str = Body("captured", embed=True)
):
    """Convert site config into a list of cloneable operations."""
    if source == "live":
        config = await fetch_site_config_live(site_id)
    else:
        config = await fetch_site_config(site_id)

    if not config or "error" in config:
        raise HTTPException(status_code=404, detail=config.get("error") if config else "Source config not found")
    
    # Generate list of ops
    ops = await apply_config_to_site("preview-only", config)
    return {"site_id": site_id, "source": source, "operations": ops}

@router.post("/apply")
async def execute_clone(
    target_site_ids: List[str] = Body(None),
    target_site_id: str = Body(None),
    operations: List[Dict[str, Any]] = Body(...)
):
    """Execute cloning by pushing configurations to multiple target sites in parallel."""
    import asyncio
    
    # Support both single siteId (backward compatibility) and multiple siteIds
    site_ids = target_site_ids or ([target_site_id] if target_site_id else [])
    
    if not site_ids:
        raise HTTPException(status_code=400, detail="No target site IDs provided.")

    # Execute all clones in parallel
    tasks = [apply_config_live(sid, operations) for sid in site_ids]
    execution_results = await asyncio.gather(*tasks)

    # Flatten results for the UI to consume easily per site
    batch_report = {}
    for sid, result in zip(site_ids, execution_results):
        batch_report[sid] = result

    return {
        "status": "success",
        "results": batch_report
    }
