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
import fitz      # PyMuPDF
import requests
import tempfile
import os
from fastapi import Response
import uuid
import shutil
import tempfile
import os
import time
from fastapi import File, UploadFile, Form
from passlib.context import CryptContext
from google import genai
from google.genai import types
from modules.pdf_generator_module import create_full_report_pdf
from auth import create_access_token, get_current_user, require_admin, require_org_manager, require_member_or_above
from reibi_api import create_reibi_router
from reibi_batch_c import create_reibi_batch_c_router

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

# REIBI business and Artifact-import endpoints use the same authenticated,
# server-side Supabase client. No service-role credential is exposed to clients.
app.include_router(create_reibi_router(supabase))
app.include_router(create_reibi_batch_c_router(supabase))

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
            }
            # 🛡️ 加入防呆攔截，避免 Foreign Key 報錯導致伺服器崩潰
            try:
                insert_res = supabase.table("profiles").insert(new_user).execute()
                user_data = insert_res.data[0]
            except Exception as e:
                raise HTTPException(
                    status_code=500, 
                    detail="無法建立使用者。請確認 Supabase 中 profiles 資料表已解除對 auth.users 的外鍵 (Foreign Key) 限制。"
                )
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
            # 🛡️ 加入防呆攔截，避免 Foreign Key 報錯導致伺服器崩潰
            try:
                insert_res = supabase.table("profiles").insert(new_user).execute()
                user_data = insert_res.data[0]
            except Exception as e:
                raise HTTPException(
                    status_code=500, 
                    detail="無法建立單位成員。請確認 Supabase 中 profiles 資料表已解除對 auth.users 的外鍵 (Foreign Key) 限制。"
                )
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
async def get_org_settings(
    org_code: str,
    current_user: dict = Depends(require_org_manager),
):
    """獲取所屬單位的 OKR/ESG 設定參數（限管理員與部門主管）。"""
    normalized_org_code = org_code.upper()
    if current_user.get("org_code") != normalized_org_code:
        raise HTTPException(status_code=403, detail="越權存取：只能查看所屬單位的設定")

    # 明確列出非敏感欄位，避免 member/dept/admin PIN hash 被回傳。
    public_settings_columns = (
        "org_code,org_name,base_budget,activation_pct,value_multiplier,"
        "sick_days,daily_salary,ins_saving,impl_cost,eff_gain,prod_gain,created_at"
    )
    res = (
        supabase.table("organizations")
        .select(public_settings_columns)
        .eq("org_code", normalized_org_code)
        .execute()
    )
    
    if not res.data:
        raise HTTPException(status_code=404, detail="找不到該單位的設定資料")
        
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
        public_url = ""
        try:
            file_ext = file.filename.split('.')[-1].lower()
            safe_name = f"report_{user_id}_{int(time.time())}.{file_ext}"
            
            with open(tmp_path, 'rb') as f:
                file_bytes = f.read()
                
            supabase.storage.from_("reports").upload(
                file=file_bytes,
                path=safe_name,
                file_options={"content-type": file.content_type}
            )
            public_url = supabase.storage.from_("reports").get_public_url(safe_name)
        except Exception as e:
            print(f"上傳至 Storage 失敗: {e}")
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
            "report_url": public_url
        }

        # 6. 寫入 Supabase 資料庫
        res = supabase.table("analysis_records").insert(db_payload).execute()
        
        if not res.data:
            raise HTTPException(status_code=500, detail="寫入資料庫失敗")
            
        record_id = res.data[0]['id']

        return {
            "status": "success", 
            "record_id": record_id, 
            "report_url": f"/report/{record_id}",
            "ai_summary": ai_summary_dict,
            "personal_info": {
                "name": str(parsed_data.get("Name", "未知")),
                "gender": str(parsed_data.get("Gender", "未知")),
                "age": str(parsed_data.get("Age", "未知")),
                "date": str(parsed_data.get("Experience_Date", "未知"))
            }
        }

    except Exception as e:
        print(f"分析錯誤: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    
    finally:
        # 🟢 優化 4：確保無論成功或失敗，硬碟上的暫存檔都會被刪除
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)

@app.get("/api/schumann/trend/{user_id}")
async def get_schumann_trend(user_id: str, current_user: dict = Depends(get_current_user)):
    try:
        # 1. 確保只能看自己的，或是管理員/主管才能看別人的 (權限防護)
        if current_user["system_role"] == "individual" and current_user["id"] != user_id:
            raise HTTPException(status_code=403, detail="權限不足")

        # 2. 從 Supabase 撈取該使用者的所有舒曼紀錄，並按時間排序 (舊到新)
        res = supabase.table("records") \
            .select("created_at, ai_summary") \
            .eq("user_id", user_id) \
            .eq("platform", "schumann") \
            .order("created_at") \
            .execute()
        
        records = res.data
        if not records:
            return {"status": "success", "data": [], "message": "尚無歷史紀錄"}

        # 3. 整理成前端圖表好渲染的陣列格式
        trend_data = []
        for record in records:
            # 假設您的 ai_summary 裡面有這些萃取好的數值 (請依您實際的 JSON key 調整)
            summary = record.get("ai_summary", {})
            date_str = record["created_at"][:10] # 取 YYYY-MM-DD
            
            trend_data.append({
                "date": date_str,
                "sdnn": summary.get("sdnn", 0), # 自律神經整體活性
                "lf_hf_ratio": summary.get("lf_hf_ratio", 0), # 交感/副交感平衡
                "vitality_score": summary.get("vitality_score", 0) # 綜合活力指數
            })

        # 4. 計算結論 (例如：最新一次比起第一次是否進步)
        is_improving = False
        if len(trend_data) > 1:
            is_improving = trend_data[-1]["sdnn"] > trend_data[0]["sdnn"]

        return {
            "status": "success", 
            "data": trend_data,
            "trend_summary": "improving" if is_improving else "needs_attention"
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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

@app.get("/api/pdf/{record_id}")
async def get_merged_pdf(record_id: str, current_user: dict = Depends(get_current_user)):
    """
    1. 從 Supabase 抓取分析紀錄
    2. 產生 AI 文字/表格報告 PDF
    3. 下載儲存在 Storage 的原始 PDF
    4. 使用 PyMuPDF 縫合兩者並回傳
    """
    try:
        # 1. 抓取資料庫紀錄
        res = supabase.table("analysis_records").select("*").eq("id", record_id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="找不到分析紀錄")
        
        record_data = res.data[0]
        # 解析 AI 摘要內容 (原本存的是字串)
        ai_summary_dict = json.loads(record_data.get("ai_summary", "{}"))
        report_url = record_data.get("report_url")

        # 2. 呼叫 generator 產生原生向量 PDF (報告部分)
        # 注意：這裡我們暫時不傳入 uploaded_file，因為等一下要用 fitz 合併
        pdf_report, success = create_full_report_pdf(ai_summary_dict, language="🇹🇼 繁體中文")
        if not success:
            raise HTTPException(status_code=500, detail="產生報告 PDF 失敗")

        # 將 FPDF 產生的報告轉為 bytes
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            pdf_report.output(tmp.name)
            with open(tmp.name, "rb") as f:
                report_pdf_bytes = f.read()
        os.remove(tmp.name)

        # 3. 建立終極合併文件
        final_pdf = fitz.open()

        # 4. 核心縫合邏輯：先放「原始 PDF」
        if report_url and report_url.startswith("http"):
            try:
                response = requests.get(report_url, timeout=10)
                if response.status_code == 200:
                    orig_doc = fitz.open(stream=response.content, filetype="pdf")
                    final_pdf.insert_pdf(orig_doc)
            except Exception as e:
                print(f"⚠️ 下載或合併原始 PDF 失敗: {e}")

        # 5. 再接上「AI 分析報告」
        report_doc = fitz.open(stream=report_pdf_bytes, filetype="pdf")
        final_pdf.insert_pdf(report_doc)

        # 6. 回傳合併後的二進制檔案
        return Response(
            content=final_pdf.write(),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=Schumann_Report_{record_id}.pdf"
            }
        )

    except Exception as e:
        print(f"❌ PDF 處理發生錯誤: {str(e)}")
        raise HTTPException(status_code=500, detail=f"PDF 處理失敗: {str(e)}")

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


@app.post("/api/sleep/assessment", status_code=201)
async def submit_sleep_assessment(
    request: AssessmentData,
    # 允許個人模式也能提交睡眠評估，只要是本人即可
    current_user: dict = Depends(get_current_user)
):
    """提交睡眠評估"""
    if current_user.get("uid") != request.user_id:
        raise HTTPException(status_code=403, detail="越權操作：無法替其他使用者提交資料")

    sleep_score = sum(request.sleep_scores.model_dump().values())
    pain_score = sum(request.pain_scores.model_dump().values())
    work_score = sum(request.work_scores.model_dump().values())
    
    client = genai.Client(api_key=settings.gemini_api_key)
    
    prompt = f"""
    請根據此使用者的健康與背景資料，提供客製化的衛教建議：
    - 基本資料：{request.profile.age}歲，性別：{request.profile.gender}
    - 職場狀況：{request.profile.industry}，輪班：{request.profile.shiftWork}
    - 慢病史：高血壓({request.profile.hypertension})、糖尿病({request.profile.diabetes})
    - 睡眠品質(ISI)：{sleep_score}/28 (越高代表失眠越嚴重)
    - 疼痛影響(BPI)：{pain_score}/50 (越高代表疼痛越嚴重)
    - 疼痛部位：{", ".join(request.profile.painLocations) if request.profile.painLocations else "無"}

    請嚴格回傳包含以下 key 的 JSON 格式。文字請保持溫暖、專業，並具體針對他的「痛點部位」、「慢病」與「輪班情況」給予對應的建議：
    {{
        "generalHealth": "綜合健康方針...",
        "sleepEducation": "睡眠衛教建議...",
        "painEducation": "疼痛衛教建議...",
        "dietaryAdvice": "飲食衛教建議...",
        "physicalTherapy": "物理治療建議...",
        "reibiProducts": "REIBI舒曼波與雷射介入建議..."
    }}
    """
    
    try:
        ai_res = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json"
            )
        )
        custom_recs = json.loads(ai_res.text)
    except Exception as e:
        print(f"AI 生成衛教建議失敗: {e}")
        custom_recs = None
    
    report_id = str(uuid.uuid4())
    
    report = {
        "id": report_id,
        "user_id": request.user_id,
        "org_code": current_user.get("org_code"),
        "platform": "sleep",
        "created_at": datetime.now().isoformat(),
        "profile": request.profile.model_dump(),
        "sleep_score": sleep_score,
        "sleep_scores": request.sleep_scores.model_dump(),
        "sleep_level": "green" if sleep_score <= 7 else "yellow" if sleep_score <= 14 else "orange" if sleep_score <= 21 else "red",
        "pain_score": pain_score,
        "pain_scores": request.pain_scores.model_dump(),
        "pain_level": "green" if pain_score <= 12 else "yellow" if pain_score <= 25 else "orange" if pain_score <= 38 else "red",
        "work_score": work_score,
        "work_scores": request.work_scores.model_dump(),
        "status": "completed",
        "recs": custom_recs
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
# 歷史紀錄整合 API
# ==========================================
@app.get("/api/history/{user_id}")
async def get_user_history(user_id: str, current_user: dict = Depends(get_current_user)):
    try:
        # 權限防護：個人用戶只能看自己的，管理員/主管可以看轄下員工的
        if current_user["system_role"] == "individual" and current_user["id"] != user_id:
            raise HTTPException(status_code=403, detail="權限不足，無法存取他人歷史紀錄")

        # 從 Supabase 撈取該使用者的所有紀錄，不分平台，依時間由新到舊排序
        res = supabase.table("records") \
            .select("*") \
            .eq("user_id", user_id) \
            .order("created_at", desc=True) \
            .execute()
        
        return {"status": "success", "data": res.data}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
# ==========================================
# 撈取最新資料
# ==========================================

@app.get("/api/sleep/latest-profile/{user_id}")
async def get_latest_profile(user_id: str, current_user: dict = Depends(get_current_user)):
    # 安全檢查：確保個人用戶只能存取自己的資料
    if current_user.get("system_role") == "individual" and current_user.get("id") != user_id:
        raise HTTPException(status_code=403, detail="權限不足")
        
    try:
        # 撈取該使用者最新的一筆報告紀錄
        res = supabase.table("sleep_reports") \
            .select("profile") \
            .eq("user_id", user_id) \
            .order("created_at", desc=True) \
            .limit(1) \
            .execute()
            
        if res.data and len(res.data) > 0:
            return {"status": "success", "profile": res.data[0]["profile"]}
        else:
            return {"status": "success", "profile": None, "message": "無歷史紀錄"}
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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
# AI 獨立歷史趨勢分析 API
# ==========================================
@app.post("/api/ai-trend/{user_id}")
async def generate_ai_trend_analysis(
    user_id: str, 
    platform: str = "sleep", 
    current_user: dict = Depends(get_current_user)
):
    # 1. 權限防護
    if current_user.get("uid") != user_id and current_user.get("role") not in ["admin", "dept_head"]:
        raise HTTPException(status_code=403, detail="越權存取")

    history_text = []
    prompt = ""

    # ================= 睡眠分析模式 =================
    if platform == "sleep":
        res = supabase.table("sleep_reports").select("created_at, sleep_score, pain_score").eq("user_id", user_id).order("created_at").execute()
        for r in res.data:
            date = r["created_at"][:10]
            history_text.append(f"[{date}] 睡眠ISI: {r['sleep_score']}/28, 疼痛BPI: {r['pain_score']}/50")
        
        if len(history_text) < 2:
            raise HTTPException(status_code=400, detail="至少需要 2 筆睡眠歷史資料才能進行趨勢分析")
            
        prompt = f"""
        你是一位專業的「睡眠與疼痛健康顧問」。請根據以下使用者過去一段時間的評估紀錄，為他撰寫一份「睡眠與疼痛改善分析報告」。
        
        【歷史紀錄 (分數越低越好)】：
        {chr(10).join(history_text)}
        
        請用繁體中文撰寫，並使用 Markdown 排版：
        1. **📈 趨勢洞察**：分析睡眠與疼痛是進步或退步。
        2. **🔍 關鍵發現**：點出數據中特別的變化或停滯期。
        3. **💡 改善建議**：給予具體的生活作息建議。
        """

    # ================= 舒曼分析模式 =================
    elif platform == "schumann":
        res = supabase.table("analysis_records").select("created_at, ai_summary").eq("user_id", user_id).order("created_at").execute()
        for r in res.data:
            date = r["created_at"][:10]
            try:
                summary = json.loads(r["ai_summary"]) if isinstance(r["ai_summary"], str) else r.get("ai_summary", {})
                sdnn = summary.get("SDNN_Post", "未知")
                lf_hf = summary.get("LF_HF_Value", "未知")
                history_text.append(f"[{date}] SDNN(自律神經): {sdnn} ms, 交感/副交感比例: {lf_hf}")
            except:
                continue

        if len(history_text) < 2:
            raise HTTPException(status_code=400, detail="至少需要 2 筆舒曼歷史資料才能進行趨勢分析")
            
        prompt = f"""
        你是一位專業的「自律神經與能量健康顧問」。請根據以下使用者過去一段時間的舒曼共振檢測紀錄，撰寫一份「自律神經趨勢分析報告」。
        
        【歷史紀錄】：
        {chr(10).join(history_text)}
        
        請用繁體中文撰寫，並使用 Markdown 排版：
        1. **📈 趨勢洞察**：分析 SDNN (總活性/抗壓性) 與交感/副交感平衡的長期變化趨勢。
        2. **🔍 關鍵發現**：點出數據中特別的變化。
        3. **💡 改善建議**：給予對應的身心放鬆或理療建議。
        """
    else:
        raise HTTPException(status_code=400, detail="未知的平台參數")

    # 呼叫 Gemini AI
    try:
        client = genai.Client(api_key=settings.gemini_api_key)
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt
        )
        return {"status": "success", "ai_analysis": response.text, "platform": platform}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI 分析失敗: {str(e)}")
# ==========================================
# 啟動應用
# ==========================================

# if __name__ == "__main__":
#     import uvicorn
    
#     # 把它們全部換成 settings.xxx 的寫法
#     print("========================================")
#     print(f"🚀 伺服器啟動中...")
#     print(f"🌐 API 地址: http://{settings.api_host}:{settings.api_port}")
#     print(f"📖 Swagger 測試文件: http://{settings.api_host}:{settings.api_port}/docs")
#     print(f"🔒 CORS 允許前端: {settings.frontend_url}")
#     print("========================================")
    
#     # 注意這裡的 host, port 和 reload 也要改！
#     uvicorn.run(
#         "main:app", 
#         host=settings.api_host, 
#         port=settings.api_port, 
#         reload=settings.debug
#     )
