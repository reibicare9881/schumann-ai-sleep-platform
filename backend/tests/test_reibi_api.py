import unittest

from fastapi.testclient import TestClient

import main
from auth import create_access_token, require_reibi_manager


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


if __name__ == "__main__":
    unittest.main()
