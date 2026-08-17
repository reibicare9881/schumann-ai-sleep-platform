from __future__ import annotations

import json
import math
import re
import uuid
from datetime import date, datetime, timezone
from typing import Any, Callable, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from google import genai
from google.genai import types
from pydantic import BaseModel, ConfigDict, Field

from auth import get_current_user
from config import settings
from roles import has_permission


# 組織分析與報告改由 roles.py 的權限推導；跨企業名冊與 AI 報告產生仍限 reibi_super。
SUPER_ROLE = "reibi_super"
PERSONAL_ROLES = {"individual", "member", "dept_head"}
REPORT_TYPES = {"esg", "okr", "highrisk", "kpi", "roi", "plan888", "gri", "ohs", "cross_org"}
GEMINI_MODEL = "gemini-2.5-flash"

DEFAULT_ANALYTICS_SETTINGS: dict[str, float | int] = {
    "headcount": 1000,
    "improve_rate": 60,
    "sick_days_reduced": 2,
    "avg_daily_salary": 3200,
    "avg_monthly_salary": 50000,
    "insurance_saving": 12000,
    "productivity_gain": 15,
    "implement_cost": 6000000,
    "d_layer_cost": 90000,
    "participant_boost": 12,
}

PLAN_888_TIMELINE = [
    {"week": 1, "title": "基線建立", "actions": ["完成第一次健康評估", "確認三高與身心健康基線"], "target": "評估完成率 ≥50%"},
    {"week": 2, "title": "識能啟動", "actions": ["說明三個 80% 目標", "啟動 22 項健康行動"], "target": "行動開始率 ≥50%"},
    {"week": 3, "title": "睡眠介入", "actions": ["睡眠日記", "固定作息與睡眠衛教"], "target": "睡眠日誌參與率 ≥50%"},
    {"week": 4, "title": "疼痛介入", "actions": ["疼痛日誌", "人體工學與伸展行動"], "target": "疼痛追蹤率 ≥50%"},
    {"week": 5, "title": "身心支持", "actions": ["PHQ-4／PSS-4／MHI", "EAP 資源宣導"], "target": "身心評估完成率 ≥60%"},
    {"week": 6, "title": "中期檢視", "actions": ["完成第二次健康評估", "高風險者專業轉介"], "target": "中期複評率 ≥70%"},
    {"week": 7, "title": "成效追蹤", "actions": ["完成第三次健康評估", "核對 GRI 403-6 指標"], "target": "三次評估完成率 ≥75%"},
    {"week": 8, "title": "成果揭露", "actions": ["產生 KPI／OKR／ESG／ROI 報告", "規劃下一循環"], "target": "三個 80% 指標 ≥80%"},
]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class AnalyticsSettingsWrite(StrictModel):
    headcount: int = Field(ge=1, le=1000000)
    improve_rate: float = Field(ge=0, le=100)
    sick_days_reduced: float = Field(ge=0, le=365)
    avg_daily_salary: float = Field(ge=0, le=10000000)
    avg_monthly_salary: float = Field(ge=0, le=100000000)
    insurance_saving: float = Field(ge=0, le=100000000)
    productivity_gain: float = Field(ge=0, le=100)
    implement_cost: float = Field(gt=0, le=1000000000000)
    d_layer_cost: float = Field(ge=0, le=1000000000000)
    participant_boost: float = Field(ge=0, le=100)


class ReportGenerate(StrictModel):
    report_type: Literal["esg", "okr", "highrisk", "kpi", "roi", "plan888", "gri", "ohs", "cross_org"]
    period_start: Optional[date] = None
    period_end: Optional[date] = None
    department_key: Optional[str] = Field(None, max_length=120)


class ResearchConsentWrite(StrictModel):
    research_opt_in: bool


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _execute(query: Any, message: str) -> list[dict[str, Any]]:
    try:
        response = query.execute()
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=message) from exc
    return response.data or []


def _rpc(client: Any, name: str, params: dict[str, Any], message: str) -> Any:
    try:
        response = client.rpc(name, params).execute()
    except Exception as exc:
        raise HTTPException(status_code=502, detail=message) from exc
    return response.data


def _require(user: dict[str, Any], roles: set[str], detail: str) -> dict[str, Any]:
    if user.get("role") not in roles:
        raise HTTPException(status_code=403, detail=detail)
    return user


def _require_any_permission(user: dict[str, Any], permissions: tuple[str, ...], detail: str) -> dict[str, Any]:
    if not any(has_permission(user, permission) for permission in permissions):
        raise HTTPException(status_code=403, detail=detail)
    return user


def can_view_financial_figures(user: dict[str, Any]) -> bool:
    """跨企業彙整裡的金額只給具備財務職掌的角色，與 L5 總覽的裁切一致。"""
    return has_permission(user, "org_finance") or has_permission(user, "finance_manage")


def require_org_analytics(user: dict = Depends(get_current_user)) -> dict:
    return _require_any_permission(
        user, ("org_analytics", "department_analytics"), "沒有組織分析權限"
    )


def require_org_report(user: dict = Depends(get_current_user)) -> dict:
    return _require_any_permission(user, ("org_reports",), "限具備組織報告權限的帳號產生 AI 組織報告")


def require_super(user: dict = Depends(get_current_user)) -> dict:
    return _require(user, {SUPER_ROLE}, "限 REIBI 內部超級管理者")


def require_cross_org_analytics(user: dict = Depends(get_current_user)) -> dict:
    return _require_any_permission(user, ("cross_org_analytics",), "沒有跨企業分析權限")


def require_personal(user: dict = Depends(get_current_user)) -> dict:
    return _require(user, PERSONAL_ROLES, "此帳號沒有個人研究同意設定")


def _profile_id(user: dict[str, Any]) -> str:
    value = str(user.get("uid") or "")
    try:
        uuid.UUID(value)
    except (ValueError, AttributeError):
        raise HTTPException(status_code=401, detail="登入資訊缺少有效使用者 ID")
    return value


def _org_scope(user: dict[str, Any], requested: Optional[str] = None, *, allow_super: bool = False) -> str:
    if allow_super and user.get("role") == SUPER_ROLE:
        value = requested
    else:
        value = user.get("org_code")
        if requested and value and requested.upper() != str(value).upper():
            raise HTTPException(status_code=403, detail="不可存取其他單位資料")
    value = str(value).strip().upper() if value else ""
    if not value or len(value) > 40 or any(ch not in "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-" for ch in value):
        raise HTTPException(status_code=422, detail="缺少有效單位代碼")
    return value


def calculate_roi(values: dict[str, Any]) -> dict[str, Any]:
    p = {**DEFAULT_ANALYTICS_SETTINGS, **values}
    headcount = int(p["headcount"])
    improve_rate = float(p["improve_rate"]) / 100
    improved_people = round(headcount * improve_rate)
    sick_leave_saving = round(float(p["sick_days_reduced"]) * float(p["avg_daily_salary"]) * headcount)
    insurance_saving = round(float(p["insurance_saving"]) * headcount)
    productivity_saving = round(
        (float(p["avg_monthly_salary"]) / 22)
        * (float(p["productivity_gain"]) / 100)
        * 240
        * improved_people
    )
    annual_benefit = sick_leave_saving + insurance_saving + productivity_saving
    cost = float(p["implement_cost"])
    scenarios: dict[str, Any] = {}
    for key, multiplier in (("conservative", 0.6), ("neutral", 1.0), ("optimistic", 1.4)):
        benefit = round(annual_benefit * multiplier)
        scenarios[key] = {
            "multiplier": multiplier,
            "annual_benefit": benefit,
            "three_year_net_roi_percent": round(((benefit * 3 - cost) / cost) * 100),
            "payback_months": None if benefit <= 0 else math.ceil(cost / benefit * 12),
            "return_per_dollar": round(benefit * 3 / cost, 2),
            "yearly_net_values": [round(benefit * year - cost) for year in range(4)],
        }
    boosted_people = round(headcount * float(p["participant_boost"]) / 100)
    return {
        "parameters": p,
        "improved_people": improved_people,
        "sick_leave_saving": sick_leave_saving,
        "insurance_saving": insurance_saving,
        "productivity_saving": productivity_saving,
        "annual_benefit": annual_benefit,
        "scenarios": scenarios,
        "d_layer": {
            "cost": round(float(p["d_layer_cost"])),
            "additional_participants": boosted_people,
            "estimated_annual_benefit": round(boosted_people * float(p["avg_daily_salary"]) * 0.5),
        },
        "disclaimer": "WPAI 情境試算，不構成財務承諾；參數應由單位依實際資料確認。",
    }


def calculate_mhi_from_averages(assessments: dict[str, Any]) -> Optional[float]:
    parts: list[float] = []
    if assessments.get("phq4_average") is not None:
        parts.append(max(0, 100 - float(assessments["phq4_average"]) / 12 * 100))
    if assessments.get("pss4_average") is not None:
        parts.append(max(0, 100 - float(assessments["pss4_average"]) / 16 * 100))
    if assessments.get("mind3_average") is not None:
        parts.append(float(assessments["mind3_average"]) / 9 * 100)
    return round(sum(parts) / len(parts), 1) if parts else None


def calculate_kpis(snapshot: dict[str, Any]) -> dict[str, Any]:
    metrics = snapshot.get("metrics") or {}
    sleep, pain, assessments = metrics.get("sleep", {}), metrics.get("pain", {}), metrics.get("assessments", {})
    sleep_n, pain_n = int(sleep.get("sample_size") or 0), int(pain.get("sample_size") or 0)
    overwork_n = int(assessments.get("overwork_count") or 0)
    return {
        "sleep_good_rate": None if sleep_n < 5 else round(int(sleep.get("green") or 0) / sleep_n * 100, 1),
        "pain_mild_rate": None if pain_n < 5 else round(int(pain.get("green") or 0) / pain_n * 100, 1),
        "sleep_high_risk_rate": None if sleep_n < 5 else round((int(sleep.get("orange") or 0) + int(sleep.get("red") or 0)) / sleep_n * 100, 1),
        "pain_high_risk_rate": None if pain_n < 5 else round((int(pain.get("orange") or 0) + int(pain.get("red") or 0)) / pain_n * 100, 1),
        "overwork_high_risk_rate": None if overwork_n < 5 else round(int(assessments.get("overwork_high_risk") or 0) / overwork_n * 100, 1),
        "mhi_average": calculate_mhi_from_averages(assessments),
        "targets": {"sleep_good_rate": 80, "pain_mild_rate": 80, "overwork_high_risk_rate_max": 20},
    }


def calculate_plan888(snapshot: dict[str, Any], vitals: dict[str, Any], interview_count: int) -> dict[str, Any]:
    sample = int(snapshot.get("sample_size") or 0)
    vital_metrics = vitals.get("metrics") or {}
    vital_sample = int(vitals.get("sample_size") or 0)
    filled = max(
        int(vital_metrics.get("bp_filled") or 0),
        int(vital_metrics.get("glucose_filled") or 0),
        int(vital_metrics.get("ldl_filled") or 0),
    )
    controlled = sum(int(vital_metrics.get(key) or 0) for key in ("bp_controlled", "glucose_controlled", "ldl_controlled"))
    control_denominator = sum(int(vital_metrics.get(key) or 0) for key in ("bp_filled", "glucose_filled", "ldl_filled"))
    return {
        "three_80": {
            "early_detection": None if vital_sample < 5 else round(filled / vital_sample * 100, 1),
            "lifestyle_counseling": None if sample < 5 or interview_count < 5 else round(min(interview_count, sample) / sample * 100, 1),
            "effective_control": None if control_denominator < 5 else round(controlled / control_denominator * 100, 1),
        },
        "target": 80,
        "timeline": PLAN_888_TIMELINE,
        "notes": [
            "三高指標僅納入明確同意部門彙整者，且樣本數需達 5。",
            "生活諮商率以去識別化面談記錄數估算，不宣稱為個人層級交叉比對。",
        ],
    }


def build_gri(snapshot: dict[str, Any], kpis: dict[str, Any], plan888: dict[str, Any], roi: dict[str, Any]) -> list[dict[str, Any]]:
    return [
        {"standard": "GRI 403-6", "title": "促進員工健康", "content": f"平台提供睡眠、疼痛、身心健康、過勞、EAP 與 888 計畫；本期去識別化樣本數為 {snapshot.get('sample_size', 0)}。"},
        {"standard": "GRI 403-6a", "title": "健康促進服務取得", "content": "員工可自主使用健康評估、日誌、行動積分及專業轉介資源；拒絕研究使用不影響服務權益。"},
        {"standard": "GRI 403-9", "title": "在職失能與健康風險", "content": f"睡眠高風險率 {kpis.get('sleep_high_risk_rate')}%；疼痛高風險率 {kpis.get('pain_high_risk_rate')}%；過勞高風險率 {kpis.get('overwork_high_risk_rate')}%。"},
        {"standard": "888", "title": "三個 80%", "content": json.dumps(plan888.get("three_80"), ensure_ascii=False)},
        {"standard": "WPAI", "title": "健康經濟效益", "content": f"中性情境年效益試算 NT${roi['scenarios']['neutral']['annual_benefit']:,}；此為參數化情境，不構成財務承諾。"},
        {"standard": "聲明", "title": "資料與查核邊界", "content": "內容由平台彙整資料產生，不是第三方確信或認證報告；正式永續揭露應由組織確認並視需要交由查證機構覆核。"},
    ]


def generate_gemini_content(prompt: str) -> str:
    try:
        client = genai.Client(api_key=settings.gemini_api_key)
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(temperature=0.2, max_output_tokens=4096),
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Gemini 報告生成失敗，請稍後再試") from exc
    content = (response.text or "").strip()
    if not content:
        raise HTTPException(status_code=502, detail="Gemini 未回傳報告內容")
    return content


def build_report_prompt(report_type: str, title: str, context: dict[str, Any]) -> str:
    focus = {
        "esg": "GRI 403-6、SDG 3/8/10/17、Ottawa Charter、健康促進成果與資料限制",
        "okr": "睡眠、疼痛、工作效率、MHI、三個80%及下期 OKR",
        "highrisk": "睡眠、疼痛、過勞與身心高風險，只提出組織介入，不推測個人身分",
        "kpi": "KPI 達成率、差距、優先順序與可量測的下一期行動",
        "roi": "WPAI 情境、三年 ROI、回本期、敏感度與非財務承諾聲明",
        "plan888": "三個80%、八週介入、指標缺口與下一循環",
        "gri": "可供 GRI 403-6/403-9 草稿引用的段落與查核邊界",
        "ohs": "職安法第6條、危害、措施、追蹤、定期檢討與不構成法律意見聲明",
        "cross_org": "跨企業匿名健康趨勢、區域／夥伴策略與資料代表性限制",
    }[report_type]
    return f"""你是企業健康促進與職業安全分析顧問。請用繁體中文撰寫「{title}」。

分析焦點：{focus}

規則：
1. 只能引用下方 JSON 的彙整數據，不得臆測個人、疾病診斷、因果關係或不存在的數字。
2. null 代表樣本不足或沒有資料，必須明確寫成「資料不足」，不可補值。
3. k<5 的資料已由資料庫隱藏，不得要求或推回個人資料。
4. 輸出 Markdown，包含：執行摘要、數據觀察、風險與限制、具體行動、下期追蹤指標、免責聲明。
5. AI 內容是決策草稿，不是醫療診斷、法律意見、財務承諾或第三方查核。

去識別化彙整 JSON：
{json.dumps(context, ensure_ascii=False, separators=(',', ':'))}
"""


def create_reibi_batch_e_router(
    client: Any,
    generator: Callable[[str], str] = generate_gemini_content,
) -> APIRouter:
    router = APIRouter(prefix="/api/reibi/analytics", tags=["REIBI Batch E"])

    def get_settings(org: str) -> dict[str, Any]:
        rows = _execute(client.table("reibi_analytics_settings").select("*").eq("org_code", org).limit(1), "無法讀取 ROI 參數")
        return {"org_code": org, **DEFAULT_ANALYTICS_SETTINGS, **(rows[0] if rows else {})}

    def get_snapshot(org: str, start: Optional[date], end: Optional[date], department: Optional[str]) -> dict[str, Any]:
        return _rpc(client, "reibi_org_health_snapshot", {
            "p_org_code": org,
            "p_period_start": start.isoformat() if start else None,
            "p_period_end": end.isoformat() if end else None,
            "p_department_key": department,
        }, "無法產生組織健康彙整") or {}

    def get_vital_snapshot(org: str, department: Optional[str]) -> dict[str, Any]:
        return _rpc(client, "reibi_three_highs_aggregate", {
            "p_org_code": org, "p_department_key": department,
        }, "無法產生三高彙整") or {}

    def build_overview(org: str, start: Optional[date], end: Optional[date], department: Optional[str]) -> dict[str, Any]:
        snapshot = get_snapshot(org, start, end, department)
        settings_data = get_settings(org)
        roi = calculate_roi(settings_data)
        if snapshot.get("suppressed"):
            return {"snapshot": snapshot, "settings": settings_data, "roi": roi, "kpis": None, "plan888": None, "gri": []}
        kpis = calculate_kpis(snapshot)
        vitals = get_vital_snapshot(org, department)
        interview_query = client.table("reibi_ohs_records").select("id", count="exact").eq("org_code", org).eq("record_type", "interview")
        if start:
            interview_query = interview_query.gte("created_at", start.isoformat())
        if end:
            interview_query = interview_query.lt("created_at", f"{end.isoformat()}T23:59:59.999999Z")
        interviews = _execute(interview_query, "無法讀取面談彙整")
        plan888 = calculate_plan888(snapshot, vitals, len(interviews))
        return {
            "snapshot": snapshot, "settings": settings_data, "roi": roi,
            "kpis": kpis, "vitals": vitals, "plan888": plan888,
            "gri": build_gri(snapshot, kpis, plan888, roi),
        }

    @router.get("/consent")
    def get_consent(current_user: dict = Depends(require_personal)):
        rows = _execute(client.table("profiles").select("research_opt_in").eq("id", _profile_id(current_user)).limit(1), "無法讀取研究同意設定")
        return {"status": "success", "data": {"research_opt_in": bool(rows and rows[0].get("research_opt_in"))}}

    @router.put("/consent")
    def set_consent(payload: ResearchConsentWrite, current_user: dict = Depends(require_personal)):
        rows = _execute(client.table("profiles").update({"research_opt_in": payload.research_opt_in}).eq("id", _profile_id(current_user)), "無法更新研究同意設定")
        if not rows:
            raise HTTPException(status_code=404, detail="找不到個人資料")
        return {"status": "success", "data": {"research_opt_in": payload.research_opt_in}}

    @router.get("/overview")
    def overview(
        period_start: Optional[date] = None, period_end: Optional[date] = None,
        department: Optional[str] = Query(None, max_length=120),
        current_user: dict = Depends(require_org_analytics),
    ):
        org = _org_scope(current_user)
        if period_start and period_end and period_end < period_start:
            raise HTTPException(status_code=422, detail="結束日期不可早於開始日期")
        if current_user.get("role") == "dept_head":
            own_department = current_user.get("dept")
            if not own_department:
                raise HTTPException(status_code=403, detail="部門主管登入資訊缺少部門")
            if department and department != own_department:
                raise HTTPException(status_code=403, detail="不可查閱其他部門")
            department = own_department
        data = build_overview(org, period_start, period_end, department)
        return {"status": "success", "data": {"org_code": org, "department": department, **data}}

    @router.get("/settings")
    def settings_view(current_user: dict = Depends(require_org_analytics)):
        return {"status": "success", "data": get_settings(_org_scope(current_user))}

    @router.put("/settings")
    def settings_save(payload: AnalyticsSettingsWrite, current_user: dict = Depends(require_org_report)):
        org = _org_scope(current_user)
        values = payload.model_dump(); values.update({"org_code": org, "updated_by": current_user.get("name"), "updated_at": _now()})
        rows = _execute(client.table("reibi_analytics_settings").upsert(values, on_conflict="org_code"), "無法儲存 ROI 參數")
        return {"status": "success", "data": rows[0]}

    @router.get("/departments")
    def department_trends(
        period_start: Optional[date] = None, period_end: Optional[date] = None,
        current_user: dict = Depends(require_org_analytics),
    ):
        org = _org_scope(current_user)
        if current_user.get("role") == "dept_head":
            names = [current_user.get("dept")]
        else:
            profiles = _execute(client.table("profiles").select("department").eq("org_code", org).not_.is_("department", "null"), "無法讀取部門清單")
            names = sorted({str(row["department"]).strip() for row in profiles if row.get("department")})
        rows = []
        for name in filter(None, names):
            snapshot = get_snapshot(org, period_start, period_end, name)
            rows.append({"department": name, "snapshot": snapshot, "kpis": None if snapshot.get("suppressed") else calculate_kpis(snapshot)})
        return {"status": "success", "data": rows}

    @router.get("/reports")
    def list_reports(current_user: dict = Depends(require_org_analytics)):
        org = _org_scope(current_user)
        query = client.table("reibi_generated_reports").select("id,org_code,scope_code,report_type,title,period_start,period_end,department_key,sample_size,ai_provider,ai_model,generated_by,created_at").eq("org_code", org)
        if current_user.get("role") == "dept_head":
            query = query.eq("department_key", current_user.get("dept"))
        rows = _execute(query.order("created_at", desc=True).limit(100), "無法讀取報告清單")
        return {"status": "success", "data": rows}

    @router.get("/reports/{report_id}")
    def get_report(report_id: int, current_user: dict = Depends(require_org_analytics)):
        org = _org_scope(current_user)
        rows = _execute(client.table("reibi_generated_reports").select("*").eq("id", report_id).eq("org_code", org).limit(1), "無法讀取報告")
        if not rows or (current_user.get("role") == "dept_head" and rows[0].get("department_key") != current_user.get("dept")):
            raise HTTPException(status_code=404, detail="找不到報告")
        return {"status": "success", "data": rows[0]}

    @router.post("/reports", status_code=status.HTTP_201_CREATED)
    def generate_report(payload: ReportGenerate, current_user: dict = Depends(get_current_user)):
        if payload.period_start and payload.period_end and payload.period_end < payload.period_start:
            raise HTTPException(status_code=422, detail="結束日期不可早於開始日期")
        if payload.report_type == "cross_org":
            _require(current_user, {SUPER_ROLE}, "跨企業報告限 REIBI 內部超級管理者")
            context = build_cross_org(payload.period_start, payload.period_end)
            sample_size = int(context.get("health", {}).get("sample_size") or 0)
            if sample_size < 5:
                raise HTTPException(status_code=422, detail="跨企業研究同意樣本不足 5，無法生成報告")
            org, scope, department = None, "ALL", None
            title = "REIBI 跨企業健康與策略報告"
        else:
            _require_any_permission(current_user, ("org_reports",), "限具備組織報告權限的帳號產生 AI 組織報告")
            org = _org_scope(current_user)
            overview_data = build_overview(org, payload.period_start, payload.period_end, payload.department_key)
            snapshot = overview_data["snapshot"]
            if snapshot.get("suppressed"):
                raise HTTPException(status_code=422, detail="樣本不足 5，無法生成組織報告")
            context = overview_data
            if payload.report_type == "ohs":
                context = {**context, "ohs": _ohs_context(client, org)}
            sample_size = int(snapshot.get("sample_size") or 0)
            scope, department = org, payload.department_key
            title = {
                "esg": "ESG 健康效益報告", "okr": "企業健康 OKR 報告", "highrisk": "高風險趨勢報告",
                "kpi": "健康 KPI 報告", "roi": "健康促進 ROI 報告", "plan888": "888 計畫完整報告",
                "gri": "GRI 403-6／403-9 揭露草稿", "ohs": "職業安全衛生管理計畫書",
            }[payload.report_type]
        content = generator(build_report_prompt(payload.report_type, title, context))
        rows = _execute(client.table("reibi_generated_reports").insert({
            "org_code": org, "scope_code": scope, "report_type": payload.report_type, "title": title,
            "period_start": payload.period_start.isoformat() if payload.period_start else None,
            "period_end": payload.period_end.isoformat() if payload.period_end else None,
            "department_key": department, "sample_size": sample_size,
            "metrics_snapshot": context, "content": content, "ai_provider": "gemini", "ai_model": GEMINI_MODEL,
            "generated_by": current_user.get("name") or current_user.get("uid"),
        }), "無法保存 Gemini 報告")
        return {"status": "success", "data": rows[0]}

    def build_cross_org(start: Optional[date], end: Optional[date]) -> dict[str, Any]:
        health = _rpc(client, "reibi_cross_org_health_snapshot", {
            "p_period_start": start.isoformat() if start else None,
            "p_period_end": end.isoformat() if end else None,
        }, "無法產生跨企業健康彙整") or {}
        enterprises = _execute(client.table("reibi_enterprises").select("org_code,org_name,status,industry,plan_code,member_limit,used_count,contract_start,contract_end,partner_code,a_layer_fee,b_layer_fee,c_layer_fee,d_layer_fee,source_payload"), "無法讀取企業策略資料")
        distributors = _execute(client.table("reibi_distributors").select("org_code,parent_id,distributor_type,name,level_code,status,region"), "無法讀取經銷商策略資料")
        return {"health": health, "strategy": calculate_strategy(enterprises, distributors), "privacy": "只納入明確研究同意者；每個企業樣本均需 k≥5。"}

    @router.get("/cross-org")
    def cross_org(period_start: Optional[date] = None, period_end: Optional[date] = None,
                  current_user: dict = Depends(require_cross_org_analytics)):
        data = build_cross_org(period_start, period_end)
        if not can_view_financial_figures(current_user):
            data = redact_financial_figures(data)
        return {"status": "success", "data": data}

    @router.get("/cross-org/reports")
    def cross_reports(current_user: dict = Depends(require_cross_org_analytics)):
        rows = _execute(client.table("reibi_generated_reports").select("*").eq("scope_code", "ALL").order("created_at", desc=True).limit(100), "無法讀取跨企業報告")
        return {"status": "success", "data": rows}

    @router.get("/directory")
    def directory(
        kind: Literal["enterprise", "distributor"] = "enterprise",
        search: Optional[str] = Query(None, max_length=100),
        period_start: Optional[date] = None, period_end: Optional[date] = None,
        current_user: dict = Depends(require_super),
    ):
        if kind == "enterprise":
            query = client.table("reibi_enterprises").select("id,org_code,org_name,org_alias,status,contact_name,phone,email,industry,plan_code,member_limit,used_count,contract_start,contract_end,consultant,partner_code,a_layer_fee,b_layer_fee,c_layer_fee,d_layer_fee")
            if period_start:
                query = query.gte("contract_start", period_start.isoformat())
            if period_end:
                query = query.lte("contract_end", period_end.isoformat())
            if search:
                safe = _safe_directory_search(search)
                query = query.or_(f"org_name.ilike.%{safe}%,org_code.ilike.%{safe}%,contact_name.ilike.%{safe}%")
        else:
            query = client.table("reibi_distributors").select("id,org_code,parent_id,distributor_type,name,alias,status,level_code,contact_name,phone,email,region")
            if search:
                safe = _safe_directory_search(search)
                query = query.or_(f"name.ilike.%{safe}%,org_code.ilike.%{safe}%,contact_name.ilike.%{safe}%")
        rows = _execute(query.order("org_code").limit(1000), "無法讀取名冊")
        return {"status": "success", "data": rows}

    return router


def _safe_directory_search(value: str) -> str:
    safe = value.strip()
    if not safe or not re.fullmatch(r"[\w\-\u3400-\u9fff ]{1,100}", safe, flags=re.UNICODE):
        raise HTTPException(status_code=422, detail="搜尋文字只可包含文字、數字、空格、底線或連字號")
    return safe


def calculate_strategy(enterprises: list[dict[str, Any]], distributors: list[dict[str, Any]]) -> dict[str, Any]:
    total_revenue = sum(float(row.get(key) or 0) for row in enterprises for key in ("a_layer_fee", "b_layer_fee", "c_layer_fee", "d_layer_fee"))
    by_region: dict[str, int] = {}
    by_partner: dict[str, dict[str, Any]] = {}
    for row in enterprises:
        source = row.get("source_payload") or {}
        region = str(source.get("region") or source.get("city") or "未分類")
        by_region[region] = by_region.get(region, 0) + 1
        partner = str(row.get("partner_code") or "DIRECT")
        item = by_partner.setdefault(partner, {"enterprise_count": 0, "revenue": 0.0})
        item["enterprise_count"] += 1
        item["revenue"] += sum(float(row.get(key) or 0) for key in ("a_layer_fee", "b_layer_fee", "c_layer_fee", "d_layer_fee"))
    today = date.today()
    nps_due = [row["org_code"] for row in enterprises if _nps_due(row.get("contract_start"), today)]
    return {
        "enterprise_count": len(enterprises),
        "active_enterprise_count": sum(1 for row in enterprises if str(row.get("status", "")).lower() in {"active", "啟用中", "trial", "試用中"}),
        "distributor_count": len(distributors),
        "licensed_members": sum(int(row.get("member_limit") or 0) for row in enterprises),
        "used_members": sum(int(row.get("used_count") or 0) for row in enterprises),
        "contracted_revenue": round(total_revenue),
        "by_region": by_region,
        "by_partner": by_partner,
        "nps_follow_up_org_codes": nps_due,
        "goals": {"annual_enterprises": 100, "annual_revenue": 30000000, "plan888_rate": 80},
    }


def redact_financial_figures(data: dict[str, Any]) -> dict[str, Any]:
    """移除跨企業彙整中的金額，保留樣本數與健康指標。

    Batch J 已決定 `reibi_data` 在 L5 看不到合約費用與訂閱營收；跨企業彙整走同一條線，
    否則同一份數字換個端點就取得得到。
    """
    strategy = dict(data.get("strategy") or {})
    strategy.pop("contracted_revenue", None)
    strategy["by_partner"] = {
        partner: {key: value for key, value in (metrics or {}).items() if key != "revenue"}
        for partner, metrics in (strategy.get("by_partner") or {}).items()
    }
    goals = dict(strategy.get("goals") or {})
    goals.pop("annual_revenue", None)
    strategy["goals"] = goals
    return {**data, "strategy": strategy, "financials_redacted": True}


def _nps_due(contract_start: Any, today: date) -> bool:
    if not contract_start:
        return False
    try:
        started = date.fromisoformat(str(contract_start)[:10])
    except ValueError:
        return False
    months = (today.year - started.year) * 12 + today.month - started.month
    return months in {3, 12}


def _ohs_context(client: Any, org: str) -> dict[str, Any]:
    rows = _execute(client.table("reibi_ohs_records").select("record_type,status,risk_level,owner,due_date,verified_at,source_payload,created_at").eq("org_code", org).in_("record_type", ["hazard", "measure", "review", "meta"]), "無法讀取 OHS 彙整")
    return {
        kind: [row for row in rows if row.get("record_type") == kind]
        for kind in ("hazard", "measure", "review", "meta")
    }
