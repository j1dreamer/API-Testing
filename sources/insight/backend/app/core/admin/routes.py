from fastapi import APIRouter, Depends, HTTPException
from typing import List, Any, Dict
import pytz
from app.core.auth_deps import require_admin
from app.database.connection import get_database
from app.database.models import LogResponse
from app.database.auth_crud import update_user_role_approval

router = APIRouter()

# Setup GMT+7 Timezone
VN_TZ = pytz.timezone("Asia/Ho_Chi_Minh")

@router.get("/users")
async def get_all_users(current_user: Dict[str, Any] = Depends(require_admin)):
    db = get_database()
    users = await db.users.find().to_list(100)
    for u in users:
        u["id"] = str(u["_id"])
        del u["_id"]
        # Don't send passwords back
        if "password" in u:
            del u["password"]
    return users

@router.put("/users/{user_id}")
async def update_user(user_id: str, payload: dict, current_user: Dict[str, Any] = Depends(require_admin)):
    role = payload.get("role")
    is_approved = payload.get("isApproved")
    if role not in ["admin", "user", "guest"]:
        raise HTTPException(status_code=400, detail="Invalid role")

    db = get_database()
    from bson.objectid import ObjectId
    try:
        obj_id = ObjectId(user_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid User ID")

    result = await db.users.update_one(
        {"_id": obj_id},
        {"$set": {"role": role, "isApproved": bool(is_approved)}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": "User updated successfully"}

@router.get("/logs", response_model=List[LogResponse])
async def get_audit_logs(limit: int = 50, skip: int = 0, current_user: Dict[str, Any] = Depends(require_admin)):
    db = get_database()
    cursor = db.audit_logs.find().sort("timestamp", -1).skip(skip).limit(limit)
    logs = await cursor.to_list(length=limit)

    formatted_logs = []
    for log in logs:
        # Convert UTC datetime to GMT+7 string
        utc_dt = log.get("timestamp")
        gmt7_str = ""
        if utc_dt:
            if utc_dt.tzinfo is None:
                utc_dt = pytz.utc.localize(utc_dt)
            gmt7_dt = utc_dt.astimezone(VN_TZ)
            gmt7_str = gmt7_dt.strftime("%Y-%m-%d %H:%M:%S %Z")
        
        formatted_logs.append(LogResponse(
            id=str(log["_id"]),
            timestamp=gmt7_str,
            actor_email=log.get("actor_email"),
            method=log.get("method"),
            endpoint=log.get("endpoint"),
            payload=log.get("payload"),
            ip_address=log.get("ip_address"),
            statusCode=log.get("statusCode", 0),
            action=log.get("action")
        ))
    return formatted_logs
