# 003 — Track generation pending state correctly

- **Status**: TODO
- **Commit**: 0fc9854
- **Severity**: HIGH
- **Category**: Bugs & correctness
- **Rule**: Beyond the scan
- **Estimated scope**: 1 file, small

## Problem

`components/outfit/generator-view.tsx:257` starts an async function inside `startTransition`. The pending UI can stop before the server action finishes, allowing overlapping generation requests and stale results.

## Target

Use explicit request state for network lifetime and a monotonically increasing request id. Disable the generate button until the latest request settles, and ignore responses from older requests.

## Repo conventions to follow

- Keep interaction work in `handleGenerate`.
- Preserve the existing server action payload and error copy.

## Steps

1. Replace transition pending state with `isGenerating` state and a request id ref.
2. Capture the id before awaiting `generateLookbook`.
3. Apply results/errors and clear pending only when the id is still current.

## Boundaries

- Do not change the server action contract.
- Do not add dependencies.

## Verification

- Run lint and build.
- Trigger generation and confirm the button remains disabled until completion.
- Confirm an older response cannot replace a newer result.
