#!/usr/bin/env python3
"""
Role Migration Script — Run once to rename legacy role strings.

Old → New:
  admin          → tenant_admin
  insight_admin  → tenant_admin
  insight_viewer → manager
  user           → viewer
  guest          → viewer

Also sets default isApproved=True for any existing tenant_admin/super_admin missing it.

Usage:
  python migrate_roles.py [--dry-run]
"""
import asyncio
import sys
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "insight")

ROLE_MAP = {
    "admin": "tenant_admin",
    "insight_admin": "tenant_admin",
    "insight_viewer": "manager",
    "user": "viewer",
    "guest": "viewer",
}

DRY_RUN = "--dry-run" in sys.argv


async def migrate():
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DATABASE_NAME]

    print(f"[migrate_roles] Connected to {MONGODB_URL} / {DATABASE_NAME}")
    if DRY_RUN:
        print("[migrate_roles] DRY RUN — no changes will be written.\n")

    total_updated = 0

    for old_role, new_role in ROLE_MAP.items():
        users = await db.users.find({"role": old_role}).to_list(5000)
        if not users:
            print(f"  [skip] No users with role='{old_role}'")
            continue

        emails = [u["email"] for u in users]
        print(f"  [{old_role}] → [{new_role}] — {len(users)} user(s): {emails}")

        if not DRY_RUN:
            result = await db.users.update_many(
                {"role": old_role},
                {"$set": {"role": new_role}}
            )
            print(f"    Updated: {result.modified_count}")
            total_updated += result.modified_count

    # Ensure all admin-tier users are approved
    if not DRY_RUN:
        res = await db.users.update_many(
            {"role": {"$in": ["super_admin", "tenant_admin"]}, "isApproved": {"$ne": True}},
            {"$set": {"isApproved": True}}
        )
        if res.modified_count:
            print(f"\n[migrate_roles] Auto-approved {res.modified_count} admin-tier user(s).")

    print(f"\n[migrate_roles] Done. Total role updates: {total_updated}")
    client.close()


if __name__ == "__main__":
    asyncio.run(migrate())
