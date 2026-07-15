# 004 — Upgrade the Next.js security patch

- **Status**: DONE
- **Commit**: 0fc9854
- **Severity**: HIGH
- **Category**: Security
- **Rule**: react-doctor/no-vulnerable-react-server-components
- **Estimated scope**: 2 files, dependency update

## Problem

`package.json:23` pins Next.js 16.2.2. React Doctor reports its bundled RSC runtime is affected by CVE-2026-23870 and recommends Next.js 16.2.6 or newer.

## Target

Install the latest compatible Next.js release with npm so `package.json` and `package-lock.json` are updated together.

## Repo conventions to follow

- Use npm; this repository owns `package-lock.json`.
- Keep React on the version required by the resulting Next.js peer range.

## Steps

1. Run `npm install next@latest`.
2. Review package and lockfile changes for unrelated dependency churn.
3. Run the full lint and production build.

## Boundaries

- Do not force a major-version migration if `latest` changes the framework major.
- Do not run automated audit fixes.

## Verification

- `npx react-doctor@latest --scope changed` clears the vulnerability.
- Run lint and build.
- Confirm all App Router routes still compile.
