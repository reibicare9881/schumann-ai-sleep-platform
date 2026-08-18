"""Enterprise account-limit view (Artifact AccLimitScreen).

L5 could always see every enterprise's licence usage, but an enterprise
administrator had no way to see their own. The artifact screen that did this
showed a hardcoded 72% instead of real data; this one reads used_count.
"""

from __future__ import annotations

import pytest

from reibi_api import ACCOUNT_LIMIT_WARNING_PERCENT, PLAN_ACCOUNT_LIMITS, build_account_usage
from support.identities import PRIMARY_ORG_CODE

URL = "/api/reibi/enterprise/account-usage"


class TestUsageCalculation:
    def test_percentage_and_remaining_come_from_real_counts(self):
        usage = build_account_usage({"plan_code": "growth", "member_limit": 300, "used_count": 216})
        assert usage["percent"] == 72
        assert usage["remaining"] == 84
        assert usage["over_limit"] is False

    def test_warning_appears_at_the_documented_threshold(self):
        below = build_account_usage({"plan_code": "basic", "member_limit": 100, "used_count": 89})
        at = build_account_usage({"plan_code": "basic", "member_limit": 100, "used_count": 90})

        assert ACCOUNT_LIMIT_WARNING_PERCENT == 90
        assert below["warning"] is False
        assert at["warning"] is True

    def test_exceeding_the_limit_is_reported_separately_from_warning(self):
        usage = build_account_usage({"plan_code": "basic", "member_limit": 100, "used_count": 130})
        assert usage["over_limit"] is True
        assert usage["remaining"] == 0
        assert usage["percent"] == 130

    def test_zero_limit_does_not_divide_by_zero(self):
        usage = build_account_usage({"plan_code": "custom", "member_limit": 0, "used_count": 5})
        assert usage["percent"] == 0
        assert usage["warning"] is False
        assert usage["over_limit"] is False

    def test_limit_follows_the_contract_not_the_plan_ladder(self):
        """A negotiated member_limit must win over the ladder's nominal figure."""
        usage = build_account_usage({"plan_code": "basic", "member_limit": 250, "used_count": 125})
        assert usage["member_limit"] == 250
        assert usage["percent"] == 50

    def test_plan_ladder_matches_the_artifact_figures(self):
        assert [(code, limit) for code, _label, limit in PLAN_ACCOUNT_LIMITS] == [
            ("basic", 100), ("growth", 300), ("professional", 500), ("flagship", 1000),
        ]

    def test_current_plan_is_marked_in_the_ladder(self):
        usage = build_account_usage({"plan_code": "professional", "member_limit": 500, "used_count": 10})
        current = [row for row in usage["plans"] if row["is_current"]]
        assert [row["plan_code"] for row in current] == ["professional"]
        assert usage["plan_label"] == "專業型"

    def test_plan_outside_the_ladder_is_labelled_rather_than_guessed(self):
        usage = build_account_usage({"plan_code": "custom", "member_limit": 2000, "used_count": 100})
        assert usage["plan_label"] == "客製方案"
        assert all(row["is_current"] is False for row in usage["plans"])


class TestEndpoint:
    @pytest.fixture
    def seeded(self, fake_supabase):
        fake_supabase.seed(
            "reibi_enterprises",
            [
                {"id": 1, "org_code": PRIMARY_ORG_CODE, "plan_code": "growth",
                 "member_limit": 300, "used_count": 216},
                {"id": 2, "org_code": "OTHERORG", "plan_code": "flagship",
                 "member_limit": 1000, "used_count": 900},
            ],
        )
        return fake_supabase

    def test_enterprise_admin_sees_their_own_usage(self, client, tokens, seeded):
        response = client.get(URL, headers=tokens.header("admin"))
        assert response.status_code == 200

        data = response.json()["data"]
        assert data["org_code"] == PRIMARY_ORG_CODE
        assert data["used_count"] == 216
        assert data["percent"] == 72

    def test_another_organisation_is_never_returned(self, client, tokens, seeded):
        body = client.get(URL, headers=tokens.header("admin")).text
        assert "OTHERORG" not in body

    @pytest.mark.parametrize("role", ["member", "dept_head", "admin_hr", "individual", "reibi_cs"])
    def test_roles_without_manage_reibi_are_rejected(self, client, tokens, seeded, role):
        assert client.get(URL, headers=tokens.header(role)).status_code == 403

    def test_unauthenticated_access_is_rejected(self, client, seeded):
        assert client.get(URL).status_code == 401

    def test_missing_enterprise_returns_404_not_500(self, client, tokens, fake_supabase):
        assert client.get(URL, headers=tokens.header("admin")).status_code == 404
