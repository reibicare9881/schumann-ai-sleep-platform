"""L5 站內操作手冊（Artifact ManualScreen 的六個分頁）。

Artifact 的手冊是手寫的，而手寫的東西已經跟系統對不上：它的「分潤規則」分頁寫
「年累積 A+C 層簽約額」，與它自己的程式碼矛盾；兩條 FAQ 描述的是 Artifact 的限制
（LINE 為模擬記錄、大數據為示範資料）；三條緊急操作在講已經停用的共用 PIN 制。

所以這一頁的重點不是「有沒有搬」，而是**會變的內容必須由程式產生**。
這些測試守的就是那件事：角色表等於 registry、分潤比例等於計價模組，
而且不得混進已作廢的說法。
"""

from __future__ import annotations

from decimal import Decimal

import pytest

from reibi_batch_c import COMMISSION_LEVELS, COMMISSION_TIER_THRESHOLDS
from reibi_manual import build_manual
from roles import PERMISSION_LABELS, ROLE_DEFINITIONS, missing_permission_labels

MANUAL = build_manual()
OBSOLETE_PHRASES = (
    "模擬記錄", "模擬示範", "示範數據", "手動發至",     # Artifact 當時的限制，現已不成立
    "備用碼", "initPin", "memberPin", "deptPin", "adminPin",  # 共用 PIN 制已停用
)


def _all_text(value) -> str:
    if isinstance(value, dict):
        return " ".join(_all_text(item) for item in value.values())
    if isinstance(value, (list, tuple)):
        return " ".join(_all_text(item) for item in value)
    return str(value)


class TestPermissionLabels:
    def test_every_permission_in_use_has_a_plain_language_label(self):
        # 沒補說明的權限會在角色表上顯示成程式代碼，等於沒寫。
        assert missing_permission_labels() == []

    def test_no_label_is_left_blank(self):
        assert all(label.strip() for label in PERMISSION_LABELS.values())


class TestRolesAreGenerated:
    def test_the_table_lists_exactly_the_registered_roles(self):
        keys = [row["key"] for row in MANUAL["roles"]["items"]]
        assert keys == list(ROLE_DEFINITIONS)

    def test_each_role_carries_readable_permissions_not_bare_codes(self):
        for row in MANUAL["roles"]["items"]:
            assert len(row["permission_labels"]) == len(row["permissions"])
            for label in row["permission_labels"]:
                assert label not in row["permissions"], "權限顯示成代碼，代表少了說明"

    def test_scope_requirements_are_spelled_out(self):
        by_key = {row["key"]: row for row in MANUAL["roles"]["items"]}
        assert "需綁定單位" in by_key["admin"]["scopes"]
        assert "需綁定經銷商" in by_key["partner_primary"]["scopes"]
        assert by_key["individual"]["scopes"] == []

    def test_a_new_role_would_appear_without_editing_the_manual(self):
        # 表由 registry 產生，不是另一份靜態複本 —— Artifact 手寫的那份就脫節了。
        assert len(MANUAL["roles"]["items"]) == len(ROLE_DEFINITIONS)

    def test_the_audit_note_is_present(self):
        assert "稽核" in MANUAL["roles"]["audit_note"]


class TestCommissionSectionIsGenerated:
    def test_percentages_come_from_the_pricing_module(self):
        by_key = {layer["key"]: layer for layer in MANUAL["commission"]["layers"]}
        for key in ("a", "b", "c"):
            shown = {row["level"]: row["percent"] for row in by_key[key]["percentages"]}
            expected = {level: COMMISSION_LEVELS[level][key] for level in COMMISSION_LEVELS}
            assert shown == expected

    def test_all_four_tiers_are_shown_for_every_layer(self):
        for layer in MANUAL["commission"]["layers"]:
            assert [row["level"] for row in layer["percentages"]] == ["silver", "gold", "platinum", "strategic"]

    def test_thresholds_come_from_the_pricing_module(self):
        shown = [(row["from_level"], row["to_level"], row["threshold"]) for row in MANUAL["commission"]["thresholds"]]
        assert shown == list(COMMISSION_TIER_THRESHOLDS)

    def test_the_a_plus_c_error_from_the_artifact_manual_is_not_reproduced(self):
        # Artifact 手冊 3920 行寫「年累積 A+C 層簽約額」，與它的程式碼矛盾。
        note = MANUAL["commission"]["basis_note"]
        assert "僅計 A 層" in note
        assert "A+C" not in note

    def test_the_layers_state_which_one_advances_the_tier(self):
        by_key = {layer["key"]: layer for layer in MANUAL["commission"]["layers"]}
        assert "升級" in by_key["a"]["note"]
        assert "不推進升級" in by_key["b"]["note"]
        assert "不推進升級" in by_key["c"]["note"]

    def test_the_guardrail_is_explained(self):
        assert "保留" in MANUAL["commission"]["guardrail_note"]

    def test_the_strategic_tier_is_shown_as_a_reference_only(self):
        assert MANUAL["commission"]["strategic_reference"] == Decimal("50000000")


class TestSettlementTimeline:
    def test_all_three_dates_are_kept(self):
        timeline = MANUAL["settlement"]["timeline"]
        assert [row["when"] for row in timeline] == ["每月 30 日", "隔月 10 日", "隔月 15 日"]

    def test_each_step_says_what_happens(self):
        assert all(row["title"] and row["detail"] for row in MANUAL["settlement"]["timeline"])

    def test_the_sub_distributor_split_is_explained(self):
        # 「次級與主經銷商的分潤由系統自動算好，不需人工分配」是實際會被問到的規則。
        assert "自動計算" in _all_text(MANUAL["settlement"])


class TestObsoleteContentIsNotCopied:
    @pytest.mark.parametrize("phrase", OBSOLETE_PHRASES)
    def test_no_obsolete_artifact_wording_survives(self, phrase):
        assert phrase not in _all_text(MANUAL)

    def test_onboarding_states_that_shared_pins_are_gone(self):
        assert "共用 PIN" in _all_text(MANUAL["onboarding"])

    def test_onboarding_describes_invitation_and_mfa_instead(self):
        text = _all_text(MANUAL["onboarding"])
        assert "邀請" in text and "TOTP" in text

    def test_the_faq_answers_the_tier_question_with_the_corrected_rule(self):
        answers = " ".join(row["a"] for row in MANUAL["faq"])
        assert "僅計 A 層" in answers

    def test_emergency_procedures_do_not_reference_pin_resets(self):
        assert "PIN" not in _all_text(MANUAL["emergency"])

    def test_emergency_still_covers_a_compromised_account(self):
        assert "撤銷" in _all_text(MANUAL["emergency"])


class TestShape:
    @pytest.mark.parametrize("section", ["roles", "onboarding", "settlement", "commission", "faq", "emergency"])
    def test_all_six_artifact_tabs_are_present(self, section):
        assert MANUAL[section]

    def test_every_faq_has_both_a_question_and_an_answer(self):
        assert all(row["q"].strip() and row["a"].strip() for row in MANUAL["faq"])

    def test_building_twice_gives_the_same_content(self):
        assert build_manual() == MANUAL


class TestEndpoint:
    URL = "/api/reibi/l5/manual"

    @pytest.mark.parametrize("role", ["reibi_super", "reibi_finance", "reibi_data", "reibi_cs"])
    def test_internal_roles_can_read_it(self, client, tokens, role):
        assert client.get(self.URL, headers=tokens.header(role)).status_code == 200

    @pytest.mark.parametrize("role", ["partner_primary", "partner_sub"])
    def test_distributors_can_read_it_too(self, client, tokens, role):
        # 手冊的用途是讓操作的人查得到規則；經銷商也要對月結與分潤。
        assert client.get(self.URL, headers=tokens.header(role)).status_code == 200

    @pytest.mark.parametrize("role", ["member", "individual", "dept_head", "admin"])
    def test_roles_outside_l5_are_refused(self, client, tokens, role):
        assert client.get(self.URL, headers=tokens.header(role)).status_code == 403

    def test_unauthenticated_access_is_rejected(self, client):
        assert client.get(self.URL).status_code == 401

    def test_the_response_carries_no_enterprise_or_personal_data(self, client, tokens):
        body = client.get(self.URL, headers=tokens.header("partner_primary")).text
        for leak in ("org_code", "member_code", "phone", "email"):
            assert leak not in body
