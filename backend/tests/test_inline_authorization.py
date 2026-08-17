"""Authorization for routes that decide access inside the handler body.

These routes carry no guard dependency, so the generated matrix in
``test_role_authorization.py`` cannot reach them: their 403 is raised after
parameter validation, and several of them answer 200 with a *narrowed* result
set rather than refusing outright.  Both shapes are checked here — refusal
where refusal is the contract, and scoping where scoping is.

``test_object_authorization.py`` covers the nine personal-record routes; this
module covers the rest.
"""

from __future__ import annotations

import pytest

from support.identities import PRIMARY_ORG_CODE, uid_for

SERVICE_MANAGERS = {"reibi_cs", "reibi_super"}
# roles.py grants service_center to every organization and partner role, and
# service_manage to reibi_cs; reibi_super holds "all".
SERVICE_CENTRE_ROLES = {
    "individual", "member", "dept_head", "admin_hr", "admin_finance", "admin_it",
    "admin", "occupational_health", "partner_primary", "partner_sub",
    "reibi_cs", "reibi_super",
}
NO_SERVICE_ROLES = {"reibi_finance", "reibi_data"}


class TestServiceTicketClosure:
    """Distributors may raise tickets for their enterprises but never close one."""

    @pytest.fixture
    def open_ticket(self, fake_supabase):
        fake_supabase.seed(
            "reibi_service_tickets",
            [{"id": 4001, "enterprise_id": 1, "status": "待處理", "subject": "測試案件"}],
        )
        fake_supabase.seed(
            "reibi_enterprises",
            [{"id": 1, "org_code": PRIMARY_ORG_CODE, "org_name": "測試企業", "partner_code": "TP-01"}],
        )
        return 4001

    @pytest.mark.parametrize("role", ["partner_primary", "partner_sub"])
    def test_distributor_cannot_update_a_ticket(self, client, tokens, open_ticket, role):
        response = client.patch(
            f"/api/reibi/service/tickets/{open_ticket}",
            headers=tokens.header(role),
            json={"status": "處理中"},
        )
        assert response.status_code == 403

    @pytest.mark.parametrize("role", ["admin", "admin_it", "member", "individual", "reibi_finance"])
    def test_roles_without_service_manage_cannot_update_a_ticket(
        self, client, tokens, open_ticket, role
    ):
        response = client.patch(
            f"/api/reibi/service/tickets/{open_ticket}",
            headers=tokens.header(role),
            json={"status": "處理中"},
        )
        assert response.status_code == 403

    @pytest.mark.parametrize("role", sorted(SERVICE_MANAGERS))
    def test_service_managers_clear_authorization(self, client, tokens, open_ticket, role):
        response = client.patch(
            f"/api/reibi/service/tickets/{open_ticket}",
            headers=tokens.header(role),
            json={"status": "處理中"},
        )
        assert response.status_code != 403


class TestServiceScopeAndCreation:
    @pytest.mark.parametrize("role", sorted(NO_SERVICE_ROLES))
    def test_roles_without_service_permission_are_refused_scope(self, client, tokens, role):
        assert client.get("/api/reibi/service/scope", headers=tokens.header(role)).status_code == 403

    @pytest.mark.parametrize("role", sorted(SERVICE_CENTRE_ROLES))
    def test_service_centre_roles_may_read_their_scope(self, client, tokens, role):
        response = client.get("/api/reibi/service/scope", headers=tokens.header(role))
        assert response.status_code != 403

    @pytest.mark.parametrize("role", sorted(NO_SERVICE_ROLES))
    def test_roles_without_service_permission_cannot_create_a_ticket(self, client, tokens, role):
        response = client.post(
            "/api/reibi/service/tickets",
            headers=tokens.header(role),
            json={"ticket_type": "報修", "priority": "一般", "note": "權限測試用案件"},
        )
        assert response.status_code == 403


class TestServiceTicketScoping:
    """Ticket listing narrows to the caller's scope instead of refusing."""

    @pytest.fixture
    def tickets_across_tenants(self, fake_supabase):
        fake_supabase.seed(
            "reibi_distributors",
            [
                {"id": 1, "org_code": "TP-01", "parent_id": None},
                {"id": 2, "org_code": "TP-OTHER", "parent_id": None},
            ],
        )
        fake_supabase.seed(
            "reibi_enterprises",
            [
                {"id": 1, "org_code": PRIMARY_ORG_CODE, "partner_code": "TP-01"},
                {"id": 2, "org_code": "FOREIGNORG", "partner_code": "TP-OTHER"},
            ],
        )
        fake_supabase.seed(
            "reibi_service_tickets",
            [
                {"id": 1, "enterprise_id": 1, "status": "待處理", "subject": "自家案件"},
                {"id": 2, "enterprise_id": 2, "status": "待處理", "subject": "他家案件"},
            ],
        )

    def test_distributor_listing_excludes_other_distributors_tickets(
        self, client, tokens, tickets_across_tenants
    ):
        response = client.get("/api/reibi/service/tickets", headers=tokens.header("partner_primary"))
        assert response.status_code == 200
        returned = {row["id"] for row in response.json()["data"]}
        assert 2 not in returned, "經銷商不應看到其他經銷商服務企業的案件"

    def test_individual_account_sees_no_enterprise_tickets(
        self, client, tokens, tickets_across_tenants
    ):
        response = client.get("/api/reibi/service/tickets", headers=tokens.header("individual"))
        assert response.status_code == 200
        assert response.json()["data"] == []


class TestAnnouncementRegistration:
    def test_personal_account_cannot_register_for_enterprise_announcements(self, client, tokens):
        response = client.post(
            "/api/reibi/announcements/1/register", headers=tokens.header("individual")
        )
        assert response.status_code == 403

    def test_cancelling_a_registration_only_touches_the_callers_own_row(
        self, client, tokens, fake_supabase
    ):
        other_profile = uid_for("member", "other")
        fake_supabase.seed(
            "reibi_announcement_registrations",
            [{"id": 1, "announcement_id": 9, "profile_id": other_profile, "status": "registered"}],
        )
        response = client.delete(
            "/api/reibi/announcements/9/register", headers=tokens.header("member")
        )
        assert response.status_code == 404
        assert fake_supabase.tables["reibi_announcement_registrations"][0]["status"] == "registered"


class TestL5Overview:
    L5_ROLES = {"reibi_super", "reibi_finance", "reibi_data", "reibi_cs", "partner_primary", "partner_sub"}
    NON_L5_ROLES = {
        "individual", "member", "dept_head", "admin", "admin_hr", "admin_finance",
        "admin_it", "occupational_health",
    }

    @pytest.mark.parametrize("role", sorted(NON_L5_ROLES))
    def test_organization_roles_are_refused_the_l5_dashboard(self, client, tokens, role):
        assert client.get("/api/reibi/l5/overview", headers=tokens.header(role)).status_code == 403

    @pytest.mark.parametrize("role", sorted(L5_ROLES))
    def test_l5_roles_clear_authorization(self, client, tokens, role):
        assert client.get("/api/reibi/l5/overview", headers=tokens.header(role)).status_code != 403


class TestSelfOnlyWrites:
    """Writes that must name the caller and nobody else."""

    OTHER_UID = uid_for("member", "other")

    def test_cannot_submit_a_sleep_assessment_for_someone_else(self, client, tokens):
        response = client.post(
            "/api/sleep/assessment",
            headers=tokens.header("individual"),
            json={
                "user_id": self.OTHER_UID,
                "sleep_scores": {"q1": 1, "q2": 1, "q3": 1, "q4": 1, "q5": 1, "q6": 1, "q7": 1},
                "pain_scores": {"q1": 1, "q2": 1, "q3": 1, "q4": 1, "q5": 1},
                "work_scores": {"q1": 1, "q2": 1, "q3": 1, "q4": 1, "q5": 1, "q6": 1},
            },
        )
        assert response.status_code in (403, 422)
        if response.status_code == 403:
            assert "越權" in response.json()["detail"]

    def test_cannot_book_an_appointment_for_someone_else(self, client, tokens):
        response = client.post(
            "/api/appointments",
            headers=tokens.header("member"),
            json={
                "user_id": self.OTHER_UID,
                "activity_type": "健康檢查",
                "item_name": "測試項目",
                "execution_date": "2026-09-01",
                "appointment_time": "09:00",
                "service_type": "現場",
            },
        )
        assert response.status_code == 403

    def test_cannot_switch_another_users_platform(self, client, tokens):
        response = client.post(
            f"/api/auth/switch-platform?user_id={self.OTHER_UID}&from_platform=sleep&to_platform=schumann",
            headers=tokens.header("member"),
        )
        assert response.status_code == 403

    def test_cannot_delete_another_users_appointment(self, client, tokens, fake_supabase):
        fake_supabase.seed(
            "appointments",
            [{"id": "appt-1", "user_id": self.OTHER_UID, "org_code": "FOREIGNORG"}],
        )
        response = client.delete("/api/appointments/appt-1", headers=tokens.header("admin"))
        assert response.status_code == 403
        assert fake_supabase.tables["appointments"], "越權刪除必須在寫入前被擋下"


class TestAiTrendCrossTenant:
    """AI trend analysis reads another person's health history and must be scoped."""

    @pytest.fixture
    def victim(self, fake_supabase):
        victim_uid = "ai-trend-victim-0001"
        fake_supabase.seed("profiles", [{"id": victim_uid, "org_code": "FOREIGNORG"}])
        fake_supabase.seed(
            "sleep_reports",
            [
                {
                    "id": 1,
                    "user_id": victim_uid,
                    "created_at": "2026-08-01T00:00:00Z",
                    "sleep_score": 20,
                    "pain_score": 10,
                }
            ],
        )
        return victim_uid

    @pytest.mark.parametrize("role", ["individual", "member", "admin", "dept_head", "reibi_data"])
    def test_no_role_may_analyse_a_user_outside_its_organization(
        self, client, tokens, victim, role
    ):
        response = client.post(f"/api/ai-trend/{victim}", headers=tokens.header(role))
        assert response.status_code == 403, (
            f"{role} 取得 {response.status_code}：{response.text[:200]}"
        )
