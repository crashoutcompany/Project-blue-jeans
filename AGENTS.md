# AGENTS.md

## Cursor Cloud specific instructions

`project-blue-jeans` is a **Next.js 16 / React 19** app (an AI outfit generator / digital closet) using **npm** (`package-lock.json`). Node 20+ is required; the environment ships Node 22.

### Services

There is one local process — the **Next.js dev server**. Everything else is a hosted integration reached via env vars (no local database, workers, or queues):

- **Neon Postgres** (`DATABASE_URL`) — persists garments / outfits. Serverless HTTP driver; no local Postgres.
- **UploadThing** (`UPLOADTHING_TOKEN`) — image hosting for closet uploads.
- **Google Vertex AI** (`GOOGLE_VERTEX_PROJECT` + one auth method) — powers outfit generation, hero images, and auto garment descriptions. See `docs/vertex-ai-env.md`.

### Commands (already defined in `package.json`)

- Run (dev): `npm run dev` → http://localhost:3000
- Lint: `npm run lint`
- Build: `npm run build`
- There is **no test suite / `test` script**.

### Non-obvious notes

- **The app degrades gracefully with no secrets set**: routes like `/`, `/closet`, and `/generator` render, the closet is empty, and `GET /api/db/ping` returns `{"ok":false,...}` instead of crashing. Runtime errors only surface when you exercise a feature whose secret is missing (e.g. saving a garment, generating a lookbook).
- **The client-side closet "add garment" flow works without any secrets**: choosing photos compresses them on-device (`browser-image-compression`) and queues editable draft cards. Only the final **"Add to closet"** step needs `UPLOADTHING_TOKEN` (upload) + `DATABASE_URL` (persist). This is the best secret-free smoke test of core UI.
- **Full end-to-end testing requires user-provided secrets**: `DATABASE_URL`, `UPLOADTHING_TOKEN`, and Vertex AI credentials. Add them via the Secrets panel; env vars are injected into the VM.
- **Store secret values raw — no surrounding quotes.** `lib/ai/gemini-provider.ts` strips wrapping quotes from `GOOGLE_VERTEX_PROJECT` only. It does **not** strip quotes from `GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON` (a leading `'`/`"` makes `JSON.parse` fail → Vertex silently falls back to ADC and errors), and the UploadThing SDK reads `UPLOADTHING_TOKEN` verbatim (a stray quote breaks uploads). Paste these two as the bare value.
- **The Neon schema is applied manually** — run `db/schema.sql` in the Neon SQL editor once against the target database. There is no migration tooling or npm script for it.
- `@google/genai` and `@google-cloud/aiplatform` are in `package.json` but currently unused; all Gemini access goes through `@ai-sdk/google-vertex`.
- The weekly-outfits cron (`/api/cron/weekly-outfits`, gated by `CRON_SECRET`) runs inline in a serverless invocation; it is not a separate background worker and is not needed for the interactive flow.
