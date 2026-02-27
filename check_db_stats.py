
import asyncio
import os
import sys

# Add the app directory to sys.path
sys.path.append(os.path.join(os.getcwd(), 'sources', 'insight', 'backend'))

from app.database.connection import connect_to_mongo, get_database, close_mongo_connection
from app.config import MONGODB_URL, DATABASE_NAME

async def check():
    print(f"Connecting to {MONGODB_URL}...")
    await connect_to_mongo()
    db = get_database()
    endpoints_count = await db.endpoints.count_documents({})
    logs_count = await db.raw_logs.count_documents({})
    print(f'Endpoints: {endpoints_count}')
    print(f'Logs: {logs_count}')
    await close_mongo_connection()

if __name__ == "__main__":
    asyncio.run(check())
