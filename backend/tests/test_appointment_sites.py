"""Service-site pre-selection for appointments (MP-06D).

Batch F added ``appointments.service_site_id`` and its foreign key, but the
create endpoint never wrote the column and no site list was reachable by the
people who actually book: ``/api/reibi/enterprise/sites`` requires
``manage_reibi``, which a member or department head does not hold.

The rule under test is that a booker can read their own organisation's sites
and attach one, and cannot attach a site belonging to anyone else.
"""

from __future__ import annotations

import pytest

from support.identities import OTHER_ORG_CODE, PRIMARY_ORG_CODE, uid_for

SITES_URL = "/api/appointments/sites"
APPOINTMENTS_URL = "/api/appointments"


@pytest.fixture
def two_tenants(fake_supabase):
    """Two organisations, each with its own enterprise and sites."""
    fake_supabase.seed(
        "reibi_enterprises",
        [
            {"id": 1, "org_code": PRIMARY_ORG_CODE, "org_name": "本單位"},
            {"id": 2, "org_code": OTHER_ORG_CODE, "org_name": "他單位"},
        ],
    )
    fake_supabase.seed(
        "reibi_enterprise_sites",
        [
            {"id": 11, "enterprise_id": 1, "label": "台北總部", "address": "台北市測試路 1 號",
             "note": "", "sort_order": 1},
            {"id": 12, "enterprise_id": 1, "label": "新竹廠", "address": "新竹市測試路 2 號",
             "note": "", "sort_order": 2},
            {"id": 21, "enterprise_id": 2, "label": "他單位場域", "address": "高雄市",
             "note": "", "sort_order": 1},
        ],
    )
    return fake_supabase


class TestSiteListing:
    def test_member_can_read_their_own_organisation_sites(self, client, tokens, two_tenants):
        response = client.get(SITES_URL, headers=tokens.header("member"))
        assert response.status_code == 200

        labels = [row["label"] for row in response.json()["data"]]
        assert labels == ["台北總部", "新竹廠"]

    def test_listing_never_includes_another_organisation(self, client, tokens, two_tenants):
        body = client.get(SITES_URL, headers=tokens.header("member")).text
        assert "他單位場域" not in body

    @pytest.mark.parametrize("role", ["member", "dept_head", "admin", "admin_hr"])
    def test_roles_that_book_or_manage_can_all_read_sites(self, client, tokens, two_tenants, role):
        assert client.get(SITES_URL, headers=tokens.header(role)).status_code == 200

    def test_personal_accounts_are_excluded(self, client, tokens, two_tenants):
        """Appointments are an organisation feature; `individual` has no org."""
        assert client.get(SITES_URL, headers=tokens.header("individual")).status_code == 403

    def test_unauthenticated_access_is_rejected(self, client, two_tenants):
        assert client.get(SITES_URL).status_code == 401

    def test_organisation_without_a_reibi_enterprise_gets_an_empty_list(self, client, tokens, fake_supabase):
        """A SleepM org with no REIBI counterpart must not raise."""
        response = client.get(SITES_URL, headers=tokens.header("member"))
        assert response.status_code == 200
        assert response.json()["data"] == []

    def test_only_display_fields_are_returned(self, client, tokens, two_tenants):
        row = client.get(SITES_URL, headers=tokens.header("member")).json()["data"][0]
        assert set(row) <= {"id", "label", "address", "note"}


class TestBookingWithASite:
    def _booking(self, uid: str, site_id: int | None) -> dict:
        payload = {
            "user_id": uid,
            "execution_date": "2026-09-01",
            "appointment_time": "10:00",
            "service_type": "schumann",
        }
        if site_id is not None:
            payload["service_site_id"] = site_id
        return payload

    def test_site_is_persisted_on_the_appointment(self, client, tokens, two_tenants):
        uid = uid_for("member", "primary")
        response = client.post(
            APPOINTMENTS_URL,
            headers=tokens.header("member"),
            json=self._booking(uid, 11),
        )
        assert response.status_code == 200
        assert response.json()["data"]["service_site_id"] == 11

    def test_booking_without_a_site_still_works(self, client, tokens, two_tenants):
        uid = uid_for("member", "primary")
        response = client.post(
            APPOINTMENTS_URL, headers=tokens.header("member"), json=self._booking(uid, None)
        )
        assert response.status_code == 200
        assert response.json()["data"]["service_site_id"] is None

    def test_site_from_another_organisation_is_rejected(self, client, tokens, two_tenants):
        uid = uid_for("member", "primary")
        response = client.post(
            APPOINTMENTS_URL,
            headers=tokens.header("member"),
            json=self._booking(uid, 21),
        )
        assert response.status_code == 403
        assert "不屬於您的單位" in response.json()["detail"]

    def test_unknown_site_id_is_rejected(self, client, tokens, two_tenants):
        uid = uid_for("member", "primary")
        response = client.post(
            APPOINTMENTS_URL,
            headers=tokens.header("member"),
            json=self._booking(uid, 999999),
        )
        assert response.status_code == 403

    def test_rejected_booking_writes_nothing(self, client, tokens, two_tenants):
        uid = uid_for("member", "primary")
        client.post(
            APPOINTMENTS_URL, headers=tokens.header("member"), json=self._booking(uid, 21)
        )
        assert two_tenants.tables.get("appointments", []) == []

    def test_note_is_length_limited(self, client, tokens, two_tenants):
        uid = uid_for("member", "primary")
        payload = self._booking(uid, 11)
        payload["note"] = "超" * 501
        response = client.post(APPOINTMENTS_URL, headers=tokens.header("member"), json=payload)
        assert response.status_code == 422


class TestAppointmentListing:
    def test_site_label_is_attached_for_display(self, client, tokens, two_tenants):
        uid = uid_for("member", "primary")
        two_tenants.seed(
            "appointments",
            [{
                "id": "a1", "user_id": uid, "org_code": PRIMARY_ORG_CODE,
                "service_type": "schumann", "execution_date": "2026-09-01",
                "appointment_time": "10:00", "status": "pending", "service_site_id": 11,
                "profiles": {"full_name": "測試成員", "department": "測試部門"},
            }],
        )
        response = client.get(
            f"{APPOINTMENTS_URL}?org_code={PRIMARY_ORG_CODE}&service_type=schumann",
            headers=tokens.header("member"),
        )
        assert response.status_code == 200
        assert response.json()["data"][0]["service_site_label"] == "台北總部"

    def test_appointment_without_a_site_is_unaffected(self, client, tokens, two_tenants):
        uid = uid_for("member", "primary")
        two_tenants.seed(
            "appointments",
            [{
                "id": "a2", "user_id": uid, "org_code": PRIMARY_ORG_CODE,
                "service_type": "schumann", "execution_date": "2026-09-01",
                "appointment_time": "11:00", "status": "pending", "service_site_id": None,
                "profiles": {"full_name": "測試成員", "department": "測試部門"},
            }],
        )
        response = client.get(
            f"{APPOINTMENTS_URL}?org_code={PRIMARY_ORG_CODE}&service_type=schumann",
            headers=tokens.header("member"),
        )
        assert response.status_code == 200
        assert response.json()["data"][0].get("service_site_label") is None
