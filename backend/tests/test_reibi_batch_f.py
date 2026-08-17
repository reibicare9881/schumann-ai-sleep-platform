import base64
import unittest
from types import SimpleNamespace

from fastapi import HTTPException

from reibi_batch_f import (
    RemittanceOcrRequest,
    analyze_remittance_document,
    decode_receipt,
    parse_department_csv,
    resolve_ticket_enterprise,
    scope_ticket_query,
    service_scope_enterprises,
)


class FakeQuery:
    def __init__(self, rows):
        self.rows = list(rows)

    def select(self, *_args, **_kwargs): return self
    def eq(self, key, value):
        self.rows = [row for row in self.rows if row.get(key) == value]
        return self
    def in_(self, key, values):
        self.rows = [row for row in self.rows if row.get(key) in values]
        return self
    def order(self, *_args, **_kwargs): return self
    def limit(self, value):
        self.rows = self.rows[:value]
        return self
    def execute(self): return SimpleNamespace(data=self.rows)


class FakeClient:
    def __init__(self, tables): self.tables = tables
    def table(self, name): return FakeQuery(self.tables.get(name, []))


class ReibiBatchFTests(unittest.TestCase):
    def test_department_csv_preflight_accepts_four_level_tree(self):
        result = parse_department_csv(
            "部門名稱,層級(1-4),上層部門名稱,人數\n"
            "總公司,1,,10\n人資部,2,總公司,5\n薪酬組,3,人資部,3\n北區小組,4,薪酬組,2\n"
        )
        self.assertTrue(result["valid"])
        self.assertEqual(result["declared_total"], 20)
        self.assertEqual(result["rows"][-1]["level"], 4)

    def test_department_csv_rejects_missing_parent_and_duplicates(self):
        result = parse_department_csv(
            "部門名稱,層級(1-4),上層部門名稱,人數\n"
            "總公司,1,,0\n人資部,2,不存在,1\n人資部,2,總公司,1\n"
        )
        self.assertFalse(result["valid"])
        self.assertTrue(any("重複" in item for item in result["errors"]))
        self.assertTrue(any("不存在" in item for item in result["errors"]))

    def test_receipt_validation_rejects_unknown_mime_and_oversize(self):
        with self.assertRaises(HTTPException):
            decode_receipt(RemittanceOcrRequest(remittance_id=1, mime_type="text/plain", data_base64="dGVzdA=="))

    def test_gemini_ocr_parser_keeps_nulls_and_confidence(self):
        result = analyze_remittance_document(
            b"image", "image/png",
            generator=lambda _data, _mime: '{"remitted_on":null,"amount":1200,"account_name":null,"account_tail":"1234","bank_name":"測試銀行","confidence":0.75,"warnings":["日期不清"]}',
        )
        self.assertIsNone(result["remitted_on"])
        self.assertEqual(result["amount"], 1200)
        self.assertEqual(result["confidence"], 0.75)

    def test_receipt_base64_decoding_is_strict(self):
        payload = RemittanceOcrRequest(remittance_id=1, mime_type="image/png", data_base64=base64.b64encode(b"png").decode())
        self.assertEqual(decode_receipt(payload), b"png")
        with self.assertRaises(HTTPException):
            decode_receipt(RemittanceOcrRequest(remittance_id=1, mime_type="image/png", data_base64="%%%bad"))

    def test_primary_partner_service_scope_includes_direct_children_only(self):
        client = FakeClient({
            "reibi_distributors": [
                {"id": 10, "org_code": "P-01", "parent_id": None},
                {"id": 11, "org_code": "P-01-SUB", "parent_id": 10},
                {"id": 12, "org_code": "P-OTHER", "parent_id": None},
            ],
            "reibi_enterprises": [
                {"id": 1, "org_code": "ORG-1", "partner_code": "P-01"},
                {"id": 2, "org_code": "ORG-2", "partner_code": "P-01-SUB"},
                {"id": 3, "org_code": "ORG-3", "partner_code": "P-OTHER"},
            ],
        })
        user = {"role": "partner_primary", "partner_org_code": "p-01"}
        enterprises, codes = service_scope_enterprises(client, user)
        self.assertEqual(codes, ["P-01", "P-01-SUB"])
        self.assertEqual({row["id"] for row in enterprises}, {1, 2})
        self.assertEqual(resolve_ticket_enterprise(client, user, 2)["org_code"], "ORG-2")
        with self.assertRaises(HTTPException) as caught:
            resolve_ticket_enterprise(client, user, 3)
        self.assertEqual(caught.exception.status_code, 403)

    def test_sub_partner_ticket_query_excludes_other_enterprises(self):
        client = FakeClient({
            "reibi_distributors": [{"id": 11, "org_code": "P-01-SUB", "parent_id": 10}],
            "reibi_enterprises": [
                {"id": 2, "partner_code": "P-01-SUB"},
                {"id": 3, "partner_code": "P-OTHER"},
            ],
        })
        query = scope_ticket_query(
            client,
            FakeQuery([{"id": 20, "enterprise_id": 2}, {"id": 30, "enterprise_id": 3}]),
            {"role": "partner_sub", "partner_org_code": "P-01-SUB"},
        )
        self.assertEqual([row["id"] for row in query.execute().data], [20])

    def test_service_manager_has_global_ticket_scope(self):
        query = FakeQuery([{"id": 1}, {"id": 2}])
        scoped = scope_ticket_query(FakeClient({}), query, {"role": "reibi_cs"})
        self.assertIs(scoped, query)


if __name__ == "__main__":
    unittest.main()
