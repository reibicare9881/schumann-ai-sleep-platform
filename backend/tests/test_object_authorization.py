"""Object-level authorization (IDOR/BOLA) for personal health records.

Every endpoint here takes a user or record identifier straight from the URL, so
"can you see this row" has to be decided from the token rather than from the
identifier the caller supplied.  The rule these tests pin down is the one
already used by ``/api/sleep/reports``: the owner, or a platform ``admin`` in
the same organization.  Anyone else gets 403, including admins of other
organizations and role holders with no organizational relationship at all.
"""

from __future__ import annotations

import pytest

from support.identities import (
    OTHER_ORG_CODE,
    PRIMARY_ORG_CODE,
    uid_for,
)

VICTIM_UID = "victim-0000-0000-0000-000000000001"
VICTIM_ORG = "VICTIMORG"


@pytest.fixture
def victim_records(fake_supabase):
    """One user in an unrelated organization, with data on every surface."""
    fake_supabase.seed(
        "profiles",
        [
            {"id": VICTIM_UID, "org_code": VICTIM_ORG, "full_name": "受害者"},
            {"id": uid_for("admin", "primary"), "org_code": PRIMARY_ORG_CODE},
            {"id": uid_for("admin", "other"), "org_code": OTHER_ORG_CODE},
        ],
    )
    fake_supabase.seed(
        "sleep_reports",
        [
            {
                "id": 501,
                "user_id": VICTIM_UID,
                "org_code": VICTIM_ORG,
                "profile": {"note": "受害者睡眠 profile"},
                "created_at": "2026-08-01T00:00:00Z",
            }
        ],
    )
    fake_supabase.seed(
        "records",
        [
            {
                "id": 601,
                "user_id": VICTIM_UID,
                "platform": "schumann",
                "ai_summary": {},
                "created_at": "2026-08-01T00:00:00Z",
            }
        ],
    )
    fake_supabase.seed(
        "analysis_records",
        [
            {
                "id": 701,
                "user_id": VICTIM_UID,
                "ai_summary": "{}",
                "report_url": "https://storage.invalid/victim.pdf",
                "created_at": "2026-08-01T00:00:00Z",
            }
        ],
    )
    return fake_supabase


# (label, method, url) for every route that reads another person's records.
CROSS_USER_ROUTES = [
    ("history", "GET", f"/api/history/{VICTIM_UID}"),
    ("schumann-trend", "GET", f"/api/schumann/trend/{VICTIM_UID}"),
    ("sleep-analysis", "GET", f"/api/sleep/analysis/{VICTIM_UID}"),
    ("sleep-latest-profile", "GET", f"/api/sleep/latest-profile/{VICTIM_UID}"),
    ("sleep-reports-list", "GET", f"/api/sleep/reports?user_id={VICTIM_UID}"),
    ("schumann-reports-list", "GET", f"/api/schumann/reports?user_id={VICTIM_UID}"),
    ("sleep-report-detail", "GET", "/api/sleep/reports/501"),
    ("schumann-report-detail", "GET", "/api/schumann/reports/701"),
    ("merged-pdf", "GET", "/api/pdf/701"),
]

ROUTE_IDS = [label for label, _, _ in CROSS_USER_ROUTES]


@pytest.mark.parametrize(("label", "method", "url"), CROSS_USER_ROUTES, ids=ROUTE_IDS)
class TestCrossUserReadsAreRejected:
    def test_individual_cannot_read_another_persons_records(
        self, client, tokens, victim_records, label, method, url
    ):
        response = client.request(method, url, headers=tokens.header("individual"))
        assert response.status_code == 403, f"{label} 回傳 {response.status_code}：{response.text[:200]}"

    def test_member_cannot_read_another_persons_records(
        self, client, tokens, victim_records, label, method, url
    ):
        response = client.request(method, url, headers=tokens.header("member"))
        assert response.status_code == 403, f"{label} 回傳 {response.status_code}：{response.text[:200]}"

    def test_admin_of_another_organization_cannot_read(
        self, client, tokens, victim_records, label, method, url
    ):
        response = client.request(method, url, headers=tokens.header("admin"))
        assert response.status_code == 403, f"{label} 回傳 {response.status_code}：{response.text[:200]}"

    def test_dept_head_of_another_organization_cannot_read(
        self, client, tokens, victim_records, label, method, url
    ):
        response = client.request(method, url, headers=tokens.header("dept_head"))
        assert response.status_code == 403, f"{label} 回傳 {response.status_code}：{response.text[:200]}"

    def test_reibi_internal_roles_do_not_get_identified_health_records(
        self, client, tokens, victim_records, label, method, url
    ):
        """跨企業分析角色只能看 k≥5 彙整，不能用個人識別碼直接讀原始紀錄。"""
        response = client.request(method, url, headers=tokens.header("reibi_data"))
        assert response.status_code == 403, f"{label} 回傳 {response.status_code}：{response.text[:200]}"


class TestOwnerAccessStillWorks:
    def test_owner_reads_their_own_latest_profile(self, client, tokens, fake_supabase):
        owner = uid_for("individual", "primary")
        fake_supabase.seed(
            "sleep_reports",
            [{"id": 1, "user_id": owner, "profile": {"note": "mine"}, "created_at": "2026-08-01"}],
        )
        response = client.get(
            f"/api/sleep/latest-profile/{owner}", headers=tokens.header("individual")
        )
        assert response.status_code == 200
        assert response.json()["profile"] == {"note": "mine"}

    def test_owner_reads_their_own_history(self, client, tokens, fake_supabase):
        owner = uid_for("individual", "primary")
        fake_supabase.seed(
            "records", [{"id": 1, "user_id": owner, "created_at": "2026-08-01"}]
        )
        response = client.get(f"/api/history/{owner}", headers=tokens.header("individual"))
        assert response.status_code == 200
        assert [row["id"] for row in response.json()["data"]] == [1]

    def test_owner_reads_their_own_schumann_trend(self, client, tokens, fake_supabase):
        owner = uid_for("individual", "primary")
        fake_supabase.seed(
            "records",
            [
                {
                    "id": 1,
                    "user_id": owner,
                    "platform": "schumann",
                    "ai_summary": {},
                    "created_at": "2026-08-01",
                }
            ],
        )
        response = client.get(f"/api/schumann/trend/{owner}", headers=tokens.header("individual"))
        assert response.status_code == 200


class TestSameOrganizationAdminAccess:
    """An admin keeps access to their own members — the fix must not over-deny."""

    @pytest.fixture
    def member_in_admin_org(self, fake_supabase):
        member_uid = uid_for("member", "primary")
        fake_supabase.seed(
            "profiles",
            [
                {"id": member_uid, "org_code": PRIMARY_ORG_CODE},
                {"id": uid_for("admin", "primary"), "org_code": PRIMARY_ORG_CODE},
            ],
        )
        fake_supabase.seed(
            "records", [{"id": 11, "user_id": member_uid, "created_at": "2026-08-01"}]
        )
        fake_supabase.seed(
            "sleep_reports",
            [
                {
                    "id": 12,
                    "user_id": member_uid,
                    "org_code": PRIMARY_ORG_CODE,
                    "profile": {"note": "member"},
                    "created_at": "2026-08-01",
                }
            ],
        )
        return member_uid

    def test_admin_reads_history_of_a_member_in_the_same_org(
        self, client, tokens, member_in_admin_org
    ):
        response = client.get(
            f"/api/history/{member_in_admin_org}", headers=tokens.header("admin")
        )
        assert response.status_code == 200

    def test_admin_reads_latest_profile_of_a_member_in_the_same_org(
        self, client, tokens, member_in_admin_org
    ):
        response = client.get(
            f"/api/sleep/latest-profile/{member_in_admin_org}", headers=tokens.header("admin")
        )
        assert response.status_code == 200

    def test_admin_gets_404_for_a_user_that_does_not_exist(self, client, tokens):
        response = client.get(
            "/api/history/no-such-user-at-all", headers=tokens.header("admin")
        )
        assert response.status_code == 404


class TestErrorBodiesDoNotLeakInternals:
    def test_authorization_failure_does_not_return_a_raw_exception_string(
        self, client, tokens, victim_records
    ):
        response = client.get(
            f"/api/history/{VICTIM_UID}", headers=tokens.header("individual")
        )
        detail = str(response.json().get("detail", ""))
        assert response.status_code == 403
        assert "system_role" not in detail
        assert "KeyError" not in detail
