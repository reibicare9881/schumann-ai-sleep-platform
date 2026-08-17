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
]


def _guard_local_only(url: str) -> None:
    if url != LOCAL_SUPABASE_URL:
        raise SystemExit(
            f"拒絕執行：E2E 種子資料只能寫入本機 Supabase（{LOCAL_SUPABASE_URL}），收到 {url}"
        )


def seed() -> list[str]:
    _guard_local_only(LOCAL_SUPABASE_URL)
    client = create_client(LOCAL_SUPABASE_URL, LOCAL_SERVICE_ROLE_KEY)

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
        client.table("reibi_internal_users").insert(
            {
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
        ).execute()
        created.append(f"created {identity.email} ({identity.internal_role})")

    return created


if __name__ == "__main__":
    for line in seed():
        print(line)
    print(f"done: {len(IDENTITIES)} identities ready", file=sys.stderr)
