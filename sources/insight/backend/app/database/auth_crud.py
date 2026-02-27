from .connection import get_database
from typing import Optional, Dict, Any

async def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    db = get_database()
    return await db.users.find_one({"email": email})

async def create_user(user_data: Dict[str, Any]) -> str:
    db = get_database()
    result = await db.users.insert_one(user_data)
    return str(result.inserted_id)

async def update_user_role_approval(email: str, role: str, is_approved: bool):
    db = get_database()
    await db.users.update_one(
        {"email": email},
        {"$set": {"role": role, "isApproved": is_approved}}
    )

async def insert_audit_log(log_data: Dict[str, Any]):
    db = get_database()
    await db.audit_logs.insert_one(log_data)
