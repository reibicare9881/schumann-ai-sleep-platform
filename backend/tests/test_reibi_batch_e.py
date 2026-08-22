import unittest
from datetime import date

from fastapi import HTTPException

from reibi_batch_e import (
    _nps_due,
    _safe_directory_search,
    build_gri,
    build_report_prompt,
    calculate_kpis,
    calculate_mhi_from_averages,
    calculate_plan888,
    calculate_roi,
    calculate_strategy,
)


class ReibiBatchETests(unittest.TestCase):
    def test_roi_matches_artifact_formula(self):
        result = calculate_roi({
            "headcount": 100,
            "improve_rate": 50,
            "sick_days_reduced": 2,
            "avg_daily_salary": 3000,
            "avg_monthly_salary": 48400,
            "insurance_saving": 1000,
            "productivity_gain": 10,
            "implement_cost": 1000000,
        })
        self.assertEqual(result["improved_people"], 50)
        self.assertEqual(result["sick_leave_saving"], 600000)
        self.assertEqual(result["insurance_saving"], 100000)
        self.assertEqual(result["productivity_saving"], 2640000)
        self.assertEqual(result["annual_benefit"], 3340000)
        self.assertEqual(result["scenarios"]["neutral"]["payback_months"], 4)

    def test_roi_has_three_sensitivity_scenarios(self):
        scenarios = calculate_roi({})["scenarios"]
        self.assertEqual(set(scenarios), {"conservative", "neutral", "optimistic"})
        self.assertLess(scenarios["conservative"]["annual_benefit"], scenarios["optimistic"]["annual_benefit"])

    def test_mhi_uses_only_available_k_anonymous_averages(self):
        self.assertEqual(calculate_mhi_from_averages({"phq4_average": 0, "pss4_average": 0, "mind3_average": 9}), 100)
        self.assertIsNone(calculate_mhi_from_averages({}))

    def test_kpis_suppress_small_subgroups(self):
        result = calculate_kpis({"metrics": {
            "sleep": {"sample_size": 4, "green": 4},
            "pain": {"sample_size": 5, "green": 4, "orange": 1},
            "assessments": {"overwork_count": 3, "overwork_high_risk": None},
        }})
        self.assertIsNone(result["sleep_good_rate"])
        self.assertEqual(result["pain_mild_rate"], 80)
        self.assertIsNone(result["overwork_high_risk_rate"])

    def test_plan888_uses_three_independent_denominators(self):
        result = calculate_plan888(
            {"sample_size": 10},
            {"sample_size": 5, "metrics": {"bp_filled": 5, "glucose_filled": 4, "ldl_filled": 3, "bp_controlled": 4, "glucose_controlled": 3, "ldl_controlled": 2}},
            8,
        )
        self.assertEqual(result["three_80"], {"early_detection": 100, "lifestyle_counseling": 80, "effective_control": 75})
        self.assertEqual(len(result["timeline"]), 8)

        suppressed = calculate_plan888({"sample_size": 10}, {"sample_size": 0, "metrics": {}}, 4)
        self.assertIsNone(suppressed["three_80"]["lifestyle_counseling"])

    def test_gri_copy_declares_verification_boundary(self):
        rows = build_gri({"sample_size": 10}, {}, {"three_80": {}}, calculate_roi({}))
        self.assertEqual(rows[0]["standard"], "GRI 403-6")
        self.assertIn("不是第三方確信", rows[-1]["content"])

    def test_prompt_prohibits_invention_and_personal_inference(self):
        prompt = build_report_prompt("kpi", "測試報告", {"value": None})
        self.assertIn("不得臆測個人", prompt)
        self.assertIn("不可補值", prompt)
        self.assertIn('"value":null', prompt)

    def test_directory_search_rejects_postgrest_control_characters(self):
        self.assertEqual(_safe_directory_search("台北 企業-01"), "台北 企業-01")
        for value in ("name,or(true)", "ACME.*", ""):
            with self.assertRaises(HTTPException):
                _safe_directory_search(value)

    def test_strategy_groups_region_partner_and_revenue(self):
        result = calculate_strategy([
            {"org_code": "A", "status": "active", "member_limit": 10, "used_count": 7, "a_layer_fee": 100, "partner_code": "P1", "source_payload": {"region": "北區"}},
            {"org_code": "B", "status": "inactive", "member_limit": 20, "used_count": 8, "b_layer_fee": 200, "source_payload": {"city": "高雄"}},
        ], [{"org_code": "D1"}])
        self.assertEqual(result["contracted_revenue"], 300)
        self.assertEqual(result["by_region"], {"北區": 1, "高雄": 1})
        self.assertEqual(result["by_partner"]["P1"]["enterprise_count"], 1)
        self.assertEqual(result["active_enterprise_count"], 1)

    def test_nps_due_at_month_three_and_twelve(self):
        today = date(2026, 8, 12)
        self.assertTrue(_nps_due("2026-05-31", today))
        self.assertTrue(_nps_due("2025-08-01", today))
        self.assertFalse(_nps_due("2026-04-01", today))
        self.assertFalse(_nps_due(None, today))


if __name__ == "__main__":
    unittest.main()
