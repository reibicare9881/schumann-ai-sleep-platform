import jwt
import uuid
from datetime import datetime, timedelta, timezone
from typing import Callable, Optional
from fastapi import Depends, HTTPException, status, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from config import settings  # 引入我們之前建立的環境變數設定檔
from roles import PARTNER_ROLES, TRUSTED_EXCLUSIVE_ROLES, has_permission

# 實例化 HTTPBearer，FastAPI 會自動去抓取 HTTP Header 裡的 Authorization: Bearer <token>
security = HTTPBearer()

# JWT 設定參數
ALGORITHM = "HS256"
# 對應你前端 Zero Trust 的 30 分鐘超時設定
ACCESS_TOKEN_EXPIRE_MINUTES = 30 

_trusted_session_validator: Optional[Callable[[dict], bool]] = None
# Compatibility alias kept for existing tests and extensions.
_reibi_super_session_validator: Optional[Callable[[dict], bool]] = None


def configure_trusted_session_validator(validator: Callable[[dict], bool]) -> None:
    """Register the server-side revocation and role-binding check."""
    global _trusted_session_validator, _reibi_super_session_validator
    _trusted_session_validator = validator
    _reibi_super_session_validator = validator


def configure_reibi_super_session_validator(validator: Callable[[dict], bool]) -> None:
    """Register the server-side revocation check after Supabase is initialized."""
    configure_trusted_session_validator(validator)

def create_access_token(data: dict) -> str:
    """
    產生 JWT Token
    :param data: 要夾帶進 Token 的 payload (例如 uid, role, org_code)
    """
    to_encode = data.copy()
    
    # 設定過期時間 (UTC 時間 + 30 分鐘)
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"iat": now, "exp": expire, "jti": to_encode.get("jti") or str(uuid.uuid4())})
    
    # 使用環境變數中的 JWT_SECRET_KEY 進行加密簽章
    encoded_jwt = jwt.encode(to_encode, settings.jwt_secret_key, algorithm=ALGORITHM)
    
    return encoded_jwt

def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security)) -> dict:
    """
    驗證 JWT Token (作為 FastAPI 的 Depends 依賴使用)
    若驗證成功，回傳解碼後的使用者資料字典；若失敗，直接拋出 401 錯誤。
    """
    token = credentials.credentials
    
    # 預先定義統一的 401 錯誤格式
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="無法驗證憑證",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        # 嘗試解碼 Token
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[ALGORITHM])
        
        # 檢查必須的欄位是否存在 (這裡以 uid 和 role 為例)
        uid: str = payload.get("uid")
        role: str = payload.get("role")
        
        if uid is None or role is None:
            raise credentials_exception
            
        requires_trusted_session = (
            payload.get("auth_source") == "supabase"
            or role in TRUSTED_EXCLUSIVE_ROLES
        )
        if requires_trusted_session:
            validator = _trusted_session_validator or _reibi_super_session_validator
            if validator is None:
                raise credentials_exception
            try:
                session_is_active = validator(payload)
            except Exception:
                session_is_active = False
            if not session_is_active:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="REIBI 內部工作階段已失效，請重新登入",
                    headers={"WWW-Authenticate": "Bearer"},
                )

        return payload  # 回傳完整的 payload (包含 uid, name, role, org_code 等)
        
    except jwt.ExpiredSignatureError:
        # 精準捕捉 Token 過期錯誤
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="登入已逾時，請重新登入 (Zero Trust 安全機制)",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError:
        # 捕捉 Token 格式錯誤、被竄改或簽章不符
        raise credentials_exception

# --- 選擇性：進階權限檢查 ---
# 如果你想在路由層級直接限制只有 admin 或 dept_head 能呼叫，可以擴充以下依賴：
def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    """守門員 1：僅限單位平台管理者"""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="權限不足：限單位平台管理者使用")
    return current_user

def require_org_manager(current_user: dict = Depends(get_current_user)) -> dict:
    """守門員 2：僅限管理者與部門主管"""
    if current_user.get("role") not in ["admin", "dept_head"]:
        raise HTTPException(status_code=403, detail="權限不足：限單位主管或管理者使用")
    return current_user

def require_member_or_above(current_user: dict = Depends(get_current_user)) -> dict:
    """守門員 3：必須是單位成員 (排除 individual)"""
    if current_user.get("role") == "individual":
        raise HTTPException(status_code=403, detail="權限不足：此功能不開放給個人帳號")
    return current_user


def require_reibi_manager(current_user: dict = Depends(get_current_user)) -> dict:
    """REIBI 管理 API：現有單位管理者或未來的 REIBI 內部超管。"""
    if not has_permission(current_user, "manage_reibi"):
        raise HTTPException(status_code=403, detail="權限不足：限 REIBI 管理人員使用")
    return current_user


def require_reibi_super(current_user: dict = Depends(get_current_user)) -> dict:
    """跨組織寫入與 Artifact 正式匯入只允許 REIBI 內部超管。"""
    if current_user.get("role") != "reibi_super":
        raise HTTPException(status_code=403, detail="權限不足：正式匯入限 REIBI 內部超級管理者")
    return current_user


def require_reibi_partner(current_user: dict = Depends(get_current_user)) -> dict:
    """經銷商入口只接受經銷商角色，不與企業或 REIBI 內部角色混用。"""
    if current_user.get("role") not in PARTNER_ROLES:
        raise HTTPException(status_code=403, detail="權限不足：限已驗證的 REIBI 經銷商使用")
    if not (current_user.get("partner_org_code") or current_user.get("org_code")):
        raise HTTPException(status_code=403, detail="經銷商身分缺少 partner_org_code")
    return current_user

