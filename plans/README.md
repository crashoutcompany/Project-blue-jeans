# React improvement plans

| Order | Plan                                                                                  | Status | Dependency                       |
| ----- | ------------------------------------------------------------------------------------- | ------ | -------------------------------- |
| 1     | [Keep preview ref writes out of render](001-keep-preview-ref-writes-out-of-render.md) | DONE   | None                             |
| 2     | [Label upload and generator controls](002-label-upload-and-generator-controls.md)     | DONE   | None                             |
| 3     | [Track generation pending state correctly](003-track-generation-pending-correctly.md) | DONE   | None                             |
| 4     | [Upgrade the Next.js security patch](004-upgrade-next-security-patch.md)              | DONE   | Run last, then full verification |

These are the highest-leverage actionable findings from the React Doctor scan. Authentication findings require a product-level identity and tenancy decision that this repository does not currently provide, so they are intentionally not represented as an implementation-ready plan.
