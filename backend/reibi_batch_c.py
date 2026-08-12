"""REIBI Batch C finance, subscription and partner-management APIs."""

import calendar
import hashlib
import secrets
from datetime import date, datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field, field_validator

from auth import require_reibi_manager, require_reibi_partner, require_reibi_super


PLAN_PRICES = {"基本": Decimal("600000"), "成長": Decimal("1200000"), "專業": Decimal("1800000"), "旗艦": Decimal("3000000")}
COMMISSION_LEVELS = {
    "silver": {"a": Decimal("8"), "b": Decimal("10"), "c": Decimal("5")},
    "gold": {"a": Decimal("14"), "b": Decimal("15"), "c": Decimal("8")},
    "platinum": {"a": Decimal("20"), "b": Decimal("20"), "c": Decimal("12")},
    "strategic": {"a": Decimal("28"), "b": Decimal("28"), "c": Decimal("18")},
}
PAYMENT_STATUSES = {"待付款", "未到期", "待確認", "部分付款", "已付款"}
INVOICE_TRANSITIONS = {
    "草稿": {"已開票", "作廢"},
    "已開票": {"待收款", "作廢"},
    "待收款": {"已收款", "作廢"},
    "已收款": set(),
    "作廢": set(),
}


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class PaymentSyncRequest(StrictModel):
    enterprise_id: Optional[int] = Field(default=None, ge=1)


class PaymentUpdate(StrictModel):
    status: Optional[str] = None
    due_date: Optional[date] = None
    notified_at: Optional[date] = None

    @field_validator("status")
    @classmethod
    def valid_status(cls, value: Optional[str]) -> Optional[str]:
        if value is not None and value not in PAYMENT_STATUSES:
            raise ValueError("不支援的付款狀態")
        return value


class RemittanceWrite(StrictModel):
    enterprise_id: Optional[int] = Field(default=None, ge=1)
    org_name_guess: Optional[str] = Field(default=None, max_length=200)
    corrected_name: Optional[str] = Field(default=None, max_length=200)
    corrected_account: Optional[str] = Field(default=None, max_length=100)
    remitted_on: Optional[date] = None
    amount: Decimal = Field(gt=0)
    note: Optional[str] = Field(default=None, max_length=2_000)


class RemittanceReview(StrictModel):
    schedule_ids: list[int] = Field(min_length=1, max_length=100)
    amount: Decimal = Field(gt=0)
    note: Optional[str] = Field(default=None, max_length=2_000)


class RejectReview(StrictModel):
    reason: str = Field(min_length=1, max_length=2_000)


class InvoiceItem(StrictModel):
    description: str = Field(min_length=1, max_length=500)
    quantity: Decimal = Field(gt=0)
    unit_price: Decimal = Field(ge=0)


class InvoiceWrite(StrictModel):
    invoice_no: str = Field(min_length=1, max_length=100)
    enterprise_id: Optional[int] = Field(default=None, ge=1)
    invoice_date: date
    layer_code: Optional[str] = Field(default=None, max_length=20)
    items: list[InvoiceItem] = Field(min_length=1, max_length=100)
    notes: Optional[str] = Field(default=None, max_length=2_000)
    linked_remittance_id: Optional[int] = Field(default=None, ge=1)
    subscription_id: Optional[int] = Field(default=None, ge=1)


class InvoiceStatusUpdate(StrictModel):
    status: Literal["草稿", "已開票", "待收款", "已收款", "作廢"]


class SubscriptionWrite(StrictModel):
    member_code: str = Field(min_length=4, max_length=100)
    subscriber_name: Optional[str] = Field(default=None, max_length=200)
    contact: Optional[str] = Field(default=None, max_length=254)
    plan_code: Literal["monthly", "annual"] = "monthly"
    plan_label: Optional[str] = Field(default=None, max_length=100)
    amount: Decimal = Field(default=Decimal("0"), ge=0)
    invoice_no: Optional[str] = Field(default=None, max_length=100)
    admin_note: Optional[str] = Field(default=None, max_length=2_000)


class SubscriptionReview(StrictModel):
    action: Literal["approve", "reject"]
    invoice_no: Optional[str] = Field(default=None, max_length=100)
    admin_note: Optional[str] = Field(default=None, max_length=2_000)


class StaffWrite(StrictModel):
    employee_code: Optional[str] = Field(default=None, max_length=100)
    name: str = Field(min_length=1, max_length=200)
    title: Optional[str] = Field(default=None, max_length=100)
    phone: Optional[str] = Field(default=None, max_length=50)
    email: Optional[str] = Field(default=None, max_length=254)
    note: Optional[str] = Field(default=None, max_length=2_000)
    is_active: bool = True


class PartnerWrite(StrictModel):
    name: str = Field(min_length=1, max_length=200)
    contact_name: Optional[str] = Field(default=None, max_length=100)
    phone: Optional[str] = Field(default=None, max_length=50)
    default_percent: Decimal = Field(default=Decimal("0"), ge=0, le=100)
    note: Optional[str] = Field(default=None, max_length=2_000)
    is_active: bool = True


class DistributorWrite(StrictModel):
    org_code: str = Field(min_length=1, max_length=100)
    distributor_type: Literal["primary", "sub"]
    name: str = Field(min_length=1, max_length=200)
    alias: Optional[str] = Field(default=None, max_length=100)
    parent_id: Optional[int] = Field(default=None, ge=1)
    staff_id: Optional[int] = Field(default=None, ge=1)
    status: str = Field(default="active", max_length=50)
    region: Optional[str] = Field(default=None, max_length=200)
    level_code: Literal["silver", "gold", "platinum", "strategic"] = "silver"
    ubn: Optional[str] = Field(default=None, max_length=20)
    address: Optional[str] = Field(default=None, max_length=500)
    contact_name: Optional[str] = Field(default=None, max_length=100)
    phone: Optional[str] = Field(default=None, max_length=50)
    email: Optional[str] = Field(default=None, max_length=254)
    has_sub_authority: bool = False
    commission_a_percent: Optional[Decimal] = Field(default=None, ge=0, le=100)
    commission_b_percent: Optional[Decimal] = Field(default=None, ge=0, le=100)
    commission_c_percent: Optional[Decimal] = Field(default=None, ge=0, le=100)
    sub_contract_start: Optional[date] = None
    sub_commission_a_percent: Optional[Decimal] = Field(default=None, ge=0, le=100)
    sub_commission_b_percent: Optional[Decimal] = Field(default=None, ge=0, le=100)
    sub_commission_c_percent: Optional[Decimal] = Field(default=None, ge=0, le=100)
    note: Optional[str] = Field(default=None, max_length=2_000)

    @field_validator("org_code")
    @classmethod
    def normalize_org_code(cls, value: str) -> str:
        return value.upper()


class RetainSettingUpdate(StrictModel):
    min_reibi_retain_percent: Decimal = Field(ge=0, le=100)


class CommissionConfirm(StrictModel):
    distributor_id: int = Field(ge=1)
    period_month: date
    note: Optional[str] = Field(default=None, max_length=2_000)

    @field_validator("period_month")
    @classmethod
    def first_day(cls, value: date) -> date:
        if value.day != 1:
            raise ValueError("period_month 必須是月份第一天")
        return value


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


def _dump(model: BaseModel, *, exclude_unset: bool = False) -> dict[str, Any]:
    return model.model_dump(mode="json", exclude_unset=exclude_unset)


def _add_years(value: date, years: int) -> date:
    return value.replace(year=value.year + years, day=min(value.day, calendar.monthrange(value.year + years, value.month)[1]))


def build_payment_schedule(enterprise: dict[str, Any]) -> list[dict[str, Any]]:
    """Port of the Artifact's authoritative buildEntPaymentRows rules."""
    start_raw = enterprise.get("contract_start")
    start = date.fromisoformat(str(start_raw)) if start_raw else None
    plan = str(enterprise.get("plan_code") or "基本")
    a_fee = Decimal(str(enterprise.get("a_layer_fee") or 0)) or PLAN_PRICES.get(plan, Decimal("240000"))
    b_fee = Decimal(str(enterprise.get("b_layer_fee") or 0))
    c_fee = Decimal(str(enterprise.get("c_layer_fee") or 0))
    d_fee = Decimal(str(enterprise.get("d_layer_fee") or 0))
    pay_mode = str(enterprise.get("pay_mode") or "annual")
    mode_label = {"annual": "年繳-5%", "semi": "半年繳", "quarterly": "季繳+3%"}.get(pay_mode, pay_mode)
    rows: list[dict[str, Any]] = []

    def add(code: str, layer: str, description: str, amount: Decimal, due: Optional[date], row_status: str) -> None:
        rows.append({"installment_code": code, "layer_code": layer, "description": description,
                     "amount": amount, "due_date": due, "status": row_status})

    add("A1", "A", f"軟體授權第1年({mode_label})", a_fee, start, "待付款")
    add("A2", "A", "軟體授權第2年", a_fee, _add_years(start, 1) if start else None, "未到期")
    add("A3", "A", "軟體授權第3年", a_fee, _add_years(start, 2) if start else None, "未到期")
    if b_fee > 0:
        add("B1", "B", "設備訂金(30%)", (b_fee * Decimal("0.3")).quantize(Decimal("1"), rounding=ROUND_HALF_UP), start, "待付款")
        add("B2", "B", "設備到貨款(40%)", (b_fee * Decimal("0.4")).quantize(Decimal("1"), rounding=ROUND_HALF_UP), None, "待確認")
        add("B3", "B", "設備完工款(30%)", (b_fee * Decimal("0.3")).quantize(Decimal("1"), rounding=ROUND_HALF_UP), None, "待確認")
    if c_fee > 0:
        add("C1", "C", "高管健促服務第1年", c_fee, start, "待付款")
        add("C2", "C", "高管健促服務第2年", c_fee, _add_years(start, 1) if start else None, "未到期")
        add("C3", "C", "高管健促服務第3年", c_fee, _add_years(start, 2) if start else None, "未到期")
    if d_fee > 0:
        half = (d_fee * Decimal("0.5")).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
        add("D1", "D", "識能佈置訂金(50%)", half, start, "待付款")
        add("D2", "D", "識能佈置驗收款(50%)", half, None, "待確認")
    return rows


def calculate_distributor_commission(distributor: dict[str, Any], enterprises: list[dict[str, Any]], min_retain: Decimal) -> dict[str, Any]:
    level = COMMISSION_LEVELS.get(str(distributor.get("level_code") or "silver"), COMMISSION_LEVELS["silver"])
    cap = Decimal("100") - min_retain
    percentages = {
        key: Decimal(str(distributor.get(f"commission_{key}_percent"))) if distributor.get(f"commission_{key}_percent") is not None else level[key]
        for key in ("a", "b", "c")
    }
    if any(value > cap for value in percentages.values()):
        raise ValueError(f"分潤比例超過每層 {cap}% 上限")
    matched = [row for row in enterprises if str(row.get("partner_code") or "").upper() == str(distributor.get("org_code") or "").upper()]
    bases = {key: sum((Decimal(str(row.get(f"{key}_layer_fee") or 0)) for row in matched), Decimal("0")) for key in ("a", "b", "c")}
    commissions = {key: (bases[key] * percentages[key] / Decimal("100")).quantize(Decimal("1"), rounding=ROUND_HALF_UP) for key in ("a", "b", "c")}
    return {"a_base": bases["a"], "b_base": bases["b"], "c_base": bases["c"],
            "a_percent": percentages["a"], "b_percent": percentages["b"], "c_percent": percentages["c"],
            "a_commission": commissions["a"], "b_commission": commissions["b"], "c_commission": commissions["c"],
            "total_commission": sum(commissions.values(), Decimal("0")),
            "annual_sales": sum(bases.values(), Decimal("0")), "enterprise_count": len(matched)}


def _enterprise(client: Any, current_user: dict[str, Any], requested_id: Optional[int] = None) -> dict[str, Any]:
    if current_user.get("role") == "reibi_super":
        if requested_id is None:
            raise HTTPException(status_code=422, detail="REIBI 超管必須指定 enterprise_id")
        query = client.table("reibi_enterprises").select("*").eq("id", requested_id).limit(1)
    else:
        org_code = str(current_user.get("org_code") or "").upper()
        if not org_code:
            raise HTTPException(status_code=400, detail="Token 缺少 org_code")
        query = client.table("reibi_enterprises").select("*").eq("org_code", org_code).limit(1)
    rows = _execute(query, "查詢企業")
    if not rows:
        raise HTTPException(status_code=404, detail="找不到目前企業")
    if requested_id is not None and current_user.get("role") != "reibi_super" and int(rows[0]["id"]) != requested_id:
        raise HTTPException(status_code=403, detail="不可存取其他企業資料")
    return rows[0]


def _scoped_row(client: Any, table: str, row_id: int, current_user: dict[str, Any]) -> dict[str, Any]:
    query = client.table(table).select("*").eq("id", row_id)
    if current_user.get("role") != "reibi_super":
        query = query.eq("enterprise_id", _enterprise(client, current_user)["id"])
    rows = _execute(query.limit(1), f"查詢 {table}")
    if not rows:
        raise HTTPException(status_code=404, detail="找不到資料，或資料不屬於目前企業")
    return rows[0]


def _paged(query: Any, page: int, size: int, label: str) -> dict[str, Any]:
    try:
        response = query.range((page - 1) * size, page * size - 1).execute()
        return {"status": "success", "data": response.data or [], "meta": {"page": page, "size": size, "total": response.count or 0}}
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Supabase {label}失敗") from exc


def _invoice_values(payload: InvoiceWrite, enterprise: dict[str, Any], current_user: dict[str, Any]) -> dict[str, Any]:
    items = _dump(payload)["items"]
    subtotal = sum((Decimal(str(item["quantity"])) * Decimal(str(item["unit_price"])) for item in items), Decimal("0"))
    tax = (subtotal * Decimal("0.05")).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    return {"invoice_no": payload.invoice_no, "enterprise_id": enterprise["id"], "org_code": enterprise.get("org_code"),
            "org_name": enterprise.get("org_name"), "ubn": enterprise.get("ubn"), "invoice_date": payload.invoice_date.isoformat(),
            "layer_code": payload.layer_code, "status": "草稿", "tax_exclusive": float(subtotal), "tax": float(tax),
            "total": float(subtotal + tax), "notes": payload.notes, "linked_remittance_id": payload.linked_remittance_id,
            "subscription_id": payload.subscription_id, "items": items, "source_payload": {},
            "created_by": current_user.get("name") or current_user.get("uid")}


def _activation_code() -> tuple[str, str, str]:
    raw = "RB-" + secrets.token_urlsafe(18)
    return raw, hashlib.sha256(raw.encode("utf-8")).hexdigest(), raw[-4:]


def _catalog_crud(router: APIRouter, client: Any, path: str, table: str, model: type[StrictModel], inactive_values: dict[str, Any]) -> None:
    @router.get(f"/{path}", name=f"list_{path}")
    def list_rows(_: dict = Depends(require_reibi_super)):
        rows = _execute(client.table(table).select("*").order("created_at", desc=True), f"查詢 {path}")
        return {"status": "success", "data": rows}

    @router.post(f"/{path}", status_code=status.HTTP_201_CREATED, name=f"create_{path}")
    def create_row(payload: model, _: dict = Depends(require_reibi_super)):  # type: ignore[valid-type]
        values = _dump(payload)
        values["source_payload"] = {}
        rows = _execute(client.table(table).insert(values), f"建立 {path}")
        return {"status": "success", "data": rows[0]}

    @router.put(f"/{path}/{{row_id}}", name=f"update_{path}")
    def update_row(row_id: int, payload: model, _: dict = Depends(require_reibi_super)):  # type: ignore[valid-type]
        values = _dump(payload)
        values["updated_at"] = _now()
        rows = _execute(client.table(table).update(values).eq("id", row_id), f"更新 {path}")
        if not rows:
            raise HTTPException(status_code=404, detail="找不到資料")
        return {"status": "success", "data": rows[0]}

    @router.delete(f"/{path}/{{row_id}}", name=f"deactivate_{path}")
    def deactivate_row(row_id: int, _: dict = Depends(require_reibi_super)):
        values = {**inactive_values, "updated_at": _now()}
        rows = _execute(client.table(table).update(values).eq("id", row_id), f"停用 {path}")
        if not rows:
            raise HTTPException(status_code=404, detail="找不到資料")
        return {"status": "success", "data": rows[0]}


def create_reibi_batch_c_router(client: Any) -> APIRouter:
    router = APIRouter(prefix="/api/reibi", tags=["REIBI Batch C"])

    @router.get("/operations/enterprises")
    def operation_enterprises(current_user: dict = Depends(require_reibi_manager)):
        query = client.table("reibi_enterprises").select(
            "id,org_code,org_name,status,partner_code,plan_code,contract_start,a_layer_fee,b_layer_fee,c_layer_fee,d_layer_fee"
        )
        if current_user.get("role") != "reibi_super":
            query = query.eq("id", _enterprise(client, current_user)["id"])
        rows = _execute(query.order("org_name"), "查詢營運企業")
        return {"status": "success", "data": rows}

    @router.get("/partner-portal/summary")
    def partner_portal_summary(current_user: dict = Depends(require_reibi_partner)):
        partner_code = str(current_user.get("partner_org_code") or current_user.get("org_code") or "").upper()
        distributors = _execute(
            client.table("reibi_distributors").select("id,parent_id,org_code,distributor_type,name,alias,status,region,level_code")
            .eq("org_code", partner_code).limit(1), "查詢經銷商入口",
        )
        if not distributors:
            raise HTTPException(status_code=404, detail="找不到經銷商資料")
        distributor = distributors[0]
        visible_distributors = [distributor]
        if current_user.get("role") == "partner_primary":
            visible_distributors.extend(_execute(
                client.table("reibi_distributors").select("id,parent_id,org_code,distributor_type,name,alias,status,region,level_code")
                .eq("parent_id", distributor["id"]).order("name"), "查詢次級經銷商",
            ))
        enterprises = _execute(
            client.table("reibi_enterprises").select("id,org_code,org_name,status,plan_code,contract_start,contract_end,a_layer_fee,b_layer_fee,c_layer_fee,d_layer_fee")
            .eq("partner_code", partner_code).order("org_name"), "查詢經銷商企業",
        )
        enterprise_ids = [row["id"] for row in enterprises]
        payments: list[dict[str, Any]] = []
        if enterprise_ids:
            payments = _execute(
                client.table("reibi_payment_schedules").select("id,enterprise_id,installment_code,layer_code,description,amount,due_date,status,paid_amount,notified_at")
                .in_("enterprise_id", enterprise_ids).order("due_date"), "查詢經銷商應收資料",
            )
        ledger = _execute(
            client.table("reibi_commission_ledger").select("id,period_month,a_commission,b_commission,c_commission,total_commission,status,confirmed_at,paid_at")
            .eq("distributor_id", distributor["id"]).order("period_month", desc=True), "查詢經銷商分潤",
        )
        return {"status": "success", "data": {"distributors": visible_distributors, "enterprises": enterprises,
                                                   "payments": payments, "commission_ledger": ledger}}

    @router.post("/finance/payments/sync")
    def sync_payments(payload: PaymentSyncRequest, current_user: dict = Depends(require_reibi_manager)):
        enterprise = _enterprise(client, current_user, payload.enterprise_id)
        existing = _execute(client.table("reibi_payment_schedules").select("installment_code,status,paid_amount,notified_at").eq("enterprise_id", enterprise["id"]), "查詢應收時程")
        protected = {row["installment_code"]: row for row in existing}
        rows = []
        for generated in build_payment_schedule(enterprise):
            old = protected.get(generated["installment_code"])
            if old and (old.get("paid_amount") or old.get("status") in {"部分付款", "已付款"}):
                generated.update({"status": old["status"], "paid_amount": old.get("paid_amount", 0), "notified_at": old.get("notified_at")})
            generated.update({"enterprise_id": enterprise["id"], "created_by": current_user.get("name"), "updated_at": _now()})
            rows.append({key: (float(value) if isinstance(value, Decimal) else value.isoformat() if isinstance(value, date) else value) for key, value in generated.items()})
        saved = _execute(client.table("reibi_payment_schedules").upsert(rows, on_conflict="enterprise_id,installment_code"), "同步應收時程")
        return {"status": "success", "data": saved}

    @router.get("/finance/payments")
    def list_payments(page: int = Query(1, ge=1), size: int = Query(100, ge=1, le=500), enterprise_id: Optional[int] = None,
                      payment_status: Optional[str] = Query(None, alias="status"), current_user: dict = Depends(require_reibi_manager)):
        query = client.table("reibi_payment_schedules").select("*,reibi_enterprises(org_code,org_name)", count="exact")
        if current_user.get("role") != "reibi_super":
            query = query.eq("enterprise_id", _enterprise(client, current_user)["id"])
        elif enterprise_id is not None:
            query = query.eq("enterprise_id", enterprise_id)
        if payment_status:
            query = query.eq("status", payment_status)
        return _paged(query.order("due_date").order("id"), page, size, "查詢應收時程")

    @router.patch("/finance/payments/{payment_id}")
    def update_payment(payment_id: int, payload: PaymentUpdate, current_user: dict = Depends(require_reibi_manager)):
        _scoped_row(client, "reibi_payment_schedules", payment_id, current_user)
        values = _dump(payload, exclude_unset=True)
        if not values:
            raise HTTPException(status_code=422, detail="至少提供一個更新欄位")
        values["updated_at"] = _now()
        rows = _execute(client.table("reibi_payment_schedules").update(values).eq("id", payment_id), "更新應收時程")
        return {"status": "success", "data": rows[0]}

    @router.get("/finance/remittances")
    def list_remittances(page: int = Query(1, ge=1), size: int = Query(100, ge=1, le=500),
                         current_user: dict = Depends(require_reibi_manager)):
        query = client.table("reibi_remittances").select("*,reibi_enterprises(org_code,org_name)", count="exact")
        if current_user.get("role") != "reibi_super":
            query = query.eq("enterprise_id", _enterprise(client, current_user)["id"])
        return _paged(query.order("submitted_at", desc=True), page, size, "查詢匯款申報")

    @router.post("/finance/remittances", status_code=status.HTTP_201_CREATED)
    def create_remittance(payload: RemittanceWrite, current_user: dict = Depends(require_reibi_manager)):
        enterprise = _enterprise(client, current_user, payload.enterprise_id)
        values = _dump(payload)
        values.update({"enterprise_id": enterprise["id"], "org_code": enterprise.get("org_code"), "status": "待審核",
                       "submitted_at": _now(), "source_payload": {}})
        rows = _execute(client.table("reibi_remittances").insert(values), "建立匯款申報")
        return {"status": "success", "data": rows[0]}

    @router.post("/finance/remittances/{remittance_id}/reconcile")
    def reconcile(remittance_id: int, payload: RemittanceReview, current_user: dict = Depends(require_reibi_manager)):
        existing = _scoped_row(client, "reibi_remittances", remittance_id, current_user)
        if existing.get("status") not in {"pending", "待審核"}:
            raise HTTPException(status_code=409, detail="此匯款申報已完成覆核，不可重複沖帳")
        try:
            response = client.rpc("reibi_reconcile_remittance", {"p_remittance_id": remittance_id, "p_schedule_ids": payload.schedule_ids,
                "p_amount": float(payload.amount), "p_reviewed_by": current_user.get("name") or current_user.get("uid"), "p_note": payload.note}).execute()
        except Exception as exc:
            raise HTTPException(status_code=409, detail="匯款沖帳失敗；請重新整理後再試") from exc
        return {"status": "success", "data": response.data}

    @router.post("/finance/remittances/{remittance_id}/reject")
    def reject_remittance(remittance_id: int, payload: RejectReview, current_user: dict = Depends(require_reibi_manager)):
        _scoped_row(client, "reibi_remittances", remittance_id, current_user)
        values = {"status": "已拒絕", "review_payload": {"reason": payload.reason, "reviewed_by": current_user.get("name")},
                  "reviewed_at": _now(), "updated_at": _now()}
        rows = _execute(client.table("reibi_remittances").update(values).eq("id", remittance_id), "拒絕匯款申報")
        return {"status": "success", "data": rows[0]}

    @router.get("/finance/invoices")
    def list_invoices(page: int = Query(1, ge=1), size: int = Query(100, ge=1, le=500), current_user: dict = Depends(require_reibi_manager)):
        query = client.table("reibi_invoices").select("*", count="exact")
        if current_user.get("role") != "reibi_super":
            query = query.eq("enterprise_id", _enterprise(client, current_user)["id"])
        return _paged(query.order("invoice_date", desc=True), page, size, "查詢發票")

    @router.post("/finance/invoices", status_code=status.HTTP_201_CREATED)
    def create_invoice(payload: InvoiceWrite, current_user: dict = Depends(require_reibi_manager)):
        enterprise = _enterprise(client, current_user, payload.enterprise_id)
        if payload.linked_remittance_id:
            linked = _scoped_row(client, "reibi_remittances", payload.linked_remittance_id, current_user)
            if int(linked["enterprise_id"]) != int(enterprise["id"]):
                raise HTTPException(status_code=422, detail="發票與匯款申報必須屬於同一企業")
        if payload.subscription_id and current_user.get("role") != "reibi_super":
            raise HTTPException(status_code=403, detail="個人訂閱發票只限 REIBI 內部財務處理")
        rows = _execute(client.table("reibi_invoices").insert(_invoice_values(payload, enterprise, current_user)), "建立發票")
        return {"status": "success", "data": rows[0]}

    @router.put("/finance/invoices/{invoice_id}")
    def update_invoice(invoice_id: int, payload: InvoiceWrite, current_user: dict = Depends(require_reibi_manager)):
        existing = _scoped_row(client, "reibi_invoices", invoice_id, current_user)
        if existing.get("status") != "草稿":
            raise HTTPException(status_code=409, detail="只有草稿發票可以修改")
        enterprise = _enterprise(client, current_user, payload.enterprise_id or existing["enterprise_id"])
        if payload.linked_remittance_id:
            linked = _scoped_row(client, "reibi_remittances", payload.linked_remittance_id, current_user)
            if int(linked["enterprise_id"]) != int(enterprise["id"]):
                raise HTTPException(status_code=422, detail="發票與匯款申報必須屬於同一企業")
        if payload.subscription_id and current_user.get("role") != "reibi_super":
            raise HTTPException(status_code=403, detail="個人訂閱發票只限 REIBI 內部財務處理")
        values = _invoice_values(payload, enterprise, current_user)
        values.update({"status": "草稿", "updated_at": _now()})
        rows = _execute(client.table("reibi_invoices").update(values).eq("id", invoice_id), "更新發票")
        return {"status": "success", "data": rows[0]}

    @router.patch("/finance/invoices/{invoice_id}/status")
    def update_invoice_status(invoice_id: int, payload: InvoiceStatusUpdate, current_user: dict = Depends(require_reibi_manager)):
        existing = _scoped_row(client, "reibi_invoices", invoice_id, current_user)
        current = str(existing.get("status") or "草稿")
        if payload.status not in INVOICE_TRANSITIONS.get(current, set()):
            raise HTTPException(status_code=409, detail=f"發票不可從「{current}」直接改為「{payload.status}」")
        rows = _execute(client.table("reibi_invoices").update({"status": payload.status, "updated_at": _now()}).eq("id", invoice_id), "更新發票狀態")
        return {"status": "success", "data": rows[0]}

    @router.delete("/finance/invoices/{invoice_id}")
    def delete_invoice(invoice_id: int, current_user: dict = Depends(require_reibi_manager)):
        existing = _scoped_row(client, "reibi_invoices", invoice_id, current_user)
        if existing.get("status") != "草稿":
            raise HTTPException(status_code=409, detail="只有草稿發票可以刪除")
        _execute(client.table("reibi_invoices").delete().eq("id", invoice_id), "刪除發票")
        return {"status": "success", "data": {"id": invoice_id}}

    @router.get("/subscriptions")
    def list_subscriptions(_: dict = Depends(require_reibi_super)):
        rows = _execute(client.table("reibi_subscriptions").select("*").order("requested_at", desc=True), "查詢訂閱")
        for row in rows:
            row.pop("activation_code_hash", None)
            row.pop("activation_code", None)
        return {"status": "success", "data": rows}

    @router.post("/subscriptions", status_code=status.HTTP_201_CREATED)
    def create_subscription(payload: SubscriptionWrite, current_user: dict = Depends(require_reibi_super)):
        values = _dump(payload)
        values.update({"member_code": payload.member_code.upper(), "status": "待審核", "requested_at": _now(),
                       "source_payload": {}, "created_by": current_user.get("name")})
        rows = _execute(client.table("reibi_subscriptions").insert(values), "建立訂閱申請")
        return {"status": "success", "data": rows[0]}

    def issue_subscription_code(subscription_id: int, current_user: dict[str, Any], *, approve: bool) -> dict[str, Any]:
        rows = _execute(client.table("reibi_subscriptions").select("*").eq("id", subscription_id).limit(1), "查詢訂閱")
        if not rows:
            raise HTTPException(status_code=404, detail="找不到訂閱申請")
        record = rows[0]
        if approve and record.get("status") != "待審核":
            raise HTTPException(status_code=409, detail="只有待審核訂閱可以核准")
        if not approve and record.get("status") != "已核准":
            raise HTTPException(status_code=409, detail="只有已核准訂閱可以重新發碼")
        raw, digest, last_four = _activation_code()
        now = datetime.now(timezone.utc)
        months = 12 if record.get("plan_code") == "annual" else 1
        year, month = now.year + (now.month - 1 + months) // 12, (now.month - 1 + months) % 12 + 1
        expires = now.replace(year=year, month=month, day=min(now.day, calendar.monthrange(year, month)[1]))
        values = {"activation_code": None, "activation_code_hash": digest, "activation_code_last_four": last_four,
                  "activation_code_issued_at": _now(), "activation_code_issued_by": current_user.get("name"), "updated_at": _now()}
        if approve:
            values.update({"status": "已核准", "approved_at": _now(), "expires_at": expires.isoformat()})
        saved = _execute(client.table("reibi_subscriptions").update(values).eq("id", subscription_id), "發放訂閱啟用碼")
        result = dict(saved[0]); result.pop("activation_code_hash", None); result["activation_code"] = raw
        return result

    @router.post("/subscriptions/{subscription_id}/review")
    def review_subscription(subscription_id: int, payload: SubscriptionReview, current_user: dict = Depends(require_reibi_super)):
        if payload.action == "approve":
            if payload.invoice_no is not None or payload.admin_note is not None:
                _execute(client.table("reibi_subscriptions").update({"invoice_no": payload.invoice_no, "admin_note": payload.admin_note}).eq("id", subscription_id), "更新訂閱審核資料")
            return {"status": "success", "data": issue_subscription_code(subscription_id, current_user, approve=True)}
        rows = _execute(client.table("reibi_subscriptions").update({"status": "已拒絕", "admin_note": payload.admin_note,
            "activation_code": None, "activation_code_hash": None, "updated_at": _now()}).eq("id", subscription_id), "拒絕訂閱")
        if not rows:
            raise HTTPException(status_code=404, detail="找不到訂閱申請")
        return {"status": "success", "data": rows[0]}

    @router.post("/subscriptions/{subscription_id}/reissue")
    def reissue_subscription(subscription_id: int, current_user: dict = Depends(require_reibi_super)):
        return {"status": "success", "data": issue_subscription_code(subscription_id, current_user, approve=False)}

    _catalog_crud(router, client, "staff", "reibi_staff", StaffWrite, {"is_active": False})
    _catalog_crud(router, client, "partners", "reibi_partners", PartnerWrite, {"is_active": False})
    _catalog_crud(router, client, "distributors", "reibi_distributors", DistributorWrite, {"status": "inactive"})

    @router.get("/finance/settings")
    def finance_settings(_: dict = Depends(require_reibi_super)):
        rows = _execute(client.table("reibi_finance_settings").select("*").eq("id", 1).limit(1), "查詢財務設定")
        return {"status": "success", "data": rows[0]}

    @router.patch("/finance/settings")
    def update_finance_settings(payload: RetainSettingUpdate, current_user: dict = Depends(require_reibi_super)):
        current = _execute(client.table("reibi_distributors").select("id,commission_a_percent,commission_b_percent,commission_c_percent"), "驗證分潤護欄")
        cap = Decimal("100") - payload.min_reibi_retain_percent
        if any(Decimal(str(row.get(key))) > cap for row in current for key in ("commission_a_percent", "commission_b_percent", "commission_c_percent") if row.get(key) is not None):
            raise HTTPException(status_code=409, detail="既有經銷商分潤比例超過新上限，請先調整經銷商資料")
        rows = _execute(client.table("reibi_finance_settings").update({"min_reibi_retain_percent": float(payload.min_reibi_retain_percent),
            "updated_by": current_user.get("name"), "updated_at": _now()}).eq("id", 1), "更新財務設定")
        return {"status": "success", "data": rows[0]}

    def commission_preview_rows() -> list[dict[str, Any]]:
        settings = _execute(client.table("reibi_finance_settings").select("min_reibi_retain_percent").eq("id", 1).limit(1), "查詢分潤設定")
        min_retain = Decimal(str(settings[0]["min_reibi_retain_percent"] if settings else 65))
        distributors = _execute(client.table("reibi_distributors").select("*").eq("status", "active").order("name"), "查詢經銷商")
        enterprises = _execute(client.table("reibi_enterprises").select("id,org_code,org_name,partner_code,a_layer_fee,b_layer_fee,c_layer_fee"), "查詢企業分潤基礎")
        result = []
        for distributor in distributors:
            try:
                calculation = calculate_distributor_commission(distributor, enterprises, min_retain)
                result.append({**distributor, **calculation, "guardrail_error": None})
            except ValueError as exc:
                result.append({**distributor, "guardrail_error": str(exc)})
        return result

    @router.get("/commissions/preview")
    def commission_preview(_: dict = Depends(require_reibi_super)):
        return {"status": "success", "data": commission_preview_rows()}

    @router.get("/commissions/ledger")
    def commission_ledger(_: dict = Depends(require_reibi_super)):
        rows = _execute(client.table("reibi_commission_ledger").select("*,reibi_distributors(name,org_code)").order("period_month", desc=True), "查詢分潤帳冊")
        return {"status": "success", "data": rows}

    @router.post("/commissions/ledger", status_code=status.HTTP_201_CREATED)
    def confirm_commission(payload: CommissionConfirm, current_user: dict = Depends(require_reibi_super)):
        preview = next((row for row in commission_preview_rows() if int(row["id"]) == payload.distributor_id), None)
        if not preview:
            raise HTTPException(status_code=404, detail="找不到啟用中的經銷商")
        if preview.get("guardrail_error"):
            raise HTTPException(status_code=409, detail=preview["guardrail_error"])
        keys = ("a_base", "b_base", "c_base", "a_percent", "b_percent", "c_percent", "a_commission", "b_commission", "c_commission", "total_commission")
        values = {key: float(preview[key]) for key in keys}
        values.update({"distributor_id": payload.distributor_id, "period_month": payload.period_month.isoformat(), "status": "已確認待匯款",
            "note": payload.note, "calculation_snapshot": {"enterprise_count": preview["enterprise_count"], "org_code": preview["org_code"]},
            "confirmed_by": current_user.get("name") or current_user.get("uid")})
        try:
            rows = _execute(client.table("reibi_commission_ledger").insert(values), "確認分潤出帳")
        except HTTPException as exc:
            raise HTTPException(status_code=409, detail="該經銷商本月分潤已確認") from exc
        return {"status": "success", "data": rows[0]}

    @router.post("/commissions/ledger/{ledger_id}/paid")
    def mark_commission_paid(ledger_id: int, current_user: dict = Depends(require_reibi_super)):
        rows = _execute(client.table("reibi_commission_ledger").update({"status": "已匯款", "paid_by": current_user.get("name"),
            "paid_at": _now()}).eq("id", ledger_id).eq("status", "已確認待匯款"), "標記分潤匯款")
        if not rows:
            raise HTTPException(status_code=409, detail="找不到待匯款的分潤記錄")
        return {"status": "success", "data": rows[0]}

    return router
