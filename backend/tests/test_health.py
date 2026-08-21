"""會真的檢查依賴的健康檢查（REL-05 前置）。

原本的 `/` 回傳寫死的 "online"：Supabase 斷線、金鑰過期，它都照樣 200。
那種健康檢查在故障時最不可靠，因為它永遠是綠的 —— 監控接上去只能確認
機器還活著，不能確認服務可用。

這些測試守三件事：依賴壞掉要回 503、回應不得洩漏故障細節、
以及健康檢查本身壞掉時算不健康而不是拋錯。
"""

from __future__ import annotations

import pytest

from health import build_health_report


def _ok():
    return {"healthy": True, "latency_ms": 3}


def _down():
    return {"healthy": False, "latency_ms": None}


def _explode():
    raise RuntimeError("check itself is broken")


class TestReport:
    def test_everything_up_is_healthy(self, fake_supabase):
        report = build_health_report(fake_supabase, checks={"database": _ok, "ai_key": _ok})
        assert report["status"] == "healthy"
        assert report["dependencies"] == {"database": True, "ai_key": True}

    def test_one_dependency_down_makes_the_whole_report_unhealthy(self, fake_supabase):
        report = build_health_report(fake_supabase, checks={"database": _down, "ai_key": _ok})
        assert report["status"] == "unhealthy"
        assert report["dependencies"]["database"] is False

    def test_a_check_that_raises_counts_as_unhealthy(self, fake_supabase):
        # 檢查本身壞掉不該讓 /health 回 500 —— 那會讓監控看到錯誤的訊號。
        report = build_health_report(fake_supabase, checks={"database": _explode})
        assert report["status"] == "unhealthy"
        assert report["dependencies"]["database"] is False

    def test_dependencies_are_reported_as_plain_booleans(self, fake_supabase):
        report = build_health_report(fake_supabase, checks={"database": _ok})
        assert all(isinstance(value, bool) for value in report["dependencies"].values())

    def test_latency_is_surfaced_for_the_database(self, fake_supabase):
        report = build_health_report(fake_supabase, checks={"database": _ok})
        assert report["database_latency_ms"] == 3


class TestNoLeakage:
    def test_the_report_carries_no_exception_text(self, fake_supabase):
        def leaky():
            raise RuntimeError("postgres://user:secret@db.internal:5432 refused")

        report = build_health_report(fake_supabase, checks={"database": leaky})
        body = str(report)
        assert "secret" not in body
        assert "db.internal" not in body

    def test_the_report_carries_no_connection_details(self, fake_supabase):
        report = build_health_report(fake_supabase, checks={"database": _down})
        body = str(report)
        for token in ("supabase", "postgres", "key", "token"):
            assert token not in body.lower().replace("ai_key", "")


class TestEndpoint:
    def test_health_is_public_and_needs_no_session(self, client):
        # 監控不會帶 token；要求驗證等於讓監控接不上。
        assert client.get("/health").status_code in {200, 503}

    def test_an_unhealthy_dependency_returns_503(self, client, monkeypatch):
        import main

        monkeypatch.setattr(main, "build_health_report",
                            lambda _client: {"status": "unhealthy", "dependencies": {"database": False}})
        assert client.get("/health").status_code == 503

    def test_a_healthy_report_returns_200(self, client, monkeypatch):
        import main

        monkeypatch.setattr(main, "build_health_report",
                            lambda _client: {"status": "healthy", "dependencies": {"database": True}})
        assert client.get("/health").status_code == 200

    def test_the_root_still_identifies_the_service(self, client):
        body = client.get("/").json()
        assert body["status"] == "online"
        # 並且明白指向真正的健康檢查，避免有人繼續把 / 當監控端點。
        assert body["health_endpoint"] == "/health"
