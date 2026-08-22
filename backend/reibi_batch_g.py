"""Trusted Supabase Auth identities and revocable application sessions.

Batch G introduced the first REIBI super-user login.  Batch H expands the same
tables and API to all roles while keeping the old internal endpoint compatible.
"""

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
from roles import (
    ALL_ROLES,
    MFA_RECOMMENDED_ROLES,
    ORG_ROLES,
    REIBI_INTERNAL_ROLES,
    ROLE_DEFINITIONS,
    can_manage_identity,
    role_catalog,
    validate_role_scope,
)


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class AccountLoginRequest(StrictModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=8, max_length=1024)
    totp_code: str | None = Field(default=None, pattern=r"^\d{6}$")


# Backwards-compatible import used by Batch G tests and API clients.
InternalLoginRequest = AccountLoginRequest


class CompleteInviteRequest(StrictModel):
    access_token: str = Field(min_length=20, max_length=8192)
    password: str = Field(min_length=12, max_length=1024)


class RequestPasswordResetRequest(StrictModel):
    email: str = Field(min_length=3, max_length=254)


class MfaEnrollRequest(StrictModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=8, max_length=1024)


class MfaVerifyEnrollmentRequest(MfaEnrollRequest):
    factor_id: str = Field(min_length=10, max_length=200)
    code: str = Field(pattern=r"^\d{6}$")


class MfaSelfEnrollRequest(StrictModel):
    password: str = Field(min_length=8, max_length=1024)


class MfaSelfVerifyRequest(MfaSelfEnrollRequest):
    factor_id: str = Field(min_length=10, max_length=200)
    code: str = Field(pattern=r"^\d{6}$")


class AccountInviteRequest(StrictModel):
    email: str = Field(min_length=3, max_length=254)
    display_name: str = Field(min_length=1, max_length=200)
    role: str
    org_code: str | None = Field(default=None, max_length=80)
    department_id: int | None = Field(default=None, gt=0)
    staff_id: int | None = Field(default=None, gt=0)
    distributor_id: int | None = Field(default=None, gt=0)
    mfa_required: bool | None = None


class AccountUpdateRequest(StrictModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=200)
    role: str | None = None
    org_code: str | None = Field(default=None, max_length=80)
    department_id: int | None = Field(default=None, gt=0)
    staff_id: int | None = Field(default=None, gt=0)
    distributor_id: int | None = Field(default=None, gt=0)
    mfa_required: bool | None = None
    is_active: bool | None = None


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
        settings.jwt_secret_key.encode("utf-8"), value.encode("utf-8"), hashlib.sha256
    ).hexdigest()


def _user_value(user: Any, key: str) -> Any:
    if user is None:
        return None
    if isinstance(user, dict):
        return user.get(key)
    return getattr(user, key, None)


def _mfa_access_token(response: Any) -> str | None:
    """Read the upgraded JWT from current and legacy MFA response shapes."""
    direct_token = getattr(response, "access_token", None)
    if direct_token:
        return str(direct_token)
    session = getattr(response, "session", None)
    session_token = getattr(session, "access_token", None)
    return str(session_token) if session_token else None


def _normalize_email(email: str) -> str:
    normalized = email.strip().casefold()
    if "@" not in normalized or normalized.startswith("@") or normalized.endswith("@"):
        raise HTTPException(status_code=422, detail="Email 格式不正確")
    return normalized


def _identity_select() -> str:
    return (
        "auth_user_id,email,display_name,internal_role,is_active,mfa_required,"
        "profile_id,org_code,department_id,staff_id,distributor_id,permission_overrides,"
        "invited_at,last_login_at,created_at,updated_at,"
        "reibi_departments(name),reibi_distributors(org_code,distributor_type,name)"
    )


def create_internal_session_validator(client: Client):
    """Return the callback used by auth.py for every trusted session request."""

    def validate(payload: dict[str, Any]) -> bool:
        session_id = str(payload.get("jti") or "")
        auth_user_id = str(payload.get("auth_user_id") or payload.get("uid") or "")
        token_role = str(payload.get("role") or "")
        if not session_id or not auth_user_id or token_role not in ALL_ROLES:
            return False
        rows = _execute(
            client.table("reibi_internal_sessions")
            .select(
                "id,expires_at,revoked_at,"
                "identity:reibi_internal_users!reibi_internal_sessions_auth_user_id_fkey"
                "(is_active,internal_role)"
            )
            .eq("id", session_id)
            .eq("auth_user_id", auth_user_id)
            .is_("revoked_at", "null")
            .gt("expires_at", datetime.now(timezone.utc).isoformat())
            .limit(1),
            "驗證可信工作階段",
        )
        if not rows:
            return False
        identity = rows[0].get("identity") or {}
        return bool(identity.get("is_active") and identity.get("internal_role") == token_role)

    return validate


def create_reibi_batch_g_router(client: Client) -> APIRouter:
    router = APIRouter(prefix="/api/auth", tags=["Identity and access"])

    def require_identity_admin(current_user: dict = Depends(get_current_user)) -> dict:
        if (
            current_user.get("auth_source") != "supabase"
            or current_user.get("role") not in {"reibi_super", "admin"}
        ):
            raise HTTPException(status_code=403, detail="此帳號沒有可信身分管理權限")
        return current_user

    def require_trusted_identity(current_user: dict = Depends(get_current_user)) -> dict:
        if current_user.get("auth_source") != "supabase" or current_user.get("role") not in ALL_ROLES:
            raise HTTPException(status_code=403, detail="此帳號不是可信 Supabase 身分")
        return current_user

    def audit_login(
        email_hash: str,
        ip_hash: str | None,
        succeeded: bool,
        failure_code: str | None,
        auth_user_id: str | None = None,
    ) -> None:
        _execute(
            client.table("reibi_internal_login_audit").insert({
                "email_hash": email_hash,
                "ip_hash": ip_hash,
                "succeeded": succeeded,
                "failure_code": failure_code,
                "auth_user_id": auth_user_id,
            }),
            "記錄登入稽核",
        )

    def audit_identity(actor_id: str | None, target_id: str | None, action: str, changes: dict) -> None:
        _execute(
            client.table("reibi_identity_audit").insert({
                "actor_auth_user_id": actor_id,
                "target_auth_user_id": target_id,
                "action": action,
                "changes": changes,
            }),
            "記錄身分管理稽核",
        )

    def load_scope(role: str, org_code: str | None, department_id: int | None, distributor_id: int | None) -> dict:
        validate_role_scope(
            role,
            org_code=org_code,
            department_id=department_id,
            distributor_id=distributor_id,
        )
        result: dict[str, Any] = {}
        if org_code:
            enterprises = _execute(
                client.table("reibi_enterprises")
                .select("org_code,org_name,status")
                .eq("org_code", org_code)
                .limit(1),
                "驗證企業範圍",
            )
            if not enterprises or enterprises[0].get("status") in {"inactive", "suspended", "closed"}:
                raise HTTPException(status_code=422, detail="找不到可用的企業範圍")
            # profiles.org_code still references the baseline organizations table.
            legacy_org = _execute(
                client.table("organizations").select("org_code").eq("org_code", org_code).limit(1),
                "驗證平台企業代碼",
            )
            if not legacy_org:
                raise HTTPException(status_code=409, detail="企業尚未同步至平台 organizations，無法建立帳號")
            result["org_name"] = enterprises[0].get("org_name")
        if department_id:
            departments = _execute(
                client.table("reibi_departments")
                .select("id,name,enterprise_id,reibi_enterprises!inner(org_code)")
                .eq("id", department_id)
                .eq("is_active", True)
                .limit(1),
                "驗證部門範圍",
            )
            dept = departments[0] if departments else None
            if not dept or (dept.get("reibi_enterprises") or {}).get("org_code") != org_code:
                raise HTTPException(status_code=422, detail="部門不屬於所選企業或已停用")
            result["department_name"] = dept.get("name")
        if distributor_id:
            distributors = _execute(
                client.table("reibi_distributors")
                .select("id,org_code,name,distributor_type,status")
                .eq("id", distributor_id)
                .limit(1),
                "驗證經銷商範圍",
            )
            distributor = distributors[0] if distributors else None
            expected = "primary" if role == "partner_primary" else "sub"
            if not distributor or distributor.get("status") != "active" or distributor.get("distributor_type") != expected:
                raise HTTPException(status_code=422, detail="經銷商類型與角色不符或已停用")
            result["partner_org_code"] = distributor.get("org_code")
        return result

    def trusted_login(payload: AccountLoginRequest, request: Request, *, internal_only: bool) -> dict:
        email = _normalize_email(payload.email)
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
            raise HTTPException(status_code=401, detail="Email、密碼或帳號狀態不正確") from exc

        user = auth_response.user
        auth_session = auth_response.session
        auth_user_id = str(_user_value(user, "id") or "")
        confirmed_at = _user_value(user, "email_confirmed_at") or _user_value(user, "confirmed_at")
        identities = _execute(
            client.table("reibi_internal_users")
            .select(_identity_select())
            .eq("auth_user_id", auth_user_id)
            .eq("email", email)
            .limit(1),
            "讀取可信身分",
        )
        identity = identities[0] if identities else None

        access_token = getattr(auth_session, "access_token", None) if auth_session else None
        auth_claims: dict[str, Any] = {}
        if access_token:
            auth_claims = jwt.decode(access_token, options={"verify_signature": False, "verify_aud": False})
        aal = auth_claims.get("aal", "aal1")
        failure_code = None
        if not confirmed_at:
            failure_code = "email_unverified"
        elif not identity or not identity.get("is_active"):
            failure_code = "not_allowlisted"
        elif internal_only and identity.get("internal_role") not in REIBI_INTERNAL_ROLES:
            failure_code = "not_internal_role"
        elif identity.get("mfa_required") and aal != "aal2":
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
                    verified_token = _mfa_access_token(verified)
                    if verified_token:
                        auth_claims = jwt.decode(
                            verified_token, options={"verify_signature": False, "verify_aud": False}
                        )
                        aal = auth_claims.get("aal", "aal1")
                    if aal != "aal2":
                        failure_code = "mfa_verification_failed"
            except Exception:
                failure_code = "mfa_verification_failed"

        if failure_code:
            audit_login(email_hash, ip_hash, False, failure_code, auth_user_id if identity else None)
            try:
                auth_client.auth.sign_out()
            except Exception:
                pass
            if failure_code == "mfa_code_required":
                raise HTTPException(status_code=403, detail="此帳號需要 MFA，請輸入六位驗證碼")
            if failure_code == "mfa_not_enrolled":
                raise HTTPException(status_code=403, detail="此帳號要求 MFA，但尚未完成 TOTP 設定")
            if failure_code == "mfa_verification_failed":
                raise HTTPException(status_code=401, detail="MFA 驗證失敗")
            raise HTTPException(status_code=401, detail="Email、密碼或帳號狀態不正確")

        role = str(identity["internal_role"])
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
            "建立可信工作階段",
        )
        _execute(
            client.table("reibi_internal_users")
            .update({"last_login_at": now.isoformat()})
            .eq("auth_user_id", auth_user_id),
            "更新最近登入時間",
        )
        audit_login(email_hash, ip_hash, True, None, auth_user_id)
        audit_identity(auth_user_id, auth_user_id, "login", {"role": role, "aal": aal})

        try:
            auth_client.auth.sign_out()
        except Exception:
            pass

        department = identity.get("reibi_departments") or {}
        distributor = identity.get("reibi_distributors") or {}
        token_payload = {
            "uid": auth_user_id,
            "auth_user_id": auth_user_id,
            "name": identity["display_name"],
            "role": role,
            "platform": "sleep",
            "jti": application_session_id,
            "aal": aal,
            "auth_source": "supabase",
            "org_code": identity.get("org_code"),
            "dept": department.get("name"),
            "department_id": identity.get("department_id"),
            "partner_org_code": distributor.get("org_code"),
            "distributor_id": identity.get("distributor_id"),
            "permission_overrides": identity.get("permission_overrides") or [],
        }
        token = create_access_token(token_payload)
        session = {
            "session_id": application_session_id,
            "user_id": auth_user_id,
            "name": identity["display_name"],
            "role": role,
            "org_code": identity.get("org_code"),
            "dept": department.get("name"),
            "department_id": identity.get("department_id"),
            "partner_org_code": distributor.get("org_code"),
            "distributor_id": identity.get("distributor_id"),
        }
        return {
            "status": "success",
            "platform": "sleep",
            "session": session,
            "access_token": token,
            "expires_at": expires_at.isoformat(),
        }

    def enroll_totp(email: str, password: str) -> dict[str, Any]:
        normalized = _normalize_email(email)
        identity_rows = _execute(
            client.table("reibi_internal_users")
            .select("auth_user_id,email,is_active")
            .eq("email", normalized)
            .eq("is_active", True)
            .limit(1),
            "驗證 MFA 設定帳號",
        )
        if not identity_rows:
            raise HTTPException(status_code=401, detail="Email、密碼或帳號狀態不正確")
        auth_client = create_client(settings.supabase_url, settings.supabase_service_role_key)
        try:
            response = auth_client.auth.sign_in_with_password({"email": normalized, "password": password})
            if str(_user_value(response.user, "id") or "") != identity_rows[0]["auth_user_id"]:
                raise ValueError("identity mismatch")
            factors = auth_client.auth.mfa.list_factors()
            verified = [factor for factor in factors.totp if factor.status == "verified"]
            if verified:
                return {"already_enrolled": True, "factor_id": verified[0].id}
            enrollment = auth_client.auth.mfa.enroll({
                "factor_type": "totp",
                "friendly_name": "SleepM / REIBI",
            })
            totp = enrollment.totp
            if not totp:
                raise ValueError("missing TOTP payload")
            return {
                "already_enrolled": False,
                "factor_id": enrollment.id,
                "qr_code": totp.qr_code,
                "secret": totp.secret,
                "uri": totp.uri,
            }
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=401, detail="Email、密碼或帳號狀態不正確") from exc
        finally:
            try:
                auth_client.auth.sign_out()
            except Exception:
                pass

    def verify_totp_and_enable(
        email: str,
        password: str,
        factor_id: str,
        code: str,
        *,
        expected_user_id: str | None = None,
    ) -> dict[str, Any]:
        normalized = _normalize_email(email)
        auth_client = create_client(settings.supabase_url, settings.supabase_service_role_key)
        try:
            response = auth_client.auth.sign_in_with_password({"email": normalized, "password": password})
            user_id = str(_user_value(response.user, "id") or "")
            if expected_user_id and user_id != expected_user_id:
                raise HTTPException(status_code=401, detail="Email、密碼或帳號狀態不正確")
            rows = _execute(
                client.table("reibi_internal_users")
                .select("auth_user_id,is_active")
                .eq("auth_user_id", user_id)
                .eq("email", normalized)
                .eq("is_active", True)
                .limit(1),
                "驗證 MFA 帳號",
            )
            if not rows:
                raise HTTPException(status_code=401, detail="Email、密碼或帳號狀態不正確")
            verified = auth_client.auth.mfa.challenge_and_verify({
                "factor_id": factor_id,
                "code": code,
            })
            verified_token = _mfa_access_token(verified)
            verified_claims = (
                jwt.decode(verified_token, options={"verify_signature": False, "verify_aud": False})
                if verified_token
                else {}
            )
            if verified_claims.get("aal") != "aal2":
                raise HTTPException(status_code=401, detail="MFA 驗證未達 AAL2")
            _execute(
                client.rpc("reibi_enable_mfa", {"p_target": user_id}),
                "啟用 MFA 並撤銷舊工作階段",
            )
            return {
                "status": "success",
                "message": "MFA 設定完成，請重新登入",
                "data": {"mfa_required": True, "aal": "aal2", "reauth_required": True},
            }
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=401, detail="MFA 驗證碼不正確或已失效") from exc
        finally:
            try:
                auth_client.auth.sign_out()
            except Exception:
                pass

    @router.get("/roles")
    def roles():
        return {"status": "success", "data": {"roles": role_catalog()}}

    @router.post("/account/login")
    def account_login(payload: AccountLoginRequest, request: Request):
        return trusted_login(payload, request, internal_only=False)

    @router.post("/internal/login")
    def internal_login(payload: AccountLoginRequest, request: Request):
        return trusted_login(payload, request, internal_only=True)

    @router.post("/complete-invite")
    def complete_invite(payload: CompleteInviteRequest):
        auth_client = create_client(settings.supabase_url, settings.supabase_service_role_key)
        try:
            user_response = auth_client.auth.get_user(payload.access_token)
            user = getattr(user_response, "user", None)
            user_id = str(_user_value(user, "id") or "")
            if not user_id:
                raise ValueError("missing user")
            rows = _execute(
                client.table("reibi_internal_users")
                .select("auth_user_id,email,is_active,mfa_required")
                .eq("auth_user_id", user_id)
                .eq("is_active", True)
                .limit(1),
                "驗證受邀帳號",
            )
            if not rows:
                raise HTTPException(status_code=403, detail="邀請不存在或帳號已停用")
            auth_client.auth.admin.update_user_by_id(user_id, {"password": payload.password})
            mfa_setup = enroll_totp(rows[0]["email"], payload.password) if rows[0].get("mfa_required") else None
            return {
                "status": "success",
                "message": "密碼設定完成" if mfa_setup else "密碼設定完成，請返回登入頁",
                "data": {"email": rows[0]["email"], "mfa_setup": mfa_setup},
            }
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=401, detail="邀請連結無效或已過期") from exc

    @router.post("/request-password-reset")
    def request_password_reset(payload: RequestPasswordResetRequest):
        email = payload.email.strip().lower()
        rows = _execute(
            client.table("reibi_internal_users")
            .select("auth_user_id")
            .eq("email", email)
            .eq("is_active", True)
            .limit(1),
            "檢查可信帳號",
        )
        if rows:
            auth_client = create_client(settings.supabase_url, settings.supabase_service_role_key)
            try:
                auth_client.auth.reset_password_for_email(
                    email,
                    {"redirect_to": f"{settings.frontend_url.rstrip('/')}/auth/complete"},
                )
            except Exception:
                pass
        # 不論帳號是否存在都回傳相同訊息，避免被用來枚舉已註冊信箱。
        return {"status": "success", "message": "如果這個信箱有對應的可信帳號，重設密碼信已寄出"}

    @router.post("/mfa/enroll")
    def enroll_mfa(payload: MfaEnrollRequest):
        return {"status": "success", "data": enroll_totp(payload.email, payload.password)}

    @router.post("/mfa/self/enroll")
    def enroll_self_mfa(
        payload: MfaSelfEnrollRequest,
        current_user: dict = Depends(require_trusted_identity),
    ):
        auth_user_id = str(current_user.get("auth_user_id") or current_user.get("uid") or "")
        rows = _execute(
            client.table("reibi_internal_users")
            .select("auth_user_id,email,is_active")
            .eq("auth_user_id", auth_user_id)
            .eq("is_active", True)
            .limit(1),
            "讀取 MFA 設定帳號",
        )
        if not rows:
            raise HTTPException(status_code=401, detail="帳號不存在或已停用")
        return {"status": "success", "data": enroll_totp(rows[0]["email"], payload.password)}

    @router.post("/mfa/verify-enrollment")
    def verify_mfa_enrollment(payload: MfaVerifyEnrollmentRequest):
        return verify_totp_and_enable(
            payload.email,
            payload.password,
            payload.factor_id,
            payload.code,
        )

    @router.post("/mfa/self/verify")
    def verify_self_mfa(
        payload: MfaSelfVerifyRequest,
        current_user: dict = Depends(require_trusted_identity),
    ):
        auth_user_id = str(current_user.get("auth_user_id") or current_user.get("uid") or "")
        rows = _execute(
            client.table("reibi_internal_users")
            .select("auth_user_id,email,is_active")
            .eq("auth_user_id", auth_user_id)
            .eq("is_active", True)
            .limit(1),
            "讀取 MFA 驗證帳號",
        )
        if not rows:
            raise HTTPException(status_code=401, detail="帳號不存在或已停用")
        return verify_totp_and_enable(
            rows[0]["email"],
            payload.password,
            payload.factor_id,
            payload.code,
            expected_user_id=auth_user_id,
        )

    @router.get("/accounts")
    def list_accounts(current_user: dict = Depends(require_identity_admin)):
        query = client.table("reibi_internal_users").select(_identity_select()).order("created_at", desc=True)
        if current_user.get("role") == "admin":
            query = query.eq("org_code", current_user.get("org_code"))
        return {"status": "success", "data": {"accounts": _execute(query, "讀取帳號清單")}}

    @router.get("/account-scopes")
    def account_scopes(current_user: dict = Depends(require_identity_admin)):
        enterprise_query = (
            client.table("reibi_enterprises")
            .select("org_code,org_name,status")
            .order("org_name")
        )
        department_query = (
            client.table("reibi_departments")
            .select("id,name,hierarchy_level,reibi_enterprises!inner(org_code)")
            .eq("is_active", True)
            .order("sort_order")
        )
        if current_user.get("role") == "admin":
            enterprise_query = enterprise_query.eq("org_code", current_user.get("org_code"))
            department_query = department_query.eq("reibi_enterprises.org_code", current_user.get("org_code"))
            distributors: list[dict[str, Any]] = []
        else:
            distributors = _execute(
                client.table("reibi_distributors")
                .select("id,org_code,name,distributor_type,status")
                .eq("status", "active")
                .order("name"),
                "讀取經銷商範圍",
            )
        return {
            "status": "success",
            "data": {
                "enterprises": _execute(enterprise_query, "讀取企業範圍"),
                "departments": _execute(department_query, "讀取部門範圍"),
                "distributors": distributors,
            },
        }

    @router.post("/accounts/invite", status_code=201)
    def invite_account(payload: AccountInviteRequest, current_user: dict = Depends(require_identity_admin)):
        email = _normalize_email(payload.email)
        role = payload.role
        org_code = payload.org_code.upper() if payload.org_code else None
        scope = load_scope(role, org_code, payload.department_id, payload.distributor_id)
        if not can_manage_identity(current_user, role, org_code):
            raise HTTPException(status_code=403, detail="不可建立跨範圍或高於自身權限的帳號")
        existing = _execute(
            client.table("reibi_internal_users").select("auth_user_id").eq("email", email).limit(1),
            "檢查既有帳號",
        )
        if existing:
            raise HTTPException(status_code=409, detail="此 Email 已有可信帳號")

        auth_client = create_client(settings.supabase_url, settings.supabase_service_role_key)
        try:
            invited = auth_client.auth.admin.invite_user_by_email(
                email,
                {"redirect_to": f"{settings.frontend_url.rstrip('/')}/auth/complete"},
            )
            auth_user = getattr(invited, "user", None)
            auth_user_id = str(_user_value(auth_user, "id") or "")
            if not auth_user_id:
                raise ValueError("Supabase invitation did not return a user id")
        except Exception as exc:
            raise HTTPException(status_code=502, detail="Supabase Auth 邀請寄送失敗") from exc

        needs_profile = role in ORG_ROLES or role == "individual"
        try:
            if needs_profile:
                _execute(
                    client.table("profiles").insert({
                        "id": auth_user_id,
                        "full_name": payload.display_name,
                        "system_role": role,
                        "user_type": "organization" if role in ORG_ROLES else "individual",
                        "org_code": org_code,
                        "organization_name": scope.get("org_name"),
                        "department": scope.get("department_name"),
                    }),
                    "建立平台 profile",
                )
            _execute(
                client.table("reibi_internal_users").insert({
                    "auth_user_id": auth_user_id,
                    "email": email,
                    "display_name": payload.display_name,
                    "internal_role": role,
                    "profile_id": auth_user_id if needs_profile else None,
                    "org_code": org_code,
                    "department_id": payload.department_id,
                    "staff_id": payload.staff_id,
                    "distributor_id": payload.distributor_id,
                    "mfa_required": payload.mfa_required if payload.mfa_required is not None else role in MFA_RECOMMENDED_ROLES,
                    "invited_at": datetime.now(timezone.utc).isoformat(),
                    "created_by": current_user.get("auth_user_id") or current_user.get("uid"),
                    "updated_by": current_user.get("auth_user_id") or current_user.get("uid"),
                }),
                "建立可信身分",
            )
        except Exception:
            if needs_profile:
                try:
                    client.table("profiles").delete().eq("id", auth_user_id).execute()
                except Exception:
                    pass
            try:
                auth_client.auth.admin.delete_user(auth_user_id)
            except Exception:
                pass
            raise

        audit_identity(
            current_user.get("auth_user_id") or current_user.get("uid"),
            auth_user_id,
            "invite",
            {"role": role, "org_code": org_code, "department_id": payload.department_id},
        )
        return {"status": "success", "data": {"auth_user_id": auth_user_id, "email": email}}

    @router.patch("/accounts/{auth_user_id}")
    def update_account(
        auth_user_id: str,
        payload: AccountUpdateRequest,
        current_user: dict = Depends(require_identity_admin),
    ):
        rows = _execute(
            client.table("reibi_internal_users").select(_identity_select()).eq("auth_user_id", auth_user_id).limit(1),
            "讀取目標帳號",
        )
        if not rows:
            raise HTTPException(status_code=404, detail="找不到帳號")
        current = rows[0]
        role = payload.role if payload.role is not None else current["internal_role"]
        if role not in ROLE_DEFINITIONS:
            raise HTTPException(status_code=422, detail="未知的帳號角色")
        actor_id = current_user.get("auth_user_id") or current_user.get("uid")
        if auth_user_id == actor_id and (payload.is_active is False or role != current["internal_role"]):
            raise HTTPException(status_code=409, detail="不可停用自己或變更自己的角色")
        if current["internal_role"] == "reibi_super" and (payload.is_active is False or role != "reibi_super"):
            active_supers = _execute(
                client.table("reibi_internal_users")
                .select("auth_user_id")
                .eq("internal_role", "reibi_super")
                .eq("is_active", True)
                .limit(2),
                "檢查 REIBI 超級管理者數量",
            )
            if len(active_supers) <= 1:
                raise HTTPException(status_code=409, detail="不可停用或降級最後一位 REIBI 超級管理者")
        if ROLE_DEFINITIONS[role].realm != ROLE_DEFINITIONS[current["internal_role"]].realm:
            raise HTTPException(status_code=409, detail="不可跨身分類別直接改角色；請停用舊帳號後重新邀請")
        supplied = payload.model_fields_set
        org_code = (
            payload.org_code.upper() if payload.org_code
            else None if "org_code" in supplied
            else current.get("org_code")
        )
        department_id = payload.department_id if "department_id" in supplied else current.get("department_id")
        distributor_id = payload.distributor_id if "distributor_id" in supplied else current.get("distributor_id")
        load_scope(role, org_code, department_id, distributor_id)
        if not can_manage_identity(current_user, role, org_code):
            raise HTTPException(status_code=403, detail="不可變更跨範圍或高於自身權限的帳號")
        # An organization admin cannot modify a target that was outside its scope
        # before this request, even when attempting to move it into that scope.
        if current_user.get("role") == "admin" and current.get("org_code") != current_user.get("org_code"):
            raise HTTPException(status_code=403, detail="不可管理其他企業的帳號")

        display_name = payload.display_name if payload.display_name is not None else current["display_name"]
        staff_id = payload.staff_id if "staff_id" in supplied else current.get("staff_id")
        mfa_required = payload.mfa_required if payload.mfa_required is not None else current["mfa_required"]
        is_active = payload.is_active if payload.is_active is not None else current["is_active"]
        action = "deactivate" if payload.is_active is False else "activate" if payload.is_active is True else "update"
        _execute(
            client.rpc("reibi_admin_update_identity", {
                "p_target": auth_user_id,
                "p_actor": actor_id,
                "p_display_name": display_name,
                "p_internal_role": role,
                "p_org_code": org_code,
                "p_department_id": department_id,
                "p_staff_id": staff_id,
                "p_distributor_id": distributor_id,
                "p_mfa_required": mfa_required,
                "p_is_active": is_active,
                "p_action": action,
            }),
            "原子更新可信身分",
        )
        return {"status": "success"}

    @router.post("/accounts/{auth_user_id}/revoke-sessions")
    def revoke_account_sessions(auth_user_id: str, current_user: dict = Depends(require_identity_admin)):
        rows = _execute(
            client.table("reibi_internal_users")
            .select("auth_user_id,internal_role,org_code")
            .eq("auth_user_id", auth_user_id)
            .limit(1),
            "讀取目標帳號",
        )
        if not rows:
            raise HTTPException(status_code=404, detail="找不到帳號")
        target = rows[0]
        if not can_manage_identity(current_user, target["internal_role"], target.get("org_code")):
            raise HTTPException(status_code=403, detail="不可撤銷此帳號的工作階段")
        now = datetime.now(timezone.utc).isoformat()
        _execute(
            client.table("reibi_internal_sessions").update({
                "revoked_at": now,
                "revoked_reason": "administrator_revoked",
                "revoked_by": current_user.get("auth_user_id") or current_user.get("uid"),
            }).eq("auth_user_id", auth_user_id).is_("revoked_at", "null"),
            "撤銷帳號工作階段",
        )
        audit_identity(
            current_user.get("auth_user_id") or current_user.get("uid"),
            auth_user_id,
            "revoke_sessions",
            {},
        )
        return {"status": "success"}

    @router.post("/logout")
    def logout(current_user: dict = Depends(get_current_user)):
        if current_user.get("auth_source") == "supabase" and current_user.get("jti"):
            now = datetime.now(timezone.utc).isoformat()
            _execute(
                client.table("reibi_internal_sessions").update({
                    "revoked_at": now,
                    "revoked_reason": "user_logout",
                    "revoked_by": current_user.get("auth_user_id") or current_user.get("uid"),
                }).eq("id", current_user["jti"]).is_("revoked_at", "null"),
                "撤銷可信工作階段",
            )
            audit_identity(
                current_user.get("auth_user_id") or current_user.get("uid"),
                current_user.get("auth_user_id") or current_user.get("uid"),
                "logout",
                {},
            )
        return {"status": "success"}

    return router
