import unittest
from datetime import date

from fastapi import HTTPException
from pydantic import ValidationError

from auth import require_reibi_manager
from reibi_onboarding import OnboardingCreate, _actor, _pdf_bytes


def valid_payload():
    return {
        "org_name": "測試企業",
        "org_alias": "TEST",
        "admin_email": "ADMIN@example.com",
        "contact_name": "王小明",
        "plan_code": "growth",
        "member_limit": 300,
        "contract_start": "2026-08-14",
        "contract_end": "2029-08-13",
    }


class ReibiOnboardingTests(unittest.TestCase):
    def test_normalizes_email_and_accepts_safe_defaults(self):
        payload = OnboardingCreate.model_validate(valid_payload())
        self.assertEqual(payload.admin_email, "admin@example.com")
        self.assertEqual(payload.devices.cloud_beds, 0)
        self.assertEqual(payload.contract_start, date(2026, 8, 14))

    def test_rejects_invalid_contract_range(self):
        values = valid_payload()
        values["contract_end"] = "2026-08-13"
        with self.assertRaises(ValidationError):
            OnboardingCreate.model_validate(values)

    def test_rejects_partner_and_referral_overlap(self):
        values = valid_payload()
        values.update({"partner_code": "PTN-01", "referral_percent": 8})
        with self.assertRaises(ValidationError):
            OnboardingCreate.model_validate(values)

    def test_onboarding_requires_enterprise_manage_permission(self):
        self.assertEqual(_actor({"role": "reibi_finance", "uid": "finance-1"})["uid"], "finance-1")
        with self.assertRaises(HTTPException) as raised:
            _actor({"role": "reibi_data", "uid": "data-1"})
        self.assertEqual(raised.exception.status_code, 403)

    def test_cross_org_scope_is_limited_to_internal_management_roles(self):
        scoped = require_reibi_manager(
            org_code="org-demo-26-000001",
            current_user={"role": "reibi_finance", "uid": "finance-1"},
        )
        self.assertEqual(scoped["org_code"], "ORG-DEMO-26-000001")
        with self.assertRaises(HTTPException) as raised:
            require_reibi_manager(
                org_code="ORG-OTHER",
                current_user={"role": "admin", "org_code": "ORG-OWN"},
            )
        self.assertEqual(raised.exception.status_code, 403)

    def test_credential_letter_is_a_real_pdf(self):
        pdf = _pdf_bytes({
            "case_no": "CASE-2608-000001",
            "credential_no": "CRED-2608-000001",
            "admin_email": "admin@example.com",
            "created_at": "2026-08-14T08:00:00Z",
            "reibi_enterprises": {
                "org_name": "測試企業", "org_code": "ORG-TEST-26-000001",
                "plan_code": "growth", "member_limit": 300,
            },
        }, "https://example.test")
        self.assertTrue(pdf.startswith(b"%PDF"))
        self.assertGreater(len(pdf), 1_000)


if __name__ == "__main__":
    unittest.main()
