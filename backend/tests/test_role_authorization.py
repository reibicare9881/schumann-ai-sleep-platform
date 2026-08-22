"""Role authorization (403) for every route that declares a named guard.

Each ``require_*`` dependency admits a fixed set of roles.  This module reads
the guard off each route and asserts the complement: a role outside the set is
rejected with 403, and a role inside it gets past authorization (whatever the
handler then does with an empty database).  Because the guard is discovered
from the route table, mounting a new endpoint behind an existing guard is
covered automatically, and introducing a *new* guard fails
``test_every_guard_in_use_is_declared`` until its role set is written down.

Routes that authorize inside the handler body carry no named guard and are
covered by ``test_object_authorization.py`` and ``test_inline_authorization.py``
instead — a 403 raised after parameter validation cannot be asserted generically.
"""

from __future__ import annotations

import re

import pytest
from fastapi.routing import APIRoute

import main
from roles import ALL_ROLES, TRUSTED_EXCLUSIVE_ROLES
from support.identities import PRIMARY_ORG_CODE

_PATH_PARAM = re.compile(r"\{[^}]+\}")

# Routes whose scope is carried in the URL need a value the caller is actually
# entitled to; a placeholder would trip a legitimate cross-organization 403 and
# hide whether the role guard itself let them through.
PATH_PARAM_VALUES = {"org_code": PRIMARY_ORG_CODE}

# Cross-enterprise roles hold no org_code of their own and must name the target
# enterprise explicitly, exactly as the UI does.
CROSS_ENTERPRISE_ROLES = {"reibi_super", "reibi_finance"}

# Roles each named guard admits when presented with a default token from the
# factory.  Sources: auth.py, reibi_batch_d.py, reibi_batch_e.py,
# reibi_batch_g.py.  Where a guard also requires a Supabase-backed session, the
# set below reflects what a default token actually achieves, which is the thing
# under test.
GUARD_ALLOWED_ROLES: dict[str, set[str]] = {
    # --- auth.py -----------------------------------------------------------
    "require_admin": {"admin"},
    "require_org_manager": {"admin", "dept_head"},
    "require_member_or_above": ALL_ROLES - {"individual"},
    # has_permission("manage_reibi"): admin, plus reibi_super via "all"
    "require_reibi_manager": {"admin", "reibi_super", "reibi_finance"},
    "require_reibi_super": {"reibi_super"},
    "require_reibi_partner": {"partner_primary", "partner_sub"},
    # --- reibi_batch_g.py --------------------------------------------------
    # Also demands auth_source == "supabase"; org admin tokens are not
    # Supabase-backed by default, so only reibi_super passes with a plain token.
    "require_identity_admin": {"reibi_super"},
    "require_trusted_identity": set(TRUSTED_EXCLUSIVE_ROLES),
    # --- reibi_batch_d.py --------------------------------------------------
    # Personal health writes to the caller's own profile, so it stays a role
    # list; the rest are derived from roles.py permissions.
    "require_personal_health": {"individual", "member", "dept_head"},
    # has_permission("ohs_manage"): admin, admin_hr, plus reibi_super via "all"
    "require_ohs_manager": {"admin", "admin_hr", "reibi_super"},
    # ohs_manage or oh_interview
    "require_occupational": {"admin", "admin_hr", "reibi_super", "occupational_health"},
    # org_analytics (admin, admin_hr, admin_finance) or department_analytics (dept_head)
    "require_aggregate_viewer": {"admin", "admin_hr", "admin_finance", "dept_head", "reibi_super"},
    # --- reibi_onboarding.py -----------------------------------------------
    # has_permission("enterprise_manage"): reibi_finance, plus reibi_super via "all"
    "_actor": {"reibi_super", "reibi_finance"},
    # --- reibi_batch_e.py --------------------------------------------------
    "require_org_analytics": {"admin", "admin_hr", "admin_finance", "dept_head", "reibi_super"},
    # has_permission("org_reports"): admin only, plus reibi_super via "all"
    "require_org_report": {"admin", "reibi_super"},
    # Cross-enterprise directory carries contact details and layer pricing, so
    # it stays reibi_super rather than following cross_org_analytics.
    "require_super": {"reibi_super"},
    # has_permission("cross_org_analytics"): reibi_data, plus reibi_super via "all"
    "require_cross_org_analytics": {"reibi_data", "reibi_super"},
    "require_personal": {"individual", "member", "dept_head"},
}


# Dependencies that authenticate rather than authorize; they carry no role set.
NON_GUARD_DEPENDENCIES = {"get_current_user", "HTTPBearer", "Security"}


def _guards(dependant, seen: set[int] | None = None, *, top: bool = True) -> set[str]:
    """Every dependency callable on a route, not only ``require_*`` names.

    Guards are not required to follow a naming convention — the onboarding
    router calls its own ``_actor`` — so matching on a prefix silently leaves
    routes untested.  Collecting every dependency instead makes an undeclared
    guard fail loudly.
    """
    if seen is None:
        seen = set()
    found: set[str] = set()
    if not top:
        name = getattr(getattr(dependant, "call", None), "__name__", None)
        if name and name not in NON_GUARD_DEPENDENCIES:
            found.add(name)
    for sub in dependant.dependencies:
        if id(sub) in seen:
            continue
        seen.add(id(sub))
        found |= _guards(sub, seen, top=False)
    return found


def _guarded_routes() -> list[tuple[str, str, frozenset[str]]]:
    collected = []
    for route in main.app.routes:
        if not isinstance(route, APIRoute):
            continue
        guards = _guards(route.dependant)
        if not guards:
            continue
        for method in sorted(route.methods - {"HEAD", "OPTIONS"}):
            collected.append((method, route.path, frozenset(guards)))
    return sorted(collected, key=lambda row: (row[1], row[0]))


GUARDED_ROUTES = _guarded_routes()
GUARDS_IN_USE = {guard for _, _, guards in GUARDED_ROUTES for guard in guards}


def _allowed_roles(guards: frozenset[str]) -> set[str]:
    """A route behind several guards admits only the intersection."""
    allowed = set(ALL_ROLES)
    for guard in guards:
        allowed &= GUARD_ALLOWED_ROLES[guard]
    return allowed


CASES: list[tuple[str, str, str, bool]] = []
for _method, _path, _guards_set in GUARDED_ROUTES:
    if not _guards_set <= set(GUARD_ALLOWED_ROLES):
        continue
    _allowed = _allowed_roles(_guards_set)
    for _role in sorted(ALL_ROLES):
        CASES.append((_method, _path, _role, _role in _allowed))

DENIED_CASES = [(m, p, r) for m, p, r, ok in CASES if not ok]
ALLOWED_CASES = [(m, p, r) for m, p, r, ok in CASES if ok]

DENIED_IDS = [f"{r} -> {m} {p}" for m, p, r in DENIED_CASES]
ALLOWED_IDS = [f"{r} -> {m} {p}" for m, p, r in ALLOWED_CASES]


def _concrete(path: str) -> str:
    def substitute(match: re.Match[str]) -> str:
        name = match.group(0).strip("{}").split(":")[0]
        return PATH_PARAM_VALUES.get(name, "1")

    return _PATH_PARAM.sub(substitute, path)


def _call(client, tokens, method: str, path: str, role: str):
    url = _concrete(path)
    if role in CROSS_ENTERPRISE_ROLES and "org_code" not in url:
        url = f"{url}?org_code={PRIMARY_ORG_CODE}"
    return client.request(method, url, headers=tokens.header(role), json={})


class TestGuardTableIsComplete:
    def test_every_guard_in_use_is_declared(self):
        undeclared = GUARDS_IN_USE - set(GUARD_ALLOWED_ROLES)
        assert not undeclared, (
            f"這些守門已被路由使用但沒有宣告允許角色：{sorted(undeclared)}。"
            "請在 GUARD_ALLOWED_ROLES 補上，否則該守門保護的路由不會被測到。"
        )

    def test_declared_guards_are_all_still_in_use(self):
        unused = set(GUARD_ALLOWED_ROLES) - GUARDS_IN_USE
        assert not unused, f"這些守門已不再掛在任何路由上，應移除宣告：{sorted(unused)}"

    def test_matrix_covers_every_role(self):
        assert {role for _, _, role in DENIED_CASES} | {role for _, _, role in ALLOWED_CASES} == ALL_ROLES

    def test_matrix_is_not_empty(self):
        assert len(GUARDED_ROUTES) > 100
        assert DENIED_CASES and ALLOWED_CASES


@pytest.mark.parametrize(("method", "path", "role"), DENIED_CASES, ids=DENIED_IDS)
def test_role_outside_the_guard_is_rejected(client, tokens, method, path, role):
    response = _call(client, tokens, method, path, role)
    assert response.status_code == 403, (
        f"{role} 不在 {method} {path} 的允許角色內，卻得到 {response.status_code}："
        f"{response.text[:200]}"
    )


@pytest.mark.parametrize(("method", "path", "role"), ALLOWED_CASES, ids=ALLOWED_IDS)
def test_role_inside_the_guard_passes_authorization(client, tokens, method, path, role):
    """Allowed roles must clear authorization.

    The handler may still answer 404/422/500 against an empty fake database;
    the property under test is only that authorization did not reject them.
    """
    response = _call(client, tokens, method, path, role)
    assert response.status_code != 403, (
        f"{role} 應可通過 {method} {path} 的授權，卻被拒絕：{response.text[:200]}"
    )


class TestRegistryIsHonouredOverTheWire:
    """The Batch D/E guards now agree with ``roles.py`` on a live request.

    ``test_registry_backed_authorization.py`` checks the guard functions in
    isolation; these go through the mounted app so a route wired to the wrong
    guard is caught too. 403 is the only failure this asserts against —
    anything past authorization may still fail on an empty database.
    """

    ANALYTICS_ROUTE = ("GET", "/api/reibi/analytics/overview")
    OHS_ROUTE = ("GET", "/api/reibi/health/ohs")
    CROSS_ORG_ROUTE = ("GET", "/api/reibi/analytics/cross-org")
    DIRECTORY_ROUTE = ("GET", "/api/reibi/analytics/directory")

    def test_admin_hr_reaches_org_analytics_it_holds_in_the_registry(self, client, tokens):
        from roles import has_permission

        assert has_permission({"role": "admin_hr"}, "org_analytics")
        method, path = self.ANALYTICS_ROUTE
        assert _call(client, tokens, method, path, "admin_hr").status_code != 403

    def test_admin_hr_reaches_occupational_health(self, client, tokens):
        from roles import has_permission

        assert has_permission({"role": "admin_hr"}, "ohs_manage")
        method, path = self.OHS_ROUTE
        assert _call(client, tokens, method, path, "admin_hr").status_code != 403

    def test_admin_finance_reaches_org_analytics_it_holds_in_the_registry(self, client, tokens):
        method, path = self.ANALYTICS_ROUTE
        assert _call(client, tokens, method, path, "admin_finance").status_code != 403

    def test_reibi_data_reaches_cross_enterprise_analytics(self, client, tokens):
        method, path = self.CROSS_ORG_ROUTE
        assert _call(client, tokens, method, path, "reibi_data").status_code != 403

    def test_admin_it_stays_out_of_health_and_analytics(self, client, tokens):
        """admin_it holds only security_audit, which no route consults yet."""
        for method, path in (self.ANALYTICS_ROUTE, self.OHS_ROUTE, self.CROSS_ORG_ROUTE):
            assert _call(client, tokens, method, path, "admin_it").status_code == 403

    def test_cross_enterprise_directory_stays_super_only(self, client, tokens):
        """The directory carries contact details and layer pricing, not
        de-identified analytics, so cross_org_analytics does not open it."""
        method, path = self.DIRECTORY_ROUTE
        assert _call(client, tokens, method, path, "reibi_data").status_code == 403
        assert _call(client, tokens, method, path, "reibi_finance").status_code == 403
