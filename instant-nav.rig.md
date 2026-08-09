# instant-nav rig: project-blue-jeans

- BUILD: `EXPOSE_TESTING_API=1 npm run build && npm run start` (local production build on port 3000). Never measure on `next dev`.
- EXPOSE: `process.env.EXPOSE_TESTING_API === "1"` wired to `experimental.exposeTestingApiInProductionBuild` in `next.config.ts`. Never set in real production deploys.
- RUN: `npx playwright test tests/e2e/instant-nav` with `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000` (default). Playwright `webServer` starts `npm run start` against the prebuilt artifact; build with the expose flag first.
- TEST USER: E2E admin via `tests/e2e/.auth/admin.json` (`e2e-role=admin` cookie; `E2E_PLAYWRIGHT=1` swaps in stub Neon Auth). Role/data: admin allowlist bypass; closet may be empty without `DATABASE_URL`.
- DRIFT: admin vs non-admin cookies; empty closet without Neon; Vertex/UploadThing secrets unused for shell; landing vs signed-in redirect for non-admins; theme (system).
- LOOP: local only — stop any process on :3000 → `EXPOSE_TESTING_API=1 npm run build` → `npm run start` → Playwright → fix → rebuild. Agent-drivable; no deploy wait.
- LIVENESS: n/a (local `build && start`; artifact is the one just built).
- WALLS:
  - `npm ci` requires lockfile synced with npm 10 (Node 20 CI).
  - Main app routes sit behind Neon Auth; e2e uses `E2E_PLAYWRIGHT=1` stub + cookie storageState.
  - Auth-gated `(main)` layout previously blocked the entire subtree; AuthGate is deferred behind Suspense.
