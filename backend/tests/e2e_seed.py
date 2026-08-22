"""Seed the LOCAL Supabase stack with accounts for browser end-to-end tests.

Run against ``http://127.0.0.1:54321`` only.  The script refuses to touch any
other project: the shared Supabase instance backs both staging and production,
and E2E runs create and destroy accounts freely.

    python tests/e2e_seed.py

Every identity it creates carries the E2E_ prefix in its display name so a
leftover row is obvious.  Passwords live in this file on purpose — they are
local-only fixtures for a database that is recreated by ``npm run db:reset``,
and they never reach a deployed environment.
"""

from __future__ import annotations

import sys
from dataclasses import dataclass

from supabase import create_client

LOCAL_SUPABASE_URL = "http://127.0.0.1:54321"
# Well-known key printed by `supabase start`; identical on every developer machine.
LOCAL_SERVICE_ROLE_KEY = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
    "eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0."
    "EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"
)

E2E_PASSWORD = "e2e-local-fixture-password-2026"

# 單位成員需要企業、場域、部門與 profiles 才能通過 reibi_internal_users 的
# org/department/profile scope constraint，也才有東西可以在預約頁選場域。
MEMBER_ORG_CODE = "E2EORG"
MEMBER_ORG_NAME = "E2E 測試單位"
MEMBER_DEPARTMENT = "E2E 測試部門"
MEMBER_SITES = (
    ("E2E 台北場域", "台北市測試路 1 號"),
    ("E2E 新竹場域", "新竹市測試路 2 號"),
)


@dataclass(frozen=True)
class SeedIdentity:
    email: str
    display_name: str
    internal_role: str
    org_code: str | None = None


IDENTITIES = [
    SeedIdentity("e2e-super@example.test", "E2E 超級管理者", "reibi_super"),
    SeedIdentity("e2e-finance@example.test", "E2E 財務管理員", "reibi_finance"),
    SeedIdentity("e2e-cs@example.test", "E2E 客服管理員", "reibi_cs"),
    SeedIdentity("e2e-data@example.test", "E2E 數據分析師", "reibi_data"),
    SeedIdentity("e2e-member@example.test", "E2E 單位成員", "member", MEMBER_ORG_CODE),
]


def _guard_local_only(url: str) -> None:
    if url != LOCAL_SUPABASE_URL:
        raise SystemExit(
            f"拒絕執行：E2E 種子資料只能寫入本機 Supabase（{LOCAL_SUPABASE_URL}），收到 {url}"
        )


def _ensure_member_organisation(client) -> int:
    """Create the enterprise, sites and department a member identity requires."""
    existing = (
        client.table("reibi_enterprises").select("id").eq("org_code", MEMBER_ORG_CODE).limit(1).execute()
    )
    if existing.data:
        enterprise_id = existing.data[0]["id"]
    else:
        enterprise_id = (
            client.table("reibi_enterprises")
            .insert({"org_code": MEMBER_ORG_CODE, "org_name": MEMBER_ORG_NAME, "status": "active"})
            .execute()
            .data[0]["id"]
        )

    # 主平台的 organizations 是預約與登入查詢的來源；PIN 欄位 NOT NULL，
    # 這裡塞入固定的本機佔位值，正式流程仍由 Supabase 邀請設定密碼。
    if not client.table("organizations").select("org_code").eq("org_code", MEMBER_ORG_CODE).limit(1).execute().data:
        client.table("organizations").insert({
            "org_code": MEMBER_ORG_CODE,
            "org_name": MEMBER_ORG_NAME,
            "member_pin": "$2b$12$e2elocalplaceholderhashmemberxxxxxxxxxxxxxxxxxxxxxxxx",
            "dept_pin": "$2b$12$e2elocalplaceholderhashdeptxxxxxxxxxxxxxxxxxxxxxxxxxx",
            "admin_pin": "$2b$12$e2elocalplaceholderhashadminxxxxxxxxxxxxxxxxxxxxxxxxx",
        }).execute()

    for label, address in MEMBER_SITES:
        found = (
            client.table("reibi_enterprise_sites").select("id")
            .eq("enterprise_id", enterprise_id).eq("label", label).limit(1).execute()
        )
        if not found.data:
            client.table("reibi_enterprise_sites").insert({
                "enterprise_id": enterprise_id, "label": label, "address": address,
            }).execute()

    department = (
        client.table("reibi_departments").select("id")
        .eq("enterprise_id", enterprise_id).eq("name", MEMBER_DEPARTMENT).limit(1).execute()
    )
    if department.data:
        return department.data[0]["id"]
    return (
        client.table("reibi_departments")
        .insert({"enterprise_id": enterprise_id, "name": MEMBER_DEPARTMENT, "hierarchy_level": 1})
        .execute()
        .data[0]["id"]
    )


def seed() -> list[str]:
    _guard_local_only(LOCAL_SUPABASE_URL)
    client = create_client(LOCAL_SUPABASE_URL, LOCAL_SERVICE_ROLE_KEY)
    department_id = _ensure_member_organisation(client)

    created: list[str] = []
    for identity in IDENTITIES:
        existing = (
            client.table("reibi_internal_users")
            .select("auth_user_id")
            .eq("email", identity.email)
            .limit(1)
            .execute()
        )
        if existing.data:
            auth_user_id = existing.data[0]["auth_user_id"]
            client.auth.admin.update_user_by_id(auth_user_id, {"password": E2E_PASSWORD})
            created.append(f"reused {identity.email}")
            continue

        user = client.auth.admin.create_user(
            {
                "email": identity.email,
                "password": E2E_PASSWORD,
                "email_confirm": True,
            }
        )
        auth_user_id = user.user.id
        row = {
            "auth_user_id": auth_user_id,
            "email": identity.email,
            "display_name": identity.display_name,
            "internal_role": identity.internal_role,
            "is_active": True,
            # E2E drives the browser; TOTP would need a shared secret and a
            # clock-synchronised code generator for no additional coverage.
            # MFA enrolment itself is covered by the Python suite.
            "mfa_required": False,
            "org_code": identity.org_code,
        }
        if identity.internal_role == "member":
            # constraint 要求 profile_id = auth_user_id，且部門角色必須綁部門
            client.table("profiles").insert({
                "id": auth_user_id,
                "full_name": identity.display_name,
                "system_role": identity.internal_role,
                "org_code": identity.org_code,
                "department": MEMBER_DEPARTMENT,
            }).execute()
            row["profile_id"] = auth_user_id
            row["department_id"] = department_id
        client.table("reibi_internal_users").insert(row).execute()
        created.append(f"created {identity.email} ({identity.internal_role})")

    return created


if __name__ == "__main__":
    for line in seed():
        print(line)
    print(f"done: {len(IDENTITIES)} identities ready", file=sys.stderr)
