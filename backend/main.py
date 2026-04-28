"""
統一後端：舒曼共振平台 + 睡眠平台
Unified Backend: Schumann Platform + Sleep Platform
支持兩個應用的無縫切換
"""

import os
import json
from datetime import datetime, timedelta
from typing import Optional, Dict, List
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from dotenv import load_dotenv

# ==========================================
# 加載環境變數
# ==========================================
load_dotenv()

API_HOST = os.getenv("API_HOST", "0.0.0.0")
API_PORT = int(os.getenv("API_PORT", 8000))
DEBUG = os.getenv("DEBUG", "True") == "True"
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

# ==========================================
# 初始化 FastAPI 應用
# ==========================================
app = FastAPI(
    title="統一多平台 API",
    description="舒曼共振平台 + 睡眠平台 統一後端服務",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# ==========================================
# CORS 設定
# ==========================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        FRONTEND_URL,
        "*" if DEBUG else []
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

# ==========================================
# 數據模型
# ==========================================

class LoginRequest(BaseModel):
    """登入請求"""
    platform: str  # "schumann" 或 "sleep"
    role: Optional[str] = None  # 睡眠平台用
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
    """統一登入 - 支持舒曼和睡眠平台"""
    
    platform = request.platform.lower()
    
    if platform == "schumann":
        # 舒曼共振平台：簡單登入
        user_id = f"schumann_user_{int(datetime.now().timestamp())}"
        user = {
            "id": user_id,
            "username": f"舒曼用戶_{user_id[-4:]}",
            "platform": "schumann",
            "created_at": datetime.now().isoformat()
        }
        db.users[user_id] = user
        session = create_session(user_id, "schumann")
        
        return {
            "status": "success",
            "platform": "schumann",
            "user": user,
            "session": session,
            "message": "舒曼共振平台登入成功"
        }
    
    elif platform == "sleep":
        # 睡眠平台：需驗證角色和PIN
        if request.role == "individual":
            # 個人用戶不需PIN
            user_id = f"sleep_user_{int(datetime.now().timestamp())}"
            user = {
                "id": user_id,
                "username": "個人用戶",
                "platform": "sleep",
                "role": "individual",
                "created_at": datetime.now().isoformat()
            }
        else:
            # 組織用戶需驗證PIN
            if not verify_pin(request.role, request.pin):
                raise HTTPException(status_code=401, detail="PIN 碼錯誤")
            if not request.org_code:
                raise HTTPException(status_code=400, detail="組織用戶需提供 org_code")
            
            user_id = f"sleep_user_{request.org_code}_{int(datetime.now().timestamp())}"
            user = {
                "id": user_id,
                "username": f"{request.role} 用戶",
                "platform": "sleep",
                "role": request.role,
                "org_code": request.org_code,
                "created_at": datetime.now().isoformat()
            }
        
        db.users[user_id] = user
        session = create_session(user_id, "sleep", request.role)
        
        return {
            "status": "success",
            "platform": "sleep",
            "user": user,
            "session": session,
            "message": f"睡眠平台登入成功"
        }
    
    else:
        raise HTTPException(status_code=400, detail=f"不支持的平台: {platform}")

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
    return {
        "platform": "sleep",
        "status": "healthy",
        "total_reports": len(db.sleep_reports),
        "features": ["睡眠評估", "疼痛管理", "工作效率", "KPI統計", "OKR管理"]
    }

@app.post("/api/sleep/assessment", status_code=201)
async def submit_sleep_assessment(request: AssessmentData):
    """提交睡眠評估"""
    sleep_score = sum(request.sleep_scores.values())
    pain_score = sum(request.pain_scores.values())
    work_score = sum(request.work_scores.values())
    
    report_id = f"sleep_report_{int(datetime.now().timestamp())}"
    report = {
        "id": report_id,
        "user_id": request.user_id,
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
    
    db.sleep_reports[report_id] = report
    
    return {
        "status": "success",
        "platform": "sleep",
        "report_id": report_id,
        "message": "睡眠評估已提交",
        "report": report
    }

@app.get("/api/sleep/reports")
async def list_sleep_reports(user_id: str):
    """獲取用戶睡眠報告列表"""
    reports = [r for r in db.sleep_reports.values() if r.get("user_id") == user_id]
    return {
        "status": "success",
        "platform": "sleep",
        "count": len(reports),
        "reports": reports
    }

@app.get("/api/sleep/reports/{report_id}")
async def get_sleep_report(report_id: str):
    """獲取單份睡眠報告"""
    report = db.sleep_reports.get(report_id)
    if not report:
        raise HTTPException(status_code=404, detail="睡眠報告不存在")
    
    return {
        "status": "success",
        "platform": "sleep",
        "report": report
    }

@app.get("/api/sleep/analysis/{user_id}")
async def get_sleep_analysis(user_id: str):
    """獲取睡眠趨勢分析"""
    reports = [r for r in db.sleep_reports.values() if r.get("user_id") == user_id]
    
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
    print(f"""
    🚀 統一多平台 API 正在啟動...
    
    🌐 API 地址: http://{API_HOST}:{API_PORT}
    📚 文檔: http://{API_HOST}:{API_PORT}/docs
    📖 SwaggerUI: http://localhost:8000/docs
    
    ✨ 支持平台:
       • 舒曼共振平台 (/api/schumann/*)
       • 睡眠健康平台 (/api/sleep/*)
    
    ✅ Debug 模式: {DEBUG}
    ⏱️ 啟動時間: {datetime.now().isoformat()}
    """)
    
    uvicorn.run(
        app,
        host=API_HOST,
        port=API_PORT,
        reload=False  # 改為 False 避免警告
    )
