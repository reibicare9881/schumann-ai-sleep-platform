"""
統一後端：舒曼共振平台 + 睡眠平台
Unified Backend: Schumann Platform + Sleep Platform
支持兩個應用的無縫切換
"""

import io
import json
from modules.parser_module import parse_schumann_report
from modules.ai_analyzer_module import generate_ai_explanation
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timedelta
from typing import Optional, Dict, List
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from supabase import create_client, Client
from dotenv import load_dotenv
from auth import create_access_token, get_current_user, require_admin
from config import settings
import uuid
import shutil
import tempfile
import os
from fastapi import File, UploadFile, Form
from passlib.context import CryptContext
from auth import create_access_token, get_current_user, require_admin, require_org_manager, require_member_or_above

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

# 建立密碼加密上下文
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_pin(plain_pin: str, hashed_pin: str) -> bool:
    """驗證明文 PIN 碼是否與 Hash 相符"""
    return pwd_context.verify(plain_pin, hashed_pin)

def get_pin_hash(pin: str) -> str:
    """將明文 PIN 碼轉換為 Hash 值 (未來新增單位時使用)"""
    return pwd_context.hash(pin)

# ==========================================
# 數據模型 (Pydantic Schemas)
# ==========================================

class LoginRequest(BaseModel):
    """登入請求"""
    platform: str  
    role: Optional[str] = "individual"  
    name: Optional[str] = None          
    pin: Optional[str] = None
    org_code: Optional[str] = None
    dept: Optional[str] = None

# --- 新增：為 AssessmentData 建立子模型 ---

class UserProfile(BaseModel):
    """使用者基本健康與職務資料"""
    name: str = Field(..., description="使用者姓名")
    age: int = Field(..., ge=0, le=120, description="年齡 (0-120歲)")
    gender: str = Field(..., description="性別 (male/female/other)")
    height: Optional[float] = Field(None, gt=0, description="身高 (cm)")
    weight: Optional[float] = Field(None, gt=0, description="體重 (kg)")
    
    # 職場資訊 (單位成員必填，個人可選)
    dept: Optional[str] = Field(None, description="部門")
    orgRole: Optional[str] = Field(None, description="職稱")
    industry: Optional[str] = Field(None, description="行業別")
    shiftWork: Optional[str] = Field(None, description="輪班情況")
    
    # 慢病史
    hypertension: Optional[str] = Field(None, description="高血壓狀態")
    diabetes: Optional[str] = Field(None, description="糖尿病狀態")
    hyperlipidemia: Optional[str] = Field(None, description="高血脂狀態")
    heartDisease: Optional[str] = Field(None, description="心臟疾病狀態")
    
    # 其他
    medications: Optional[str] = Field(None, description="目前長期用藥")
    painLocations: list[str] = Field(default_factory=list, description="疼痛部位清單")

class SleepScores(BaseModel):
    """睡眠品質評估 (ISI) 7題"""
    s1: int = Field(..., ge=0, le=4)
    s2: int = Field(..., ge=0, le=4)
    s3: int = Field(..., ge=0, le=4)
    s4: int = Field(..., ge=0, le=4)
    s5: int = Field(..., ge=0, le=4)
    s6: int = Field(..., ge=0, le=4)
    s7: int = Field(..., ge=0, le=4)

class PainScores(BaseModel):
    """疼痛影響評估 (BPI) 5題"""
    p1: int = Field(..., ge=0, le=10)
    p2: int = Field(..., ge=0, le=10)
    p3: int = Field(..., ge=0, le=10)
    p4: int = Field(..., ge=0, le=10)
    p5: int = Field(..., ge=0, le=10)

class WorkScores(BaseModel):
    """工作效率評估 3題"""
    w1: int = Field(..., ge=0, le=10)
    w2: int = Field(..., ge=0, le=10)
    w3: int = Field(..., ge=0, le=10)

class AssessmentData(BaseModel):
    """完整評估提交資料 (具備嚴格型別驗證)"""
    user_id: str = Field(..., description="提交者的 User ID")
    profile: UserProfile
    sleep_scores: SleepScores
    pain_scores: PainScores
    work_scores: WorkScores
    
class OrgSettingsUpdate(BaseModel):
    """單位 OKR/ESG 參數更新模型"""
    base_budget: Optional[float] = None
    activation_pct: Optional[float] = None
    value_multiplier: Optional[float] = None
    sick_days: Optional[float] = None
    daily_salary: Optional[float] = None
    ins_saving: Optional[float] = None
    prod_gain: Optional[float] = None
    impl_cost: Optional[float] = None
    eff_gain: Optional[float] = None
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
        "api_url": f"http://{settings.api_host}:{settings.api_port}"
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

@app.get("/api/auth/verify-org/{org_code}")
async def verify_org_code(org_code: str):
    """登入前動態驗證單位代碼並取得名稱 (不需 Token)"""
    # 這裡只 select org_name，絕不回傳 pin 碼等敏感資訊
    res = supabase.table("organizations").select("org_name").eq("org_code", org_code.upper()).execute()
    
    if not res.data:
        return {"status": "error", "message": "找不到此單位"}
        
    return {"status": "success", "data": {"org_name": res.data[0]["org_name"]}}

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
        
        # 2. 取得該角色對應的 Hash 密碼 (注意：資料庫裡存的必須要是 Hash 過的字串)
        expected_pin_hash = ""
        if request.role == "member":
            expected_pin_hash = org_data.get("member_pin")
        elif request.role == "dept_head":
            expected_pin_hash = org_data.get("dept_pin")
        elif request.role == "admin":
            expected_pin_hash = org_data.get("admin_pin")
        else:
             raise HTTPException(status_code=400, detail="未知的角色")
            
        # 🟢 修正：使用 bcrypt 進行安全比對，嚴禁使用 request.pin != expected_pin_hash
        if not expected_pin_hash or not pwd_context.verify(request.pin, expected_pin_hash):
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
            "platform": platform,
            "dept": request.dept or user_data.get("department"),
            "org_name": org_data.get("org_name", org_code) 
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
            "user_id": token_payload.get("uid"),
            "name": token_payload.get("name"),
            "role": token_payload.get("role"),
            "org_code": token_payload.get("org_code"),
            "org_name": token_payload.get("org_name")
        },
        # access_token 是安全核心，前端之後打 API 都要帶上它
        "access_token": access_token,
        "message": f"{platform} 平台登入成功"
    }

@app.post("/api/auth/logout")
async def logout(session_id: str, platform: str):
    """登出 (JWT 無狀態機制)"""
    # JWT 登出主要由前端清除 LocalStorage 來實現
    # 後端收到通知僅回傳成功即可
    return {"status": "success", "message": "已登出"}

@app.post("/api/auth/switch-platform")
async def switch_platform(
    user_id: str,
    from_platform: str,
    to_platform: str,
    current_user: dict = Depends(get_current_user)
):
    """處理平台切換並重新核發 JWT Token"""
    # 1. 安全防護：確保只能自己切換自己的平台
    if str(current_user.get("uid")) != user_id:
        raise HTTPException(status_code=403, detail="越權存取：無法切換他人的平台")
        
    # 2. 重新簽發新平台的 JWT Token
    # 這裡繼承原有的權限 (role, org_code)，但把 platform 標記換掉
    new_payload = {
        "uid": user_id,
        "role": current_user.get("role", "individual"),
        "org_code": current_user.get("org_code"),
        "platform": to_platform
    }
    
    # 產生新鑰匙
    new_token = create_access_token(new_payload)
    
    # 3. 回傳給前端覆蓋舊 Session
    return {
        "status": "success",
        "data": {
            "session": {
                "session_id": f"sess_{user_id[:8]}",
                "user_id": user_id,
                "platform": to_platform,
                "role": current_user.get("role", "individual"),
                "access_token": new_token
            }
        }
    }

# ==========================================
# 高風險分析 API (/api/org/*)
# ==========================================

@app.get("/api/org/records")
async def get_org_records(
    org_code: str, 
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    page: int = 1,                    
    size: int = 1000,
    current_user: dict = Depends(require_org_manager) 
):
    """獲取該單位成員的去識別化報告"""
    # 這裡已經保證對方絕對是 admin 或 dept_head 了，不用再寫 if 判斷角色
    
    if current_user.get("org_code") != org_code:
        raise HTTPException(status_code=403, detail="越權存取：只能查看所屬單位的資料")
        
    query = supabase.table("sleep_reports").select("*", count="exact").eq("org_code", org_code)
    
    if start_date:
        query = query.gte("created_at", start_date)
    if end_date:
        # 加上 23:59:59 確保包含結束日當天的所有資料
        query = query.lte("created_at", f"{end_date}T23:59:59")
    
    # 部門主管加上第二道鎖
    if current_user.get("role") == "dept_head":
        dept = current_user.get("dept")
        query = query.eq("profile->>dept", dept)

    start_idx = (page - 1) * size
    end_idx = start_idx + size - 1
    query = query.range(start_idx, end_idx).order("created_at", desc=True)
    
    res = query.execute()
    return {"status": "success", "data": res.data}


@app.put("/api/org/settings/{org_code}")
async def update_org_settings(
    org_code: str, 
    settings: OrgSettingsUpdate, 
    current_user: dict = Depends(require_admin)
):
    """更新單位 OKR/ESG 設定參數 (限管理員)"""
    # 這裡已經保證絕對是 admin 了
    if current_user.get("org_code") != org_code:
        raise HTTPException(status_code=403, detail="越權操作：無法修改其他單位的設定")

    update_data = {k: v for k, v in settings.model_dump().items() if v is not None}
    res = supabase.table("organizations").update(update_data).eq("org_code", org_code).execute()
    return {"status": "success", "data": res.data[0] if res.data else None}

@app.get("/api/org/settings/{org_code}")
async def get_org_settings(org_code: str):
    """獲取單位 OKR/ESG 設定參數"""
    
    # 從資料庫中抓取該單位的資料
    res = supabase.table("organizations").select("*").eq("org_code", org_code.upper()).execute()
    
    if not res.data:
        raise HTTPException(status_code=404, detail="找不到該單位的設定資料")
        
    # 將整包資料回傳，讓前端提取需要的 base_budget, sick_days 等參數
    return {"status": "success", "data": res.data[0]}


# ==========================================
# 睡眠平台預約 API (/api/appointment/*)
# ==========================================

class AppointmentCreate(BaseModel):
    """建立預約單模型"""
    user_id: str
    activity_type: Optional[str] = "自主健管" # 預留給未來擴充
    item_name: Optional[str] = None
    execution_date: str # 對應前端的 date
    appointment_time: str # 對應前端的 time
    service_type: str # 對應前端的 svc (schumann 或 laser)

@app.get("/api/appointments")
async def get_appointments(
    org_code: str,
    service_type: str,
    # 🛡️ 守門員 3 號：擋掉個人帳號
    current_user: dict = Depends(require_member_or_above)
):
    """獲取單位預約清單 (依據服務類型)"""
    if current_user.get("org_code") != org_code:
         raise HTTPException(status_code=403, detail="越權存取")

    query = supabase.table("appointments").select("*, profiles!inner(full_name, department)").eq("org_code", org_code).eq("service_type", service_type)
    
    if current_user.get("role") not in ["admin", "dept_head"]:
        query = query.eq("user_id", current_user.get("uid"))

    res = query.order("execution_date", desc=False).order("appointment_time", desc=False).execute()
    
    return {"status": "success", "data": res.data}

@app.post("/api/appointments")
async def create_appointment(
    appt: AppointmentCreate,
    current_user: dict = Depends(get_current_user)
):
    """新增預約單"""
    if current_user.get("uid") != appt.user_id:
         raise HTTPException(status_code=403, detail="越權操作：只能為自己預約")
         
    # 組裝寫入 Supabase 的資料 (讓 Supabase 自己生成 uuid)
    payload = {
        "user_id": appt.user_id,
        "org_code": current_user.get("org_code"),
        "activity_type": appt.activity_type,
        "item_name": appt.item_name,
        "execution_date": appt.execution_date,
        "appointment_time": appt.appointment_time,
        "service_type": appt.service_type,
        "status": "pending"
    }

    res = supabase.table("appointments").insert(payload).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="預約建立失敗")
        
    return {"status": "success", "data": res.data[0]}

@app.patch("/api/appointments/{appt_id}/status")
async def update_appointment_status(
    appt_id: str,
    status: str,
    # 🛡️ 守門員 2 號：擋掉一般成員自己審核自己的預約單
    current_user: dict = Depends(require_org_manager)
):
    """更新預約狀態 (核准/退回)"""
    # 因為 Depends 已經擋掉了，這裡可以把原本的 if 判斷刪除
    # if current_user.get("role") not in ["admin", "dept_head"]: ...
        
    res = supabase.table("appointments").update({"status": status}).eq("id", appt_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="找不到該預約單")
        
    return {"status": "success", "data": res.data[0]}

@app.delete("/api/appointments/{appt_id}")
async def delete_appointment(
    appt_id: str,
    current_user: dict = Depends(get_current_user)
):
    """刪除/取消預約單"""
    # 先查詢該預約單，確認權限
    res = supabase.table("appointments").select("*").eq("id", appt_id).execute()
    if not res.data:
         raise HTTPException(status_code=404, detail="找不到該預約單")
         
    appt = res.data[0]
    
    # 只有本人或管理層可以刪除
    if current_user.get("uid") != appt.get("user_id") and current_user.get("role") not in ["admin", "dept_head"]:
        raise HTTPException(status_code=403, detail="越權操作：無法刪除他人的預約")
        
    supabase.table("appointments").delete().eq("id", appt_id).execute()
    return {"status": "success", "message": "預約已刪除"}

# ==========================================
# 舒曼共振平台 API (/api/schumann/*)
# ==========================================

@app.post("/api/analyze")
async def analyze_schumann_report(
    file: UploadFile = File(...),
    user_id: str = Form(...),
    assessment_round: int = Form(1),
    language: str = Form("🇹🇼 繁體中文"),
    current_user: dict = Depends(get_current_user)
):
    
    if str(current_user.get("uid")) != user_id:
        raise HTTPException(status_code=403, detail="越權操作：您只能為自己的帳號上傳報告")
    
    tmp_path = ""
    try:
        # 🟢 優化 1：安全地將大型上傳檔案分塊寫入硬碟暫存檔，避免塞爆 RAM
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            shutil.copyfileobj(file.file, tmp)
            tmp_path = tmp.name

        # 🟢 優化 2：從檔名擷取名字
        extracted_name = None
        file_name_only = file.filename.split('.')[0]
        parts = file_name_only.split('_')
        if len(parts) >= 2 and parts[0] == "record":
            extracted_name = parts[1]

        # 🟢 優化 3：開啟磁碟上的暫存檔交給 Parser 處理
        with open(tmp_path, 'rb') as f:
            file_obj = io.BytesIO(f.read())
            file_obj.name = file.filename 
            parsed_data = parse_schumann_report(file_obj) 
        
        if extracted_name:
            parsed_data["Name"] = extracted_name

        # ... (下方保留你原本的「4. 呼叫 AI 撰寫深度解說報告」邏輯) ...
        try:
            ai_summary_dict = generate_ai_explanation(parsed_data, language=language)
            ai_summary_text = json.dumps(ai_summary_dict, ensure_ascii=False)
        except Exception as e:
            print(f"AI 報告生成失敗: {e}")
            ai_summary_text = None # 容錯機制：就算 AI 寫作失敗，原始數據還是要存進去

        # 5. 【關鍵轉換】將 AI 抓出的 JSON 映射到 Supabase 的蛇行欄位
        def safe_float(val):
            try: return float(val) if val not in ["未提供", "未知", "", None] else None
            except: return None
            
        def safe_int(val):
            try: return int(val) if val not in ["未提供", "未知", "", None] else None
            except: return None

        db_payload = {
            "user_id": user_id,
            "assessment_round": assessment_round,
            
            # 個人資料
            "name_extracted": str(parsed_data.get("Name", "")),
            "gender_extracted": str(parsed_data.get("Gender", "")),
            "age_extracted": safe_int(parsed_data.get("Age")),
            "occupation_extracted": str(parsed_data.get("Occupation", "")),
            # "experience_date": ... (日期格式若需轉換可在此處理)
            "subjective_conditions": str(parsed_data.get("Subjective_Conditions", "")),
            "experience_time_sec": safe_int(parsed_data.get("Experience_Time_Sec")),
            
            # 心率數據
            "hr_pre": safe_int(parsed_data.get("HR_Pre")),
            "hr_post": safe_int(parsed_data.get("HR_Post")),
            "hr_lowest": safe_int(parsed_data.get("HR_Lowest")),
            "hr_conclusion": str(parsed_data.get("HR_Conclusion", "")),
            
            # SDNN 數據
            "sdnn_pre": safe_float(parsed_data.get("SDNN_Pre")),
            "sdnn_post": safe_float(parsed_data.get("SDNN_Post")),
            "sdnn_lowest_trend": str(parsed_data.get("SDNN_Lowest_Trend", "")),
            "sdnn_conclusion": str(parsed_data.get("SDNN_Conclusion", "")),
            
            # 自律神經與陰陽
            "unity_index": safe_float(parsed_data.get("Unity_Index")),
            "balance_count": safe_int(parsed_data.get("Balance_Count")),
            "lf_hf_value": safe_float(parsed_data.get("LF_HF_Value")),
            "lf_hf_conclusion": str(parsed_data.get("LF_HF_Conclusion", "")),
            "lf_hf_trend": str(parsed_data.get("LF_HF_Trend", "")),
            "yin_yang": str(parsed_data.get("Yin_Yang", "")),
            
            # 生命之花圖譜
            "flower_colors": str(parsed_data.get("Flower_of_Life_Colors", "")),
            "flower_brightness_detail": str(parsed_data.get("Flower_of_Life_Brightness_Detail", "")),
            "flower_brightness": str(parsed_data.get("Flower_of_Life_Brightness", "")),
            "flower_shape": str(parsed_data.get("Flower_of_Life_Shape", "")),
            "flower_extent": str(parsed_data.get("Flower_of_Life_Extent", "")),
            
            # 象限圖
            "scatter_plot_analysis": str(parsed_data.get("Scatter_Plot_Analysis", "")),
            
            # 其他
            "ai_summary": ai_summary_text, # 若有產生 AI 建議可寫入
            "report_url": "" # 可後續擴充 PDF 儲存空間網址
        }

        # 6. 寫入 Supabase 資料庫
        res = supabase.table("analysis_records").insert(db_payload).execute()
        
        if not res.data:
            raise HTTPException(status_code=500, detail="寫入資料庫失敗")
            
        record_id = res.data[0]['id']

        return {
            "status": "success", 
            "record_id": record_id, 
            "report_url": f"/report/{record_id}" # 回傳一個假定的 URL 供前端跳轉
        }

    except Exception as e:
        print(f"分析錯誤: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    
    finally:
        # 🟢 優化 4：確保無論成功或失敗，硬碟上的暫存檔都會被刪除
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)

@app.get("/api/schumann/reports")
async def list_schumann_reports(
    user_id: str,
    current_user: dict = Depends(get_current_user)
):
    """獲取用戶舒曼報告列表 (連接 Supabase)"""
    # 權限驗證：只能看自己的，或者是管理員看同單位的
    is_owner = str(current_user.get("uid")) == user_id
    is_admin = current_user.get("role") in ["admin", "dept_head"]
    
    if not is_owner and not is_admin:
        raise HTTPException(status_code=403, detail="越權存取：無權查看此列表")
        
    # 從 analysis_records 資料表撈取舒曼報告
    res = supabase.table("analysis_records").select("*").eq("user_id", user_id).order("created_at", desc=True).execute()
    
    return {
        "status": "success",
        "platform": "schumann",
        "count": len(res.data) if res.data else 0,
        "reports": res.data if res.data else []
    }

@app.get("/api/schumann/reports/{report_id}")
async def get_schumann_report(
    report_id: str,
    current_user: dict = Depends(get_current_user)
):
    """獲取單份舒曼報告詳情 (連接 Supabase)"""
    res = supabase.table("analysis_records").select("*").eq("id", report_id).execute()
    
    if not res.data:
        raise HTTPException(status_code=404, detail="舒曼報告不存在")
        
    report = res.data[0]
    
    # 權限驗證
    is_owner = report.get("user_id") == current_user.get("uid")
    # 如果有 org_code 關聯，這裡也可以加入管理員判斷
    
    if not is_owner and current_user.get("role") not in ["admin", "dept_head"]:
        raise HTTPException(status_code=403, detail="越權存取：您無權查看此份報告")
        
    return {
        "status": "success",
        "platform": "schumann",
        "report": report
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
        "features": ["睡眠評估", "疼痛管理", "工作效率", "KPI統計", "OKR管理"]
    }

@app.post("/api/sleep/assessment", status_code=201)
async def submit_sleep_assessment(
    request: AssessmentData,
    # 🛡️ 守門員 3 號：擋掉個人帳號，因為此報告會計算 KPI，需要有 org_code
    current_user: dict = Depends(require_member_or_above)
):
    """提交睡眠評估"""
    if current_user.get("uid") != request.user_id:
        raise HTTPException(status_code=403, detail="越權操作：無法替其他使用者提交資料")

    sleep_score = sum(request.sleep_scores.model_dump().values())
    pain_score = sum(request.pain_scores.model_dump().values())
    work_score = sum(request.work_scores.model_dump().values())
    
    report_id = str(uuid.uuid4())
    
    report = {
        "id": report_id,
        "user_id": request.user_id,
        "org_code": current_user.get("org_code"), 
        "platform": "sleep",
        "created_at": datetime.now().isoformat(),
        "profile": request.profile.model_dump(),
        "sleep_score": sleep_score,
        "sleep_level": "green" if sleep_score <= 7 else "yellow" if sleep_score <= 14 else "orange" if sleep_score <= 21 else "red",
        "pain_score": pain_score,
        "pain_level": "green" if pain_score <= 12 else "yellow" if pain_score <= 25 else "orange" if pain_score <= 38 else "red",
        "work_score": work_score,
        "status": "completed"
    }
    
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