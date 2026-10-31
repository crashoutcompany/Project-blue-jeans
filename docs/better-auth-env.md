# Better Auth environment

Blue Jeans hosts Better Auth against the same Neon Postgres database as app data.
Configure these for **local**, **preview**, **production**, and **CI**.

## Required (runtime)

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | Neon pooled connection string. Auth tables live in the public schema (`user`, `session`, `account`, `verification`). They are created by `db/schema.sql`. |
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

## Email OTP sign-in (allowlisted bots only)

Google/GitHub OAuth blocks automated browsers, so bots that need to test
production sign in with an emailed one-time code instead. Only addresses on the
allowlist can use it; everyone else keeps using OAuth. Logic lives in
`lib/auth/email-otp.ts` (`shared:email-otp v4`, byte-for-byte with Project-Z).

| Variable | Description |
| --- | --- |
| `AUTH_OTP_ALLOWED_EMAILS` | Comma-separated emails allowed to sign in with a code. Trimmed, lowercased, empties dropped. |
| `RESEND_API_KEY` | Resend API key used to send the code. |
| `AUTH_EMAIL_FROM` | Sender address on a **Resend-verified domain**, e.g. `Project Blue Jeans <auth@yourdomain.com>`. |

- The Better Auth `emailOTP` plugin is registered only when all three are set. Otherwise the `/api/auth/email-otp/*` and `/api/auth/sign-in/email-otp` routes do not exist and the sign-in page hides the form. A partial config logs a warning.
- Codes: 6 digits, expire after 5 minutes, 3 attempts. Only `sign-in` codes are ever emailed.
- Non-sign-in OTP routes are disabled (`disabledPaths`, `EMAIL_OTP_DISABLED_PATHS` in `lib/auth/email-otp.ts`) whenever email OTP is configured: reset-password, verify-email, check-verification-otp, request-password-reset, forget-password/email-otp, request-email-change, and change-email. They return 404.
- A send request for a non-listed email stores nothing, sends nothing, and returns the same `{ "success": true }`, so the list can't be probed. Redeeming a code for a non-listed email is rejected.
- Email OTP sign-in never opens the owner account (`APP_OWNER_USER_ID` or an `owner` membership row) or any account with a linked OAuth or password provider, even if that email is listed. The guard is `createOtpOwnerGuardPlugin({ logSecret })` in `lib/auth/membership.ts`, registered from `lib/auth.ts` with the Better Auth secret. Those addresses get the same `{ "success": true }` on send but no code is stored or emailed. Every sign-in failure (wrong, expired, or over-attempted code, unlisted or blocked email, or a user, account, or membership lookup that fails after one retry) returns the same 400 `INVALID_OTP`, and a store failure denies sign-in without issuing a session. A send whose lookup fails after the retry gets the unlisted-address response (`{ "success": true }`, nothing stored or sent), so a lookup failure does not reveal that the address is listed.
- Failure logs never carry a raw address. `otp_sign_in_failed` logs a `reason` (`otp_expired`, `otp_too_many_attempts`, `otp_invalid`, `otp_unlisted`, `otp_account_blocked`) with `emailHash`, a 16-hex-char HMAC-SHA256 of the normalized email keyed by `BETTER_AUTH_SECRET`. `otp_guard_lookup_failed` logs `attempts`, `emailHash`, and the error name and message with the address removed.
- If Resend rejects a code email, the error is logged as `[auth] sign-in code email failed` and the caller still gets `{ "success": true }`, so failures don't reveal the list.
- Rate limiting has two layers, in `lib/auth/rate-limit.ts` (`shared:auth-rate-limit v2`, byte-for-byte with Project-Z) and wired in `lib/auth/create-auth.ts`. Per-IP limits are Better Auth's defaults for the OTP routes. Per-email lockout counts every address, listed or not, in two counters per 15 minutes: per email and client IP (5 sends, 10 sign-in attempts) and per email alone from any IP (20 sends, 30 sign-in attempts). Both counters run for every request. Over the send limit, the route returns the same `{ "success": true }` and sends nothing. Over the sign-in limit, it returns 429 `TOO_MANY_REQUESTS` with a `Retry-After` header (seconds). The lockout runs before the allowlist and owner guard. Storage keys are HMAC-SHA256 digests keyed by `BETTER_AUTH_SECRET`, so Redis holds no raw email or IP.
- Counters live in Upstash Redis when a complete URL and token pair is set: `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`, or the Vercel Upstash integration's `KV_REST_API_URL` and `KV_REST_API_TOKEN`. Otherwise they live in memory per server instance. If Redis errors or takes over 1 second, that request falls back to memory and `auth_rate_limit_redis_unavailable` is logged (at most once a minute). Redis calls are not retried.
- A user created by email OTP has no membership, so it is "not admitted" until the owner invites it (Settings → Invites) and it accepts the invite link while signed in as that email. It then becomes a `wearer` with `user_byok` credentials, never `platform_env`.

## Auth rate limiting (optional Upstash Redis)

| Variable | Description |
| --- | --- |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST endpoint and token for shared auth rate-limit counters. A complete pair is required. |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | Names set by Vercel's Upstash integration. Read when the `UPSTASH_REDIS_REST_*` pair is unset. A complete pair is required. |
| `AUTH_RATE_LIMIT_PREFIX` | Namespace for rate-limit keys. Default: `<app slug>:<VERCEL_ENV or NODE_ENV>`, here `project-blue-jeans:production` or `project-blue-jeans:preview`. If one Upstash database is shared by several environments, set a value that differs per environment (for example `project-blue-jeans-preview`), so a preview or local run cannot lock out production. |

Rate limits are enabled only when `NODE_ENV=production`, matching Better Auth's default in dev and unit tests.

Email OTP failures are logged as `otp_sign_in_failed` with a `reason` and an `emailHash` (keyed by `BETTER_AUTH_SECRET`), never the raw address. Use the hash to correlate events for one address.

## CI / Playwright only
Copy this policy to Z / RDC. App-specific `createTestSession` bodies may differ; the gate must not.

| Variable | Description |
| --- | --- |
| `TEST_AUTH_SECRET` | **Required** non-empty secret for `POST /api/test-auth/login`. Sent as header `x-test-auth-secret`. Missing secret → route disabled (404). |
| `EXPOSE_TESTING_API` | Must be `1` to enable test-login. Do **not** auto-enable from `NODE_ENV=development` or Vercel preview alone. |
| Production deny | When `VERCEL_ENV=production`, test-auth is always off (404) even if the vars above are set. |
| `NEON_API_KEY` | GitHub Actions secret for ephemeral Neon branches (`neondatabase/create-branch-action`). |
| `NEON_DATABASE` / `NEON_ROLE` | Optional Neon database + role names for branch create (secret or variable; default `neondb` / `neondb_owner`). |
| `NEON_PROJECT_ID` | GitHub Actions variable or secret. |

Actions e2e and the Neon preview-branch workflow (shared workflows in `crashoutcompany/.github`) require `NEON_API_KEY` (secret) plus `NEON_PROJECT_ID`. CI e2e uses fixture `TEST_AUTH_SECRET` / `BETTER_AUTH_SECRET` values, so neither needs to be a GitHub secret. Local Cloud Agent e2e can use `.cursor/dev/neon-local-proxy.mjs` instead of Actions Neon branching.

CI e2e / preview Neon DBs are branches of production, so they inherit its schema. A database created from scratch needs `db/schema.sql`, which includes the Better Auth tables.

### Env lock (copy checklist)

Runtime / OAuth: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (optional), `AUTH_GOOGLE_*`, `AUTH_GITHUB_*`.

Email OTP sign-in (optional): `AUTH_OTP_ALLOWED_EMAILS`, `RESEND_API_KEY`, `AUTH_EMAIL_FROM`.

Test / CI: `TEST_AUTH_SECRET`, `EXPOSE_TESTING_API=1`, header `x-test-auth-secret`, Neon `NEON_API_KEY` + `NEON_PROJECT_ID` (optional `NEON_DATABASE` / `NEON_ROLE`). See `.env.example` for where each variable lives.

## Session refresh (golden)

`createAuth` sets `session.deferSessionRefresh: true`. RSC reads use `disableRefresh: true`. The auth proxy loads the session with `returnHeaders: true`, and when Better Auth returns `needsRefresh` it issues a **POST** `/get-session` so durable expiry + `Set-Cookie` apply (GET alone is read-only under defer).

## Owner bootstrap

`APP_OWNER_USER_ID` must match the Better Auth user id for the sole platform-funded owner. Auth-provider identity alone never admits an account; admission lives in `wearer_memberships`.

## Ops / CI secrets (do not invent tokens)

| Gap | Where | Action |
| --- | --- | --- |
| Tip e2e `Input required: api_key` | GitHub Actions | Set the `NEON_API_KEY` secret + `NEON_PROJECT_ID` variable. |
| Vercel preview “Deployment rate limited” | Vercel Hobby | Wait for the rate-limit window (often ~24h) or upgrade; do not invent `VERCEL_TOKEN`. |
| OAuth buttons missing in e2e | optional | Set `AUTH_GOOGLE_*` / `AUTH_GITHUB_*` or accept the shared “not configured” status in smoke tests. |
