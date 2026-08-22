"""個人訂閱功能閘門（移植自 Artifact 主平台的 isPro／effectiveSubStatus）。

Artifact 的判斷只有一行：

    const isPro = sess && (sess.role !== "individual"
                  || (mySub && effectiveSubStatus(mySub) === "active"));

白話是「企業員工一律當訂閱版，個人用戶要有有效訂閱」。企業已經付了 A 層授權費，
員工不該再被收一次；只有自己註冊的個人用戶會遇到這道門。

到期採**延遲判定**：不背景改寫任何資料，每次讀取時比對 expires_at。這是 Artifact
`effectiveSubStatus` 的作法，也是「到期自動降級但完整保留歷史資料」這條規則的實作方式 ——
降級只是讀不到，資料一筆都沒動。

閘門本身只回答「是不是 pro」。實際要擋什麼由呼叫端決定，且一律在後端執行：
前端隱藏按鈕不算閘門。
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Optional

# 只有個人用戶會被閘門擋。其餘角色的存取權由所屬企業的合約決定。
GATED_ROLE = "individual"

# Artifact SubscribeScreen 的服務條款版本。申請時記錄使用者同意的是哪一版。
TERMS_VERSION = "v1-20260705"
TERMS_POINTS = (
    "訂閱申請採人工審核制：送出後請透過 LINE 或 Email 提供付款證明，麗媚將於 1-2 個工作日內確認並啟用。",
    "訂閱到期後將自動降級為免費版，所有歷史資料完整保留，不會刪除。",
    "個人會員碼為找回訂閱狀態的憑證之一，請自行妥善保存；遺失可於登入後查詢，或聯絡客服人工核對身分後協助處理。",
    "訂閱費用一經啟用後，若有退款需求請洽客服個案處理，不提供自動退款機制。",
    "本服務條款可能隨營運需要調整，調整後將於平台公告。",
)

# Artifact 的免費版／訂閱版功能對照，供訂閱頁渲染。
FREE_FEATURES = (
    "每週健康評估（ISI＋BPI＋WQ，共 19 題）",
    "四色燈號即時健康狀態",
    "個人歷史趨勢追蹤（最近 3 個月）",
    "個人完整 PDF 報告下載",
    "三高／BMI 數值管理與年度健檢提醒",
    "22 項行動打卡積分制度",
    "睡眠日記與疼痛日誌",
    "身心健康評估（PHQ-4 情緒＋PSS-4 壓力）",
    "過勞風險自我檢視（8 題）",
    "EAP 健康關懷資源參考（保密）",
)
PRO_FEATURES = (
    "AI 六面向個人化建議（睡眠／疼痛／飲食／運動／三高／REIBI 體驗）",
    "年度改善追蹤報告與長期趨勢分析",
    "無限次歷史趨勢追蹤，不受 3 個月限制",
    "身心健康深度分析（MHI 三子指標）",
    "過勞風險趨勢追蹤",
    "優先預約自主健管體驗排程",
    "積分兌換加值服務（生物資訊檢測、自律神經量測等）",
    "定期評估提醒",
)

# 免費個人用戶的歷史可見範圍。Artifact v10.3.24 訂為最近 3 個月。
FREE_HISTORY_MONTHS = 3
# 到期前幾天開始提醒。
EXPIRY_REMINDER_DAYS = 30

ACTIVE_STATUS = "已核准"

# 讀取閘門狀態時需要的欄位。刻意不含 activation_code_hash —— 那是憑證，
# 使用者端的任何回應都不該帶著它離開後端。
SUBSCRIPTION_SELECT = (
    "id,member_code,plan_code,plan_label,status,requested_at,approved_at,"
    "expires_at,activated_at,activation_code_last_four"
)

# 個人訂閱方案（Artifact 主平台 SUB_PLANS 與 L5 PERSONAL_SUB_PLANS 的同一份定義）。
#
# 這裡是唯一權威來源：使用者端顯示的到期日與財務端核發啟用碼時算出的到期日
# 必須來自同一組月數，Artifact 就因為兩邊各存一份而特別在註解裡警告過。
PLAN_MONTHS = {"monthly": 1, "quarterly": 3, "annual": 12}
PLAN_LABELS = {"monthly": "月繳體驗", "quarterly": "季繳方案", "annual": "年繳方案(最優惠)"}
PLAN_CODES = tuple(PLAN_MONTHS)


def _now(as_of: Optional[datetime] = None) -> datetime:
    return as_of or datetime.now(timezone.utc)


def _parse(value: Any) -> Optional[datetime]:
    """把 Supabase 回傳的時間字串轉成 aware datetime。無法解析一律當成沒有。"""
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if not isinstance(value, str) or not value.strip():
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def effective_status(subscription: Optional[dict[str, Any]], as_of: Optional[datetime] = None) -> Optional[str]:
    """Artifact effectiveSubStatus：已核准但已過到期日的，讀取時視為已到期。

    不寫回資料庫。到期只是讀不到 pro 功能，訂閱紀錄與健康資料都原封不動。
    """
    if not subscription:
        return None
    status = str(subscription.get("status") or "") or None
    if status != ACTIVE_STATUS:
        return status
    expires = _parse(subscription.get("expires_at"))
    if expires and expires < _now(as_of):
        return "已到期"
    return status


def pick_current(subscriptions: Any, as_of: Optional[datetime] = None) -> Optional[dict[str, Any]]:
    """從一組訂閱中挑出代表目前狀態的那一筆。

    優先取仍然有效的（到期日最晚的一筆）；都無效時取最近一次申請的，
    這樣畫面才能顯示「已到期」或「審核中」而不是一片空白。
    """
    rows = [row for row in subscriptions if isinstance(row, dict)] if isinstance(subscriptions, list) else []
    if not rows:
        return None
    active = [row for row in rows if effective_status(row, as_of) == ACTIVE_STATUS]
    if active:
        return max(active, key=lambda row: (_parse(row.get("expires_at")) or datetime.min.replace(tzinfo=timezone.utc)))
    return max(rows, key=lambda row: (_parse(row.get("requested_at")) or datetime.min.replace(tzinfo=timezone.utc)))


def resolve(role: Optional[str], subscriptions: Any, as_of: Optional[datetime] = None) -> dict[str, Any]:
    """回答「這個帳號現在是不是訂閱版」，以及畫面要顯示的到期資訊。

    `gated` 表示這個角色會受閘門管轄。企業員工 gated=False、is_pro=True，
    畫面就不必對他們顯示任何訂閱相關的提示。
    """
    gated = str(role or "") == GATED_ROLE
    current = pick_current(subscriptions, as_of)
    status = effective_status(current, as_of)

    if not gated:
        return {
            "gated": False, "is_pro": True, "status": None, "plan_code": None,
            "expires_at": None, "days_left": None, "expiring_soon": False,
            "reason": "企業合約已涵蓋，個人訂閱不適用",
        }

    is_pro = status == ACTIVE_STATUS
    expires = _parse(current.get("expires_at")) if current else None
    days_left = (expires - _now(as_of)).days if expires and is_pro else None
    return {
        "gated": True,
        "is_pro": is_pro,
        "status": status,
        "plan_code": (current or {}).get("plan_code"),
        "plan_label": (current or {}).get("plan_label"),
        "member_code": (current or {}).get("member_code"),
        "expires_at": (current or {}).get("expires_at"),
        "days_left": days_left,
        # Artifact 在到期前 30 天開始提醒。負數（已過期）不算 soon，那是另一種狀態。
        "expiring_soon": days_left is not None and 0 <= days_left <= EXPIRY_REMINDER_DAYS,
        "reason": None,
    }


def history_cutoff(access: dict[str, Any], as_of: Optional[datetime] = None) -> Optional[datetime]:
    """免費個人用戶的歷史起算時間。不受限時回傳 None。"""
    if not access.get("gated") or access.get("is_pro"):
        return None
    return _now(as_of) - timedelta(days=FREE_HISTORY_MONTHS * 30)


def limit_history(rows: Any, access: dict[str, Any], field: str = "created_at",
                  as_of: Optional[datetime] = None) -> dict[str, Any]:
    """套用 3 個月限制，並回報被隱藏的筆數。

    隱藏不是刪除。Artifact 明確告訴使用者「您還有 N 筆較早的評估記錄已保留」，
    所以 hidden_count 一定要回傳 —— 少了它，免費用戶會以為資料不見了。
    """
    items = [row for row in rows if isinstance(row, dict)] if isinstance(rows, list) else []
    cutoff = history_cutoff(access, as_of)
    if cutoff is None:
        return {"rows": items, "hidden_count": 0, "limited": False, "cutoff": None}

    visible = []
    for row in items:
        stamp = _parse(row.get(field))
        # 沒有時間戳記的資料一律保留：寧可多顯示，也不要讓使用者的紀錄無故消失。
        if stamp is None or stamp >= cutoff:
            visible.append(row)
    return {
        "rows": visible,
        "hidden_count": len(items) - len(visible),
        "limited": True,
        "cutoff": cutoff.isoformat(),
    }


def load_access(client: Any, user: Optional[dict[str, Any]], as_of: Optional[datetime] = None) -> dict[str, Any]:
    """查出登入帳號目前的訂閱狀態。main.py 與 Batch D 共用同一份判定。

    非個人用戶不必查資料庫 —— 企業合約已涵蓋，查了也不影響結果，省一次往返。

    查詢失敗時**不放行**：回傳未訂閱狀態。閘門在資料庫出問題時應該關著，
    否則一次連線異常就等於免費發送 AI 報告。
    """
    role = (user or {}).get("role")
    if str(role or "") != GATED_ROLE:
        return resolve(role, [], as_of)
    profile_id = (user or {}).get("uid")
    if not profile_id:
        return resolve(role, [], as_of)
    try:
        response = (
            client.table("reibi_subscriptions").select(SUBSCRIPTION_SELECT)
            .eq("profile_id", str(profile_id)).order("requested_at", desc=True).limit(20).execute()
        )
        rows = response.data or []
    except Exception:  # noqa: BLE001 — 查不到就當作沒有訂閱，理由見 docstring
        rows = []
    return resolve(role, rows, as_of)


def require_pro(access: dict[str, Any], feature: str) -> None:
    """閘門本體。擋下時回 402，讓前端知道這是付費牆而不是權限不足。

    403 會被前端當成「你不該來這裡」；402 才是「升級後就可以」。
    """
    if access.get("is_pro"):
        return
    from fastapi import HTTPException  # 延後匯入，讓這個模組的純邏輯不依賴 FastAPI

    raise HTTPException(
        status_code=402,
        detail=f"{feature}為訂閱版功能。免費版可查閱封面、評量來源、睡眠／疼痛／綜合報告。",
    )


def subscription_page_payload(access: dict[str, Any]) -> dict[str, Any]:
    """訂閱頁需要的全部靜態內容與目前狀態。"""
    return {
        "access": access,
        "terms_version": TERMS_VERSION,
        "terms": list(TERMS_POINTS),
        "free_features": list(FREE_FEATURES),
        "pro_features": list(PRO_FEATURES),
        "free_history_months": FREE_HISTORY_MONTHS,
        "expiry_reminder_days": EXPIRY_REMINDER_DAYS,
    }
