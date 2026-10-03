"""Integration tests: the real FastAPI app against the real MySQL database.

These need backend/.env to point at a database created by 00_bootstrap.sql +
01_schema.sql + 02_seed.sql. They create and delete their own users, so they
are safe to run against a development database.
"""

from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient

from app.db import execute, fetch_all, ping
from app.engine import BUCKET_BY_DURATION, DURATION_ABOVE
from app.main import app

pytestmark = pytest.mark.skipif(
    not ping(), reason="MySQL is not reachable; run the sql/ bootstrap first"
)


@pytest.fixture(scope="module")
def client() -> TestClient:
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def account(client: TestClient) -> dict[str, str]:
    """A freshly registered, logged-in account. Removed after the test."""
    email = f"test_{uuid.uuid4().hex[:12]}@example.com"
    password = "Str0ng!Pass"

    response = client.post(
        "/signup",
        json={"name": "Test User", "email": email, "password": password, "age": 30},
    )
    assert response.status_code == 201, response.text

    login = client.post("/login", json={"email": email, "password": password})
    assert login.status_code == 200, login.text

    tokens = login.json()
    yield {"email": email, "password": password, **tokens}

    execute("DELETE FROM users WHERE email = %s", (email,))


def auth_header(tokens: dict[str, str]) -> dict[str, str]:
    return {"Authorization": f"Bearer {tokens['accessToken']}"}


# ---------------------------------------------------------------------------
# Seed / engine parity
# ---------------------------------------------------------------------------
def test_seed_has_a_row_for_every_duration_bucket() -> None:
    """Every horizon the engine can produce must exist in the seed data.

    The engine derives a bucket label such as 'upto_1' and looks it up in
    duration_allocation_rules. When the label is missing the engine raises
    rather than guessing, which means a stale database breaks every request for
    that horizon. This test fails early and points at the cause.
    """
    expected = {label for _, label in BUCKET_BY_DURATION} | {DURATION_ABOVE}
    rows = fetch_all("SELECT DISTINCT duration_bucket FROM duration_allocation_rules")

    present = {row["duration_bucket"] for row in rows}
    missing = expected - present

    assert not missing, (
        f"duration_allocation_rules is missing buckets {sorted(missing)}; "
        "the database seed is out of date with app/engine.py. "
        "Re-run sql/01_schema.sql and sql/02_seed.sql."
    )


def test_every_duration_horizon_resolves_to_a_seeded_bucket() -> None:
    """duration_bucket() and the database agree across the whole horizon range."""
    from app.engine import duration_bucket

    rows = fetch_all("SELECT DISTINCT duration_bucket FROM duration_allocation_rules")
    present = {row["duration_bucket"] for row in rows}

    unresolved = sorted(
        {duration_bucket(years) for years in range(1, 61)} - present
    )
    assert not unresolved, (
        f"horizons 1-60 map to unseeded buckets {unresolved}; "
        "re-run sql/01_schema.sql and sql/02_seed.sql."
    )


# ---------------------------------------------------------------------------
# Meta
# ---------------------------------------------------------------------------
def test_health_reports_the_database(client: TestClient) -> None:
    body = client.get("/health").json()
    assert body["status"] == "ok"
    assert body["database"] == "up"


def test_openapi_schema_builds(client: TestClient) -> None:
    assert client.get("/openapi.json").status_code == 200


def test_private_network_preflight_is_accepted(client: TestClient) -> None:
    """HTTPS frontends calling a local HTTP API are public-to-private requests.

    Browsers preflight them with Access-Control-Request-Private-Network and
    drop the call without the opt-in header — surfacing as a bare "Network
    error" while the API is healthy.
    """
    response = client.options(
        "/login",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Private-Network": "true",
        },
    )
    assert response.status_code == 200, response.text
    assert response.headers.get("access-control-allow-private-network") == "true"


# ---------------------------------------------------------------------------
# Signup
# ---------------------------------------------------------------------------
def test_signup_returns_the_created_user(client: TestClient) -> None:
    email = f"test_{uuid.uuid4().hex[:12]}@example.com"
    try:
        response = client.post(
            "/signup",
            json={
                "name": "Ada",
                "email": email,
                "password": "Str0ng!Pass",
                "age": 36,
            },
        )
        assert response.status_code == 201
        body = response.json()
        assert body["status"] == "success"
        assert body["user"]["email"] == email
        assert body["user"]["age"] == 36
        assert "password" not in body["user"]
    finally:
        execute("DELETE FROM users WHERE email = %s", (email,))


def test_signup_never_returns_the_password_hash(client: TestClient) -> None:
    email = f"test_{uuid.uuid4().hex[:12]}@example.com"
    try:
        response = client.post(
            "/signup",
            json={
                "name": "Ada",
                "email": email,
                "password": "Str0ng!Pass",
                "age": 36,
            },
        )
        assert "Str0ng!Pass" not in response.text
        assert "password_hash" not in response.text
    finally:
        execute("DELETE FROM users WHERE email = %s", (email,))


def test_duplicate_email_is_a_conflict_not_a_500(client: TestClient) -> None:
    """The original code raised 500 on the duplicate-key error."""
    email = f"test_{uuid.uuid4().hex[:12]}@example.com"
    payload = {"name": "Ada", "email": email, "password": "Str0ng!Pass", "age": 36}
    try:
        assert client.post("/signup", json=payload).status_code == 201
        second = client.post("/signup", json=payload)
        assert second.status_code == 409
        assert "already exists" in second.json()["detail"]
    finally:
        execute("DELETE FROM users WHERE email = %s", (email,))


@pytest.mark.parametrize(
    "password",
    [
        "Sh0rt!",  # under 8 characters
        "nouppercase1!",  # no uppercase
        "NOLOWERCASE1!",  # no lowercase
        "NoDigits!!",  # no digit
        "NoSpecial123",  # no special character
    ],
)
def test_weak_passwords_are_rejected(client: TestClient, password: str) -> None:
    response = client.post(
        "/signup",
        json={
            "name": "Ada",
            "email": f"t_{uuid.uuid4().hex[:10]}@example.com",
            "password": password,
            "age": 30,
        },
    )
    assert response.status_code == 422


@pytest.mark.parametrize("age", [0, 101, -5])
def test_out_of_range_age_is_rejected(client: TestClient, age: int) -> None:
    response = client.post(
        "/signup",
        json={
            "name": "Ada",
            "email": f"t_{uuid.uuid4().hex[:10]}@example.com",
            "password": "Str0ng!Pass",
            "age": age,
        },
    )
    assert response.status_code == 422


def test_malformed_email_is_rejected(client: TestClient) -> None:
    response = client.post(
        "/signup",
        json={
            "name": "Ada",
            "email": "not-an-email",
            "password": "Str0ng!Pass",
            "age": 30,
        },
    )
    assert response.status_code == 422


# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------
def test_login_returns_both_tokens(client: TestClient, account: dict[str, str]) -> None:
    assert account["accessToken"]
    assert account["refreshToken"]
    assert account["accessToken"] != account["refreshToken"]


def test_login_with_wrong_password_is_401(client: TestClient, account: dict[str, str]) -> None:
    response = client.post(
        "/login", json={"email": account["email"], "password": "Wr0ng!Pass"}
    )
    assert response.status_code == 401


def test_login_with_unknown_email_is_401(client: TestClient) -> None:
    response = client.post(
        "/login", json={"email": "nobody@example.com", "password": "Str0ng!Pass"}
    )
    assert response.status_code == 401


def test_login_error_does_not_reveal_whether_the_email_exists(
    client: TestClient, account: dict[str, str]
) -> None:
    """Same message either way, so the endpoint is not an email oracle."""
    unknown = client.post(
        "/login", json={"email": "nobody@example.com", "password": "Str0ng!Pass"}
    ).json()
    wrong = client.post(
        "/login", json={"email": account["email"], "password": "Wr0ng!Pass"}
    ).json()
    assert unknown["detail"] == wrong["detail"]


def test_login_is_case_insensitive_on_email(
    client: TestClient, account: dict[str, str]
) -> None:
    response = client.post(
        "/login",
        json={"email": account["email"].upper(), "password": account["password"]},
    )
    assert response.status_code == 200


# ---------------------------------------------------------------------------
# Token lifecycle
# ---------------------------------------------------------------------------
def test_me_returns_the_authenticated_user(
    client: TestClient, account: dict[str, str]
) -> None:
    response = client.get("/me", headers=auth_header(account))
    assert response.status_code == 200
    assert response.json()["email"] == account["email"]


def test_me_without_a_token_is_401(client: TestClient) -> None:
    assert client.get("/me").status_code == 401


def test_me_with_a_garbage_token_is_401(client: TestClient) -> None:
    assert client.get("/me", headers={"Authorization": "Bearer nonsense"}).status_code == 401


def test_access_token_is_rejected_as_a_refresh_token(
    client: TestClient, account: dict[str, str]
) -> None:
    """The interceptor must not be able to escalate a short-lived token."""
    response = client.post(
        "/refresh-token", json={"refreshToken": account["accessToken"]}
    )
    assert response.status_code == 401


def test_refresh_token_mints_a_new_access_token(
    client: TestClient, account: dict[str, str]
) -> None:
    response = client.post(
        "/refresh-token", json={"refreshToken": account["refreshToken"]}
    )
    assert response.status_code == 200
    tokens = response.json()
    assert tokens["accessToken"] != account["accessToken"]

    # The new token actually works.
    assert client.get("/me", headers=auth_header(tokens)).status_code == 200


def test_refresh_with_a_garbage_token_is_401(client: TestClient) -> None:
    assert client.post("/refresh-token", json={"refreshToken": "nope"}).status_code == 401


def test_refresh_token_is_not_accepted_as_a_bearer(
    client: TestClient, account: dict[str, str]
) -> None:
    headers = {"Authorization": f"Bearer {account['refreshToken']}"}
    assert client.get("/me", headers=headers).status_code == 401


def test_logout_succeeds_for_an_authenticated_user(
    client: TestClient, account: dict[str, str]
) -> None:
    assert client.post("/logout", headers=auth_header(account)).status_code == 204


# ---------------------------------------------------------------------------
# Portfolio
# ---------------------------------------------------------------------------
VALID_REQUEST = {
    "risk_level": "medium",
    "investment_amount": 200_000,
    "investment_type": "lumpsum",
    "duration_years": 5,
    "liquidity_need": "low",
    "existing_investment": "none",
    # The shared account fixture signs up with age 30; every request below
    # must carry the same age or the API rejects it as inconsistent.
    "age": 30,
}


def test_generate_portfolio_requires_auth(client: TestClient) -> None:
    assert client.post("/generate-portfolio", json=VALID_REQUEST).status_code == 401


def test_generate_portfolio_rejects_an_age_that_differs_from_the_account(
    client: TestClient, account: dict[str, str]
) -> None:
    """One account cannot be two ages at once."""
    response = client.post(
        "/generate-portfolio",
        json={**VALID_REQUEST, "age": 31},
        headers=auth_header(account),
    )
    assert response.status_code == 422, response.text
    assert "does not match" in response.text


def test_generate_portfolio_requires_age(
    client: TestClient, account: dict[str, str]
) -> None:
    """Age is required so the request can be checked against the account."""
    payload = {key: value for key, value in VALID_REQUEST.items() if key != "age"}
    response = client.post(
        "/generate-portfolio", json=payload, headers=auth_header(account)
    )
    assert response.status_code == 422, response.text


def test_a_one_year_horizon_applies_its_duration_rule(
    client: TestClient, account: dict[str, str]
) -> None:
    """A 1-year horizon must reach the 'upto_1' bucket, not fall through.

    The seed originally labelled this bucket '<1' while the engine asked for
    'upto_1'. The mismatch was invisible: the missing rule quietly became a zero
    adjustment, so the strongest equity haircut in the model never fired. Now
    that the engine refuses a missing bucket, a stale database produces a 422
    instead of a wrong allocation.
    """
    response = client.post(
        "/generate-portfolio",
        json={**VALID_REQUEST, "duration_years": 1},
        headers=auth_header(account),
    )
    assert response.status_code == 200, response.text

    body = response.json()
    total = round(sum(item["allocation_pct"] for item in body["portfolio"]), 2)
    assert total == 100.00

    # The 1-year rule caps equity and disallows crypto, so no crypto position
    # may appear even though crypto exists in asset_master.
    assert all(item["asset_type"] != "crypto" for item in body["portfolio"])


def test_a_one_year_horizon_is_not_cheaper_than_a_five_year_one(
    client: TestClient, account: dict[str, str]
) -> None:
    """The short-horizon haircut must actually reduce the equity weight."""
    def equity_pct(years: int) -> float:
        response = client.post(
            "/generate-portfolio",
            json={**VALID_REQUEST, "duration_years": years},
            headers=auth_header(account),
        )
        assert response.status_code == 200, response.text
        return round(
            sum(
                item["allocation_pct"]
                for item in response.json()["portfolio"]
                if item["asset_type"] == "equity"
            ),
            2,
        )

    assert equity_pct(1) < equity_pct(5)


def test_generate_portfolio_returns_a_full_allocation(
    client: TestClient, account: dict[str, str]
) -> None:
    response = client.post(
        "/generate-portfolio", json=VALID_REQUEST, headers=auth_header(account)
    )
    assert response.status_code == 200, response.text
    body = response.json()

    assert body["user_id"] > 0
    assert body["total_investment"] == 200_000
    assert body["portfolio"]

    total = round(sum(item["allocation_pct"] for item in body["portfolio"]), 2)
    assert total == 100.00

    amounts = round(sum(item["amount"] for item in body["portfolio"]), 2)
    assert amounts == 200_000.00


def test_every_item_carries_return_metadata(
    client: TestClient, account: dict[str, str]
) -> None:
    response = client.post(
        "/generate-portfolio", json=VALID_REQUEST, headers=auth_header(account)
    )
    for item in response.json()["portfolio"]:
        assert item["asset_name"]
        assert item["asset_type"]
        assert item["allocation_pct"] > 0
        assert item["min_return_pct"] <= item["expected_return_pct"]
        assert item["expected_return_pct"] <= item["max_return_pct"]


@pytest.mark.parametrize("risk", ["low", "medium", "high"])
def test_each_risk_profile_produces_a_valid_allocation(
    client: TestClient, account: dict[str, str], risk: str
) -> None:
    response = client.post(
        "/generate-portfolio",
        json={**VALID_REQUEST, "risk_level": risk},
        headers=auth_header(account),
    )
    assert response.status_code == 200, response.text
    assert round(sum(i["allocation_pct"] for i in response.json()["portfolio"]), 2) == 100.00


@pytest.mark.parametrize("strategy", ["monthly", "lumpsum"])
def test_each_strategy_produces_a_valid_allocation(
    client: TestClient, account: dict[str, str], strategy: str
) -> None:
    response = client.post(
        "/generate-portfolio",
        json={
            **VALID_REQUEST,
            "investment_type": strategy,
            "investment_amount": 10_000 if strategy == "monthly" else 200_000,
        },
        headers=auth_header(account),
    )
    assert response.status_code == 200, response.text
    assert round(sum(i["allocation_pct"] for i in response.json()["portfolio"]), 2) == 100.00


@pytest.mark.parametrize("risk", ["low", "medium", "high"])
def test_crypto_respects_the_risk_profile(
    client: TestClient, account: dict[str, str], risk: str
) -> None:
    response = client.post(
        "/generate-portfolio",
        json={**VALID_REQUEST, "risk_level": risk, "duration_years": 20},
        headers=auth_header(account),
    )
    items = response.json()["portfolio"]
    crypto = [i for i in items if i["asset_type"] == "crypto"]
    if risk in {"low", "medium"}:
        assert crypto == [], f"{risk} risk must not hold crypto"
    else:
        assert round(sum(i["allocation_pct"] for i in crypto), 2) <= 10.0


def test_profile_is_saved_and_re_readable(
    client: TestClient, account: dict[str, str]
) -> None:
    client.post("/generate-portfolio", json=VALID_REQUEST, headers=auth_header(account))
    response = client.get("/profile", headers=auth_header(account))
    assert response.status_code == 200
    assert response.json()["total_investment"] == 200_000


def test_re_running_does_not_duplicate_the_profile(
    client: TestClient, account: dict[str, str]
) -> None:
    """The original INSERTed a new user_profile row on every call."""
    for _ in range(3):
        client.post(
            "/generate-portfolio", json=VALID_REQUEST, headers=auth_header(account)
        )
    assert client.get("/history", headers=auth_header(account)).json().__len__() == 1


def test_profile_is_404_before_the_first_run(client: TestClient) -> None:
    email = f"test_{uuid.uuid4().hex[:12]}@example.com"
    try:
        client.post(
            "/signup",
            json={"name": "Test User", "email": email, "password": "Str0ng!Pass", "age": 30},
        )
        tokens = client.post(
            "/login", json={"email": email, "password": "Str0ng!Pass"}
        ).json()
        assert (
            client.get("/profile", headers=auth_header(tokens)).status_code == 404
        )
    finally:
        execute("DELETE FROM users WHERE email = %s", (email,))


def test_regenerating_replaces_the_previous_configuration(
    client: TestClient, account: dict[str, str]
) -> None:
    client.post(
        "/generate-portfolio",
        json={**VALID_REQUEST, "risk_level": "low"},
        headers=auth_header(account),
    )
    client.post(
        "/generate-portfolio",
        json={**VALID_REQUEST, "risk_level": "high"},
        headers=auth_header(account),
    )
    saved = client.get("/profile", headers=auth_header(account)).json()
    assert saved["total_investment"] == 200_000


def test_users_cannot_read_each_others_profiles(
    client: TestClient, account: dict[str, str]
) -> None:
    """One user's portfolio must never be visible to another."""
    other_email = f"test_{uuid.uuid4().hex[:12]}@example.com"
    try:
        client.post(
            "/signup",
            json={
                "name": "Other",
                "email": other_email,
                "password": "Str0ng!Pass",
                "age": 40,
            },
        )
        other = client.post(
            "/login", json={"email": other_email, "password": "Str0ng!Pass"}
        ).json()

        client.post(
            "/generate-portfolio", json=VALID_REQUEST, headers=auth_header(account)
        )
        # The other account has no profile of its own yet.
        assert client.get("/profile", headers=auth_header(other)).status_code == 404
    finally:
        execute("DELETE FROM users WHERE email = %s", (other_email,))


@pytest.mark.parametrize(
    "override",
    [
        {"risk_level": "reckless"},
        {"liquidity_need": "whenever"},
        {"investment_type": "crypto-lending"},
        {"existing_investment": "yachts"},
        {"investment_amount": 0},
        {"investment_amount": -500},
        {"duration_years": 0},
        {"duration_years": 500},
        {"age": 17},
    ],
)
def test_invalid_input_is_422(
    client: TestClient, account: dict[str, str], override: dict[str, object]
) -> None:
    response = client.post(
        "/generate-portfolio",
        json={**VALID_REQUEST, **override},
        headers=auth_header(account),
    )
    assert response.status_code == 422, response.text


def test_enum_values_are_normalised(
    client: TestClient, account: dict[str, str]
) -> None:
    """The client used to send 'None', which matched no rule row."""
    response = client.post(
        "/generate-portfolio",
        json={**VALID_REQUEST, "risk_level": "MEDIUM", "existing_investment": "None"},
        headers=auth_header(account),
    )
    assert response.status_code == 200, response.text


def test_allocation_is_stable_across_repeat_calls(
    client: TestClient, account: dict[str, str]
) -> None:
    """Same input must give the same output; no hidden state."""
    first = client.post(
        "/generate-portfolio", json=VALID_REQUEST, headers=auth_header(account)
    ).json()
    second = client.post(
        "/generate-portfolio", json=VALID_REQUEST, headers=auth_header(account)
    ).json()
    assert first["portfolio"] == second["portfolio"]