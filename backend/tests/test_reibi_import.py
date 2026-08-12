import unittest
import hashlib
from datetime import date

from reibi_api import (
    ArtifactExport,
    EnterpriseWrite,
    _artifact_enterprise,
    _artifact_subscription,
    _dynamic_import_values,
    _enterprise_metrics,
    _attach_department_counts,
    _resolve_department_level,
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

    def test_versioned_export_hash_is_verified_with_javascript_number_rules(self):
        payload = {
            "schema_version": "reibi-artifact-export/1.0",
            "source_artifact": "quote",
            "source_version": "v1.13",
            "exported_at": "2026-08-12T08:00:00Z",
            "part": 1,
            "parts": 1,
            "entries": [{"storage_key": "rq_quotes", "value": [{"id": "Q1", "amount": 1.0, "name": "測試"}]}],
        }
        # This string mirrors stableExportJson() in the four Artifact files.
        canonical = '{"entries":[{"storage_key":"rq_quotes","value":[{"amount":1,"id":"Q1","name":"測試"}]}],"exported_at":"2026-08-12T08:00:00Z","part":1,"parts":1,"schema_version":"reibi-artifact-export/1.0","source_artifact":"quote","source_version":"v1.13"}'
        payload["export_sha256"] = hashlib.sha256(canonical.encode("utf-8")).hexdigest()

        plan = plan_artifact_import(ArtifactExport(**payload))

        self.assertEqual(plan["sha256"], payload["export_sha256"])

    def test_versioned_export_rejects_modified_payload(self):
        with self.assertRaisesRegex(ValueError, "SHA-256 不符"):
            plan_artifact_import(ArtifactExport(
                source_artifact="quote",
                export_sha256="0" * 64,
                entries=[{"storage_key": "rq_quotes", "value": [{"id": "Q1"}]}],
            ))

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

    def test_department_level_is_calculated_from_parent_chain(self):
        departments = [
            {"id": 1, "parent_id": None},
            {"id": 2, "parent_id": 1},
            {"id": 3, "parent_id": 2},
        ]

        self.assertEqual(_resolve_department_level(departments, None, 3), 4)

    def test_department_level_rejects_fifth_level(self):
        departments = [
            {"id": 1, "parent_id": None},
            {"id": 2, "parent_id": 1},
            {"id": 3, "parent_id": 2},
            {"id": 4, "parent_id": 3},
        ]

        with self.assertRaisesRegex(ValueError, "最多四層"):
            _resolve_department_level(departments, None, 4)

    def test_department_level_rejects_cycle(self):
        departments = [
            {"id": 1, "parent_id": None},
            {"id": 2, "parent_id": 1},
        ]

        with self.assertRaisesRegex(ValueError, "不可形成循環"):
            _resolve_department_level(departments, 1, 2)

    def test_enterprise_metrics_reports_usage_and_expiring_contract(self):
        metrics = _enterprise_metrics(
            {"member_limit": 100, "used_count": 91, "contract_end": "2026-08-30"},
            registered_member_count=92,
            as_of=date(2026, 8, 12),
        )

        self.assertEqual(metrics["usage_percent"], 91.0)
        self.assertTrue(metrics["usage_alert"])
        self.assertTrue(metrics["usage_count_outdated"])
        self.assertEqual(metrics["contract_state"], "expiring")
        self.assertEqual(metrics["contract_days_left"], 18)

    def test_enterprise_write_accepts_artifact_device_and_layer_configuration(self):
        payload = EnterpriseWrite(
            org_name="測試企業",
            member_limit=300,
            used_count=120,
            a_layer_fee=1200000,
            devices={"cloudBeds": 1, "relaxChairs": 1, "la200": 0},
            d_layer_config={"poster": True, "board": False, "digital": True},
        ).model_dump(mode="json")

        self.assertEqual(payload["devices"]["cloudBeds"], 1)
        self.assertTrue(payload["d_layer_config"]["poster"])
        self.assertEqual(payload["used_count"], 120)

        with self.assertRaises(ValueError):
            EnterpriseWrite(org_name="測試企業", devices={"cloudBeds": -1})

    def test_department_counts_include_children_without_guessing_duplicates(self):
        departments = [
            {"id": 1, "parent_id": None, "name": "營運處"},
            {"id": 2, "parent_id": 1, "name": "人資部"},
            {"id": 3, "parent_id": 1, "name": "共同名稱"},
            {"id": 4, "parent_id": None, "name": "共同名稱"},
        ]

        rows, meta = _attach_department_counts(
            departments,
            ["人資部", " 人資部 ", "共同名稱", "未知部門", None],
        )

        by_id = {row["id"]: row for row in rows}
        self.assertEqual(by_id[2]["direct_member_count"], 2)
        self.assertEqual(by_id[1]["member_count"], 2)
        self.assertEqual(by_id[3]["direct_member_count"], 0)
        self.assertEqual(meta, {
            "profile_count": 5,
            "unassigned_count": 1,
            "ambiguous_count": 1,
            "unmatched_count": 1,
        })


if __name__ == "__main__":
    unittest.main()
