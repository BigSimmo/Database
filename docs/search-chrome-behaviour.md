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
6. Header and footer chrome that share the same scroll signal should hide/reveal symmetrically for the surfaces that actually hide: when the top bar is hidden, underlying content must be visible to the viewport edge. Top-bar hide/reveal is cross-breakpoint; the search field stays on tablet/desktop; the bottom search dock is phone-only. Read "Scroll hide/reveal" below before changing either.
7. Do not add page-local dock-sized `pb-[calc(...safe-area...)]` under a shell-owned dock. Put clearance in the shared reserve or the page-owned composer, never both.
8. `GlobalSearchShell` uses an inner `mobile-composer-reserve-pad` so phone padding contributes to scroll height; do not move phone shell clearance back to scrollport padding without a browser proof.
9. Keep collapse-budget policy geometry-aware: an in-flow collapsing header needs enough remaining runway to absorb header + dock clearance, while a fixed overlay that only releases bottom reserve may hide when its post-collapse range retains the top reveal band plus deliberate hide intent _and_ the current offset already fits that post-collapse range (no material near-bottom clamp). Do not use synthetic page padding to make the stricter gate pass.
10. Detect reserve-transition clamps from geometry, not a wider pixel tolerance: if the scroll range shrinks and the previous offset no longer fits inside the new maximum, rebase that frame as layout feedback. Once the range stabilizes, the same upward movement must reveal normally.

## Scroll hide/reveal

The universal **top bar** (mode, new chat, menu) hides on a deliberate scroll down and returns on a deliberate scroll up at **every** breakpoint. The search field does **not** hide with it on tablet or desktop — only the phone bottom search dock still scroll-hides, and that stays phone-only. Both the top bar and the phone dock read one `useScrollHideReporter` per host, so they can never disagree about direction.

Choose the hide mechanism from where the host's scrollport lives, because that decides what hiding costs the reader:

| Host                              | Scrollport                                    | `hideOnScroll`                           | Mechanism                                                                                      |
| --------------------------------- | --------------------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `ClinicalDashboard` (answer view) | `<main>` at every width                       | `strategy: "overlay", allBreakpoints`    | Absolute glass top bar translates off; `<main>` keeps its top reserve; search stays            |
| `ClinicalDashboard` (other modes) | `<main>` at every width                       | `strategy: "collapse", wide: "collapse"` | Top-bar 1fr -> 0fr grid row; released strip goes to content; search stays as a sibling         |
| `GlobalSearchShell`               | `#main-content` on phones, the document above | `strategy: "collapse", wide: "sticky"`   | Sticky stack of [top bar \| search]; only the top-bar row collapses so search rises to the top |

Rules that keep this working:

- **Hide the top bar, not the search field, above phones.** The collapse wrapper (`data-testid="universal-header-collapse"`) wraps `header#search` plus optional page chrome that must match top-bar hide/reveal (via `headerCollapseAddonSlotId`). Putting the inline search composer inside that wrapper is what made tablet/desktop search disappear with the mode bar — keep composers outside the collapse row.
- **Page chrome that must match the top bar portals into the collapse host.** Do not pin tool secondary nav with `position: sticky` inside `#main-content` on phones — after the header collapses that sticky row becomes a second stuck header. Therapy's section strip portals into `#therapy-header-collapse-addon-slot` below `max-sm` and stays in-flow sticky above that.
- **Feed the reporter from the element that actually scrolls.** `GlobalSearchShell`'s `#main-content` is the scrollport only on phones, so above that it also runs `useDocumentScrollHideReporter`. That hook self-gates: the phone shell is `fixed inset-0`, so the document cannot scroll and never fires.
- **Sticky belongs on the outer [top bar \| search] stack, not on `header#search`.** The top bar sits inside header-height boxes, which leaves a sticky rule on it zero travel. For the same reason the stack's ancestor in `GlobalSearchShell` is `display: contents` above the phone breakpoint rather than a block.
- **Collapse only the top-bar row inside a sticky stack.** Translating the whole stack would take the search field off-screen; collapsing just the top bar lets search stay pinned at the viewport top.
- **Rebase the reporter on geometry switches.** Pass `resetKey` when the host changes the scrollport under it (`ClinicalDashboard` passes `searchMode`, which swaps `<main>`'s header reserve); otherwise the carried-over offset spends the first post-switch scroll on a spurious hide or reveal.

Coverage: `tests/header-scroll-hide-contract.test.ts` (wiring), `tests/use-hide-on-scroll.test.ts` (decision logic), `tests/ui-chrome-scroll.spec.ts` (tablet/desktop top-bar hide/reveal with search still visible), `tests/ui-phone-scroll.spec.ts` (phone scroll geometry), `tests/ui-therapy-nav-scroll.spec.ts` (Therapy section nav hide/reveal with the top bar).

## Change checklist

Before changing search bar behaviour:

- Identify the page ownership row above.
- Confirm whether the page is using `GlobalSearchShell`, `ClinicalDashboard`, or `DocumentViewer` for the composer.
- Update the reserve helper and CSS token together when changing clearances.
- Add or update a focused static contract test for new constants or exceptions.
- For visual/scroll changes, run the relevant phone-scroll/overlap Playwright coverage through `npm run ensure` and `npm run verify:ui` when the environment supports the repo runtime.
- For hide-on-scroll changes, re-read "Scroll hide/reveal" and prove the reveal at tablet and desktop, not just the hide.
- If a new route has a page-owned composer, document it here and add it to the route/search coverage rather than relying on comments in a component.
