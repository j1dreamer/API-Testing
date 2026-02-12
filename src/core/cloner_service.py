import httpx
import json
from typing import List, Dict, Any, Optional
from datetime import datetime
from src.database.connection import get_database
from src.core import replay_service

async def get_live_account_sites() -> List[Dict[str, Any]]:
    """Fetch all live sites for the currently logged-in account (active session)."""
    if not replay_service.ACTIVE_TOKEN:
        print("[CLONER] No active token found in replay_service")
        return []
    
    headers = {
        "Authorization": f"Bearer {replay_service.ACTIVE_TOKEN['access_token']}",
        "Accept": "application/json, text/plain, */*",
        "X-ION-API-VERSION": "22",
        "X-ION-CLIENT-TYPE": "InstantOn",
        "X-ION-CLIENT-PLATFORM": "web",
        "Referer": "https://portal.instant-on.hpe.com/sites/list"
    }
    
    async with httpx.AsyncClient(verify=False) as client:
        try:
            res = await client.get("https://portal.instant-on.hpe.com/api/sites", headers=headers, timeout=10.0)
            if res.status_code == 200:
                data = res.json()
                raw_elements = data if isinstance(data, list) else data.get("elements", [])
                
                # Standardize fields: 'id' -> 'siteId', 'name' -> 'siteName'
                standard_sites = []
                for s in raw_elements:
                    standard_sites.append({
                        "siteId": s.get("id") or s.get("siteId"),
                        "siteName": s.get("name") or s.get("siteName", "Unknown Site")
                    })
                return standard_sites
        except Exception as e:
            print(f"[CLONER] Failed to fetch live sites: {e}")
    return []

async def fetch_site_config_live(site_id: str) -> Dict[str, Any]:
    """Fetch live wired/wireless configuration for a site using the active session."""
    if not replay_service.ACTIVE_TOKEN:
        return {"error": "No active session for live config fetch."}
    
    headers = {
        "Authorization": f"Bearer {replay_service.ACTIVE_TOKEN['access_token']}",
        "Accept": "application/json, text/plain, */*",
        "X-ION-API-VERSION": "22",
        "X-ION-CLIENT-TYPE": "InstantOn",
        "X-ION-CLIENT-PLATFORM": "web",
        "Referer": "https://portal.instant-on.hpe.com/sites/list"
    }
    
    async with httpx.AsyncClient(verify=False) as client:
        try:
            # Fetch networks
            url_nets = f"https://portal.instant-on.hpe.com/api/sites/{site_id}/networksSummary"
            res_nets = await client.get(url_nets, headers=headers, timeout=10.0)
            
            # Fetch guest portal settings (site-level)
            url_guest = f"https://portal.instant-on.hpe.com/api/sites/{site_id}/guestPortalSettings"
            res_guest = await client.get(url_guest, headers=headers, timeout=10.0)
            
            # Safe JSON parsing
            nets_data = []
            if res_nets.status_code == 200:
                try:
                    nets_data = res_nets.json()
                except Exception:
                    print(f"[CLONER] Failed to parse networks JSON: {res_nets.text[:100]}")
            
            guest_data = None
            if res_guest.status_code == 200:
                try:
                    guest_data = res_guest.json()
                except Exception:
                    print(f"[CLONER] Failed to parse guest portal JSON: {res_guest.text[:100]}")
            
            config = {
                "networks": nets_data,
                "guest_portal": guest_data
            }
            
            if not config["networks"] and res_nets.status_code != 200:
                return {"error": f"Live fetch failed with status {res_nets.status_code}. Details: {res_nets.text[:100]}"}
                
            return config
        except Exception as e:
            print(f"[CLONER] Fetch config exception: {str(e)}")
            return {"error": f"Live fetch exception: {str(e)}"}

async def get_captured_sites() -> List[Dict[str, Any]]:
    """Extract unique site IDs and names from raw logs using multiple patterns."""
    db = get_database()
    import re
    
    # Pattern 1: Direct sites list (/api/v1/sites or /api/v1/customers/.../sites)
    cursor = db.raw_logs.find(
        {"url": {"$regex": "api/v1/.*sites"}},
        {"response_body": 1, "timestamp": 1, "url": 1}
    ).sort("timestamp", -1)
    
    sites = {}
    async for doc in cursor:
        body = doc.get("response_body")
        if not body or not isinstance(body, dict): continue
        # Handle { "elements": [...] } or direct list
        elements = body.get("elements", []) if isinstance(body.get("elements"), list) else ([body] if body.get("siteId") else [])
        for s in elements:
            s_id = s.get("siteId")
            if s_id and s_id not in sites:
                sites[s_id] = {
                    "siteId": s_id,
                    "siteName": s.get("siteName", "Unknown Site"),
                    "captured_at": doc.get("timestamp")
                }
    
    # Pattern 2: Extract Site ID from URLs (e.g. .../sites/{siteId}/dashboard)
    cursor_url = db.raw_logs.find(
        {"url": {"$regex": "/sites/[a-f0-9-]{36}"}},
        {"url": 1, "timestamp": 1}
    ).sort("timestamp", -1).limit(200)
    
    async for doc in cursor_url:
        match = re.search(r"sites/([a-f0-9-]{36})", doc["url"])
        if match:
            s_id = match.group(1)
            if s_id not in sites:
                sites[s_id] = {
                    "siteId": s_id,
                    "siteName": f"Site {s_id[:8]}",
                    "captured_at": doc.get("timestamp")
                }
                
    return sorted(list(sites.values()), key=lambda x: x["captured_at"], reverse=True)

async def fetch_site_config(site_id: str) -> Dict[str, Any]:
    """Retrieve the latest captured wired/wireless config for a site."""
    db = get_database()
    # Flexible match for networksSummary or wiredNetworks anywhere in URL
    cursor = db.raw_logs.find({
        "url": {"$regex": f"sites/{site_id}/(networksSummary|wiredNetworks)"},
        "method": "GET",
        "status_code": 200
    }).sort("timestamp", -1).limit(1)
    
    log = await cursor.to_list(length=1)
    if not log:
        return {"error": "No configuration found for this site ID in logs."}
    
    return log[0].get("response_body", {})

async def apply_config_to_site(target_site_id: str, config: Dict[str, Any]):
    """
    Transform source config into a list of operations for the preview.
    Preserves advanced settings like schedules, bandwidth limits, and authentication.
    """
    operations = []
    
    # 1. Normalize input to a list of network objects and extract guest portal
    raw_networks = []
    guest_portal = None
    
    if isinstance(config, dict):
        if "networks" in config:
            nets_part = config["networks"]
            # Handle { "networks": { "elements": [...] } } or { "networks": [...] }
            if isinstance(nets_part, dict):
                raw_networks = nets_part.get("elements", [nets_part])
            elif isinstance(nets_part, list):
                raw_networks = nets_part
            else:
                raw_networks = [nets_part]
            
            guest_portal = config.get("guest_portal")
        elif "elements" in config:
            raw_networks = config["elements"]
        else:
            raw_networks = [config]
    elif isinstance(config, list):
        raw_networks = config

    # Add Networks
    for net in raw_networks:
        # Check if it's a wired network with nested wireless (common in older API logs)
        nested_wireless = net.pop("wirelessNetworks", []) if isinstance(net, dict) else []
        
        # Prepare standard payload
        # We strip site/network IDs but keep everything else (schedules, auth, limits, ap bindings)
        # Note: accessPoints might have site-specific deviceIds, but user wants 'full' config.
        # We'll keep them for now as they might be needed for binding logic.
        clean_payload = {k: v for k, v in net.items() if k not in ["networkId", "siteId", "kind"]}
        
        is_wireless = net.get("isWireless", False)
        net_type = "WIRELESS_NETWORK" if is_wireless else "WIRED_NETWORK"
        
        operations.append({
            "type": net_type,
            "name": net.get("networkName") or ("SSID" if is_wireless else "Wired Network"),
            "original_id": net.get("networkId"),
            "payload": clean_payload
        })
        
        # Add nested wireless if they exist
        for wifi in nested_wireless:
            clean_wifi_payload = {k: v for k, v in wifi.items() if k not in ["networkId", "siteId", "kind"]}
            if "isWireless" not in clean_wifi_payload:
                clean_wifi_payload["isWireless"] = True
                
            operations.append({
                "type": "WIRELESS_NETWORK",
                "name": wifi.get("networkName") or "SSID",
                "original_id": wifi.get("networkId"),
                "payload": clean_wifi_payload,
            })
            
    # 2. Add Guest Portal Operation if present (APPEND so it runs AFTER networks are ready)
    if guest_portal:
        operations.append({
            "type": "GUEST_PORTAL",
            "name": "Guest Portal Settings",
            "payload": guest_portal
        })
            
    return operations

async def apply_config_live(target_site_id: str, operations: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Actually push network configurations to the target site using a two-pass approach:
    1. POST (Create): Minimal/Clean payload matching the user's successful cURL pattern.
    2. PUT (Update): Full payload with all advanced settings.
    """
    if not replay_service.ACTIVE_TOKEN:
        return [{"status": "error", "message": "No active session."}]
    
    headers = {
        "Authorization": f"Bearer {replay_service.ACTIVE_TOKEN['access_token']}",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-us",
        "X-ION-API-VERSION": "22",
        "X-ION-CLIENT-TYPE": "InstantOn",
        "X-ION-CLIENT-PLATFORM": "web",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
        "Referer": f"https://portal.instant-on.hpe.com/sites/{target_site_id}/networks/overview",
        "Content-Type": "application/json"
    }

    results = []
    async with httpx.AsyncClient(verify=False) as client:
        base_url = f"https://portal.instant-on.hpe.com/api/sites/{target_site_id}/networksSummary"
        
        for op in operations:
            try:
                full_payload = op.get("payload", {})
                
                # --- Handle GUEST_PORTAL (Single Final Pass) ---
                if op["type"] == "GUEST_PORTAL":
                    portal_url = f"https://portal.instant-on.hpe.com/api/sites/{target_site_id}/guestPortalSettings"
                    print(f"[CLONER] GUEST_PORTAL (Final Pass): PUT -> {op['name']}")
                    # Strip only 'id' which is site-specific. Keep 'kind' as per user cURL.
                    clean_portal = {k: v for k, v in full_payload.items() if k not in ["id"]}
                    res_p = await client.put(portal_url, headers=headers, json=clean_portal, timeout=15.0)
                    if res_p.status_code in [200, 204]:
                        results.append({"name": op["name"], "type": op["type"], "status": "SUCCESS (GUEST_PORTAL)"})
                    else:
                        results.append({
                            "name": op["name"], 
                            "type": op["type"], 
                            "status": f"GUEST_PORTAL FAILED [{res_p.status_code}]", 
                            "detail": res_p.text[:500]
                        })
                    continue

                # Pass 1: "Rich Identity Create" (POST)
                # For Guest/Captive networks, the initial POST is almost the full config.
                create_keys = [
                    "networkName", "type", "authentication", "security", "isWireless",
                    "ipAddressingMode", "isEnabled", "isCaptivePortalEnabled",
                    "isGuestPortalEnabled", "dhcpScope", "isSsidHidden",
                    "isAvailableOn24GHzRadioBand", "isAvailableOn5GHzRadioBand", "isAvailableOn6GHzRadioBand",
                    "isLegacy80211bRatesEnabled", "isHighEfficiency11axEnabled", "isHighEfficiency11axOfdmaEnabled",
                    "isDynamicMulticastOptimizationEnabled", "isBroadcastOnAllBoundApsOnAllBands",
                    "isInternetAllowed", "isIntraSubnetTrafficAllowed", "isAccessRestricted",
                    "activeSchedule", "schedule", "weekSchedule"
                ]
                
                # Copy basics
                create_payload = {k: v for k, v in full_payload.items() if k in create_keys}
                
                # Security specific: PSK is needed if not OPEN
                if full_payload.get("security") != "OPEN" and "preSharedKey" in full_payload:
                    create_payload["preSharedKey"] = full_payload["preSharedKey"]

                # Addressing specific: NAT/Internal mode usually forces useVlan=False
                addr_mode = full_payload.get("ipAddressingMode")
                if addr_mode in ["NAT", "internal"]:
                    create_payload["useVlan"] = False
                    create_payload["vlanId"] = None if addr_mode == "internal" else 1
                else:
                    # Bridge mode: keep vlan info if present
                    if "useVlan" in full_payload: create_payload["useVlan"] = full_payload["useVlan"]
                    if "vlanId" in full_payload: create_payload["vlanId"] = full_payload["vlanId"]

                # Critical structure fixes:
                create_payload.update({
                    "accessPoints": [],
                    "wiredNetworkId": None,
                    "isBandwidthLimitEnabled": False,
                    "isAccessRestricted": full_payload.get("isAccessRestricted", False)
                })

                # Basic schedule if it exists, but strip 'state' and 'scheduleId' which are ID-bound
                if "schedule" in full_payload and isinstance(full_payload["schedule"], dict):
                    src_sch = full_payload["schedule"]
                    create_payload["schedule"] = {
                        "activeDays": src_sch.get("activeDays", ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"]),
                        "activeTimeRange": src_sch.get("activeTimeRange", {"enabled": True, "startTime": "09:00", "endTime": "17:00"})
                    }

                print(f"[CLONER] PHASE 1: POST (Create) -> {op['name']}")
                res_post = await client.post(base_url, headers=headers, json=create_payload, timeout=15.0)
                
                if res_post.status_code not in [200, 201]:
                    results.append({
                        "name": op["name"], 
                        "type": op["type"], 
                        "status": f"PHASE 1 (CREATE) FAILED [{res_post.status_code}]",
                        "detail": res_post.text[:500]
                    })
                    continue

                # Pass 1 Success!
                post_data = res_post.json()
                new_id = post_data.get("networkId") or post_data.get("id")
                
                if not new_id:
                    results.append({"name": op["name"], "type": op["type"], "status": "PHASE 1 OK | PHASE 2 SKIPPED", "detail": "Target ID missing from create response."})
                    continue
                
                # Settle time
                import asyncio
                await asyncio.sleep(0.8)

                # --- Pass 2: "Full Update" (PUT) --- 
                # Now we send the ACTUAL full configuration, but still strip root IDs
                update_payload = full_payload.copy()
                
                # CRITICAL: Strip any field that is site-specific or can cause 400 if devices don't match
                # accessPoints: deviceIds are unique to Site A and will fail on Site B
                # wiredNetworkId: often also site-specific
                problematic_fields = ["networkId", "siteId", "id", "kind", "wiredNetworkId", "accessPoints", "allowList"]
                for k in problematic_fields:
                    update_payload.pop(k, None)
                
                # Ensure structure is clean for Update
                # Only keep fields that are part of the network configuration itself
                update_url = f"{base_url}/{new_id}"
                print(f"[CLONER] PHASE 2: PUT (Update) -> {op['name']} (ID: {new_id})")
                res_put = await client.put(update_url, headers=headers, json=update_payload, timeout=15.0)

                if res_put.status_code in [200, 204]:
                    results.append({"name": op["name"], "type": op["type"], "status": "SUCCESS (POST+PUT)"})
                else:
                    results.append({
                        "name": op["name"], 
                        "type": op["type"], 
                        "status": f"PHASE 1 OK | PHASE 2 (UPDATE) FAILED [{res_put.status_code}]",
                        "detail": res_put.text[:500]
                    })

            except Exception as e:
                print(f"[CLONER] ERROR: {str(e)}")
                results.append({"name": op["name"], "type": op["type"], "status": "ERROR", "detail": str(e)})
    
    return results
