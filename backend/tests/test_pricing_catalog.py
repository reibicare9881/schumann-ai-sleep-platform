"""方案與定價頁（Artifact PricingScreen）。

Artifact 的定價頁把金額直接打在頁面上 —— A 層「NT$60萬/年」、B 層套組「NT$169.94萬」——
與報價計算是兩份各自維護的複本。改了設備單價，報價單會變、定價頁不會。

這裡的定價頁沒有任何寫死的金額，全部由計價常數推導。這些測試釘住那件事：
**頁面上的數字必須等於報價單算出來的數字**，否則兩份複本的問題就回來了。

價格本身的有效性尚未經業務端確認（2026-08-20 以「先當作有效」為前提實作），
因此測試斷言的是「兩處一致」，不是「金額等於某個特定數字」—— 後者會在調價時
變成需要一起改的第三個地方。
"""

from __future__ import annotations

from decimal import Decimal

import pytest

from reibi_api import (
    A_LAYER_TIERS,
    C_LAYER_HIGH_RISK_FEE,
    C_LAYER_TIERS,
    D_LAYER_PRICES,
    E_EQUIPMENT_PRICES,
    PAY_MODE_FACTORS,
    QuoteCalculationRequest,
    build_pricing_catalog,
    calculate_quote_fees,
)

CATALOG = build_pricing_catalog()


class TestTheseAreTheSameNumbersAsTheQuote:
    """定價頁與報價單不可能對不上 —— 這是整頁存在的理由。"""

    @pytest.mark.parametrize(("members", "annual"), list(A_LAYER_TIERS))
    def test_each_a_layer_tier_matches_what_the_calculator_charges(self, members, annual):
        # 半年繳係數為 1.0，可直接比對級距原價而不受折扣影響。
        result = calculate_quote_fees(QuoteCalculationRequest(member_count=members, pay_mode="semi"))
        shown = next(row for row in CATALOG["a_layer"]["tiers"] if row["max_members"] == members)
        assert result["a_layer_fee"] == Decimal(shown["annual_fee"])

    @pytest.mark.parametrize("bundle", CATALOG["b_layer"]["bundles"])
    def test_each_b_layer_bundle_matches_the_calculated_equipment_total(self, bundle):
        result = calculate_quote_fees(QuoteCalculationRequest(
            b_bed=bundle["bed"], b_chair=bundle["chair"], b_la200=bundle["la200"],
        ))
        assert result["b_layer_fee"] == Decimal(bundle["total"])

    @pytest.mark.parametrize("tier", list(C_LAYER_TIERS))
    def test_each_c_layer_tier_matches_the_calculator(self, tier):
        result = calculate_quote_fees(QuoteCalculationRequest(c_tier=tier))
        shown = next(row for row in CATALOG["c_layer"]["tiers"] if row["tier"] == tier)
        assert result["c_layer_fee"] == Decimal(shown["annual_fee"])

    @pytest.mark.parametrize("item", CATALOG["d_layer"]["items"])
    def test_each_d_layer_item_matches_its_calculated_range(self, item):
        result = calculate_quote_fees(QuoteCalculationRequest(d_items=[item["key"]]))
        assert result["d_layer_fee_min"] == Decimal(item["min"])
        assert result["d_layer_fee_max"] == Decimal(item["max"])

    def test_the_high_risk_surcharge_matches(self):
        result = calculate_quote_fees(QuoteCalculationRequest(c_tier="基本型", c_high_risk=1))
        assert result["c_high_risk_fee"] == Decimal(CATALOG["c_layer"]["high_risk_fee"])
        assert CATALOG["c_layer"]["high_risk_fee"] == C_LAYER_HIGH_RISK_FEE

    @pytest.mark.parametrize("mode", ["annual", "semi", "quarterly"])
    def test_the_payment_factors_are_the_ones_actually_applied(self, mode):
        shown = next(row for row in CATALOG["a_layer"]["pay_modes"] if row["key"] == mode)
        assert shown["factor"] == PAY_MODE_FACTORS[mode]
        result = calculate_quote_fees(QuoteCalculationRequest(member_count=100, pay_mode=mode))
        assert result["a_layer_fee"] == (Decimal(600_000) * PAY_MODE_FACTORS[mode]).quantize(Decimal("1"))


class TestNothingIsHardcoded:
    def test_bundle_totals_are_derived_from_equipment_prices(self):
        for bundle in CATALOG["b_layer"]["bundles"]:
            expected = sum(bundle[key] * E_EQUIPMENT_PRICES[key] for key in ("bed", "chair", "la200"))
            assert bundle["total"] == expected

    def test_equipment_list_prices_come_from_the_shared_constant(self):
        shown = {row["key"]: row["price"] for row in CATALOG["b_layer"]["equipment"]}
        assert shown == E_EQUIPMENT_PRICES

    def test_every_d_layer_item_in_the_calculator_appears_on_the_page(self):
        assert {row["key"] for row in CATALOG["d_layer"]["items"]} == set(D_LAYER_PRICES)

    def test_every_c_layer_tier_in_the_calculator_appears_on_the_page(self):
        assert {row["tier"] for row in CATALOG["c_layer"]["tiers"]} == set(C_LAYER_TIERS)


class TestTierRanges:
    def test_ranges_are_contiguous_and_start_from_the_smallest(self):
        tiers = [row for row in CATALOG["a_layer"]["tiers"] if row["max_members"]]
        assert [row["max_members"] for row in tiers] == [row[0] for row in A_LAYER_TIERS]

    def test_the_largest_tier_is_followed_by_a_custom_row(self):
        last = CATALOG["a_layer"]["tiers"][-1]
        assert last["custom"] is True
        assert last["annual_fee"] is None

    def test_contract_total_is_the_annual_fee_times_the_term(self):
        for row in CATALOG["a_layer"]["tiers"]:
            if row.get("custom"):
                continue
            assert row["contract_total"] == row["annual_fee"] * CATALOG["contract_years"]

    @pytest.mark.parametrize("years", [1, 3, 5])
    def test_the_contract_term_is_configurable(self, years):
        catalog = build_pricing_catalog(years)
        assert catalog["contract_years"] == years
        first = catalog["a_layer"]["tiers"][0]
        assert first["contract_total"] == first["annual_fee"] * years


class TestHonesty:
    def test_the_page_says_the_quote_is_authoritative(self):
        assert "正式報價單為準" in CATALOG["disclaimer"]

    def test_the_unconfirmed_pricing_is_disclosed_rather_than_hidden(self):
        # 「先當作有效」是一個前提，讀者應該看得到，而不是只寫在程式註解裡。
        assert "尚未經業務端正式確認" in CATALOG["disclaimer"]

    def test_the_d_layer_states_that_the_range_is_an_estimate(self):
        assert "現場勘查" in CATALOG["d_layer"]["note"]

    def test_payment_terms_are_stated_for_the_one_off_layers(self):
        assert CATALOG["b_layer"]["payment_term"]
        assert CATALOG["d_layer"]["payment_term"]


class TestEndpoint:
    URL = "/api/reibi/pricing"

    def test_a_reibi_manager_can_read_it(self, client, tokens):
        assert client.get(self.URL, headers=tokens.header("admin")).status_code == 200

    @pytest.mark.parametrize("role", ["member", "individual", "dept_head"])
    def test_roles_without_manage_reibi_are_refused(self, client, tokens, role):
        assert client.get(self.URL, headers=tokens.header(role)).status_code == 403

    def test_it_is_not_public(self, client):
        # Artifact 的定價頁也在登入後才看得到；是否對外公開是另一個未決的商業決策。
        assert client.get(self.URL).status_code == 401

    def test_the_contract_term_can_be_requested(self, client, tokens):
        body = client.get(self.URL, params={"contract_years": 5}, headers=tokens.header("admin")).json()
        assert body["data"]["contract_years"] == 5

    @pytest.mark.parametrize("years", [0, 11, -1])
    def test_an_unreasonable_term_is_rejected(self, client, tokens, years):
        assert client.get(self.URL, params={"contract_years": years}, headers=tokens.header("admin")).status_code == 422
