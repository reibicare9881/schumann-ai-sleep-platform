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


def role_catalog() -> list[dict]:
    """Return a JSON-safe catalog for UI rendering and documentation."""
    return [asdict(definition) for definition in ROLE_DEFINITIONS.values()]


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
