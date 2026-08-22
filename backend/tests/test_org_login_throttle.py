"""單位通行碼登入的暴力破解節流。

Artifact 有這個機制（錯 5 次鎖 30 分鐘）且在畫面上對使用者承諾過，移植時漏掉，
使得四條登入路徑中唯一沒有節流的，剛好是憑證最弱的那條：通行碼全組織共用，
猜中一次即可讀取整間企業的健康資料。

這些測試同時守住兩件事：節流真的會擋，以及它不會在儲存出問題時把所有人擋在門外。
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException

import org_login_throttle
from org_login_throttle import (
    IP_FAILURE_LIMIT,
    ORG_FAILURE_LIMIT,
    WINDOW_MINUTES,
    assert_not_throttled,
    fingerprint,
    record_attempt,
)

ORG = "ORG-TEST-26-000001"
ROLE = "admin"
IP = "203.0.113.9"
TABLE = "reibi_org_login_attempts"


def _seed_failures(fake_supabase, count, *, ip=IP, org=ORG, role=ROLE, minutes_ago=0):
    stamp = (datetime.now(timezone.utc) - timedelta(minutes=minutes_ago)).isoformat()
    fake_supabase.seed(TABLE, [
        {
            "id": index + 1,
            "org_hash": fingerprint(org),
            "role": role,
            "ip_hash": fingerprint(ip),
            "succeeded": False,
            "created_at": stamp,
        }
        for index in range(count)
    ])


class TestThrottleGate:
    def test_allows_a_clean_org(self, fake_supabase):
        assert_not_throttled(fake_supabase, ORG, ROLE, IP)  # must not raise

    def test_allows_up_to_the_ip_limit(self, fake_supabase):
        _seed_failures(fake_supabase, IP_FAILURE_LIMIT - 1)
        assert_not_throttled(fake_supabase, ORG, ROLE, IP)  # must not raise

    def test_blocks_at_the_ip_limit(self, fake_supabase):
        _seed_failures(fake_supabase, IP_FAILURE_LIMIT)
        with pytest.raises(HTTPException) as exc_info:
            assert_not_throttled(fake_supabase, ORG, ROLE, IP)
        assert exc_info.value.status_code == 429

    def test_a_different_ip_is_not_punished_for_another_ip_failures(self, fake_supabase):
        # 只鎖單位會讓任何知道單位代碼的人癱瘓整間公司；這條守住那個界線。
        _seed_failures(fake_supabase, IP_FAILURE_LIMIT)
        assert_not_throttled(fake_supabase, ORG, ROLE, "198.51.100.4")  # must not raise

    def test_blocks_distributed_attempts_at_the_org_limit(self, fake_supabase):
        # 每個 IP 都低於個別門檻，但整體已是攻擊樣態。
        for index in range(ORG_FAILURE_LIMIT):
            _seed_failures(fake_supabase, 1, ip=f"198.51.100.{index}")
        with pytest.raises(HTTPException) as exc_info:
            assert_not_throttled(fake_supabase, ORG, ROLE, "198.51.100.250")
        assert exc_info.value.status_code == 429

    def test_a_different_org_is_unaffected(self, fake_supabase):
        _seed_failures(fake_supabase, ORG_FAILURE_LIMIT)
        assert_not_throttled(fake_supabase, "ORG-OTHER-26-000002", ROLE, IP)  # must not raise

    def test_a_different_role_is_unaffected(self, fake_supabase):
        _seed_failures(fake_supabase, IP_FAILURE_LIMIT)
        assert_not_throttled(fake_supabase, ORG, "member", IP)  # must not raise

    def test_failures_outside_the_window_no_longer_count(self, fake_supabase):
        # 鎖定必須自動解除：通行碼沒有任何自助重設管道，需要人工解鎖等於把使用者鎖死。
        _seed_failures(fake_supabase, IP_FAILURE_LIMIT, minutes_ago=WINDOW_MINUTES + 1)
        assert_not_throttled(fake_supabase, ORG, ROLE, IP)  # must not raise

    def test_successful_attempts_do_not_count_towards_the_limit(self, fake_supabase):
        fake_supabase.seed(TABLE, [
            {
                "id": index + 1,
                "org_hash": fingerprint(ORG),
                "role": ROLE,
                "ip_hash": fingerprint(IP),
                "succeeded": True,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            for index in range(ORG_FAILURE_LIMIT + 5)
        ])
        assert_not_throttled(fake_supabase, ORG, ROLE, IP)  # must not raise


class TestRecording:
    def test_a_failure_is_recorded_and_then_counts(self, fake_supabase):
        for _ in range(IP_FAILURE_LIMIT):
            record_attempt(fake_supabase, ORG, ROLE, IP, succeeded=False)
        with pytest.raises(HTTPException):
            assert_not_throttled(fake_supabase, ORG, ROLE, IP)

    def test_no_plaintext_org_code_or_ip_is_stored(self, fake_supabase):
        record_attempt(fake_supabase, ORG, ROLE, IP, succeeded=False)
        stored = fake_supabase.tables[TABLE]
        assert len(stored) == 1
        blob = repr(stored[0])
        assert ORG not in blob
        assert IP not in blob


class TestFailureModes:
    """節流的儲存出問題時不可以把所有單位使用者擋在門外，但也不能靜悄悄。"""

    def test_an_unavailable_table_does_not_block_login(self, fake_supabase, monkeypatch):
        def _boom(*_args, **_kwargs):
            raise RuntimeError("relation does not exist")

        monkeypatch.setattr(org_login_throttle, "_count_failures", _boom)
        assert_not_throttled(fake_supabase, ORG, ROLE, IP)  # must not raise

    def test_an_unavailable_table_is_logged(self, fake_supabase, monkeypatch):
        seen = []

        def _boom(*_args, **_kwargs):
            raise RuntimeError("relation does not exist")

        monkeypatch.setattr(org_login_throttle, "_count_failures", _boom)
        monkeypatch.setattr(org_login_throttle, "log_exception", lambda *args, **kw: seen.append(args))
        assert_not_throttled(fake_supabase, ORG, ROLE, IP)
        assert seen, "throttle storage failure must leave a trace, not vanish"

    def test_a_write_failure_does_not_break_login(self, fake_supabase, monkeypatch):
        class _Boom:
            def table(self, *_args, **_kwargs):
                raise RuntimeError("insert failed")

        record_attempt(_Boom(), ORG, ROLE, IP, succeeded=False)  # must not raise


class TestThroughTheLoginEndpoint:
    """模組層擋得住不代表端點真的有接上 —— 這裡走真實的 /api/auth/login。"""

    @pytest.fixture
    def seeded_org(self, fake_supabase):
        from main import pwd_context

        fake_supabase.seed("organizations", [{
            "id": 1,
            "org_code": ORG,
            "org_name": "節流測試單位",
            "admin_pin": pwd_context.hash("correct-horse"),
        }])

    def _login(self, client, pin):
        return client.post("/api/auth/login", json={
            "platform": "sleep", "role": ROLE, "org_code": ORG,
            "name": "測試管理者", "pin": pin,
        })

    def test_a_wrong_passcode_still_returns_401_before_the_limit(self, client, seeded_org):
        assert self._login(client, "wrong").status_code == 401

    def test_repeated_wrong_passcodes_start_returning_429(self, client, seeded_org):
        for _ in range(IP_FAILURE_LIMIT):
            assert self._login(client, "wrong").status_code == 401
        assert self._login(client, "wrong").status_code == 429

    def test_the_lockout_also_blocks_the_correct_passcode(self, client, seeded_org):
        # 擋的是這條登入路徑，不是「錯的通行碼」—— 否則攻擊者可以用猜對的那次繞過。
        for _ in range(IP_FAILURE_LIMIT):
            self._login(client, "wrong")
        assert self._login(client, "correct-horse").status_code == 429
