"""關於 REIBI（移植自 Artifact 主平台的 AboutREIBIScreen）。

五個分頁。其中兩個由系統既有資料產生，三個是**明確標示的佔位文案**。

為什麼佔位文案要標示得這麼明顯：品牌敘述、理論框架與利害關係人利益清單，
一旦寫得像定稿，就會有人直接拿去對外簡報。生成看起來可信的公司使命宣言，
比留白更危險 —— 留白會被補上，看起來完成的東西不會。

因此每個未定稿區塊都帶 `is_placeholder: True`，前端據此顯示警示，
而不是靠讀者自己看出文案是假的。
"""

from __future__ import annotations

from typing import Any

from reibi_batch_e import PLAN_888_TIMELINE

PLACEHOLDER_NOTICE = "本段為佔位內容，尚未由業務端定稿，請勿對外引用。"

# ── 待定稿的三個分頁 ────────────────────────────────────────────────────────
# 內容刻意寫成「這裡應該放什麼」，而不是寫成一段可以直接用的文案。
MISSION = {
    "is_placeholder": True,
    "title": "使命與定位",
    "sections": (
        {"heading": "使命", "body": "（待填：一段話說明 REIBI 為什麼存在，以及要為企業員工解決什麼問題。）"},
        {"heading": "定位", "body": "（待填：在企業健康促進市場中的定位，以及與一般健檢或 EAP 服務的差異。）"},
        {"heading": "服務範圍", "body": "（待填：軟體平台、硬體設備、高管健促服務與環境佈置四個層次各自的角色。）"},
    ),
}

FRAMEWORK = {
    "is_placeholder": True,
    "title": "理論框架",
    "sections": (
        {"heading": "Ottawa Charter 五大行動", "body": "（待填：五大行動綱領各自如何對應到平台功能。）"},
        {"heading": "IDG 五大維度", "body": "（待填：Being／Thinking／Relating／Collaborating／Acting 與平台的對應。）"},
        {"heading": "三維健康指標", "body": "（待填：ISI 睡眠、BPI 疼痛、MHI 身心三個維度的選用理由與量表出處。）"},
    ),
}

STAKEHOLDERS = {
    "is_placeholder": True,
    "title": "利害關係人",
    "groups": (
        {"role": "董事會", "benefits": ("（待填：3–5 條，建議從 ESG 揭露、法遵與人力成本角度切入。）",)},
        {"role": "HR／健康管理者", "benefits": ("（待填：3–5 條，建議從職安法遵、健促成效量化角度切入。）",)},
        {"role": "員工", "benefits": ("（待填：3–5 條，建議從個人健康回饋與隱私保障角度切入。）",)},
    ),
}

# ── 可沿用的一個分頁 ────────────────────────────────────────────────────────
# SDG 對標是 Artifact 既有文字，內容中性且與系統實際功能相符，直接沿用。
SDG_ALIGNMENT = {
    "is_placeholder": False,
    "title": "SDG 對標",
    "items": (
        {"code": "SDG 3", "title": "良好健康與福祉",
         "body": "提升企業員工睡眠、疼痛、身心健康三維指標，量化健康改善率。"},
        {"code": "SDG 8", "title": "尊嚴就業與經濟成長",
         "body": "降低因病缺勤率，提升工作效率（WPAI 工作效率問卷），改善企業生產力。"},
        {"code": "SDG 10", "title": "減少不平等",
         "body": "提供中小企業、製造業、服務業同等品質的健康自主管理工具，降低健促資源落差。"},
        {"code": "SDG 17", "title": "夥伴關係",
         "body": "透過經銷體系與企業、醫護專業及公部門健促資源串接，擴大可觸及的工作人口。"},
    ),
}


def _plan_888() -> dict[str, Any]:
    """888 計畫分頁。時間軸不另寫一份 —— 系統裡已經有了。

    `PLAN_888_TIMELINE` 是組織分析用來計算 888 進度的同一份定義，
    手冊照抄一份就會出現「文件說第 5 週、系統算第 6 週」的落差。
    """
    return {
        "is_placeholder": False,
        "title": "888 計畫",
        "three_80": (
            {"label": "第一個 80%", "body": "早期發現：完成健康評估的比例。"},
            {"label": "第二個 80%", "body": "生活諮商：異常者接受建議或諮詢的比例。"},
            {"label": "第三個 80%", "body": "有效控制：追蹤後指標改善或維持的比例。"},
        ),
        "timeline": [
            {"week": row["week"], "title": row["title"],
             "actions": list(row["actions"]), "target": row["target"]}
            for row in PLAN_888_TIMELINE
        ],
        "source_note": "時間軸與組織分析的 888 進度使用同一份定義，兩者不會出現落差。",
    }


def build_about() -> dict[str, Any]:
    """關於 REIBI 的完整內容，含每個分頁是否為佔位的標記。"""
    tabs = [
        {"key": "mission", **MISSION, "sections": [dict(s) for s in MISSION["sections"]]},
        {"key": "framework", **FRAMEWORK, "sections": [dict(s) for s in FRAMEWORK["sections"]]},
        {"key": "stakeholder", **STAKEHOLDERS,
         "groups": [{"role": g["role"], "benefits": list(g["benefits"])} for g in STAKEHOLDERS["groups"]]},
        {"key": "sdg", **SDG_ALIGNMENT, "items": [dict(i) for i in SDG_ALIGNMENT["items"]]},
        {"key": "plan888", **_plan_888()},
    ]
    return {
        "tabs": tabs,
        "placeholder_notice": PLACEHOLDER_NOTICE,
        # 讓呼叫端一眼看出還有多少沒定稿，而不是自己去數。
        "placeholder_count": sum(1 for tab in tabs if tab["is_placeholder"]),
    }
