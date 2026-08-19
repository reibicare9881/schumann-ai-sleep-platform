"""L5 站內操作手冊（移植自 Artifact reibi-l5 的 ManualScreen）。

Artifact 的手冊是六個分頁的**手寫**內容。這裡刻意不照抄，原因有三個，
而且都是盤點時實際踩到的：

1. **手寫的內容已經錯了。** 手冊「分潤規則」分頁寫「年累積 A+C 層簽約額」，
   但同一分頁 C 層的註記寫「不計入年累積業績」，策略頁寫「僅計 A 層」，
   而它自己的程式碼只算 A 層。搬過來等於把錯誤一起搬。
2. **兩條 FAQ 描述的是 Artifact 的限制，在新系統已不成立** ——
   「LINE 推播目前為模擬記錄」「大數據為模擬示範數據」。照抄就是公布錯誤資訊。
3. **三條緊急操作在講共用 PIN 與備援碼**，那是已記錄的刻意不移植項
   （改用 Supabase Auth 邀請與 TOTP）。照抄等於教人去點不存在的功能。

因此：會變的東西（角色權限、分潤比例、升級門檻）一律**由程式產生**，
不會變的營運知識（月結時程、開通步驟）才寫成常數，且重寫成新系統的實況。
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from reibi_batch_c import (
    COMMISSION_LEVELS,
    COMMISSION_TIER_LABELS,
    COMMISSION_TIER_THRESHOLDS,
    STRATEGIC_REFERENCE_THRESHOLD,
)
from roles import documented_role_catalog

# 月結時程。這是 Artifact 手冊唯一在新系統完全沒有別處記載的營運知識，
# 也是保留這一頁的主要理由。
SETTLEMENT_TIMELINE: tuple[dict[str, str], ...] = (
    {"when": "每月 30 日", "title": "系統彙整",
     "detail": "自動計算當月分潤，財務管理員確認明細。"},
    {"when": "隔月 10 日", "title": "對帳確認",
     "detail": "財務管理員完成對帳並標記已對帳；如有疑義在此期間溝通。"},
    {"when": "隔月 15 日", "title": "匯款",
     "detail": "執行匯款並通知主經銷商與次級經銷商。次級與主經銷商的分潤由系統依等級差額自動計算，不需主經銷商自行分配。"},
)

# 新案開通步驟。Artifact 版本的最後一步是「自動生成 orgCode、initPin、backupCode、
# memberPin、deptPin、adminPin」——共用 PIN 制已不存在，改寫為邀請與 MFA 流程。
ONBOARDING_STEPS: tuple[dict[str, Any], ...] = (
    {"step": "Step 1", "title": "企業基本資料", "owner": "財務管理員或超管",
     "items": ("企業名稱、聯絡人、電話、Email、統編", "行業分類（10 大類 × 子類）",
               "方案等級與授權人數上限", "合約起迄日", "承接經銷商代碼（如有）", "REIBI 負責顧問")},
    {"step": "Step 2", "title": "A–E 層費用配置", "owner": "財務管理員或超管",
     "items": ("A 層依人數級距，可選人數級距建議配置一次帶入",
               "B 層雲朵床／樂活椅／LA200 數量", "C 層高管健促方案與高風險加購人數",
               "D 層環境佈置項目與施工場域（可用套組快選）",
               "E 層延保與加值服務（僅續約報價適用）")},
    {"step": "Step 3", "title": "付款方式確認", "owner": "財務管理員或超管",
     "items": ("年繳 −5%／半年繳／季繳 +3%", "各層費用與合約總額確認",
               "確認後付款時程自動展開為 A1–A3、B1–B3、C1–C3、D1–D2")},
    {"step": "Step 4", "title": "開通與帳號邀請", "owner": "僅超管可執行",
     "items": ("產生企業代碼與組織資料", "以 Email 邀請單位管理者，由本人設定密碼",
               "管理者角色首次登入需完成 TOTP 綁定",
               "共用 PIN 與備援碼已停用，不再核發任何共用密碼")},
)

FAQ: tuple[dict[str, str], ...] = (
    {"q": "帳號使用率達 90% 警示怎麼處理？",
     "a": "於企業管理調整方案等級或增加授權上限。90% 是警示、超過上限是另一種狀態，兩者分開顯示。"},
    {"q": "次級經銷商如何建立？",
     "a": "由超管在經銷商管理建立，並指定隸屬的主經銷商。次級經銷商全額拿自己等級的百分比，主經銷商拿等級差額，系統自動計算，不需人工分配。"},
    {"q": "D 層環境佈置費用如何確定？",
     "a": "報價階段顯示的是逐項估算區間。需現場勘查後才有正式金額，可從報價、合約或工單列印場勘需求單。"},
    {"q": "經銷商等級什麼時候會升？",
     "a": "以年簽約額（僅計 A 層授權費）判定：金牌 800 萬、白金 2,000 萬，戰略級另議。B、C 層計入佣金但不推進升級。達門檻後系統只顯示已達標，實際升等仍由超管調整，因為升等是永久的分潤成本變動。"},
    {"q": "合約到期沒有續約怎麼辦？",
     "a": "於企業管理將狀態改為暫停並通知企業管理者，同時追蹤續約進度。合約到期前 90 天商務文件頁會顯示提醒。"},
    {"q": "忘記密碼或遺失 MFA 裝置？",
     "a": "密碼由本人透過 Email 重設。MFA 裝置遺失需由超管撤銷既有綁定後重新邀請綁定；系統不保存任何可回復的密碼或種子。"},
)

EMERGENCY: tuple[dict[str, str], ...] = (
    {"title": "緊急暫停企業授權", "tone": "warning",
     "detail": "企業管理 → 選擇企業 → 狀態改為暫停 → 通知企業管理者。暫停不刪除任何資料。"},
    {"title": "帳號遭盜用或人員離職", "tone": "danger",
     "detail": "於帳號管理撤銷該帳號的可信工作階段，該人員手上的 token 立即失效；必要時一併停用帳號。"},
    {"title": "分潤金額有疑義", "tone": "warning",
     "detail": "在對帳期間（隔月 10 日前）與經銷商溝通。已標記匯款的分潤不可就地修改，需另開調整紀錄以保留軌跡。"},
    {"title": "緊急聯絡窗口", "tone": "info",
     "detail": "LINE：@reibicare（週一至週五 09:00-18:00）\nEmail：reibiservice@gmail.com"},
)

AUDIT_NOTE = "所有寫入操作均記錄稽核日誌。不可逆操作請先確認授權。"


def _commission_rules() -> dict[str, Any]:
    """分潤比例與升級門檻，全部由計價模組推導，不另存一份。"""
    layers = (
        ("a", "A 層 軟體授權", "計入年簽約額，是升級門檻的判定基礎"),
        ("b", "B 層 設備（含 LA200）", "計入佣金，但不推進升級"),
        ("c", "C 層 高管健促服務", "計入佣金，但不推進升級"),
    )
    order = ("silver", "gold", "platinum", "strategic")
    return {
        "layers": [
            {
                "key": key, "label": label, "note": note,
                "percentages": [
                    {"level": level, "label": COMMISSION_TIER_LABELS[level],
                     "percent": COMMISSION_LEVELS[level][key]}
                    for level in order
                ],
            }
            for key, label, note in layers
        ],
        "thresholds": [
            {"from_level": source, "from_label": COMMISSION_TIER_LABELS[source],
             "to_level": target, "to_label": COMMISSION_TIER_LABELS[target], "threshold": threshold}
            for source, target, threshold in COMMISSION_TIER_THRESHOLDS
        ],
        "strategic_reference": STRATEGIC_REFERENCE_THRESHOLD,
        "basis_note": (
            "年簽約額僅計 A 層授權費。B 層設備與 C 層服務照常計入佣金，但不計入升級業績 —— "
            "設備銷售不應推進等級，因為升等是永久的分潤成本變動。"
        ),
        "guardrail_note": (
            "每層分潤比例受 REIBI 最低保留比例限制，上限為 100 − 保留下限（預設 65%，即每層上限 35%）。"
            "超過上限的設定會被擋下並顯示護欄未通過。"
        ),
    }


def build_manual() -> dict[str, Any]:
    """完整手冊內容。角色與分潤兩節是即時產生，改了程式碼手冊就跟著變。"""
    return {
        "roles": {
            "note": "由後端權限 registry 直接產生；此表永遠等於實際授權，不是另一份說明文件。",
            "audit_note": AUDIT_NOTE,
            "items": documented_role_catalog(),
        },
        "onboarding": {"steps": [dict(step, items=list(step["items"])) for step in ONBOARDING_STEPS]},
        "settlement": {"timeline": [dict(row) for row in SETTLEMENT_TIMELINE]},
        "commission": _commission_rules(),
        "faq": [dict(row) for row in FAQ],
        "emergency": {"items": [dict(row) for row in EMERGENCY], "audit_note": AUDIT_NOTE},
    }
