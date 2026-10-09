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
`lib/auth/email-otp.ts` (shared byte-for-byte with Project-RDC and Project-Z).

| Variable | Description |
| --- | --- |
| `AUTH_OTP_ALLOWED_EMAILS` | Comma-separated emails allowed to sign in with a code. Trimmed, lowercased, empties dropped. |
| `RESEND_API_KEY` | Resend API key used to send the code. |
| `AUTH_EMAIL_FROM` | Sender address on a **Resend-verified domain**, e.g. `Project Blue Jeans <auth@yourdomain.com>`. |

- The Better Auth `emailOTP` plugin is registered only when all three are set. Otherwise the `/api/auth/email-otp/*` and `/api/auth/sign-in/email-otp` routes do not exist and the sign-in page hides the form. A partial config logs a warning.
- Codes: 6 digits, expire after 5 minutes, 3 attempts. Only `sign-in` codes are ever emailed; email-verification and password-reset requests send nothing.
- A send request for a non-listed email sends nothing and returns the same `{ "success": true }`, so the list can't be probed. Redeeming a code for a non-listed email is rejected.
- Email OTP sign-in never opens the owner account (`APP_OWNER_USER_ID` or an `owner` membership row), even if that email is listed (`otpOwnerGuardPlugin` in `lib/auth/membership.ts`).
- A user created by email OTP has no membership, so it is "not admitted" until the owner invites it (Settings → Invites) and it accepts the invite link while signed in as that email. It then becomes a `wearer` with `user_byok` credentials, never `platform_env`.

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
