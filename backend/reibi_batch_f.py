"""REIBI Batch F organization settings, service center, and integrations."""

from __future__ import annotations

import base64
import binascii
import csv
import hashlib
import io
import json
from datetime import date, datetime, timezone
from typing import Any, Callable, Literal, Optional

import requests
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from google import genai
from google.genai import types
from pydantic import BaseModel, ConfigDict, Field, field_validator

from auth import get_current_user, require_reibi_manager, require_reibi_super
from config import settings
from reibi_l5 import partner_scope_codes
from roles import PARTNER_ROLES, has_permission


GEMINI_MODEL = "gemini-2.5-flash"
MAX_RECEIPT_BYTES = 10 * 1024 * 1024
RECEIPT_MIME_TYPES = {"image/jpeg", "image/png", "image/webp", "application/pdf"}
TICKET_TYPES = {"量測預約", "設備訓練", "報修", "服務申請", "合約諮詢", "其他", "設備報修", "教育訓練安排", "量測服務預約", "升方案申請", "其他客製需求"}
TICKET_PRIORITIES = {"緊急", "一般", "低優先"}
TICKET_TRANSITIONS = {
    "待處理": {"處理中", "已排程", "已完成", "已關閉"},
    "已排程": {"處理中", "已完成", "已關閉"},
    "處理中": {"已排程", "已完成", "已關閉"},
    "已完成": {"已關閉"},
    "已關閉": set(),
}
MESSAGE_STATUSES = {"draft", "queued", "manual_copy", "sent", "failed"}
ANNOUNCEMENT_TEMPLATES = [
    {"code": "weekly_assessment", "label": "每週健康評估提醒"},
    {"code": "schumann", "label": "舒曼波體驗活動"},
    {"code": "la200", "label": "LA200 光能服務"},
    {"code": "plan888", "label": "888 健康計畫"},
    {"code": "bio_test", "label": "生理量測通知"},
    {"code": "autonomic", "label": "自律神經量測"},
    {"code": "esg", "label": "ESG 健康成果"},
    {"code": "health_day", "label": "職場健康日"},
    {"code": "points", "label": "健康點數期限"},
    {"code": "new_feature", "label": "新功能公告"},
]
MESSAGE_TEMPLATES = [
    {"code": "expire", "label": "合約到期提醒"},
    {"code": "service", "label": "服務確認"},
    {"code": "commission", "label": "佣金結算"},
    {"code": "announce", "label": "系統公告"},
    {"code": "welcome", "label": "企業啟用歡迎"},
    {"code": "custom", "label": "自訂訊息"},
]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class DepartmentCsvRequest(StrictModel):
    csv_text: str = Field(min_length=1, max_length=500_000)


class TicketWrite(StrictModel):
    enterprise_id: Optional[int] = Field(default=None, ge=1)
    ticket_type: str = Field(min_length=1, max_length=100)
    priority: str = Field(default="一般", max_length=50)
    preferred_date: Optional[date] = None
    note: str = Field(min_length=1, max_length=4_000)
    contact_email: Optional[str] = Field(default=None, max_length=254, pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]+$")

    @field_validator("ticket_type")
    @classmethod
    def valid_type(cls, value: str) -> str:
        if value not in TICKET_TYPES:
            raise ValueError("不支援的服務案件類型")
        return value

    @field_validator("priority")
    @classmethod
    def valid_priority(cls, value: str) -> str:
        if value not in TICKET_PRIORITIES:
            raise ValueError("不支援的優先級")
        return value


class TicketUpdate(StrictModel):
    status: Literal["處理中", "已排程", "已完成", "已關閉"]
    handler: Optional[str] = Field(default=None, max_length=200)
    response_note: Optional[str] = Field(default=None, max_length=4_000)


class AnnouncementWrite(StrictModel):
    enterprise_id: Optional[int] = Field(default=None, ge=1)
    template_code: Optional[str] = Field(default=None, max_length=100)
    title: str = Field(min_length=1, max_length=300)
    body: str = Field(min_length=1, max_length=10_000)
    event_date: Optional[date] = None
    quota: Optional[int] = Field(default=None, ge=0, le=100_000)
    status: Literal["draft", "published", "closed"] = "draft"


class MessageWrite(StrictModel):
    target_type: Literal["enterprise", "distributor", "all", "specific"]
    target_artifact_id: Optional[str] = Field(default=None, max_length=300)
    target_name: Optional[str] = Field(default=None, max_length=300)
    template_code: Optional[str] = Field(default=None, max_length=100)
    message: str = Field(min_length=1, max_length=5_000)
    delivery_mode: Literal["manual", "provider_api"] = "manual"
    request_key: Optional[str] = Field(default=None, max_length=200)


class MessageStatusUpdate(StrictModel):
    status: Literal["queued", "manual_copy", "sent", "failed"]
    error_message: Optional[str] = Field(default=None, max_length=2_000)


class AccessRequestWrite(StrictModel):
    requester_name: str = Field(min_length=1, max_length=200)
    requester_email: str = Field(max_length=254, pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
    request_type: Literal["credential_recovery", "permission_change", "pin_retirement"]
    requested_role: Optional[str] = Field(default=None, max_length=100)
    reason: str = Field(min_length=5, max_length=4_000)


class AccessRequestReview(StrictModel):
    status: Literal["verified", "approved", "rejected", "completed"]
    verification_method: Optional[str] = Field(default=None, max_length=500)
    resolution_note: str = Field(min_length=1, max_length=4_000)


class RemittanceOcrRequest(StrictModel):
    remittance_id: int = Field(ge=1)
    mime_type: str
    data_base64: str = Field(min_length=4, max_length=14_500_000)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _execute(query: Any, label: str) -> list[dict[str, Any]]:
    try:
        response = query.execute()
        return response.data or []
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Supabase {label}失敗") from exc


def _enterprise(client: Any, user: dict[str, Any], requested_id: Optional[int] = None) -> dict[str, Any]:
    if user.get("role") == "reibi_super":
        if requested_id is None:
            raise HTTPException(status_code=422, detail="跨企業操作必須指定 enterprise_id")
        query = client.table("reibi_enterprises").select("*").eq("id", requested_id)
    else:
        org_code = str(user.get("org_code") or "").upper()
        if not org_code:
            raise HTTPException(status_code=403, detail="目前帳號沒有企業代碼")
        query = client.table("reibi_enterprises").select("*").eq("org_code", org_code)
    rows = _execute(query.limit(1), "查詢企業")
    if not rows:
        raise HTTPException(status_code=404, detail="找不到企業資料")
    if requested_id is not None and user.get("role") != "reibi_super" and int(rows[0]["id"]) != requested_id:
        raise HTTPException(status_code=403, detail="不可操作其他企業")
    return rows[0]


def service_scope_enterprises(client: Any, user: dict[str, Any]) -> tuple[list[dict[str, Any]], list[str]]:
    """Resolve selectable service enterprises without trusting browser scope values."""
    role = str(user.get("role") or "")
    columns = "id,org_code,org_name,status,partner_code"
    if role in PARTNER_ROLES:
        partner_codes = partner_scope_codes(client, user)
        rows = _execute(
            client.table("reibi_enterprises").select(columns).in_("partner_code", partner_codes).order("org_name"),
            "查詢經銷商服務企業",
        )
        return rows, partner_codes
    if role in {"reibi_super", "reibi_cs"}:
        rows = _execute(
            client.table("reibi_enterprises").select(columns).order("org_name").limit(5_000),
            "查詢服務企業",
        )
        return rows, []
    if user.get("org_code"):
        return [_enterprise(client, user)], []
    return [], []


def resolve_ticket_enterprise(client: Any, user: dict[str, Any], requested_id: Optional[int]) -> dict[str, Any] | None:
    role = str(user.get("role") or "")
    if role in PARTNER_ROLES or role in {"reibi_super", "reibi_cs"}:
        if requested_id is None:
            raise HTTPException(status_code=422, detail="建立服務案件必須指定 enterprise_id")
        enterprises, _ = service_scope_enterprises(client, user)
        match = next((row for row in enterprises if int(row["id"]) == requested_id), None)
        if not match:
            raise HTTPException(status_code=403, detail="不可為權限範圍外的企業建立案件")
        return match
    if user.get("org_code"):
        return _enterprise(client, user, requested_id)
    if requested_id is not None:
        raise HTTPException(status_code=403, detail="個人帳號不可指定企業")
    return None


def scope_ticket_query(client: Any, query: Any, user: dict[str, Any]) -> Any | None:
    role = str(user.get("role") or "")
    if role in {"reibi_super", "reibi_cs"}:
        return query
    if role == "admin":
        return query.eq("enterprise_id", _enterprise(client, user)["id"])
    if role in PARTNER_ROLES:
        enterprises, _ = service_scope_enterprises(client, user)
        enterprise_ids = [int(row["id"]) for row in enterprises]
        return query.in_("enterprise_id", enterprise_ids) if enterprise_ids else None
    return query.eq("requester_profile_id", user.get("uid"))


def _audit(client: Any, user: dict[str, Any], action: str, detail: str) -> None:
    try:
        client.table("audit_logs").insert({
            "user_id": user.get("uid"), "org_code": user.get("org_code"),
            "action": action, "detail": detail, "role_at_time": user.get("role"),
        }).execute()
    except Exception:
        # Business writes must not be rolled back merely because audit insertion is unavailable.
        pass


def parse_department_csv(csv_text: str) -> dict[str, Any]:
    errors: list[str] = []
    warnings: list[str] = []
    rows: list[dict[str, Any]] = []
    try:
        reader = csv.DictReader(io.StringIO(csv_text.lstrip("\ufeff")))
    except csv.Error as exc:
        return {"valid": False, "rows": [], "errors": [f"CSV 無法解析：{exc}"], "warnings": []}
    required = {"部門名稱", "層級(1-4)", "上層部門名稱", "人數"}
    headers = set(reader.fieldnames or [])
    missing = sorted(required - headers)
    if missing:
        return {"valid": False, "rows": [], "errors": [f"缺少欄位：{', '.join(missing)}"], "warnings": []}
    for line_no, record in enumerate(reader, start=2):
        name = str(record.get("部門名稱") or "").strip()
        parent_name = str(record.get("上層部門名稱") or "").strip() or None
        try:
            level = int(str(record.get("層級(1-4)") or ""))
        except ValueError:
            errors.append(f"第 {line_no} 列的層級必須是 1–4")
            continue
        try:
            declared_count = int(str(record.get("人數") or "0"))
        except ValueError:
            errors.append(f"第 {line_no} 列的人數必須是非負整數")
            continue
        if not name:
            errors.append(f"第 {line_no} 列缺少部門名稱")
        if level not in range(1, 5):
            errors.append(f"第 {line_no} 列的層級超出 1–4")
        if declared_count < 0:
            errors.append(f"第 {line_no} 列的人數不可為負數")
        if level == 1 and parent_name:
            errors.append(f"第 {line_no} 列為第一層，不可指定上層部門")
        if level > 1 and not parent_name:
            errors.append(f"第 {line_no} 列必須指定上層部門")
        rows.append({"name": name, "level": level, "parent_name": parent_name,
                     "declared_count": declared_count, "sort_order": len(rows)})
    if not rows:
        errors.append("CSV 沒有可匯入的部門")
    keys = [(row["level"], row["name"].casefold()) for row in rows]
    if len(keys) != len(set(keys)):
        errors.append("同一層級不可有重複的部門名稱")
    available = {(row["level"], row["name"].casefold()) for row in rows}
    for row in rows:
        if row["level"] > 1 and (row["level"] - 1, str(row["parent_name"]).casefold()) not in available:
            errors.append(f"{row['name']} 的上層部門「{row['parent_name']}」不存在於前一層")
    declared_total = sum(row["declared_count"] for row in rows)
    if declared_total == 0:
        warnings.append("CSV 的人數合計為 0；匯入後仍以 profiles 的實際帳號統計為準")
    return {"valid": not errors, "rows": rows, "errors": list(dict.fromkeys(errors)),
            "warnings": warnings, "declared_total": declared_total}


def decode_receipt(payload: RemittanceOcrRequest) -> bytes:
    if payload.mime_type not in RECEIPT_MIME_TYPES:
        raise HTTPException(status_code=422, detail="只接受 JPG、PNG、WebP 或 PDF")
    try:
        content = base64.b64decode(payload.data_base64, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise HTTPException(status_code=422, detail="憑證內容不是有效的 Base64") from exc
    if not content or len(content) > MAX_RECEIPT_BYTES:
        raise HTTPException(status_code=422, detail="憑證必須介於 1 byte 與 10 MB 之間")
    return content


def _parse_json_response(text: str) -> dict[str, Any]:
    value = text.strip()
    if value.startswith("```"):
        value = value.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
    try:
        result = json.loads(value)
    except json.JSONDecodeError as exc:
        raise ValueError("Gemini 回傳內容不是有效 JSON") from exc
    if not isinstance(result, dict):
        raise ValueError("Gemini 回傳格式錯誤")
    confidence = result.get("confidence")
    result["confidence"] = max(0.0, min(1.0, float(confidence or 0)))
    result["warnings"] = result.get("warnings") if isinstance(result.get("warnings"), list) else []
    return result


def analyze_remittance_document(
    content: bytes,
    mime_type: str,
    generator: Optional[Callable[[bytes, str], str]] = None,
) -> dict[str, Any]:
    if generator is None:
        client = genai.Client(api_key=settings.gemini_api_key)

        def generator(data: bytes, mime: str) -> str:
            response = client.models.generate_content(
                model=GEMINI_MODEL,
                contents=[
                    types.Part.from_bytes(data=data, mime_type=mime),
                    "辨識這份匯款或轉帳憑證。只回傳 JSON，欄位為 remitted_on (YYYY-MM-DD 或 null)、amount (數字或 null)、account_name、account_tail、bank_name、confidence (0 到 1)、warnings (字串陣列)。看不清楚的欄位必須是 null，不得猜測。",
                ],
                config=types.GenerateContentConfig(response_mime_type="application/json", temperature=0),
            )
            return response.text or ""

    return _parse_json_response(generator(content, mime_type))


def create_reibi_batch_f_router(client: Any) -> APIRouter:
    router = APIRouter(prefix="/api/reibi", tags=["REIBI Batch F"])

    @router.get("/service/catalog")
    def catalog(_: dict = Depends(get_current_user)):
        return {"status": "success", "data": {
            "ticket_types": sorted(TICKET_TYPES), "ticket_priorities": ["緊急", "一般", "低優先"],
            "announcement_templates": ANNOUNCEMENT_TEMPLATES, "message_templates": MESSAGE_TEMPLATES,
            "version": {"api": "2.2.0", "batch": "M", "artifact_main": "v10.3.34", "artifact_l5": "v2.14"},
            "security": {"credential_recovery": "人工身分核驗後，由 REIBI 內部人員處理；不傳送、不保存明文 PIN。",
                         "line_delivery": "未設定 LINE 憑證時只建立人工複製記錄，不標記為已送達。"},
        }}

    @router.get("/enterprise/departments/template")
    def department_template(_: dict = Depends(require_reibi_manager)):
        body = "\ufeff部門名稱,層級(1-4),上層部門名稱,人數\r\n總公司,1,,0\r\n人力資源部,2,總公司,8\r\n薪酬福利組,3,人力資源部,3\r\n"
        return Response(body, media_type="text/csv; charset=utf-8", headers={"Content-Disposition": "attachment; filename=reibi-departments.csv"})

    @router.post("/enterprise/departments/preflight")
    def department_preflight(payload: DepartmentCsvRequest, _: dict = Depends(require_reibi_manager)):
        return {"status": "success", "data": parse_department_csv(payload.csv_text)}

    @router.post("/enterprise/departments/import")
    def department_import(
        payload: DepartmentCsvRequest,
        enterprise_id: Optional[int] = Query(default=None, ge=1),
        user: dict = Depends(require_reibi_manager),
    ):
        result = parse_department_csv(payload.csv_text)
        if not result["valid"]:
            raise HTTPException(status_code=422, detail={"message": "部門 CSV 預檢失敗", **result})
        enterprise = _enterprise(client, user, enterprise_id)
        try:
            response = client.rpc("reibi_replace_departments", {
                "p_enterprise_id": enterprise["id"], "p_rows": result["rows"],
            }).execute()
        except Exception as exc:
            raise HTTPException(status_code=409, detail="部門匯入未完成；原資料已保留") from exc
        _audit(client, user, "reibi_departments_import", f"匯入 {len(result['rows'])} 個部門")
        return {"status": "success", "data": {**result, "inserted": response.data}}

    @router.get("/enterprise/architecture")
    def architecture(
        enterprise_id: Optional[int] = Query(default=None, ge=1),
        user: dict = Depends(require_reibi_manager),
    ):
        enterprise = _enterprise(client, user, enterprise_id)
        departments = _execute(client.table("reibi_departments").select("*").eq("enterprise_id", enterprise["id"]).order("hierarchy_level").order("sort_order"), "查詢部門架構")
        profiles = _execute(client.table("profiles").select("department").eq("org_code", enterprise["org_code"]), "統計企業人數")
        counts: dict[str, int] = {}
        for row in profiles:
            key = str(row.get("department") or "未分配")
            counts[key] = counts.get(key, 0) + 1
        return {"status": "success", "data": {"enterprise": enterprise, "departments": departments,
            "registered_count": len(profiles), "department_counts": counts, "generated_at": _now()}}

    @router.get("/service/tickets")
    def list_tickets(ticket_status: Optional[str] = Query(default=None, alias="status"), user: dict = Depends(get_current_user)):
        query = client.table("reibi_service_tickets").select("*,reibi_enterprises(org_code,org_name)")
        query = scope_ticket_query(client, query, user)
        if query is None:
            return {"status": "success", "data": []}
        if ticket_status:
            query = query.eq("status", ticket_status)
        rows = _execute(query.order("created_at", desc=True).limit(500), "查詢服務案件")
        return {"status": "success", "data": rows}

    @router.get("/service/scope")
    def service_scope(user: dict = Depends(get_current_user)):
        if not (has_permission(user, "service_center") or has_permission(user, "service_manage")):
            raise HTTPException(status_code=403, detail="此帳號沒有服務中心權限")
        enterprises, partner_codes = service_scope_enterprises(client, user)
        return {"status": "success", "data": {
            "role": user.get("role"),
            "requires_enterprise": user.get("role") in PARTNER_ROLES | {"reibi_super", "reibi_cs"},
            "partner_codes": partner_codes,
            "enterprises": enterprises,
        }}

    @router.post("/service/tickets", status_code=status.HTTP_201_CREATED)
    def create_ticket(payload: TicketWrite, user: dict = Depends(get_current_user)):
        if not (has_permission(user, "service_center") or has_permission(user, "service_manage")):
            raise HTTPException(status_code=403, detail="此帳號沒有建立服務案件的權限")
        enterprise = resolve_ticket_enterprise(client, user, payload.enterprise_id)
        requester_org_code = user.get("partner_org_code") or user.get("org_code")
        values = payload.model_dump(mode="json", exclude={"enterprise_id"})
        values.update({"enterprise_id": enterprise.get("id") if enterprise else None,
                       "requester_profile_id": user.get("uid"), "requester_org_code": requester_org_code,
                       "status": "待處理", "created_by": user.get("name") or user.get("uid"),
                       "status_history": [{"status": "待處理", "at": _now(), "by": user.get("name") or user.get("uid")}],
                       "source_payload": {"requester_role": user.get("role"), "requester_scope": requester_org_code}})
        rows = _execute(client.table("reibi_service_tickets").insert(values), "建立服務案件")
        _audit(client, user, "reibi_ticket_create", f"ticket={rows[0]['id']}")
        return {"status": "success", "data": rows[0]}

    @router.patch("/service/tickets/{ticket_id}")
    def update_ticket(ticket_id: int, payload: TicketUpdate, user: dict = Depends(get_current_user)):
        if not has_permission(user, "service_manage"):
            raise HTTPException(status_code=403, detail="權限不足：限 REIBI 服務管理人員更新案件")
        rows = _execute(client.table("reibi_service_tickets").select("*").eq("id", ticket_id).limit(1), "查詢服務案件")
        if not rows:
            raise HTTPException(status_code=404, detail="找不到服務案件")
        current = str(rows[0].get("status") or "待處理")
        if payload.status not in TICKET_TRANSITIONS.get(current, set()):
            raise HTTPException(status_code=409, detail=f"案件不可從「{current}」直接改為「{payload.status}」")
        history = list(rows[0].get("status_history") or [])
        history.append({"status": payload.status, "at": _now(), "by": user.get("name") or user.get("uid")})
        values = payload.model_dump(exclude_unset=True)
        values.update({"status_history": history, "updated_at": _now(),
                       "closed_at": _now() if payload.status in {"已完成", "已關閉"} else None})
        updated = _execute(client.table("reibi_service_tickets").update(values).eq("id", ticket_id), "更新服務案件")
        _audit(client, user, "reibi_ticket_status", f"ticket={ticket_id}; {current}->{payload.status}")
        return {"status": "success", "data": updated[0]}

    @router.get("/announcements")
    def list_announcements(user: dict = Depends(get_current_user)):
        query = client.table("reibi_announcements").select("*,reibi_announcement_registrations(id,profile_id,status)")
        if user.get("role") != "reibi_super":
            if not user.get("org_code"):
                return {"status": "success", "data": []}
            enterprise = _enterprise(client, user)
            query = query.eq("enterprise_id", enterprise["id"])
            if user.get("role") != "admin":
                query = query.eq("status", "published")
        rows = _execute(query.order("created_at", desc=True).limit(500), "查詢公告")
        for row in rows:
            regs = row.pop("reibi_announcement_registrations", []) or []
            row["registered_count"] = sum(1 for item in regs if item.get("status") == "registered")
            row["my_registration"] = next((item.get("status") for item in regs if item.get("profile_id") == user.get("uid")), None)
        return {"status": "success", "data": rows}

    @router.post("/announcements", status_code=status.HTTP_201_CREATED)
    def create_announcement(payload: AnnouncementWrite, user: dict = Depends(require_reibi_manager)):
        enterprise = _enterprise(client, user, payload.enterprise_id)
        values = payload.model_dump(mode="json", exclude={"enterprise_id"})
        values.update({"enterprise_id": enterprise["id"], "created_by": user.get("name") or user.get("uid"),
                       "published_at": _now() if payload.status == "published" else None, "source_payload": {}})
        rows = _execute(client.table("reibi_announcements").insert(values), "建立公告")
        return {"status": "success", "data": rows[0]}

    @router.put("/announcements/{announcement_id}")
    def update_announcement(announcement_id: int, payload: AnnouncementWrite, user: dict = Depends(require_reibi_manager)):
        enterprise = _enterprise(client, user, payload.enterprise_id)
        existing = _execute(client.table("reibi_announcements").select("id,status,published_at").eq("id", announcement_id).eq("enterprise_id", enterprise["id"]).limit(1), "驗證公告")
        if not existing:
            raise HTTPException(status_code=404, detail="找不到公告")
        values = payload.model_dump(mode="json", exclude={"enterprise_id"})
        values.update({"updated_at": _now(), "published_at": _now() if payload.status == "published" and existing[0]["status"] != "published" else existing[0].get("published_at")})
        rows = _execute(client.table("reibi_announcements").update(values).eq("id", announcement_id), "更新公告")
        return {"status": "success", "data": rows[0]}

    @router.post("/announcements/{announcement_id}/register")
    def register_announcement(announcement_id: int, user: dict = Depends(get_current_user)):
        if not user.get("org_code"):
            raise HTTPException(status_code=403, detail="個人帳號沒有企業公告報名權限")
        enterprise = _enterprise(client, user)
        visible = _execute(client.table("reibi_announcements").select("id").eq("id", announcement_id).eq("enterprise_id", enterprise["id"]).eq("status", "published").limit(1), "驗證公告")
        if not visible:
            raise HTTPException(status_code=404, detail="找不到可報名的公告")
        try:
            result = client.rpc("reibi_register_announcement", {"p_announcement_id": announcement_id, "p_profile_id": user["uid"]}).execute()
        except Exception as exc:
            raise HTTPException(status_code=409, detail="名額已滿或公告已關閉") from exc
        return {"status": "success", "data": result.data}

    @router.delete("/announcements/{announcement_id}/register")
    def cancel_registration(announcement_id: int, user: dict = Depends(get_current_user)):
        rows = _execute(client.table("reibi_announcement_registrations").update({"status": "cancelled", "updated_at": _now()}).eq("announcement_id", announcement_id).eq("profile_id", user["uid"]), "取消公告報名")
        if not rows:
            raise HTTPException(status_code=404, detail="找不到報名記錄")
        return {"status": "success", "data": rows[0]}

    @router.get("/integrations/messages")
    def list_messages(_: dict = Depends(require_reibi_super)):
        rows = _execute(client.table("reibi_message_logs").select("*").order("sent_at", desc=True, nullsfirst=True).order("id", desc=True).limit(500), "查詢訊息記錄")
        return {"status": "success", "data": rows}

    @router.post("/integrations/messages", status_code=status.HTTP_201_CREATED)
    def create_message(payload: MessageWrite, user: dict = Depends(require_reibi_super)):
        if payload.delivery_mode == "provider_api" and not payload.target_artifact_id:
            raise HTTPException(status_code=422, detail="LINE API 發送必須提供目標 ID")
        values = payload.model_dump()
        values.update({"provider": "line", "sender": user.get("name") or user.get("uid"), "status": "draft", "source_payload": {}})
        rows = _execute(client.table("reibi_message_logs").insert(values), "建立訊息草稿")
        return {"status": "success", "data": rows[0]}

    @router.patch("/integrations/messages/{message_id}")
    def update_message_status(message_id: int, payload: MessageStatusUpdate, user: dict = Depends(require_reibi_super)):
        if payload.status not in MESSAGE_STATUSES - {"draft"}:
            raise HTTPException(status_code=422, detail="不支援的訊息狀態")
        now = _now()
        values: dict[str, Any] = {"status": payload.status, "error_message": payload.error_message, "updated_at": now}
        if payload.status == "queued": values["queued_at"] = now
        if payload.status == "sent": values.update({"sent_at": now, "delivered_at": now})
        if payload.status == "failed": values["failed_at"] = now
        rows = _execute(client.table("reibi_message_logs").update(values).eq("id", message_id), "更新訊息狀態")
        if not rows:
            raise HTTPException(status_code=404, detail="找不到訊息")
        _audit(client, user, "reibi_message_status", f"message={message_id}; status={payload.status}")
        return {"status": "success", "data": rows[0]}

    @router.post("/integrations/messages/{message_id}/dispatch")
    def dispatch_message(message_id: int, user: dict = Depends(require_reibi_super)):
        rows = _execute(client.table("reibi_message_logs").select("*").eq("id", message_id).limit(1), "查詢訊息")
        if not rows:
            raise HTTPException(status_code=404, detail="找不到訊息")
        message = rows[0]
        if message.get("delivery_mode") == "manual":
            updated = _execute(client.table("reibi_message_logs").update({"status": "manual_copy", "updated_at": _now()}).eq("id", message_id), "更新人工發送記錄")
            return {"status": "success", "data": updated[0], "message": "已標記為人工複製；尚未宣稱 LINE 已送達"}
        if not settings.line_channel_access_token:
            raise HTTPException(status_code=409, detail="尚未設定 LINE_CHANNEL_ACCESS_TOKEN；訊息仍保留為草稿")
        try:
            response = requests.post(settings.line_api_url, headers={"Authorization": f"Bearer {settings.line_channel_access_token}", "Content-Type": "application/json"},
                                     json={"to": message.get("target_artifact_id"), "messages": [{"type": "text", "text": message["message"]}]}, timeout=15)
            response.raise_for_status()
        except requests.RequestException as exc:
            _execute(client.table("reibi_message_logs").update({"status": "failed", "failed_at": _now(), "updated_at": _now(), "error_message": str(exc)[:1000]}).eq("id", message_id), "記錄 LINE 失敗結果")
            raise HTTPException(status_code=502, detail="LINE 發送失敗，已保留失敗記錄") from exc
        updated = _execute(client.table("reibi_message_logs").update({"status": "sent", "sent_at": _now(), "updated_at": _now(), "error_message": None}).eq("id", message_id), "記錄 LINE 發送結果")
        _audit(client, user, "reibi_line_dispatch", f"message={message_id}")
        return {"status": "success", "data": updated[0]}

    @router.post("/access-requests", status_code=status.HTTP_201_CREATED)
    def create_access_request(payload: AccessRequestWrite, user: dict = Depends(get_current_user)):
        enterprise = _enterprise(client, user) if user.get("org_code") else None
        values = payload.model_dump(mode="json")
        values.update({"enterprise_id": enterprise.get("id") if enterprise else None, "org_code": user.get("org_code"),
                       "requester_profile_id": user.get("uid"), "status": "pending"})
        rows = _execute(client.table("reibi_access_requests").insert(values), "建立權限復原申請")
        _audit(client, user, "reibi_access_request", f"request={rows[0]['id']}; type={payload.request_type}")
        return {"status": "success", "data": rows[0]}

    @router.get("/access-requests")
    def list_access_requests(_: dict = Depends(require_reibi_super)):
        rows = _execute(client.table("reibi_access_requests").select("*").order("created_at", desc=True).limit(500), "查詢權限申請")
        return {"status": "success", "data": rows}

    @router.patch("/access-requests/{request_id}")
    def review_access_request(request_id: int, payload: AccessRequestReview, user: dict = Depends(require_reibi_super)):
        values = payload.model_dump()
        values.update({"reviewed_by": user.get("name") or user.get("uid"), "reviewed_at": _now(), "updated_at": _now()})
        rows = _execute(client.table("reibi_access_requests").update(values).eq("id", request_id), "處理權限申請")
        if not rows:
            raise HTTPException(status_code=404, detail="找不到權限申請")
        _audit(client, user, "reibi_access_review", f"request={request_id}; status={payload.status}")
        return {"status": "success", "data": rows[0]}

    @router.post("/finance/remittances/ocr")
    def remittance_ocr(payload: RemittanceOcrRequest, user: dict = Depends(require_reibi_manager)):
        query = client.table("reibi_remittances").select("*").eq("id", payload.remittance_id)
        if user.get("role") != "reibi_super":
            query = query.eq("enterprise_id", _enterprise(client, user)["id"])
        rows = _execute(query.limit(1), "查詢匯款申報")
        if not rows:
            raise HTTPException(status_code=404, detail="找不到匯款申報")
        content = decode_receipt(payload)
        digest = hashlib.sha256(content).hexdigest()
        extension = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf"}[payload.mime_type]
        path = f"{rows[0].get('enterprise_id') or 'personal'}/{payload.remittance_id}/{digest}.{extension}"
        _execute(client.table("reibi_remittances").update({"ocr_status": "processing", "receipt_mime_type": payload.mime_type,
            "receipt_sha256": digest, "image_storage_path": path, "updated_at": _now()}).eq("id", payload.remittance_id), "標記 OCR 處理中")
        try:
            client.storage.from_("reibi-remittance-receipts").upload(path, content, {"content-type": payload.mime_type, "upsert": "true"})
            result = analyze_remittance_document(content, payload.mime_type)
            needs_review = result["confidence"] < 0.8 or bool(result.get("warnings"))
            values = {"ocr_status": "needs_review" if needs_review else "completed", "ocr_confidence": result["confidence"],
                      "ocr_fields": result, "ocr_analyzed_at": _now(), "ai_result": result,
                      "ai_provider": "gemini", "ai_model": GEMINI_MODEL, "updated_at": _now()}
            updated = _execute(client.table("reibi_remittances").update(values).eq("id", payload.remittance_id), "保存 Gemini OCR 結果")
        except HTTPException:
            raise
        except Exception as exc:
            _execute(client.table("reibi_remittances").update({"ocr_status": "failed", "updated_at": _now()}).eq("id", payload.remittance_id), "記錄 OCR 失敗")
            raise HTTPException(status_code=502, detail="Gemini OCR 失敗；申報仍保留供人工輸入") from exc
        return {"status": "success", "data": updated[0]}

    return router
