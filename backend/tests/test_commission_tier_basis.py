"""年簽約額的計算基礎（Artifact reibi-l5.jsx 的 yearAmt）。

年簽約額與佣金基數是兩個不同的數字，Artifact 分得很清楚：

    var yearAmt = myEnts.reduce((a, e) => a + (e.aLayerFee || ...), 0);   // 只算 A 層

它是**等級升級門檻**的判定基礎。B、C 層照常計入佣金，但不推進升級 ——
手冊分頁明講「B層設備費(含LA200)不計入年累積業績(不影響等級升級)，但計入佣金」。

新系統原本把三層加總後叫做 annual_sales，並以「年度業績」顯示在經銷商等級旁邊，
也就是超管決定要不要升等時會看的那個數字。一張雲朵床 80 萬，賣十台就跨過金牌
800 萬門檻，而升等是永久的邊際成本（A 層 8% → 14%）。

Artifact 自己在手冊分頁 3920 行寫成「A+C 層」，與它的程式碼、策略頁說明及同一分頁
C 層的註記都矛盾。四處有三處一致，以程式碼為準。
"""

from __future__ import annotations

from decimal import Decimal

import pytest

from reibi_batch_c import COMMISSION_LEVELS, calculate_distributor_commission

RETAIN = Decimal("65")


def _distributor(level="silver", **extra):
    return {"org_code": "D001", "level_code": level, **extra}


def _enterprise(a=0, b=0, c=0, partner="D001"):
    return {"partner_code": partner, "a_layer_fee": a, "b_layer_fee": b, "c_layer_fee": c}


def _calc(enterprises, distributor=None):
    return calculate_distributor_commission(distributor or _distributor(), enterprises, RETAIN)


class TestAnnualSalesBasis:
    def test_only_the_a_layer_counts_towards_annual_sales(self):
        result = _calc([_enterprise(a=1_000_000, b=8_000_000, c=500_000)])
        assert result["annual_sales"] == Decimal("1000000")

    def test_equipment_sales_do_not_inflate_the_upgrade_basis(self):
        # 十台雲朵床 800 萬。若計入，銀牌經銷商會憑設備銷售跨過金牌門檻。
        with_equipment = _calc([_enterprise(a=1_000_000, b=8_000_000)])
        without_equipment = _calc([_enterprise(a=1_000_000)])
        assert with_equipment["annual_sales"] == without_equipment["annual_sales"]

    def test_the_c_layer_does_not_count_either(self):
        assert _calc([_enterprise(a=600_000, c=210_000)])["annual_sales"] == Decimal("600000")

    def test_annual_sales_sums_across_every_matched_enterprise(self):
        result = _calc([_enterprise(a=600_000), _enterprise(a=1_200_000), _enterprise(a=1_800_000)])
        assert result["annual_sales"] == Decimal("3600000")

    def test_enterprises_of_another_distributor_are_excluded(self):
        result = _calc([_enterprise(a=600_000), _enterprise(a=99_000_000, partner="D999")])
        assert result["annual_sales"] == Decimal("600000")
        assert result["enterprise_count"] == 1

    def test_a_distributor_with_no_enterprises_has_no_annual_sales(self):
        assert _calc([])["annual_sales"] == Decimal("0")

    def test_the_commission_base_total_is_still_available_separately(self):
        result = _calc([_enterprise(a=1_000_000, b=8_000_000, c=500_000)])
        assert result["commission_base_total"] == Decimal("9500000")

    def test_the_two_figures_are_not_the_same_number(self):
        result = _calc([_enterprise(a=1_000_000, b=8_000_000)])
        assert result["annual_sales"] != result["commission_base_total"]


class TestCommissionIsUnaffected:
    """升級基礎改了，但每一層照原本的比例計算佣金，金額不能因此變動。"""

    def test_every_layer_still_earns_commission(self):
        result = _calc([_enterprise(a=1_000_000, b=1_000_000, c=1_000_000)])
        assert result["a_commission"] == Decimal("80000")   # 銀牌 A 8%
        assert result["b_commission"] == Decimal("100000")  # 銀牌 B 10%
        assert result["c_commission"] == Decimal("50000")   # 銀牌 C 5%

    def test_the_b_layer_is_paid_even_though_it_does_not_advance_the_tier(self):
        result = _calc([_enterprise(b=1_000_000)])
        assert result["annual_sales"] == Decimal("0")
        assert result["b_commission"] > 0

    def test_the_total_commission_still_covers_all_three_layers(self):
        result = _calc([_enterprise(a=1_000_000, b=1_000_000, c=1_000_000)])
        assert result["total_commission"] == Decimal("230000")

    @pytest.mark.parametrize("level", sorted(COMMISSION_LEVELS))
    def test_the_basis_is_the_same_rule_at_every_tier(self, level):
        result = _calc([_enterprise(a=500_000, b=500_000)], _distributor(level))
        assert result["annual_sales"] == Decimal("500000")

    def test_a_negotiated_override_does_not_change_the_basis(self):
        result = _calc([_enterprise(a=500_000, b=500_000)], _distributor("gold", commission_b_percent=18))
        assert result["annual_sales"] == Decimal("500000")
        assert result["b_commission"] == Decimal("90000")


class TestNoPlanPriceFallback:
    """Artifact 在 aLayerFee 為空時退回方案定價、再退回 240,000。

    這一段刻意不移植（缺口報告 C 類）：新系統一律使用實際簽約金額。
    以實際金額判定升級較嚴謹，但屬行為差異，值得釘住以免日後被當成 bug「修回去」。
    """

    def test_an_enterprise_without_a_contracted_a_fee_contributes_nothing(self):
        assert _calc([{"partner_code": "D001", "plan_code": "旗艦"}])["annual_sales"] == Decimal("0")

    def test_a_zero_fee_is_not_replaced_by_a_plan_price(self):
        assert _calc([_enterprise(a=0)])["annual_sales"] == Decimal("0")


class TestTierProgress:
    """升級進度（Artifact reibi-l5.jsx:4404 的 nextLv 與進度條）。"""

    def _progress(self, level, sales):
        from reibi_batch_c import tier_progress
        return tier_progress(level, Decimal(str(sales)))

    def test_silver_advances_towards_gold_at_eight_million(self):
        progress = self._progress("silver", 0)
        assert progress["next_level"] == "gold"
        assert progress["threshold"] == Decimal("8000000")

    def test_gold_advances_towards_platinum_at_twenty_million(self):
        progress = self._progress("gold", 0)
        assert progress["next_level"] == "platinum"
        assert progress["threshold"] == Decimal("20000000")

    def test_percent_tracks_annual_sales_against_the_threshold(self):
        assert self._progress("silver", 2_000_000)["percent"] == 25
        assert self._progress("silver", 4_000_000)["percent"] == 50

    def test_percent_is_capped_at_one_hundred(self):
        assert self._progress("silver", 99_000_000)["percent"] == 100

    def test_remaining_counts_down_and_never_goes_negative(self):
        assert self._progress("silver", 3_000_000)["remaining"] == Decimal("5000000")
        assert self._progress("silver", 9_000_000)["remaining"] == Decimal("0")

    def test_reaching_the_threshold_is_reported_but_does_not_change_the_level(self):
        progress = self._progress("silver", 8_000_000)
        assert progress["reached"] is True
        # 升等牽涉永久的分潤成本，仍由超管明確操作。
        assert progress["current_level"] == "silver"

    def test_just_below_the_threshold_is_not_reached(self):
        assert self._progress("silver", 7_999_999)["reached"] is False

    def test_platinum_is_not_labelled_as_the_highest_tier(self):
        # Artifact 對白金顯示「最高等級」，但戰略級是存在的，只是門檻另議。
        progress = self._progress("platinum", 30_000_000)
        assert progress["next_level"] == "strategic"
        assert progress["negotiated"] is True
        assert progress["percent"] is None

    def test_strategic_has_nothing_above_it(self):
        progress = self._progress("strategic", 90_000_000)
        assert progress["next_level"] is None
        assert progress["negotiated"] is False

    def test_the_progress_uses_the_a_layer_basis_not_the_commission_base(self):
        result = _calc([_enterprise(a=4_000_000, b=50_000_000)])
        # 設備銷售不推進升級：若基數算錯，這裡會顯示 100%。
        assert result["tier_progress"]["percent"] == 50

    def test_an_unknown_level_does_not_crash(self):
        progress = self._progress("bronze", 1_000_000)
        assert progress["next_level"] is None
