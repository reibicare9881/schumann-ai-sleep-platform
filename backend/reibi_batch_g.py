"""REIBI Batch G trusted internal authentication and revocable sessions."""

from __future__ import annotations

import hashlib
import hmac
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field
from supabase import Client, create_client

from auth import ACCESS_TOKEN_EXPIRE_MINUTES, create_access_token, get_current_user
from config import settings


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class InternalLoginRequest(StrictModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=8, max_length=1024)
    totp_code: str | None = Field(default=None, pattern=r"^\d{6}$")


def _execute(query: Any, action: str) -> list[dict[str, Any]]:
    try:
        return query.execute().data or []
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Supabase {action}失敗") from exc


def _fingerprint(value: str | None) -> str | None:
    if not value:
        return None
    return hmac.new(
        settings.jwt_secret_key.encode("utf-8"),
        value.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def _user_value(user: Any, key: str) -> Any:
    if user is None:
        return None
    if isinstance(user, dict):
        return user.get(key)
    return getattr(user, key, None)


def create_internal_session_validator(client: Client):
    """Return the callback used by auth.py for every reibi_super request."""

    def validate(payload: dict[str, Any]) -> bool:
        session_id = str(payload.get("jti") or "")
        auth_user_id = str(payload.get("auth_user_id") or payload.get("uid") or "")
        if not session_id or not auth_user_id:
            return False
        rows = _execute(
            client.table("reibi_internal_sessions")
            .select("id,expires_at,revoked_at,reibi_internal_users!inner(is_active,internal_role)")
            .eq("id", session_id)
            .eq("auth_user_id", auth_user_id)
            .is_("revoked_at", "null")
            .gt("expires_at", datetime.now(timezone.utc).isoformat())
            .limit(1),
            "驗證內部工作階段",
        )
        if not rows:
            return False
        internal_user = rows[0].get("reibi_internal_users") or {}
        return bool(internal_user.get("is_active") and internal_user.get("internal_role") == "reibi_super")

    return validate


def create_reibi_batch_g_router(client: Client) -> APIRouter:
    router = APIRouter(prefix="/api/auth", tags=["REIBI Batch G"])

    def audit_login(email_hash: str, ip_hash: str | None, succeeded: bool, failure_code: str | None, auth_user_id: str | None = None) -> None:
        _execute(
            client.table("reibi_internal_login_audit").insert({
                "email_hash": email_hash,
                "ip_hash": ip_hash,
                "succeeded": succeeded,
                "failure_code": failure_code,
                "auth_user_id": auth_user_id,
            }),
            "記錄內部登入稽核",
        )

    @router.post("/internal/login")
    def internal_login(payload: InternalLoginRequest, request: Request):
        email = payload.email.casefold()
        if "@" not in email:
            raise HTTPException(status_code=422, detail="Email 格式不正確")

        email_hash = _fingerprint(email) or ""
        ip_hash = _fingerprint(request.client.host if request.client else None)
        cutoff = (datetime.now(timezone.utc) - timedelta(minutes=10)).isoformat()
        failures = _execute(
            client.table("reibi_internal_login_audit")
            .select("id")
            .eq("email_hash", email_hash)
            .eq("succeeded", False)
            .gte("created_at", cutoff)
            .limit(5),
            "檢查登入頻率",
        )
        if len(failures) >= 5:
            raise HTTPException(status_code=429, detail="登入嘗試過多，請 10 分鐘後再試")

        auth_client = create_client(settings.supabase_url, settings.supabase_service_role_key)
        try:
            auth_response = auth_client.auth.sign_in_with_password({"email": email, "password": payload.password})
        except Exception as exc:
            audit_login(email_hash, ip_hash, False, "invalid_credentials")
            raise HTTPException(status_code=401, detail="Email、密碼或內部帳號權限不正確") from exc

        user = auth_response.user
        auth_session = auth_response.session
        auth_user_id = str(_user_value(user, "id") or "")
        confirmed_at = _user_value(user, "email_confirmed_at") or _user_value(user, "confirmed_at")
        allowlisted = _execute(
            client.table("reibi_internal_users")
            .select("auth_user_id,email,display_name,internal_role,is_active,mfa_required")
            .eq("auth_user_id", auth_user_id)
            .eq("email", email)
            .limit(1),
            "查核內部帳號白名單",
        )
        account = allowlisted[0] if allowlisted else None

        access_token = getattr(auth_session, "access_token", None) if auth_session else None
        auth_claims: dict[str, Any] = {}
        if access_token:
            auth_claims = jwt.decode(access_token, options={"verify_signature": False, "verify_aud": False})
        aal = auth_claims.get("aal", "aal1")

        failure_code = None
        if not confirmed_at:
            failure_code = "email_unverified"
        elif not account or not account.get("is_active") or account.get("internal_role") != "reibi_super":
            failure_code = "not_allowlisted"
        elif account.get("mfa_required") and aal != "aal2":
            try:
                factors = auth_client.auth.mfa.list_factors()
                verified_totp = [factor for factor in factors.totp if factor.status == "verified"]
                if not verified_totp:
                    failure_code = "mfa_not_enrolled"
                elif not payload.totp_code:
                    failure_code = "mfa_code_required"
                else:
                    verified = auth_client.auth.mfa.challenge_and_verify({
                        "factor_id": verified_totp[0].id,
                        "code": payload.totp_code,
                    })
                    verified_token = getattr(getattr(verified, "session", None), "access_token", None)
                    if verified_token:
                        auth_claims = jwt.decode(verified_token, options={"verify_signature": False, "verify_aud": False})
                        aal = auth_claims.get("aal", "aal1")
                    if aal != "aal2":
                        failure_code = "mfa_verification_failed"
            except Exception:
                failure_code = "mfa_verification_failed"

        if failure_code:
            audit_login(email_hash, ip_hash, False, failure_code, auth_user_id if account else None)
            try:
                auth_client.auth.sign_out()
            except Exception:
                pass
            if failure_code == "mfa_code_required":
                raise HTTPException(status_code=403, detail="此內部帳號要求 Supabase MFA（AAL2）；請輸入六位數驗證碼")
            if failure_code == "mfa_not_enrolled":
                raise HTTPException(status_code=403, detail="此內部帳號尚未完成 Supabase TOTP 設定，已拒絕登入")
            if failure_code == "mfa_verification_failed":
                raise HTTPException(status_code=401, detail="MFA 驗證碼不正確或已失效")
            raise HTTPException(status_code=401, detail="Email、密碼或內部帳號權限不正確")

        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        application_session_id = str(uuid.uuid4())
        _execute(
            client.table("reibi_internal_sessions").insert({
                "id": application_session_id,
                "auth_user_id": auth_user_id,
                "supabase_session_id": auth_claims.get("session_id"),
                "issued_at": now.isoformat(),
                "expires_at": expires_at.isoformat(),
                "user_agent_hash": _fingerprint(request.headers.get("user-agent")),
                "ip_hash": ip_hash,
            }),
            "建立內部工作階段",
        )
        audit_login(email_hash, ip_hash, True, None, auth_user_id)

        # The browser receives only the short-lived application JWT, never the
        # Supabase access token or refresh token.
        try:
            auth_client.auth.sign_out()
        except Exception:
            pass

        token = create_access_token({
            "uid": auth_user_id,
            "auth_user_id": auth_user_id,
            "name": account["display_name"],
            "role": "reibi_super",
            "platform": "sleep",
            "jti": application_session_id,
            "aal": aal,
        })
        return {
            "status": "success",
            "platform": "sleep",
            "session": {
                "session_id": application_session_id,
                "user_id": auth_user_id,
                "name": account["display_name"],
                "role": "reibi_super",
            },
            "access_token": token,
            "expires_at": expires_at.isoformat(),
        }

    @router.post("/logout")
    def logout(current_user: dict = Depends(get_current_user)):
        if current_user.get("role") == "reibi_super" and current_user.get("jti"):
            _execute(
                client.table("reibi_internal_sessions").update({
                    "revoked_at": datetime.now(timezone.utc).isoformat(),
                    "revoked_reason": "user_logout",
                }).eq("id", current_user["jti"]).is_("revoked_at", "null"),
                "撤銷內部工作階段",
            )
        return {"status": "success"}

    return router
