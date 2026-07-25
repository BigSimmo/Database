# Search chrome behaviour contract

This repo uses one shared search experience across the global shell, dashboard result pages, and document-detail/source routes. Keep the behaviour page-aware but predictable.

## Page ownership model

| Page state                          | Composer placement                                                       | Reserve owner                                 |
| ----------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------- |
| Answer home / standalone mode homes | In-flow hero composer on phones and larger breakpoints                   | Page content; no fixed phone dock reserve     |
| Submitted/search-result views       | Compact bottom dock on phones; header/inline placement on larger screens | Shell/dashboard `--mobile-composer-reserve`   |
| Answer result view                  | Overlaid glass header plus answer composer dock                          | Dashboard `#main-content` top/bottom reserves |
| Document detail/source routes       | `DocumentViewer` floating composer                                       | `DocumentViewer` content padding              |
| Calculators (`/calculators`)        | Page-owned composer (desktop top + phone bottom dock)                    | Calculators page pad; shell reserve stays `0` |
| Info/detail pages with no composer  | No fixed composer                                                        | Idle shell padding only                       |

## Invariants

1. Use `src/components/clinical-dashboard/mobile-composer-reserve.ts` as the TypeScript source of truth for phone composer clearances.
2. Keep the CSS token `--phone-dock-hidden-pad` aligned with `mobileComposerHiddenReserve`.
3. A visible fixed phone dock may include `var(--safe-area-bottom)` so the pill clears the home indicator.
4. A hidden phone dock must release the content-facing reserve to `0rem`; do not use `env(safe-area-inset-bottom)` or `var(--safe-area-bottom)` for hidden content padding.
5. Edge-to-edge phone dock mode is `left: 0; right: 0; bottom: 0; width: 100%`; inset the pill with padding, not with a non-zero bottom offset.
6. Header and footer chrome that share the same scroll signal should hide/reveal symmetrically: when hidden, underlying content must be visible to the viewport edge. Header hide/reveal is cross-breakpoint; the bottom search dock is phone-only. Read "Scroll hide/reveal" below before changing either.
7. Do not add page-local dock-sized `pb-[calc(...safe-area...)]` under a shell-owned dock. Put clearance in the shared reserve or the page-owned composer, never both.
8. `GlobalSearchShell` uses an inner `mobile-composer-reserve-pad` so phone padding contributes to scroll height; do not move phone shell clearance back to scrollport padding without a browser proof.

## Scroll hide/reveal

The universal header hides on a deliberate scroll down and returns on a deliberate scroll up at **every** breakpoint. The bottom search dock keeps that behaviour on phones only — on tablet and desktop the composer sits in the hero or the header, where there is nothing to reclaim. Both read one `useScrollHideReporter` per host, so the header and the phone dock can never disagree about direction.

Choose the hide mechanism from where the host's scrollport lives, because that decides what hiding costs the reader:

| Host                              | Scrollport                                    | `hideOnScroll`                           | Mechanism                                                                |
| --------------------------------- | --------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------ |
| `ClinicalDashboard` (answer view) | `<main>` at every width                       | `strategy: "overlay", allBreakpoints`    | Absolute glass bar translates off; `<main>` keeps its top reserve        |
| `ClinicalDashboard` (other modes) | `<main>` at every width                       | `strategy: "collapse", wide: "collapse"` | 1fr -> 0fr grid row; the released strip goes straight to the content     |
| `GlobalSearchShell`               | `#main-content` on phones, the document above | `strategy: "collapse", wide: "sticky"`   | Grid collapse on phones; sticks to the viewport top and translates above |

Rules that keep this working:

- **Feed the reporter from the element that actually scrolls.** `GlobalSearchShell`'s `#main-content` is the scrollport only on phones, so above that it also runs `useDocumentScrollHideReporter`. That hook self-gates: the phone shell is `fixed inset-0`, so the document cannot scroll and never fires.
- **Do not release flow space out of a document-scrolled page.** Collapsing the header row while the document scrolls pulls the whole page up by the header height mid-scroll. Stick and translate instead; `readChromeCollapseBudget` therefore charges the header's height against the scroll runway only while the wrapper is a grid at the current width.
- **Sticky belongs on the collapse wrapper, not on `header#search`.** The header sits inside two header-height boxes, which leaves a sticky rule on it zero travel — that is what made the desktop bar scroll away and only return at the top of the page. For the same reason the wrapper's ancestor in `GlobalSearchShell` is `display: contents` above the phone breakpoint rather than a block.
- **Transform only while hidden.** A standing transform on the wrapper would become the containing block for the fixed-position menus and composers rendered inside it.
- **Rebase the reporter on geometry switches.** Pass `resetKey` when the host changes the scrollport under it (`ClinicalDashboard` passes `searchMode`, which swaps `<main>`'s header reserve); otherwise the carried-over offset spends the first post-switch scroll on a spurious hide or reveal.

Coverage: `tests/header-scroll-hide-contract.test.ts` (wiring), `tests/use-hide-on-scroll.test.ts` (decision logic), `tests/ui-chrome-scroll.spec.ts` (tablet/desktop hide and reveal), `tests/ui-phone-scroll.spec.ts` (phone scroll geometry).

## Change checklist

Before changing search bar behaviour:

- Identify the page ownership row above.
- Confirm whether the page is using `GlobalSearchShell`, `ClinicalDashboard`, or `DocumentViewer` for the composer.
- Update the reserve helper and CSS token together when changing clearances.
- Add or update a focused static contract test for new constants or exceptions.
- For visual/scroll changes, run the relevant phone-scroll/overlap Playwright coverage through `npm run ensure` and `npm run verify:ui` when the environment supports the repo runtime.
- For hide-on-scroll changes, re-read "Scroll hide/reveal" and prove the reveal at tablet and desktop, not just the hide.
- If a new route has a page-owned composer, document it here and add it to the route/search coverage rather than relying on comments in a component.
