# AGENTS.md

## Cursor Cloud specific instructions

`project-blue-jeans` is a **Next.js 16 / React 19** app (an AI outfit generator / digital closet) using **Node.js 24** and **pnpm 10** (`pnpm-lock.yaml`).

### Services

There is one local process — the **Next.js dev server**. Everything else is a hosted integration reached via env vars (no local database, workers, or queues):

- **Neon Postgres** (`DATABASE_URL`) — persists garments / outfits. Serverless HTTP driver; no local Postgres.
- **Better Auth** (`BETTER_AUTH_SECRET`, optional `BETTER_AUTH_URL`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`) — self-hosted sessions and Google OAuth in the same Neon database.
- **UploadThing** (`UPLOADTHING_TOKEN`) — image hosting for closet uploads.
- **Google AI Studio / Gemini Developer API** (`GOOGLE_GENERATIVE_AI_API_KEY`) — powers outfit generation, hero images, and auto garment descriptions. See `docs/gemini-ai-studio-env.md`.
- **Vercel Cron** (`CRON_SECRET`) — Bearer token for `GET /api/cron/purge-stale-fits` (Mondays 08:00 UTC). Deletes leftover Weekly Fits from previous Sunday-start weeks; committed Outfits are kept. Store the value raw.

### Commands (already defined in `package.json`)

- Run (dev): `pnpm dev` → http://localhost:3000
- Lint: `pnpm lint`
- Typecheck: `pnpm typecheck`
- Build: `pnpm build`
- Unit tests: `pnpm test` (Vitest). E2E: `pnpm build:e2e` then `pnpm test:e2e` (Playwright; needs `EXPOSE_TESTING_API=1`, `TEST_AUTH_SECRET`, and Better Auth/DB variables).

### Non-obvious notes

- **The app degrades gracefully with no secrets set**: routes like `/`, `/closet`, and `/generator` render, the closet is empty, and `GET /api/db/ping` returns `{"ok":false,...}` instead of crashing. Runtime errors only surface when you exercise a feature whose secret is missing (e.g. saving a garment, generating a lookbook).
- **The client-side closet "add garment" flow works without any secrets**: choosing photos compresses them on-device (`browser-image-compression`) and queues editable draft cards. Only the final **"Add to closet"** step needs `UPLOADTHING_TOKEN` (upload) + `DATABASE_URL` (persist). This is the best secret-free smoke test of core UI.
- **Full end-to-end testing requires user-provided secrets**: `DATABASE_URL`, `UPLOADTHING_TOKEN`, and `GOOGLE_GENERATIVE_AI_API_KEY`. Add them via the Secrets panel; env vars are injected into the VM.
- **Store secret values raw — no surrounding quotes.** `lib/ai/gemini-provider.ts` strips wrapping quotes from `GOOGLE_GENERATIVE_AI_API_KEY`. The UploadThing SDK reads `UPLOADTHING_TOKEN` verbatim (a stray quote breaks uploads). Paste these as the bare value.
- **Production owner bootstrap is `APP_OWNER_USER_ID` only.** Better Auth identity does not admit an account; admission remains in `wearer_memberships`. The test-login endpoint creates only test-environment membership rows.
- **The Neon schema is applied manually** — run `db/schema.sql` in the Neon SQL editor once against the target database. Existing databases must run `db/migrate-better-auth.sql` before this app version. Confirm the legacy `neon_auth.user` shape and identity mapping when the guarded migration reports that it could not copy users. Configure the Google OAuth callback as `/api/auth/callback/google`.
- All Gemini access goes through `@ai-sdk/google`.

## How agents sign in

- Build and start with `EXPOSE_TESTING_API=1`. Never set that flag on Vercel Production.
- Set `TEST_AUTH_SECRET` and `POST /api/test-auth/login` with header
  `x-test-auth-secret: <secret>`.
- The route upserts the seeded tester (and a wearer membership) and mints a real
  Better Auth session cookie. Production always 404s; a wrong secret returns 401.
- Playwright `e2e/global-setup.ts` writes storage state under `e2e/.auth/`.
- If Deployment Protection is on, also send
  `x-vercel-protection-bypass: $VERCEL_AUTOMATION_BYPASS_SECRET`.

## Neon Managed Better Auth revisit

Revisit Neon Managed Better Auth only after all of: GA; SDK ≥1.0 with a changelog;
documented http-dev cookie story or configurable cookie names; API to seed a tester
per branch. Users already live in this Neon database, so a later switch is a schema
move, not a rewrite.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
