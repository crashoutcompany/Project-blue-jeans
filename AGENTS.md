# AGENTS.md

## Cursor Cloud specific instructions

`project-blue-jeans` is a **Next.js 16 / React 19** app (an AI outfit generator / digital closet) using **npm** (`package-lock.json`). Node 20+ is required; the environment ships Node 22.

### Services

There is one local process — the **Next.js dev server**. Everything else is a hosted integration reached via env vars (no local database, workers, or queues):

- **Neon Postgres** (`DATABASE_URL`) — persists garments / outfits. Serverless HTTP driver; no local Postgres.
- **UploadThing** (`UPLOADTHING_TOKEN`) — image hosting for closet uploads.
- **Google AI Studio / Gemini Developer API** (`GOOGLE_GENERATIVE_AI_API_KEY`) — powers outfit generation, hero images, and auto garment descriptions. See `docs/gemini-ai-studio-env.md`.

### Commands (already defined in `package.json`)

- Run (dev): `npm run dev` → http://localhost:3000
- Lint: `npm run lint`
- Build: `npm run build`
- Unit tests: `npm run test` (Vitest). E2E: `npm run build:instant` then `npm run test:e2e` (Playwright; needs `EXPOSE_TESTING_API=1` / `E2E_PLAYWRIGHT=1` as in CI).

### Non-obvious notes

- **The app degrades gracefully with no secrets set**: routes like `/`, `/dashboard` (closet), and `/generator` render, the closet is empty, and `GET /api/db/ping` returns `{"ok":false,...}` instead of crashing. Runtime errors only surface when you exercise a feature whose secret is missing (e.g. saving a garment, generating a lookbook).
- **The client-side closet "add garment" flow works without any secrets**: choosing photos compresses them on-device (`browser-image-compression`) and queues editable draft cards. Only the final **"Add to closet"** step needs `UPLOADTHING_TOKEN` (upload) + `DATABASE_URL` (persist). This is the best secret-free smoke test of core UI.
- **Full end-to-end testing requires user-provided secrets**: `DATABASE_URL`, `UPLOADTHING_TOKEN`, and `GOOGLE_GENERATIVE_AI_API_KEY`. Add them via the Secrets panel; env vars are injected into the VM.
- **Store secret values raw — no surrounding quotes.** `lib/ai/gemini-provider.ts` strips wrapping quotes from `GOOGLE_GENERATIVE_AI_API_KEY`. The UploadThing SDK reads `UPLOADTHING_TOKEN` verbatim (a stray quote breaks uploads). Paste these as the bare value.
- **The Neon schema is applied manually** — run `db/schema.sql` in the Neon SQL editor once against the target database. There is no migration tooling or npm script for it. Existing databases may also need one-shot migrations: `db/migrate-outfit-wears.sql` (Outfit uniqueness), `db/migrate-wearer-profile.sql` (Wearer photo / try-on), `db/migrate-per-account.sql` (per Wearer `user_id` isolation), `db/migrate-outfit-wears-unique.sql` (full `UNIQUE (user_id, worn_on)` on `outfit_wears` after per-account), `db/migrate-byok-foundation.sql` / `db/migrate-byok-uploadthing.sql` (BYOK vault and private media), and `db/migrate-admission-invites.sql` (owner invitations). After per-account migration, optionally `UPDATE … SET user_id = '<neon-auth-user-id>'` to claim rows created before isolation.
- All Gemini access goes through `@ai-sdk/google`.
