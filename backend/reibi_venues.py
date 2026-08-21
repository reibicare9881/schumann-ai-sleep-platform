"""REIBI 自有體驗場域與首次免費體驗（移植自 Artifact 主平台的 VenueScreen）。

Artifact 把兩個體驗中心寫死在畫面裡，並在預約入口標註「首次免費體驗（每人限一次）」。
那句話不是文案，是規則 —— 但 Artifact 從未真正檢查過額度。

這裡把兩件事分開：

* **場域資料**進資料庫（不是 `reibi_enterprise_sites`，那張表屬於客戶自己的廠區）。
* **免費額度**由 `reibi_venue_free_visits` 的主鍵保證，而不是靠查詢聚合 ——
  兩個並發請求可以同時通過「查一下有沒有用過」的檢查，主鍵不會。

尚未定稿的場域帶 `is_placeholder`，**不可被預約**：編造的地址若上線，會有人照著跑一趟。
"""

from __future__ import annotations

from typing import Any, Optional

VENUE_SELECT = (
    "id,slug,city,name,address,area,transport,opening_hours,services,note,"
    "first_visit_free,is_placeholder,is_active,sort_order"
)

# 「每人限一次，不分場域」—— 2026-08-20 經業務端確認，與 Artifact 字面規則一致。
# 這個常數只作說明用途；實際保證來自 reibi_venue_free_visits 的主鍵（僅 profile_id）。
FREE_VISIT_SCOPE = "per_person"
FREE_VISIT_NOTE = "首次免費體驗每人限一次，不分場域。"


def normalise_venue(row: dict[str, Any]) -> dict[str, Any]:
    """把資料庫列整理成前端可直接渲染的形狀。

    佔位場域一律回報 `bookable: False`，不論 `first_visit_free` 設成什麼 ——
    這個判斷放在單一位置，前端與預約 API 都讀它，不各自解讀。
    """
    placeholder = bool(row.get("is_placeholder"))
    return {
        "id": row.get("id"),
        "slug": row.get("slug"),
        "city": row.get("city"),
        "name": row.get("name"),
        "address": row.get("address"),
        "area": row.get("area"),
        "transport": row.get("transport") if isinstance(row.get("transport"), list) else [],
        "opening_hours": row.get("opening_hours"),
        "services": row.get("services") if isinstance(row.get("services"), list) else [],
        "note": row.get("note"),
        "first_visit_free": bool(row.get("first_visit_free")) and not placeholder,
        "is_placeholder": placeholder,
        # is_active 要保留：venue_rejection_reason 同時吃資料庫原始列與這裡的輸出，
        # 少了它，已正規化的場域會被誤判為「未開放」。
        "is_active": bool(row.get("is_active")),
        "bookable": bool(row.get("is_active")) and not placeholder,
    }


def build_venue_payload(rows: Any, free_visit_used: bool) -> dict[str, Any]:
    venues = [normalise_venue(row) for row in rows] if isinstance(rows, list) else []
    placeholders = [venue for venue in venues if venue["is_placeholder"]]
    return {
        "venues": venues,
        "free_visit": {
            "scope": FREE_VISIT_SCOPE,
            "note": FREE_VISIT_NOTE,
            "used": free_visit_used,
            # 有可預約且開放免費體驗的場域，額度才有意義。
            "available": (not free_visit_used) and any(v["first_visit_free"] and v["bookable"] for v in venues),
        },
        "placeholder_count": len(placeholders),
        "placeholder_notice": (
            "以下場域資料尚未由業務端提供，目前為佔位內容，因此不開放預約。"
            if placeholders else None
        ),
    }


def venue_rejection_reason(venue: Optional[dict[str, Any]]) -> Optional[str]:
    """回傳不可預約的原因；可預約時回 None。"""
    if not venue:
        return "找不到指定的體驗場域"
    if venue.get("is_placeholder"):
        return "此體驗場域的資料尚未確認，暫不開放預約"
    if not venue.get("is_active"):
        return "此體驗場域目前未開放"
    return None
