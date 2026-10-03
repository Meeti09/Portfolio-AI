# Investment Portfolio Engine

A full-stack portfolio allocation service. You describe your risk tolerance, capital,
horizon and liquidity needs; the backend runs a rules-driven allocation engine and
returns a fully-apportioned portfolio that always sums to exactly 100%.

- **Backend** — FastAPI + MySQL 8, JWT auth, a pure-Python allocation engine
- **Frontend** — React 18 + TypeScript + Vite, Tailwind, React Query-free Zustand stores

---

## Quick start

```powershell
# 1. Dependencies + local config files
.\scripts\setup.ps1

# 2. Edit backend\.env: set DB_PASSWORD and JWT_SECRET

# 3. Create the database, app user, schema and seed data
.\scripts\setup-database.ps1

# 4. Run both services
.\scripts\start.ps1
```

Then open <http://localhost:5173>.

Verify everything at any time:

```powershell
.\scripts\verify.ps1
```

---

## Requirements

| Tool     | Version | Notes                             |
| -------- | ------- | --------------------------------- |
| Python   | 3.11+   | developed on 3.14                 |
| MySQL    | 8.0+    | needs a `root` account for setup  |
| Node.js  | 18+     | Vite 5 requires 18 or newer       |

---

## Database

The app connects as **`inv_app`**, which is granted only `SELECT, INSERT, UPDATE,
DELETE`. It deliberately has no `CREATE`/`ALTER`/`DROP`, so a compromised API
process cannot reshape or destroy the schema.

SQL lives in `backend/sql/` and must be applied in order:

| File                | Purpose                                                    |
| ------------------- | ---------------------------------------------------------- |
| `00_bootstrap.sql`  | Creates the database and the least-privilege app user      |
| `01_schema.sql`     | All tables and foreign keys. Safe to re-run                |
| `02_seed.sql`       | Allocation rules, assets, caps, return references         |
| `03_views.sql`      | Reporting view                                             |

**`00_bootstrap.sql` DROPs the database.** Only run it on a fresh machine.

The app password is never stored in the repository. `00_bootstrap.sql` reads it
from the `@app_password` session variable and aborts if it was not set:

```powershell
mysql -u root -p -e "SET @app_password='choose-something-strong'; SOURCE backend/sql/00_bootstrap.sql;"
```

`scripts/setup-database.ps1` prompts for it and runs all four files.

`01_schema.sql` through `03_views.sql` can be re-applied freely to reset data
without touching the user.

### Seed data and the engine must agree

The engine derives a horizon bucket label (`upto_1`, `1 -- 3`, `3 -- 5`, `5 -- 8`,
`>8`) and looks it up in `duration_allocation_rules`. A missing row is a hard
error, not a silent zero — otherwise a stale database produces a plausible but
wrong allocation. Two tests in `backend/tests/test_api.py` fail loudly if the
database and `app/engine.py` ever disagree.

---

## Configuration

`backend/.env` (copy from `.env.example`):

| Variable                     | Purpose                                        |
| ---------------------------- | ---------------------------------------------- |
| `DB_HOST` / `DB_PORT`        | MySQL address                                  |
| `DB_NAME`                    | `investment_engine`                            |
| `DB_USER` / `DB_PASSWORD`    | the `inv_app` credentials                      |
| `JWT_SECRET`                 | **must** be changed for anything but local dev |
| `ACCESS_TOKEN_EXPIRE_MINUTES`| access token lifetime                          |
| `REFRESH_TOKEN_EXPIRE_DAYS`  | refresh token lifetime                         |
| `CORS_ORIGINS`               | comma-separated allowed origins                |

`frontend/.env` (copy from `.env.example`):

| Variable        | Purpose                                |
| --------------- | -------------------------------------- |
| `VITE_API_URL`  | API origin, e.g. `http://localhost:8000` |

Only `VITE_`-prefixed variables reach the browser bundle. Never put a secret in
`frontend/.env`.

---

## Where your data lives

| What you enter            | Where it is stored                                                                 |
| ------------------------- | ---------------------------------------------------------------------------------- |
| Signup name/email/age     | MySQL `investment_engine.users` (only a bcrypt hash is stored, never the password) |
| Dashboard risk/amount     | MySQL `investment_engine.user_profile`, one row per user                           |
| Login tokens + profile    | Browser `sessionStorage` under `investment-engine-auth` (this tab only)            |
| Latest generated portfolio| Browser `sessionStorage` under `investment-engine-portfolio` (this tab only)       |

So: your account and allocation inputs live in MySQL, while the signed-in session
and the most recent result live in the browser tab. Closing the tab ends the
session; logging out clears it immediately. The dashboard age must match the age
stored on your account — the UI blocks a mismatch before calling the API, and
the API rejects it with `422` as well.

---

## API

Base URL `http://localhost:8000`. Interactive docs at `/docs`.

| Method | Path                 | Auth | Description                              |
| ------ | -------------------- | ---- | ---------------------------------------- |
| GET    | `/health`            | no   | Liveness plus database status            |
| POST   | `/signup`            | no   | Create an account                        |
| POST   | `/login`             | no   | Returns `accessToken` + `refreshToken`   |
| POST   | `/refresh-token`     | no   | Exchange a refresh token for a new pair  |
| POST   | `/logout`            | yes  | Client-side token discard                |
| GET    | `/me`                | yes  | Current user                             |
| POST   | `/generate-portfolio`| yes  | Run the allocation engine                |
| GET    | `/profile`           | yes  | Saved allocation without recomputing     |
| GET    | `/history`           | yes  | Saved allocation history                 |

Token fields are camelCase; portfolio fields are snake_case, matching the
database columns.

---

## How allocation works

`backend/app/engine.py` is pure and side-effect free, which is why it is the most
heavily tested part of the codebase.

1. **Risk base** — each risk level defines a starting split across equity, debt,
   gold, safe and crypto.
2. **Horizon tilt** — short horizons are penalised heavily on equity; long ones
   are not.
3. **Liquidity** — a medium requirement moves five points out of debt into cash.
4. **Eligibility filters** — investment type, risk, horizon and liquidity rules
   can `disallow` an instrument outright.
5. **Thresholds** — minimum amounts unlock or exclude certain instruments.
6. **Existing holdings** — declared holdings trigger a concentration penalty.
7. **Caps** — per-type maximums are enforced.
8. **Apportionment** — the targets are converted to currency in whole paise using
   a two-stage largest-remainder method, so percentages always total exactly
   `100.00` and amounts always total exactly the investment.

Every step raises `RuleError` rather than guessing when its reference data is
missing.

---

## Testing

```powershell
# everything
.\scripts\verify.ps1

# backend only
cd backend
.\.venv\Scripts\python.exe -m pytest tests\ -q     # 142 tests

# frontend only
cd frontend
npm run lint
npm test -- --run                                   # 65 tests
npm run build
```

The backend suite runs against a **real MySQL database** and creates and deletes
its own users. It skips itself if the database is unreachable.

Note: two copies of `@testing-library/dom` (one via React Testing Library, one via
user-event) break React's `act()` wiring and produce a wall of warnings, so
`package.json` pins a single version via `overrides`. Keep it.

---

## Deploy

**Frontend (Vercel).** Import `Meeti09/Portfolio-AI` in the Vercel dashboard with
these settings:

| Setting          | Value                    |
| ---------------- | ------------------------ |
| Root Directory   | `frontend`               |
| Framework Preset | Vite                     |
| Build Command    | `npm run build`          |
| Output Directory | `dist`                   |
| Environment      | `VITE_API_URL` = your API origin |

`frontend/vercel.json` already carries the build settings plus an SPA fallback,
so direct links like `/dashboard` and `/portfolio` resolve instead of 404ing.

**Backend (not Vercel).** The API is a long-running FastAPI process backed by
MySQL, which Vercel's serverless platform does not host. Deploy it on Render
from the `render.yaml` blueprint at the repo root, with the database on
**Aiven's free MySQL tier** (free forever, no credit card — 1 GB storage/RAM,
single node, plenty for this app):

1. At `aiven.io`, create a free MySQL service. From its overview page copy the
   host, port, `avnadmin` user and password — and download the **CA certificate**,
   saving it as `backend/certs/aiven-ca.pem` (a CA cert is public, safe to commit).
2. Seed it from your machine (admin user, app user on `'%'` since the API
   connects over the network):
   `scripts/setup-database.ps1 -MysqlHost <host> -MysqlPort <port> -DbRootUser avnadmin -DbAppHost '%'`
3. In Render: `New → Blueprint`, select this repo, and fill in the `sync: false`
   variables (`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`,
   `DB_SSL_MODE=REQUIRED`, `DB_SSL_CA=certs/aiven-ca.pem`). `JWT_SECRET` is
   minted automatically.
4. Commit the CA file if you haven't, then point the frontend's `VITE_API_URL`
   at the Render service URL and redeploy the frontend.

Until then the deployed UI can load, but login and allocation calls need a
reachable API.

---

## Layout

```
backend/
  app/
    main.py        application factory, CORS, health, error handling
    config.py      environment settings
    db.py          MySQL connection pool
    security.py    bcrypt + JWT
    deps.py        bearer auth dependency
    schemas.py     request/response models
    engine.py      allocation engine (pure)
    routers/       auth.py, portfolio.py
  sql/             00_bootstrap -> 03_views
  tests/           engine, security and API tests
frontend/
  src/
    api/           axios instance and auth interceptors
    app/           router, route guards, stores
    components/    layout, ui, charts
    context/       toast system
    hooks/         useAuth, usePortfolio, useToast
    pages/         Landing, Auth, Dashboard, Portfolio
    schemas/       zod schemas
scripts/           setup, setup-database, start, verify
```

---

## Troubleshooting

**Blank page, no requests** — `VITE_API_URL` is unset. Copy
`frontend/.env.example` to `frontend/.env`.

**`No duration_allocation_rules row for bucket ...`** — the database seed is older
than `app/engine.py`. Re-apply `01_schema.sql` and `02_seed.sql`.

**`401` immediately after login** — `JWT_SECRET` in `backend/.env` changed while
the browser still holds an old token. Log out, or clear the
`investment-engine-auth` key in session storage.

**`Access denied for user 'inv_app'`** — the user was not created by
`00_bootstrap.sql`. Re-run `scripts/setup-database.ps1`.

---

## License

See [LICENSE](LICENSE).
