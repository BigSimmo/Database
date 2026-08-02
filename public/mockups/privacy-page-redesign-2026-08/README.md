# Privacy page redesign comps (2026-08)

Static combined desktop + phone comps for `/privacy`, plus the runnable study at
[`/mockups/privacy-page-directions`](../../../src/app/mockups/privacy-page-directions/page.tsx).

Clinical White / Sky Graphite only (`docs/design-system.md`,
`docs/redesign/permanent-colour-direction.md`). Governance section headings and body
copy match production (`tests/privacy-ui.test.ts`).

| File                                 | Direction            | Notes                     |
| ------------------------------------ | -------------------- | ------------------------- |
| `01-quiet-ledger-desktop-phone.png`  | **01 Quiet ledger**  | Recommended default       |
| `02-trust-map-desktop-phone.png`     | **02 Trust map**     | Region chips + icon cards |
| `03-indexed-brief-desktop-phone.png` | **03 Indexed brief** | Phone chips + desktop TOC |

## Contracts locked in these comps

- Back control sits below `safe-area-inset-top` and is at least 48×48.
- Amber is reserved for the Important obligation only.
- Clinical Sky accent is used for navigation chips / processing-map highlights only.
- No wording change to pinned privacy governance copy.

Production UI for the full redesign is unchanged until a direction is chosen.
The safe-area back-control pad on `/privacy` ships independently of that choice.
