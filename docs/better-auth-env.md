# Better Auth environment

Blue Jeans hosts Better Auth against the same Neon Postgres database as app data.
Configure these for **local**, **preview**, **production**, and **CI**.

## Required (runtime)

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | Neon pooled connection string. Auth tables live in the public schema (`user`, `session`, `account`, `verification`). Apply `db/migrate-better-auth.sql` once before cutover. |
| `BETTER_AUTH_SECRET` | Session signing secret (≥32 chars). Store **raw** — no surrounding quotes. |

## Optional URL override

| Variable | Description |
| --- | --- |
| `BETTER_AUTH_URL` | Explicit auth base URL (OAuth callback origin). Preview deployments normally derive `https://$VERCEL_BRANCH_URL` when unset. Do not point production builds at loopback. |

Trusted origins also include the production host and `https://*-crashoutcos-projects.vercel.app`.

## OAuth (social providers)

| Variable | Description |
| --- | --- |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google OAuth client credentials. |
| `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` | GitHub OAuth client credentials. |

`createAuth` / `getEnabledSocialProviders` register a provider only when **both** id and secret are set. Sign-in renders `SignInButtons` for `enabledSocialProviders`; if none are configured, the page shows a status message (no invented tokens).

## CI / Playwright only

| Variable | Description |
| --- | --- |
| `TEST_AUTH_SECRET` | Shared secret for `POST /api/test-auth/login`. Sent as header `x-test-auth-secret`. |
| `EXPOSE_TESTING_API` | Must be `1` for the test-login route to be enabled (`shared:test-auth v2`). Never set on real Vercel production (`VERCEL=1` / `VERCEL_ENV=production` always 404). Do **not** rely on `NODE_ENV=development` alone. |
| `NEON_API_KEY` | GitHub Actions secret for ephemeral Neon branches (`neondatabase/create-branch-action`). |
| `NEON_DATABASE` / `NEON_ROLE` | Neon database + role names for branch create. |
| `NEON_PROJECT_ID` | GitHub Actions **variable** (`vars.NEON_PROJECT_ID`). |

Actions e2e and the Neon preview-branch workflow require `NEON_API_KEY` (secret) plus `NEON_PROJECT_ID` (variable), `NEON_DATABASE`, and `NEON_ROLE`. Local Cloud Agent e2e can use `.cursor/dev/neon-local-proxy.mjs` instead of Actions Neon branching.

CI e2e / preview Neon DBs also need the full app schema applied, including Better Auth tables (`db/migrate-better-auth.sql`) and `wearer_preferences` (`db/migrate-garment-categories-location.sql` / `db/schema.sql`).

### Env lock (copy checklist)

Runtime / OAuth: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (optional), `AUTH_GOOGLE_*`, `AUTH_GITHUB_*`.

Test / CI: `TEST_AUTH_SECRET`, `EXPOSE_TESTING_API=1`, header `x-test-auth-secret`, Neon `NEON_API_KEY` + `NEON_PROJECT_ID` + `NEON_DATABASE` + `NEON_ROLE`.

## Owner bootstrap

`APP_OWNER_USER_ID` must match the Better Auth user id for the sole platform-funded owner. Neon Auth `role=admin` / `APP_ADMIN_EMAILS` do **not** admit accounts.
