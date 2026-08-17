"""Guards on Batch D/E health and analytics routes now read roles.py.

Those modules predated the 14-role registry and hardcoded role-name sets, so
``admin_hr`` could not run occupational health or read organisation aggregates
and ``reibi_data`` could not read cross-enterprise analytics, even though the
registry granted them exactly those permissions.

These tests pin down both directions: the roles the registry entitles get in,
and the ones it does not stay out — including the money-shaped fields, which
``reibi_data`` must not see on this route any more than it does on L5.
"""

from __future__ import annotations

import pytest

from reibi_batch_e import (
    can_view_financial_figures,
    calculate_strategy,
    redact_financial_figures,
)
from reibi_batch_d import (
    require_aggregate_viewer,
    require_occupational,
    require_ohs_manager,
)
from reibi_batch_e import (
    require_cross_org_analytics,
    require_org_analytics,
    require_org_report,
)
from fastapi import HTTPException

from roles import ROLE_DEFINITIONS


def _user(role: str) -> dict:
    return {"role": role, "uid": "00000000-0000-0000-0000-000000000001", "org_code": "TESTORG"}


def _allows(guard, role: str) -> bool:
    try:
        guard(_user(role))
        return True
    except HTTPException as exc:
        assert exc.status_code == 403
        return False


class TestGuardsMatchTheRegistry:
    """Each guard admits exactly the roles holding the matching permission."""

    @pytest.mark.parametrize("role", sorted(ROLE_DEFINITIONS))
    def test_ohs_manager_tracks_ohs_manage(self, role):
        from roles import has_permission

        assert _allows(require_ohs_manager, role) is has_permission(_user(role), "ohs_manage")

    @pytest.mark.parametrize("role", sorted(ROLE_DEFINITIONS))
    def test_occupational_tracks_ohs_manage_or_interview(self, role):
        from roles import has_permission

        expected = has_permission(_user(role), "ohs_manage") or has_permission(
            _user(role), "oh_interview"
        )
        assert _allows(require_occupational, role) is expected

    @pytest.mark.parametrize("role", sorted(ROLE_DEFINITIONS))
    def test_cross_org_tracks_cross_org_analytics(self, role):
        from roles import has_permission

        assert _allows(require_cross_org_analytics, role) is has_permission(
            _user(role), "cross_org_analytics"
        )


class TestRolesThatWereBlockedNowWork:
    def test_admin_hr_can_manage_occupational_health(self):
        assert _allows(require_ohs_manager, "admin_hr")
        assert _allows(require_occupational, "admin_hr")

    def test_admin_hr_can_read_organisation_aggregates(self):
        assert _allows(require_aggregate_viewer, "admin_hr")
        assert _allows(require_org_analytics, "admin_hr")

    def test_reibi_data_can_read_cross_enterprise_analytics(self):
        assert _allows(require_cross_org_analytics, "reibi_data")


class TestPreviouslyAllowedRolesKeepAccess:
    @pytest.mark.parametrize("role", ["admin", "reibi_super"])
    def test_admin_and_super_keep_ohs(self, role):
        assert _allows(require_ohs_manager, role)
        assert _allows(require_occupational, role)

    def test_occupational_health_keeps_interview_access(self):
        assert _allows(require_occupational, "occupational_health")

    @pytest.mark.parametrize("role", ["admin", "dept_head"])
    def test_admin_and_dept_head_keep_analytics(self, role):
        assert _allows(require_org_analytics, role)
        assert _allows(require_aggregate_viewer, role)

    def test_super_keeps_cross_org(self):
        assert _allows(require_cross_org_analytics, "reibi_super")


class TestAccessThatMustNotLeakIn:
    """The fix must not widen beyond what the registry actually grants."""

    @pytest.mark.parametrize("role", ["individual", "member", "admin_it", "partner_primary", "partner_sub"])
    def test_roles_without_ohs_manage_stay_out(self, role):
        assert not _allows(require_ohs_manager, role)
        assert not _allows(require_occupational, role)

    @pytest.mark.parametrize("role", ["individual", "member", "admin_it", "reibi_cs", "partner_sub"])
    def test_roles_without_analytics_stay_out(self, role):
        assert not _allows(require_org_analytics, role)
        assert not _allows(require_aggregate_viewer, role)

    def test_occupational_health_cannot_read_organisation_aggregates(self):
        assert not _allows(require_aggregate_viewer, "occupational_health")

    @pytest.mark.parametrize(
        "role", ["admin", "admin_hr", "admin_finance", "reibi_cs", "reibi_finance", "partner_primary"]
    )
    def test_only_cross_org_analytics_holders_reach_cross_org(self, role):
        assert not _allows(require_cross_org_analytics, role)

    @pytest.mark.parametrize("role", ["admin_hr", "admin_finance", "dept_head", "reibi_data"])
    def test_ai_organisation_reports_remain_admin_only(self, role):
        """org_reports is held by `admin` alone; generating costs money and writes a record."""
        assert not _allows(require_org_report, role)

    def test_admin_keeps_ai_organisation_reports(self):
        assert _allows(require_org_report, "admin")


class TestFinancialRedaction:
    @pytest.fixture
    def strategy_payload(self):
        enterprises = [
            {
                "org_code": "A1", "status": "active", "member_limit": 100, "used_count": 40,
                "partner_code": "P-01", "a_layer_fee": 1000, "b_layer_fee": 200,
                "c_layer_fee": 0, "d_layer_fee": 0, "contract_start": "2026-01-01",
            },
            {
                "org_code": "A2", "status": "active", "member_limit": 50, "used_count": 10,
                "partner_code": "P-02", "a_layer_fee": 500, "b_layer_fee": 0,
                "c_layer_fee": 0, "d_layer_fee": 0, "contract_start": "2026-02-01",
            },
        ]
        return {"health": {"sample_size": 12}, "strategy": calculate_strategy(enterprises, [])}

    def test_finance_roles_see_money(self):
        assert can_view_financial_figures(_user("reibi_finance"))
        assert can_view_financial_figures(_user("admin_finance"))
        assert can_view_financial_figures(_user("reibi_super"))

    def test_data_role_does_not_see_money(self):
        assert not can_view_financial_figures(_user("reibi_data"))

    def test_redaction_removes_every_money_field(self, strategy_payload):
        redacted = redact_financial_figures(strategy_payload)
        strategy = redacted["strategy"]

        assert "contracted_revenue" not in strategy
        assert "annual_revenue" not in strategy["goals"]
        for metrics in strategy["by_partner"].values():
            assert "revenue" not in metrics
        assert redacted["financials_redacted"] is True

    def test_redaction_keeps_the_analysis_a_data_role_needs(self, strategy_payload):
        redacted = redact_financial_figures(strategy_payload)
        strategy = redacted["strategy"]

        assert strategy["enterprise_count"] == 2
        assert strategy["licensed_members"] == 150
        assert strategy["used_members"] == 50
        for metrics in strategy["by_partner"].values():
            assert "enterprise_count" in metrics
        assert redacted["health"]["sample_size"] == 12

    def test_redaction_does_not_mutate_the_source(self, strategy_payload):
        redact_financial_figures(strategy_payload)
        assert "contracted_revenue" in strategy_payload["strategy"]


class TestCrossOrgResponseOverTheWire:
    """The redaction has to hold on the real response, not just in the helper."""

    @pytest.fixture
    def seeded(self, fake_supabase):
        fake_supabase.register_rpc(
            "reibi_cross_org_health_snapshot", lambda _params: {"sample_size": 9}
        )
        fake_supabase.seed(
            "reibi_enterprises",
            [
                {
                    "org_code": "A1", "org_name": "甲企業", "status": "active", "industry": "製造",
                    "plan_code": "basic", "member_limit": 100, "used_count": 40,
                    "contract_start": "2026-01-01", "contract_end": "2027-01-01",
                    "partner_code": "P-01", "a_layer_fee": 1000, "b_layer_fee": 200,
                    "c_layer_fee": 0, "d_layer_fee": 0, "source_payload": {},
                }
            ],
        )
        fake_supabase.seed(
            "reibi_distributors",
            [{"org_code": "P-01", "parent_id": None, "distributor_type": "primary",
              "name": "主經銷商", "level_code": "A", "status": "active", "region": "北區"}],
        )
        return fake_supabase

    def test_data_role_gets_analysis_without_any_money(self, client, tokens, seeded):
        response = client.get(
            "/api/reibi/analytics/cross-org", headers=tokens.header("reibi_data")
        )
        assert response.status_code == 200

        payload = response.json()["data"]
        assert payload["financials_redacted"] is True
        assert payload["strategy"]["enterprise_count"] == 1
        assert payload["health"]["sample_size"] == 9

        body = response.text
        assert "contracted_revenue" not in body
        assert "annual_revenue" not in body
        assert '"revenue"' not in body

    def test_super_still_receives_the_financial_figures(self, client, tokens, seeded):
        response = client.get(
            "/api/reibi/analytics/cross-org", headers=tokens.header("reibi_super")
        )
        assert response.status_code == 200

        strategy = response.json()["data"]["strategy"]
        assert strategy["contracted_revenue"] == 1200
        assert strategy["by_partner"]["P-01"]["revenue"] == 1200

    def test_roles_without_cross_org_analytics_are_rejected(self, client, tokens, seeded):
        for role in ("admin", "admin_hr", "reibi_finance", "reibi_cs"):
            response = client.get(
                "/api/reibi/analytics/cross-org", headers=tokens.header(role)
            )
            assert response.status_code == 403, f"{role} 不應取得跨企業分析"
