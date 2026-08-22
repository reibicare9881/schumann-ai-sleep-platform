"""補回四個 Artifact 的三處計價／方案缺口。

盤點（docs/reibi-jsx-migration-gap-report.md）之後另外查出的三件事：

1. C 層只存合併後的 c_layer_fee，看不到「方案費 + 高風險高管加購」的組成。
2. 個人訂閱在 Artifact 有月繳／季繳／年繳三個方案，新系統只認月繳與年繳，
   季繳的三個月無從表達。
3. 積分兌換的點數原本由前端連同 reward_code 一起傳上來，等於使用者自己標價。
"""

from __future__ import annotations

from decimal import Decimal

import pytest

from reibi_api import QuoteCalculationRequest, calculate_quote_fees
from reibi_batch_c import SUBSCRIPTION_PLAN_LABELS, SUBSCRIPTION_PLAN_MONTHS, SubscriptionWrite
from reibi_batch_d import REWARD_CATALOG, PointsRedeem


def _quote(**extra) -> QuoteCalculationRequest:
    return QuoteCalculationRequest(member_count=200, **extra)


class TestCLayerSplit:
    def test_plan_fee_and_high_risk_surcharge_are_reported_separately(self):
        result = calculate_quote_fees(_quote(c_tier="成長型", c_high_risk=3))
        assert result["c_fee_base"] == Decimal("70000")
        assert result["c_high_risk_fee"] == Decimal("42000")  # 3 × 14,000

    def test_the_split_adds_up_to_the_authoritative_total(self):
        result = calculate_quote_fees(_quote(c_tier="旗艦型", c_high_risk=5))
        assert result["c_fee_base"] + result["c_high_risk_fee"] == result["c_layer_fee"]

    def test_discount_applies_to_both_halves(self):
        result = calculate_quote_fees(_quote(c_tier="基本型", c_high_risk=2, discount_percent=Decimal("10")))
        assert result["c_fee_base"] == Decimal("31500")   # 35,000 × 0.9
        assert result["c_high_risk_fee"] == Decimal("25200")  # 28,000 × 0.9

    def test_no_high_risk_executives_means_no_surcharge(self):
        result = calculate_quote_fees(_quote(c_tier="專業型"))
        assert result["c_high_risk_fee"] == Decimal("0")
        assert result["c_fee_base"] == result["c_layer_fee"]

    def test_a_negotiated_custom_fee_is_reported_as_the_plan_half(self):
        result = calculate_quote_fees(_quote(c_custom_fee=Decimal("88000"), c_high_risk=1))
        assert result["c_fee_base"] == Decimal("88000")
        assert result["c_high_risk_fee"] == Decimal("14000")

    def test_no_c_layer_at_all_leaves_every_figure_at_zero(self):
        result = calculate_quote_fees(_quote())
        assert result["c_layer_fee"] == result["c_fee_base"] == result["c_high_risk_fee"] == Decimal("0")

    @pytest.mark.parametrize("tier", ["基本型", "成長型", "專業型", "旗艦型"])
    def test_the_split_holds_for_every_tier(self, tier):
        result = calculate_quote_fees(_quote(c_tier=tier, c_high_risk=4, discount_percent=Decimal("5")))
        assert result["c_fee_base"] + result["c_high_risk_fee"] == result["c_layer_fee"]


class TestSubscriptionPlans:
    def test_all_three_artifact_plans_are_defined(self):
        assert SUBSCRIPTION_PLAN_MONTHS == {"monthly": 1, "quarterly": 3, "annual": 12}

    @pytest.mark.parametrize("plan", ["monthly", "quarterly", "annual"])
    def test_every_plan_is_accepted_by_the_write_model(self, plan):
        assert SubscriptionWrite(member_code="RB0001", plan_code=plan).plan_code == plan

    def test_an_undefined_plan_is_rejected(self):
        with pytest.raises(Exception):
            SubscriptionWrite(member_code="RB0001", plan_code="weekly")

    def test_every_plan_has_a_chinese_label(self):
        assert set(SUBSCRIPTION_PLAN_LABELS) == set(SUBSCRIPTION_PLAN_MONTHS)
        assert all(label.strip() for label in SUBSCRIPTION_PLAN_LABELS.values())

    def test_quarterly_is_three_months_not_one(self):
        # 季繳原本會落到 "不是 annual 就給一個月" 的分支，到期日短兩個月。
        assert SUBSCRIPTION_PLAN_MONTHS["quarterly"] == 3


class TestRewardCatalog:
    @pytest.mark.parametrize(("code", "cost"), [
        ("bioinfo", 100), ("ans_measure", 200), ("experience_extra", 50), ("priority_booking", 30),
    ])
    def test_artifact_prices_are_held_server_side(self, code, cost):
        assert REWARD_CATALOG[code]["cost"] == cost

    def test_every_reward_has_a_label(self):
        assert all(detail["label"].strip() for detail in REWARD_CATALOG.values())

    def test_redeem_no_longer_accepts_a_client_supplied_price(self):
        assert "cost" not in PointsRedeem.model_fields

    @pytest.mark.parametrize("code", sorted(REWARD_CATALOG))
    def test_every_catalogued_reward_can_be_requested(self, code):
        assert PointsRedeem(reward_code=code).reward_code == code

    def test_a_reward_outside_the_catalogue_is_rejected(self):
        with pytest.raises(Exception):
            PointsRedeem(reward_code="free_laptop")

    def test_the_custom_enterprise_reward_is_not_self_service(self):
        # Artifact 第五項「企業自訂獎勵」標示彈性設定，沒有固定點數可扣。
        assert "custom" not in REWARD_CATALOG
