"""Region coverage for the L5 點線面 view.

The source artifact grouped enterprises by an ``enterprise.region`` field it
never wrote, so all five regions always rendered zero. Region is derived here
from the distributor that serves the enterprise, which is the field the
artifact actually collected and the one this system already stores.
"""

from __future__ import annotations

import pytest

from reibi_l5 import (
    REGION_DEFINITIONS,
    REGION_KEYS,
    build_region_coverage,
    distributor_region_map,
    normalize_region,
)


class TestRegionNormalisation:
    @pytest.mark.parametrize("key", REGION_KEYS)
    def test_canonical_keys_pass_through(self, key):
        assert normalize_region(key) == key

    @pytest.mark.parametrize(
        ("value", "expected"),
        [
            ("北部", "north"),
            ("中部", "central"),
            ("南部", "south"),
            ("東部", "east"),
            ("海外", "overseas"),
            ("北區", "north"),
            ("  north  ", "north"),
            ("NORTH", "north"),
        ],
    )
    def test_free_text_variants_are_understood(self, value, expected):
        """The distributor form stores free text, so labels must resolve too."""
        assert normalize_region(value) == expected

    @pytest.mark.parametrize("value", ["", None, "   ", "火星", "unknown"])
    def test_unreadable_values_return_none_rather_than_guessing(self, value):
        assert normalize_region(value) is None


class TestDistributorRegionMap:
    def test_maps_code_to_region_uppercased(self):
        mapping = distributor_region_map([{"id": 1, "org_code": "tp-01", "region": "north"}])
        assert mapping == {"TP-01": "north"}

    def test_sub_distributor_inherits_its_parent_region(self):
        mapping = distributor_region_map([
            {"id": 1, "org_code": "P-A", "parent_id": None, "region": "south"},
            {"id": 2, "org_code": "P-A-SUB", "parent_id": 1, "region": None},
        ])
        assert mapping["P-A-SUB"] == "south"

    def test_sub_distributor_keeps_its_own_region_when_set(self):
        mapping = distributor_region_map([
            {"id": 1, "org_code": "P-A", "parent_id": None, "region": "south"},
            {"id": 2, "org_code": "P-A-SUB", "parent_id": 1, "region": "east"},
        ])
        assert mapping["P-A-SUB"] == "east"

    def test_distributor_without_a_readable_region_is_omitted(self):
        mapping = distributor_region_map([{"id": 1, "org_code": "P-X", "region": "火星"}])
        assert "P-X" not in mapping


class TestRegionCoverage:
    DISTRIBUTORS = [
        {"id": 1, "org_code": "P-N", "parent_id": None, "region": "north"},
        {"id": 2, "org_code": "P-S", "parent_id": None, "region": "南部"},
        {"id": 3, "org_code": "P-S-SUB", "parent_id": 2, "region": None},
        {"id": 4, "org_code": "P-NONE", "parent_id": None, "region": ""},
    ]

    def test_counts_enterprises_through_their_distributor(self):
        result = build_region_coverage(
            [
                {"id": 1, "partner_code": "P-N"},
                {"id": 2, "partner_code": "P-N"},
                {"id": 3, "partner_code": "P-S"},
                {"id": 4, "partner_code": "P-S-SUB"},
            ],
            self.DISTRIBUTORS,
        )
        counts = {row["key"]: row["count"] for row in result["regions"]}
        assert counts["north"] == 2
        assert counts["south"] == 2
        assert counts["central"] == 0

    def test_every_region_is_reported_even_with_no_enterprises(self):
        result = build_region_coverage([], self.DISTRIBUTORS)
        assert [row["key"] for row in result["regions"]] == list(REGION_KEYS)
        assert all(row["count"] == 0 for row in result["regions"])
        assert result["total"]["count"] == 0

    def test_targets_and_percentages_come_from_the_artifact_figures(self):
        result = build_region_coverage(
            [{"id": n, "partner_code": "P-N"} for n in range(10)], self.DISTRIBUTORS
        )
        north = next(row for row in result["regions"] if row["key"] == "north")
        assert north["target"] == 40
        assert north["percent"] == 25
        assert result["total"]["target"] == 100
        assert result["total"]["percent"] == 10

    def test_percentage_is_capped_at_one_hundred(self):
        result = build_region_coverage(
            [{"id": n, "partner_code": "P-N"} for n in range(80)], self.DISTRIBUTORS
        )
        north = next(row for row in result["regions"] if row["key"] == "north")
        assert north["percent"] == 100

    def test_unassigned_enterprises_are_explained_not_dropped(self):
        result = build_region_coverage(
            [
                {"id": 1, "partner_code": "P-N"},
                {"id": 2, "partner_code": ""},
                {"id": 3, "partner_code": "P-GHOST"},
                {"id": 4, "partner_code": "P-NONE"},
            ],
            self.DISTRIBUTORS,
        )
        assert result["unassigned"]["count"] == 3
        assert result["unassigned"]["reasons"] == {
            "no_partner": 1,
            "unknown_partner": 1,
            "partner_without_region": 1,
        }

    def test_region_counts_plus_unassigned_equal_the_total(self):
        enterprises = [
            {"id": 1, "partner_code": "P-N"},
            {"id": 2, "partner_code": "P-S"},
            {"id": 3, "partner_code": None},
            {"id": 4, "partner_code": "P-GHOST"},
        ]
        result = build_region_coverage(enterprises, self.DISTRIBUTORS)
        summed = sum(row["count"] for row in result["regions"])
        assert summed == result["assigned_count"]
        assert summed + result["unassigned"]["count"] == result["total"]["count"] == 4

    def test_partner_code_matching_ignores_case(self):
        result = build_region_coverage([{"id": 1, "partner_code": "p-n"}], self.DISTRIBUTORS)
        counts = {row["key"]: row["count"] for row in result["regions"]}
        assert counts["north"] == 1

    def test_definitions_expose_cities_for_display(self):
        result = build_region_coverage([], self.DISTRIBUTORS)
        north = next(row for row in result["regions"] if row["key"] == "north")
        assert "台北市" in north["cities"]

    def test_artifact_targets_still_sum_to_one_hundred(self):
        assert sum(item["target"] for item in REGION_DEFINITIONS) == 100


class TestRegionEndpoint:
    URL = "/api/reibi/l5/regions"

    @pytest.fixture
    def seeded(self, fake_supabase):
        fake_supabase.seed(
            "reibi_distributors",
            [{"id": 1, "org_code": "P-N", "parent_id": None, "region": "north"}],
        )
        fake_supabase.seed(
            "reibi_enterprises",
            [
                {"id": 1, "org_code": "A1", "partner_code": "P-N"},
                {"id": 2, "org_code": "A2", "partner_code": None},
            ],
        )
        return fake_supabase

    @pytest.mark.parametrize("role", ["reibi_super", "reibi_data"])
    def test_cross_org_analytics_holders_can_read_it(self, client, tokens, seeded, role):
        response = client.get(self.URL, headers=tokens.header(role))
        assert response.status_code == 200

        data = response.json()["data"]
        assert data["total"]["count"] == 2
        north = next(row for row in data["regions"] if row["key"] == "north")
        assert north["count"] == 1
        assert data["unassigned"]["reasons"]["no_partner"] == 1

    @pytest.mark.parametrize(
        "role", ["reibi_finance", "reibi_cs", "admin", "admin_hr", "partner_primary", "individual"]
    )
    def test_other_roles_are_rejected(self, client, tokens, seeded, role):
        """The artifact gave 點線面 to super and the data analyst only."""
        assert client.get(self.URL, headers=tokens.header(role)).status_code == 403

    def test_unauthenticated_access_is_rejected(self, client, seeded):
        assert client.get(self.URL).status_code == 401

    def test_response_carries_no_financial_figures(self, client, tokens, seeded):
        body = client.get(self.URL, headers=tokens.header("reibi_data")).text
        for field in ("layer_fee", "revenue", "amount", "contracted"):
            assert field not in body
