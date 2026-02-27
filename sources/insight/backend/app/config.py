"""Application configuration loaded from environment variables."""
import os
from dotenv import load_dotenv

load_dotenv()

MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "aruba_capture")

# Security
INTERNAL_APP_AUTH = os.getenv("INTERNAL_APP_AUTH", "secret-internal-key-change-me")
# Super Admins (comma-separated list of emails)
SUPER_ADMIN_EMAILS = [email.strip() for email in os.getenv("SUPER_ADMIN_EMAILS", "cuong.nguyen@aitc-jsc.com").split(",") if email.strip()]