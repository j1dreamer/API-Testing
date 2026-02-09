from datetime import datetime
from typing import Optional, List
from bson import ObjectId
from app.database import get_database
from app.schemas import LogCreate, LogResponse


async def create_log(log_data: LogCreate) -> str:
    """Insert a new log entry into MongoDB."""
    db = get_database()
    log_dict = log_data.model_dump()
    log_dict["timestamp"] = datetime.utcnow()
    result = await db.logs.insert_one(log_dict)
    return str(result.inserted_id)


async def get_logs(
    method: Optional[str] = None,
    status_group: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 50
) -> tuple[List[dict], int]:
    """Retrieve logs with optional filters."""
    db = get_database()
    query = {}

    # Filter by HTTP method
    if method:
        query["method"] = method.upper()

    # Filter by status code group (2xx, 4xx, 5xx)
    if status_group:
        if status_group == "2xx":
            query["status_code"] = {"$gte": 200, "$lt": 300}
        elif status_group == "4xx":
            query["status_code"] = {"$gte": 400, "$lt": 500}
        elif status_group == "5xx":
            query["status_code"] = {"$gte": 500, "$lt": 600}

    # Search by URL keyword
    if search:
        query["url"] = {"$regex": search, "$options": "i"}

    # Get total count
    total = await db.logs.count_documents(query)

    # Get paginated logs
    cursor = db.logs.find(query).sort("timestamp", -1).skip(skip).limit(limit)
    logs = await cursor.to_list(length=limit)

    # Convert ObjectId to string
    for log in logs:
        log["_id"] = str(log["_id"])

    return logs, total


async def get_log_by_id(log_id: str) -> Optional[dict]:
    """Retrieve a single log by ID."""
    db = get_database()
    if not ObjectId.is_valid(log_id):
        return None
    log = await db.logs.find_one({"_id": ObjectId(log_id)})
    if log:
        log["_id"] = str(log["_id"])
    return log


async def delete_log(log_id: str) -> bool:
    """Delete a log by ID."""
    db = get_database()
    if not ObjectId.is_valid(log_id):
        return False
    result = await db.logs.delete_one({"_id": ObjectId(log_id)})
    return result.deleted_count > 0


async def clear_all_logs() -> int:
    """Delete all logs."""
    db = get_database()
    result = await db.logs.delete_many({})
    return result.deleted_count
