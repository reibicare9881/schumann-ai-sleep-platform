import unittest

from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import ValidationError

import auth
from auth import create_access_token, get_current_user
from reibi_batch_g import InternalLoginRequest, _fingerprint


class ReibiBatchGTests(unittest.TestCase):
    def setUp(self):
        self.previous_validator = auth._reibi_super_session_validator

    def tearDown(self):
        auth._reibi_super_session_validator = self.previous_validator

    def test_internal_login_accepts_only_six_digit_totp(self):
        payload = InternalLoginRequest(email="operator@example.com", password="strong-password", totp_code="123456")
        self.assertEqual(payload.totp_code, "123456")
        with self.assertRaises(ValidationError):
            InternalLoginRequest(email="operator@example.com", password="strong-password", totp_code="12ab56")

    def test_reibi_super_token_requires_active_server_session(self):
        token = create_access_token({"uid": "user-1", "role": "reibi_super", "jti": "session-1"})
        credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)

        auth.configure_reibi_super_session_validator(lambda _: False)
        with self.assertRaises(HTTPException) as rejected:
            get_current_user(credentials)
        self.assertEqual(rejected.exception.status_code, 401)

        auth.configure_reibi_super_session_validator(lambda payload: payload["jti"] == "session-1")
        self.assertEqual(get_current_user(credentials)["role"], "reibi_super")

    def test_login_audit_fingerprint_is_keyed_and_does_not_store_plaintext(self):
        first = _fingerprint("operator@example.com")
        second = _fingerprint("operator@example.com")
        self.assertEqual(first, second)
        self.assertNotIn("operator", first or "")
        self.assertEqual(len(first or ""), 64)


if __name__ == "__main__":
    unittest.main()
