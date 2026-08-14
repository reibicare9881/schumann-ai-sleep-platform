import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import ValidationError

import auth
from auth import create_access_token, get_current_user
from reibi_batch_g import (
    InternalLoginRequest,
    MfaSelfEnrollRequest,
    MfaSelfVerifyRequest,
    _fingerprint,
    create_internal_session_validator,
    create_reibi_batch_g_router,
)


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

    def test_internal_session_validator_uses_auth_user_relationship(self):
        client = MagicMock()
        builder = MagicMock()
        builder.select.return_value = builder
        builder.eq.return_value = builder
        builder.is_.return_value = builder
        builder.gt.return_value = builder
        builder.limit.return_value = builder
        builder.execute.return_value = SimpleNamespace(data=[{
            "id": "session-1",
            "expires_at": "2099-01-01T00:00:00+00:00",
            "revoked_at": None,
            "identity": {"is_active": True, "internal_role": "reibi_super"},
        }])
        client.table.return_value = builder

        validate = create_internal_session_validator(client)

        self.assertTrue(validate({
            "jti": "session-1",
            "auth_user_id": "user-1",
            "role": "reibi_super",
        }))
        builder.select.assert_called_once_with(
            "id,expires_at,revoked_at,"
            "identity:reibi_internal_users!reibi_internal_sessions_auth_user_id_fkey"
            "(is_active,internal_role)"
        )

    def test_login_audit_fingerprint_is_keyed_and_does_not_store_plaintext(self):
        first = _fingerprint("operator@example.com")
        second = _fingerprint("operator@example.com")
        self.assertEqual(first, second)
        self.assertNotIn("operator", first or "")
        self.assertEqual(len(first or ""), 64)

    @staticmethod
    def _endpoint(router, path: str):
        return next(route.endpoint for route in router.routes if route.path == path)

    @staticmethod
    def _database(auth_user_id: str):
        client = MagicMock()
        builder = MagicMock()
        builder.select.return_value = builder
        builder.eq.return_value = builder
        builder.limit.return_value = builder
        builder.execute.return_value = SimpleNamespace(data=[{
            "auth_user_id": auth_user_id,
            "email": "operator@example.com",
            "is_active": True,
        }])
        client.table.return_value = builder
        client.rpc.return_value.execute.return_value = SimpleNamespace(data=[])
        return client

    def test_existing_identity_can_reuse_verified_totp_factor(self):
        auth_user_id = "74000000-0000-0000-0000-000000000001"
        client = self._database(auth_user_id)
        auth_client = MagicMock()
        auth_client.auth.sign_in_with_password.return_value = SimpleNamespace(
            user=SimpleNamespace(id=auth_user_id)
        )
        auth_client.auth.mfa.list_factors.return_value = SimpleNamespace(
            totp=[SimpleNamespace(id="factor-verified-001", status="verified")]
        )
        router = create_reibi_batch_g_router(client)
        endpoint = self._endpoint(router, "/api/auth/mfa/self/enroll")

        with patch("reibi_batch_g.create_client", return_value=auth_client):
            result = endpoint(
                MfaSelfEnrollRequest(password="strong-password"),
                {"auth_source": "supabase", "role": "reibi_super", "uid": auth_user_id},
            )

        self.assertTrue(result["data"]["already_enrolled"])
        self.assertEqual(result["data"]["factor_id"], "factor-verified-001")

    def test_self_mfa_requires_aal2_before_enabling_requirement(self):
        auth_user_id = "74000000-0000-0000-0000-000000000002"
        client = self._database(auth_user_id)
        auth_client = MagicMock()
        auth_client.auth.sign_in_with_password.return_value = SimpleNamespace(
            user=SimpleNamespace(id=auth_user_id)
        )
        aal1_token = create_access_token({"uid": auth_user_id, "role": "reibi_super", "aal": "aal1"})
        auth_client.auth.mfa.challenge_and_verify.return_value = SimpleNamespace(
            session=SimpleNamespace(access_token=aal1_token)
        )
        router = create_reibi_batch_g_router(client)
        endpoint = self._endpoint(router, "/api/auth/mfa/self/verify")

        with patch("reibi_batch_g.create_client", return_value=auth_client):
            with self.assertRaises(HTTPException) as rejected:
                endpoint(
                    MfaSelfVerifyRequest(
                        password="strong-password",
                        factor_id="factor-unverified-001",
                        code="123456",
                    ),
                    {"auth_source": "supabase", "role": "reibi_super", "uid": auth_user_id},
                )

        self.assertEqual(rejected.exception.status_code, 401)
        client.rpc.assert_not_called()

    def test_self_mfa_enables_requirement_only_after_aal2(self):
        auth_user_id = "74000000-0000-0000-0000-000000000003"
        client = self._database(auth_user_id)
        auth_client = MagicMock()
        auth_client.auth.sign_in_with_password.return_value = SimpleNamespace(
            user=SimpleNamespace(id=auth_user_id)
        )
        aal2_token = create_access_token({"uid": auth_user_id, "role": "reibi_super", "aal": "aal2"})
        auth_client.auth.mfa.challenge_and_verify.return_value = SimpleNamespace(
            session=SimpleNamespace(access_token=aal2_token)
        )
        router = create_reibi_batch_g_router(client)
        endpoint = self._endpoint(router, "/api/auth/mfa/self/verify")

        with patch("reibi_batch_g.create_client", return_value=auth_client):
            result = endpoint(
                MfaSelfVerifyRequest(
                    password="strong-password",
                    factor_id="factor-verified-003",
                    code="123456",
                ),
                {"auth_source": "supabase", "role": "reibi_super", "uid": auth_user_id},
            )

        self.assertEqual(result["data"]["aal"], "aal2")
        self.assertTrue(result["data"]["reauth_required"])
        client.rpc.assert_called_once_with("reibi_enable_mfa", {"p_target": auth_user_id})


if __name__ == "__main__":
    unittest.main()
