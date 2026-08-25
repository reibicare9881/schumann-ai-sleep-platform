"""個人模式的身分來源。

原本 `/api/auth/login` 的個人分支以 `full_name` 查 profiles：查不到就建帳號，
**查得到就直接登入成那個人**。任何人猜中名字即可讀取他人的睡眠評估、量表答案、
三高數值與 AI 報告，不需要密碼或任何驗證。

Artifact 這樣寫沒問題 —— 它的資料在瀏覽器 localStorage、每台裝置各自獨立，
姓名只是自己裝置上的標籤。搬到共用資料庫後，同一段邏輯就變成認證漏洞。

改為裝置綁定：真正的身分是首次使用時產生的隨機 token，姓名退回為顯示標籤。
這一組測試的第一節（TestImpersonation）就是釘住那個洞。
"""

from __future__ import annotations

import hashlib
import uuid

import pytest

TABLE = "profiles"


def _token() -> str:
    return str(uuid.uuid4())


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _login(client, name, token=None, **extra):
    body = {"platform": "sleep", "role": "individual", "name": name}
    if token is not None:
        body["device_token"] = token
    body.update(extra)
    return client.post("/api/auth/login", json=body)


def _uid(response):
    payload = response.json()
    return (payload.get("user") or {}).get("id") or (payload.get("session") or {}).get("user_id")


class TestImpersonation:
    """同名不同裝置**不可以**拿到同一個帳號。這一節是整個改動的理由。"""

    def test_a_stranger_typing_the_same_name_gets_a_separate_account(self, client, fake_supabase):
        first = _login(client, "王小明", _token())
        second = _login(client, "王小明", _token())
        assert first.status_code == 200 and second.status_code == 200
        assert _uid(first) != _uid(second), "同名不同裝置必須是不同帳號，否則等於冒用"

    def test_an_existing_account_cannot_be_reached_by_name_alone(self, client, fake_supabase):
        # 模擬既有使用者：已有帳號、有裝置 token。
        victim_token = _token()
        fake_supabase.seed(TABLE, [{
            "id": "11111111-1111-1111-1111-111111111111",
            "full_name": "受害者", "system_role": "individual",
            "device_token_hash": _hash(victim_token),
        }])
        attacker = _login(client, "受害者", _token())
        assert attacker.status_code == 200
        assert _uid(attacker) != "11111111-1111-1111-1111-111111111111"

    def test_legacy_accounts_without_a_token_are_not_reachable_by_name(self, client, fake_supabase):
        # 改動前建立的帳號沒有 device_token_hash。它們**不該**能被猜名字進入 ——
        # 代價是那些帳號的資料無法再被取回，但沒有任何方式能證明誰是原主。
        fake_supabase.seed(TABLE, [{
            "id": "22222222-2222-2222-2222-222222222222",
            "full_name": "舊帳號", "system_role": "individual",
        }])
        response = _login(client, "舊帳號", _token())
        assert response.status_code == 200
        assert _uid(response) != "22222222-2222-2222-2222-222222222222"


class TestContinuity:
    """同一台裝置回來要接得回自己的紀錄，否則零門檻就沒有意義。"""

    def test_the_same_device_returns_to_the_same_account(self, client, fake_supabase):
        token = _token()
        first = _login(client, "小美", token)
        second = _login(client, "小美", token)
        assert _uid(first) == _uid(second)

    def test_a_renamed_user_keeps_the_same_account(self, client, fake_supabase):
        # 姓名是顯示標籤，改名不該變成另一個人。
        token = _token()
        first = _login(client, "舊名字", token)
        second = _login(client, "新名字", token)
        assert _uid(first) == _uid(second)

    def test_the_new_display_name_is_persisted(self, client, fake_supabase):
        token = _token()
        _login(client, "舊名字", token)
        _login(client, "新名字", token)
        rows = [r for r in fake_supabase.tables[TABLE] if r.get("device_token_hash") == _hash(token)]
        assert len(rows) == 1
        assert rows[0]["full_name"] == "新名字"


class TestTokenHandling:
    def test_the_raw_token_is_never_stored(self, client, fake_supabase):
        token = _token()
        _login(client, "小明", token)
        blob = repr(fake_supabase.tables[TABLE])
        assert token not in blob, "裝置 token 等同密碼，資料庫只該存雜湊"
        assert _hash(token) in blob

    @pytest.mark.parametrize("bad", [None, "", "   ", "short"])
    def test_a_missing_or_too_short_token_is_refused(self, client, fake_supabase, bad):
        # 沒有 token 就無法辨識身分；退回姓名查找等於把漏洞放回來。
        response = _login(client, "小明", bad)
        assert response.status_code == 400

    def test_a_refused_login_creates_no_account(self, client, fake_supabase):
        _login(client, "小明", None)
        assert fake_supabase.tables.get(TABLE, []) == []


class TestOrgLoginUnaffected:
    def test_org_login_does_not_require_a_device_token(self, client, fake_supabase):
        # 組織端走通行碼，與裝置身分無關；不該被這次改動波及。
        from main import pwd_context

        fake_supabase.seed("organizations", [{
            "id": 1, "org_code": "ORG-DEVICE-26-000001", "org_name": "測試",
            "member_pin": pwd_context.hash("right-pin"),
        }])
        response = client.post("/api/auth/login", json={
            "platform": "sleep", "role": "member", "org_code": "ORG-DEVICE-26-000001",
            "name": "成員", "pin": "wrong-pin", "dept": "QA",
        })
        # 通行碼錯誤應該是 401，而不是因為缺 device_token 而 400。
        assert response.status_code == 401
