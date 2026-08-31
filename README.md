# MacroSnap — API

Snap a photo of your meal, get the macros.

MacroSnap is a food-logging app that turns a meal photo into a nutrition
breakdown: a vision model identifies the foods and estimates portions,
then each item is matched against the USDA FoodData Central database for
real per-100g macros, scaled to the estimated portion.

This repository is the **backend REST API** (Node/Express/Postgres).

- **Live demo:** <https://macrotrack.org/> — click "Try the demo" to
  explore without signing up
- **Frontend repo:**
  <https://github.com/jayyzzeezzy/macro-snap-web-app>

---

## Features

- **Photo → macros.** `POST /api/analyze` accepts a meal photo and
  returns each identified food with calories, protein, carbs, and fat.
- **Pluggable vision provider.** Anthropic, OpenAI, or Gemini — chosen
  with a single env var, no code change.
- **Real nutrition data.** USDA FoodData Central lookups, cached
  in-process (24h TTL, LRU-bounded) to cut latency and protect the
  shared API quota.
- **Manual food search.** `GET /api/usda/search` for logging things a
  photo can't capture.
- **Meal logging & daily totals.** Meals and their items persist per
  user, with a day-scoped rollup endpoint.
- **Editable macro goals.** Per-user daily calorie, protein, carb, and
  fat targets.
- **Auth.** Email + password (bcrypt) and "Continue with Google"
  (OAuth 2.0), both issuing RS256 JWTs. Google users can add a password
  later.
- **Demo account.** A shared, anonymous account so anyone can try the
  app. Demo meals are deliberately never written to the database.
- **Hardening.** Helmet, an allowlist CORS policy, express-validator on
  every write, and tiered rate limits on the endpoints that cost money.

## Tech stack

| Layer | Choice |
| --- | --- |
| Runtime | Node.js, Express 5 |
| Database | PostgreSQL via Prisma 7 (`@prisma/adapter-pg`) |
| Auth | Passport (local, JWT, Google OAuth 2.0), bcryptjs, RS256 |
| Vision | Anthropic Claude / OpenAI / Google Gemini |
| Nutrition | USDA FoodData Central API |
| Security | helmet, cors, express-rate-limit, express-validator |
| Uploads | multer (in-memory, 10 MB cap) |

## Architecture

```text
photo ──► POST /api/analyze
             │
             ├─► services/visionApi.js
             │     vision model → [{ name, portion_grams }]
             │
             └─► services/usdaApi.js
                   USDA lookup per item (TTL-cached)
                   → per-100g macros, scaled to portion
                                │
                                ▼
              POST /api/meals  →  Postgres (Meal + MealItem)
```

The vision model is asked only to *identify and estimate portions* — it
is explicitly instructed never to return nutrition numbers. All macro
values come from USDA, so the numbers are traceable rather than
hallucinated.

## API

All routes except `/api/auth/*` require `Authorization: Bearer <jwt>`.

### Auth

| Method | Route | Description |
| --- | --- | --- |
| `POST` | `/api/auth/signup` | Create an account |
| `POST` | `/api/auth/signin` | Log in, returns a JWT |
| `POST` | `/api/auth/demo` | Token for the shared demo account |
| `GET` | `/api/auth/me` | Current user; restores a session on load |
| `POST` | `/api/auth/set-password` | Add a password to a Google account |
| `GET` | `/api/auth/google` | Start the Google OAuth flow |
| `GET` | `/api/auth/google/callback` | OAuth callback → SPA `#token=…` |

`signup` takes `{ email, name, password }`; `signin` takes
`{ email, password }`.

### Analysis and food data

| Method | Route | Description |
| --- | --- | --- |
| `POST` | `/api/analyze` | Meal photo → identified foods with macros |
| `GET` | `/api/usda/search?q=chicken` | Search USDA foods |
| `GET` | `/api/usda/food/:fdcId` | Fetch one USDA food's macros |

`/api/analyze` accepts either `multipart/form-data` with a `photo`
field, or JSON `{ image: "<base64>", mimeType }`. JPEG, PNG, WebP, and
GIF work with any provider; HEIC/HEIF only with
`VISION_PROVIDER=gemini`.

### Meals and goals

| Method | Route | Description |
| --- | --- | --- |
| `POST` | `/api/meals` | Log a meal from a list of items |
| `GET` | `/api/meals` | All meals for the current user |
| `GET` | `/api/meals/daily?date=2026-06-08` | Meals + totals for a day |
| `GET` | `/api/goals` | Daily targets for each macro |
| `PUT` | `/api/goals` | Update daily targets |

A meal is posted as
`{ items: [{ name, portion_grams, calories, protein, carbs, fat }] }`;
goals are read and written as `{ calories, protein, carbs, fat }`.

## Rate limiting

The endpoints that spend money or draw on a shared quota are throttled
per client IP, with demo users capped harder than signed-in users:

| Limiter | Window | Demo | User |
| --- | --- | --- | --- |
| `/api/analyze` | 15 min | 10 | 30 |
| `/api/usda` | 15 min | 30 | 100 |
| `/api/auth` signup/signin/demo | 15 min | 10 | 10 |

A global backstop caps `/api/usda` at 800 requests/hour across *all*
clients, sitting just under USDA's 1000/hour/key ceiling so one burst
can't break food lookups for everyone.

## Getting started

**Prerequisites:** Node.js 20+, PostgreSQL, a
[free USDA API key][usda-key], and an API key for one vision provider.

[usda-key]: https://fdc.nal.usda.gov/api-guide.html

```bash
git clone git@github.com:jayyzzeezzy/macro-tracker.git
cd macro-tracker
npm install

cp .env.example .env      # then fill it in — see below
npm run generate-keys     # RSA key pair for signing JWTs → keys/

npx prisma migrate dev    # create the schema
npm run db:seed           # create the shared demo user

npm start                 # http://localhost:3000
```

### Environment

`.env.example` documents every variable. The ones you must set:

| Variable | Notes |
| --- | --- |
| `DEV_DB_URL` | Local Postgres connection string |
| `PROD_DB_URL` | Hosted Postgres, used in production |
| `VISION_PROVIDER` | `anthropic`, `openai`, or `gemini` |
| `<PROVIDER>_API_KEY` | Key for your chosen provider only |
| `USDA_API_KEY` | Falls back to `DEMO_KEY` (very limited) |
| `PRIVATE_KEY_PATH` | JWT signing key on disk (local dev) |
| `PUBLIC_KEY_PATH` | JWT verifying key on disk (local dev) |
| `CORS_ORIGINS` | Deployed frontend origins, comma-separated |
| `FRONTEND_URL` | Where OAuth redirects back to |
| `GOOGLE_CLIENT_ID` | Only if you want Google login |
| `GOOGLE_CLIENT_SECRET` | Only if you want Google login |
| `GOOGLE_CALLBACK_URL` | Must match the URI in Google Cloud |

Localhost is always an allowed CORS origin, so `CORS_ORIGINS` only
matters for deployed frontends.

### Scripts

```bash
npm start              # run the server
npm run db:seed        # seed the demo user
npm run generate-keys  # generate the RS256 key pair
```

## Deployment notes

The live instance runs the API on Render, the frontend on Netlify, and
Postgres on Aiven.

- **JWT keys:** hosted environments have no `keys/` directory, so
  `lib/jwt.js` reads inline PEMs from `PRIVATE_KEY` / `PUBLIC_KEY`
  first and falls back to the file paths locally. Literal `\n`
  sequences from dashboard env editors are normalized back to real
  newlines.
- **Database TLS:** `lib/dbConfig.js` picks `PROD_DB_URL` vs
  `DEV_DB_URL` from `NODE_ENV` and handles the hosted provider's
  self-signed CA — set `DATABASE_CA` to verify against it, otherwise
  the connection is encrypted without verification.
- **Proxies:** `trust proxy` is set to `1` in production so `req.ip`
  reflects the real client and rate limiting isn't overwhelmed by the load
  balancer.

## Security

- Passwords hashed with bcrypt; the private JWT key
  never leaves the server and `keys/` is git-ignored.
- OAuth tokens are handed to the SPA in the URL *fragment*, keeping
  them out of server logs and `Referer` headers.
- `/api/auth/set-password` refuses to overwrite an existing password —
  changing one must go through a flow that verifies the current
  password.
- CORS omits headers for unknown origins rather than throwing errors, so the
  browser blocks the request cleanly.
