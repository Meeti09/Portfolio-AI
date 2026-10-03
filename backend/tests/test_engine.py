"""Unit tests for the allocation engine.

These build Rules by hand so the maths is verified without touching MySQL.
"""

from __future__ import annotations

import pytest

from app.engine import (
    BUCKETS,
    TOTAL_CENTS,
    Asset,
    RuleError,
    Rules,
    TYPE_TO_BUCKET,
    _allocate,
    build_allocation,
    duration_bucket,
)


@pytest.fixture
def rules() -> Rules:
    """A miniature but structurally faithful copy of the production rules."""
    assets = {
        1: Asset(1, "Equity Mutual Fund", "equity"),
        2: Asset(2, "Direct Stocks", "equity"),
        3: Asset(3, "Equity ETF", "equity"),
        4: Asset(4, "Fixed Deposit", "debt"),
        5: Asset(5, "Debt Mutual Fund", "debt"),
        8: Asset(8, "Physical Gold", "gold"),
        9: Asset(9, "Savings Account", "safe"),
        10: Asset(10, "Liquid Mutual Fund", "safe"),
        11: Asset(11, "Cryptocurrency", "crypto"),
        12: Asset(12, "PPF", "long_term"),
    }
    every_asset = {aid: "yes" for aid in assets}

    return Rules(
        risk_base={
            "low": {"equity": 15, "debt": 50, "gold": 20, "safe": 15, "crypto": 0},
            "medium": {"equity": 50, "debt": 30, "gold": 10, "safe": 10, "crypto": 0},
            "high": {"equity": 65, "debt": 15, "gold": 5, "safe": 5, "crypto": 10},
        },
        duration_rules={
            "upto_1": {"equity_adj": -25, "debt_adj": 25},
            "1 -- 3": {"equity_adj": -15, "debt_adj": 15},
            "3 -- 5": {"equity_adj": 0, "debt_adj": 0},
            "5 -- 8": {"equity_adj": 10, "debt_adj": -10},
            ">8": {"equity_adj": 15, "debt_adj": -15},
        },
        assets=assets,
        type_asset_rules={"monthly": every_asset, "lumpsum": every_asset},
        risk_constraints={"low": {11: "disallow"}, "medium": {11: "disallow"}},
        liquidity_constraints={"high": {4: "disallow"}},
        existing_rules={
            # Threshold 8 rather than the production 20: no risk profile
            # weights gold above 20, so a threshold of 20 would leave the
            # 'reduce' branch permanently unreachable and untested.
            "gold": {"threshold_pct": 8, "action": "reduce"},
            "equity": {"threshold_pct": 70, "action": "reduce"},
            "crypto": {"threshold_pct": 5, "action": "cap"},
        },
        amount_rules={"monthly": [], "lumpsum": []},
        caps={"equity": 75, "crypto": 10, "gold": 25},
        returns={
            "equity": (8, 14),
            "debt": (4, 7),
            "gold": (5, 8),
            "safe": (2, 4),
            "crypto": (-20, 30),
            "long_term": (7, 12),
        },
    )


def _total(rules: Rules, **overrides) -> float:
    kwargs = {
        "risk_level": "medium",
        "investment_type": "lumpsum",
        "duration_years": 5,
        "liquidity_need": "low",
        "investment_amount": 200_000,
        "existing_investment": "none",
        "rules": rules,
    }
    kwargs.update(overrides)
    return round(sum(a.allocation_pct for a in build_allocation(**kwargs)), 2)


# ---------------------------------------------------------------------------
# Duration bucketing
# ---------------------------------------------------------------------------
@pytest.mark.parametrize(
    ("years", "expected"),
    [
        (1, "upto_1"),
        (2, "1 -- 3"),
        (3, "1 -- 3"),
        (4, "3 -- 5"),
        (5, "3 -- 5"),
        (6, "5 -- 8"),
        (8, "5 -- 8"),
        (9, ">8"),
        (40, ">8"),
    ],
)
def test_duration_bucket_boundaries(years: int, expected: str) -> None:
    assert duration_bucket(years) == expected


def test_duration_bucket_never_matches_two_rules() -> None:
    """The original BETWEEN 1 AND 3 / BETWEEN 3 AND 5 case double-matched 3."""
    seen = {duration_bucket(y) for y in range(1, 41)}
    assert len(seen) == 5


def test_every_horizon_resolves_to_a_configured_rule(rules: Rules) -> None:
    """A horizon with no matching rule would silently apply zero adjustment."""
    for years in range(1, 101):
        assert duration_bucket(years) in rules.duration_rules


# ---------------------------------------------------------------------------
# Apportionment
# ---------------------------------------------------------------------------
@pytest.mark.parametrize("count", [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 13])
def test_allocate_always_sums_to_the_total(count: int) -> None:
    shares = _allocate(TOTAL_CENTS, [1.0] * count)
    assert len(shares) == count
    assert sum(shares) == TOTAL_CENTS


def test_allocate_splits_evenly_when_it_can() -> None:
    assert _allocate(TOTAL_CENTS, [1.0] * 4) == [2500, 2500, 2500, 2500]


def test_allocate_honours_weights() -> None:
    # 75 / 25 split of 10000 cents.
    assert _allocate(TOTAL_CENTS, [75.0, 25.0]) == [7500, 2500]


def test_allocate_does_not_lose_cents_to_rounding() -> None:
    """10000 / 3 is 3333.33; the single leftover cent must land somewhere."""
    shares = _allocate(TOTAL_CENTS, [1.0, 1.0, 1.0])
    assert sum(shares) == TOTAL_CENTS
    assert sorted(shares) == [3333, 3333, 3334]


def test_allocate_avoids_the_thirds_drift() -> None:
    """The original bug: 33.33 x 3 = 99.99, a cent short of 100%."""
    bucket_weights = [33.3333, 33.3333, 33.3334]
    shares = _allocate(TOTAL_CENTS, bucket_weights)
    assert sum(shares) == TOTAL_CENTS
    assert sum(s / 100.0 for s in shares) == 100.00


def test_allocate_handles_the_awkward_division() -> None:
    """This is what MySQL integer division got wrong: 45 / 2."""
    assert _allocate(4500, [1.0, 1.0]) == [2250, 2250]


def test_allocate_zero_weights_spreads_evenly() -> None:
    assert sum(_allocate(TOTAL_CENTS, [0.0, 0.0, 0.0])) == TOTAL_CENTS


def test_allocate_empty_weight_list() -> None:
    assert _allocate(TOTAL_CENTS, []) == []


def test_allocate_zero_total() -> None:
    assert _allocate(0, [1.0, 1.0]) == [0, 0]


# ---------------------------------------------------------------------------
# Totals
# ---------------------------------------------------------------------------
@pytest.mark.parametrize("risk", ["low", "medium", "high"])
def test_allocation_always_totals_100(rules: Rules, risk: str) -> None:
    assert _total(rules, risk_level=risk) == 100.00


@pytest.mark.parametrize("years", [1, 2, 4, 7, 15])
def test_allocation_totals_100_across_horizons(rules: Rules, years: int) -> None:
    assert _total(rules, duration_years=years) == 100.00


@pytest.mark.parametrize("liquidity", ["low", "medium", "high"])
def test_allocation_totals_100_across_liquidity(rules: Rules, liquidity: str) -> None:
    assert _total(rules, liquidity_need=liquidity) == 100.00


def test_amounts_sum_to_the_invested_capital(rules: Rules) -> None:
    allocations = build_allocation(
        risk_level="medium",
        investment_type="lumpsum",
        duration_years=5,
        liquidity_need="low",
        investment_amount=200_000,
        rules=rules,
    )
    assert round(sum(a.amount for a in allocations), 2) == 200_000.00


def test_amounts_track_a_smaller_ticket(rules: Rules) -> None:
    allocations = build_allocation(
        risk_level="low",
        investment_type="lumpsum",
        duration_years=5,
        liquidity_need="low",
        investment_amount=50_000,
        rules=rules,
    )
    assert round(sum(a.amount for a in allocations), 2) == 50_000.00


# ---------------------------------------------------------------------------
# Behaviour
# ---------------------------------------------------------------------------
def test_no_allocation_is_ever_zero_or_negative(rules: Rules) -> None:
    allocations = build_allocation(
        risk_level="low",
        investment_type="lumpsum",
        duration_years=5,
        liquidity_need="low",
        investment_amount=200_000,
        rules=rules,
    )
    assert all(a.allocation_pct > 0 for a in allocations)


def test_results_are_sorted_by_weight_descending(rules: Rules) -> None:
    allocations = build_allocation(
        risk_level="high",
        investment_type="lumpsum",
        duration_years=12,
        liquidity_need="low",
        investment_amount=500_000,
        rules=rules,
    )
    weights = [a.allocation_pct for a in allocations]
    assert weights == sorted(weights, reverse=True)


def test_crypto_is_excluded_for_low_risk(rules: Rules) -> None:
    allocations = build_allocation(
        risk_level="low",
        investment_type="lumpsum",
        duration_years=5,
        liquidity_need="low",
        investment_amount=200_000,
        rules=rules,
    )
    assert "Cryptocurrency" not in {a.asset_name for a in allocations}


def test_crypto_is_excluded_for_medium_risk(rules: Rules) -> None:
    allocations = build_allocation(
        risk_level="medium",
        investment_type="lumpsum",
        duration_years=5,
        liquidity_need="low",
        investment_amount=200_000,
        rules=rules,
    )
    assert "Cryptocurrency" not in {a.asset_name for a in allocations}


def test_crypto_appears_for_high_risk(rules: Rules) -> None:
    allocations = build_allocation(
        risk_level="high",
        investment_type="lumpsum",
        duration_years=20,
        liquidity_need="low",
        investment_amount=500_000,
        rules=rules,
    )
    assert "Cryptocurrency" in {a.asset_name for a in allocations}


def test_crypto_respects_the_ten_percent_cap(rules: Rules) -> None:
    allocations = build_allocation(
        risk_level="high",
        investment_type="lumpsum",
        duration_years=20,
        liquidity_need="low",
        investment_amount=500_000,
        rules=rules,
    )
    crypto = [a for a in allocations if a.asset_type == "crypto"]
    assert sum(a.allocation_pct for a in crypto) <= 10.0


def test_long_term_assets_are_funded_from_the_debt_bucket(rules: Rules) -> None:
    """PPF is asset_type long_term; it must still receive a weight."""
    allocations = build_allocation(
        risk_level="medium",
        investment_type="lumpsum",
        duration_years=5,
        liquidity_need="low",
        investment_amount=200_000,
        rules=rules,
    )
    assert "PPF" in {a.asset_name for a in allocations}


def test_orphaned_bucket_is_redistributed_not_lost(rules: Rules) -> None:
    """With every asset eligible nothing should be orphaned, so still total 100."""
    assert _total(rules) == 100.00


def test_orphaned_bucket_redistribution_keeps_total(rules: Rules) -> None:
    """Strip gold out of eligibility; its weight must move elsewhere."""
    starved = Rules(
        **{**rules.__dict__, "assets": {k: v for k, v in rules.assets.items() if v.asset_type != "gold"}}
    )
    assert _total(starved) == 100.00


def test_existing_gold_holdings_reduce_gold_weight(rules: Rules) -> None:
    without = build_allocation(
        risk_level="medium",
        investment_type="lumpsum",
        duration_years=5,
        liquidity_need="low",
        investment_amount=200_000,
        rules=rules,
    )
    with_holdings = build_allocation(
        risk_level="medium",
        investment_type="lumpsum",
        duration_years=5,
        liquidity_need="low",
        investment_amount=200_000,
        existing_investment="gold",
        rules=rules,
    )

    def gold_weight(allocations) -> float:
        return round(sum(a.allocation_pct for a in allocations if a.asset_type == "gold"), 2)

    assert gold_weight(with_holdings) < gold_weight(without)
    assert round(sum(a.allocation_pct for a in with_holdings), 2) == 100.00


def test_crypto_cap_action_clamps_to_threshold(rules: Rules) -> None:
    allocations = build_allocation(
        risk_level="high",
        investment_type="lumpsum",
        duration_years=20,
        liquidity_need="low",
        investment_amount=500_000,
        existing_investment="crypto",
        rules=rules,
    )
    crypto = sum(a.allocation_pct for a in allocations if a.asset_type == "crypto")
    assert crypto <= 5.0
    assert round(sum(a.allocation_pct for a in allocations), 2) == 100.00


def test_holdings_below_the_threshold_change_nothing(rules: Rules) -> None:
    """Equity threshold is 70; medium risk only asks for 50, so it must not bite."""
    without = build_allocation(
        risk_level="medium",
        investment_type="lumpsum",
        duration_years=5,
        liquidity_need="low",
        investment_amount=200_000,
        rules=rules,
    )
    with_holdings = build_allocation(
        risk_level="medium",
        investment_type="lumpsum",
        duration_years=5,
        liquidity_need="low",
        investment_amount=200_000,
        existing_investment="equity",
        rules=rules,
    )
    assert [a.allocation_pct for a in with_holdings] == [
        a.allocation_pct for a in without
    ]


def test_existing_holdings_only_shrinks_its_own_bucket(rules: Rules) -> None:
    """A gold holding cuts gold; every other bucket may only gain the freed weight.

    They gain rather than stay flat because the released points are redistributed
    so the portfolio still totals 100.
    """
    without = build_allocation(
        risk_level="medium",
        investment_type="lumpsum",
        duration_years=5,
        liquidity_need="low",
        investment_amount=200_000,
        rules=rules,
    )
    with_holdings = build_allocation(
        risk_level="medium",
        investment_type="lumpsum",
        duration_years=5,
        liquidity_need="low",
        investment_amount=200_000,
        existing_investment="gold",
        rules=rules,
    )

    def weight_of(allocations, bucket: str) -> float:
        """Weight of a *bucket*, not a raw asset_type.

        PPF is asset_type 'long_term' but is funded from the debt bucket, so
        grouping by asset_type would undercount debt.
        """
        return round(
            sum(
                a.allocation_pct
                for a in allocations
                if TYPE_TO_BUCKET.get(a.asset_type) == bucket
            ),
            2,
        )

    gold_before = weight_of(without, "gold")
    gold_after = weight_of(with_holdings, "gold")
    assert gold_after < gold_before

    freed = round(gold_before - gold_after, 2)
    for other in ("equity", "debt", "safe"):
        assert weight_of(with_holdings, other) >= weight_of(without, other), (
            f"{other} should only gain, never lose, from a gold reduction"
        )

    # The freed weight is fully accounted for, not created or destroyed.
    gained = round(
        sum(
            weight_of(with_holdings, other) - weight_of(without, other)
            for other in ("equity", "debt", "safe")
        ),
        2,
    )
    assert gained == pytest.approx(freed, abs=0.02)
    assert round(sum(a.allocation_pct for a in with_holdings), 2) == 100.00


def test_unknown_existing_holding_is_ignored(rules: Rules) -> None:
    without = build_allocation(
        risk_level="medium",
        investment_type="lumpsum",
        duration_years=5,
        liquidity_need="low",
        investment_amount=200_000,
        rules=rules,
    )
    weird = build_allocation(
        risk_level="medium",
        investment_type="lumpsum",
        duration_years=5,
        liquidity_need="low",
        investment_amount=200_000,
        existing_investment="real_estate",
        rules=rules,
    )
    assert [a.allocation_pct for a in weird] == [a.allocation_pct for a in without]


def test_high_liquidity_need_removes_fixed_deposits(rules: Rules) -> None:
    allocations = build_allocation(
        risk_level="medium",
        investment_type="lumpsum",
        duration_years=5,
        liquidity_need="high",
        investment_amount=200_000,
        rules=rules,
    )
    assert "Fixed Deposit" not in {a.asset_name for a in allocations}


def test_short_horizon_reduces_equity(rules: Rules) -> None:
    """Under a year tilts 25 points out of equity and into debt."""
    short = build_allocation(
        risk_level="high",
        investment_type="lumpsum",
        duration_years=1,
        liquidity_need="low",
        investment_amount=500_000,
        rules=rules,
    )
    long = build_allocation(
        risk_level="high",
        investment_type="lumpsum",
        duration_years=25,
        liquidity_need="low",
        investment_amount=500_000,
        rules=rules,
    )

    def equity_weight(allocations) -> float:
        return round(sum(a.allocation_pct for a in allocations if a.asset_type == "equity"), 2)

    assert equity_weight(short) < equity_weight(long)


def test_medium_liquidity_shifts_weight_into_safe(rules: Rules) -> None:
    low = build_allocation(
        risk_level="medium",
        investment_type="lumpsum",
        duration_years=5,
        liquidity_need="low",
        investment_amount=200_000,
        rules=rules,
    )
    medium = build_allocation(
        risk_level="medium",
        investment_type="lumpsum",
        duration_years=5,
        liquidity_need="medium",
        investment_amount=200_000,
        rules=rules,
    )

    def safe_weight(allocations) -> float:
        return round(sum(a.allocation_pct for a in allocations if a.asset_type == "safe"), 2)

    assert safe_weight(medium) > safe_weight(low)


def test_amount_threshold_narrows_eligible_instruments(rules: Rules) -> None:
    """A ₹5,000 ticket cannot buy the same instruments as a ₹1,00,000 one."""
    restricted = Rules(
        **{
            **rules.__dict__,
            "amount_rules": {
                "lumpsum": [(100_000, {"Fixed Deposit", "Debt Mutual Fund"})],
                "monthly": [],
            },
        }
    )
    allocations = build_allocation(
        risk_level="medium",
        investment_type="lumpsum",
        duration_years=5,
        liquidity_need="low",
        investment_amount=200_000,
        rules=restricted,
    )
    names = {a.asset_name for a in allocations}
    assert names <= {"Fixed Deposit", "Debt Mutual Fund"}
    assert round(sum(a.allocation_pct for a in allocations), 2) == 100.00


def test_expected_return_is_the_midpoint_of_the_band(rules: Rules) -> None:
    allocations = build_allocation(
        risk_level="medium",
        investment_type="lumpsum",
        duration_years=5,
        liquidity_need="low",
        investment_amount=200_000,
        rules=rules,
    )
    for a in allocations:
        assert a.min_return_pct <= a.expected_return_pct <= a.max_return_pct


def test_unknown_risk_level_is_rejected(rules: Rules) -> None:
    with pytest.raises(RuleError, match="Unknown risk level"):
        build_allocation(
            risk_level="reckless",
            investment_type="lumpsum",
            duration_years=5,
            liquidity_need="low",
            investment_amount=200_000,
            rules=rules,
        )


def test_completely_ineligible_request_raises(rules: Rules) -> None:
    """No instrument offered for this strategy means an honest failure."""
    blocked = Rules(**{**rules.__dict__, "type_asset_rules": {"monthly": {}, "lumpsum": {}}})
    with pytest.raises(RuleError, match="collapsed to zero"):
        build_allocation(
            risk_level="medium",
            investment_type="lumpsum",
            duration_years=5,
            liquidity_need="low",
            investment_amount=200_000,
            rules=blocked,
        )


def test_every_bucket_starts_from_the_risk_base(rules: Rules) -> None:
    """Sanity check that the five canonical buckets are the ones we normalise."""
    assert set(BUCKETS) == {"equity", "debt", "gold", "safe", "crypto"}