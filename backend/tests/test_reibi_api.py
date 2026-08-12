import unittest

from fastapi.testclient import TestClient

import main
from auth import create_access_token, require_reibi_manager
from reibi_api import QuoteCalculationRequest, _assert_lifecycle_transition, calculate_quote_fees


class ReibiApiTests(unittest.TestCase):
    def setUp(self):
        main.app.dependency_overrides[require_reibi_manager] = lambda: {
            "uid": "00000000-0000-0000-0000-000000000001",
            "name": "測試管理者",
            "role": "admin",
            "org_code": "ACME",
        }
        self.client = TestClient(main.app)

    def tearDown(self):
        main.app.dependency_overrides.clear()

    def test_artifact_validation_does_not_return_raw_records(self):
        response = self.client.post("/api/reibi/artifacts/validate", json={
            "source_artifact": "quote",
            "source_version": "v1.13",
            "entries": [{
                "storage_key": "rq_quotes",
                "value": [{"id": "Q1", "docNo": "QT-001", "clientName": "ACME"}],
            }],
        })

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["data"]["record_count"], 1)
        self.assertNotIn("records", body["data"])

    def test_artifact_validation_rejects_unknown_fields(self):
        response = self.client.post("/api/reibi/artifacts/validate", json={
            "source_artifact": "main",
            "entries": [{"storage_key": "subs", "value": []}],
            "unexpected": True,
        })

        self.assertEqual(response.status_code, 422)

    def test_org_admin_cannot_run_cross_org_import(self):
        main.app.dependency_overrides.clear()
        token = create_access_token({
            "uid": "00000000-0000-0000-0000-000000000001",
            "name": "單位管理者",
            "role": "admin",
            "org_code": "ACME",
        })
        response = self.client.post(
            "/api/reibi/artifacts/import",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "source_artifact": "l5",
                "entries": [{"storage_key": "l5_enterprises", "value": []}],
            },
        )

        self.assertEqual(response.status_code, 403)

    def test_quote_calculation_matches_artifact_layer_rules(self):
        result = calculate_quote_fees(QuoteCalculationRequest(
            member_count=100,
            pay_mode="annual",
            contract_years=3,
            b_bed=1,
            b_chair=1,
            b_la200=1,
            c_tier="基本型",
            c_high_risk=1,
            d_items=["poster", "qr"],
        ))

        self.assertEqual(result["a_layer_fee"], 570000)
        self.assertEqual(result["b_layer_fee"], 1699400)
        self.assertEqual(result["c_layer_fee"], 49000)
        self.assertEqual(result["d_layer_fee_min"], 20000)
        self.assertEqual(result["d_layer_fee_max"], 40000)
        self.assertEqual(result["total_year_fee"], 619000)
        self.assertEqual(result["total_contract_fee"], 3556400)

    def test_quote_calculation_requires_custom_a_fee_above_1000_members(self):
        result = calculate_quote_fees(QuoteCalculationRequest(member_count=1001))
        self.assertEqual(result["a_layer_fee"], 0)
        self.assertTrue(result["a_custom_required"])

        negotiated = calculate_quote_fees(QuoteCalculationRequest(member_count=1001, a_custom_fee=3600000))
        self.assertEqual(negotiated["a_layer_fee"], 3600000)

    def test_lifecycle_rejects_skipped_steps(self):
        with self.assertRaisesRegex(ValueError, "不可從"):
            _assert_lifecycle_transition("work_order", "草稿", "驗收完成")

    def test_lifecycle_allows_artifact_next_step(self):
        _assert_lifecycle_transition("quote", "已發送", "已確認")


if __name__ == "__main__":
    unittest.main()
