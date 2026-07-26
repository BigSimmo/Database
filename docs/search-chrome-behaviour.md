# Search chrome behaviour contract

This repo uses one shared search experience across the global shell, dashboard result pages, and document-detail/source routes. Keep the behaviour page-aware but predictable.

## Page ownership model

| Page state                          | Composer placement                                                                                | Reserve owner                                                                  |
| ----------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Answer home / standalone mode homes | In-flow hero composer on phones and larger breakpoints                                            | Page content; no fixed phone dock reserve                                      |
| Submitted/search-result views       | Compact bottom dock on phones; pinned below the header on tablets; in normal page flow on desktop | Shell/dashboard `--mobile-composer-reserve` on phones; page content on desktop |
| Answer result view                  | Overlaid glass header plus answer composer dock                                                   | Dashboard `#main-content` top/bottom reserves                                  |
| Document detail/source routes       | `DocumentViewer` floating composer                                                                | `DocumentViewer` content padding                                               |
| Calculators (`/calculators`)        | Page-owned composer (desktop top + phone bottom dock)                                             | Calculators page pad; shell reserve stays `0`                                  |
| Info/detail pages with no composer  | No fixed composer                                                                                 | Idle shell padding only                                                        |

## Invariants

1. Use `src/components/clinical-dashboard/mobile-composer-reserve.ts` as the TypeScript source of truth for phone composer clearances.
2. Keep the CSS token `--phone-dock-hidden-pad` aligned with `mobileComposerHiddenReserve`.
3. A visible fixed phone dock may include `var(--safe-area-bottom)` so the pill clears the home indicator.
4. A hidden phone dock must release the content-facing reserve to `0rem`; do not use `env(safe-area-inset-bottom)` or `var(--safe-area-bottom)` for hidden content padding.
5. Edge-to-edge phone dock mode is `left: 0; right: 0; bottom: 0; width: 100%`; inset the pill with padding, not with a non-zero bottom offset.
6. Header and footer chrome that share the same scroll signal should hide/reveal symmetrically for the surfaces that actually hide: when the phone top bar is hidden, `chrome-safe-area-top` and the controls both release to `0rem` so underlying content paints to the physical viewport edge. The visible phone header still owns `var(--safe-area-top)`; tablet/desktop sticky chrome keeps its pinned inset. Top-bar hide/reveal is cross-breakpoint; the search field stays pinned on tablets, while desktop search belongs to page flow and scrolls away naturally; the bottom search dock is phone-only. Hidden bottom dock reserve stays `0rem` (invariant 4). Read "Scroll hide/reveal" below before changing either.
7. Do not add page-local dock-sized `pb-[calc(...safe-area...)]` under a shell-owned dock. Put clearance in the shared reserve or the page-owned composer, never both.
8. `GlobalSearchShell` uses an inner `mobile-composer-reserve-pad` so phone padding contributes to scroll height; do not move phone shell clearance back to scrollport padding without a browser proof.
9. Keep collapse-budget policy geometry-aware: an in-flow collapsing phone header needs enough remaining runway to absorb controls + released top safe-area + dock clearance, while a fixed overlay that only releases bottom reserve may hide when its post-collapse range retains the top reveal band plus deliberate hide intent _and_ the current offset already fits that post-collapse range (no material near-bottom clamp). Do not use synthetic page padding to make the stricter gate pass.
10. Detect reserve-transition clamps from geometry, not a wider pixel tolerance: if the scroll range shrinks and the previous offset no longer fits inside the new maximum, rebase that frame as layout feedback. Once the range stabilizes, the same upward movement must reveal normally.

## Scroll hide/reveal

The universal **top bar** (mode, new chat, menu) is the only sticky desktop chrome: it hides on a deliberate scroll down and returns on a deliberate scroll up at **every** breakpoint. Tablet search stays pinned below it. Desktop search is mounted at the top of normal page content, so it scrolls away with that content and is independent of the header's hide state. Only the phone bottom search dock scroll-hides, and that stays phone-only. The top bar and phone dock read one `useScrollHideReporter` per host, so they can never disagree about direction.

Choose the hide mechanism from where the host's scrollport lives, because that decides what hiding costs the reader:

| Host                              | Scrollport                                    | `hideOnScroll`                           | Mechanism                                                                                                          |
| --------------------------------- | --------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `ClinicalDashboard` (answer view) | `<main>` at every width                       | `strategy: "overlay", allBreakpoints`    | Absolute glass top bar translates off; `<main>` keeps its top reserve; search stays                                |
| `ClinicalDashboard` (other modes) | `<main>` at every width                       | `strategy: "collapse", wide: "collapse"` | Top-bar row collapses; tablet search stays sticky; desktop search portals into `<main>` page flow                  |
| `GlobalSearchShell`               | `#main-content` on phones, the document above | `strategy: "collapse", wide: "sticky"`   | Tablet pins [top bar \| search]; desktop portals search into `#main-content`, leaving a sticky auto-hiding top bar |

Rules that keep this working:

- **Hide the top bar, not the search field.** The collapse wrapper (`data-testid="universal-header-collapse"`) wraps `header#search` plus optional page chrome that must match top-bar hide/reveal (via `headerCollapseAddonSlotId`). Keep composers outside the collapse row: tablet search stays pinned independently, and desktop search scrolls with page content rather than being translated by the header.
- **Page chrome that must match the top bar portals into the collapse host.** Do not pin tool secondary nav with `position: sticky` inside `#main-content` on phones — after the header collapses that sticky row becomes a second stuck header. Therapy's section strip portals into `#therapy-header-collapse-addon-slot` below `max-sm` and stays in-flow sticky above that.
- **Feed the reporter from the element that actually scrolls.** `GlobalSearchShell`'s `#main-content` is the scrollport only on phones, so above that it also runs `useDocumentScrollHideReporter`. That hook self-gates: the phone shell is `fixed inset-0`, so the document cannot scroll and never fires.
- **Tablet stickiness belongs on the outer [top bar \| search] stack, not on `header#search`.** The top bar sits inside header-height boxes, which leaves a sticky rule on it zero travel. For the same reason the stack's ancestor in `GlobalSearchShell` is `display: contents` above the phone breakpoint rather than a block, and collapse returns a fragment (safe-area spacer + stack) rather than a single root box. At desktop widths the search portal leaves that same outer stack holding only the top bar.
- **Collapse only the top-bar row inside a sticky stack.** On tablets, translating the whole stack would take the search field off-screen; collapsing just the top bar lets search stay pinned at the viewport top below the wide-layout safe-area spacer. On desktop, the page-flow search is outside the stack entirely.
- **Release the phone top inset with hidden chrome.** `chrome-safe-area-top` is a full-width sibling that is `h-[var(--safe-area-top)]` while the phone header is visible and `h-0` while hidden, using the same transition timing as the top-bar row. `readChromeCollapseMetrics` must charge that released phone height as well as the controls and dock reserve, or short pages clamp and oscillate at the bottom. At `sm+` the spacer remains `h-[var(--safe-area-top)]`, and sticky chrome pins at `top: var(--safe-area-top)`. Do not leave a phone-only surface/status-bar band after the controls collapse.
- **Do not double-sticky tablet search inside an outer sticky stack.** When `wide: "sticky"` owns the tablet stack, the composer stays `relative` in that stack. A second sticky search with its own `top` overlays page controls (and blocks clicks) once the top bar collapses.
- **Desktop search is page-owned.** `desktop-page-search-composer-slot` is rendered at the top of normal shell/dashboard content and accepts the shared composer only at `min-width: 1024px`. The mode-home hero slot takes precedence. Never give the desktop page composer, its slot, or an ancestor `fixed`/`sticky` positioning.
- **Collapse-everywhere hosts still drop their own sticky search offset while the top bar is hidden.** Dashboard result composers that clear a visible top bar with `top: 4.75rem + safe-area` must switch to `top: 0` when collapse hide is active — otherwise a dead band the height of the mode bar remains above the search field.
- **Rebase the reporter on geometry switches.** Pass `resetKey` when the host changes the scrollport under it (`ClinicalDashboard` passes `searchMode`, which swaps `<main>`'s header reserve); otherwise the carried-over offset spends the first post-switch scroll on a spurious hide or reveal.
- **Do not carry composer focus into submitted result views.** Focus pins both chrome edges for keyboard safety. `GlobalSearchShell` must not pass `focus: true` with `run: true`, must gate `queryInputAutoFocus` on `!hasSubmittedModeSearch`, and must blur the dock input when the result canvas scrolls so hide-on-scroll can reclaim the header and the bottom dock (including its white safe-area rail).

Coverage: `tests/header-scroll-hide-contract.test.ts` (wiring), `tests/use-hide-on-scroll.test.ts` (decision logic), `tests/ui-chrome-scroll.spec.ts` (tablet pinned-search behaviour and desktop page-flow search plus top-bar hide/reveal), `tests/ui-phone-scroll.spec.ts` (phone scroll geometry), `tests/ui-therapy-nav-scroll.spec.ts` (Therapy section nav hide/reveal with the top bar).

## Change checklist

Before changing search bar behaviour:

- Identify the page ownership row above.
- Confirm whether the page is using `GlobalSearchShell`, `ClinicalDashboard`, or `DocumentViewer` for the composer.
- Update the reserve helper and CSS token together when changing clearances.
- Add or update a focused static contract test for new constants or exceptions.
- For visual/scroll changes, run the relevant phone-scroll/overlap Playwright coverage through `npm run ensure` and `npm run verify:ui` when the environment supports the repo runtime.
- For hide-on-scroll changes, re-read "Scroll hide/reveal" and prove the reveal at tablet and desktop, not just the hide.
- If a new route has a page-owned composer, document it here and add it to the route/search coverage rather than relying on comments in a component.
