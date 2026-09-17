# instant-nav rig: project-blue-jeans

- BUILD: `npm run build:e2e && npm run start` (local production build on port 3000). Never measure on `next dev`.
- EXPOSE: `EXPOSE_TESTING_API=1 && VERCEL!=1` is wired to `experimental.exposeTestingApiInProductionBuild` in `next.config.ts`.
- RUN: `npx playwright test tests/e2e/instant-nav` with `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000` (default). Playwright `webServer` starts `npm run start` against the prebuilt artifact; build with the expose flag first.
- TEST USER: global setup posts `TEST_AUTH_SECRET` to `/api/test-auth/login` and stores real Better Auth sessions in `tests/e2e/.auth/admin.json` and `non-admin.json`. The admitted tester receives a test-only Wearer membership; production owner semantics remain unchanged.
- DRIFT: admitted owner vs unsigned-in cookies; empty closet without Neon; Gemini/UploadThing secrets unused for shell; landing vs signed-in redirect for accounts without membership; theme (system).
- LOOP: local only — stop any process on :3000 → `EXPOSE_TESTING_API=1 npm run build` → `npm run start` → Playwright → fix → rebuild. Agent-drivable; no deploy wait.
- LIVENESS: n/a (local `build && start`; artifact is the one just built).
- WALLS:
  - `npm ci` requires lockfile synced with npm 10 (Node 20 CI).
  - Main app routes sit behind Better Auth and product admission. E2E requires the Better Auth migration, `DATABASE_URL`, `BETTER_AUTH_SECRET`, and `TEST_AUTH_SECRET`.
  - Auth-gated `(main)` layout previously blocked the entire subtree; AuthGate is deferred behind Suspense.
