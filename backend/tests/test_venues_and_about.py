"""體驗場域與關於 REIBI（Artifact VenueScreen／AboutREIBIScreen）。

兩者目前都是**佔位內容**，正式資料與文案待業務端提供。這些測試守的不是內容，
而是「佔位不會被誤當成定稿」：

* 場域 —— 佔位資料**不可被預約**。編造的地址若上線，會有人照著跑一趟。
* 關於 —— 未定稿的分頁必須帶旗標，前端才能顯示警示。生成看起來可信的公司使命宣言
  比留白更危險：留白會被補上，看起來完成的東西不會。

另外釘住「首次免費體驗每人限一次」—— Artifact 把那句話寫在畫面上但從未檢查過額度。
"""

from __future__ import annotations

import pytest

from reibi_about import PLACEHOLDER_NOTICE, build_about
from reibi_batch_e import PLAN_888_TIMELINE
from reibi_venues import (
    FREE_VISIT_SCOPE,
    build_venue_payload,
    normalise_venue,
    venue_rejection_reason,
)

ABOUT = build_about()


def _venue(**extra):
    return {
        "id": 1, "slug": "v1", "city": "台北", "name": "體驗中心",
        "address": "某處", "area": "某區", "transport": ["捷運某站"],
        "opening_hours": "09:00-18:00", "services": ["舒曼波體驗"], "note": None,
        "first_visit_free": True, "is_placeholder": False, "is_active": True, "sort_order": 1,
        **extra,
    }


class TestPlaceholderVenuesCannotBeBooked:
    def test_a_placeholder_venue_is_not_bookable(self):
        assert normalise_venue(_venue(is_placeholder=True))["bookable"] is False

    def test_a_placeholder_venue_never_offers_a_free_visit(self):
        # 即使資料上寫 first_visit_free=true，佔位場域也不該對外承諾任何東西。
        venue = normalise_venue(_venue(is_placeholder=True, first_visit_free=True))
        assert venue["first_visit_free"] is False

    def test_a_confirmed_venue_is_bookable(self):
        assert normalise_venue(_venue())["bookable"] is True

    def test_an_inactive_venue_is_not_bookable(self):
        assert normalise_venue(_venue(is_active=False))["bookable"] is False

    @pytest.mark.parametrize(("venue", "expected"), [
        (None, "找不到"),
        ({"is_placeholder": True, "is_active": True}, "尚未確認"),
        ({"is_placeholder": False, "is_active": False}, "未開放"),
    ])
    def test_rejection_reasons_are_specific(self, venue, expected):
        reason = venue_rejection_reason(venue)
        assert reason and expected in reason

    def test_a_bookable_venue_has_no_rejection_reason(self):
        assert venue_rejection_reason(normalise_venue(_venue())) is None


class TestVenuePayload:
    def test_placeholders_are_counted_and_announced(self):
        payload = build_venue_payload([_venue(is_placeholder=True)], free_visit_used=False)
        assert payload["placeholder_count"] == 1
        assert payload["placeholder_notice"]

    def test_no_notice_when_every_venue_is_confirmed(self):
        payload = build_venue_payload([_venue()], free_visit_used=False)
        assert payload["placeholder_count"] == 0
        assert payload["placeholder_notice"] is None

    def test_the_free_visit_is_unavailable_once_used(self):
        payload = build_venue_payload([_venue()], free_visit_used=True)
        assert payload["free_visit"]["used"] is True
        assert payload["free_visit"]["available"] is False

    def test_the_free_visit_is_available_when_unused_and_a_venue_offers_it(self):
        payload = build_venue_payload([_venue()], free_visit_used=False)
        assert payload["free_visit"]["available"] is True

    def test_the_free_visit_is_unavailable_when_only_placeholders_exist(self):
        # 沒有任何真的可去的地方，就不該顯示「您還有一次免費體驗」。
        payload = build_venue_payload([_venue(is_placeholder=True)], free_visit_used=False)
        assert payload["free_visit"]["available"] is False

    def test_the_quota_is_per_person_not_per_venue(self):
        assert FREE_VISIT_SCOPE == "per_person"
        assert "每人限一次" in build_venue_payload([], False)["free_visit"]["note"]

    @pytest.mark.parametrize("rows", [None, "nope", 5])
    def test_malformed_rows_do_not_crash(self, rows):
        assert build_venue_payload(rows, False)["venues"] == []

    def test_array_fields_survive_and_non_arrays_are_dropped(self):
        venue = normalise_venue(_venue(transport="not-a-list", services=["A", "B"]))
        assert venue["transport"] == []
        assert venue["services"] == ["A", "B"]


class TestAboutPlaceholdersAreDeclared:
    def test_all_five_artifact_tabs_are_present(self):
        assert [tab["key"] for tab in ABOUT["tabs"]] == ["mission", "framework", "stakeholder", "sdg", "plan888"]

    @pytest.mark.parametrize("key", ["mission", "framework", "stakeholder"])
    def test_the_three_undrafted_tabs_are_flagged(self, key):
        tab = next(t for t in ABOUT["tabs"] if t["key"] == key)
        assert tab["is_placeholder"] is True

    @pytest.mark.parametrize("key", ["sdg", "plan888"])
    def test_the_two_derivable_tabs_are_not_flagged(self, key):
        tab = next(t for t in ABOUT["tabs"] if t["key"] == key)
        assert tab["is_placeholder"] is False

    def test_the_placeholder_count_is_reported_rather_than_left_to_be_counted(self):
        assert ABOUT["placeholder_count"] == 3

    def test_the_notice_warns_against_external_use(self):
        assert "請勿對外引用" in PLACEHOLDER_NOTICE

    def test_placeholder_copy_reads_as_a_prompt_not_as_finished_text(self):
        # 佔位文案應該長得像「這裡要放什麼」，而不是一段可以直接拿去用的宣言。
        mission = next(t for t in ABOUT["tabs"] if t["key"] == "mission")
        assert all("（待填" in section["body"] for section in mission["sections"])


class TestAboutDerivedContent:
    def test_the_888_timeline_comes_from_the_analytics_definition(self):
        tab = next(t for t in ABOUT["tabs"] if t["key"] == "plan888")
        assert [row["week"] for row in tab["timeline"]] == [row["week"] for row in PLAN_888_TIMELINE]
        assert [row["title"] for row in tab["timeline"]] == [row["title"] for row in PLAN_888_TIMELINE]

    def test_the_888_tab_says_where_its_timeline_comes_from(self):
        tab = next(t for t in ABOUT["tabs"] if t["key"] == "plan888")
        assert "同一份定義" in tab["source_note"]

    def test_all_four_sdgs_are_covered(self):
        tab = next(t for t in ABOUT["tabs"] if t["key"] == "sdg")
        assert [item["code"] for item in tab["items"]] == ["SDG 3", "SDG 8", "SDG 10", "SDG 17"]

    def test_the_three_eighties_are_described(self):
        tab = next(t for t in ABOUT["tabs"] if t["key"] == "plan888")
        assert len(tab["three_80"]) == 3


class TestEndpoints:
    def test_about_is_open_to_any_signed_in_user(self, client, tokens):
        assert client.get("/api/reibi/health/about", headers=tokens.header("individual")).status_code == 200

    def test_about_requires_a_session(self, client):
        assert client.get("/api/reibi/health/about").status_code == 401

    def test_venues_are_listed_for_a_personal_user(self, client, tokens, fake_supabase):
        fake_supabase.seed("reibi_experience_venues", [_venue()])
        body = client.get("/api/reibi/health/venues", headers=tokens.header("individual")).json()
        assert len(body["data"]["venues"]) == 1

    def test_venues_require_a_session(self, client):
        assert client.get("/api/reibi/health/venues").status_code == 401

    def test_a_used_quota_is_reflected_in_the_response(self, client, tokens, fake_supabase):
        from support.identities import uid_for

        fake_supabase.seed("reibi_experience_venues", [_venue()])
        fake_supabase.seed("reibi_venue_free_visits", [{"profile_id": uid_for("individual", "primary")}])
        body = client.get("/api/reibi/health/venues", headers=tokens.header("individual")).json()
        assert body["data"]["free_visit"]["used"] is True
