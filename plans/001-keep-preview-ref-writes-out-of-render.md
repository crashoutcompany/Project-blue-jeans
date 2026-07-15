# 001 — Keep preview ref writes out of render

- **Status**: TODO
- **Commit**: 0fc9854
- **Severity**: HIGH
- **Category**: Bugs & correctness
- **Rule**: react-doctor/no-ref-current-in-render
- **Estimated scope**: 1 file, small

## Problem

`components/outfit/closet-view.tsx:61` mutates a ref during render:

```tsx
previewUrlsRef.current = new Set(pendingDrafts.map((d) => d.previewUrl));
```

React may replay or discard that render, leaving unmount cleanup with values from UI that never committed.

## Target

Per the canonical React Doctor recipe, move ref writes into an event handler or effect so render stays pure. Update the ref in the same functional state update that adds drafts; existing remove and clear handlers already revoke URLs directly.

## Repo conventions to follow

- Preserve functional `setPendingDrafts` updates.
- Keep cleanup in `components/outfit/closet-view.tsx`.

## Steps

1. Remove the render-time assignment.
2. In `handleFilesReady`, add each new preview URL to the ref before returning the next draft array.
3. Keep remove, clear, and successful-save cleanup synchronized with the ref.

## Boundaries

- Do not change upload behavior or the `ClosetImageUpload` API.
- Do not add dependencies.

## Verification

- `npx react-doctor@latest --scope changed` clears `no-ref-current-in-render`.
- Run lint and build.
- Add and remove queued photos and confirm previews are revoked only when removed, saved, cleared, or unmounted.
