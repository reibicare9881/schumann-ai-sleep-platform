import unittest

from reibi_api import (
    ArtifactExport,
    _artifact_enterprise,
    _artifact_subscription,
    _dynamic_import_values,
    plan_artifact_import,
)


class ReibiArtifactImportTests(unittest.TestCase):
    def test_parses_stringified_storage_and_maps_known_keys(self):
        export = ArtifactExport(
            source_artifact="l5",
            source_version="v2.14",
            entries=[{
                "storage_key": "l5_enterprises",
                "value": '[{"id":"CASE_1","orgCode":"acme","orgName":"ACME","memberCount":"20"}]',
            }],
        )
        plan = plan_artifact_import(export)

        self.assertEqual(plan["record_count"], 1)
        self.assertEqual(plan["target_counts"], {"reibi_enterprises": 1})
        self.assertEqual(plan["records"][0]["source_record_id"], "CASE_1")

    def test_skips_credentials_and_does_not_stage_pin(self):
        export = ArtifactExport(
            source_artifact="main",
            entries=[
                {"storage_key": "pin_ACME", "value": "secret-hash"},
                {"storage_key": "subs", "value": [{"id": "S1", "activationCode": "SECRET", "plan": "monthly"}]},
            ],
        )
        plan = plan_artifact_import(export)

        self.assertEqual(plan["skipped_count"], 1)
        self.assertEqual(plan["record_count"], 1)
        self.assertNotIn("activationCode", plan["records"][0]["raw_payload"])

    def test_duplicate_source_ids_are_disambiguated(self):
        export = ArtifactExport(
            source_artifact="quote",
            entries=[{"storage_key": "rq_quotes", "value": [{"id": "DUP"}, {"id": "DUP"}]}],
        )
        plan = plan_artifact_import(export)

        ids = [record["source_record_id"] for record in plan["records"]]
        self.assertEqual(ids, ["DUP", "DUP#1"])

    def test_enterprise_transform_removes_credentials(self):
        payload = _artifact_enterprise({
            "id": "CASE_1",
            "orgCode": "abc",
            "orgName": "測試企業",
            "memberCount": "10",
            "initPin": "123456",
            "backupCode": "BACKUP",
        })

        self.assertEqual(payload["org_code"], "ABC")
        self.assertEqual(payload["member_limit"], 10)
        self.assertNotIn("initPin", payload["source_payload"])
        self.assertNotIn("backupCode", payload["source_payload"])

    def test_subscription_requires_reissued_activation_code(self):
        payload = _artifact_subscription({
            "memberCode": "abc123",
            "plan": "monthly",
            "status": "active",
            "activationCode": "OLD-CODE",
            "requestedAt": "2026-07-01T08:00:00+08:00",
        })

        self.assertEqual(payload["member_code"], "ABC123")
        self.assertIsNone(payload["activation_code"])
        self.assertNotIn("activationCode", payload["source_payload"])

    def test_historical_ai_content_is_not_falsely_labeled_gemini(self):
        resolved = _dynamic_import_values("rpts", {
            "id": "R1",
            "ts": "2026-07-01T08:00:00+08:00",
            "sScore": 12,
            "pScore": 8,
            "recs": {"generalHealth": "歷史建議"},
        })

        self.assertIsNotNone(resolved)
        table, payload, _ = resolved
        self.assertEqual(table, "reibi_health_assessments")
        self.assertIsNone(payload["ai_provider"])
        self.assertEqual(payload["recommendations"]["generalHealth"], "歷史建議")

    def test_aggregate_keeps_sample_size_for_k_anonymity_check(self):
        resolved = _dynamic_import_values("l5_mhi_agg_ACME", {
            "orgCode": "ACME",
            "n": 4,
            "sleepAvg": 70,
            "updatedAt": "2026-07-01T08:00:00+08:00",
        })

        self.assertIsNotNone(resolved)
        _, payload, _ = resolved
        self.assertEqual(payload["sample_size"], 4)


if __name__ == "__main__":
    unittest.main()
