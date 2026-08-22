"""E-layer pricing and upgrade supplements (Artifact PRICING.E / calcUpgradeDiff).

The migrated quote calculator reproduced layers A to D exactly but reduced the
whole of layer E — equipment warranty, four value-added products and the
renewal CPI cap — to one free-form number the salesperson typed. The upgrade
supplement, which prorates the annual difference over the remaining months of
the original contract, was not carried over at all.

Both are money. These tests hold the figures to the artifact's.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest

from reibi_api import (
    E_CPI_CAP,
    E_VALUE_ADDED_PRICES,
    QuoteCalculationRequest,
    calculate_quote_fees,
    calculate_upgrade_supplement,
)


def _renewal(**extra) -> QuoteCalculationRequest:
    return QuoteCalculationRequest(doc_type="續約報價", member_count=200, **extra)


class TestWarranty:
    def test_each_device_is_charged_at_its_own_list_price(self):
        result = calculate_quote_fees(_renewal(e_warranty_bed=True, e_warranty_rate=Decimal("7")))
        assert result["e_warranty_fee"] == Decimal("56000")  # 800,000 × 7%

    def test_multiple_devices_accumulate(self):
        result = calculate_quote_fees(
            _renewal(e_warranty_bed=True, e_warranty_chair=True, e_warranty_la200=True,
                     e_warranty_rate=Decimal("7"))
        )
        # 800,000 + 750,000 + 149,400 = 1,699,400 × 7%
        assert result["e_warranty_fee"] == Decimal("118958")

    @pytest.mark.parametrize(("rate", "expected"), [(Decimal("5"), 40_000), (Decimal("10"), 80_000)])
    def test_rate_spans_the_documented_five_to_ten_percent(self, rate, expected):
        result = calculate_quote_fees(_renewal(e_warranty_bed=True, e_warranty_rate=rate))
        assert result["e_warranty_fee"] == Decimal(expected)

    @pytest.mark.parametrize("rate", [Decimal("4.9"), Decimal("10.1"), Decimal("0")])
    def test_rates_outside_the_documented_band_are_rejected(self, rate):
        with pytest.raises(Exception):
            _renewal(e_warranty_bed=True, e_warranty_rate=rate)

    def test_no_warranty_selected_means_no_warranty_fee(self):
        assert calculate_quote_fees(_renewal())["e_warranty_fee"] == Decimal("0")


class TestValueAddedServices:
    @pytest.mark.parametrize(("key", "price"), sorted(E_VALUE_ADDED_PRICES.items()))
    def test_each_product_carries_the_artifact_price(self, key, price):
        result = calculate_quote_fees(_renewal(e_value_added=[key]))
        assert result["e_value_added_fee"] == Decimal(price)

    def test_prices_match_the_artifact_table(self):
        assert E_VALUE_ADDED_PRICES == {
            "annual_report": 30_000, "industry_white": 50_000,
            "esg_report": 40_000, "hr_consult": 80_000,
        }

    def test_selections_accumulate_and_add_the_custom_amount(self):
        result = calculate_quote_fees(
            _renewal(e_value_added=["annual_report", "esg_report"], e_value_custom=Decimal("12000"))
        )
        assert result["e_value_added_fee"] == Decimal("82000")

    def test_a_repeated_selection_is_not_charged_twice(self):
        result = calculate_quote_fees(_renewal(e_value_added=["esg_report", "esg_report"]))
        assert result["e_value_added_fee"] == Decimal("40000")


class TestRenewalCpiCap:
    def test_rate_within_the_cap_is_applied_as_given(self):
        result = calculate_quote_fees(_renewal(e_cpi_apply=True, e_cpi_rate=Decimal("0.03")))
        assert result["cpi_multiplier"] == Decimal("1.03")
        assert result["cpi_capped"] is False

    def test_rate_above_the_cap_is_truncated_not_rejected(self):
        """The artifact takes min(rate, cap); a higher figure is silently capped."""
        result = calculate_quote_fees(_renewal(e_cpi_apply=True, e_cpi_rate=Decimal("0.20")))
        assert E_CPI_CAP == Decimal("0.05")
        assert result["cpi_multiplier"] == Decimal("1.05")
        assert result["cpi_capped"] is True

    def test_cap_applies_to_the_a_layer_fee(self):
        base = calculate_quote_fees(_renewal())["a_layer_fee"]
        capped = calculate_quote_fees(_renewal(e_cpi_apply=True, e_cpi_rate=Decimal("0.50")))
        assert capped["a_layer_fee"] == (base * Decimal("1.05")).quantize(Decimal("1"))

    def test_not_applying_cpi_leaves_the_fee_untouched(self):
        base = calculate_quote_fees(_renewal())["a_layer_fee"]
        assert calculate_quote_fees(_renewal(e_cpi_apply=False, e_cpi_rate=Decimal("0.05")))["a_layer_fee"] == base

    def test_a_negotiated_custom_fee_is_not_adjusted(self):
        result = calculate_quote_fees(
            _renewal(a_custom_fee=Decimal("999000"), e_cpi_apply=True, e_cpi_rate=Decimal("0.05"))
        )
        assert result["a_layer_fee"] == Decimal("999000")


class TestELayerAppliesToRenewalsOnly:
    @pytest.mark.parametrize("doc_type", [None, "新簽報價", "經銷商報價", "升級報價"])
    def test_other_document_types_get_no_warranty_or_value_added(self, doc_type):
        result = calculate_quote_fees(
            QuoteCalculationRequest(
                doc_type=doc_type, member_count=200, e_warranty_bed=True,
                e_value_added=["hr_consult"], e_cpi_apply=True, e_cpi_rate=Decimal("0.05"),
            )
        )
        assert result["e_layer_applies"] is False
        assert result["e_warranty_fee"] == Decimal("0")
        assert result["e_value_added_fee"] == Decimal("0")
        assert result["cpi_multiplier"] == Decimal("1")

    def test_manual_e_layer_amount_still_works_for_other_types(self):
        result = calculate_quote_fees(
            QuoteCalculationRequest(doc_type="新簽報價", member_count=200, e_layer_fee=Decimal("55000"))
        )
        assert result["e_layer_fee"] == Decimal("55000")

    def test_structured_amount_wins_over_the_manual_field_on_renewals(self):
        result = calculate_quote_fees(
            _renewal(e_value_added=["annual_report"], e_layer_fee=Decimal("999999"))
        )
        assert result["e_layer_fee"] == Decimal("30000")


class TestUpgradeSupplement:
    def test_prorates_the_annual_difference_over_the_remaining_months(self):
        result = calculate_upgrade_supplement(
            Decimal("1200000"), Decimal("1710000"), date(2026, 9, 1), date(2027, 3, 1)
        )
        assert result["month_diff"] == Decimal("42500")   # (1,710,000 − 1,200,000) ÷ 12
        assert result["months_left"] == 7                 # 181 days, 30-day months, rounded up
        assert result["supplement"] == Decimal("297500")

    def test_months_are_rounded_up_the_way_the_artifact_does(self):
        """31 days is two months under a 30-day month with ceiling rounding."""
        result = calculate_upgrade_supplement(
            Decimal("0"), Decimal("120000"), date(2026, 1, 1), date(2026, 2, 1)
        )
        assert result["months_left"] == 2

    def test_an_expired_contract_yields_no_supplement(self):
        result = calculate_upgrade_supplement(
            Decimal("600000"), Decimal("1200000"), date(2027, 1, 1), date(2026, 1, 1)
        )
        assert result["months_left"] == 0
        assert result["supplement"] == Decimal("0")

    def test_a_downgrade_produces_a_negative_difference_rather_than_zero(self):
        result = calculate_upgrade_supplement(
            Decimal("1800000"), Decimal("1200000"), date(2026, 1, 1), date(2026, 7, 1)
        )
        assert result["month_diff"] < 0

    def test_quote_calculation_exposes_it_for_upgrade_documents(self):
        result = calculate_quote_fees(
            QuoteCalculationRequest(
                doc_type="升級報價", member_count=400,
                original_a_fee=Decimal("1200000"),
                upgrade_date=date(2026, 9, 1), original_contract_end=date(2027, 3, 1),
            )
        )
        assert result["upgrade_supplement"]["supplement"] == Decimal("297500")

    @pytest.mark.parametrize("doc_type", [None, "新簽報價", "續約報價"])
    def test_no_supplement_for_non_upgrade_documents(self, doc_type):
        result = calculate_quote_fees(
            QuoteCalculationRequest(
                doc_type=doc_type, member_count=400, original_a_fee=Decimal("1200000"),
                upgrade_date=date(2026, 9, 1), original_contract_end=date(2027, 3, 1),
            )
        )
        assert result["upgrade_supplement"] is None

    def test_missing_original_contract_details_yield_no_supplement(self):
        result = calculate_quote_fees(
            QuoteCalculationRequest(doc_type="升級報價", member_count=400)
        )
        assert result["upgrade_supplement"] is None


class TestExistingLayersAreUnchanged:
    """The A–D figures were already faithful; adding E must not disturb them."""

    def test_layer_a_to_d_still_match_the_artifact(self):
        result = calculate_quote_fees(
            QuoteCalculationRequest(
                member_count=200, pay_mode="annual", b_bed=1, b_chair=1, b_la200=1,
                c_tier="成長型", c_high_risk=2, d_items=["poster", "qr"],
            )
        )
        assert result["a_layer_fee"] == Decimal("1140000")   # 1,200,000 × 0.95
        assert result["b_layer_fee"] == Decimal("1699400")   # 800,000 + 750,000 + 149,400
        assert result["c_layer_fee"] == Decimal("98000")     # 70,000 + 2 × 14,000
        assert result["d_layer_fee_min"] == Decimal("20000")
        assert result["d_layer_fee_max"] == Decimal("40000")
