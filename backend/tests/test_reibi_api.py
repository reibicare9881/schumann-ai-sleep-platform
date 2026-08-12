import unittest

from fastapi.testclient import TestClient
from fastapi import HTTPException

import main
from auth import create_access_token, require_reibi_manager, require_reibi_partner
from reibi_api import QuoteCalculationRequest, _assert_lifecycle_transition, calculate_quote_fees
from reibi_batch_c import build_payment_schedule, calculate_distributor_commission
from decimal import Decimal


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

    def test_batch_c_payment_schedule_matches_artifact_rules(self):
        rows = build_payment_schedule({
            "plan_code": "基本", "pay_mode": "annual", "contract_start": "2026-01-31",
            "a_layer_fee": 600000, "b_layer_fee": 1000000,
            "c_layer_fee": 120000, "d_layer_fee": 200000,
        })
        by_code = {row["installment_code"]: row for row in rows}

        self.assertEqual(set(by_code), {"A1", "A2", "A3", "B1", "B2", "B3", "C1", "C2", "C3", "D1", "D2"})
        self.assertEqual(by_code["A2"]["due_date"].isoformat(), "2027-01-31")
        self.assertEqual(by_code["B1"]["amount"], Decimal("300000"))
        self.assertEqual(by_code["B2"]["amount"], Decimal("400000"))
        self.assertEqual(by_code["D2"]["status"], "待確認")

    def test_batch_c_commission_uses_independent_layer_percentages(self):
        result = calculate_distributor_commission(
            {"org_code": "D001", "level_code": "gold", "commission_b_percent": 18},
            [{"partner_code": "D001", "a_layer_fee": 100000, "b_layer_fee": 200000, "c_layer_fee": 50000}],
            Decimal("65"),
        )

        self.assertEqual(result["a_commission"], Decimal("14000"))
        self.assertEqual(result["b_commission"], Decimal("36000"))
        self.assertEqual(result["c_commission"], Decimal("4000"))
        self.assertEqual(result["total_commission"], Decimal("54000"))
        self.assertEqual(result["annual_sales"], Decimal("350000"))

    def test_batch_c_commission_retain_guard_blocks_excess(self):
        with self.assertRaisesRegex(ValueError, "超過"):
            calculate_distributor_commission(
                {"org_code": "D001", "level_code": "silver", "commission_a_percent": 36},
                [], Decimal("65"),
            )

    def test_org_admin_cannot_access_internal_distributor_catalog(self):
        token = create_access_token({
            "uid": "00000000-0000-0000-0000-000000000001",
            "name": "單位管理者", "role": "admin", "org_code": "ACME",
        })
        response = self.client.get("/api/reibi/distributors", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(response.status_code, 403)

    def test_partner_scope_rejects_internal_or_org_admin_roles(self):
        with self.assertRaises(HTTPException) as caught:
            require_reibi_partner({"role": "admin", "org_code": "ACME"})
        self.assertIn("限已驗證", caught.exception.detail)

    def test_partner_scope_requires_partner_org_code(self):
        with self.assertRaises(HTTPException) as caught:
            require_reibi_partner({"role": "partner_primary"})
        self.assertIn("partner_org_code", caught.exception.detail)


if __name__ == "__main__":
    unittest.main()
