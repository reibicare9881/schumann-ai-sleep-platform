import base64
import unittest

from fastapi import HTTPException

from reibi_batch_f import (
    RemittanceOcrRequest,
    analyze_remittance_document,
    decode_receipt,
    parse_department_csv,
)


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


if __name__ == "__main__":
    unittest.main()
