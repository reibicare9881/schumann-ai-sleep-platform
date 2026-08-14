"""L5-01B enterprise onboarding and password-free credential letters."""

from __future__ import annotations

import os
import re
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Response, status
from fpdf import FPDF
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from auth import get_current_user
from roles import has_permission


CASE_SELECT = (
    "id,case_no,credential_no,enterprise_id,status,admin_email,configuration,"
    "created_by,handed_off_by,handed_off_at,created_at,updated_at,"
    "reibi_enterprises(id,org_code,org_name,org_alias,status,plan_code,member_limit,"
    "contract_start,contract_end,contact_name,phone,email,address,ubn,industry,"
    "a_layer_fee,b_layer_fee,c_layer_fee,d_layer_fee,devices,d_layer_config)"
)


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class OnboardingSite(StrictModel):
    label: str = Field(min_length=1, max_length=120)
    address: str | None = Field(default=None, max_length=500)
    note: str | None = Field(default=None, max_length=500)
    sort_order: int = Field(default=0, ge=0, le=1_000)


class DeviceConfig(StrictModel):
    cloud_beds: int = Field(default=0, ge=0, le=10_000)
    relax_chairs: int = Field(default=0, ge=0, le=10_000)
    la200: int = Field(default=0, ge=0, le=10_000)


class DLayerConfig(StrictModel):
    poster: bool = False
    board: bool = False
    digital: bool = False
    qr: bool = False
    display: bool = False
    install: bool = False


class OnboardingCreate(StrictModel):
    org_name: str = Field(min_length=1, max_length=200)
    org_alias: str = Field(min_length=2, max_length=4, pattern=r"^[A-Za-z0-9]+$")
    admin_email: str = Field(min_length=3, max_length=320)
    contact_name: str = Field(min_length=1, max_length=120)
    phone: str | None = Field(default=None, max_length=50)
    ubn: str | None = Field(default=None, max_length=8)
    address: str | None = Field(default=None, max_length=500)
    industry: str | None = Field(default=None, max_length=120)
    plan_code: Literal["basic", "growth", "professional", "flagship", "custom"]
    member_limit: int = Field(gt=0, le=1_000_000)
    contract_start: date
    contract_end: date
    contract_years: int = Field(default=3, ge=1, le=20)
    pay_mode: Literal["annual", "quarterly", "monthly"] = "annual"
    consultant: str | None = Field(default=None, max_length=120)
    partner_code: str | None = Field(default=None, max_length=80)
    referral_percent: Decimal | None = Field(default=None, ge=0, le=100)
    a_layer_fee: Decimal = Field(default=0, ge=0)
    b_layer_fee: Decimal = Field(default=0, ge=0)
    c_layer_fee: Decimal = Field(default=0, ge=0)
    d_layer_fee: Decimal = Field(default=0, ge=0)
    devices: DeviceConfig = Field(default_factory=DeviceConfig)
    d_layer_config: DLayerConfig = Field(default_factory=DLayerConfig)
    c_layer_note: str | None = Field(default=None, max_length=1_000)
    c_layer_executions: int = Field(default=0, ge=0, le=100_000)
    d_layer_note: str | None = Field(default=None, max_length=1_000)
    sites: list[OnboardingSite] = Field(default_factory=list, max_length=100)

    @field_validator("admin_email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        normalized = value.lower()
        if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", normalized):
            raise ValueError("admin_email 格式不正確")
        return normalized

    @field_validator("ubn")
    @classmethod
    def validate_ubn(cls, value: str | None) -> str | None:
        if value and not re.fullmatch(r"\d{8}", value):
            raise ValueError("ubn 必須是 8 位數字")
        return value or None

    @model_validator(mode="after")
    def validate_dates_and_referral(self):
        if self.contract_end < self.contract_start:
            raise ValueError("contract_end 不可早於 contract_start")
        if self.partner_code and self.referral_percent is not None:
            raise ValueError("經銷商案件不可同時設定轉介分潤")
        return self


def _actor(current_user: dict = Depends(get_current_user)) -> dict:
    if not has_permission(current_user, "enterprise_manage"):
        raise HTTPException(status_code=403, detail="此帳號沒有新案開通權限")
    return current_user


def _execute(query: Any, action: str) -> Any:
    try:
        return query.execute()
    except Exception as exc:
        detail = str(exc)
        if "duplicate" in detail.lower() or "23505" in detail:
            raise HTTPException(status_code=409, detail=f"{action}失敗：企業統編或唯一資料已存在") from exc
        raise HTTPException(status_code=502, detail=f"{action}失敗") from exc


def _case_row(client: Any, case_id: int) -> dict[str, Any]:
    response = _execute(
        client.table("reibi_onboarding_cases").select(CASE_SELECT).eq("id", case_id).limit(1),
        "讀取開通案件",
    )
    rows = list(getattr(response, "data", None) or [])
    if not rows:
        raise HTTPException(status_code=404, detail="找不到開通案件")
    return rows[0]


def _pdf_bytes(row: dict[str, Any], frontend_url: str) -> bytes:
    enterprise = row.get("reibi_enterprises") or {}
    font_path = os.path.join(os.path.dirname(__file__), "assets", "fonts", "NotoSansTC-Regular.ttf")
    if not os.path.exists(font_path):
        raise HTTPException(status_code=500, detail="伺服器缺少繁體中文字型，無法產生憑證函")
    pdf = FPDF()
    pdf.add_page()
    pdf.add_font("NotoSansTC", "", font_path)
    pdf.set_font("NotoSansTC", size=18)
    pdf.set_text_color(15, 118, 110)
    pdf.cell(0, 14, "REIBI 企業平台開通憑證函", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(4)
    pdf.set_text_color(30, 41, 59)
    pdf.set_font("NotoSansTC", size=11)
    fields = [
        ("憑證函編號", row.get("credential_no")),
        ("開通案件編號", row.get("case_no")),
        ("企業名稱", enterprise.get("org_name")),
        ("組織代碼", enterprise.get("org_code")),
        ("方案", enterprise.get("plan_code")),
        ("授權人數", enterprise.get("member_limit")),
        ("管理員 Email", row.get("admin_email")),
        ("登入入口", f"{frontend_url.rstrip('/')}/login"),
        ("建立時間", str(row.get("created_at") or "")[:19].replace("T", " ")),
    ]
    for label, value in fields:
        pdf.set_font("NotoSansTC", size=10)
        pdf.set_text_color(100, 116, 139)
        pdf.cell(42, 9, str(label))
        pdf.set_font("NotoSansTC", size=11)
        pdf.set_text_color(15, 23, 42)
        pdf.multi_cell(0, 9, str(value or "—"), new_x="LMARGIN", new_y="NEXT")
    pdf.ln(5)
    pdf.set_fill_color(240, 253, 250)
    pdf.set_text_color(17, 94, 89)
    pdf.multi_cell(
        0, 8,
        "安全說明：本函不包含密碼或共用 PIN。管理員須透過正式邀請設定自己的密碼，並依系統要求完成 MFA。",
        fill=True,
    )
    output = pdf.output()
    return bytes(output) if not isinstance(output, bytes) else output


def create_reibi_onboarding_router(client: Any, *, frontend_url: str) -> APIRouter:
    router = APIRouter(prefix="/api/reibi/onboarding", tags=["REIBI Onboarding"])

    @router.get("/cases")
    def list_cases(current_user: dict = Depends(_actor)):
        response = _execute(
            client.table("reibi_onboarding_cases").select(CASE_SELECT).order("created_at", desc=True).limit(500),
            "讀取開通案件",
        )
        return {"status": "success", "data": list(getattr(response, "data", None) or [])}

    @router.post("/cases", status_code=status.HTTP_201_CREATED)
    def create_case(payload: OnboardingCreate, current_user: dict = Depends(_actor)):
        values = payload.model_dump(mode="json")
        sites = values.pop("sites")
        configuration = {
            "c_layer_note": values.pop("c_layer_note"),
            "c_layer_executions": values.pop("c_layer_executions"),
            "d_layer_note": values.pop("d_layer_note"),
        }
        response = _execute(
            client.rpc("reibi_open_enterprise_case", {
                "p_enterprise": values,
                "p_sites": sites,
                "p_configuration": configuration,
                "p_created_by": str(current_user.get("uid") or current_user.get("name") or "unknown"),
            }),
            "建立新案",
        )
        result = getattr(response, "data", None) or {}
        return {"status": "success", "data": result}

    @router.get("/cases/{case_id}")
    def get_case(case_id: int, current_user: dict = Depends(_actor)):
        return {"status": "success", "data": _case_row(client, case_id)}

    @router.post("/cases/{case_id}/handoff")
    def handoff_case(case_id: int, current_user: dict = Depends(_actor)):
        row = _case_row(client, case_id)
        if row.get("status") == "cancelled":
            raise HTTPException(status_code=409, detail="已取消案件不可交付")
        now = datetime.now(timezone.utc).isoformat()
        response = _execute(
            client.table("reibi_onboarding_cases").update({
                "status": "handed_off", "handed_off_by": str(current_user.get("uid") or "unknown"),
                "handed_off_at": now, "updated_at": now,
            }).eq("id", case_id).select(CASE_SELECT),
            "標記憑證交付",
        )
        rows = list(getattr(response, "data", None) or [])
        return {"status": "success", "data": rows[0] if rows else _case_row(client, case_id)}

    @router.get("/cases/{case_id}/credential-letter")
    def credential_letter(case_id: int, current_user: dict = Depends(_actor)):
        row = _case_row(client, case_id)
        filename = f"REIBI-{row['credential_no']}.pdf"
        return Response(
            content=_pdf_bytes(row, frontend_url), media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    return router
