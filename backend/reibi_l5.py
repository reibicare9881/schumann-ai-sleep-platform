"""Role-scoped L5 overview, todo, and live notification aggregation.

The legacy L5 Artifact calculated these cards from browser storage.  This
module keeps the same operational meaning while deriving the values from the
existing Supabase business tables.  Notifications are live conditions, not a
persistent inbox, so no additional table or browser-side database access is
required.
"""

from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal, InvalidOperation
from typing import Any, Iterable

from fastapi import APIRouter, Depends, HTTPException

from auth import get_current_user
from roles import PARTNER_ROLES, REIBI_INTERNAL_ROLES, ROLE_DEFINITIONS


L5_ROLES = REIBI_INTERNAL_ROLES | PARTNER_ROLES
MAX_DASHBOARD_ROWS = 5_000


def _rows(query: Any, action: str) -> list[dict[str, Any]]:
    try:
        response = query.execute()
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"{action}失敗") from exc
    return list(getattr(response, "data", None) or [])


def _limited(query: Any) -> Any:
    return query.limit(MAX_DASHBOARD_ROWS)


def _money(value: Any) -> Decimal:
    try:
        return Decimal(str(value or 0))
    except (InvalidOperation, ValueError):
        return Decimal("0")


def _as_date(value: Any) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(str(value)[:10])
    except ValueError:
        return None


def _as_datetime(value: Any) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def _count(rows: Iterable[dict[str, Any]], statuses: set[str]) -> int:
    return sum(1 for row in rows if str(row.get("status") or "") in statuses)


def _item(
    key: str,
    label: str,
    value: int | float,
    *,
    format: str = "number",
    detail: str = "",
    href: str = "/reibi/l5",
) -> dict[str, Any]:
    return {
        "key": key,
        "label": label,
        "value": value,
        "format": format,
        "detail": detail,
        "href": href,
    }


def _todo(
    key: str,
    category: str,
    title: str,
    count: int,
    priority: str,
    href: str,
    detail: str = "",
) -> dict[str, Any]:
    return {
        "key": key,
        "category": category,
        "title": title,
        "detail": detail,
        "count": count,
        "priority": priority,
        "href": href,
    }


def _notification(
    key: str,
    level: str,
    title: str,
    count: int,
    href: str,
    detail: str = "",
) -> dict[str, Any]:
    return {
        "key": key,
        "level": level,
        "title": title,
        "detail": detail,
        "count": count,
        "href": href,
    }


def _month_keys(now: datetime) -> list[str]:
    year, month = now.year, now.month
    keys: list[str] = []
    for offset in range(11, -1, -1):
        raw = year * 12 + month - 1 - offset
        keys.append(f"{raw // 12:04d}-{raw % 12 + 1:02d}")
    return keys


def build_l5_dashboard(
    current_user: dict[str, Any],
    datasets: dict[str, list[dict[str, Any]]],
    *,
    partner_codes: list[str] | None = None,
    now: datetime | None = None,
) -> dict[str, Any]:
    """Build a response that excludes sections the role may not see."""
    role = str(current_user.get("role") or "")
    if role not in L5_ROLES:
        raise HTTPException(status_code=403, detail="此帳號沒有 L5 總覽權限")

    now = now or datetime.now(timezone.utc)
    today = now.date()
    enterprises = datasets.get("enterprises", [])
    quotes = datasets.get("quotes", [])
    contracts = datasets.get("contracts", [])
    work_orders = datasets.get("work_orders", [])
    tickets = datasets.get("tickets", [])
    payments = datasets.get("payments", [])
    remittances = datasets.get("remittances", [])
    subscriptions = datasets.get("subscriptions", [])
    access_requests = datasets.get("access_requests", [])

    internal = role in REIBI_INTERNAL_ROLES
    finance = role in {"reibi_super", "reibi_finance"}
    service = role in {"reibi_super", "reibi_cs"}
    data = role in {"reibi_super", "reibi_data"}
    partner = role in PARTNER_ROLES

    active = _count(enterprises, {"active", "啟用", "執行中"})
    trial = _count(enterprises, {"trial", "試用"})
    members = sum(int(row.get("used_count") or 0) for row in enterprises)
    contract_fee = sum(
        (_money(row.get("a_layer_fee")) + _money(row.get("b_layer_fee")) +
         _money(row.get("c_layer_fee")) + _money(row.get("d_layer_fee")))
        for row in enterprises
    )
    approved_subscription_revenue = sum(
        _money(row.get("amount")) for row in subscriptions
        if str(row.get("status") or "") in {"已核准", "approved", "active"}
    )

    usage_alerts = [
        row for row in enterprises
        if int(row.get("member_limit") or 0) > 0
        and int(row.get("used_count") or 0) / int(row.get("member_limit") or 1) >= 0.9
    ]
    expiring_30 = [
        row for row in enterprises
        if (end := _as_date(row.get("contract_end"))) is not None
        and 0 <= (end - today).days <= 30
    ]
    expiring_90_contracts = [
        row for row in contracts
        if (end := _as_date(row.get("contract_end"))) is not None
        and 0 <= (end - today).days <= 90
    ]
    overdue_payments = [
        row for row in payments
        if str(row.get("status") or "") not in {"已付款", "paid", "cancelled"}
        and (due := _as_date(row.get("due_date"))) is not None
        and due < today
    ]

    quote_pending = _count(quotes, {"已發送", "待確認"})
    quote_confirmed = _count(quotes, {"已確認"})
    contract_pending = _count(contracts, {"待用印"})
    contract_active = _count(contracts, {"用印完成", "執行中"})
    work_pending = _count(work_orders, {"待驗收", "驗收中"})
    work_anomaly = _count(work_orders, {"驗收異常"})
    ticket_pending = _count(tickets, {"待處理", "pending"})
    payment_open = sum(
        1 for row in payments
        if str(row.get("status") or "") not in {"已付款", "paid", "cancelled"}
    )
    remittance_pending = _count(remittances, {"pending", "待審核"})
    subscription_pending = _count(subscriptions, {"待審核", "pending"})
    access_pending = _count(access_requests, {"pending"})

    kpis = [
        _item("enterprise_total", "企業總數", len(enterprises), detail=f"啟用 {active}・試用 {trial}"),
        _item("member_total", "服務人數", members, detail="依企業目前使用數加總"),
    ]
    if finance:
        kpis.extend([
            _item("contract_fee", "合約層級費用", float(contract_fee), format="currency", href="/reibi/operations"),
            _item("subscription_revenue", "個人訂閱已核准金額", float(approved_subscription_revenue), format="currency", href="/reibi/operations"),
            _item("distributor_total", "經銷商數", len(datasets.get("distributors", [])), href="/reibi/operations"),
        ])
    elif service:
        kpis.extend([
            _item("pending_ticket_total", "待處理服務案件", ticket_pending, href="/reibi/service"),
            _item("work_order_anomaly_total", "驗收異常工單", work_anomaly, href="/reibi/workflow"),
        ])
    elif data:
        kpis.append(_item("contract_expiring_total", "30 天內到期企業", len(expiring_30), href="/reibi/analytics"))
    elif partner:
        kpis.extend([
            _item("active_contract_total", "執行中合約", contract_active, href="/reibi/workflow"),
            _item("open_payment_total", "未結清應收", payment_open, href="/reibi/operations"),
        ])

    todos: list[dict[str, Any]] = []
    if finance or partner:
        todos.extend([
            _todo("quote_followup", "報價", "待客戶確認報價", quote_pending, "medium", "/reibi/workflow"),
            _todo("quote_convert", "報價", "已確認待轉合約", quote_confirmed, "high", "/reibi/workflow"),
            _todo("contract_sign", "合約", "待用印合約", contract_pending, "high", "/reibi/workflow"),
            _todo("payment_open", "財務", "未結清應收", payment_open, "medium", "/reibi/operations"),
        ])
    if finance:
        todos.extend([
            _todo("remittance_review", "財務", "待審核匯款", remittance_pending, "high", "/reibi/operations"),
            _todo("subscription_review", "訂閱", "待審核個人訂閱", subscription_pending, "medium", "/reibi/operations"),
        ])
    if service or role == "reibi_super":
        todos.extend([
            _todo("service_ticket", "服務", "待處理服務案件", ticket_pending, "high", "/reibi/service"),
            _todo("work_acceptance", "工單", "待驗收工單", work_pending, "medium", "/reibi/workflow"),
            _todo("access_request", "權限", "待驗證權限申請", access_pending, "high", "/reibi/service"),
        ])
    if data and role != "reibi_super":
        todos.append(_todo("data_contract_review", "資料", "30 天內到期企業資料", len(expiring_30), "medium", "/reibi/analytics"))

    notifications = [
        _notification("usage_near_limit", "warning", "授權用量已達 90%", len(usage_alerts), "/reibi", "請確認是否擴充授權"),
        _notification("contract_expiring", "warning", "企業合約將於 30 天內到期", len(expiring_30), "/reibi/workflow"),
    ]
    if finance or partner:
        notifications.append(_notification("payment_overdue", "critical", "應收款已逾期", len(overdue_payments), "/reibi/operations"))
    if service or role == "reibi_super":
        notifications.extend([
            _notification("ticket_pending", "info", "服務案件等待處理", ticket_pending, "/reibi/service"),
            _notification("work_anomaly", "critical", "工單驗收異常", work_anomaly, "/reibi/workflow"),
        ])
    notifications = [item for item in notifications if item["count"] > 0]
    todos = [item for item in todos if item["count"] > 0]

    months = _month_keys(now)
    trend_counts = {month: 0 for month in months}
    for enterprise in enterprises:
        created = _as_datetime(enterprise.get("created_at"))
        if created and (key := created.strftime("%Y-%m")) in trend_counts:
            trend_counts[key] += 1

    workflow: dict[str, Any] = {}
    if finance or partner:
        workflow.update({
            "quotes": {"pending": quote_pending, "confirmed": quote_confirmed, "total": len(quotes)},
            "contracts": {"pending_sign": contract_pending, "active": contract_active, "expiring_90": len(expiring_90_contracts), "total": len(contracts)},
        })
    if service or partner or role == "reibi_super":
        workflow["work_orders"] = {"pending_acceptance": work_pending, "anomaly": work_anomaly, "total": len(work_orders)}

    definition = ROLE_DEFINITIONS[role]
    return {
        "role": {"key": role, "label": definition.label, "realm": definition.realm},
        "scope": {
            "kind": "partner" if partner else "global",
            "partner_codes": partner_codes or [],
            "enterprise_count": len(enterprises),
        },
        "kpis": kpis,
        "workflow": workflow,
        "todos": todos,
        "notifications": notifications,
        "trend": [{"month": month, "count": trend_counts[month]} for month in months],
        "generated_at": now.isoformat(),
        "notification_mode": "live",
        "truncated": any(len(rows) >= MAX_DASHBOARD_ROWS for rows in datasets.values()),
    }


def _partner_scope(client: Any, current_user: dict[str, Any]) -> list[str]:
    code = str(current_user.get("partner_org_code") or current_user.get("org_code") or "").strip()
    if not code:
        raise HTTPException(status_code=403, detail="經銷商帳號缺少 partner_org_code")
    own = _rows(
        client.table("reibi_distributors").select("id,org_code").eq("org_code", code).limit(1),
        "查詢經銷商範圍",
    )
    codes = [code]
    if current_user.get("role") == "partner_primary" and own:
        children = _rows(
            _limited(client.table("reibi_distributors").select("org_code").eq("parent_id", own[0]["id"])),
            "查詢下層經銷商範圍",
        )
        codes.extend(str(row["org_code"]) for row in children if row.get("org_code"))
    return list(dict.fromkeys(codes))


def _table_rows(client: Any, table: str, columns: str, enterprise_ids: list[int] | None) -> list[dict[str, Any]]:
    if enterprise_ids == []:
        return []
    query = client.table(table).select(columns)
    if enterprise_ids is not None:
        query = query.in_("enterprise_id", enterprise_ids)
    return _rows(_limited(query), f"讀取 {table}")


def fetch_l5_datasets(client: Any, current_user: dict[str, Any]) -> tuple[dict[str, list[dict[str, Any]]], list[str]]:
    role = str(current_user.get("role") or "")
    if role not in L5_ROLES:
        raise HTTPException(status_code=403, detail="此帳號沒有 L5 總覽權限")

    partner_codes: list[str] = []
    enterprise_query = client.table("reibi_enterprises").select(
        "id,org_code,org_name,status,member_limit,used_count,contract_end,partner_code,"
        "a_layer_fee,b_layer_fee,c_layer_fee,d_layer_fee,created_at"
    )
    if role in PARTNER_ROLES:
        partner_codes = _partner_scope(client, current_user)
        enterprise_query = enterprise_query.in_("partner_code", partner_codes)
    enterprises = _rows(_limited(enterprise_query), "讀取 L5 企業總覽")
    enterprise_ids = [int(row["id"]) for row in enterprises if row.get("id") is not None]
    scoped_ids: list[int] | None = enterprise_ids if role in PARTNER_ROLES else None

    datasets: dict[str, list[dict[str, Any]]] = {"enterprises": enterprises}
    if role in {"reibi_super", "reibi_finance", "partner_primary", "partner_sub"}:
        datasets["quotes"] = _table_rows(client, "reibi_quotes", "id,status,enterprise_id,created_at", scoped_ids)
        datasets["contracts"] = _table_rows(client, "reibi_contracts", "id,status,enterprise_id,contract_end,created_at", scoped_ids)
        datasets["payments"] = _table_rows(client, "reibi_payment_schedules", "id,status,enterprise_id,due_date,amount,paid_amount", scoped_ids)
    if role in {"reibi_super", "reibi_cs", "partner_primary", "partner_sub"}:
        datasets["work_orders"] = _table_rows(client, "reibi_work_orders", "id,status,enterprise_id,created_at", scoped_ids)
    if role in {"reibi_super", "reibi_cs"}:
        datasets["tickets"] = _table_rows(client, "reibi_service_tickets", "id,status,enterprise_id,priority,created_at", None)
        datasets["access_requests"] = _rows(
            _limited(client.table("reibi_access_requests").select("id,status,created_at")),
            "讀取權限申請",
        )
    if role in {"reibi_super", "reibi_finance"}:
        datasets["remittances"] = _table_rows(client, "reibi_remittances", "id,status,enterprise_id,created_at", None)
        datasets["subscriptions"] = _rows(
            _limited(client.table("reibi_subscriptions").select("id,status,amount,requested_at")),
            "讀取個人訂閱",
        )
        datasets["distributors"] = _rows(
            _limited(client.table("reibi_distributors").select("id,status,distributor_type")),
            "讀取經銷商統計",
        )
    if role == "reibi_data":
        datasets["contracts"] = _table_rows(client, "reibi_contracts", "id,status,enterprise_id,contract_end,created_at", None)
    return datasets, partner_codes


def create_reibi_l5_router(client: Any) -> APIRouter:
    router = APIRouter(prefix="/api/reibi/l5", tags=["REIBI L5"])

    @router.get("/overview")
    def overview(current_user: dict = Depends(get_current_user)):
        datasets, partner_codes = fetch_l5_datasets(client, current_user)
        return {
            "status": "success",
            "data": build_l5_dashboard(current_user, datasets, partner_codes=partner_codes),
        }

    return router
