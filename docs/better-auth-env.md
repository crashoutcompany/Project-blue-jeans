# Better Auth environment

Blue Jeans hosts Better Auth against the same Neon Postgres database as app data.
Configure these for **local**, **preview**, **production**, and **CI**.

## Required (runtime)

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | Neon pooled connection string. Auth tables live in the public schema (`user`, `session`, `account`, `verification`). Apply `db/migrate-better-auth.sql` once before cutover. |
| `BETTER_AUTH_SECRET` | Session signing secret (≥32 chars). Store **raw** — no surrounding quotes. |

## OAuth (Google)

| Variable | Description |
| --- | --- |
| `AUTH_GOOGLE_ID` | Google OAuth client ID. |
| `AUTH_GOOGLE_SECRET` | Google OAuth client secret. |

If either is missing, Google sign-in is disabled and `/signin` shows a configuration message instead of the OAuth button.

## Optional URL override

| Variable | Description |
| --- | --- |
| `BETTER_AUTH_URL` | Explicit auth base URL (OAuth callback origin). Preview deployments normally derive `https://$VERCEL_BRANCH_URL` when unset. Do not point production builds at loopback. |

Trusted origins also include the production host and `https://*-crashoutcos-projects.vercel.app`.

## CI / Playwright only

| Variable | Description |
| --- | --- |
| `TEST_AUTH_SECRET` | Shared secret for `POST /api/test-auth/login`. Production always 404s this route; wrong secret → 401. |
| `EXPOSE_TESTING_API` | Set to `1` for `pnpm build:e2e` / Playwright so the test-login route is compiled into the production-like build. Never set in real production. |
| `NEON_API_KEY` | GitHub Actions secret for ephemeral Neon branches (`neondatabase/create-branch-action`). |
| `NEON_DATABASE` / `NEON_ROLE` | Neon database + role names for branch create. |
| `NEON_PROJECT_ID` | GitHub Actions **variable** (`vars.NEON_PROJECT_ID`). |

Actions e2e and the Neon preview-branch workflow require `NEON_API_KEY` (secret) plus `NEON_PROJECT_ID` (variable), `NEON_DATABASE`, and `NEON_ROLE`. Local Cloud Agent e2e can use `.cursor/dev/neon-local-proxy.mjs` instead of Actions Neon branching.

CI e2e / preview Neon DBs also need the full app schema applied, including Better Auth tables (`db/migrate-better-auth.sql`) and `wearer_preferences` (`db/migrate-garment-categories-location.sql` / `db/schema.sql`).

## Owner bootstrap

`APP_OWNER_USER_ID` must match the Better Auth user id for the sole platform-funded owner. Neon Auth `role=admin` / `APP_ADMIN_EMAILS` do **not** admit accounts.
