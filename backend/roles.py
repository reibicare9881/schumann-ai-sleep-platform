"""Authoritative application role and permission registry.

The original REIBI artifacts defined roles in two separate frontends.  This
module is the single backend authority used by authentication and account
administration.  Frontends may display this catalog, but never authorize from
it locally.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Iterable

from fastapi import HTTPException


@dataclass(frozen=True)
class RoleDefinition:
    key: str
    label: str
    realm: str
    permissions: tuple[str, ...]
    requires_org: bool = False
    requires_department: bool = False
    requires_distributor: bool = False
    mfa_recommended: bool = False


def _role(
    key: str,
    label: str,
    realm: str,
    permissions: Iterable[str],
    **scope: bool,
) -> RoleDefinition:
    return RoleDefinition(key, label, realm, tuple(permissions), **scope)


ROLE_DEFINITIONS = {
    "individual": _role("individual", "個人用戶", "health", ["health_self", "service_center"]),
    "member": _role(
        "member", "單位成員", "organization",
        ["health_self", "submit_org", "service_center"],
        requires_org=True, requires_department=True,
    ),
    "dept_head": _role(
        "dept_head", "部門主管", "organization",
        ["health_self", "submit_org", "department_analytics", "service_center"],
        requires_org=True, requires_department=True,
    ),
    "admin_hr": _role(
        "admin_hr", "HR 管理者", "organization",
        ["org_analytics", "high_risk", "appointments_read", "ohs_manage", "service_center"],
        requires_org=True, requires_department=True,
    ),
    "admin_finance": _role(
        "admin_finance", "財務管理者", "organization",
        ["org_analytics", "org_finance", "service_center"],
        requires_org=True, requires_department=True,
    ),
    "admin_it": _role(
        "admin_it", "IT 管理者", "organization",
        ["security_audit", "service_center"],
        requires_org=True, requires_department=True,
    ),
    "admin": _role(
        "admin", "單位平台管理者", "organization",
        [
            "org_analytics", "org_reports", "org_settings", "appointments_manage",
            "ohs_manage", "identity_manage_org", "service_center", "manage_reibi",
        ],
        requires_org=True, mfa_recommended=True,
    ),
    "occupational_health": _role(
        "occupational_health", "臨場醫護人員", "organization",
        ["oh_interview", "service_center"],
        requires_org=True,
    ),
    "reibi_super": _role(
        "reibi_super", "REIBI 內部超級管理者", "reibi",
        ["all", "identity_manage_all"], mfa_recommended=True,
    ),
    "reibi_finance": _role(
        "reibi_finance", "REIBI 財務管理員", "reibi",
        ["reibi_overview", "manage_reibi", "enterprise_manage", "finance_manage", "distributor_manage", "reports"],
        mfa_recommended=True,
    ),
    "reibi_data": _role(
        "reibi_data", "REIBI 數據分析師", "reibi",
        ["reibi_overview", "cross_org_analytics", "reports"],
        mfa_recommended=True,
    ),
    "reibi_cs": _role(
        "reibi_cs", "REIBI 客服管理員", "reibi",
        ["reibi_overview", "service_manage", "message_manage", "reports"],
        mfa_recommended=True,
    ),
    "partner_primary": _role(
        "partner_primary", "主經銷商", "partner",
        ["partner_enterprises", "partner_finance", "partner_commission", "partner_subscriptions", "service_center"],
        requires_distributor=True,
    ),
    "partner_sub": _role(
        "partner_sub", "次級經銷商", "partner",
        ["partner_enterprises", "partner_finance", "partner_commission", "service_center"],
        requires_distributor=True,
    ),
}

ALL_ROLES = frozenset(ROLE_DEFINITIONS)
ORG_ROLES = frozenset(key for key, value in ROLE_DEFINITIONS.items() if value.requires_org)
DEPARTMENT_REQUIRED_ROLES = frozenset(
    key for key, value in ROLE_DEFINITIONS.items() if value.requires_department
)
PARTNER_ROLES = frozenset(key for key, value in ROLE_DEFINITIONS.items() if value.requires_distributor)
REIBI_INTERNAL_ROLES = frozenset(
    key for key, value in ROLE_DEFINITIONS.items() if value.realm == "reibi"
)
MFA_RECOMMENDED_ROLES = frozenset(
    key for key, value in ROLE_DEFINITIONS.items() if value.mfa_recommended
)

# These roles never existed in the legacy shared-PIN FastAPI flow.  A token for
# one of them is accepted only when backed by a revocable trusted session.
TRUSTED_EXCLUSIVE_ROLES = REIBI_INTERNAL_ROLES | PARTNER_ROLES | {
    "admin_hr", "admin_finance", "admin_it"
}

ORG_ADMIN_ASSIGNABLE_ROLES = frozenset({
    "member", "dept_head", "admin_hr", "admin_finance", "admin_it", "occupational_health"
})


# 權限的人話說明。站內操作手冊的角色權限表由此產生，不另外手寫一份 ——
# Artifact 的 ManualScreen 就是手寫的，結果它描述的角色與實際授權早已對不上。
# 新增權限時這裡沒補，`missing_permission_labels()` 會讓測試失敗。
PERMISSION_LABELS: dict[str, str] = {
    "all": "全功能（唯一可執行開通、修改方案、核發帳號）",
    "appointments_manage": "預約排程建立、修改與審核",
    "appointments_read": "預約排程檢視",
    "cross_org_analytics": "跨企業去識別化分析",
    "department_analytics": "所屬部門的去識別化健康趨勢",
    "distributor_manage": "經銷商建立、等級與次級經銷商維護",
    "enterprise_manage": "企業資料、方案與授權維護",
    "finance_manage": "付款時程、發票、匯款沖帳與分潤查核",
    "health_self": "本人健康評估、日誌、積分與問卷",
    "high_risk": "高風險族群分佈與介入建議",
    "identity_manage_all": "全系統帳號邀請、角色指派與撤銷",
    "identity_manage_org": "本單位帳號邀請與角色指派",
    "manage_reibi": "REIBI 商務文件（報價、合約、工單）",
    "message_manage": "LINE 範本、草稿與推播記錄",
    "oh_interview": "臨場醫護面談紀錄",
    "ohs_manage": "職安衛計畫、危害辨識與問卷管理",
    "org_analytics": "本單位去識別化健康彙整與 KPI",
    "org_finance": "本單位應付款與匯款申報",
    "org_reports": "本單位 AI 組織報告產生",
    "org_settings": "本單位組織、部門與參數設定",
    "partner_commission": "自身佣金明細與月結",
    "partner_enterprises": "自身承接企業清單",
    "partner_finance": "自身付款與收款狀態",
    "partner_subscriptions": "次級經銷商管理",
    "reibi_overview": "L5 營運總覽（依角色裁切）",
    "reports": "報表中心與匯出",
    "security_audit": "資安稽核紀錄檢視",
    "service_center": "服務申請提交與進度查詢",
    "service_manage": "服務案件處理與排程確認",
    "submit_org": "評估結果納入所屬單位彙整",
}

REALM_LABELS = {
    "health": "個人",
    "organization": "企業單位",
    "reibi": "REIBI 內部",
    "partner": "經銷夥伴",
}


def missing_permission_labels() -> list[str]:
    """回傳有被角色引用、但還沒有人話說明的權限。"""
    used = {permission for definition in ROLE_DEFINITIONS.values() for permission in definition.permissions}
    return sorted(used - set(PERMISSION_LABELS))


def role_catalog() -> list[dict]:
    """Return a JSON-safe catalog for UI rendering and documentation."""
    return [asdict(definition) for definition in ROLE_DEFINITIONS.values()]


def documented_role_catalog() -> list[dict]:
    """角色目錄加上人話說明，供站內操作手冊直接渲染。"""
    return [
        {
            **asdict(definition),
            "realm_label": REALM_LABELS.get(definition.realm, definition.realm),
            "permission_labels": [
                PERMISSION_LABELS.get(permission, permission) for permission in definition.permissions
            ],
            "scopes": [
                label for label, required in (
                    ("需綁定單位", definition.requires_org),
                    ("需綁定部門", definition.requires_department),
                    ("需綁定經銷商", definition.requires_distributor),
                ) if required
            ],
        }
        for definition in ROLE_DEFINITIONS.values()
    ]


def has_permission(user: dict, permission: str) -> bool:
    definition = ROLE_DEFINITIONS.get(str(user.get("role") or ""))
    if definition is None:
        return False
    overrides = set(user.get("permission_overrides") or [])
    return "all" in definition.permissions or permission in definition.permissions or permission in overrides


def require_permission(permission: str):
    """Create a dependency-compatible authorization check."""
    def check(user: dict) -> dict:
        if not has_permission(user, permission):
            raise HTTPException(status_code=403, detail="此帳號沒有執行此操作的權限")
        return user
    return check


def can_manage_identity(actor: dict, target_role: str, target_org_code: str | None) -> bool:
    """Prevent privilege escalation and cross-organization account changes."""
    actor_role = actor.get("role")
    if actor_role == "reibi_super":
        return target_role in ALL_ROLES
    return bool(
        actor_role == "admin"
        and target_role in ORG_ADMIN_ASSIGNABLE_ROLES
        and actor.get("org_code")
        and actor.get("org_code") == target_org_code
    )


def validate_role_scope(
    role: str,
    *,
    org_code: str | None,
    department_id: int | None,
    distributor_id: int | None,
) -> None:
    definition = ROLE_DEFINITIONS.get(role)
    if definition is None:
        raise HTTPException(status_code=422, detail="未知的帳號角色")
    if definition.requires_org != bool(org_code):
        raise HTTPException(status_code=422, detail="此角色的企業範圍設定不完整或不應存在")
    if definition.requires_department != bool(department_id):
        raise HTTPException(status_code=422, detail="此角色的部門範圍設定不完整或不應存在")
    if definition.requires_distributor != bool(distributor_id):
        raise HTTPException(status_code=422, detail="此角色的經銷商範圍設定不完整或不應存在")
