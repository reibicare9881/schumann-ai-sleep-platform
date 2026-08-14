import unittest
from datetime import datetime, timezone
from types import SimpleNamespace

from fastapi import HTTPException

from reibi_l5 import build_l5_dashboard, fetch_l5_datasets


NOW = datetime(2026, 8, 14, 4, 30, tzinfo=timezone.utc)


class FakeQuery:
    def __init__(self, rows):
        self.rows = list(rows)
        self.limit_value = None

    def select(self, *_args, **_kwargs): return self
    def eq(self, key, value):
        self.rows = [row for row in self.rows if row.get(key) == value]
        return self
    def in_(self, key, values):
        self.rows = [row for row in self.rows if row.get(key) in values]
        return self
    def limit(self, value):
        self.limit_value = value
        return self
    def execute(self):
        rows = self.rows[:self.limit_value] if self.limit_value is not None else self.rows
        return SimpleNamespace(data=rows)


class FakeClient:
    def __init__(self, tables): self.tables = tables
    def table(self, name): return FakeQuery(self.tables.get(name, []))


def sample_data():
    return {
        "enterprises": [
            {
                "id": 1, "status": "active", "member_limit": 100, "used_count": 95,
                "contract_end": "2026-08-30", "partner_code": "P-01",
                "a_layer_fee": 1000, "b_layer_fee": 200, "c_layer_fee": 0, "d_layer_fee": 0,
                "created_at": "2026-08-01T00:00:00Z",
            },
            {
                "id": 2, "status": "trial", "member_limit": 50, "used_count": 10,
                "contract_end": "2027-01-01", "partner_code": "P-02",
                "a_layer_fee": 500, "b_layer_fee": 0, "c_layer_fee": 0, "d_layer_fee": 0,
                "created_at": "2026-07-01T00:00:00Z",
            },
        ],
        "quotes": [
            {"id": 1, "enterprise_id": 1, "status": "已發送"},
            {"id": 2, "enterprise_id": 1, "status": "已確認"},
        ],
        "contracts": [
            {"id": 1, "enterprise_id": 1, "status": "待用印", "contract_end": "2026-09-01"},
            {"id": 2, "enterprise_id": 2, "status": "執行中", "contract_end": "2027-01-01"},
        ],
        "work_orders": [
            {"id": 1, "enterprise_id": 1, "status": "待驗收"},
            {"id": 2, "enterprise_id": 1, "status": "驗收異常"},
        ],
        "tickets": [{"id": 1, "enterprise_id": 1, "status": "待處理"}],
        "payments": [
            {"id": 1, "enterprise_id": 1, "status": "待付款", "due_date": "2026-08-01"},
            {"id": 2, "enterprise_id": 2, "status": "已付款", "due_date": "2026-07-01"},
        ],
        "remittances": [{"id": 1, "status": "待審核"}],
        "subscriptions": [
            {"id": 1, "status": "已核准", "amount": 888},
            {"id": 2, "status": "待審核", "amount": 888},
        ],
        "access_requests": [{"id": 1, "status": "pending"}],
        "distributors": [{"id": 1}, {"id": 2}],
    }


class ReibiL5Tests(unittest.TestCase):
    def test_rejects_non_l5_role(self):
        with self.assertRaises(HTTPException) as raised:
            build_l5_dashboard({"role": "admin"}, sample_data(), now=NOW)
        self.assertEqual(raised.exception.status_code, 403)

    def test_super_receives_complete_operational_dashboard(self):
        result = build_l5_dashboard({"role": "reibi_super"}, sample_data(), now=NOW)
        keys = {item["key"] for item in result["kpis"]}
        self.assertIn("contract_fee", keys)
        self.assertIn("subscription_revenue", keys)
        self.assertEqual(result["workflow"]["quotes"]["pending"], 1)
        self.assertEqual(result["workflow"]["work_orders"]["anomaly"], 1)
        self.assertIn("payment_overdue", {item["key"] for item in result["notifications"]})
        self.assertIn("access_request", {item["key"] for item in result["todos"]})
        self.assertEqual(result["notification_mode"], "live")

    def test_finance_cannot_receive_service_or_access_request_sections(self):
        result = build_l5_dashboard({"role": "reibi_finance"}, sample_data(), now=NOW)
        self.assertNotIn("work_orders", result["workflow"])
        self.assertNotIn("ticket_pending", {item["key"] for item in result["notifications"]})
        self.assertNotIn("access_request", {item["key"] for item in result["todos"]})
        self.assertIn("remittance_review", {item["key"] for item in result["todos"]})

    def test_data_role_does_not_receive_financial_values(self):
        result = build_l5_dashboard({"role": "reibi_data"}, sample_data(), now=NOW)
        self.assertFalse(result["workflow"])
        keys = {item["key"] for item in result["kpis"]}
        self.assertNotIn("contract_fee", keys)
        self.assertNotIn("subscription_revenue", keys)
        self.assertNotIn("payment_overdue", {item["key"] for item in result["notifications"]})
        self.assertEqual(result["trend"][-1], {"month": "2026-08", "count": 1})

    def test_partner_response_identifies_scope_and_hides_internal_queues(self):
        data = sample_data()
        data["enterprises"] = data["enterprises"][:1]
        data["quotes"] = data["quotes"][:1]
        data["contracts"] = data["contracts"][:1]
        data["payments"] = data["payments"][:1]
        data["work_orders"] = data["work_orders"][:1]
        result = build_l5_dashboard(
            {"role": "partner_primary"}, data, partner_codes=["P-01", "P-01-SUB"], now=NOW
        )
        self.assertEqual(result["scope"]["kind"], "partner")
        self.assertEqual(result["scope"]["partner_codes"], ["P-01", "P-01-SUB"])
        self.assertNotIn("remittance_review", {item["key"] for item in result["todos"]})
        self.assertNotIn("subscription_revenue", {item["key"] for item in result["kpis"]})
        self.assertEqual(result["workflow"]["quotes"]["total"], 1)

    def test_primary_partner_fetch_includes_children_but_excludes_other_enterprises(self):
        client = FakeClient({
            "reibi_distributors": [
                {"id": 10, "org_code": "P-01", "parent_id": None},
                {"id": 11, "org_code": "P-01-SUB", "parent_id": 10},
                {"id": 12, "org_code": "P-OTHER", "parent_id": None},
            ],
            "reibi_enterprises": [
                {"id": 1, "partner_code": "P-01"},
                {"id": 2, "partner_code": "P-01-SUB"},
                {"id": 3, "partner_code": "P-OTHER"},
            ],
            "reibi_quotes": [{"id": 1, "enterprise_id": 1}, {"id": 2, "enterprise_id": 3}],
            "reibi_contracts": [{"id": 1, "enterprise_id": 2}, {"id": 2, "enterprise_id": 3}],
            "reibi_payment_schedules": [{"id": 1, "enterprise_id": 1}, {"id": 2, "enterprise_id": 3}],
            "reibi_work_orders": [{"id": 1, "enterprise_id": 2}, {"id": 2, "enterprise_id": 3}],
        })
        datasets, codes = fetch_l5_datasets(client, {"role": "partner_primary", "partner_org_code": "P-01"})
        self.assertEqual(codes, ["P-01", "P-01-SUB"])
        self.assertEqual({row["id"] for row in datasets["enterprises"]}, {1, 2})
        for name in ("quotes", "contracts", "payments", "work_orders"):
            self.assertTrue(all(row["enterprise_id"] in {1, 2} for row in datasets[name]))


if __name__ == "__main__":
    unittest.main()
