"""学习通 session cookie 加密/解密工具"""
import json

from cryptography.fernet import Fernet

from shared.config import settings

_fernet: Fernet | None = None


def _get_fernet() -> Fernet:
    global _fernet
    if _fernet is None:
        key = settings.chaoxing_encrypt_key
        if not key:
            key = Fernet.generate_key().decode()
            print(f"[chaoxing] 生成加密密钥，请保存到 .env: CHAOXING_ENCRYPT_KEY={key}")
        _fernet = Fernet(key.encode() if isinstance(key, str) else key)
    return _fernet


def encrypt_cookies(cookies: dict) -> str:
    """加密 cookie dict -> 密文字符串"""
    data = json.dumps(cookies).encode()
    return _get_fernet().encrypt(data).decode()


def decrypt_cookies(token: str) -> dict:
    """解密密文 -> cookie dict"""
    data = _get_fernet().decrypt(token.encode())
    return json.loads(data)
