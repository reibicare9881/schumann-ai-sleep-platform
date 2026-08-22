"""訂閱閘門在真實請求下的行為。

純邏輯由 test_subscription_gate.py 覆蓋；這裡驗證閘門確實裝在端點上 ——
免費個人用戶拿不到 AI 內容、拿不到超過 3 個月的歷史，而企業員工不受影響。

閘門一律在後端執行。前端隱藏按鈕不算閘門：真正付錢的分界線必須是 API 拒絕。
"""

from __future__ import annotations

import hashlib
from datetime import datetime, timedelta, timezone

import pytest

from reibi_subscription_gate import TERMS_VERSION
from support.identities import uid_for

NOW = datetime.now(timezone.utc)
# TokenFactory 以 uid_for(role, tenant) 簽發，tenant 預設 "primary"；
# 少了後綴會得到另一個 uuid，種下的資料就對不上登入身分。
INDIVIDUAL_UID = uid_for("individual", "primary")
MEMBER_UID = uid_for("member", "primary")

SUBSCRIPTION_URL = "/api/reibi/health/subscription"


def _sub(**extra):
    return {
        "id": 1, "member_code": "RBAAAAAA", "profile_id": INDIVIDUAL_UID,
        "plan_code": "annual", "plan_label": "年繳方案(最優惠)", "status": "已核准",
        "requested_at": (NOW - timedelta(days=5)).isoformat(),
        "expires_at": (NOW + timedelta(days=300)).isoformat(),
        "activated_at": (NOW - timedelta(days=4)).isoformat(),
        **extra,
    }


def _reports(uid, *day_offsets):
    return [
        {"id": f"r{index}", "user_id": uid, "org_code": None,
         "created_at": (NOW - timedelta(days=offset)).isoformat()}
        for index, offset in enumerate(day_offsets)
    ]


class TestStatusEndpoint:
    def test_a_free_individual_is_told_they_are_gated(self, client, tokens, fake_supabase):
        data = client.get(SUBSCRIPTION_URL, headers=tokens.header("individual")).json()["data"]
        assert data["access"]["gated"] is True
        assert data["access"]["is_pro"] is False

    def test_a_subscriber_is_pro(self, client, tokens, fake_supabase):
        fake_supabase.seed("reibi_subscriptions", [_sub()])
        data = client.get(SUBSCRIPTION_URL, headers=tokens.header("individual")).json()["data"]
        assert data["access"]["is_pro"] is True
        assert data["access"]["plan_code"] == "annual"

    def test_an_enterprise_member_is_not_gated_at_all(self, client, tokens, fake_supabase):
        data = client.get(SUBSCRIPTION_URL, headers=tokens.header("member")).json()["data"]
        assert data["access"]["gated"] is False
        assert data["access"]["is_pro"] is True

    def test_the_page_carries_the_terms_and_both_feature_lists(self, client, tokens, fake_supabase):
        data = client.get(SUBSCRIPTION_URL, headers=tokens.header("individual")).json()["data"]
        assert data["terms_version"] == TERMS_VERSION
        assert len(data["terms"]) == 5
        assert data["free_features"] and data["pro_features"]

    def test_the_activation_hash_never_reaches_the_browser(self, client, tokens, fake_supabase):
        fake_supabase.seed("reibi_subscriptions", [_sub(activation_code_hash="secret-digest")])
        body = client.get(SUBSCRIPTION_URL, headers=tokens.header("individual")).text
        assert "secret-digest" not in body

    def test_unauthenticated_access_is_rejected(self, client):
        assert client.get(SUBSCRIPTION_URL).status_code == 401


class TestApply:
    URL = f"{SUBSCRIPTION_URL}/apply"

    def _apply(self, client, tokens, role="individual", **extra):
        payload = {"plan_code": "quarterly", "contact": "user@example.com",
                   "agreed_terms_version": TERMS_VERSION, **extra}
        return client.post(self.URL, headers=tokens.header(role), json=payload)

    def test_an_application_is_recorded_as_pending(self, client, tokens, fake_supabase):
        response = self._apply(client, tokens)
        assert response.status_code == 201
        saved = fake_supabase.tables["reibi_subscriptions"][0]
        assert saved["status"] == "待審核"
        assert saved["profile_id"] == INDIVIDUAL_UID

    def test_the_plan_label_is_filled_in_from_the_code(self, client, tokens, fake_supabase):
        self._apply(client, tokens)
        assert fake_supabase.tables["reibi_subscriptions"][0]["plan_label"] == "季繳方案"

    def test_the_agreed_terms_version_is_stored_for_traceability(self, client, tokens, fake_supabase):
        self._apply(client, tokens)
        assert fake_supabase.tables["reibi_subscriptions"][0]["consent_version"] == TERMS_VERSION

    def test_a_stale_terms_version_is_refused(self, client, tokens, fake_supabase):
        assert self._apply(client, tokens, agreed_terms_version="v0-ancient").status_code == 422

    @pytest.mark.parametrize("plan", ["monthly", "quarterly", "annual"])
    def test_all_three_artifact_plans_are_accepted(self, client, tokens, fake_supabase, plan):
        assert self._apply(client, tokens, plan_code=plan).status_code == 201

    def test_a_member_code_is_generated_for_customer_service(self, client, tokens, fake_supabase):
        self._apply(client, tokens)
        code = fake_supabase.tables["reibi_subscriptions"][0]["member_code"]
        assert code.startswith("RB") and len(code) == 8

    def test_an_enterprise_member_cannot_apply(self, client, tokens, fake_supabase):
        assert self._apply(client, tokens, role="member").status_code == 409

    def test_applying_twice_while_one_is_pending_is_refused(self, client, tokens, fake_supabase):
        self._apply(client, tokens)
        assert self._apply(client, tokens).status_code == 409

    def test_an_active_subscriber_is_not_asked_to_apply_again(self, client, tokens, fake_supabase):
        fake_supabase.seed("reibi_subscriptions", [_sub()])
        assert self._apply(client, tokens).status_code == 409


class TestActivate:
    URL = f"{SUBSCRIPTION_URL}/activate"
    CODE = "RB-test-activation-code"

    @pytest.fixture
    def unclaimed(self, fake_supabase):
        fake_supabase.seed("reibi_subscriptions", [_sub(
            profile_id=None, activated_at=None,
            activation_code_hash=hashlib.sha256(self.CODE.encode("utf-8")).hexdigest(),
        )])
        return fake_supabase

    def _activate(self, client, tokens, code=CODE, role="individual"):
        return client.post(self.URL, headers=tokens.header(role), json={"activation_code": code})

    def test_a_valid_code_claims_the_subscription(self, client, tokens, unclaimed):
        response = self._activate(client, tokens)
        assert response.status_code == 200
        assert response.json()["data"]["access"]["is_pro"] is True

    def test_claiming_records_who_and_when(self, client, tokens, unclaimed):
        self._activate(client, tokens)
        saved = unclaimed.tables["reibi_subscriptions"][0]
        assert saved["profile_id"] == INDIVIDUAL_UID
        assert saved["activated_at"]

    def test_a_code_cannot_be_used_twice(self, client, tokens, unclaimed):
        assert self._activate(client, tokens).status_code == 200
        assert self._activate(client, tokens).status_code == 422

    def test_an_unknown_code_is_refused(self, client, tokens, unclaimed):
        assert self._activate(client, tokens, code="RB-not-a-real-code").status_code == 422

    def test_an_unknown_and_a_used_code_are_indistinguishable(self, client, tokens, unclaimed):
        # 分別回不同訊息等於讓人可以試出哪些碼存在。
        self._activate(client, tokens)
        used = self._activate(client, tokens).json()["detail"]
        unknown = self._activate(client, tokens, code="RB-nope").json()["detail"]
        assert used == unknown

    def test_a_subscription_still_awaiting_review_cannot_be_activated(self, client, tokens, fake_supabase):
        fake_supabase.seed("reibi_subscriptions", [_sub(
            profile_id=None, activated_at=None, status="待審核",
            activation_code_hash=hashlib.sha256(self.CODE.encode("utf-8")).hexdigest(),
        )])
        assert self._activate(client, tokens).status_code == 409

    def test_the_plain_code_is_never_stored(self, client, tokens, unclaimed):
        self._activate(client, tokens)
        assert self.CODE not in str(unclaimed.tables["reibi_subscriptions"][0])


class TestHistoryIsLimited:
    URL = "/api/sleep/reports"

    def _get(self, client, tokens, role="individual", uid=INDIVIDUAL_UID):
        return client.get(self.URL, params={"user_id": uid}, headers=tokens.header(role))

    @pytest.fixture
    def seeded(self, fake_supabase):
        fake_supabase.seed("profiles", [
            {"id": INDIVIDUAL_UID, "org_code": None},
            {"id": MEMBER_UID, "org_code": "TESTORG"},
        ])
        fake_supabase.seed("sleep_reports", _reports(INDIVIDUAL_UID, 1, 40, 200, 400))
        return fake_supabase

    def test_a_free_individual_only_receives_the_recent_window(self, client, tokens, seeded):
        body = self._get(client, tokens).json()
        assert body["count"] == 2
        assert body["hidden_count"] == 2
        assert body["history_limited"] is True

    def test_the_hidden_records_are_reported_not_silently_dropped(self, client, tokens, seeded):
        # Artifact 明確告訴使用者「您還有 N 筆較早的評估記錄已保留」。
        assert self._get(client, tokens).json()["hidden_count"] == 2

    def test_a_subscriber_receives_everything(self, client, tokens, seeded):
        seeded.seed("reibi_subscriptions", [_sub()])
        body = self._get(client, tokens).json()
        assert body["count"] == 4
        assert body["hidden_count"] == 0
        assert body["history_limited"] is False

    def test_an_expired_subscriber_is_limited_again_but_keeps_their_data(self, client, tokens, seeded):
        seeded.seed("reibi_subscriptions", [_sub(expires_at=(NOW - timedelta(days=1)).isoformat())])
        body = self._get(client, tokens).json()
        assert body["count"] == 2
        assert body["hidden_count"] == 2
        # 降級只是讀不到；資料列一筆都沒有被刪除。
        assert len(seeded.tables["sleep_reports"]) == 4

    def test_an_enterprise_member_is_never_limited(self, client, tokens, seeded):
        seeded.seed("sleep_reports", _reports(MEMBER_UID, 1, 400))
        body = self._get(client, tokens, role="member", uid=MEMBER_UID).json()
        assert body["hidden_count"] == 0


class TestTrendReportIsGated:
    def _post(self, client, tokens, role="individual", uid=INDIVIDUAL_UID):
        return client.post(f"/api/ai-trend/{uid}", headers=tokens.header(role))

    @pytest.fixture
    def seeded(self, fake_supabase):
        fake_supabase.seed("profiles", [{"id": INDIVIDUAL_UID, "org_code": None}])
        return fake_supabase

    def test_a_free_individual_is_refused_with_payment_required(self, client, tokens, seeded):
        response = self._post(client, tokens)
        # 402 而不是 403：這是付費牆，不是「你不該來這裡」。
        assert response.status_code == 402
        assert "訂閱版" in response.json()["detail"]

    def test_the_refusal_happens_before_any_ai_call(self, client, tokens, seeded):
        # 沒有歷史資料時本來會回 400；先回 402 表示閘門擋在資料查詢與 Gemini 之前。
        assert self._post(client, tokens).status_code == 402

    def test_an_expired_subscriber_is_refused(self, client, tokens, seeded):
        seeded.seed("reibi_subscriptions", [_sub(expires_at=(NOW - timedelta(days=1)).isoformat())])
        assert self._post(client, tokens).status_code == 402

    def test_a_subscriber_gets_past_the_gate(self, client, tokens, seeded):
        seeded.seed("reibi_subscriptions", [_sub()])
        # 通過閘門後因為沒有足夠歷史資料而回 400 —— 這正好證明閘門已經放行。
        assert self._post(client, tokens).status_code == 400
