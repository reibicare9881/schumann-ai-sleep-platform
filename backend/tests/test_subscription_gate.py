"""個人訂閱功能閘門（Artifact isPro／effectiveSubStatus）。

新系統原本沒有這道門：前端搜尋 isPro、isFreeIndividual、「訂閱版」皆零結果，
免費個人用戶拿得到全部功能，包含每份要跑 Gemini 的 AI 個人報告。L5 那半套
（申請、審核、一次性啟用碼、到期）早就完成，缺的只有使用者這一端。

這些測試釘住三件事：企業員工不受管轄、到期是延遲判定而非改寫資料、
免費版的 3 個月限制會誠實回報被隱藏的筆數。
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from reibi_subscription_gate import (
    ACTIVE_STATUS,
    EXPIRY_REMINDER_DAYS,
    FREE_HISTORY_MONTHS,
    TERMS_POINTS,
    TERMS_VERSION,
    effective_status,
    history_cutoff,
    limit_history,
    pick_current,
    resolve,
    subscription_page_payload,
)

NOW = datetime(2026, 8, 19, 12, 0, tzinfo=timezone.utc)


def _sub(status=ACTIVE_STATUS, *, days=90, requested_days_ago=1, **extra):
    return {
        "status": status,
        "expires_at": (NOW + timedelta(days=days)).isoformat(),
        "requested_at": (NOW - timedelta(days=requested_days_ago)).isoformat(),
        "plan_code": "annual",
        "member_code": "RB0001",
        **extra,
    }


class TestWhoTheGateApplies:
    @pytest.mark.parametrize("role", ["member", "dept_head", "admin", "admin_hr", "reibi_super", "partner_primary"])
    def test_enterprise_roles_are_never_gated(self, role):
        access = resolve(role, [], as_of=NOW)
        assert access["gated"] is False
        assert access["is_pro"] is True

    def test_an_enterprise_role_stays_pro_even_with_an_expired_subscription(self):
        access = resolve("admin", [_sub(days=-10)], as_of=NOW)
        assert access["is_pro"] is True

    def test_an_enterprise_role_is_told_why_rather_than_shown_a_blank(self):
        assert resolve("member", [], as_of=NOW)["reason"]

    def test_an_individual_is_gated(self):
        assert resolve("individual", [], as_of=NOW)["gated"] is True

    def test_an_individual_without_any_subscription_is_not_pro(self):
        access = resolve("individual", [], as_of=NOW)
        assert access["is_pro"] is False
        assert access["status"] is None

    @pytest.mark.parametrize("role", [None, "", "unknown_role"])
    def test_an_unrecognised_role_is_not_treated_as_an_individual(self, role):
        # 只有明確是 individual 才受管轄；未知角色不該因為「不認識」就被降級。
        assert resolve(role, [], as_of=NOW)["gated"] is False


class TestEffectiveStatus:
    def test_an_approved_subscription_in_date_is_active(self):
        assert effective_status(_sub(), as_of=NOW) == ACTIVE_STATUS

    def test_an_approved_subscription_past_its_date_reads_as_expired(self):
        assert effective_status(_sub(days=-1), as_of=NOW) == "已到期"

    def test_expiry_is_evaluated_on_read_and_never_written_back(self):
        record = _sub(days=-1)
        before = dict(record)
        effective_status(record, as_of=NOW)
        assert record == before  # 到期自動降級，但資料一個字都不改

    @pytest.mark.parametrize("status", ["待審核", "已拒絕"])
    def test_other_statuses_pass_through_unchanged(self, status):
        assert effective_status(_sub(status), as_of=NOW) == status

    def test_no_subscription_has_no_status(self):
        assert effective_status(None, as_of=NOW) is None

    def test_an_approved_subscription_without_an_expiry_stays_active(self):
        assert effective_status({"status": ACTIVE_STATUS, "expires_at": None}, as_of=NOW) == ACTIVE_STATUS

    @pytest.mark.parametrize("bad", ["", "not-a-date", 12345])
    def test_an_unparseable_expiry_does_not_crash_or_expire(self, bad):
        assert effective_status({"status": ACTIVE_STATUS, "expires_at": bad}, as_of=NOW) == ACTIVE_STATUS


class TestPickingTheCurrentSubscription:
    def test_an_active_subscription_wins_over_an_expired_one(self):
        current = pick_current([_sub(days=-30), _sub(days=30)], as_of=NOW)
        assert effective_status(current, as_of=NOW) == ACTIVE_STATUS

    def test_the_latest_expiry_wins_among_active_ones(self):
        current = pick_current([_sub(days=30), _sub(days=200)], as_of=NOW)
        assert current["expires_at"] == (NOW + timedelta(days=200)).isoformat()

    def test_with_nothing_active_the_most_recent_request_is_shown(self):
        current = pick_current([
            _sub("已拒絕", requested_days_ago=90), _sub("待審核", requested_days_ago=1),
        ], as_of=NOW)
        assert current["status"] == "待審核"

    @pytest.mark.parametrize("rows", [[], None, "nope", [None, "x"]])
    def test_malformed_input_yields_nothing_rather_than_an_error(self, rows):
        assert pick_current(rows, as_of=NOW) is None


class TestExpiryReminder:
    def test_a_subscription_expiring_inside_the_window_is_flagged(self):
        access = resolve("individual", [_sub(days=10)], as_of=NOW)
        assert access["expiring_soon"] is True
        assert access["days_left"] == 10

    def test_a_subscription_well_inside_its_term_is_not_flagged(self):
        assert resolve("individual", [_sub(days=200)], as_of=NOW)["expiring_soon"] is False

    def test_the_window_is_the_documented_thirty_days(self):
        assert EXPIRY_REMINDER_DAYS == 30
        assert resolve("individual", [_sub(days=30)], as_of=NOW)["expiring_soon"] is True
        assert resolve("individual", [_sub(days=31)], as_of=NOW)["expiring_soon"] is False

    def test_an_already_expired_subscription_is_not_reported_as_expiring_soon(self):
        # 已到期是另一種狀態，不該再顯示「即將到期」的提醒。
        access = resolve("individual", [_sub(days=-5)], as_of=NOW)
        assert access["expiring_soon"] is False
        assert access["is_pro"] is False
        assert access["status"] == "已到期"

    def test_days_left_is_not_reported_for_a_non_pro_account(self):
        assert resolve("individual", [_sub("待審核")], as_of=NOW)["days_left"] is None


class TestHistoryLimit:
    def _rows(self, *day_offsets):
        return [{"created_at": (NOW - timedelta(days=offset)).isoformat()} for offset in day_offsets]

    def test_a_free_individual_only_sees_the_recent_window(self):
        access = resolve("individual", [], as_of=NOW)
        result = limit_history(self._rows(1, 30, 200), access, as_of=NOW)
        assert len(result["rows"]) == 2
        assert result["hidden_count"] == 1

    def test_the_window_is_the_documented_three_months(self):
        assert FREE_HISTORY_MONTHS == 3

    def test_a_subscriber_sees_everything(self):
        access = resolve("individual", [_sub()], as_of=NOW)
        result = limit_history(self._rows(1, 30, 200, 2000), access, as_of=NOW)
        assert result["hidden_count"] == 0
        assert result["limited"] is False

    def test_an_enterprise_member_sees_everything(self):
        access = resolve("member", [], as_of=NOW)
        assert limit_history(self._rows(1, 900), access, as_of=NOW)["hidden_count"] == 0

    def test_hidden_records_are_counted_so_the_user_is_told_they_still_exist(self):
        access = resolve("individual", [], as_of=NOW)
        result = limit_history(self._rows(*range(100, 130)), access, as_of=NOW)
        assert result["hidden_count"] == 30
        assert result["rows"] == []

    def test_rows_without_a_timestamp_are_kept_rather_than_silently_dropped(self):
        access = resolve("individual", [], as_of=NOW)
        result = limit_history([{"created_at": None}, {}], access, as_of=NOW)
        assert len(result["rows"]) == 2
        assert result["hidden_count"] == 0

    def test_an_alternative_timestamp_field_can_be_used(self):
        access = resolve("individual", [], as_of=NOW)
        rows = [{"ts": (NOW - timedelta(days=400)).isoformat()}]
        assert limit_history(rows, access, field="ts", as_of=NOW)["hidden_count"] == 1

    def test_there_is_no_cutoff_for_a_subscriber(self):
        assert history_cutoff(resolve("individual", [_sub()], as_of=NOW), as_of=NOW) is None

    @pytest.mark.parametrize("rows", [None, "nope", 5])
    def test_malformed_rows_do_not_crash_the_limiter(self, rows):
        access = resolve("individual", [], as_of=NOW)
        assert limit_history(rows, access, as_of=NOW)["rows"] == []


class TestSubscriptionPageContent:
    def test_the_terms_version_is_recorded_so_consent_is_attributable(self):
        assert TERMS_VERSION == "v1-20260705"

    def test_all_five_artifact_terms_are_present(self):
        assert len(TERMS_POINTS) == 5
        assert all(point.strip() for point in TERMS_POINTS)

    def test_the_payload_carries_both_feature_lists_and_the_current_state(self):
        payload = subscription_page_payload(resolve("individual", [], as_of=NOW))
        assert payload["free_features"] and payload["pro_features"]
        assert payload["access"]["is_pro"] is False
        assert payload["free_history_months"] == FREE_HISTORY_MONTHS

    def test_the_gated_features_are_not_also_advertised_as_free(self):
        payload = subscription_page_payload(resolve("individual", [], as_of=NOW))
        free = " ".join(payload["free_features"])
        assert "AI 六面向" not in free
        assert "年度改善" not in free
