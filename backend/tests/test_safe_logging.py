"""不外洩個資與健康資料的例外記錄（FND-10）。

新系統原本用 `print(f"...失敗: {e}")` 記錄例外。Supabase 與 Pydantic 的例外訊息
常帶著失敗那筆資料的欄位值 —— 睡眠分數、疼痛分數、PHQ-4／PSS-4，乃至 BSRS-5 的
自殺意念題答案。這些字串會進 Railway 的 log，而 log 沒有跟資料庫同等的存取控制。

這些測試守兩件事：redact 會遮蔽敏感片段，且 log_exception 預設不輸出訊息內容。
"""

from __future__ import annotations

import logging

import pytest

import safe_logging
from safe_logging import log_exception, redact


class TestRedact:
    @pytest.mark.parametrize(("text", "secret"), [
        ("sleep_score: 21", "21"),
        ("pain_score=45", "45"),
        ("answers: [3, 2, 4, 1]", "[3, 2, 4, 1]"),
        ("suicide_ideation: 3", "3"),
        ("bsrs5_total=18", "18"),
        ("phq4=9", "9"),
    ])
    def test_health_values_are_masked(self, text, secret):
        out = redact(text)
        assert "[redacted]" in out
        assert secret not in out.replace("[redacted]", "")

    def test_an_email_is_masked(self):
        assert "user@example.com" not in redact("contact failed for user@example.com")
        assert "[email]" in redact("user@example.com")

    def test_a_long_number_is_masked(self):
        # 身分證、電話、會員碼一類。
        assert "0912345678" not in redact("phone 0912345678 not reachable")

    def test_a_name_field_is_masked(self):
        assert "王小明" not in redact("full_name: 王小明 insert failed")

    def test_a_member_code_is_masked(self):
        assert "RBAB12CD" not in redact("member_code=RBAB12CD duplicate")

    def test_ordinary_text_is_left_readable(self):
        # 不含敏感鍵名的訊息應保持可讀，否則 log 會失去用處。
        assert redact("connection timeout after 30s") == "connection timeout after 30s"

    def test_a_realistic_supabase_error_is_scrubbed(self):
        raw = (
            "duplicate key value violates unique constraint; "
            "Key (sleep_score, email)=(21, patient@example.com) already exists"
        )
        out = redact(raw)
        assert "21" not in out
        assert "patient@example.com" not in out
        assert "constraint" in out  # 診斷資訊仍在

    def test_non_string_input_does_not_crash(self):
        assert isinstance(redact(12345), str)
        assert isinstance(redact(None), str)


class TestLogException:
    def test_the_exception_message_is_not_logged_by_default(self, caplog, monkeypatch):
        monkeypatch.setattr(safe_logging, "_DEBUG", False)
        with caplog.at_level(logging.WARNING, logger="reibi"):
            log_exception("sleep_assessment.points", ValueError("sleep_score: 21 for patient@example.com"))
        record = caplog.text
        assert "21" not in record
        assert "patient@example.com" not in record

    def test_the_location_and_type_are_logged(self, caplog, monkeypatch):
        monkeypatch.setattr(safe_logging, "_DEBUG", False)
        with caplog.at_level(logging.WARNING, logger="reibi"):
            log_exception("ai_analyzer.generate", KeyError("phq4"))
        assert "ai_analyzer.generate" in caplog.text
        assert "KeyError" in caplog.text

    def test_debug_mode_still_redacts(self, caplog, monkeypatch):
        # 即使 DEBUG 打開輸出訊息，敏感內容仍要遮蔽。
        monkeypatch.setattr(safe_logging, "_DEBUG", True)
        with caplog.at_level(logging.WARNING, logger="reibi"):
            log_exception("x", ValueError("pain_score=45"))
        assert "45" not in caplog.text

    def test_extra_context_is_redacted(self, caplog, monkeypatch):
        monkeypatch.setattr(safe_logging, "_DEBUG", False)
        with caplog.at_level(logging.WARNING, logger="reibi"):
            log_exception("x", ValueError("boom"), extra="member_code=RBSECRET1")
        assert "RBSECRET1" not in caplog.text


class TestNoLeakingPrintsRemain:
    """回歸防線：不讓 print(例外) 的寫法重新出現在後端。"""

    def test_no_source_file_prints_a_raw_exception(self):
        import pathlib

        backend = pathlib.Path(__file__).resolve().parent.parent
        # safe_logging.py 的 docstring 引用了這個反面寫法作為說明，不算違規。
        skip = {"safe_logging.py"}
        candidates = [p for p in backend.glob("*.py") if p.name not in skip]
        candidates += list((backend / "modules").glob("*.py"))
        offenders = []
        for path in candidates:
            for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
                stripped = line.strip()
                if stripped.startswith("#"):
                    continue
                if "print(" in stripped and any(tok in stripped for tok in ("{e}", "{exc}", "{str(e)}", "{err")):
                    offenders.append(f"{path.name}:{number}")
        assert offenders == [], f"raw exception prints reintroduced: {offenders}"
