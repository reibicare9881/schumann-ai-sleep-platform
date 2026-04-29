import jwt
from datetime import datetime, timedelta
from fastapi import Depends, HTTPException, status, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from config import settings  # 引入我們之前建立的環境變數設定檔

# 實例化 HTTPBearer，FastAPI 會自動去抓取 HTTP Header 裡的 Authorization: Bearer <token>
security = HTTPBearer()

# JWT 設定參數
ALGORITHM = "HS256"
# 對應你前端 Zero Trust 的 30 分鐘超時設定
ACCESS_TOKEN_EXPIRE_MINUTES = 30 

def create_access_token(data: dict) -> str:
    """
    產生 JWT Token
    :param data: 要夾帶進 Token 的 payload (例如 uid, role, org_code)
    """
    to_encode = data.copy()
    
    # 設定過期時間 (UTC 時間 + 30 分鐘)
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    
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
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="權限不足：限單位平台管理者使用")
    return current_user