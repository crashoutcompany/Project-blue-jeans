# 002 — Label upload and generator controls

- **Status**: DONE
- **Commit**: 0fc9854
- **Severity**: MEDIUM
- **Category**: Accessibility
- **Rule**: react-doctor/control-has-associated-label
- **Estimated scope**: 3 files, small

## Problem

`components/upload/closet-image-upload.tsx:62` has an unlabeled file input, and `components/outfit/generator-view.tsx:329` has a textarea whose visible “Notes” text is not associated with the control.

## Target

Use the canonical recipe: give each interactive control a real accessible name. Add `aria-label="Choose clothing photos"` to the hidden file input and associate the visible Notes label with the textarea through `id`/`htmlFor`. Expose selected chip state with `aria-pressed`.

## Repo conventions to follow

- Follow existing `aria-label` and `aria-pressed` usage in closet controls.
- Preserve visual styling.

## Steps

1. Label the file input and mark compression errors as alerts.
2. Change the Notes text to a `<label htmlFor="style-notes">` and set the textarea id.
3. Add `aria-pressed={active}` to `ChipGroup` options.

## Boundaries

- Do not alter upload or generation behavior.
- Do not add dependencies.

## Verification

- `npx react-doctor@latest --scope changed` clears the upload diagnostic.
- Run lint and build.
- Confirm the controls have meaningful accessible names and chip state.
