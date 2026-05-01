"""
統一後端：舒曼共振平台 + 睡眠平台
Unified Backend: Schumann Platform + Sleep Platform
支持兩個應用的無縫切換
"""

import os
import json
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timedelta
from typing import Optional, Dict, List
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from supabase import create_client, Client
from dotenv import load_dotenv
from auth import create_access_token, get_current_user, require_admin
from config import settings
import uuid

# ==========================================
# 加載環境變數
# ==========================================
# load_dotenv()

# API_HOST = os.getenv("API_HOST", "0.0.0.0")
# API_PORT = int(os.getenv("API_PORT", 8000))
# DEBUG = os.getenv("DEBUG", "True") == "True"
# FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

# # 1. Supabase 連線設定
# SUPABASE_URL = os.getenv("SUPABASE_URL")
# SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

# # 2. JWT 簽章密鑰 (用於 auth.py 核發 Token)
# JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")

# # 3. Gemini AI 金鑰 (用於 analyzer 和 parser，取代原本當作參數傳遞的寫法)
# GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# backend/main.py

app = FastAPI(
    title="統一多平台 API",
    description="舒曼共振平台 + 睡眠平台 統一後端服務",
    version="2.0.0",
    debug=settings.debug,
    docs_url="/docs",
    redoc_url="/redoc"
)

# 1. 初始化 Supabase 客戶端
# 如果 .env 沒填寫這些變數，啟動伺服器的那一瞬間 settings 就會立刻報錯阻止你
supabase: Client = create_client(
    settings.supabase_url, 
    settings.supabase_service_role_key
)

# 2. 設定 CORS (跨來源資源共用)
origins = [
    "http://localhost:3000",
    settings.frontend_url
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 3. 測試一下大管家有沒有正常工作
@app.get("/")
async def root():
    return {
        "message": "API 伺服器正常運作中",
        "debug_mode": settings.debug,
        "frontend_allowed": settings.frontend_url
    }


# ==========================================
# 數據模型
# ==========================================

class LoginRequest(BaseModel):
    """登入請求"""
    platform: str  # "schumann" 或 "sleep"
    role: Optional[str] = "individual"  
    name: Optional[str] = None          # 👈 補上這個！(個人或組織成員的姓名/代稱)
    pin: Optional[str] = None
    org_code: Optional[str] = None

class AssessmentData(BaseModel):
    """睡眠評估數據"""
    user_id: str
    profile: Dict
    sleep_scores: Dict
    pain_scores: Dict
    work_scores: Dict

# ==========================================
# 內存數據庫 (開發用)
# ==========================================
class UnifiedDB:
    def __init__(self):
        # 跨平台用戶
        self.users = {}
        
        # 舒曼共振平台數據
        self.schumann_reports = {}
        self.schumann_sessions = {}
        
        # 睡眠平台數據
        self.sleep_reports = {}
        self.sleep_sessions = {}
        
        # 用戶平台關聯
        self.user_platforms = {}

db = UnifiedDB()

# ==========================================
# PIN 驗證
# ==========================================
VALID_PINS = {
    "member": "1111",
    "dept_head": "2222",
    "admin": "3333"
}

def verify_pin(role: str, pin: str) -> bool:
    return VALID_PINS.get(role) == pin

def create_session(user_id: str, platform: str, role: Optional[str] = None) -> Dict:
    """建立跨平台會話"""
    session_id = f"session_{platform}_{user_id}_{int(datetime.now().timestamp())}"
    
    session_data = {
        "user_id": user_id,
        "platform": platform,
        "role": role,
        "created_at": datetime.now(),
        "expires_at": datetime.now() + timedelta(hours=8)
    }
    
    if platform == "schumann":
        db.schumann_sessions[session_id] = session_data
    elif platform == "sleep":
        db.sleep_sessions[session_id] = session_data
    
    # 記錄用戶可訪問的平台
    if user_id not in db.user_platforms:
        db.user_platforms[user_id] = []
    if platform not in db.user_platforms[user_id]:
        db.user_platforms[user_id].append(platform)
    
    return {
        "session_id": session_id,
        "user_id": user_id,
        "platform": platform,
        "role": role
    }

# ==========================================
# 主路由：健康檢查
# ==========================================

@app.get("/")
def health_check():
    """系統健康檢查"""
    return {
        "status": "online",
        "service": "統一多平台 API",
        "version": "2.0.0",
        "platforms": ["schumann", "sleep"],
        "timestamp": datetime.now().isoformat()
    }

@app.get("/api/health")
def api_health():
    """API 健康檢查"""
    return {
        "status": "healthy",
        "schumann_reports": len(db.schumann_reports),
        "sleep_reports": len(db.sleep_reports),
        "active_users": len(db.users),
        "api_url": f"http://{API_HOST}:{API_PORT}"
    }

@app.get("/api/platforms")
def list_platforms():
    """獲取可用平台列表"""
    return {
        "platforms": [
            {
                "id": "schumann",
                "name": "舒曼共振平台",
                "description": "自律神經分析 + AI解說",
                "icon": "🧠",
                "status": "active"
            },
            {
                "id": "sleep",
                "name": "睡眠健康平台",
                "description": "睡眠 + 疼痛 + 工作效率評估",
                "icon": "🌙",
                "status": "active"
            }
        ]
    }

# ==========================================
# 統一認證模塊
# ==========================================

@app.post("/api/auth/login")
async def unified_login(request: LoginRequest):
    """統一登入 - 支持舒曼和睡眠平台，並整合 Supabase 與 JWT"""
    
    platform = request.platform.lower()
    
    if platform not in ["schumann", "sleep"]:
        raise HTTPException(status_code=400, detail=f"不支持的平台: {platform}")

    # ==========================================
    # 邏輯 A：個人用戶登入 (Individual)
    # ==========================================
    if request.role == "individual":
        if not request.name:
            raise HTTPException(status_code=400, detail="個人用戶需提供姓名/代稱")
            
        # 1. 在 Supabase 的 profiles 表中尋找這個名字的個人用戶
        # 假設你的表名叫做 profiles，並且有 full_name 和 user_type 欄位
        response = supabase.table("profiles").select("*").eq("full_name", request.name).eq("system_role", "individual").execute()
        
        user_data = None
        if not response.data:
            # 2. 找不到，就自動在 Supabase 建立一個新的 (免密碼註冊)
            new_user = {
                "id": str(uuid.uuid4()),
                "full_name": request.name, 
                "system_role": "individual"
                # 注意：如果你的 profiles 表的 id 是綁定 auth.users 的，
                # 這裡可能需要先插入 auth.users，或者拔除 profiles 的 FK 限制。
                # 簡單起見，這裡假設你的 profiles id 可以由資料庫自動產生 (gen_random_uuid)
            }
            insert_res = supabase.table("profiles").insert(new_user).execute()
            user_data = insert_res.data[0]
        else:
            user_data = response.data[0]

        # 3. 準備打包進 JWT 的資料
        token_payload = {
            "uid": user_data["id"],
            "name": user_data["full_name"],
            "role": "individual",
            "platform": platform
        }
        
    # ==========================================
    # 邏輯 B：組織用戶登入 (Member, Dept_Head, Admin)
    # ==========================================
    else:
        if not request.org_code or not request.pin or not request.name:
            raise HTTPException(status_code=400, detail="組織用戶需提供單位代碼、姓名與通行碼")
            
        org_code = request.org_code.upper()
            
        # 1. 查詢 Supabase 中的 organizations 資料表
        org_res = supabase.table("organizations").select("*").eq("org_code", org_code).execute()
        
        if not org_res.data:
            raise HTTPException(status_code=404, detail="找不到該單位代碼")
            
        org_data = org_res.data[0]
        
        # 2. 驗證該角色的 PIN 碼 (這裡直接比對文字，未來建議加上 Hash 比對)
        expected_pin = ""
        if request.role == "member":
            expected_pin = org_data.get("member_pin")
        elif request.role == "dept_head":
            expected_pin = org_data.get("dept_pin")
        elif request.role == "admin":
            expected_pin = org_data.get("admin_pin")
        else:
             raise HTTPException(status_code=400, detail="未知的角色")
            
        if request.pin != expected_pin:
            raise HTTPException(status_code=401, detail="通行碼錯誤")
            
        # 3. 尋找或建立該員工的 profile 資料 (把名字跟 org_code 綁定)
        user_res = supabase.table("profiles").select("*").eq("full_name", request.name).eq("org_code", org_code).eq("system_role", request.role).execute()
        
        if not user_res.data:
            new_user = {
                "id": str(uuid.uuid4()),
                "full_name": request.name, 
                "system_role": request.role,
                "org_code": org_code
            }
            insert_res = supabase.table("profiles").insert(new_user).execute()
            user_data = insert_res.data[0]
        else:
            user_data = user_res.data[0]

        # 4. 準備打包進 JWT 的資料
        token_payload = {
            "uid": user_data["id"],
            "name": user_data["full_name"],
            "role": request.role,
            "org_code": org_code,
            "platform": platform
        }

    # ==========================================
    # 核發 Token 並回傳
    # ==========================================
    # 呼叫 auth.py 幫我們簽署 JWT Token
    access_token = create_access_token(token_payload)
    
    return {
        "status": "success",
        "platform": platform,
        # session 只用來讓前端畫面顯示名字，不具備安全效力
        "session": {
            "user_id": token_payload["uid"],
            "name": token_payload["name"],
            "role": token_payload["role"],
            "org_code": token_payload.get("org_code")
        },
        # access_token 是安全核心，前端之後打 API 都要帶上它
        "access_token": access_token,
        "message": f"{platform} 平台登入成功"
    }

@app.post("/api/auth/logout")
async def logout(session_id: str, platform: str):
    """登出"""
    if platform == "schumann":
        if session_id in db.schumann_sessions:
            del db.schumann_sessions[session_id]
    elif platform == "sleep":
        if session_id in db.sleep_sessions:
            del db.sleep_sessions[session_id]
    
    return {"status": "success", "message": "已登出"}

@app.get("/api/auth/user-platforms/{user_id}")
async def get_user_platforms(user_id: str):
    """獲取用戶可訪問的平台"""
    platforms = db.user_platforms.get(user_id, [])
    return {
        "user_id": user_id,
        "platforms": platforms,
        "can_switch": len(platforms) > 1
    }

# ==========================================
# 舒曼共振平台 API (/api/schumann/*)
# ==========================================

@app.get("/api/schumann/health")
async def schumann_health():
    """舒曼共振平台健康檢查"""
    return {
        "platform": "schumann",
        "status": "healthy",
        "total_reports": len(db.schumann_reports),
        "features": ["PDF分析", "AI解說", "心率分析", "自律神經平衡"]
    }

@app.get("/api/schumann/reports")
async def list_schumann_reports(user_id: str):
    """獲取用戶舒曼報告列表"""
    reports = [r for r in db.schumann_reports.values() if r.get("user_id") == user_id]
    return {
        "status": "success",
        "platform": "schumann",
        "count": len(reports),
        "reports": reports
    }

@app.get("/api/schumann/reports/{report_id}")
async def get_schumann_report(report_id: str):
    """獲取單份舒曼報告"""
    report = db.schumann_reports.get(report_id)
    if not report:
        raise HTTPException(status_code=404, detail="舒曼報告不存在")
    
    return {
        "status": "success",
        "platform": "schumann",
        "report": report
    }

@app.post("/api/schumann/upload")
async def upload_schumann_report(user_id: str, data: Dict):
    """上傳舒曼共振分析報告"""
    report_id = f"schumann_report_{int(datetime.now().timestamp())}"
    report = {
        "id": report_id,
        "user_id": user_id,
        "platform": "schumann",
        "created_at": datetime.now().isoformat(),
        "data": data,
        "status": "completed"
    }
    
    db.schumann_reports[report_id] = report
    
    return {
        "status": "success",
        "platform": "schumann",
        "report_id": report_id,
        "message": "舒曼報告已上傳"
    }

# ==========================================
# 睡眠平台 API (/api/sleep/*)
# ==========================================

@app.get("/api/sleep/health")
async def sleep_health():
    """睡眠平台健康檢查"""
    # 💡 保持公開：健康檢查通常供伺服器監控(如 AWS/GCP)使用，不需要也不應該上鎖。
    return {
        "platform": "sleep",
        "status": "healthy",
        "total_reports": len(db.sleep_reports),
        "features": ["睡眠評估", "疼痛管理", "工作效率", "KPI統計", "OKR管理"]
    }

@app.post("/api/sleep/assessment", status_code=201)
async def submit_sleep_assessment(
    request: AssessmentData,
    current_user: dict = Depends(get_current_user)
):
    """提交睡眠評估"""
    if current_user.get("uid") != request.user_id:
        raise HTTPException(status_code=403, detail="越權操作：無法替其他使用者提交資料")

    sleep_score = sum(request.sleep_scores.values())
    pain_score = sum(request.pain_scores.values())
    work_score = sum(request.work_scores.values())
    
    # 💡 修正：使用 UUID 產生不可預測且不會碰撞的報告 ID
    report_id = str(uuid.uuid4())
    
    report = {
        "id": report_id,
        "user_id": request.user_id,
        "org_code": current_user.get("org_code"), # 💡 修正：寫入時綁定所屬單位，為權限隔離打底
        "platform": "sleep",
        "created_at": datetime.now().isoformat(),
        "profile": request.profile,
        "sleep_score": sleep_score,
        "sleep_level": "green" if sleep_score <= 7 else "yellow" if sleep_score <= 14 else "orange" if sleep_score <= 21 else "red",
        "pain_score": pain_score,
        "pain_level": "green" if pain_score <= 12 else "yellow" if pain_score <= 25 else "orange" if pain_score <= 38 else "red",
        "work_score": work_score,
        "status": "completed"
    }
    
    # 💡 修正：正式寫入 Supabase 資料庫，淘汰記憶體儲存
    supabase.table("sleep_reports").insert(report).execute()
    
    return {
        "status": "success",
        "platform": "sleep",
        "report_id": report_id,
        "message": "睡眠評估已提交",
        "report": report
    }

@app.get("/api/sleep/reports")
async def list_sleep_reports(
    user_id: str,
    current_user: dict = Depends(get_current_user)
):
    """獲取用戶睡眠報告列表"""
    
    # 💡 修正：Admin 權限嚴格隔離。先去 Supabase 查目標用戶所屬的單位
    target_user_res = supabase.table("profiles").select("org_code").eq("id", user_id).execute()
    if not target_user_res.data:
        raise HTTPException(status_code=404, detail="找不到該用戶")
    target_org_code = target_user_res.data[0].get("org_code")

    # 權限判斷：如果不是查自己，那必須是「同一個單位的 Admin」才能放行
    if current_user.get("uid") != user_id:
        if current_user.get("role") != "admin" or current_user.get("org_code") != target_org_code:
            raise HTTPException(status_code=403, detail="越權存取：您只能查詢自己或同單位成員的報告")

    # 💡 修正：改從 Supabase 讀取資料
    res = supabase.table("sleep_reports").select("*").eq("user_id", user_id).execute()
    reports = res.data
    
    return {
        "status": "success",
        "platform": "sleep",
        "count": len(reports),
        "reports": reports
    }

@app.get("/api/sleep/reports/{report_id}")
async def get_sleep_report(
    report_id: str,
    current_user: dict = Depends(get_current_user)
):
    """獲取單份睡眠報告"""
    # 💡 修正：改從 Supabase 讀取
    res = supabase.table("sleep_reports").select("*").eq("id", report_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="睡眠報告不存在")
    
    report = res.data[0]
    
    # 💡 修正：比對這份報告的 org_code 跟管理員的 org_code 是否一致
    is_owner = report.get("user_id") == current_user.get("uid")
    is_same_org_admin = current_user.get("role") == "admin" and report.get("org_code") == current_user.get("org_code")

    if not is_owner and not is_same_org_admin:
        raise HTTPException(status_code=403, detail="越權存取：您無權查看此份報告")

    return {
        "status": "success",
        "platform": "sleep",
        "report": report
    }
    
@app.get("/api/sleep/analysis/{user_id}")
async def get_sleep_analysis(
    user_id: str,
    current_user: dict = Depends(get_current_user)
):
    """獲取睡眠趨勢分析"""
    # 💡 修正：權限隔離邏輯與 list_sleep_reports 相同
    target_user_res = supabase.table("profiles").select("org_code").eq("id", user_id).execute()
    if not target_user_res.data:
        raise HTTPException(status_code=404, detail="找不到該用戶")
    target_org_code = target_user_res.data[0].get("org_code")

    if current_user.get("uid") != user_id:
        if current_user.get("role") != "admin" or current_user.get("org_code") != target_org_code:
            raise HTTPException(status_code=403, detail="越權存取：您只能查詢自己或同單位成員的分析")

    # 💡 修正：改從 Supabase 讀取
    res = supabase.table("sleep_reports").select("*").eq("user_id", user_id).execute()
    reports = res.data
    
    if not reports:
        return {
            "status": "success",
            "platform": "sleep",
            "message": "暫無報告數據",
            "analysis": None
        }
    
    sleep_scores = [r.get("sleep_score", 0) for r in reports]
    pain_scores = [r.get("pain_score", 0) for r in reports]
    
    analysis = {
        "reports_count": len(reports),
        "sleep_avg": sum(sleep_scores) / len(sleep_scores),
        "pain_avg": sum(pain_scores) / len(pain_scores),
        "sleep_trend": "improving" if len(sleep_scores) > 1 and sleep_scores[-1] < sleep_scores[0] else "stable",
        "pain_trend": "improving" if len(pain_scores) > 1 and pain_scores[-1] < pain_scores[0] else "stable"
    }
    
    return {
        "status": "success",
        "platform": "sleep",
        "analysis": analysis,
        "reports": reports
    }
    
@app.post("/api/auth/switch-platform")
async def switch_platform(user_id: str, from_platform: str, to_platform: str):
    """在兩個平台間切換"""
    
    if user_id not in db.users:
        raise HTTPException(status_code=404, detail="用戶不存在")
    
    if to_platform not in ["schumann", "sleep"]:
        raise HTTPException(status_code=400, detail="無效的平台")
    
    # 確保用戶可訪問目標平台
    if to_platform not in db.user_platforms.get(user_id, []):
        if user_id not in db.user_platforms:
            db.user_platforms[user_id] = []
        db.user_platforms[user_id].append(to_platform)
    
    # 建立新平台的會話
    user = db.users[user_id]
    session = create_session(user_id, to_platform, user.get("role"))
    
    return {
        "status": "success",
        "message": f"已從 {from_platform} 切換到 {to_platform}",
        "previous_platform": from_platform,
        "current_platform": to_platform,
        "session": session,
        "user_platforms": db.user_platforms.get(user_id, [])
    }

# ==========================================
# 錯誤處理
# ==========================================

@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "status": "error",
            "detail": exc.detail,
            "timestamp": datetime.now().isoformat()
        }
    )

# ==========================================
# 啟動應用
# ==========================================

if __name__ == "__main__":
    import uvicorn
    
    # 把它們全部換成 settings.xxx 的寫法
    print("========================================")
    print(f"🚀 伺服器啟動中...")
    print(f"🌐 API 地址: http://{settings.api_host}:{settings.api_port}")
    print(f"📖 Swagger 測試文件: http://{settings.api_host}:{settings.api_port}/docs")
    print(f"🔒 CORS 允許前端: {settings.frontend_url}")
    print("========================================")
    
    # 注意這裡的 host, port 和 reload 也要改！
    uvicorn.run(
        "main:app", 
        host=settings.api_host, 
        port=settings.api_port, 
        reload=settings.debug
    )