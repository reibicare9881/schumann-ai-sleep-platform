"""稽核紀錄的讀取端 `GET /api/reibi/audit`。

`audit_logs` 是跨企業共用一張表，內容又正好是「誰對哪筆單做了什麼」，
所以範圍限制是這支端點唯一不能寫錯的地方 —— 漏掉就是直接的跨組織外洩。
這裡的測試以那件事為主，其次才是分頁與篩選。

背景：這支端點補的是 `admin_it` 在 L5 手冊上被公告、實際卻不存在的
「資安稽核紀錄檢視」（見 test_permission_registry_drift 的 KNOWN_UNBACKED）。
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from support.identities import OTHER_ORG_CODE, PRIMARY_ORG_CODE, uid_for

TABLE = "audit_logs"


def _row(index, org, action="quote.status", days_ago=0, actor="admin_it"):
    return {
        "id": f"00000000-0000-0000-0000-{index:012d}",
        "user_id": uid_for(actor, "primary"),
        "org_code": org,
        "action": action,
        "detail": f"稽核測試 #{index}",
        "role_at_time": actor,
        "created_at": (datetime.now(timezone.utc) - timedelta(days=days_ago)).isoformat(),
    }


@pytest.fixture
def seeded(fake_supabase):
    fake_supabase.seed(TABLE, [
        _row(1, PRIMARY_ORG_CODE, "quote.status", days_ago=0),
        _row(2, PRIMARY_ORG_CODE, "commission.paid", days_ago=1),
        _row(3, PRIMARY_ORG_CODE, "quote.status", days_ago=40),
        _row(4, OTHER_ORG_CODE, "quote.status", days_ago=0),
        _row(5, OTHER_ORG_CODE, "commission.paid", days_ago=0),
    ])


def _get(client, tokens, role="admin_it", tenant="primary", **params):
    return client.get("/api/reibi/audit", headers=tokens.header(role, tenant=tenant), params=params)


class TestOrgScoping:
    """跨組織界線。這一組壞掉等於資料外洩，其餘測試都不重要了。"""

    def test_an_org_role_only_sees_its_own_organization(self, client, tokens, seeded):
        response = _get(client, tokens)
        assert response.status_code == 200
        rows = response.json()["data"]["rows"]
        assert rows, "應該要看得到自己企業的紀錄"
        assert {row["org_code"] for row in rows} == {PRIMARY_ORG_CODE}

    def test_asking_for_another_org_is_refused_not_silently_ignored(self, client, tokens, seeded):
        # 安靜地改回自己的範圍，會讓呼叫端以為畫面上是別家的資料。
        response = _get(client, tokens, org_code=OTHER_ORG_CODE)
        assert response.status_code == 403

    def test_the_other_tenant_sees_only_its_own_rows(self, client, tokens, seeded):
        response = _get(client, tokens, tenant="other")
        assert response.status_code == 200
        assert {row["org_code"] for row in response.json()["data"]["rows"]} == {OTHER_ORG_CODE}


class TestPermission:
    def test_the_role_that_the_manual_promises_can_read_it(self, client, tokens, seeded):
        assert _get(client, tokens, role="admin_it").status_code == 200

    @pytest.mark.parametrize("role", ["member", "dept_head", "admin_hr", "admin_finance", "individual"])
    def test_roles_without_the_permission_are_refused(self, client, tokens, seeded, role):
        assert _get(client, tokens, role=role).status_code == 403

    def test_org_platform_admin_is_also_refused_without_the_permission(self, client, tokens, seeded):
        # `admin` 目前不持有 security_audit。若日後決定給它，要先改 roles.py 而不是繞過這裡。
        assert _get(client, tokens, role="admin").status_code == 403

    def test_an_unauthenticated_request_is_refused(self, client, seeded):
        assert client.get("/api/reibi/audit").status_code == 401


class TestPlatformScope:
    def test_reibi_super_sees_every_organization(self, client, tokens, seeded):
        response = _get(client, tokens, role="reibi_super")
        assert response.status_code == 200
        assert {row["org_code"] for row in response.json()["data"]["rows"]} == {PRIMARY_ORG_CODE, OTHER_ORG_CODE}

    def test_reibi_super_can_narrow_to_one_organization(self, client, tokens, seeded):
        response = _get(client, tokens, role="reibi_super", org_code=OTHER_ORG_CODE)
        assert response.status_code == 200
        assert {row["org_code"] for row in response.json()["data"]["rows"]} == {OTHER_ORG_CODE}


class TestFilteringAndPaging:
    def test_filters_by_action(self, client, tokens, seeded):
        response = _get(client, tokens, action="commission.paid")
        assert {row["action"] for row in response.json()["data"]["rows"]} == {"commission.paid"}

    def test_a_date_floor_excludes_older_rows(self, client, tokens, seeded):
        cutoff = (datetime.now(timezone.utc) - timedelta(days=7)).date().isoformat()
        details = {row["detail"] for row in _get(client, tokens, date_from=cutoff).json()["data"]["rows"]}
        assert "稽核測試 #3" not in details, "40 天前的紀錄不該落在最近 7 天內"

    def test_date_to_includes_rows_from_that_same_day(self, client, tokens, seeded):
        # 使用者填的是日期不是時間戳；今天的紀錄必須算在「到今天為止」裡面。
        today = datetime.now(timezone.utc).date().isoformat()
        details = {row["detail"] for row in _get(client, tokens, date_to=today).json()["data"]["rows"]}
        assert "稽核測試 #1" in details

    def test_reports_whether_another_page_exists(self, client, tokens, seeded):
        first = _get(client, tokens, size=1, page=1).json()["data"]
        assert len(first["rows"]) == 1
        assert first["has_more"] is True

    def test_the_last_page_reports_no_more(self, client, tokens, seeded):
        data = _get(client, tokens, size=50, page=1).json()["data"]
        assert data["has_more"] is False

    def test_exposes_the_action_catalog_for_the_filter(self, client, tokens, seeded):
        actions = _get(client, tokens).json()["data"]["actions"]
        assert "commission.paid" in actions and "quote.status" in actions
