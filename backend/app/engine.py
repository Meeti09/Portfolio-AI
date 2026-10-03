"""Portfolio allocation engine.

The rule tables in MySQL hold the *policy*; this module holds the *arithmetic*.
Keeping the computation here (rather than in a SQL view) means it can be unit
tested without a database and that percentage maths uses floats/decimals instead
of MySQL integer division, which silently truncated (e.g. 45 / 2 -> 22).

Pipeline
--------
1. Start from the risk base allocation for the profile.
2. Tilt equity/debt by the investment horizon.
3. Tilt debt/safe by the liquidity requirement.
4. Drop instruments disallowed by risk, horizon, liquidity or ticket size.
5. Redistribute buckets left with no eligible instrument.
6. Enforce per asset-class caps.
7. Discount classes the user already holds heavily.
8. Normalise to 100% and split each bucket across its instruments using
   largest-remainder rounding so the parts sum to exactly 100.00.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

from app.db import get_cursor

logger = logging.getLogger(__name__)

BUCKETS: tuple[str, ...] = ("equity", "debt", "gold", "safe", "crypto")

# Weights are apportioned in whole hundredths of a percent.
TOTAL_CENTS = 10_000

# PPF and NPS are tax-advantaged, low-volatility instruments. The risk base
# allocation has no long_term column, so they are funded from the debt bucket.
TYPE_TO_BUCKET: dict[str, str] = {
    "equity": "equity",
    "debt": "debt",
    "long_term": "debt",
    "gold": "gold",
    "safe": "safe",
    "crypto": "crypto",
}

# Horizon buckets. Ranges are half-open and cover [1, inf) with no gaps and no
# overlaps, so a horizon can never match two rules.
#
# The label was 'upto_1' rather than '<1': duration_years has a minimum of 1, so
# a strict '<1' bucket was unreachable and its strong equity haircut never fired.
BUCKET_BY_DURATION: tuple[tuple[int, str], ...] = (
    (1, "upto_1"),
    (3, "1 -- 3"),
    (5, "3 -- 5"),
    (8, "5 -- 8"),
)
DURATION_ABOVE = ">8"

# A rule of 'disallow' removes the instrument; anything else only influences
# ordering, so it is not a hard filter.
DISALLOW = "disallow"


class RuleError(ValueError):
    """Raised when the request cannot be satisfied by the loaded rule set."""


def duration_bucket(duration_years: int) -> str:
    """Map an investment horizon in years to its duration_bucket label."""
    for upper_bound, label in BUCKET_BY_DURATION:
        if duration_years <= upper_bound:
            return label
    return DURATION_ABOVE


@dataclass(frozen=True)
class Asset:
    asset_id: int
    asset_name: str
    asset_type: str

    @property
    def bucket(self) -> str:
        return TYPE_TO_BUCKET.get(self.asset_type, "safe")


@dataclass(frozen=True)
class Rules:
    """Every reference table the engine needs, loaded in one go."""

    risk_base: dict[str, dict[str, int]] = field(default_factory=dict)
    duration_rules: dict[str, dict[str, int]] = field(default_factory=dict)
    assets: dict[int, Asset] = field(default_factory=dict)
    type_asset_rules: dict[str, dict[int, str]] = field(default_factory=dict)
    risk_constraints: dict[str, dict[int, str]] = field(default_factory=dict)
    duration_constraints: dict[str, dict[int, str]] = field(default_factory=dict)
    liquidity_constraints: dict[str, dict[int, str]] = field(default_factory=dict)
    existing_rules: dict[str, dict[str, Any]] = field(default_factory=dict)
    amount_rules: dict[str, list[tuple[int, set[str]]]] = field(default_factory=dict)
    caps: dict[str, int] = field(default_factory=dict)
    returns: dict[str, tuple[int, int]] = field(default_factory=dict)


@dataclass(frozen=True)
class Allocation:
    asset_name: str
    asset_type: str
    allocation_pct: float
    amount: float
    expected_return_pct: float
    min_return_pct: float
    max_return_pct: float


# ---------------------------------------------------------------------------
# Loading rules
# ---------------------------------------------------------------------------
def load_rules() -> Rules:
    """Read every reference table into memory. Called once per request."""
    queries: dict[str, str] = {
        "risk_base": "SELECT risk_level, equity_pct, debt_pct, gold_pct, safe_pct, crypto_pct FROM risk_base_allocation",
        "duration_rules": "SELECT duration_bucket, equity_adj, debt_adj FROM duration_allocation_rules",
        "assets": "SELECT asset_id, asset_name, asset_type FROM asset_master",
        "type_asset_rules": "SELECT investment_type, asset_id, allowed FROM investment_type_asset_rules",
        "risk_constraints": "SELECT risk_level, asset_id, rule FROM risk_asset_constraints",
        "duration_constraints": "SELECT duration_bucket, asset_id, rule FROM duration_asset_constraints",
        "liquidity_constraints": "SELECT liquidity_need, asset_id, rule FROM liquidity_constraints",
        "existing_rules": "SELECT asset_type, threshold_pct, action FROM existing_investment_rules",
        "amount_rules": "SELECT investment_type, min_amount, allowed_assets FROM amount_threshold_rules ORDER BY investment_type, min_amount",
        "caps": "SELECT asset_type, max_pct FROM allocation_caps",
        "returns": "SELECT asset_type, min_return, max_return FROM return_reference",
    }

    rows: dict[str, list[dict[str, Any]]] = {}
    with get_cursor(dictionary=True) as cursor:
        for key, sql in queries.items():
            cursor.execute(sql)
            rows[key] = list(cursor.fetchall())

    risk_base = {
        r["risk_level"]: {
            "equity": r["equity_pct"],
            "debt": r["debt_pct"],
            "gold": r["gold_pct"],
            "safe": r["safe_pct"],
            "crypto": r["crypto_pct"],
        }
        for r in rows["risk_base"]
    }
    duration_rules = {
        r["duration_bucket"]: {"equity_adj": r["equity_adj"], "debt_adj": r["debt_adj"]}
        for r in rows["duration_rules"]
    }
    assets = {
        r["asset_id"]: Asset(r["asset_id"], r["asset_name"], r["asset_type"])
        for r in rows["assets"]
    }

    def group(rows_in: list[dict[str, Any]], key: str, sub: str) -> dict[str, dict[int, str]]:
        out: dict[str, dict[int, str]] = {}
        for r in rows_in:
            out.setdefault(r[key], {})[r["asset_id"]] = r["rule"] if sub == "rule" else r[sub]
        return out

    type_asset_rules: dict[str, dict[int, str]] = {}
    for r in rows["type_asset_rules"]:
        type_asset_rules.setdefault(r["investment_type"], {})[r["asset_id"]] = r["allowed"]

    amount_rules: dict[str, list[tuple[int, set[str]]]] = {}
    for r in rows["amount_rules"]:
        names = {n.strip() for n in r["allowed_assets"].split(",") if n.strip()}
        amount_rules.setdefault(r["investment_type"], []).append((r["min_amount"], names))

    return Rules(
        risk_base=risk_base,
        duration_rules=duration_rules,
        assets=assets,
        type_asset_rules=type_asset_rules,
        risk_constraints=group(rows["risk_constraints"], "risk_level", "rule"),
        duration_constraints=group(rows["duration_constraints"], "duration_bucket", "rule"),
        liquidity_constraints=group(rows["liquidity_constraints"], "liquidity_need", "rule"),
        existing_rules={
            r["asset_type"]: {"threshold_pct": r["threshold_pct"], "action": r["action"]}
            for r in rows["existing_rules"]
        },
        amount_rules=amount_rules,
        caps={r["asset_type"]: r["max_pct"] for r in rows["caps"]},
        returns={r["asset_type"]: (r["min_return"], r["max_return"]) for r in rows["returns"]},
    )


# ---------------------------------------------------------------------------
# Pure allocation maths
# ---------------------------------------------------------------------------
def _base_targets(
    risk_level: str,
    duration_years: int,
    liquidity_need: str,
    rules: Rules,
) -> dict[str, float]:
    """Steps 1-3: risk base, tilted by horizon then liquidity."""
    base = rules.risk_base.get(risk_level)
    if base is None:
        raise RuleError(f"Unknown risk level {risk_level!r}")

    bucket_label = duration_bucket(duration_years)
    adj = rules.duration_rules.get(bucket_label)
    if adj is None:
        # A missing row used to fall back to a zero adjustment, which silently
        # produced a plausible-looking but wrong allocation (the strong equity
        # haircut for a 1-year horizon simply never applied). Refusing to run
        # surfaces a seed/schema mismatch instead of hiding it.
        raise RuleError(
            f"No duration_allocation_rules row for bucket {bucket_label!r} "
            f"(horizon {duration_years} years). Re-run sql/02_seed.sql."
        )

    targets = {bucket: float(base[bucket]) for bucket in BUCKETS}
    targets["equity"] += adj["equity_adj"]
    targets["debt"] += adj["debt_adj"]

    # A medium liquidity requirement parks 5 points in cash, out of debt.
    if liquidity_need == "medium":
        targets["debt"] -= 5
        targets["safe"] += 5

    return {bucket: max(value, 0.0) for bucket, value in targets.items()}


def _eligible_assets(
    investment_type: str,
    investment_amount: int,
    risk_level: str,
    duration_years: int,
    liquidity_need: str,
    rules: Rules,
) -> dict[str, list[Asset]]:
    """Step 4: which instruments each asset-class bucket may use."""
    permitted = rules.type_asset_rules.get(investment_type, {})
    risk_rules = rules.risk_constraints.get(risk_level, {})
    duration_rules = rules.duration_constraints.get(duration_bucket(duration_years), {})
    liquidity_rules = rules.liquidity_constraints.get(liquidity_need, {})

    # Ticket-size gate: the largest threshold at or below the user's amount.
    size_allowed: set[str] | None = None
    for min_amount, names in rules.amount_rules.get(investment_type, []):
        if investment_amount >= min_amount:
            size_allowed = names

    buckets: dict[str, list[Asset]] = {bucket: [] for bucket in BUCKETS}

    for asset_id, asset in rules.assets.items():
        # Must be mapped to a known bucket at all.
        if asset.bucket not in buckets:
            continue
        # The strategy table is the master switch; no row means not offered.
        if permitted.get(asset_id) not in {"yes", "conditional"}:
            continue
        if risk_rules.get(asset_id) == DISALLOW:
            continue
        if duration_rules.get(asset_id) == DISALLOW:
            continue
        if liquidity_rules.get(asset_id) == DISALLOW:
            continue
        # When size rules exist for this strategy, they narrow the list.
        if size_allowed is not None and asset.asset_name not in size_allowed:
            continue
        buckets[asset.bucket].append(asset)

    for assets in buckets.values():
        assets.sort(key=lambda a: a.asset_name)

    return buckets


def _redistribute(targets: dict[str, float], pool: float, locked: set[str]) -> None:
    """Hand `pool` points to the unlocked buckets in proportion to their size."""
    if pool <= 0:
        return
    open_buckets = [b for b in BUCKETS if b not in locked and targets[b] > 0]
    if not open_buckets:
        return
    total = sum(targets[b] for b in open_buckets)
    if total <= 0:
        return
    for bucket in open_buckets:
        targets[bucket] += pool * targets[bucket] / total


def _existing_holdings_ceiling(
    bucket: str,
    current: float,
    existing_investment: str,
    rules: Rules,
) -> float | None:
    """Weight ceiling implied by a heavy existing holding, or None.

    The client's existing exposure percentage is not collected, so the rule's
    threshold is read as a diversification ceiling:
      * 'reduce' -> scale the target to threshold% of what it would have been.
      * 'cap'    -> clamp the target to the threshold outright.

    Only the bucket matching `existing_investment` is affected. Returns None when
    the rule does not apply or does not bite.
    """
    if not existing_investment or existing_investment == "none":
        return None

    # The rule describes one asset class; it must not bleed into the others.
    if TYPE_TO_BUCKET.get(existing_investment) != bucket:
        return None

    rule = rules.existing_rules.get(existing_investment)
    if rule is None:
        return None

    threshold = float(rule["threshold_pct"])
    if current <= threshold:
        return None

    if rule["action"] == "cap":
        return threshold
    return current * (threshold / 100.0)


def _apply_constraints(
    targets: dict[str, float],
    existing_investment: str,
    rules: Rules,
    max_iterations: int = 25,
) -> dict[str, float]:
    """Steps 6-7: enforce caps and existing-holding limits, recycling overflow.

    Runs to a fixed point. A single pass is not enough: capping equity and
    spilling the excess into crypto can push crypto past its own ceiling, so the
    loop keeps clamping and redistributing until nothing overflows. Each pass
    conserves the total, so the portfolio always stays at 100.
    """
    epsilon = 1e-9

    for _ in range(max_iterations):
        locked: set[str] = set()
        pool = 0.0

        for bucket, cap in rules.caps.items():
            if bucket not in targets:
                continue
            if targets[bucket] > cap + epsilon:
                pool += targets[bucket] - cap
                targets[bucket] = float(cap)
                locked.add(bucket)

        for bucket in BUCKETS:
            ceiling = _existing_holdings_ceiling(
                bucket, targets[bucket], existing_investment, rules
            )
            if ceiling is not None and targets[bucket] > ceiling + epsilon:
                pool += targets[bucket] - ceiling
                targets[bucket] = ceiling
                locked.add(bucket)

        if pool <= epsilon:
            break
        _redistribute(targets, pool, locked)

    return targets


def _normalise(targets: dict[str, float]) -> dict[str, float]:
    """Step 8a: scale so the buckets total exactly 100."""
    total = sum(targets.values())
    if total <= 0:
        raise RuleError("Allocation collapsed to zero — no asset class could be funded.")
    return {bucket: value * 100.0 / total for bucket, value in targets.items()}


def _allocate(total_cents: int, weights: list[float]) -> list[int]:
    """Split `total_cents` across `weights` proportionally, summing exactly.

    Largest-remainder apportionment in pure integer arithmetic. Rounding each
    share independently (or rounding floats) drifts: 33.33 x 3 is 99.99, and
    three buckets each holding ~33.3333 lose a cent apiece. Working in whole
    cents and distributing the leftover by largest remainder keeps the total
    exact.
    """
    count = len(weights)
    if count == 0:
        return []
    if total_cents <= 0:
        return [0] * count

    weight_total = sum(weights)
    if weight_total <= 0:
        # Nothing to go on: spread evenly.
        shares = [total_cents // count] * count
        for i in range(total_cents - sum(shares)):
            shares[i] += 1
        return shares

    shares: list[int] = []
    remainders: list[tuple[float, int]] = []
    for index, weight in enumerate(weights):
        numerator = total_cents * weight
        whole = int(numerator // weight_total)
        shares.append(whole)
        remainders.append((numerator - whole * weight_total, index))

    leftover = total_cents - sum(shares)
    # Largest fractional part first; index breaks ties so the result is stable.
    remainders.sort(key=lambda pair: (-pair[0], pair[1]))
    for _, index in remainders[:leftover]:
        shares[index] += 1

    return shares


def build_allocation(
    *,
    risk_level: str,
    investment_type: str,
    duration_years: int,
    liquidity_need: str,
    investment_amount: int,
    existing_investment: str = "none",
    rules: Rules | None = None,
) -> list[Allocation]:
    """Compute a full allocation. Pure function — pass `rules` to stay off the DB."""
    if rules is None:
        rules = load_rules()

    targets = _base_targets(risk_level, duration_years, liquidity_need, rules)
    buckets = _eligible_assets(
        investment_type, investment_amount, risk_level, duration_years, liquidity_need, rules
    )

    # Step 5: a bucket with money but no eligible instrument cannot be funded.
    orphaned = 0.0
    for bucket, weight in targets.items():
        if weight > 0 and not buckets[bucket]:
            orphaned += weight
            targets[bucket] = 0.0
    _redistribute(targets, orphaned, locked={b for b in BUCKETS if not buckets[b]})

    targets = _normalise(targets)
    targets = _apply_constraints(targets, existing_investment, rules)

    funded = [b for b in BUCKETS if buckets[b] and targets[b] > 0]
    if not funded:
        raise RuleError(
            "Allocation collapsed to zero — no asset class could be funded."
        )

    # Two stage apportionment. Splitting 10000 cents across the funded buckets
    # first, then each bucket's cents across its instruments, is what keeps the
    # per-instrument percentages summing to exactly 100.00.
    bucket_cents = _allocate(
        TOTAL_CENTS, [targets[b] for b in funded]
    )

    allocations: list[Allocation] = []
    for bucket, bucket_share in zip(funded, bucket_cents, strict=True):
        assets = buckets[bucket]
        # Equal weight per instrument inside a bucket.
        asset_cents = _allocate(bucket_share, [1.0] * len(assets))
        for asset, cents in zip(assets, asset_cents, strict=True):
            if cents == 0:
                continue
            low, high = rules.returns.get(asset.asset_type, (0, 0))
            pct = cents / 100.0
            allocations.append(
                Allocation(
                    asset_name=asset.asset_name,
                    asset_type=asset.asset_type,
                    allocation_pct=pct,
                    amount=round(pct * investment_amount / 100.0, 2),
                    expected_return_pct=round((low + high) / 2.0, 2),
                    min_return_pct=float(low),
                    max_return_pct=float(high),
                )
            )

    allocations.sort(key=lambda a: (-a.allocation_pct, a.asset_name))
    logger.info(
        "Allocated %s across %d instruments (risk=%s, horizon=%s bucket)",
        investment_amount,
        len(allocations),
        risk_level,
        duration_bucket(duration_years),
    )
    return allocations