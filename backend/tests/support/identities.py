"""Token and trusted-session factories covering all 14 application roles.

``roles.ROLE_DEFINITIONS`` is the backend authority, so scope claims are derived
from it rather than hand-listed here: a role that later gains ``requires_org``
automatically gets an ``org_code`` in its test token, and a role that loses it
automatically stops sending one.  That keeps the permission matrix honest when
the registry changes.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any

import jwt

from auth import ALGORITHM, create_access_token
from config import settings
from roles import ALL_ROLES, ROLE_DEFINITIONS, TRUSTED_EXCLUSIVE_ROLES

# Two disjoint tenants so every cross-tenant assertion has somewhere to point.
PRIMARY_ORG_CODE = "TESTORG"
OTHER_ORG_CODE = "OTHERORG"
PRIMARY_ORG_ID = 9001
OTHER_ORG_ID = 9002
PRIMARY_DEPARTMENT_ID = 9101
OTHER_DEPARTMENT_ID = 9102
# Department scope is matched on the department *name*: both login paths sign a
# "dept" claim (main.py token_payload, reibi_batch_g session) and the Batch D/E
# routers compare against it, not against department_id.
PRIMARY_DEPARTMENT_NAME = "測試部門"
OTHER_DEPARTMENT_NAME = "其他部門"
PRIMARY_DISTRIBUTOR_ID = 9201
CHILD_DISTRIBUTOR_ID = 9202
OTHER_DISTRIBUTOR_ID = 9203
PRIMARY_PARTNER_CODE = "TP-01"
CHILD_PARTNER_CODE = "TP-01-SUB"
OTHER_PARTNER_CODE = "TP-OTHER"

_NAMESPACE = uuid.UUID("11111111-2222-3333-4444-555555555555")


def uid_for(role: str, suffix: str = "") -> str:
    """Deterministic uid so seeded rows and tokens agree without bookkeeping."""
    return str(uuid.uuid5(_NAMESPACE, f"{role}|{suffix}"))


@dataclass
class TrustedSession:
    jti: str
    auth_user_id: str
    role: str
    expires_at: datetime
    revoked: bool = False
    is_active: bool = True


@dataclass
class TrustedSessionRegistry:
    """In-memory replacement for ``reibi_internal_sessions`` lookups.

    Mirrors the production validator's checks so tests can exercise revocation,
    deactivation and role rebinding without a database.
    """

    sessions: dict[str, TrustedSession] = field(default_factory=dict)

    def register(self, *, jti: str, auth_user_id: str, role: str, ttl_minutes: int = 30) -> TrustedSession:
        session = TrustedSession(
            jti=jti,
            auth_user_id=auth_user_id,
            role=role,
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=ttl_minutes),
        )
        self.sessions[jti] = session
        return session

    def revoke(self, jti: str) -> None:
        if jti in self.sessions:
            self.sessions[jti].revoked = True

    def deactivate(self, jti: str) -> None:
        if jti in self.sessions:
            self.sessions[jti].is_active = False

    def expire(self, jti: str) -> None:
        if jti in self.sessions:
            self.sessions[jti].expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)

    def clear(self) -> None:
        self.sessions.clear()

    def validate(self, payload: dict[str, Any]) -> bool:
        jti = str(payload.get("jti") or "")
        role = str(payload.get("role") or "")
        auth_user_id = str(payload.get("auth_user_id") or payload.get("uid") or "")
        session = self.sessions.get(jti)
        if session is None or role not in ALL_ROLES:
            return False
        if session.revoked or not session.is_active:
            return False
        if session.expires_at <= datetime.now(timezone.utc):
            return False
        return session.role == role and session.auth_user_id == auth_user_id


class TokenFactory:
    """Builds valid and deliberately invalid bearer tokens for any role."""

    def __init__(self, registry: TrustedSessionRegistry):
        self.registry = registry

    # ---- claim construction --------------------------------------------
    def claims(self, role: str, *, tenant: str = "primary", **overrides: Any) -> dict[str, Any]:
        definition = ROLE_DEFINITIONS.get(role)
        if definition is None:
            raise KeyError(f"unknown role: {role}")

        is_other = tenant == "other"
        payload: dict[str, Any] = {
            "uid": uid_for(role, tenant),
            "auth_user_id": uid_for(role, tenant),
            "name": f"測試{definition.label}",
            "role": role,
        }
        if definition.requires_org:
            payload["org_code"] = OTHER_ORG_CODE if is_other else PRIMARY_ORG_CODE
            payload["org_id"] = OTHER_ORG_ID if is_other else PRIMARY_ORG_ID
        if definition.requires_department:
            payload["department_id"] = OTHER_DEPARTMENT_ID if is_other else PRIMARY_DEPARTMENT_ID
            payload["dept"] = OTHER_DEPARTMENT_NAME if is_other else PRIMARY_DEPARTMENT_NAME
        if definition.requires_distributor:
            payload["distributor_id"] = OTHER_DISTRIBUTOR_ID if is_other else PRIMARY_DISTRIBUTOR_ID
            payload["partner_org_code"] = OTHER_PARTNER_CODE if is_other else PRIMARY_PARTNER_CODE
        if role in TRUSTED_EXCLUSIVE_ROLES:
            payload["auth_source"] = "supabase"

        payload.update(overrides)
        return payload

    # ---- token construction --------------------------------------------
    def token(self, role: str, *, tenant: str = "primary", **overrides: Any) -> str:
        payload = self.claims(role, tenant=tenant, **overrides)
        payload.setdefault("jti", str(uuid.uuid4()))
        needs_session = (
            payload.get("auth_source") == "supabase" or payload["role"] in TRUSTED_EXCLUSIVE_ROLES
        )
        if needs_session:
            self.registry.register(
                jti=payload["jti"],
                auth_user_id=str(payload.get("auth_user_id") or payload["uid"]),
                role=payload["role"],
            )
        return create_access_token(payload)

    def header(self, role: str, *, tenant: str = "primary", **overrides: Any) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.token(role, tenant=tenant, **overrides)}"}

    # ---- deliberately invalid credentials -------------------------------
    def expired_token(self, role: str = "reibi_super") -> str:
        payload = self.claims(role)
        now = datetime.now(timezone.utc)
        payload.update(
            {
                "jti": str(uuid.uuid4()),
                "iat": now - timedelta(hours=2),
                "exp": now - timedelta(hours=1),
            }
        )
        self.registry.register(
            jti=payload["jti"], auth_user_id=str(payload["auth_user_id"]), role=role
        )
        return jwt.encode(payload, settings.jwt_secret_key, algorithm=ALGORITHM)

    def wrong_signature_token(self, role: str = "reibi_super") -> str:
        payload = self.claims(role)
        payload["jti"] = str(uuid.uuid4())
        now = datetime.now(timezone.utc)
        payload.update({"iat": now, "exp": now + timedelta(minutes=30)})
        return jwt.encode(payload, "an-entirely-different-signing-key", algorithm=ALGORITHM)

    def unregistered_session_token(self, role: str = "reibi_super") -> str:
        """A correctly signed token whose trusted session was never created."""
        payload = self.claims(role)
        payload["jti"] = str(uuid.uuid4())
        return create_access_token(payload)

    def malformed_token(self) -> str:
        return "not-a-jwt-at-all"
