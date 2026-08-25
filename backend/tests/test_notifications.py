"""服務案件與工單的狀態通知信。

範圍是刻意收窄的：只通知企業管理者、只通知這兩種狀態。所以測試也集中在三件事 ——
收件人挑對、內容不夾帶健康資料、以及寄信出問題時業務操作照樣完成。
"""

from __future__ import annotations

import pytest

import notifications
from notifications import NOTIFY_ROLES, is_configured, notify_status_change, recipients_for_org, send_email

TABLE = "reibi_internal_users"
ORG = "ORG-NOTIFY-26-000001"


@pytest.fixture
def configured(monkeypatch):
    monkeypatch.setattr(notifications.settings, "smtp_host", "smtp.example.test")
    monkeypatch.setattr(notifications.settings, "smtp_from", "no-reply@example.test")
    monkeypatch.setattr(notifications.settings, "smtp_user", "user")
    monkeypatch.setattr(notifications.settings, "smtp_password", "secret")


@pytest.fixture
def unconfigured(monkeypatch):
    monkeypatch.setattr(notifications.settings, "smtp_host", None)
    monkeypatch.setattr(notifications.settings, "smtp_from", None)


@pytest.fixture
def staff(fake_supabase):
    fake_supabase.seed(TABLE, [
        {"auth_user_id": "1", "email": "boss@example.test", "display_name": "管理者",
         "internal_role": "admin", "org_code": ORG, "is_active": True},
        {"auth_user_id": "2", "email": "hr@example.test", "display_name": "HR",
         "internal_role": "admin_hr", "org_code": ORG, "is_active": True},
        {"auth_user_id": "3", "email": "left@example.test", "display_name": "已離職",
         "internal_role": "admin", "org_code": ORG, "is_active": False},
        {"auth_user_id": "4", "email": "other@example.test", "display_name": "別家管理者",
         "internal_role": "admin", "org_code": "ORG-OTHER-26-000002", "is_active": True},
        {"auth_user_id": "5", "email": "super@example.test", "display_name": "超管",
         "internal_role": "reibi_super", "org_code": None, "is_active": True},
    ])


class TestRecipients:
    def test_picks_active_managers_of_that_organization(self, fake_supabase, staff):
        found = {row["email"] for row in recipients_for_org(fake_supabase, ORG)}
        assert found == {"boss@example.test", "hr@example.test"}

    def test_excludes_deactivated_accounts(self, fake_supabase, staff):
        assert "left@example.test" not in {row["email"] for row in recipients_for_org(fake_supabase, ORG)}

    def test_never_reaches_another_organization(self, fake_supabase, staff):
        assert "other@example.test" not in {row["email"] for row in recipients_for_org(fake_supabase, ORG)}

    def test_no_org_code_means_no_recipients(self, fake_supabase, staff):
        assert recipients_for_org(fake_supabase, None) == []

    def test_ordinary_members_are_not_notified(self):
        # 一般成員多半靠共用通行碼登入、系統裡沒有他們的 email。
        assert "member" not in NOTIFY_ROLES
        assert "individual" not in NOTIFY_ROLES


class TestUnconfigured:
    """沒設定 SMTP 就不假裝送達 —— 與 LINE 推播同一個原則。"""

    def test_reports_itself_as_unconfigured(self, unconfigured):
        assert is_configured() is False

    def test_does_not_claim_to_have_sent(self, fake_supabase, staff, unconfigured):
        result = notify_status_change(
            fake_supabase, org_code=ORG, org_name="測試公司",
            label="工單", doc_no="WO-1", previous="待處理", current="處理中",
        )
        assert result == {"configured": False, "sent": False, "recipients": 0}

    def test_never_opens_a_connection_when_unconfigured(self, monkeypatch, unconfigured):
        def _boom(*_args, **_kwargs):
            raise AssertionError("未設定時不應該嘗試連線")

        monkeypatch.setattr(notifications.smtplib, "SMTP", _boom)
        assert send_email(["someone@example.test"], "s", "b") is False


class TestContent:
    """信件內容的界線。這一組是這個功能最要緊的部分。"""

    @pytest.fixture
    def captured(self, monkeypatch, configured):
        sent = {}

        class _FakeSMTP:
            def __init__(self, *_args, **_kwargs): pass
            def __enter__(self): return self
            def __exit__(self, *_args): return False
            def starttls(self): pass
            def login(self, *_args): pass
            def send_message(self, message): sent["message"] = message

        monkeypatch.setattr(notifications.smtplib, "SMTP", _FakeSMTP)
        return sent

    def test_the_body_carries_only_the_status(self, fake_supabase, staff, captured):
        notify_status_change(
            fake_supabase, org_code=ORG, org_name="測試公司",
            label="工單", doc_no="WO-2026-001", previous="待處理", current="施工中",
        )
        body = captured["message"].get_content()
        assert "WO-2026-001" in body and "施工中" in body

    @pytest.mark.parametrize("secret", ["21", "BSRS", "sleep_score", "PHQ", "自殺", "分潤", "NT$"])
    def test_the_body_never_carries_health_or_money_details(self, fake_supabase, staff, captured, secret):
        # 信件是明文、留在信箱伺服器、會被轉寄。這個系統為了不讓健康資料進 log
        # 特地做了脫敏，通知信不能把那道防線繞過去。
        notify_status_change(
            fake_supabase, org_code=ORG, org_name="測試公司",
            label="工單", doc_no="WO-1", previous="待處理", current="處理中",
        )
        assert secret not in captured["message"].get_content()

    def test_recipients_cannot_see_each_other(self, fake_supabase, staff, captured):
        # 同一封通知寄給多位管理者；用 To 會讓彼此看見對方信箱。
        notify_status_change(
            fake_supabase, org_code=ORG, org_name="測試公司",
            label="工單", doc_no="WO-1", previous="待處理", current="處理中",
        )
        message = captured["message"]
        assert "boss@example.test" not in str(message["To"])
        assert "boss@example.test" in str(message["Bcc"])


class TestFailureIsolation:
    def test_a_send_failure_is_reported_not_raised(self, fake_supabase, staff, configured, monkeypatch):
        def _boom(*_args, **_kwargs):
            raise OSError("connection refused")

        monkeypatch.setattr(notifications.smtplib, "SMTP", _boom)
        result = notify_status_change(
            fake_supabase, org_code=ORG, org_name="測試公司",
            label="工單", doc_no="WO-1", previous="待處理", current="處理中",
        )
        assert result["configured"] is True and result["sent"] is False

    def test_an_org_with_no_manager_accounts_is_reported(self, fake_supabase, staff, configured):
        result = notify_status_change(
            fake_supabase, org_code="ORG-EMPTY-26-000003", org_name="沒有帳號的公司",
            label="工單", doc_no="WO-1", previous="待處理", current="處理中",
        )
        assert result["sent"] is False and result["recipients"] == 0
        assert "reason" in result, "沒有收件人要說明原因，否則看起來像寄失敗"

    def test_a_directory_lookup_failure_yields_no_recipients(self, monkeypatch):
        class _Boom:
            def table(self, *_args, **_kwargs):
                raise RuntimeError("relation does not exist")

        assert recipients_for_org(_Boom(), ORG) == []
