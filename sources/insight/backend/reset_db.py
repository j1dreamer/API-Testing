#!/usr/bin/env python3
"""
DB Reset + Seed Script — clears all data and re-seeds super_admin.

WARNING: This DELETES all documents from users, tenants, zones, audit_logs, master_config.
         auth_sessions and any other collections are untouched.

Usage:
  python reset_db.py [--yes]      # --yes skips confirmation prompt
"""
import asyncio
import sys
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

MONGODB_URL   = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "insight")

SUPER_ADMIN_EMAILS   = [e.strip() for e in os.getenv("SUPER_ADMIN_EMAILS", "").split(",") if e.strip()]
SUPER_ADMIN_PASSWORD = os.getenv("SUPER_ADMIN_PASSWORD", "")

COLLECTIONS_TO_CLEAR = ["users", "tenants", "zones", "audit_logs", "master_config"]

CONFIRMED = "--yes" in sys.argv


async def reset():
    if not CONFIRMED:
        print(f"\n[reset_db] Target: {MONGODB_URL} / {DATABASE_NAME}")
        print(f"[reset_db] Collections to CLEAR: {COLLECTIONS_TO_CLEAR}")
        ans = input("\nType 'yes' to confirm full wipe: ").strip().lower()
        if ans != "yes":
            print("[reset_db] Aborted.")
            return

    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DATABASE_NAME]

    print("\n[reset_db] Clearing collections...")
    for col in COLLECTIONS_TO_CLEAR:
        result = await db[col].delete_many({})
        print(f"  {col}: deleted {result.deleted_count} document(s)")

    # Recreate indexes
    await db.users.create_index("email", unique=True)
    await db.audit_logs.create_index("timestamp", expireAfterSeconds=7776000)
    await db.zones.create_index("name", unique=True)
    await db.zones.create_index("members.email")
    await db.zones.create_index("site_ids")
    await db.tenants.create_index("name", unique=True)
    await db.tenants.create_index("admin_email", sparse=True)
    await db.master_config.create_index("is_active")
    print("\n[reset_db] Indexes re-created.")

    # Seed super admins
    if not SUPER_ADMIN_EMAILS:
        print("\n[reset_db] No SUPER_ADMIN_EMAILS in env — skipping seed.")
    else:
        import bcrypt
        from datetime import datetime, timezone

        def hash_pw(pw):
            return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

        for email in SUPER_ADMIN_EMAILS:
            doc = {
                "email": email,
                "role": "super_admin",
                "isApproved": True,
                "created_at": datetime.now(timezone.utc),
            }
            if SUPER_ADMIN_PASSWORD:
                doc["password_hash"] = hash_pw(SUPER_ADMIN_PASSWORD)
            await db.users.insert_one(doc)
            print(f"\n[reset_db] Seeded super_admin: {email}")

    print("\n[reset_db] Done. Database is clean and ready for testing.")
    client.close()


if __name__ == "__main__":
    asyncio.run(reset())
