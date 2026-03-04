"""
Module Fernet tập trung — mã hóa/giải mã credentials cho refresh_token.

Nguyên tắc (stateless_architecture.md):
  - Khóa Fernet PHẢI đến từ biến môi trường INTERNAL_APP_AUTH.
  - TUYỆT ĐỐI KHÔNG lưu credentials hay token vào database.
  - Mọi nơi cần mã hóa/giải mã đều import từ đây.
"""
import hashlib
import base64
import json
from fastapi import HTTPException
from cryptography.fernet import Fernet, InvalidToken
from app.config import INTERNAL_APP_AUTH


def _make_fernet() -> Fernet:
    """Tạo Fernet instance từ INTERNAL_APP_AUTH (sha256 → urlsafe_b64)."""
    raw_key = hashlib.sha256(INTERNAL_APP_AUTH.encode()).digest()
    fernet_key = base64.urlsafe_b64encode(raw_key)
    return Fernet(fernet_key)


def encrypt_credentials(username: str, password: str) -> str:
    """Mã hóa username + password thành refresh_token string."""
    payload = json.dumps({"u": username, "p": password}).encode()
    return _make_fernet().encrypt(payload).decode()


def decrypt_credentials(blob: str) -> dict:
    """
    Giải mã refresh_token thành {"u": username, "p": password}.
    Raise HTTPException(401) nếu token không hợp lệ hoặc đã hết hạn.
    """
    try:
        payload = _make_fernet().decrypt(blob.encode())
        return json.loads(payload)
    except (InvalidToken, Exception):
        raise HTTPException(
            status_code=401,
            detail="Phiên làm việc đã hết hạn hoặc không hợp lệ."
        )
