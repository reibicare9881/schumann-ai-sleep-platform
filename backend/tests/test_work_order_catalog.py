"""D 層施工項目目錄與逐條驗收（Artifact reibi-workorder_v1_4 的 D_ITEMS）。

Artifact 的工單項目不是自由文字：六個 D 層項目各自帶著單位、預設數量、規格選項、
交付項目與驗收標準，而驗收畫面就是把選中項目的 acceptCriteria 攤平成逐條勾核清單，
用「已通過／總條數」算進度，全數通過才允許按下「驗收通過」。

新系統原本只有 name／spec／quantity／note 四個自由欄位，驗收退化成每項一個 pass/fail。
這些測試把目錄與逐條規則釘住。
"""

from __future__ import annotations

import pytest

from reibi_work_order_catalog import (
    CATALOG_BY_KEY,
    WORK_ORDER_ITEM_CATALOG,
    acceptance_checklist,
    catalog_payload,
    default_items_from_quote_config,
    unknown_check_ids,
)

ARTIFACT_KEYS = ("poster", "board", "display", "qr", "digital", "install")


def _items(*keys: str, quantities: dict | None = None, specs: dict | None = None) -> dict:
    return {
        "selectedItems": {key: True for key in keys},
        "itemQty": quantities or {},
        "itemSpecs": specs or {},
    }


def _checks(**results: str) -> dict:
    return {"acceptChecks": dict(results)}


def _all_pass(*keys: str) -> dict:
    return {
        "acceptChecks": {
            f"{key}:{index}": "pass"
            for key in keys
            for index in range(len(CATALOG_BY_KEY[key]["accept_criteria"]))
        }
    }


class TestCatalogMatchesArtifact:
    def test_all_six_artifact_items_are_present_in_order(self):
        assert tuple(item["key"] for item in WORK_ORDER_ITEM_CATALOG) == ARTIFACT_KEYS

    @pytest.mark.parametrize(("key", "unit", "quantity"), [
        ("poster", "張", 6), ("board", "組", 1), ("display", "組", 1),
        ("qr", "組", 1), ("digital", "支", 10), ("install", "次", 1),
    ])
    def test_units_and_default_quantities_match(self, key, unit, quantity):
        assert CATALOG_BY_KEY[key]["unit"] == unit
        assert CATALOG_BY_KEY[key]["default_quantity"] == quantity

    def test_every_item_carries_specs_deliverables_and_criteria(self):
        for item in WORK_ORDER_ITEM_CATALOG:
            assert item["specs"], f"{item['key']} 少了規格選項"
            assert item["deliverables"], f"{item['key']} 少了交付項目"
            assert item["accept_criteria"], f"{item['key']} 少了驗收標準"

    def test_spec_options_are_never_empty(self):
        for item in WORK_ORDER_ITEM_CATALOG:
            for spec in item["specs"]:
                assert spec["options"], f"{item['key']}.{spec['key']} 沒有可選值"

    def test_payload_is_json_friendly_lists(self):
        payload = catalog_payload()
        assert [row["key"] for row in payload] == list(ARTIFACT_KEYS)
        first = payload[0]
        assert isinstance(first["deliverables"], list)
        assert isinstance(first["specs"][0]["options"], list)

    def test_poster_criteria_match_the_artifact_wording(self):
        assert CATALOG_BY_KEY["poster"]["accept_criteria"] == (
            "尺寸正確", "顏色符合打樣", "內容無誤", "數量完整",
        )


class TestChecklistProgress:
    def test_nothing_selected_means_no_checks(self):
        result = acceptance_checklist({}, {})
        assert result["total"] == 0
        assert result["all_passed"] is False
        assert result["percent"] == 0

    def test_total_counts_every_criterion_of_every_selected_item(self):
        result = acceptance_checklist(_items("poster", "qr"), {})
        expected = len(CATALOG_BY_KEY["poster"]["accept_criteria"]) + len(CATALOG_BY_KEY["qr"]["accept_criteria"])
        assert result["total"] == expected

    def test_passed_and_failed_are_counted_separately(self):
        result = acceptance_checklist(_items("poster"), _checks(**{"poster:0": "pass", "poster:1": "fail"}))
        assert (result["passed"], result["failed"]) == (1, 1)

    def test_percent_tracks_passed_over_total(self):
        result = acceptance_checklist(_items("poster"), _checks(**{"poster:0": "pass", "poster:1": "pass"}))
        assert result["percent"] == 50  # 海報有 4 條標準

    def test_all_passed_only_when_every_criterion_passes(self):
        partial = acceptance_checklist(_items("poster"), _checks(**{"poster:0": "pass"}))
        assert partial["all_passed"] is False
        complete = acceptance_checklist(_items("poster"), _all_pass("poster"))
        assert complete["all_passed"] is True

    def test_a_failed_criterion_blocks_all_passed_even_when_the_rest_pass(self):
        checks = _all_pass("poster")
        checks["acceptChecks"]["poster:2"] = "fail"
        assert acceptance_checklist(_items("poster"), checks)["all_passed"] is False

    def test_unrecognised_result_values_are_treated_as_unchecked(self):
        result = acceptance_checklist(_items("poster"), _checks(**{"poster:0": "maybe"}))
        assert result["passed"] == 0
        assert result["groups"][0]["checks"][0]["result"] is None

    def test_groups_report_quantity_from_the_work_order_then_the_catalog_default(self):
        result = acceptance_checklist(_items("poster", "digital", quantities={"poster": 12}), {})
        by_key = {group["key"]: group for group in result["groups"]}
        assert by_key["poster"]["quantity"] == 12
        assert by_key["digital"]["quantity"] == 10

    @pytest.mark.parametrize("bad", [0, -3, "六", None])
    def test_unusable_quantities_fall_back_to_the_catalog_default(self, bad):
        result = acceptance_checklist(_items("poster", quantities={"poster": bad}), {})
        assert result["groups"][0]["quantity"] == 6

    def test_selected_specs_are_reported_and_blanks_dropped(self):
        specs = {"poster": {"size": "A1(594×841mm)", "material": ""}}
        group = acceptance_checklist(_items("poster", specs=specs), {})["groups"][0]
        assert group["specs"] == {"size": "A1(594×841mm)"}

    def test_group_order_follows_the_catalog_not_the_input(self):
        result = acceptance_checklist(_items("install", "poster"), {})
        assert [group["key"] for group in result["groups"]] == ["poster", "install"]

    def test_check_ids_are_stable_for_the_same_item(self):
        first = acceptance_checklist(_items("poster"), {})["groups"][0]["checks"]
        second = acceptance_checklist(_items("poster", "qr"), {})["groups"][0]["checks"]
        assert [row["check_id"] for row in first] == [row["check_id"] for row in second]

    def test_notes_are_carried_through_per_criterion(self):
        acceptance = {"acceptChecks": {"poster:1": "fail"}, "checkNotes": {"poster:1": "顏色偏綠"}}
        checks = acceptance_checklist(_items("poster"), acceptance)["groups"][0]["checks"]
        assert checks[1]["note"] == "顏色偏綠"
        assert checks[0]["note"] is None


class TestOrphanChecks:
    def test_checks_for_selected_items_are_accepted(self):
        assert unknown_check_ids(_items("poster"), _all_pass("poster")) == []

    def test_checks_for_a_deselected_item_are_reported(self):
        assert unknown_check_ids(_items("qr"), _checks(**{"poster:0": "pass"})) == ["poster:0"]

    def test_out_of_range_criterion_index_is_reported(self):
        assert unknown_check_ids(_items("poster"), _checks(**{"poster:99": "pass"})) == ["poster:99"]

    def test_unknown_item_key_is_reported(self):
        assert unknown_check_ids(_items("poster"), _checks(**{"ghost:0": "pass"})) == ["ghost:0"]

    def test_missing_acceptance_is_not_an_error(self):
        assert unknown_check_ids(_items("poster"), None) == []


class TestItemsFromQuoteConfig:
    def test_selected_d_items_become_work_order_items_with_default_quantities(self):
        items = default_items_from_quote_config({"dItems": {"poster": True, "digital": True}})
        assert items["selectedItems"] == {"poster": True, "digital": True}
        assert items["itemQty"] == {"poster": 6, "digital": 10}

    def test_unselected_items_are_dropped(self):
        items = default_items_from_quote_config({"dItems": {"poster": True, "qr": False}})
        assert items["selectedItems"] == {"poster": True}

    def test_unknown_keys_in_the_quote_are_ignored(self):
        items = default_items_from_quote_config({"dItems": {"poster": True, "banner": True}})
        assert items["selectedItems"] == {"poster": True}

    @pytest.mark.parametrize("config", [{}, None, {"dItems": None}, {"dItems": []}, "not-a-dict"])
    def test_missing_or_malformed_config_yields_an_empty_work_order(self, config):
        items = default_items_from_quote_config(config)
        assert items["selectedItems"] == {}
        assert items["itemQty"] == {}

    def test_the_result_drives_a_checklist_with_real_criteria(self):
        items = default_items_from_quote_config({"dItems": {"poster": True}})
        assert acceptance_checklist(items, {})["total"] == 4


class TestEndpoints:
    """路由順序與驗收把關要在真實請求下成立，不能只在函式層成立。"""

    URL = "/api/reibi/work-orders"

    @pytest.fixture
    def seeded(self, fake_supabase):
        from support.identities import PRIMARY_ORG_CODE

        fake_supabase.seed("reibi_enterprises", [
            {"id": 1, "org_code": PRIMARY_ORG_CODE, "org_name": "測試企業", "status": "active"},
        ])
        fake_supabase.seed("reibi_work_orders", [{
            "id": 7, "enterprise_id": 1, "work_order_no": "WO-D-2608-001", "client_name": "測試企業",
            "status": "驗收中", "items": _items("poster"), "acceptance": {}, "status_history": [],
        }])
        return fake_supabase

    def test_catalog_is_not_swallowed_by_the_record_id_route(self, client, tokens, seeded):
        # /work-orders/catalog 必須排在 /work-orders/{record_id} 之前，
        # 否則 "catalog" 會被當成 record_id 而回 422。
        response = client.get(f"{self.URL}/catalog", headers=tokens.header("admin"))
        assert response.status_code == 200
        assert [row["key"] for row in response.json()["data"]] == list(ARTIFACT_KEYS)

    def test_catalog_requires_authentication(self, client, seeded):
        assert client.get(f"{self.URL}/catalog").status_code == 401

    def test_reading_one_work_order_includes_its_checklist(self, client, tokens, seeded):
        data = client.get(f"{self.URL}/7", headers=tokens.header("admin")).json()["data"]
        assert data["acceptance_checklist"]["total"] == 4

    def _accept(self, client, tokens, acceptance, result="驗收完成"):
        return client.post(f"{self.URL}/7/acceptance", headers=tokens.header("admin"), json={
            "acceptance_result": result, "acceptance_date": "2026-08-19",
            "client_sign_name": "王小明", "acceptance": acceptance,
        })

    def test_completion_is_refused_while_criteria_are_outstanding(self, client, tokens, seeded):
        response = self._accept(client, tokens, _checks(**{"poster:0": "pass"}))
        assert response.status_code == 422
        assert "未通過" in response.json()["detail"]

    def test_completion_is_refused_when_a_criterion_failed(self, client, tokens, seeded):
        checks = _all_pass("poster")
        checks["acceptChecks"]["poster:3"] = "fail"
        assert self._accept(client, tokens, checks).status_code == 422

    def test_completion_is_accepted_once_every_criterion_passes(self, client, tokens, seeded):
        response = self._accept(client, tokens, _all_pass("poster"))
        assert response.status_code == 200
        assert response.json()["data"]["acceptance_checklist"]["all_passed"] is True

    def test_an_exception_can_be_logged_without_passing_everything(self, client, tokens, seeded):
        response = self._accept(client, tokens, _checks(**{"poster:0": "fail"}), result="驗收異常")
        assert response.status_code == 200

    def test_orphan_checks_are_rejected_rather_than_silently_counted(self, client, tokens, seeded):
        checks = _all_pass("poster")
        checks["acceptChecks"]["qr:0"] = "pass"  # qr 未勾選
        response = self._accept(client, tokens, checks)
        assert response.status_code == 422
        assert "qr:0" in response.json()["detail"]


class TestServiceStaffAssignment:
    """指派的服務人員（Artifact v1.4 的 serviceStaffId 下拉）。

    `reibi_work_orders.service_staff_id` 從 Batch B 建表起就存在，還帶著外鍵與
    索引，但沒有任何程式碼寫入或讀取它 —— 跟先前修掉的企業區域、預約服務場域
    同一類的死欄位。
    """

    URL = "/api/reibi/work-orders"

    @pytest.fixture
    def seeded(self, fake_supabase):
        from support.identities import PRIMARY_ORG_CODE

        fake_supabase.seed("reibi_enterprises", [
            {"id": 1, "org_code": PRIMARY_ORG_CODE, "org_name": "測試企業", "status": "active"},
        ])
        fake_supabase.seed("reibi_staff", [
            {"id": 3, "name": "陳服務", "title": "客服專員", "is_active": True, "artifact_id": "STAFF_3"},
        ])
        fake_supabase.seed("reibi_work_orders", [{
            "id": 7, "enterprise_id": 1, "work_order_no": "WO-D-2608-001", "client_name": "測試企業",
            "status": "草稿", "items": {}, "acceptance": {}, "status_history": [], "service_staff_id": None,
        }])
        return fake_supabase

    def _put(self, client, tokens, **extra):
        return client.put(f"{self.URL}/7", headers=tokens.header("admin"), json={
            "work_order_no": "WO-D-2608-001", "client_name": "測試企業", **extra,
        })

    def test_the_assignment_is_persisted(self, client, tokens, seeded):
        assert self._put(client, tokens, service_staff_id=3).status_code == 200
        assert seeded.tables["reibi_work_orders"][0]["service_staff_id"] == 3

    def test_the_field_is_optional(self, client, tokens, seeded):
        assert self._put(client, tokens).status_code == 200

    @pytest.mark.parametrize("bad", [0, -1, "three"])
    def test_an_unusable_staff_reference_is_rejected(self, client, tokens, seeded, bad):
        assert self._put(client, tokens, service_staff_id=bad).status_code == 422

    def test_the_free_text_roster_is_still_a_separate_field(self, client, tokens, seeded):
        # staff_names 是現場人員名單，service_staff_id 是負責這張工單的人，兩者不互相取代。
        assert self._put(client, tokens, service_staff_id=3, staff_names="陳服務、林技師").status_code == 200
        saved = seeded.tables["reibi_work_orders"][0]
        assert saved["service_staff_id"] == 3
        assert saved["staff_names"] == "陳服務、林技師"
