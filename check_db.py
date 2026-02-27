
import motor.motor_asyncio
import asyncio
import os
from dotenv import load_dotenv

def main():
    # Load .env from the backend directory
    env_path = os.path.join('sources', 'insight', 'backend', '.env')
    load_dotenv(env_path)
    
    m_url = os.getenv('MONGODB_URL', 'mongodb://localhost:27017')
    d_name = os.getenv('DATABASE_NAME', 'aruba_capture')
    
    async def run():
        print(f"Connecting to {m_url}, database: {d_name}")
        client = motor.motor_asyncio.AsyncIOMotorClient(m_url)
        db = client[d_name]
        try:
            ep = await db.endpoints.count_documents({})
            logs = await db.raw_logs.count_documents({})
            print(f'Endpoints count: {ep}')
            print(f'Raw Logs count: {logs}')
        except Exception as e:
            print(f"Error: {e}")
        finally:
            client.close()

    asyncio.run(run())

if __name__ == "__main__":
    main()
