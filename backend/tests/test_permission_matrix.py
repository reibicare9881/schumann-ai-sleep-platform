"""Authentication boundary coverage for every route the app exposes.

The route table is read from ``main.app`` rather than hand-listed, so a new
endpoint is covered the moment it is mounted.  Two properties are enforced:

* a route may only be reachable without credentials if it appears in
  ``PUBLIC_ROUTES``; adding an unauthenticated endpoint fails the suite until
  someone writes it down here on purpose, and
* every other route rejects each way of presenting a bad credential with 401.

Role-level authorization (403) lives in ``test_role_authorization.py``; this
module deliberately stops at "are you anyone at all".
"""

from __future__ import annotations

import re

import pytest
from fastapi.routing import APIRoute

import main

# --- routes that are unauthenticated on purpose ----------------------------
# Everything here is either a pre-login step or a public catalog.  Each entry
# is a deliberate decision, not a default.
PUBLIC_ROUTES = {
    ("GET", "/"): "服務資訊首頁",
    # 監控不會帶 token；要求驗證等於讓 Railway 的告警接不上。
    # 回應刻意只含依賴健康與否的布林值，不含例外訊息或連線細節。
    ("GET", "/health"): "依賴健康檢查，供監控與 load balancer 使用",
    ("GET", "/api/platforms"): "公開平台清單",
    ("GET", "/api/auth/roles"): "角色目錄，供登入前畫面顯示",
    ("GET", "/api/auth/verify-org/{org_code}"): "登入前驗證單位代碼是否存在",
    ("POST", "/api/auth/login"): "主平台登入，本身就是取得憑證的入口",
    ("POST", "/api/auth/account/login"): "可信帳號登入",
    ("POST", "/api/auth/internal/login"): "REIBI 內部登入",
    ("POST", "/api/auth/complete-invite"): "邀請連結設定密碼，此時尚無應用 JWT",
    ("POST", "/api/auth/mfa/enroll"): "邀請流程首次綁定 TOTP，以邀請憑證換取 QR Code",
    ("POST", "/api/auth/mfa/verify-enrollment"): "邀請流程驗證六位碼",
}

AUTH_DEPENDENCY_NAMES = {
    "get_current_user",
    "require_admin",
    "require_org_manager",
    "require_member_or_above",
    "require_reibi_manager",
    "require_reibi_super",
    "require_reibi_partner",
    "require_identity_admin",
    "require_trusted_identity",
}

_PATH_PARAM = re.compile(r"\{[^}]+\}")


def _auth_dependencies(dependant, seen: set[int] | None = None) -> set[str]:
    """Collect the auth guards anywhere in a route's dependency tree."""
    if seen is None:
        seen = set()
    found: set[str] = set()
    name = getattr(getattr(dependant, "call", None), "__name__", None)
    if name in AUTH_DEPENDENCY_NAMES:
        found.add(name)
    for sub in dependant.dependencies:
        if id(sub) in seen:
            continue
        seen.add(id(sub))
        found |= _auth_dependencies(sub, seen)
    return found


def _routes() -> list[tuple[str, str, frozenset[str]]]:
    collected = []
    for route in main.app.routes:
        if not isinstance(route, APIRoute):
            continue
        guards = frozenset(_auth_dependencies(route.dependant))
        for method in sorted(route.methods - {"HEAD", "OPTIONS"}):
            collected.append((method, route.path, guards))
    return sorted(collected, key=lambda row: (row[1], row[0]))


ALL_ROUTES = _routes()
AUTHENTICATED_ROUTES = [(m, p) for m, p, guards in ALL_ROUTES if guards]
UNAUTHENTICATED_ROUTES = [(m, p) for m, p, guards in ALL_ROUTES if not guards]

ROUTE_IDS = [f"{method} {path}" for method, path in AUTHENTICATED_ROUTES]


def _concrete(path: str) -> str:
    """Fill path params with a placeholder.

    Auth dependencies are solved before the endpoint's own path/body params, so
    a placeholder never masks the status code under test.
    """
    return _PATH_PARAM.sub("1", path)


def _call(client, method: str, path: str, headers: dict[str, str] | None = None):
    return client.request(method, _concrete(path), headers=headers or {}, json={})


class TestPublicSurface:
    def test_unauthenticated_routes_match_the_reviewed_allowlist(self):
        actual = set(UNAUTHENTICATED_ROUTES)
        expected = set(PUBLIC_ROUTES)
        assert actual == expected, (
            "公開路由與已審核清單不一致。\n"
            f"新增而未登記：{sorted(actual - expected)}\n"
            f"已登記但不存在：{sorted(expected - actual)}"
        )

    def test_every_route_is_either_public_or_guarded(self):
        assert len(AUTHENTICATED_ROUTES) + len(UNAUTHENTICATED_ROUTES) == len(ALL_ROUTES)
        assert AUTHENTICATED_ROUTES, "route table 掃描失敗，沒有任何受保護路由"

    def test_no_business_data_route_is_public(self):
        for method, path in UNAUTHENTICATED_ROUTES:
            assert not path.startswith("/api/reibi/"), f"{method} {path} 不應公開"


@pytest.mark.parametrize(("method", "path"), AUTHENTICATED_ROUTES, ids=ROUTE_IDS)
class TestCredentialsAreRequired:
    def test_missing_credentials_are_rejected(self, client, method, path):
        assert _call(client, method, path).status_code == 401

    def test_malformed_token_is_rejected(self, client, tokens, method, path):
        headers = {"Authorization": f"Bearer {tokens.malformed_token()}"}
        assert _call(client, method, path, headers).status_code == 401

    def test_expired_token_is_rejected(self, client, tokens, method, path):
        headers = {"Authorization": f"Bearer {tokens.expired_token()}"}
        assert _call(client, method, path, headers).status_code == 401

    def test_forged_signature_is_rejected(self, client, tokens, method, path):
        headers = {"Authorization": f"Bearer {tokens.wrong_signature_token()}"}
        assert _call(client, method, path, headers).status_code == 401

    def test_trusted_role_without_a_live_session_is_rejected(self, client, tokens, method, path):
        headers = {"Authorization": f"Bearer {tokens.unregistered_session_token()}"}
        assert _call(client, method, path, headers).status_code == 401

    def test_revoked_session_is_rejected(self, client, tokens, sessions, method, path):
        headers = tokens.header("reibi_super")
        for jti in list(sessions.sessions):
            sessions.revoke(jti)
        assert _call(client, method, path, headers).status_code == 401
