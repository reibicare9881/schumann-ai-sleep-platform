"""REIBI business APIs and Artifact import pipeline.

The browser never receives a Supabase service-role key. Every operation in this
router is authenticated by the FastAPI JWT layer and scoped before the shared
server-side Supabase client is used.
"""

from __future__ import annotations

import hashlib
import json
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Any, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field, field_validator

from auth import require_reibi_manager, require_reibi_super


ARTIFACT_SOURCES = {"main", "l5", "quote", "workorder"}
IMPORT_MAX_BYTES = 10 * 1024 * 1024
IMPORT_MAX_ENTRIES = 5_000
SENSITIVE_KEY_FRAGMENTS = (
    "password", "secret", "token", "pin", "backupcode", "activationcode",
    "imgfull", "imgthumb", "imagebase64",
)
SKIPPED_STORAGE_PREFIXES = (
    "sess", "rem_", "pin_", "rc_", "lk_", "l5_session", "rq_session",
    "l5_active_context", "l5_pin_", "__rq_handoff_",
)
ENTERPRISE_FIELDS = (
    "id,org_code,org_name,org_alias,enterprise_type,status,ubn,contact_name,phone,email,"
    "address,industry,plan_code,member_limit,used_count,contract_start,contract_end,"
    "contract_years,pay_mode,consultant,partner_code,referral_percent,a_layer_fee,"
    "b_layer_fee,c_layer_fee,d_layer_fee,devices,d_layer_config,created_at,updated_at"
)
ENTERPRISE_SITE_FIELDS = "id,label,address,note,sort_order,created_at,updated_at"
DEPARTMENT_FIELDS = "id,parent_id,name,hierarchy_level,sort_order,is_active,created_at,updated_at"
QUOTE_STATUSES = ("草稿", "已發送", "已確認", "作廢", "已轉合約")
CONTRACT_STATUSES = ("草稿(合約)", "已發送", "待用印", "用印完成", "執行中", "存檔")
WORK_ORDER_STATUSES = (
    "草稿", "已發出", "出貨中", "安裝中", "待驗收", "驗收中",
    "驗收完成", "驗收異常", "已存檔",
)
LIFECYCLE_TRANSITIONS = {
    "quote": {
        "草稿": {"已發送", "作廢"},
        "已發送": {"已確認", "作廢"},
        "已確認": {"作廢"},
        "作廢": set(),
        "已轉合約": set(),
    },
    "contract": {
        "草稿(合約)": {"已發送"},
        "已發送": {"待用印"},
        "待用印": {"用印完成"},
        "用印完成": {"執行中"},
        "執行中": {"存檔"},
        "存檔": set(),
    },
    "work_order": {
        "草稿": {"已發出"},
        "已發出": {"出貨中"},
        "出貨中": {"安裝中"},
        "安裝中": {"待驗收"},
        "待驗收": {"驗收中"},
        "驗收中": {"驗收完成", "驗收異常"},
        "驗收異常": {"安裝中", "驗收中"},
        "驗收完成": {"已存檔"},
        "已存檔": set(),
    },
}


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class EnterpriseDevices(StrictModel):
    cloudBeds: int = Field(default=0, ge=0, le=10_000)
    relaxChairs: int = Field(default=0, ge=0, le=10_000)
    la200: int = Field(default=0, ge=0, le=10_000)


class EnterpriseDLayerConfig(StrictModel):
    poster: bool = False
    board: bool = False
    digital: bool = False
    qr: bool = False
    display: bool = False
    install: bool = False


class EnterpriseWrite(StrictModel):
    org_name: str = Field(min_length=1, max_length=200)
    org_alias: Optional[str] = Field(default=None, max_length=100)
    status: str = Field(default="pending", max_length=50)
    ubn: Optional[str] = Field(default=None, max_length=20)
    contact_name: Optional[str] = Field(default=None, max_length=100)
    phone: Optional[str] = Field(default=None, max_length=50)
    email: Optional[str] = Field(default=None, max_length=254)
    address: Optional[str] = Field(default=None, max_length=500)
    industry: Optional[str] = Field(default=None, max_length=100)
    plan_code: Optional[str] = Field(default=None, max_length=50)
    member_limit: int = Field(default=0, ge=0)
    used_count: int = Field(default=0, ge=0)
    contract_start: Optional[date] = None
    contract_end: Optional[date] = None
    contract_years: Optional[int] = Field(default=None, ge=1, le=99)
    pay_mode: Optional[str] = Field(default=None, max_length=50)
    consultant: Optional[str] = Field(default=None, max_length=100)
    partner_code: Optional[str] = Field(default=None, max_length=100)
    referral_percent: Optional[Decimal] = Field(default=None, ge=0, le=100)
    a_layer_fee: Decimal = Field(default=Decimal("0"), ge=0)
    b_layer_fee: Decimal = Field(default=Decimal("0"), ge=0)
    c_layer_fee: Decimal = Field(default=Decimal("0"), ge=0)
    d_layer_fee: Decimal = Field(default=Decimal("0"), ge=0)
    devices: EnterpriseDevices = Field(default_factory=EnterpriseDevices)
    d_layer_config: EnterpriseDLayerConfig = Field(default_factory=EnterpriseDLayerConfig)

    @field_validator("contract_end")
    @classmethod
    def validate_contract_dates(cls, value: Optional[date], info: Any) -> Optional[date]:
        start = info.data.get("contract_start")
        if value and start and value < start:
            raise ValueError("contract_end 不可早於 contract_start")
        return value


class EnterpriseSiteWrite(StrictModel):
    label: str = Field(min_length=1, max_length=200)
    address: Optional[str] = Field(default=None, max_length=500)
    note: Optional[str] = Field(default=None, max_length=500)
    sort_order: int = Field(default=0, ge=0)


class EnterpriseSiteUpdate(StrictModel):
    label: Optional[str] = Field(default=None, min_length=1, max_length=200)
    address: Optional[str] = Field(default=None, max_length=500)
    note: Optional[str] = Field(default=None, max_length=500)
    sort_order: Optional[int] = Field(default=None, ge=0)


class DepartmentWrite(StrictModel):
    name: str = Field(min_length=1, max_length=200)
    parent_id: Optional[int] = Field(default=None, ge=1)
    sort_order: int = Field(default=0, ge=0)
    is_active: bool = True


class DepartmentUpdate(StrictModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    parent_id: Optional[int] = Field(default=None, ge=1)
    sort_order: Optional[int] = Field(default=None, ge=0)
    is_active: Optional[bool] = None


class QuoteWrite(StrictModel):
    doc_no: Optional[str] = Field(default=None, min_length=1, max_length=100)
    doc_type: str = Field(min_length=1, max_length=50)
    status: str = Field(default="草稿", max_length=50)
    distributor_id: Optional[int] = Field(default=None, ge=1)
    partner_id: Optional[int] = Field(default=None, ge=1)
    staff_id: Optional[int] = Field(default=None, ge=1)
    client_name: str = Field(min_length=1, max_length=200)
    client_alias: Optional[str] = Field(default=None, max_length=100)
    contact_name: Optional[str] = Field(default=None, max_length=100)
    phone: Optional[str] = Field(default=None, max_length=50)
    email: Optional[str] = Field(default=None, max_length=254)
    address: Optional[str] = Field(default=None, max_length=500)
    industry: Optional[str] = Field(default=None, max_length=100)
    member_count: Optional[int] = Field(default=None, ge=0)
    pay_mode: Optional[str] = Field(default=None, max_length=50)
    contract_years: Optional[int] = Field(default=None, ge=1, le=99)
    contract_start: Optional[date] = None
    contract_end: Optional[date] = None
    a_layer_fee: Decimal = Field(default=Decimal("0"), ge=0)
    b_layer_fee: Decimal = Field(default=Decimal("0"), ge=0)
    c_layer_fee: Decimal = Field(default=Decimal("0"), ge=0)
    d_layer_fee_min: Decimal = Field(default=Decimal("0"), ge=0)
    d_layer_fee_max: Decimal = Field(default=Decimal("0"), ge=0)
    e_layer_fee: Decimal = Field(default=Decimal("0"), ge=0)
    total_year_fee: Decimal = Field(default=Decimal("0"), ge=0)
    total_contract_fee: Decimal = Field(default=Decimal("0"), ge=0)
    original_contract_no: Optional[str] = Field(default=None, max_length=100)
    config: dict[str, Any] = Field(default_factory=dict)


class ContractWrite(StrictModel):
    doc_no: Optional[str] = Field(default=None, min_length=1, max_length=100)
    contract_type: str = Field(min_length=1, max_length=50)
    status: str = Field(default="草稿(合約)", max_length=50)
    quote_id: Optional[int] = Field(default=None, ge=1)
    from_quote_no: Optional[str] = Field(default=None, max_length=100)
    client_name: str = Field(min_length=1, max_length=200)
    contract_start: Optional[date] = None
    contract_end: Optional[date] = None
    total_year_fee: Decimal = Field(default=Decimal("0"), ge=0)
    total_contract_fee: Decimal = Field(default=Decimal("0"), ge=0)
    terms: dict[str, Any] = Field(default_factory=dict)


class WorkOrderWrite(StrictModel):
    work_order_no: Optional[str] = Field(default=None, min_length=1, max_length=100)
    contract_id: Optional[int] = Field(default=None, ge=1)
    contract_no: Optional[str] = Field(default=None, max_length=100)
    client_name: str = Field(min_length=1, max_length=200)
    status: str = Field(default="草稿", max_length=50)
    contact_name: Optional[str] = Field(default=None, max_length=100)
    phone: Optional[str] = Field(default=None, max_length=50)
    email: Optional[str] = Field(default=None, max_length=254)
    address: Optional[str] = Field(default=None, max_length=500)
    scheduled_date: Optional[date] = None
    service_period: Optional[str] = Field(default=None, max_length=100)
    staff_names: Optional[str] = Field(default=None, max_length=500)
    scope_confirm_reibi: Optional[str] = Field(default=None, max_length=100)
    scope_confirm_reibi_date: Optional[date] = None
    scope_confirm_client: Optional[str] = Field(default=None, max_length=100)
    scope_confirm_client_date: Optional[date] = None
    acceptance_result: Optional[str] = Field(default=None, max_length=50)
    acceptance_date: Optional[date] = None
    client_sign_name: Optional[str] = Field(default=None, max_length=100)
    punch_list: Optional[str] = Field(default=None, max_length=2_000)
    items: dict[str, Any] = Field(default_factory=dict)
    acceptance: dict[str, Any] = Field(default_factory=dict)


class LifecycleStatusUpdate(StrictModel):
    status: str = Field(min_length=1, max_length=50)


class QuoteConvertRequest(StrictModel):
    contract_type: str = Field(default="企業合約", min_length=1, max_length=50)
    terms: dict[str, Any] = Field(default_factory=dict)


class ContractAdjustmentRequest(StrictModel):
    adjustment_type: Literal["upgrade", "renewal"]


class ContractExecutionUpdate(StrictModel):
    signed_by: Optional[str] = Field(default=None, max_length=100)
    signed_at: Optional[date] = None
    sealed_at: Optional[date] = None
    executed_at: Optional[date] = None
    note: Optional[str] = Field(default=None, max_length=1_000)


class WorkOrderAcceptance(StrictModel):
    acceptance_result: Literal["驗收完成", "驗收異常"]
    acceptance_date: date
    client_sign_name: str = Field(min_length=1, max_length=100)
    punch_list: Optional[str] = Field(default=None, max_length=2_000)
    acceptance: dict[str, Any] = Field(default_factory=dict)


class WorkOrderFromContractRequest(StrictModel):
    contact_name: Optional[str] = Field(default=None, max_length=100)
    phone: Optional[str] = Field(default=None, max_length=50)
    email: Optional[str] = Field(default=None, max_length=254)
    address: Optional[str] = Field(default=None, max_length=500)
    scheduled_date: Optional[date] = None
    service_period: Optional[str] = Field(default=None, max_length=100)
    staff_names: Optional[str] = Field(default=None, max_length=500)
    items: dict[str, Any] = Field(default_factory=dict)


class QuoteCalculationRequest(StrictModel):
    member_count: Optional[int] = Field(default=None, ge=0)
    pay_mode: Literal["annual", "semi", "quarterly"] = "annual"
    contract_years: int = Field(default=3, ge=1, le=99)
    discount_percent: Decimal = Field(default=Decimal("0"), ge=0, le=99)
    a_custom_fee: Optional[Decimal] = Field(default=None, ge=0)
    b_bed: int = Field(default=0, ge=0, le=10_000)
    b_chair: int = Field(default=0, ge=0, le=10_000)
    b_la200: int = Field(default=0, ge=0, le=10_000)
    c_tier: Optional[Literal["基本型", "成長型", "專業型", "旗艦型"]] = None
    c_high_risk: int = Field(default=0, ge=0, le=10_000)
    c_custom_fee: Optional[Decimal] = Field(default=None, ge=0)
    d_items: list[Literal["poster", "board", "display", "qr", "digital", "install"]] = Field(default_factory=list)
    e_layer_fee: Decimal = Field(default=Decimal("0"), ge=0)


class ArtifactEntry(StrictModel):
    storage_key: str = Field(min_length=1, max_length=300)
    value: Any


class ArtifactExport(StrictModel):
    source_artifact: Literal["main", "l5", "quote", "workorder"]
    source_version: Optional[str] = Field(default=None, max_length=100)
    entries: list[ArtifactEntry] = Field(min_length=1, max_length=IMPORT_MAX_ENTRIES)


def _now_iso() -> str:
    return datetime.now().astimezone().isoformat()


def _clean_optional(value: Any) -> Optional[str]:
    if value is None:
        return None
    result = str(value).strip()
    return result or None


def _int(value: Any, default: int = 0) -> int:
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return default


def _money(value: Any) -> float:
    try:
        return float(Decimal(str(value or 0)))
    except (InvalidOperation, TypeError, ValueError):
        return 0.0


def _date(value: Any) -> Optional[str]:
    if not value:
        return None
    try:
        return date.fromisoformat(str(value)[:10]).isoformat()
    except ValueError:
        return None


def _timestamp(value: Any) -> Optional[str]:
    if not value:
        return None
    raw = str(value).replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(raw).isoformat()
    except ValueError:
        return None


def _decode_storage_value(value: Any) -> Any:
    if not isinstance(value, str):
        return value
    candidate = value.strip()
    if not candidate or candidate[0] not in "[{\"-0123456789tfn":
        return value
    try:
        return json.loads(candidate)
    except json.JSONDecodeError:
        return value


def _redact_secrets(value: Any) -> Any:
    if isinstance(value, list):
        return [_redact_secrets(item) for item in value]
    if not isinstance(value, dict):
        return value
    clean: dict[str, Any] = {}
    for key, child in value.items():
        compact = str(key).replace("_", "").lower()
        if any(fragment in compact for fragment in SENSITIVE_KEY_FRAGMENTS):
            continue
        clean[str(key)] = _redact_secrets(child)
    return clean


def _is_skipped_storage_key(storage_key: str) -> bool:
    lowered = storage_key.lower()
    return any(lowered == prefix or lowered.startswith(prefix) for prefix in SKIPPED_STORAGE_PREFIXES)


def _target_for_key(storage_key: str) -> Optional[str]:
    exact = {
        "l5_enterprises": "reibi_enterprises",
        "l5_distributors": "reibi_distributors",
        "l5_partners": "reibi_partners",
        "l5_staff": "reibi_staff",
        "l5_invoices": "reibi_invoices",
        "l5_personal_subs": "reibi_subscriptions",
        "l5_tickets": "reibi_service_tickets",
        "l5_line_logs": "reibi_message_logs",
        "rq_quotes": "reibi_quotes",
        "rq_contracts": "reibi_contracts",
        "rq_workorders": "reibi_work_orders",
        "subs": "reibi_subscriptions",
        "rpts": "reibi_health_assessments",
    }
    if storage_key in exact:
        return exact[storage_key]
    prefix_targets = (
        ("remit_", "reibi_remittances"),
        ("sleep_diary_", "reibi_health_diary_entries"),
        ("pain_diary_", "reibi_health_diary_entries"),
        ("ow_hist_", "reibi_health_assessments"),
        ("msk_hist_", "reibi_health_assessments"),
        ("bsrs5_hist_", "reibi_health_assessments"),
        ("viol_hist_", "reibi_health_assessments"),
        ("mental_hist_", "reibi_health_assessments"),
        ("ohs_hazards_", "reibi_ohs_records"),
        ("ohs_measures_", "reibi_ohs_records"),
        ("ohs_reviews_", "reibi_ohs_records"),
        ("ohs_meta_", "reibi_ohs_records"),
        ("ow_roster_", "reibi_ohs_records"),
        ("org_th_", "reibi_org_aggregates"),
        ("l5_mhi_agg_", "reibi_org_aggregates"),
        ("l5_health_agg_", "reibi_org_aggregates"),
    )
    return next((table for prefix, table in prefix_targets if storage_key.startswith(prefix)), None)


def _record_id(record: Any, index: int) -> str:
    if isinstance(record, dict):
        for key in ("id", "docNo", "woNo", "orgCode", "memberCode", "invoiceNo"):
            if record.get(key) not in (None, ""):
                return str(record[key])
    return str(index)


def plan_artifact_import(export: ArtifactExport) -> dict[str, Any]:
    """Pure validation/planning step used by both dry-run API and unit tests."""
    canonical = json.dumps(export.model_dump(mode="json"), ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    byte_size = len(canonical.encode("utf-8"))
    if byte_size > IMPORT_MAX_BYTES:
        raise ValueError(f"匯出檔超過 {IMPORT_MAX_BYTES // 1024 // 1024} MB 上限")

    planned: list[dict[str, Any]] = []
    warnings: list[str] = []
    storage_keys: dict[str, int] = {}
    target_counts: dict[str, int] = {}
    skipped_count = 0
    seen_record_ids: set[tuple[str, str]] = set()

    for entry in export.entries:
        key = entry.storage_key.strip()
        decoded = _decode_storage_value(entry.value)
        if _is_skipped_storage_key(key):
            skipped_count += 1
            warnings.append(f"{key}: session/憑證/暫存資料不搬移")
            continue
        records = decoded if isinstance(decoded, list) else [decoded]
        target = _target_for_key(key)
        if target is None:
            warnings.append(f"{key}: 尚無正規化目標，僅保留於匯入佇列")
        for index, record in enumerate(records):
            source_record_id = _record_id(record, index)
            identity = (key, source_record_id)
            if identity in seen_record_ids:
                source_record_id = f"{source_record_id}#{index}"
                identity = (key, source_record_id)
                warnings.append(f"{key}: 重複來源 ID，已以陣列位置區分")
            seen_record_ids.add(identity)
            sanitized = _redact_secrets(record)
            planned.append({
                "storage_key": key,
                "source_record_id": source_record_id,
                "target_table": target,
                "raw_payload": sanitized if isinstance(sanitized, (dict, list)) else {"value": sanitized},
                "decoded_record": record,
            })
            storage_keys[key] = storage_keys.get(key, 0) + 1
            if target:
                target_counts[target] = target_counts.get(target, 0) + 1

    return {
        "sha256": hashlib.sha256(canonical.encode("utf-8")).hexdigest(),
        "byte_size": byte_size,
        "record_count": len(planned),
        "skipped_count": skipped_count,
        "storage_keys": storage_keys,
        "target_counts": target_counts,
        "warnings": warnings,
        "records": planned,
    }


def _artifact_enterprise(record: dict[str, Any]) -> dict[str, Any]:
    return {
        "artifact_id": _clean_optional(record.get("id")),
        "org_code": str(record.get("orgCode") or "").upper(),
        "org_name": str(record.get("orgName") or "").strip(),
        "org_alias": _clean_optional(record.get("orgAlias")),
        "enterprise_type": "partner" if record.get("type") == "partner" else "enterprise",
        "status": _clean_optional(record.get("status")) or "pending",
        "ubn": _clean_optional(record.get("ubn")),
        "contact_name": _clean_optional(record.get("contact")),
        "phone": _clean_optional(record.get("phone")),
        "email": _clean_optional(record.get("email")),
        "address": _clean_optional(record.get("address")),
        "industry": _clean_optional(record.get("industry")),
        "plan_code": _clean_optional(record.get("plan")),
        "member_limit": max(0, _int(record.get("memberCount"))),
        "used_count": max(0, _int(record.get("usedCount"))),
        "contract_start": _date(record.get("contractStart")),
        "contract_end": _date(record.get("contractEnd")),
        "contract_years": _int(record.get("contractYears")) or None,
        "pay_mode": _clean_optional(record.get("payMode")),
        "consultant": _clean_optional(record.get("consultant")),
        "partner_code": _clean_optional(record.get("partnerCode")),
        "referral_percent": _money(record.get("referralPct")) if record.get("referralPct") not in (None, "") else None,
        "a_layer_fee": _money(record.get("aLayerFee")),
        "b_layer_fee": _money(record.get("bLayerFee")),
        "c_layer_fee": _money(record.get("cLayerFee")),
        "d_layer_fee": _money(record.get("dLayerFee")),
        "devices": record.get("devices") if isinstance(record.get("devices"), dict) else {},
        "d_layer_config": record.get("dLayer") if isinstance(record.get("dLayer"), dict) else {},
        "source_payload": _redact_secrets(record),
        "created_at": _timestamp(record.get("createdAt")) or _now_iso(),
        "updated_at": _timestamp(record.get("updatedAt")) or _now_iso(),
    }


def _artifact_staff(record: dict[str, Any]) -> dict[str, Any]:
    return {
        "artifact_id": _clean_optional(record.get("id")),
        "employee_code": _clean_optional(record.get("empCode")),
        "name": str(record.get("name") or "").strip(),
        "title": _clean_optional(record.get("title")),
        "phone": _clean_optional(record.get("phone")),
        "email": _clean_optional(record.get("email")),
        "note": _clean_optional(record.get("note")),
        "source_payload": _redact_secrets(record),
        "created_at": _timestamp(record.get("createdAt")) or _now_iso(),
        "updated_at": _timestamp(record.get("updatedAt")) or _now_iso(),
    }


def _artifact_partner(record: dict[str, Any]) -> dict[str, Any]:
    return {
        "artifact_id": _clean_optional(record.get("id")),
        "name": str(record.get("name") or "").strip(),
        "contact_name": _clean_optional(record.get("contact")),
        "phone": _clean_optional(record.get("phone")),
        "default_percent": _money(record.get("defaultPct")),
        "note": _clean_optional(record.get("note")),
        "source_payload": _redact_secrets(record),
        "created_at": _timestamp(record.get("createdAt")) or _now_iso(),
        "updated_at": _timestamp(record.get("updatedAt")) or _now_iso(),
    }


def _artifact_distributor(record: dict[str, Any]) -> dict[str, Any]:
    dist_type = record.get("type") if record.get("type") in {"primary", "sub"} else "primary"
    return {
        "artifact_id": _clean_optional(record.get("id")),
        "org_code": str(record.get("orgCode") or "").upper(),
        "distributor_type": dist_type,
        "name": str(record.get("name") or "").strip(),
        "alias": _clean_optional(record.get("alias")),
        "status": _clean_optional(record.get("status")) or "active",
        "region": _clean_optional(record.get("region")),
        "level_code": _clean_optional(record.get("level")),
        "ubn": _clean_optional(record.get("ubn")),
        "address": _clean_optional(record.get("address")),
        "contact_name": _clean_optional(record.get("contact")),
        "phone": _clean_optional(record.get("phone")),
        "email": _clean_optional(record.get("email")),
        "has_sub_authority": bool(record.get("hasSubAuth")),
        "commission_percent": _money(record.get("commissionPct")) if record.get("commissionPct") not in (None, "") else None,
        "source_payload": _redact_secrets(record),
        "created_at": _timestamp(record.get("createdAt")) or _now_iso(),
        "updated_at": _timestamp(record.get("updatedAt")) or _now_iso(),
    }


def _artifact_quote(record: dict[str, Any]) -> dict[str, Any]:
    return {
        "artifact_id": _clean_optional(record.get("id")),
        "doc_no": str(record.get("docNo") or "").strip(),
        "doc_type": str(record.get("docType") or "unknown"),
        "status": str(record.get("status") or "draft"),
        "client_name": str(record.get("clientName") or record.get("distName") or "").strip(),
        "client_alias": _clean_optional(record.get("clientAlias") or record.get("distAlias")),
        "contact_name": _clean_optional(record.get("contact") or record.get("distContact")),
        "phone": _clean_optional(record.get("phone") or record.get("distPhone")),
        "email": _clean_optional(record.get("email") or record.get("distEmail")),
        "address": _clean_optional(record.get("address")),
        "industry": _clean_optional(record.get("industry")),
        "member_count": max(0, _int(record.get("memberCount"))) if record.get("memberCount") not in (None, "") else None,
        "pay_mode": _clean_optional(record.get("payMode")),
        "contract_years": _int(record.get("contractYears")) or None,
        "contract_start": _date(record.get("contractStart")),
        "contract_end": _date(record.get("contractEnd")),
        "a_layer_fee": _money(record.get("aFee")),
        "b_layer_fee": _money(record.get("bFee")),
        "c_layer_fee": _money(record.get("cFeeTotal")),
        "d_layer_fee_min": _money(record.get("dFeeMin")),
        "d_layer_fee_max": _money(record.get("dFeeMax")),
        "e_layer_fee": _money(record.get("eTotalFee")),
        "total_year_fee": _money(record.get("totalYearFee")),
        "total_contract_fee": _money(record.get("total3Year")),
        "original_contract_no": _clean_optional(record.get("origContractNo")),
        "linked_contract_no": _clean_optional(record.get("linkedContractNo")),
        "config": _redact_secrets({
            "bBed": record.get("bBed"), "bChair": record.get("bChair"), "bLA200": record.get("bLA200"),
            "cTier": record.get("cTier"), "dItems": record.get("dItems"), "dSites": record.get("dSites"),
            "eValueAdded": record.get("eValueAdded"), "upgradeCalc": record.get("upgradeCalc"),
        }),
        "versions": record.get("versions") if isinstance(record.get("versions"), list) else [],
        "source_payload": _redact_secrets(record),
        "created_by": _clean_optional(record.get("createdBy")),
        "created_at": _timestamp(record.get("createdAt")) or _now_iso(),
        "updated_at": _timestamp(record.get("updatedAt")) or _now_iso(),
    }


def _artifact_contract(record: dict[str, Any]) -> dict[str, Any]:
    return {
        "artifact_id": _clean_optional(record.get("id")),
        "doc_no": str(record.get("docNo") or "").strip(),
        "contract_type": str(record.get("docType") or "unknown"),
        "status": str(record.get("status") or "draft"),
        "from_quote_no": _clean_optional(record.get("fromQuoteNo")),
        "client_name": str(record.get("clientName") or "").strip(),
        "contract_start": _date(record.get("contractStart")),
        "contract_end": _date(record.get("contractEnd")),
        "total_year_fee": _money(record.get("totalYearFee")),
        "total_contract_fee": _money(record.get("total3Year")),
        "terms": _redact_secrets({"note": record.get("note"), "versions": record.get("versions", [])}),
        "source_payload": _redact_secrets(record),
        "created_by": _clean_optional(record.get("createdBy")),
        "created_at": _timestamp(record.get("createdAt")) or _now_iso(),
        "updated_at": _timestamp(record.get("updatedAt")) or _now_iso(),
    }


def _artifact_work_order(record: dict[str, Any]) -> dict[str, Any]:
    return {
        "artifact_id": _clean_optional(record.get("id")),
        "work_order_no": str(record.get("woNo") or "").strip(),
        "contract_no": _clean_optional(record.get("contractNo")),
        "client_name": str(record.get("clientName") or "").strip(),
        "status": str(record.get("status") or "draft"),
        "contact_name": _clean_optional(record.get("contact")),
        "phone": _clean_optional(record.get("phone")),
        "email": _clean_optional(record.get("email")),
        "address": _clean_optional(record.get("address")),
        "scheduled_date": _date(record.get("scheduledDate")),
        "service_period": _clean_optional(record.get("period")),
        "staff_names": _clean_optional(record.get("staffNames")),
        "scope_confirm_reibi": _clean_optional(record.get("scopeConfirmReibi")),
        "scope_confirm_reibi_date": _date(record.get("scopeConfirmReibiDate")),
        "scope_confirm_client": _clean_optional(record.get("scopeConfirmClient")),
        "scope_confirm_client_date": _date(record.get("scopeConfirmClientDate")),
        "acceptance_result": _clean_optional(record.get("overallResult")),
        "acceptance_date": _date(record.get("acceptDate")),
        "client_sign_name": _clean_optional(record.get("clientSignName")),
        "punch_list": _clean_optional(record.get("punchList")),
        "items": _redact_secrets({
            "selectedItems": record.get("selectedItems", {}), "itemSpecs": record.get("itemSpecs", {}),
            "itemQty": record.get("itemQty", {}), "itemNote": record.get("itemNote", {}),
            "customItems": record.get("customItems", []), "dSites": record.get("dSites", []),
        }),
        "acceptance": _redact_secrets({"acceptChecks": record.get("acceptChecks", {}), "checkNotes": record.get("checkNotes", {})}),
        "status_history": record.get("statusHistory") if isinstance(record.get("statusHistory"), list) else [],
        "source_payload": _redact_secrets(record),
        "created_by": _clean_optional(record.get("createdBy")),
        "created_at": _timestamp(record.get("createdAt")) or _now_iso(),
        "updated_at": _timestamp(record.get("updatedAt")) or _now_iso(),
    }


def _stable_artifact_id(prefix: str, record: dict[str, Any]) -> str:
    canonical = json.dumps(record, ensure_ascii=False, sort_keys=True, separators=(",", ":"), default=str)
    return f"{prefix}_{hashlib.sha256(canonical.encode('utf-8')).hexdigest()[:24]}"


def _artifact_invoice(record: dict[str, Any]) -> dict[str, Any]:
    return {
        "artifact_id": _clean_optional(record.get("id")) or _stable_artifact_id("invoice", record),
        "invoice_no": str(record.get("invoiceNo") or "").strip(),
        "org_code": _clean_optional(record.get("orgCode")),
        "org_name": _clean_optional(record.get("orgName")),
        "ubn": _clean_optional(record.get("ubn")),
        "invoice_date": _date(record.get("invoiceDate")),
        "layer_code": _clean_optional(record.get("layer")),
        "status": _clean_optional(record.get("status")) or "issued",
        "tax_exclusive": _money(record.get("taxExcl")),
        "tax": _money(record.get("tax")),
        "total": _money(record.get("total")),
        "notes": _clean_optional(record.get("notes")),
        "items": record.get("items") if isinstance(record.get("items"), list) else [],
        "source_payload": _redact_secrets(record),
        "created_by": _clean_optional(record.get("createdBy")),
        "created_at": _timestamp(record.get("createdAt")) or _now_iso(),
        "updated_at": _timestamp(record.get("updatedAt")) or _now_iso(),
    }


def _artifact_subscription(record: dict[str, Any]) -> dict[str, Any]:
    requested_at = _timestamp(record.get("requestedAt")) or _timestamp(record.get("createdAt")) or _now_iso()
    return {
        "artifact_id": _clean_optional(record.get("id")) or _stable_artifact_id("subscription", record),
        "member_code": str(record.get("memberCode") or "").strip().upper(),
        "subscriber_name": _clean_optional(record.get("name")),
        "contact": _clean_optional(record.get("contact")),
        "plan_code": str(record.get("plan") or "unknown"),
        "plan_label": _clean_optional(record.get("planLabel")),
        "status": str(record.get("status") or "pending"),
        "amount": _money(record.get("amount")),
        "invoice_no": _clean_optional(record.get("invoiceNo")),
        "activation_code": None,
        "consent_version": _clean_optional(record.get("consentVersion")),
        "consent_at": _timestamp(record.get("consentAt")),
        "requested_at": requested_at,
        "approved_at": _timestamp(record.get("approvedAt")),
        "expires_at": _timestamp(record.get("expiresAt")),
        "admin_note": _clean_optional(record.get("adminNote") or record.get("note")),
        "source_payload": _redact_secrets(record),
        "created_by": _clean_optional(record.get("createdBy")),
        "created_at": _timestamp(record.get("createdAt")) or requested_at,
        "updated_at": _timestamp(record.get("updatedAt")) or _now_iso(),
    }


def _artifact_ticket(record: dict[str, Any]) -> dict[str, Any]:
    return {
        "artifact_id": _clean_optional(record.get("id")) or _stable_artifact_id("ticket", record),
        "ticket_type": str(record.get("type") or "other"),
        "priority": str(record.get("priority") or "normal"),
        "status": str(record.get("status") or "pending"),
        "preferred_date": _date(record.get("preferDate")),
        "note": _clean_optional(record.get("note")),
        "handler": _clean_optional(record.get("handler")),
        "source_payload": _redact_secrets(record),
        "created_by": _clean_optional(record.get("createdBy")),
        "created_at": _timestamp(record.get("createdAt")) or _now_iso(),
        "updated_at": _timestamp(record.get("updatedAt")) or _now_iso(),
    }


def _artifact_message(record: dict[str, Any]) -> dict[str, Any]:
    return {
        "artifact_id": _clean_optional(record.get("id")) or _stable_artifact_id("message", record),
        "target_type": str(record.get("targetType") or "unknown"),
        "target_artifact_id": _clean_optional(record.get("targetId")),
        "target_name": _clean_optional(record.get("targetName")),
        "template_code": _clean_optional(record.get("tmpl")),
        "message": str(record.get("msg") or ""),
        "sender": _clean_optional(record.get("sender")),
        "status": str(record.get("status") or "unknown"),
        "source_payload": _redact_secrets(record),
        "sent_at": _timestamp(record.get("ts")) or _now_iso(),
    }


def _dynamic_import_values(storage_key: str, record: dict[str, Any]) -> Optional[tuple[str, dict[str, Any], Optional[str]]]:
    if storage_key.startswith("remit_"):
        org_code = str(record.get("orgCode") or storage_key[len("remit_"):]).upper()
        values = {
            "artifact_id": _clean_optional(record.get("id")) or _stable_artifact_id("remittance", record),
            "org_code": org_code,
            "org_name_guess": _clean_optional(record.get("orgNameGuess")),
            "corrected_name": _clean_optional(record.get("correctedName")),
            "corrected_account": _clean_optional(record.get("correctedAccount")),
            "remitted_on": _date(record.get("correctedDate")),
            "amount": _money(record.get("correctedAmount")),
            "status": _clean_optional(record.get("status")) or "pending",
            "note": _clean_optional(record.get("note")),
            "ai_result": record.get("aiOriginal") if isinstance(record.get("aiOriginal"), dict) else None,
            "ai_provider": None,
            "ai_model": None,
            "image_storage_path": None,
            "review_payload": _redact_secrets({"reviewRowIds": record.get("reviewRowIds"), "reviewNote": record.get("reviewNote")}),
            "source_payload": _redact_secrets(record),
            "submitted_at": _timestamp(record.get("submittedAt")) or _timestamp(record.get("createdAt")),
            "reviewed_at": _timestamp(record.get("reviewedAt")),
            "created_at": _timestamp(record.get("createdAt")) or _now_iso(),
            "updated_at": _timestamp(record.get("updatedAt")) or _now_iso(),
        }
        return "reibi_remittances", values, "artifact_id"

    diary_prefixes = {"sleep_diary_": "sleep", "pain_diary_": "pain"}
    for prefix, diary_type in diary_prefixes.items():
        if storage_key.startswith(prefix):
            user_key = storage_key[len(prefix):] or "unknown"
            entry_date = _date(record.get("date") or record.get("entryDate") or record.get("ts"))
            values = {
                "artifact_user_key": user_key,
                "diary_type": diary_type,
                "entry_date": entry_date,
                "source_payload": _redact_secrets(record),
                "created_at": _timestamp(record.get("createdAt")) or _now_iso(),
                "updated_at": _timestamp(record.get("updatedAt")) or _now_iso(),
            }
            return "reibi_health_diary_entries", values, "artifact_user_key,diary_type,entry_date"

    assessment_prefixes = {
        "ow_hist_": "ow", "msk_hist_": "msk", "bsrs5_hist_": "bsrs5",
        "viol_hist_": "violence", "mental_hist_": "mental",
    }
    if storage_key == "rpts":
        values = {
            "artifact_id": _clean_optional(record.get("id")) or _stable_artifact_id("assessment", record),
            "artifact_user_key": _clean_optional(record.get("uid")) or "unknown",
            "org_code": _clean_optional(record.get("orgCode")),
            "assessment_type": "combined",
            "score": _money(record.get("sScore")),
            "secondary_score": _money(record.get("pScore")),
            "level_code": _clean_optional((record.get("sL") or {}).get("key") if isinstance(record.get("sL"), dict) else record.get("sKey")),
            "level_label": _clean_optional((record.get("sL") or {}).get("label") if isinstance(record.get("sL"), dict) else None),
            "answers": _redact_secrets({"profile": record.get("profile"), "workScore": record.get("wScore")}),
            "recommendations": record.get("recs") if isinstance(record.get("recs"), dict) else {},
            "ai_provider": None,
            "ai_model": None,
            "source_payload": _redact_secrets(record),
            "assessed_at": _timestamp(record.get("ts")) or _now_iso(),
        }
        return "reibi_health_assessments", values, "assessment_type,artifact_user_key,artifact_id"
    for prefix, assessment_type in assessment_prefixes.items():
        if storage_key.startswith(prefix):
            user_key = storage_key[len(prefix):] or "unknown"
            primary_score = record.get("score", record.get("sum", record.get("maxScore")))
            values = {
                "artifact_id": _clean_optional(record.get("id")) or _stable_artifact_id(assessment_type, record),
                "artifact_user_key": user_key,
                "org_code": _clean_optional(record.get("orgCode")),
                "assessment_type": assessment_type,
                "score": _money(primary_score),
                "secondary_score": None,
                "level_code": _clean_optional(record.get("level")),
                "level_label": _clean_optional(record.get("label")),
                "is_flagged": bool(record.get("item6Flag") or record.get("screened")),
                "answers": _redact_secrets(record.get("ans") or record.get("scores") or {}),
                "recommendations": {},
                "source_payload": _redact_secrets(record),
                "assessed_at": _timestamp(record.get("ts")) or _now_iso(),
            }
            return "reibi_health_assessments", values, "assessment_type,artifact_user_key,artifact_id"

    ohs_prefixes = {
        "ohs_hazards_": "hazard", "ohs_measures_": "measure", "ohs_reviews_": "review",
        "ohs_meta_": "meta", "ow_roster_": "roster",
    }
    for prefix, record_type in ohs_prefixes.items():
        if storage_key.startswith(prefix):
            org_code = storage_key[len(prefix):].upper()
            values = {
                "artifact_id": _clean_optional(record.get("id") or record.get("empId")) or _stable_artifact_id(record_type, record),
                "org_code": org_code,
                "record_type": record_type,
                "status": _clean_optional(record.get("status")),
                "risk_level": _clean_optional(record.get("risk")),
                "owner": _clean_optional(record.get("owner")),
                "due_date": _date(record.get("dueDate")),
                "verified_at": _date(record.get("verifyDate")),
                "source_payload": _redact_secrets(record),
                "created_at": _timestamp(record.get("createdAt")) or _now_iso(),
                "updated_at": _timestamp(record.get("updatedAt")) or _now_iso(),
            }
            return "reibi_ohs_records", values, "org_code,record_type,artifact_id"

    aggregate_prefixes = ("org_th_", "l5_mhi_agg_", "l5_health_agg_")
    for prefix in aggregate_prefixes:
        if storage_key.startswith(prefix):
            org_code = str(record.get("orgCode") or storage_key[len(prefix):]).upper()
            sample_size = _int(record.get("n") or record.get("sampleSize"))
            values = {
                "org_code": org_code,
                "department_key": _clean_optional(record.get("dept")) or "",
                "aggregate_type": prefix.rstrip("_"),
                "sample_size": sample_size,
                "metrics": _redact_secrets(record),
                "period_start": _date(record.get("periodStart")),
                "period_end": _date(record.get("periodEnd")),
                "calculated_at": _timestamp(record.get("updatedAt")) or _now_iso(),
                "source_payload": _redact_secrets(record),
            }
            return "reibi_org_aggregates", values, None
    return None


TRANSFORMERS = {
    "l5_enterprises": ("reibi_enterprises", _artifact_enterprise, "artifact_id"),
    "l5_staff": ("reibi_staff", _artifact_staff, "artifact_id"),
    "l5_partners": ("reibi_partners", _artifact_partner, "artifact_id"),
    "l5_distributors": ("reibi_distributors", _artifact_distributor, "artifact_id"),
    "rq_quotes": ("reibi_quotes", _artifact_quote, "artifact_id"),
    "rq_contracts": ("reibi_contracts", _artifact_contract, "artifact_id"),
    "rq_workorders": ("reibi_work_orders", _artifact_work_order, "artifact_id"),
    "l5_invoices": ("reibi_invoices", _artifact_invoice, "artifact_id"),
    "l5_personal_subs": ("reibi_subscriptions", _artifact_subscription, "artifact_id"),
    "subs": ("reibi_subscriptions", _artifact_subscription, "artifact_id"),
    "l5_tickets": ("reibi_service_tickets", _artifact_ticket, "artifact_id"),
    "l5_line_logs": ("reibi_message_logs", _artifact_message, "artifact_id"),
}


def _ensure_required(payload: dict[str, Any], fields: tuple[str, ...]) -> None:
    missing = [field for field in fields if payload.get(field) in (None, "")]
    if missing:
        raise ValueError(f"缺少必要欄位: {', '.join(missing)}")


def _resolve_department_level(
    departments: list[dict[str, Any]],
    department_id: Optional[int],
    parent_id: Optional[int],
) -> int:
    """Calculate a department level from parent links and reject cycles/orphans."""
    if parent_id is None:
        return 1
    by_id = {int(row["id"]): row for row in departments}
    visited = {department_id} if department_id is not None else set()
    level = 1
    cursor: Optional[int] = parent_id
    while cursor is not None:
        if cursor in visited:
            raise ValueError("部門階層不可形成循環")
        visited.add(cursor)
        parent = by_id.get(cursor)
        if parent is None:
            raise ValueError("上層部門不存在，或不屬於目前企業")
        level += 1
        if level > 4:
            raise ValueError("部門階層最多四層")
        raw_parent = parent.get("parent_id")
        cursor = int(raw_parent) if raw_parent is not None else None
    return level


def _execute(query: Any, operation: str) -> list[dict[str, Any]]:
    try:
        response = query.execute()
        if response.data is None:
            return []
        return response.data if isinstance(response.data, list) else [response.data]
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Supabase {operation} 失敗") from exc


def _current_enterprise_id(client: Any, current_user: dict[str, Any], required: bool = True) -> Optional[int]:
    org_code = str(current_user.get("org_code") or "").upper()
    if current_user.get("role") == "reibi_super" and not org_code:
        if required:
            raise HTTPException(status_code=400, detail="跨組織操作必須指定 org_code")
        return None
    rows = _execute(
        client.table("reibi_enterprises").select("id,org_code").eq("org_code", org_code).limit(1),
        "查詢企業",
    )
    if not rows:
        if required:
            raise HTTPException(status_code=404, detail="此單位尚未建立 REIBI 企業資料")
        return None
    return int(rows[0]["id"])


def _serialize_payload(model: BaseModel) -> dict[str, Any]:
    return model.model_dump(mode="json", exclude_none=True)


def _serialize_update(model: BaseModel) -> dict[str, Any]:
    return model.model_dump(mode="json", exclude_unset=True)


def calculate_quote_fees(payload: QuoteCalculationRequest) -> dict[str, Any]:
    """Reproduce the Artifact quote rules without exposing its internal floor prices."""
    a_tiers = ((100, 600_000), (300, 1_200_000), (500, 1_800_000), (1_000, 3_000_000))
    pay_factors = {
        "annual": Decimal("0.95"),
        "semi": Decimal("1.00"),
        "quarterly": Decimal("1.03"),
    }
    c_tiers = {"基本型": 35_000, "成長型": 70_000, "專業型": 105_000, "旗艦型": 210_000}
    d_prices = {
        "poster": (15_000, 30_000), "board": (25_000, 50_000),
        "display": (20_000, 40_000), "qr": (5_000, 10_000),
        "digital": (30_000, 60_000), "install": (10_000, 25_000),
    }
    discount = Decimal("1") - (payload.discount_percent / Decimal("100"))

    a_base = 0
    if payload.member_count is not None:
        for maximum, annual_fee in a_tiers:
            if payload.member_count <= maximum:
                a_base = annual_fee
                break
    a_fee = payload.a_custom_fee.quantize(Decimal("1")) if payload.a_custom_fee is not None else (
        Decimal(a_base) * pay_factors[payload.pay_mode] * discount
    ).quantize(Decimal("1"))
    b_base = payload.b_bed * 800_000 + payload.b_chair * 750_000 + payload.b_la200 * 149_400
    b_fee = (Decimal(b_base) * discount).quantize(Decimal("1"))
    c_base = payload.c_custom_fee if payload.c_custom_fee is not None else Decimal(c_tiers.get(payload.c_tier or "", 0))
    c_fee = ((c_base + Decimal(payload.c_high_risk * 14_000)) * discount).quantize(Decimal("1"))
    d_min = (Decimal(sum(d_prices[item][0] for item in payload.d_items)) * discount).quantize(Decimal("1"))
    d_max = (Decimal(sum(d_prices[item][1] for item in payload.d_items)) * discount).quantize(Decimal("1"))
    e_fee = payload.e_layer_fee.quantize(Decimal("1"))
    total_year = a_fee + c_fee + e_fee
    total_contract = total_year * payload.contract_years + b_fee
    return {
        "a_layer_fee": a_fee,
        "b_layer_fee": b_fee,
        "c_layer_fee": c_fee,
        "d_layer_fee_min": d_min,
        "d_layer_fee_max": d_max,
        "e_layer_fee": e_fee,
        "total_year_fee": total_year,
        "total_contract_fee": total_contract,
        "grand_total_min": total_contract + d_min,
        "grand_total_max": total_contract + d_max,
        "a_custom_required": payload.member_count is not None and payload.member_count > 1_000,
    }


def _assert_lifecycle_transition(kind: str, current_status: str, next_status: str) -> None:
    allowed = LIFECYCLE_TRANSITIONS.get(kind, {}).get(current_status)
    if allowed is None:
        raise ValueError(f"未知的目前狀態：{current_status}")
    if next_status not in allowed:
        raise ValueError(f"不可從「{current_status}」直接變更為「{next_status}」")


def _next_document_no(client: Any, kind: str, doc_type: Optional[str] = None) -> str:
    rows = _execute(
        client.rpc("reibi_next_document_no", {"p_kind": kind, "p_doc_type": doc_type}),
        "產生正式文件編號",
    )
    if not rows:
        raise HTTPException(status_code=502, detail="Supabase 未回傳正式文件編號")
    value = rows[0] if isinstance(rows[0], str) else next(iter(rows[0].values()), None)
    if not value:
        raise HTTPException(status_code=502, detail="Supabase 回傳的正式文件編號無效")
    return str(value)


def _append_version(existing: Any, status_value: str, user_name: Optional[str], **extra: Any) -> list[dict[str, Any]]:
    versions = list(existing) if isinstance(existing, list) else []
    versions.append({"savedAt": _now_iso(), "status": status_value, "by": user_name, **extra})
    return versions


def _enterprise_metrics(
    enterprise: dict[str, Any],
    registered_member_count: int = 0,
    as_of: Optional[date] = None,
) -> dict[str, Any]:
    member_limit = max(0, int(enterprise.get("member_limit") or 0))
    used_count = max(0, int(enterprise.get("used_count") or 0))
    usage_percent = round((used_count / member_limit) * 100, 1) if member_limit else None
    contract_end_raw = enterprise.get("contract_end")
    contract_start_raw = enterprise.get("contract_start")
    today = as_of or date.today()
    contract_days_left: Optional[int] = None
    contract_state = "not_set"
    if contract_end_raw:
        try:
            contract_end = contract_end_raw if isinstance(contract_end_raw, date) else date.fromisoformat(str(contract_end_raw)[:10])
            contract_days_left = (contract_end - today).days
            if contract_days_left < 0:
                contract_state = "expired"
            elif contract_days_left <= 30:
                contract_state = "expiring"
            else:
                contract_state = "active"
            if contract_start_raw:
                contract_start = contract_start_raw if isinstance(contract_start_raw, date) else date.fromisoformat(str(contract_start_raw)[:10])
                if contract_start > today:
                    contract_state = "upcoming"
        except (TypeError, ValueError):
            contract_state = "invalid"
    return {
        "member_limit": member_limit,
        "used_count": used_count,
        "registered_member_count": max(0, int(registered_member_count)),
        "usage_percent": usage_percent,
        "usage_alert": usage_percent is not None and usage_percent >= 90,
        "usage_count_outdated": max(0, int(registered_member_count)) != used_count,
        "contract_state": contract_state,
        "contract_days_left": contract_days_left,
    }


def _attach_department_counts(
    departments: list[dict[str, Any]],
    profile_departments: list[Optional[str]],
) -> tuple[list[dict[str, Any]], dict[str, int]]:
    rows = [dict(row) for row in departments]
    name_to_ids: dict[str, list[int]] = {}
    for row in rows:
        normalized = " ".join(str(row.get("name") or "").split()).casefold()
        if normalized:
            name_to_ids.setdefault(normalized, []).append(int(row["id"]))

    direct_counts = {int(row["id"]): 0 for row in rows}
    unassigned = 0
    ambiguous = 0
    unmatched = 0
    for department_name in profile_departments:
        normalized = " ".join(str(department_name or "").split()).casefold()
        if not normalized:
            unassigned += 1
            continue
        matching_ids = name_to_ids.get(normalized, [])
        if len(matching_ids) == 1:
            direct_counts[matching_ids[0]] += 1
        elif len(matching_ids) > 1:
            ambiguous += 1
        else:
            unmatched += 1

    children: dict[Optional[int], list[int]] = {}
    for row in rows:
        raw_parent = row.get("parent_id")
        parent_id = int(raw_parent) if raw_parent is not None else None
        children.setdefault(parent_id, []).append(int(row["id"]))

    def total_for(department_id: int, path: set[int]) -> int:
        if department_id in path:
            return 0
        next_path = {*path, department_id}
        return direct_counts.get(department_id, 0) + sum(
            total_for(child_id, next_path) for child_id in children.get(department_id, [])
        )

    for row in rows:
        department_id = int(row["id"])
        row["direct_member_count"] = direct_counts.get(department_id, 0)
        row["member_count"] = total_for(department_id, set())
    return rows, {
        "profile_count": len(profile_departments),
        "unassigned_count": unassigned,
        "ambiguous_count": ambiguous,
        "unmatched_count": unmatched,
    }


def create_reibi_router(client: Any) -> APIRouter:
    router = APIRouter(prefix="/api/reibi", tags=["REIBI"])

    @router.get("/overview")
    def overview(current_user: dict = Depends(require_reibi_manager)):
        enterprise_id = _current_enterprise_id(client, current_user, required=False)
        if enterprise_id is None:
            return {"status": "success", "data": {"enterprise": None, "metrics": None, "quotes": 0, "contracts": 0, "work_orders": 0}}
        enterprise = _execute(
            client.table("reibi_enterprises").select(ENTERPRISE_FIELDS).eq("id", enterprise_id).limit(1),
            "查詢企業",
        )
        org_code = str(current_user.get("org_code") or "").upper()
        try:
            profile_response = (
                client.table("profiles").select("id", count="exact").eq("org_code", org_code).limit(1).execute()
            )
            registered_member_count = int(profile_response.count or 0)
        except Exception as exc:
            raise HTTPException(status_code=502, detail="Supabase 統計企業帳號失敗") from exc
        counts: dict[str, int] = {}
        for label, table in (("quotes", "reibi_quotes"), ("contracts", "reibi_contracts"), ("work_orders", "reibi_work_orders")):
            try:
                response = client.table(table).select("id", count="exact").eq("enterprise_id", enterprise_id).limit(1).execute()
                counts[label] = int(response.count or 0)
            except Exception as exc:
                raise HTTPException(status_code=502, detail=f"Supabase 統計 {label} 失敗") from exc
        enterprise_data = enterprise[0] if enterprise else None
        return {
            "status": "success",
            "data": {
                "enterprise": enterprise_data,
                "metrics": _enterprise_metrics(enterprise_data, registered_member_count) if enterprise_data else None,
                **counts,
            },
        }

    @router.get("/enterprise")
    def get_enterprise(current_user: dict = Depends(require_reibi_manager)):
        enterprise_id = _current_enterprise_id(client, current_user)
        rows = _execute(
            client.table("reibi_enterprises").select(ENTERPRISE_FIELDS).eq("id", enterprise_id).limit(1),
            "查詢企業",
        )
        return {"status": "success", "data": rows[0]}

    @router.put("/enterprise")
    def upsert_enterprise(payload: EnterpriseWrite, current_user: dict = Depends(require_reibi_manager)):
        org_code = str(current_user.get("org_code") or "").upper()
        if not org_code:
            raise HTTPException(status_code=400, detail="Token 缺少 org_code")
        values = payload.model_dump(mode="json")
        values.update({"org_code": org_code, "updated_at": _now_iso()})
        rows = _execute(
            client.table("reibi_enterprises").upsert(values, on_conflict="org_code"),
            "儲存企業",
        )
        return {"status": "success", "data": rows[0] if rows else values}

    @router.get("/enterprise/sites")
    def list_enterprise_sites(current_user: dict = Depends(require_reibi_manager)):
        enterprise_id = _current_enterprise_id(client, current_user)
        rows = _execute(
            client.table("reibi_enterprise_sites").select(ENTERPRISE_SITE_FIELDS).eq("enterprise_id", enterprise_id)
            .order("sort_order").order("id"),
            "查詢企業場域",
        )
        return {"status": "success", "data": rows}

    @router.post("/enterprise/sites", status_code=status.HTTP_201_CREATED)
    def create_enterprise_site(payload: EnterpriseSiteWrite, current_user: dict = Depends(require_reibi_manager)):
        values = _serialize_payload(payload)
        values.update({"enterprise_id": _current_enterprise_id(client, current_user), "source_payload": {}})
        rows = _execute(client.table("reibi_enterprise_sites").insert(values), "建立企業場域")
        return {"status": "success", "data": rows[0]}

    @router.patch("/enterprise/sites/{site_id}")
    def update_enterprise_site(site_id: int, payload: EnterpriseSiteUpdate, current_user: dict = Depends(require_reibi_manager)):
        enterprise_id = _current_enterprise_id(client, current_user)
        existing = _execute(
            client.table("reibi_enterprise_sites").select("id").eq("id", site_id)
            .eq("enterprise_id", enterprise_id).limit(1),
            "驗證企業場域",
        )
        if not existing:
            raise HTTPException(status_code=404, detail="找不到場域，或場域不屬於目前企業")
        values = _serialize_update(payload)
        if not values:
            raise HTTPException(status_code=422, detail="至少提供一個要更新的欄位")
        if "label" in payload.model_fields_set and payload.label is None:
            raise HTTPException(status_code=422, detail="場域名稱不可為空")
        if "sort_order" in payload.model_fields_set and payload.sort_order is None:
            raise HTTPException(status_code=422, detail="場域排序不可為空")
        values["updated_at"] = _now_iso()
        rows = _execute(
            client.table("reibi_enterprise_sites").update(values).eq("id", site_id)
            .eq("enterprise_id", enterprise_id),
            "更新企業場域",
        )
        return {"status": "success", "data": rows[0]}

    @router.delete("/enterprise/sites/{site_id}")
    def delete_enterprise_site(site_id: int, current_user: dict = Depends(require_reibi_manager)):
        enterprise_id = _current_enterprise_id(client, current_user)
        existing = _execute(
            client.table("reibi_enterprise_sites").select("id").eq("id", site_id)
            .eq("enterprise_id", enterprise_id).limit(1),
            "驗證企業場域",
        )
        if not existing:
            raise HTTPException(status_code=404, detail="找不到場域，或場域不屬於目前企業")
        _execute(
            client.table("reibi_enterprise_sites").delete().eq("id", site_id)
            .eq("enterprise_id", enterprise_id),
            "刪除企業場域",
        )
        return {"status": "success", "data": {"id": site_id}}

    def enterprise_departments(enterprise_id: int) -> list[dict[str, Any]]:
        return _execute(
            client.table("reibi_departments").select(DEPARTMENT_FIELDS).eq("enterprise_id", enterprise_id)
            .order("hierarchy_level").order("sort_order").order("id"),
            "查詢部門",
        )

    def profile_departments(org_code: str) -> list[Optional[str]]:
        values: list[Optional[str]] = []
        offset = 0
        page_size = 1_000
        while True:
            rows = _execute(
                client.table("profiles").select("department").eq("org_code", org_code)
                .range(offset, offset + page_size - 1),
                "統計部門人數",
            )
            values.extend(row.get("department") for row in rows)
            if len(rows) < page_size:
                break
            offset += page_size
        return values

    @router.get("/enterprise/departments")
    def list_departments(current_user: dict = Depends(require_reibi_manager)):
        enterprise_id = _current_enterprise_id(client, current_user)
        org_code = str(current_user.get("org_code") or "").upper()
        rows, count_meta = _attach_department_counts(
            enterprise_departments(enterprise_id),
            profile_departments(org_code),
        )
        return {"status": "success", "data": rows, "meta": count_meta}

    @router.post("/enterprise/departments", status_code=status.HTTP_201_CREATED)
    def create_department(payload: DepartmentWrite, current_user: dict = Depends(require_reibi_manager)):
        enterprise_id = _current_enterprise_id(client, current_user)
        departments = enterprise_departments(enterprise_id)
        try:
            level = _resolve_department_level(departments, None, payload.parent_id)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        values = _serialize_payload(payload)
        values.update({
            "enterprise_id": enterprise_id,
            "hierarchy_level": level,
            "source_payload": {},
        })
        rows = _execute(client.table("reibi_departments").insert(values), "建立部門")
        return {"status": "success", "data": rows[0]}

    @router.patch("/enterprise/departments/{department_id}")
    def update_department(department_id: int, payload: DepartmentUpdate, current_user: dict = Depends(require_reibi_manager)):
        enterprise_id = _current_enterprise_id(client, current_user)
        departments = enterprise_departments(enterprise_id)
        existing = next((row for row in departments if int(row["id"]) == department_id), None)
        if existing is None:
            raise HTTPException(status_code=404, detail="找不到部門，或部門不屬於目前企業")
        values = _serialize_update(payload)
        if not values:
            raise HTTPException(status_code=422, detail="至少提供一個要更新的欄位")
        if "name" in payload.model_fields_set and payload.name is None:
            raise HTTPException(status_code=422, detail="部門名稱不可為空")
        if "sort_order" in payload.model_fields_set and payload.sort_order is None:
            raise HTTPException(status_code=422, detail="部門排序不可為空")
        if "is_active" in payload.model_fields_set and payload.is_active is None:
            raise HTTPException(status_code=422, detail="部門啟用狀態不可為空")
        if "parent_id" in payload.model_fields_set:
            has_children = any(row.get("parent_id") == department_id for row in departments)
            if has_children and payload.parent_id != existing.get("parent_id"):
                raise HTTPException(status_code=409, detail="此部門仍有下層部門；請先移動下層部門再變更上層")
            try:
                values["hierarchy_level"] = _resolve_department_level(departments, department_id, payload.parent_id)
            except ValueError as exc:
                raise HTTPException(status_code=422, detail=str(exc)) from exc
        values["updated_at"] = _now_iso()
        rows = _execute(
            client.table("reibi_departments").update(values).eq("id", department_id)
            .eq("enterprise_id", enterprise_id),
            "更新部門",
        )
        return {"status": "success", "data": rows[0]}

    @router.delete("/enterprise/departments/{department_id}")
    def delete_department(department_id: int, current_user: dict = Depends(require_reibi_manager)):
        enterprise_id = _current_enterprise_id(client, current_user)
        departments = enterprise_departments(enterprise_id)
        existing = next((row for row in departments if int(row["id"]) == department_id), None)
        if existing is None:
            raise HTTPException(status_code=404, detail="找不到部門，或部門不屬於目前企業")
        if any(row.get("parent_id") == department_id for row in departments):
            raise HTTPException(status_code=409, detail="此部門仍有下層部門，不可直接刪除")
        _execute(
            client.table("reibi_departments").delete().eq("id", department_id)
            .eq("enterprise_id", enterprise_id),
            "刪除部門",
        )
        return {"status": "success", "data": {"id": department_id}}

    @router.get("/business-catalogs")
    def business_catalogs(current_user: dict = Depends(require_reibi_manager)):
        enterprise_id = _current_enterprise_id(client, current_user)
        distributors = _execute(
            client.table("reibi_distributors").select("id,name,alias,status,level_code,has_sub_authority").eq("status", "active").order("name"),
            "查詢經銷商",
        )
        partners = _execute(
            client.table("reibi_partners").select("id,name,default_percent,is_active").eq("is_active", True).order("name"),
            "查詢合作夥伴",
        )
        staff = _execute(
            client.table("reibi_staff").select("id,name,title,is_active").eq("is_active", True).order("name"),
            "查詢負責人員",
        )
        sites = _execute(
            client.table("reibi_enterprise_sites").select("id,label,address,note").eq("enterprise_id", enterprise_id).order("sort_order").order("id"),
            "查詢報價服務場域",
        )
        return {"status": "success", "data": {"distributors": distributors, "partners": partners, "staff": staff, "sites": sites}}

    def validate_quote_relations(payload: QuoteWrite, enterprise_id: int) -> None:
        if payload.doc_type == "經銷商報價":
            if payload.distributor_id is None:
                raise HTTPException(status_code=422, detail="經銷商報價必須指定經銷商")
            monetary_fields = (
                payload.a_layer_fee, payload.b_layer_fee, payload.c_layer_fee,
                payload.d_layer_fee_min, payload.d_layer_fee_max, payload.e_layer_fee,
                payload.total_year_fee, payload.total_contract_fee,
            )
            if any(value != 0 for value in monetary_fields):
                raise HTTPException(status_code=422, detail="經銷商資格報價不可帶入企業 A–E 層費用")
        if payload.doc_type in {"升級報價", "續約報價"}:
            if not payload.original_contract_no:
                raise HTTPException(status_code=422, detail="升級或續約報價必須關聯原合約")
            contracts = _execute(
                client.table("reibi_contracts").select("id").eq("doc_no", payload.original_contract_no)
                .eq("enterprise_id", enterprise_id).limit(1),
                "驗證原合約",
            )
            if not contracts:
                raise HTTPException(status_code=422, detail="原合約不存在或不屬於目前企業")
        relations = (
            ("reibi_distributors", payload.distributor_id, "經銷商"),
            ("reibi_partners", payload.partner_id, "合作夥伴"),
            ("reibi_staff", payload.staff_id, "負責人員"),
        )
        for table, relation_id, label in relations:
            if relation_id is None:
                continue
            rows = _execute(client.table(table).select("id").eq("id", relation_id).limit(1), f"驗證{label}")
            if not rows:
                raise HTTPException(status_code=422, detail=f"指定的{label}不存在")

    def list_scoped(
        table: str,
        current_user: dict,
        page: int,
        size: int,
        record_status: Optional[str] = None,
        search: Optional[str] = None,
    ) -> dict[str, Any]:
        enterprise_id = _current_enterprise_id(client, current_user)
        start = (page - 1) * size
        number_field = "work_order_no" if table == "reibi_work_orders" else "doc_no"
        try:
            query = client.table(table).select("*", count="exact").eq("enterprise_id", enterprise_id)
            if record_status:
                query = query.eq("status", record_status)
            if search:
                query = query.ilike(number_field, f"%{search.strip()}%")
            response = query.order("created_at", desc=True).range(start, start + size - 1).execute()
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"Supabase 查詢 {table} 失敗") from exc
        return {"status": "success", "data": response.data or [], "meta": {"page": page, "size": size, "total": response.count or 0}}

    def get_scoped(table: str, record_id: int, current_user: dict) -> tuple[int, dict[str, Any]]:
        enterprise_id = _current_enterprise_id(client, current_user)
        rows = _execute(
            client.table(table).select("*").eq("id", record_id).eq("enterprise_id", enterprise_id).limit(1),
            f"驗證 {table}",
        )
        if not rows:
            raise HTTPException(status_code=404, detail="找不到資料，或資料不屬於目前企業")
        return enterprise_id, rows[0]

    def update_scoped_status(
        kind: str,
        table: str,
        record_id: int,
        payload: LifecycleStatusUpdate,
        current_user: dict,
    ) -> dict[str, Any]:
        enterprise_id, existing = get_scoped(table, record_id, current_user)
        try:
            _assert_lifecycle_transition(kind, str(existing.get("status") or ""), payload.status)
        except ValueError as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc
        values: dict[str, Any] = {"status": payload.status, "updated_at": _now_iso()}
        if kind == "quote":
            values["versions"] = _append_version(existing.get("versions"), payload.status, current_user.get("name"))
        if kind == "work_order":
            values["status_history"] = _append_version(
                existing.get("status_history"), payload.status, current_user.get("name")
            )
        rows = _execute(
            client.table(table).update(values)
            .eq("id", record_id).eq("enterprise_id", enterprise_id),
            f"更新 {table}",
        )
        return {"status": "success", "data": rows[0]}

    @router.post("/quotes/calculate")
    def calculate_quote(payload: QuoteCalculationRequest, _: dict = Depends(require_reibi_manager)):
        return {"status": "success", "data": calculate_quote_fees(payload)}

    @router.get("/quotes")
    def list_quotes(
        page: int = Query(1, ge=1), size: int = Query(50, ge=1, le=200),
        record_status: Optional[str] = Query(None, alias="status"), search: Optional[str] = None,
        current_user: dict = Depends(require_reibi_manager),
    ):
        return list_scoped("reibi_quotes", current_user, page, size, record_status, search)

    @router.get("/quotes/{record_id}")
    def get_quote(record_id: int, current_user: dict = Depends(require_reibi_manager)):
        _, row = get_scoped("reibi_quotes", record_id, current_user)
        return {"status": "success", "data": row}

    @router.post("/quotes", status_code=status.HTTP_201_CREATED)
    def create_quote(payload: QuoteWrite, current_user: dict = Depends(require_reibi_manager)):
        enterprise_id = _current_enterprise_id(client, current_user)
        validate_quote_relations(payload, enterprise_id)
        values = _serialize_payload(payload)
        if payload.status not in QUOTE_STATUSES or payload.status in {"已轉合約", "作廢"}:
            raise HTTPException(status_code=422, detail="新報價只能建立為草稿、已發送或已確認")
        values["doc_no"] = payload.doc_no or _next_document_no(client, "quote", payload.doc_type)
        values["versions"] = _append_version([], payload.status, current_user.get("name"), snapshot=values.copy())
        values.update({"enterprise_id": enterprise_id, "created_by": current_user.get("name"), "source_payload": {}})
        rows = _execute(client.table("reibi_quotes").insert(values), "建立報價")
        return {"status": "success", "data": rows[0]}

    @router.put("/quotes/{record_id}")
    def update_quote(record_id: int, payload: QuoteWrite, current_user: dict = Depends(require_reibi_manager)):
        enterprise_id, existing = get_scoped("reibi_quotes", record_id, current_user)
        if existing.get("status") not in {"草稿", "已發送"}:
            raise HTTPException(status_code=409, detail="只有草稿或已發送報價可以編輯")
        validate_quote_relations(payload, enterprise_id)
        values = _serialize_payload(payload)
        values.pop("doc_no", None)
        values.pop("status", None)
        values["versions"] = _append_version(
            existing.get("versions"), str(existing.get("status")), current_user.get("name"), snapshot=values.copy()
        )
        values["updated_at"] = _now_iso()
        rows = _execute(client.table("reibi_quotes").update(values).eq("id", record_id).eq("enterprise_id", enterprise_id), "更新報價")
        return {"status": "success", "data": rows[0]}

    @router.patch("/quotes/{record_id}/status")
    def update_quote_status(record_id: int, payload: LifecycleStatusUpdate, current_user: dict = Depends(require_reibi_manager)):
        return update_scoped_status("quote", "reibi_quotes", record_id, payload, current_user)

    @router.post("/quotes/{record_id}/convert", status_code=status.HTTP_201_CREATED)
    def convert_quote(record_id: int, payload: QuoteConvertRequest, current_user: dict = Depends(require_reibi_manager)):
        enterprise_id, _ = get_scoped("reibi_quotes", record_id, current_user)
        rows = _execute(client.rpc("reibi_convert_quote_to_contract", {
            "p_enterprise_id": enterprise_id,
            "p_quote_id": record_id,
            "p_contract_type": payload.contract_type,
            "p_created_by": current_user.get("name"),
            "p_terms": payload.terms,
        }), "報價轉合約")
        return {"status": "success", "data": rows[0]}

    @router.get("/contracts")
    def list_contracts(
        page: int = Query(1, ge=1), size: int = Query(50, ge=1, le=200),
        record_status: Optional[str] = Query(None, alias="status"), search: Optional[str] = None,
        current_user: dict = Depends(require_reibi_manager),
    ):
        return list_scoped("reibi_contracts", current_user, page, size, record_status, search)

    @router.get("/contracts/{record_id}")
    def get_contract(record_id: int, current_user: dict = Depends(require_reibi_manager)):
        _, row = get_scoped("reibi_contracts", record_id, current_user)
        return {"status": "success", "data": row}

    @router.post("/contracts", status_code=status.HTTP_201_CREATED)
    def create_contract(payload: ContractWrite, current_user: dict = Depends(require_reibi_manager)):
        enterprise_id = _current_enterprise_id(client, current_user)
        values = _serialize_payload(payload)
        if payload.quote_id:
            raise HTTPException(status_code=422, detail="報價轉合約請使用原子轉換端點，避免重複合約")
        if payload.status not in CONTRACT_STATUSES:
            raise HTTPException(status_code=422, detail="不支援的合約狀態")
        values["doc_no"] = payload.doc_no or _next_document_no(client, "contract", payload.contract_type)
        values["terms"] = {**payload.terms, "snapshots": [{"savedAt": _now_iso(), "by": current_user.get("name"), "data": values.copy()}]}
        values.update({"enterprise_id": enterprise_id, "created_by": current_user.get("name"), "source_payload": {}})
        rows = _execute(client.table("reibi_contracts").insert(values), "建立合約")
        return {"status": "success", "data": rows[0]}

    @router.patch("/contracts/{record_id}/status")
    def update_contract_status(record_id: int, payload: LifecycleStatusUpdate, current_user: dict = Depends(require_reibi_manager)):
        return update_scoped_status("contract", "reibi_contracts", record_id, payload, current_user)

    @router.patch("/contracts/{record_id}/execution")
    def update_contract_execution(record_id: int, payload: ContractExecutionUpdate, current_user: dict = Depends(require_reibi_manager)):
        enterprise_id, existing = get_scoped("reibi_contracts", record_id, current_user)
        if existing.get("status") == "存檔":
            raise HTTPException(status_code=409, detail="已存檔合約不可再修改簽署與用印資料")
        terms = dict(existing.get("terms")) if isinstance(existing.get("terms"), dict) else {}
        execution = _serialize_update(payload)
        terms["execution"] = execution
        snapshots = list(terms.get("snapshots")) if isinstance(terms.get("snapshots"), list) else []
        snapshots.append({"savedAt": _now_iso(), "by": current_user.get("name"), "execution": execution})
        terms["snapshots"] = snapshots
        rows = _execute(
            client.table("reibi_contracts").update({"terms": terms, "updated_at": _now_iso()})
            .eq("id", record_id).eq("enterprise_id", enterprise_id),
            "更新合約簽署與用印",
        )
        return {"status": "success", "data": rows[0]}

    @router.post("/contracts/{record_id}/adjustment-quote", status_code=status.HTTP_201_CREATED)
    def create_adjustment_quote(record_id: int, payload: ContractAdjustmentRequest, current_user: dict = Depends(require_reibi_manager)):
        enterprise_id, contract = get_scoped("reibi_contracts", record_id, current_user)
        terms = contract.get("terms") if isinstance(contract.get("terms"), dict) else {}
        snapshot = terms.get("quote_snapshot") if isinstance(terms.get("quote_snapshot"), dict) else {}
        doc_type = "升級報價" if payload.adjustment_type == "upgrade" else "續約報價"
        allowed = {
            "client_alias", "contact_name", "phone", "email", "address", "industry", "member_count",
            "pay_mode", "contract_years", "contract_start", "contract_end", "a_layer_fee", "b_layer_fee",
            "c_layer_fee", "d_layer_fee_min", "d_layer_fee_max", "e_layer_fee", "total_year_fee",
            "total_contract_fee", "config", "distributor_id", "partner_id", "staff_id",
        }
        values = {key: value for key, value in snapshot.items() if key in allowed}
        values.update({
            "doc_no": _next_document_no(client, "quote", doc_type), "doc_type": doc_type, "status": "草稿",
            "enterprise_id": enterprise_id, "client_name": contract["client_name"],
            "original_contract_no": contract["doc_no"], "created_by": current_user.get("name"),
            "source_payload": {}, "versions": [],
        })
        values["versions"] = _append_version([], "草稿", current_user.get("name"), snapshot=values.copy())
        rows = _execute(client.table("reibi_quotes").insert(values), "建立升級或續約報價")
        return {"status": "success", "data": rows[0]}

    @router.get("/work-orders")
    def list_work_orders(
        page: int = Query(1, ge=1), size: int = Query(50, ge=1, le=200),
        record_status: Optional[str] = Query(None, alias="status"), search: Optional[str] = None,
        current_user: dict = Depends(require_reibi_manager),
    ):
        return list_scoped("reibi_work_orders", current_user, page, size, record_status, search)

    @router.get("/work-orders/{record_id}")
    def get_work_order(record_id: int, current_user: dict = Depends(require_reibi_manager)):
        _, row = get_scoped("reibi_work_orders", record_id, current_user)
        return {"status": "success", "data": row}

    @router.post("/work-orders", status_code=status.HTTP_201_CREATED)
    def create_work_order(payload: WorkOrderWrite, current_user: dict = Depends(require_reibi_manager)):
        enterprise_id = _current_enterprise_id(client, current_user)
        values = _serialize_payload(payload)
        if payload.status not in WORK_ORDER_STATUSES:
            raise HTTPException(status_code=422, detail="不支援的工單狀態")
        if payload.contract_id:
            contract = _execute(client.table("reibi_contracts").select("id").eq("id", payload.contract_id).eq("enterprise_id", enterprise_id).limit(1), "驗證合約")
            if not contract:
                raise HTTPException(status_code=400, detail="contract_id 不屬於目前企業")
        values["work_order_no"] = payload.work_order_no or _next_document_no(client, "work_order")
        values["status_history"] = _append_version([], payload.status, current_user.get("name"))
        values.update({"enterprise_id": enterprise_id, "created_by": current_user.get("name"), "source_payload": {}})
        rows = _execute(client.table("reibi_work_orders").insert(values), "建立工單")
        return {"status": "success", "data": rows[0]}

    @router.put("/work-orders/{record_id}")
    def update_work_order(record_id: int, payload: WorkOrderWrite, current_user: dict = Depends(require_reibi_manager)):
        enterprise_id, existing = get_scoped("reibi_work_orders", record_id, current_user)
        if existing.get("status") in {"驗收完成", "已存檔"}:
            raise HTTPException(status_code=409, detail="已完成或已存檔工單不可再編輯")
        values = _serialize_payload(payload)
        values.pop("work_order_no", None)
        values.pop("status", None)
        values["updated_at"] = _now_iso()
        rows = _execute(client.table("reibi_work_orders").update(values).eq("id", record_id).eq("enterprise_id", enterprise_id), "更新工單")
        return {"status": "success", "data": rows[0]}

    @router.patch("/work-orders/{record_id}/status")
    def update_work_order_status(record_id: int, payload: LifecycleStatusUpdate, current_user: dict = Depends(require_reibi_manager)):
        return update_scoped_status("work_order", "reibi_work_orders", record_id, payload, current_user)

    @router.post("/contracts/{record_id}/work-order", status_code=status.HTTP_201_CREATED)
    def create_work_order_from_contract(record_id: int, payload: WorkOrderFromContractRequest, current_user: dict = Depends(require_reibi_manager)):
        enterprise_id, contract = get_scoped("reibi_contracts", record_id, current_user)
        terms = contract.get("terms") if isinstance(contract.get("terms"), dict) else {}
        quote_snapshot = terms.get("quote_snapshot") if isinstance(terms.get("quote_snapshot"), dict) else {}
        carried_items = {
            "dItems": quote_snapshot.get("config", {}).get("dItems", {}) if isinstance(quote_snapshot.get("config"), dict) else {},
            "dSites": quote_snapshot.get("config", {}).get("dSites", []) if isinstance(quote_snapshot.get("config"), dict) else [],
            **payload.items,
        }
        values = _serialize_payload(payload)
        values.update({
            "work_order_no": _next_document_no(client, "work_order"), "contract_id": record_id,
            "contract_no": contract["doc_no"], "enterprise_id": enterprise_id,
            "client_name": contract["client_name"], "status": "草稿", "items": carried_items,
            "status_history": _append_version([], "草稿", current_user.get("name")),
            "created_by": current_user.get("name"), "source_payload": {},
        })
        rows = _execute(client.table("reibi_work_orders").insert(values), "由合約建立工單")
        return {"status": "success", "data": rows[0]}

    @router.post("/work-orders/{record_id}/acceptance")
    def accept_work_order(record_id: int, payload: WorkOrderAcceptance, current_user: dict = Depends(require_reibi_manager)):
        enterprise_id, existing = get_scoped("reibi_work_orders", record_id, current_user)
        if existing.get("status") != "驗收中":
            raise HTTPException(status_code=409, detail="只有驗收中的工單可以登錄驗收結果")
        values = _serialize_payload(payload)
        values.update({
            "status": payload.acceptance_result,
            "status_history": _append_version(existing.get("status_history"), payload.acceptance_result, current_user.get("name")),
            "updated_at": _now_iso(),
        })
        rows = _execute(client.table("reibi_work_orders").update(values).eq("id", record_id).eq("enterprise_id", enterprise_id), "登錄工單驗收")
        return {"status": "success", "data": rows[0]}

    @router.post("/artifacts/validate")
    def validate_artifact(export: ArtifactExport, _: dict = Depends(require_reibi_manager)):
        try:
            plan = plan_artifact_import(export)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        public_plan = {key: value for key, value in plan.items() if key != "records"}
        return {"status": "success", "data": public_plan}

    @router.post("/artifacts/import")
    def import_artifact(export: ArtifactExport, current_user: dict = Depends(require_reibi_super)):
        try:
            plan = plan_artifact_import(export)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc

        duplicate = _execute(
            client.table("reibi_artifact_import_batches").select("id,status,completed_at")
            .eq("source_artifact", export.source_artifact).eq("export_sha256", plan["sha256"])
            .eq("status", "completed").limit(1),
            "檢查重複匯入",
        )
        if duplicate:
            return {"status": "success", "data": {"duplicate": True, "batch": duplicate[0], "summary": {key: value for key, value in plan.items() if key != "records"}}}

        batches = _execute(client.table("reibi_artifact_import_batches").insert({
            "source_artifact": export.source_artifact,
            "source_version": export.source_version,
            "export_sha256": plan["sha256"],
            "status": "importing",
            "record_count": plan["record_count"],
            "created_by": current_user.get("uid"),
        }), "建立匯入批次")
        batch_id = batches[0]["id"]
        imported = 0
        rejected = 0
        errors: list[dict[str, str]] = []

        priority = {"l5_staff": 1, "l5_partners": 2, "l5_enterprises": 3, "l5_distributors": 4, "rq_quotes": 5, "rq_contracts": 6, "rq_workorders": 7}
        records = sorted(plan["records"], key=lambda item: priority.get(item["storage_key"], 99))
        for item in records:
            target_id: Optional[str] = None
            record_status = "skipped"
            error_detail: Optional[str] = None
            try:
                transformer_info = TRANSFORMERS.get(item["storage_key"])
                resolved: Optional[tuple[str, dict[str, Any], Optional[str]]] = None
                if transformer_info and isinstance(item["decoded_record"], dict):
                    table, transformer, conflict = transformer_info
                    resolved = (table, transformer(item["decoded_record"]), conflict)
                elif isinstance(item["decoded_record"], dict):
                    resolved = _dynamic_import_values(item["storage_key"], item["decoded_record"])

                if resolved:
                    table, values, conflict = resolved
                    required = {
                        "reibi_enterprises": ("org_code", "org_name"),
                        "reibi_staff": ("name",),
                        "reibi_partners": ("name",),
                        "reibi_distributors": ("org_code", "name"),
                        "reibi_quotes": ("doc_no", "client_name"),
                        "reibi_contracts": ("doc_no", "client_name"),
                        "reibi_work_orders": ("work_order_no", "client_name"),
                        "reibi_invoices": ("invoice_no", "invoice_date"),
                        "reibi_subscriptions": ("member_code", "plan_code", "status", "requested_at"),
                        "reibi_service_tickets": ("ticket_type", "priority", "status"),
                        "reibi_message_logs": ("target_type", "message", "status"),
                        "reibi_remittances": ("artifact_id", "org_code"),
                        "reibi_health_assessments": ("artifact_id", "artifact_user_key", "assessment_type", "assessed_at"),
                        "reibi_health_diary_entries": ("artifact_user_key", "diary_type", "entry_date"),
                        "reibi_ohs_records": ("artifact_id", "org_code", "record_type"),
                        "reibi_org_aggregates": ("org_code", "aggregate_type", "sample_size"),
                    }.get(table, ())
                    _ensure_required(values, required)
                    if table == "reibi_org_aggregates" and values.get("sample_size", 0) < 5:
                        raise ValueError("組織彙整樣本數小於 k=5，不得匯入")
                    source_record = item["decoded_record"]
                    if table in {"reibi_quotes", "reibi_contracts", "reibi_work_orders", "reibi_invoices", "reibi_remittances", "reibi_service_tickets", "reibi_ohs_records"}:
                        org_code = _clean_optional(values.get("org_code") or source_record.get("orgCode") or source_record.get("entCode"))
                        client_name = _clean_optional(source_record.get("clientName") or source_record.get("orgName") or source_record.get("entName"))
                        enterprise_query = client.table("reibi_enterprises").select("id")
                        if org_code:
                            enterprise_query = enterprise_query.eq("org_code", org_code.upper())
                        elif client_name:
                            enterprise_query = enterprise_query.eq("org_name", client_name)
                        else:
                            enterprise_query = None
                        if enterprise_query is not None:
                            enterprise_rows = _execute(enterprise_query.limit(2), "比對企業")
                            if len(enterprise_rows) == 1:
                                values["enterprise_id"] = enterprise_rows[0]["id"]
                    if table == "reibi_contracts" and values.get("from_quote_no"):
                        quote_rows = _execute(
                            client.table("reibi_quotes").select("id").eq("doc_no", values["from_quote_no"]).limit(1),
                            "比對來源報價",
                        )
                        if quote_rows:
                            values["quote_id"] = quote_rows[0]["id"]
                    if table == "reibi_work_orders" and values.get("contract_no"):
                        contract_rows = _execute(
                            client.table("reibi_contracts").select("id").eq("doc_no", values["contract_no"]).limit(1),
                            "比對來源合約",
                        )
                        if contract_rows:
                            values["contract_id"] = contract_rows[0]["id"]
                    if table == "reibi_distributors":
                        staff_artifact_id = _clean_optional(source_record.get("staffId"))
                        parent_artifact_id = _clean_optional(source_record.get("parentId"))
                        if staff_artifact_id:
                            staff_rows = _execute(client.table("reibi_staff").select("id").eq("artifact_id", staff_artifact_id).limit(1), "比對服務人員")
                            if staff_rows:
                                values["staff_id"] = staff_rows[0]["id"]
                        if parent_artifact_id:
                            parent_rows = _execute(client.table("reibi_distributors").select("id").eq("artifact_id", parent_artifact_id).limit(1), "比對上級經銷商")
                            if parent_rows:
                                values["parent_id"] = parent_rows[0]["id"]
                    write_query = client.table(table).upsert(values, on_conflict=conflict) if conflict else client.table(table).insert(values)
                    normalized = _execute(write_query, f"匯入 {table}")
                    if normalized:
                        target_id = str(normalized[0].get("id") or "")
                    if table == "reibi_enterprises" and normalized and isinstance(source_record.get("dSites"), list):
                        enterprise_id = normalized[0]["id"]
                        for site_index, site in enumerate(source_record["dSites"]):
                            if not isinstance(site, dict):
                                continue
                            site_artifact_id = _clean_optional(site.get("id")) or str(site_index)
                            site_payload = {
                                "enterprise_id": enterprise_id,
                                "artifact_id": site_artifact_id,
                                "label": _clean_optional(site.get("label")) or f"場域 {site_index + 1}",
                                "address": _clean_optional(site.get("address")),
                                "note": _clean_optional(site.get("note")),
                                "sort_order": site_index,
                                "source_payload": _redact_secrets(site),
                                "updated_at": _now_iso(),
                            }
                            _execute(
                                client.table("reibi_enterprise_sites").upsert(site_payload, on_conflict="enterprise_id,artifact_id"),
                                "匯入企業場域",
                            )
                    record_status = "imported"
                    imported += 1
                else:
                    record_status = "skipped"
            except Exception as exc:
                rejected += 1
                record_status = "rejected"
                error_detail = str(exc.detail if isinstance(exc, HTTPException) else exc)[:500]
                errors.append({"storage_key": item["storage_key"], "source_record_id": item["source_record_id"], "error": error_detail})

            _execute(client.table("reibi_artifact_import_records").insert({
                "batch_id": batch_id,
                "storage_key": item["storage_key"],
                "source_record_id": item["source_record_id"],
                "target_table": item["target_table"],
                "target_id": target_id,
                "status": record_status,
                "error_detail": error_detail,
                "raw_payload": item["raw_payload"],
            }), "記錄匯入結果")

        final_status = "completed" if rejected == 0 else "failed"
        updated = _execute(client.table("reibi_artifact_import_batches").update({
            "status": final_status,
            "imported_count": imported,
            "rejected_count": rejected,
            "error_summary": errors[:100],
            "completed_at": _now_iso(),
        }).eq("id", batch_id), "完成匯入批次")
        return {"status": "success", "data": {"duplicate": False, "batch": updated[0], "summary": {key: value for key, value in plan.items() if key != "records"}}}

    return router
