# instant-nav rig: project-blue-jeans

- BUILD: `pnpm build:e2e && pnpm start` (local production build on port 3000). Never measure on `next dev`.
- EXPOSE: `EXPOSE_TESTING_API=1 && VERCEL!=1` is wired to `experimental.exposeTestingApiInProductionBuild` in `next.config.ts`.
- RUN: `pnpm exec playwright test tests/e2e/instant-nav` with `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000` (default). Playwright `webServer` starts `pnpm start` against the prebuilt artifact; build with the expose flag first.
- TEST USER: global setup posts `TEST_AUTH_SECRET` to `/api/test-auth/login` and stores real Better Auth sessions in `tests/e2e/.auth/admin.json` and `non-admin.json`. The admitted tester receives a test-only Wearer membership; production owner semantics remain unchanged.
- DRIFT: admitted owner vs unsigned-in cookies; empty closet without Neon; Gemini/UploadThing secrets unused for shell; landing vs signed-in redirect for accounts without membership; theme (system).
- LOOP: local only — stop any process on :3000 → `pnpm build:e2e` → `pnpm start` → Playwright → fix → rebuild. Agent-drivable; no deploy wait.
- LIVENESS: n/a (local `build && start`; artifact is the one just built).
- WALLS:
  - `pnpm install --frozen-lockfile` requires `pnpm-lock.yaml` synced with pnpm 10 on Node.js 24.
  - Main app routes sit behind Better Auth and product admission. E2E requires the Better Auth migration, `DATABASE_URL`, `BETTER_AUTH_SECRET`, and `TEST_AUTH_SECRET`.
  - Auth-gated `(main)` layout previously blocked the entire subtree; AuthGate is deferred behind Suspense.
