"""Tests for the shared harness itself.

The permission matrix in the next batch is only trustworthy if the doubles it
rests on behave like the real thing, so the harness gets its own coverage:
filters and writes must compose the way PostgREST does, tokens must be accepted
for every role in the registry, and each way of presenting a bad credential must
still produce 401.
"""

from __future__ import annotations

import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from auth import get_current_user
from config import settings
from roles import ROLE_DEFINITIONS, TRUSTED_EXCLUSIVE_ROLES
from support.fake_supabase import FakeSupabaseClient, FakeSupabaseError


@pytest.fixture
def probe_client() -> TestClient:
    """A minimal app that only exercises the authentication dependency."""
    app = FastAPI()

    @app.get("/probe")
    def probe(user: dict = Depends(get_current_user)) -> dict:
        return user

    return TestClient(app)


class TestEnvironmentIsolation:
    def test_supabase_url_never_points_at_a_reachable_project(self):
        assert settings.supabase_url == "http://supabase.invalid"

    def test_service_role_key_is_not_a_real_credential(self):
        assert settings.supabase_service_role_key == "test-service-role-key-not-real"

    def test_main_module_uses_the_in_memory_client(self):
        import main

        assert isinstance(main.supabase, FakeSupabaseClient)


class TestFakeSupabaseReads:
    def test_filters_compose_across_calls(self, fake_supabase):
        fake_supabase.seed(
            "reibi_enterprises",
            [
                {"id": 1, "org_code": "A", "status": "active"},
                {"id": 2, "org_code": "A", "status": "suspended"},
                {"id": 3, "org_code": "B", "status": "active"},
            ],
        )
        rows = (
            fake_supabase.table("reibi_enterprises")
            .select("*")
            .eq("org_code", "A")
            .eq("status", "active")
            .execute()
            .data
        )
        assert [row["id"] for row in rows] == [1]

    def test_order_limit_and_range_apply_in_postgrest_order(self, fake_supabase):
        fake_supabase.seed("t", [{"id": n, "score": n % 3} for n in range(1, 7)])
        rows = fake_supabase.table("t").select("*").order("id", desc=True).limit(2).execute().data
        assert [row["id"] for row in rows] == [6, 5]

        ranged = fake_supabase.table("t").select("*").order("id").range(1, 3).execute().data
        assert [row["id"] for row in ranged] == [2, 3, 4]

    def test_in_is_null_and_or_filters(self, fake_supabase):
        fake_supabase.seed(
            "t",
            [
                {"id": 1, "parent": None, "code": "X-1"},
                {"id": 2, "parent": 1, "code": "Y-2"},
                {"id": 3, "parent": 1, "code": "X-3"},
            ],
        )
        assert [r["id"] for r in fake_supabase.table("t").select("*").in_("id", [1, 3]).execute().data] == [1, 3]
        assert [r["id"] for r in fake_supabase.table("t").select("*").is_("parent", "null").execute().data] == [1]
        matched = fake_supabase.table("t").select("*").or_("id.eq.2,code.like.X-3").execute().data
        assert {row["id"] for row in matched} == {2, 3}

    def test_reads_return_copies_so_callers_cannot_mutate_the_store(self, fake_supabase):
        fake_supabase.seed("t", [{"id": 1, "status": "active"}])
        row = fake_supabase.table("t").select("*").execute().data[0]
        row["status"] = "tampered"
        assert fake_supabase.tables["t"][0]["status"] == "active"

    def test_single_raises_when_nothing_matches_but_maybe_single_does_not(self, fake_supabase):
        fake_supabase.seed("t", [{"id": 1}])
        assert fake_supabase.table("t").select("*").eq("id", 1).single().execute().data == {"id": 1}
        assert fake_supabase.table("t").select("*").eq("id", 99).maybe_single().execute().data is None
        with pytest.raises(FakeSupabaseError):
            fake_supabase.table("t").select("*").eq("id", 99).single().execute()


class TestFakeSupabaseWrites:
    def test_insert_assigns_sequential_ids(self, fake_supabase):
        first = fake_supabase.table("t").insert({"name": "a"}).execute().data[0]
        second = fake_supabase.table("t").insert({"name": "b"}).execute().data[0]
        assert (first["id"], second["id"]) == (1, 2)

    def test_update_only_touches_filtered_rows(self, fake_supabase):
        fake_supabase.seed("t", [{"id": 1, "status": "draft"}, {"id": 2, "status": "draft"}])
        fake_supabase.table("t").update({"status": "sent"}).eq("id", 1).execute()
        assert [row["status"] for row in fake_supabase.tables["t"]] == ["sent", "draft"]

    def test_delete_removes_only_filtered_rows(self, fake_supabase):
        fake_supabase.seed("t", [{"id": 1}, {"id": 2}])
        fake_supabase.table("t").delete().eq("id", 1).execute()
        assert [row["id"] for row in fake_supabase.tables["t"]] == [2]

    def test_unregistered_rpc_fails_loudly(self, fake_supabase):
        with pytest.raises(FakeSupabaseError):
            fake_supabase.rpc("some_unmapped_function", {}).execute()

    def test_registered_rpc_returns_its_handler_result(self, fake_supabase):
        fake_supabase.register_rpc("next_doc_no", lambda params: f"QT-{params['year']}-001")
        assert fake_supabase.rpc("next_doc_no", {"year": 2026}).execute().data == "QT-2026-001"

    def test_state_does_not_leak_between_tests(self, fake_supabase):
        assert fake_supabase.tables.get("t") in (None, [])


class TestTokenFactory:
    @pytest.mark.parametrize("role", sorted(ROLE_DEFINITIONS))
    def test_every_registered_role_produces_an_accepted_token(self, probe_client, tokens, role):
        response = probe_client.get("/probe", headers=tokens.header(role))
        assert response.status_code == 200
        assert response.json()["role"] == role

    @pytest.mark.parametrize("role", sorted(ROLE_DEFINITIONS))
    def test_scope_claims_match_the_role_registry(self, tokens, role):
        definition = ROLE_DEFINITIONS[role]
        claims = tokens.claims(role)
        assert bool(claims.get("org_code")) is definition.requires_org
        assert bool(claims.get("department_id")) is definition.requires_department
        assert bool(claims.get("distributor_id")) is definition.requires_distributor

    @pytest.mark.parametrize("role", sorted(TRUSTED_EXCLUSIVE_ROLES))
    def test_trusted_roles_are_marked_as_supabase_backed(self, tokens, role):
        assert tokens.claims(role)["auth_source"] == "supabase"

    def test_other_tenant_claims_are_disjoint_from_primary(self, tokens):
        primary = tokens.claims("admin", tenant="primary")
        other = tokens.claims("admin", tenant="other")
        assert primary["org_code"] != other["org_code"]
        assert primary["uid"] != other["uid"]


class TestRejectedCredentials:
    def test_missing_header_is_401(self, probe_client):
        assert probe_client.get("/probe").status_code == 401

    def test_malformed_token_is_401(self, probe_client, tokens):
        response = probe_client.get(
            "/probe", headers={"Authorization": f"Bearer {tokens.malformed_token()}"}
        )
        assert response.status_code == 401

    def test_expired_token_is_401(self, probe_client, tokens):
        response = probe_client.get(
            "/probe", headers={"Authorization": f"Bearer {tokens.expired_token()}"}
        )
        assert response.status_code == 401

    def test_wrong_signature_is_401(self, probe_client, tokens):
        response = probe_client.get(
            "/probe", headers={"Authorization": f"Bearer {tokens.wrong_signature_token()}"}
        )
        assert response.status_code == 401

    def test_trusted_role_without_a_registered_session_is_401(self, probe_client, tokens):
        response = probe_client.get(
            "/probe", headers={"Authorization": f"Bearer {tokens.unregistered_session_token()}"}
        )
        assert response.status_code == 401

    def test_revoked_session_stops_being_accepted(self, probe_client, tokens, sessions):
        header = tokens.header("reibi_super")
        assert probe_client.get("/probe", headers=header).status_code == 200
        for jti in list(sessions.sessions):
            sessions.revoke(jti)
        assert probe_client.get("/probe", headers=header).status_code == 401

    def test_deactivated_identity_stops_being_accepted(self, probe_client, tokens, sessions):
        header = tokens.header("reibi_cs")
        assert probe_client.get("/probe", headers=header).status_code == 200
        for jti in list(sessions.sessions):
            sessions.deactivate(jti)
        assert probe_client.get("/probe", headers=header).status_code == 401

    def test_expired_session_stops_being_accepted(self, probe_client, tokens, sessions):
        header = tokens.header("partner_primary")
        assert probe_client.get("/probe", headers=header).status_code == 200
        for jti in list(sessions.sessions):
            sessions.expire(jti)
        assert probe_client.get("/probe", headers=header).status_code == 401
