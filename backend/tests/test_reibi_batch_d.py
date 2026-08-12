import unittest
from datetime import date

from fastapi import HTTPException

from reibi_batch_d import (
    AssessmentWrite,
    EapResourceWrite,
    SleepDiaryWrite,
    _bmi,
    _org_code,
    calculate_mhi,
    calculate_sleep_efficiency,
    next_vital_due,
    score_assessment,
    vital_reward,
)


class ReibiBatchDTests(unittest.TestCase):
    def test_sleep_efficiency_handles_overnight_sleep(self):
        payload = SleepDiaryWrite(
            entry_date=date(2026, 8, 12), bed_time="23:00", wake_time="07:00",
            sleep_latency_minutes=20, night_awakenings=1, quality=4,
        )
        self.assertEqual(calculate_sleep_efficiency(payload), 94)

    def test_phq4_and_pss4_scoring(self):
        phq = score_assessment(AssessmentWrite(assessment_type="phq4", answers=[3, 3, 3, 3]))
        pss = score_assessment(AssessmentWrite(assessment_type="pss4", answers=[4, 4, 0, 0]))
        self.assertEqual((phq["score"], phq["level"]), (12, "red"))
        self.assertEqual((pss["score"], pss["level"]), (16, "red"))

    def test_overwork_adds_at_most_four_unique_risk_factors(self):
        result = score_assessment(AssessmentWrite(
            assessment_type="ow", answers=[1] * 8,
            risk_factors=["a", "b", "c", "d", "e", "e"],
        ))
        self.assertEqual(result["score"], 12)
        self.assertEqual(result["level"], "yellow")

    def test_bsrs_suicide_answer_triggers_emergency_guidance(self):
        result = score_assessment(AssessmentWrite(
            assessment_type="bsrs5", answers=[0] * 5, suicide_ideation=2,
        ))
        self.assertTrue(result["emergency"])
        self.assertEqual(result["level"], "red")
        self.assertIn("1925", result["recommendations"]["action"])

    def test_nmq_requires_all_parts_when_screened(self):
        with self.assertRaises(HTTPException) as raised:
            score_assessment(AssessmentWrite(
                assessment_type="msk", answers={"neck": 3}, screened=True,
            ))
        self.assertEqual(raised.exception.status_code, 422)

    def test_violence_assessment_is_flagged_without_calling_it_a_complaint(self):
        result = score_assessment(AssessmentWrite(
            assessment_type="violence",
            answers={"violence": 3, "harass": 0, "stalk": 0, "discrim": 0},
        ))
        self.assertTrue(result["flagged"])
        self.assertIn("不是正式申訴管道", result["recommendations"]["action"])

    def test_mhi_marks_partial_and_complete_inputs(self):
        partial = calculate_mhi(0, None, None)
        complete = calculate_mhi(0, 0, 9)
        self.assertFalse(partial["complete"])
        self.assertEqual(complete, {
            "score": 100, "level": "green",
            "parts": {"phq": 100, "pss": 100, "mind": 100}, "complete": True,
        })

    def test_bmi_and_org_code_validation(self):
        self.assertEqual(_bmi({"height_cm": 170, "weight_kg": 68}), 23.5)
        self.assertEqual(_org_code({"role": "admin", "org_code": "org_01"}), "ORG_01")
        with self.assertRaises(HTTPException):
            _org_code({"role": "admin", "org_code": "ORG.01"})

    def test_three_highs_reward_and_reminder_cycles(self):
        today = date(2026, 8, 12)
        self.assertEqual(vital_reward(False, "none", today), (20, "three_highs:first"))
        self.assertEqual(vital_reward(True, "borderline", today), (10, "three_highs:annual:2026"))
        self.assertEqual(vital_reward(True, "diagnosed", today), (5, "three_highs:monthly:2026-08"))
        self.assertEqual(next_vital_due("2026-08-12T00:00:00+00:00", "diagnosed"), "2026-09-11")

    def test_eap_resource_rejects_script_url(self):
        with self.assertRaises(ValueError):
            EapResourceWrite(category_code="A", title="unsafe", url="javascript:alert(1)")
        valid = EapResourceWrite(category_code="A", title="safe", url="https://example.org/help")
        self.assertEqual(valid.url, "https://example.org/help")


if __name__ == "__main__":
    unittest.main()
