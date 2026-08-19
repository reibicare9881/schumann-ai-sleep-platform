"""Organisation-aggregate consent is carried from the form to the row (MP-01E).

``reibi_health_assessments.consent_org_aggregate`` existed since Batch D but was
never written or read, and ``sleep_reports`` had no equivalent column at all, so
an employee's sleep, pain and work scores entered their employer's organisation
report whether or not they agreed to it.

The SQL side is covered by ``supabase/tests/reibi_org_consent.test.sql``; these
tests pin the API contract: consent defaults to false, is only true when the
caller explicitly says so, and reaches the stored row.
"""

from __future__ import annotations

import pytest

from support.identities import PRIMARY_ORG_CODE, uid_for

SLEEP_URL = "/api/sleep/assessment"
REIBI_URL = "/api/reibi/health/assessments"


def _sleep_payload(uid: str, **extra) -> dict:
    payload = {
        "user_id": uid,
        "profile": {"name": "測試員工", "age": 35, "gender": "female"},
        "sleep_scores": {f"s{n}": 1 for n in range(1, 8)},
        "pain_scores": {f"p{n}": 2 for n in range(1, 6)},
        "work_scores": {f"w{n}": 3 for n in range(1, 4)},
    }
    payload.update(extra)
    return payload


class TestSleepAssessmentConsent:
    def test_consent_defaults_to_false_when_not_supplied(self, client, tokens, fake_supabase):
        uid = uid_for("member", "primary")
        response = client.post(SLEEP_URL, headers=tokens.header("member"), json=_sleep_payload(uid))
        assert response.status_code == 201

        row = fake_supabase.tables["sleep_reports"][0]
        assert row["consent_org_aggregate"] is False

    def test_explicit_consent_is_stored(self, client, tokens, fake_supabase):
        uid = uid_for("member", "primary")
        response = client.post(
            SLEEP_URL,
            headers=tokens.header("member"),
            json=_sleep_payload(uid, consent_org_aggregate=True),
        )
        assert response.status_code == 201
        assert fake_supabase.tables["sleep_reports"][0]["consent_org_aggregate"] is True

    def test_explicit_refusal_is_stored_as_false(self, client, tokens, fake_supabase):
        uid = uid_for("member", "primary")
        client.post(
            SLEEP_URL,
            headers=tokens.header("member"),
            json=_sleep_payload(uid, consent_org_aggregate=False),
        )
        assert fake_supabase.tables["sleep_reports"][0]["consent_org_aggregate"] is False

    def test_consent_is_per_assessment_not_sticky(self, client, tokens, fake_supabase):
        """Agreeing once must not silently opt the next assessment in."""
        uid = uid_for("member", "primary")
        client.post(
            SLEEP_URL, headers=tokens.header("member"),
            json=_sleep_payload(uid, consent_org_aggregate=True),
        )
        client.post(SLEEP_URL, headers=tokens.header("member"), json=_sleep_payload(uid))

        stored = [row["consent_org_aggregate"] for row in fake_supabase.tables["sleep_reports"]]
        assert stored == [True, False]

    def test_report_still_belongs_to_the_caller(self, client, tokens, fake_supabase):
        uid = uid_for("member", "primary")
        client.post(SLEEP_URL, headers=tokens.header("member"), json=_sleep_payload(uid))
        row = fake_supabase.tables["sleep_reports"][0]
        assert row["user_id"] == uid
        assert row["org_code"] == PRIMARY_ORG_CODE


class TestReibiAssessmentConsent:
    def _phq4(self, **extra) -> dict:
        payload = {"assessment_type": "phq4", "answers": [1, 1, 1, 1]}
        payload.update(extra)
        return payload

    @pytest.fixture(autouse=True)
    def _points_rpc(self, fake_supabase):
        fake_supabase.register_rpc("reibi_adjust_points", lambda _params: {"balance": 5})
        return fake_supabase

    def test_consent_defaults_to_false(self, client, tokens, fake_supabase):
        response = client.post(REIBI_URL, headers=tokens.header("member"), json=self._phq4())
        assert response.status_code == 201

        row = fake_supabase.tables["reibi_health_assessments"][0]
        assert row["consent_org_aggregate"] is False

    def test_explicit_consent_is_stored(self, client, tokens, fake_supabase):
        response = client.post(
            REIBI_URL, headers=tokens.header("member"),
            json=self._phq4(consent_org_aggregate=True),
        )
        assert response.status_code == 201
        assert fake_supabase.tables["reibi_health_assessments"][0]["consent_org_aggregate"] is True

    def test_unknown_fields_are_still_rejected(self, client, tokens):
        """The model forbids extras; adding consent must not loosen that."""
        response = client.post(
            REIBI_URL, headers=tokens.header("member"),
            json=self._phq4(consent_to_everything=True),
        )
        assert response.status_code == 422


class TestAssessmentPoints:
    """Artifact AssessWizard awarded 10 points; the migration dropped it."""

    def test_completing_an_assessment_awards_ten_points(self, client, tokens, fake_supabase):
        from main import SLEEP_ASSESSMENT_POINTS

        awarded: list[dict] = []
        fake_supabase.register_rpc("reibi_adjust_points", lambda params: awarded.append(params) or {"balance": 10})

        uid = uid_for("member", "primary")
        response = client.post(SLEEP_URL, headers=tokens.header("member"), json=_sleep_payload(uid))

        assert response.status_code == 201
        assert SLEEP_ASSESSMENT_POINTS == 10
        assert awarded and awarded[0]["p_points"] == 10
        assert awarded[0]["p_profile_id"] == uid

    def test_the_ledger_key_is_tied_to_the_report(self, client, tokens, fake_supabase):
        awarded: list[dict] = []
        fake_supabase.register_rpc("reibi_adjust_points", lambda params: awarded.append(params) or {"balance": 10})

        uid = uid_for("member", "primary")
        report_id = client.post(
            SLEEP_URL, headers=tokens.header("member"), json=_sleep_payload(uid)
        ).json()["report_id"]

        assert awarded[0]["p_event_code"] == "sleep_assessment"
        assert awarded[0]["p_event_key"] == f"sleep_assessment:{report_id}"

    def test_a_failing_ledger_does_not_lose_the_saved_report(self, client, tokens, fake_supabase):
        """Points are a bonus; the assessment must still be recorded."""
        uid = uid_for("member", "primary")
        # No RPC registered, so the fake raises — mirroring a ledger outage.
        response = client.post(SLEEP_URL, headers=tokens.header("member"), json=_sleep_payload(uid))

        assert response.status_code == 201
        assert len(fake_supabase.tables["sleep_reports"]) == 1


class TestConsentIsSeparateFromResearchOptIn:
    def test_org_consent_does_not_touch_the_research_flag(self, client, tokens, fake_supabase):
        """Cross-enterprise research uses profiles.research_opt_in, a different
        switch with a different scope; agreeing to one must not set the other."""
        uid = uid_for("member", "primary")
        fake_supabase.seed(
            "profiles",
            [{"id": uid, "org_code": PRIMARY_ORG_CODE, "research_opt_in": False}],
        )
        client.post(
            SLEEP_URL, headers=tokens.header("member"),
            json=_sleep_payload(uid, consent_org_aggregate=True),
        )
        assert fake_supabase.tables["profiles"][0]["research_opt_in"] is False
