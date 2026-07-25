# Search chrome behaviour contract

This repo uses one shared search experience across the global shell, dashboard result pages, and document-detail/source routes. Keep the behaviour page-aware but predictable.

## Page ownership model

| Page state                          | Composer placement                                                       | Reserve owner                                 |
| ----------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------- |
| Answer home / standalone mode homes | In-flow hero composer on phones and larger breakpoints                   | Page content; no fixed phone dock reserve     |
| Submitted/search-result views       | Compact bottom dock on phones; header/inline placement on larger screens | Shell/dashboard `--mobile-composer-reserve`   |
| Answer result view                  | Overlaid glass header plus answer composer dock                          | Dashboard `#main-content` top/bottom reserves |
| Document detail/source routes       | `DocumentViewer` floating composer                                       | `DocumentViewer` content padding              |
| Info/detail pages with no composer  | No fixed composer                                                        | Idle shell padding only                       |

## Invariants

1. Use `src/components/clinical-dashboard/mobile-composer-reserve.ts` as the TypeScript source of truth for phone composer clearances.
2. Keep the CSS token `--phone-dock-hidden-pad` aligned with `mobileComposerHiddenReserve`.
3. A visible fixed phone dock may include `var(--safe-area-bottom)` so the pill clears the home indicator.
4. A hidden phone dock must release the content-facing reserve to `0rem`; do not use `env(safe-area-inset-bottom)` or `var(--safe-area-bottom)` for hidden content padding.
5. Edge-to-edge phone dock mode is `left: 0; right: 0; bottom: 0; width: 100%`; inset the pill with padding, not with a non-zero bottom offset.
6. Header and footer chrome that share the same scroll signal should hide/reveal symmetrically: when hidden, underlying content must be visible to the viewport edge.
7. Do not add page-local dock-sized `pb-[calc(...safe-area...)]` under a shell-owned dock. Put clearance in the shared reserve or the page-owned composer, never both.
8. `GlobalSearchShell` uses an inner `mobile-composer-reserve-pad` so phone padding contributes to scroll height; do not move phone shell clearance back to scrollport padding without a browser proof.
9. Standalone mode-home detection (`isStandaloneModeHomePath`) is pathname-only. Do not gate hero vs dock on a React `searchMode` that can update before the router pathname lands — that one-frame mismatch animates reserve padding and reads as a choppy screen resize.
10. Phone `#main-content` / reserve-pad `padding-bottom` transitions apply only while `data-bottom-composer-hidden="true"` (scroll-hide). Mode and route reserve flips must snap.
11. Shared shell must reset phone scroll offset and scroll-hide state on `pathname` change so mode homes do not inherit a mid-page offset or collapsed header.
12. Hero composer portal: keep the default composer mounted until the portal host is actually attached; do not hide on `slotId` alone (mode-home remounts otherwise flash a null gap).
13. Leaving the dashboard shell for a namespaced mode (`selectSearchMode` / `crossModeSearch`) must navigate without rewriting dashboard chrome first.

## Change checklist

Before changing search bar behaviour:

- Identify the page ownership row above.
- Confirm whether the page is using `GlobalSearchShell`, `ClinicalDashboard`, or `DocumentViewer` for the composer.
- Update the reserve helper and CSS token together when changing clearances.
- Add or update a focused static contract test for new constants or exceptions.
- For visual/scroll changes, run the relevant phone-scroll/overlap Playwright coverage through `npm run ensure` and `npm run verify:ui` when the environment supports the repo runtime.
- If a new route has a page-owned composer, document it here and add it to the route/search coverage rather than relying on comments in a component.
