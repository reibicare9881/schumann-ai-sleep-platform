import unittest

from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

import auth
from auth import create_access_token, get_current_user
from roles import (
    ALL_ROLES,
    DEPARTMENT_REQUIRED_ROLES,
    ROLE_DEFINITIONS,
    can_manage_identity,
    has_permission,
    validate_role_scope,
)


class IdentityRoleTests(unittest.TestCase):
    def setUp(self):
        self.trusted_validator = auth._trusted_session_validator
        self.compat_validator = auth._reibi_super_session_validator

    def tearDown(self):
        auth._trusted_session_validator = self.trusted_validator
        auth._reibi_super_session_validator = self.compat_validator

    def credentials(self, payload: dict) -> HTTPAuthorizationCredentials:
        return HTTPAuthorizationCredentials(scheme="Bearer", credentials=create_access_token(payload))

    def test_catalog_normalizes_all_fourteen_roles(self):
        self.assertEqual(len(ALL_ROLES), 14)
        self.assertIn("admin_hr", ALL_ROLES)
        self.assertIn("reibi_finance", ALL_ROLES)
        self.assertIn("reibi_data", ALL_ROLES)
        self.assertIn("reibi_cs", ALL_ROLES)
        self.assertIn("partner_primary", ALL_ROLES)
        self.assertNotIn("admin_reibi", ALL_ROLES)
        self.assertNotIn("super", ALL_ROLES)

    def test_original_department_required_roles_are_preserved(self):
        self.assertEqual(
            DEPARTMENT_REQUIRED_ROLES,
            {"member", "dept_head", "admin_hr", "admin_finance", "admin_it"},
        )

    def test_role_scope_validation_is_fail_closed(self):
        validate_role_scope("reibi_super", org_code=None, department_id=None, distributor_id=None)
        validate_role_scope("admin", org_code="ACME", department_id=None, distributor_id=None)
        validate_role_scope("member", org_code="ACME", department_id=1, distributor_id=None)
        with self.assertRaises(HTTPException):
            validate_role_scope("member", org_code="ACME", department_id=None, distributor_id=None)
        with self.assertRaises(HTTPException):
            validate_role_scope("partner_primary", org_code=None, department_id=None, distributor_id=None)

    def test_org_admin_cannot_escalate_or_cross_organization(self):
        actor = {"role": "admin", "org_code": "ACME"}
        self.assertTrue(can_manage_identity(actor, "member", "ACME"))
        self.assertFalse(can_manage_identity(actor, "admin", "ACME"))
        self.assertFalse(can_manage_identity(actor, "member", "OTHER"))
        self.assertFalse(can_manage_identity(actor, "reibi_super", None))

    def test_reibi_super_can_manage_every_registered_role(self):
        actor = {"role": "reibi_super"}
        self.assertTrue(all(can_manage_identity(actor, role, None) for role in ALL_ROLES))

    def test_permissions_are_server_side_and_fail_closed(self):
        self.assertTrue(has_permission({"role": "reibi_finance"}, "finance_manage"))
        self.assertFalse(has_permission({"role": "reibi_data"}, "finance_manage"))
        self.assertFalse(has_permission({"role": "unknown"}, "all"))
        self.assertTrue(has_permission({"role": "member", "permission_overrides": ["pilot"]}, "pilot"))

    def test_trusted_member_token_requires_active_server_session(self):
        auth.configure_trusted_session_validator(lambda payload: payload.get("jti") == "active")
        trusted = self.credentials({
            "uid": "user-1", "role": "member", "auth_source": "supabase", "jti": "revoked"
        })
        with self.assertRaises(HTTPException) as rejected:
            get_current_user(trusted)
        self.assertEqual(rejected.exception.status_code, 401)

        active = self.credentials({
            "uid": "user-1", "role": "member", "auth_source": "supabase", "jti": "active"
        })
        self.assertEqual(get_current_user(active)["role"], "member")

    def test_trusted_exclusive_role_cannot_use_a_legacy_token(self):
        auth.configure_trusted_session_validator(lambda _: False)
        token = self.credentials({"uid": "user-1", "role": "reibi_finance"})
        with self.assertRaises(HTTPException) as rejected:
            get_current_user(token)
        self.assertEqual(rejected.exception.status_code, 401)

    def test_legacy_member_token_remains_compatible_during_transition(self):
        auth.configure_trusted_session_validator(lambda _: False)
        token = self.credentials({"uid": "legacy-1", "role": "member"})
        self.assertEqual(get_current_user(token)["uid"], "legacy-1")

    def test_mfa_recommendation_is_defined_for_privileged_roles(self):
        self.assertTrue(ROLE_DEFINITIONS["reibi_super"].mfa_recommended)
        self.assertTrue(ROLE_DEFINITIONS["reibi_finance"].mfa_recommended)
        self.assertTrue(ROLE_DEFINITIONS["admin"].mfa_recommended)


if __name__ == "__main__":
    unittest.main()
