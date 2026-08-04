# Search chrome behaviour contract

This repo uses one shared search experience across the global shell, dashboard result pages, and document-detail/source routes. Keep the behaviour page-aware but predictable.

## Page ownership model

| Page state                          | Composer placement                                                         | Reserve owner                                                                  |
| ----------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Answer home / standalone mode homes | In-flow hero composer on phones and larger breakpoints                     | Page content; no fixed phone dock reserve                                      |
| Submitted/search-result views       | Compact bottom dock on phones; in normal page flow on tablets and desktops | Shell/dashboard `--mobile-composer-reserve` on phones; page content on desktop |
| Answer result view                  | Overlaid glass header plus answer composer dock                            | Dashboard `#main-content` top/bottom reserves                                  |
| Document detail/source routes       | `DocumentViewer` floating composer                                         | `DocumentViewer` content padding                                               |
| Document section navigation         | Header row disclosure (phone sheet) + rail index card at `lg`              | None — adds no chrome and no reserve                                           |
| Calculators (`/calculators`)        | Page-owned composer (desktop top + phone bottom dock)                      | Calculators page pad; shell reserve stays `0`                                  |
| Info/detail pages with no composer  | No fixed composer                                                          | Idle shell padding only                                                        |

## Invariants

1. Use `src/components/clinical-dashboard/mobile-composer-reserve.ts` as the TypeScript source of truth for phone composer clearances.
2. Keep the CSS token `--phone-dock-hidden-pad` aligned with `mobileComposerHiddenReserve`.
3. A visible fixed phone dock may include `var(--safe-area-bottom)` so the pill clears the home indicator.
4. A hidden phone dock must release the content-facing reserve to `0rem`; do not use `env(safe-area-inset-bottom)` or `var(--safe-area-bottom)` for hidden content padding.
5. Edge-to-edge phone dock mode is `left: 0; right: 0; bottom: 0; width: 100%`; inset the pill with padding, not with a non-zero bottom offset. Keep the dock form transparent and use its absolute `.answer-footer-search-backdrop` child for localized translucent gradient/blur around the pill. The gradient and every blur mask must return to fully transparent at the physical bottom edge. It must move and fade with the dock, then become `visibility: hidden` after the hide transition so WebKit cannot retain a safe-area compositor strip; it must never become a viewport-fixed or opaque slab.
6. Header and footer chrome that share the same scroll signal should hide/reveal symmetrically for the surfaces that actually hide. **Collapse motion:** when the phone top bar is hidden, `chrome-safe-area-top` and the controls both release to `0rem` so underlying content paints to the physical viewport edge. **Overlay motion (default for `GlobalSearchShell` phones; collapse remains for `isCollapseMotionPhoneRoute`):** the stack translates instead; `chrome-safe-area-top` stays inside the translated layer at a stable height, and the content-facing `--phone-overlay-chrome-h` clearance is constant across hide/reveal — zeroing it on hide would reintroduce the layout shift overlay exists to remove. The visible phone header still owns `var(--safe-area-top)`; tablet/desktop top-bar chrome keeps its pinned inset. While visible that spacer is the top of the header, so it paints `var(--surface)` — the bar's own opaque phone colour — never `var(--background)`: the page colour there reads as a status-bar band above the bar, the seam overlay-strategy answer mode never shows because its header pads the inset itself. Keep it opaque so the sm+ pinned inset still hides scrolled content. Top-bar hide/reveal is cross-breakpoint; the search field belongs to page flow and scrolls away naturally on tablets and desktops; the bottom search dock is phone-only. Hidden bottom dock reserve stays `0rem` (invariant 4). Read "Scroll hide/reveal" below before changing either.
7. Do not add page-local dock-sized `pb-[calc(...safe-area...)]` under a shell-owned dock. Put clearance in the shared reserve or the page-owned composer, never both.
8. `GlobalSearchShell` uses an inner `mobile-composer-reserve-pad` so phone padding contributes to scroll height; do not move phone shell clearance back to scrollport padding without a browser proof.
9. Page-owned fixed phone composers follow the same release contract: calculators use the shared footer backdrop; DocumentViewer keeps its floating pill but synchronizes transform, opacity, pointer release, and its own zero-reserve content padding. In-flow hero composers remain free of fixed-footer glass.
10. Keep collapse-budget policy geometry-aware: an in-flow collapsing phone header needs enough remaining runway to absorb controls + released top safe-area + dock clearance, while a fixed overlay that only releases bottom reserve may hide when its post-collapse range retains the top reveal band plus deliberate hide intent _and_ the current offset already fits that post-collapse range (no material near-bottom clamp). Do not use synthetic page padding to make the stricter gate pass.
11. Detect reserve-transition clamps from geometry, not a wider pixel tolerance: if the scroll range shrinks and the previous offset no longer fits inside the new maximum, rebase that frame as layout feedback. Once the range stabilizes, the same upward movement must reveal normally.
12. Standalone mode-home detection (`isStandaloneModeHomePath`) is pathname-only. Do not gate hero vs dock on a React `searchMode` that can update before the router pathname lands — that one-frame mismatch animates reserve padding and reads as a choppy screen resize.
13. Phone `#main-content` / reserve-pad `padding-bottom` transitions apply while `data-reserve-transitioning="true"` (scroll-hide and reveal). Mode and route reserve flips clear that marker immediately and must snap.
14. Shared shell must reset phone scroll offset and scroll-hide state on `pathname` change so mode homes do not inherit a mid-page offset or collapsed header.
15. Hero composer portal: keep the default composer mounted until the portal host is actually attached; do not hide on `slotId` alone (mode-home remounts otherwise flash a null gap).
16. Leaving the dashboard shell for a namespaced mode (`selectSearchMode` / `crossModeSearch`) must navigate without rewriting dashboard chrome first.
17. Do not wrap mode-home `{children}` in `ClientHydrationBoundary` — that blanks RSC HTML until JS mounts. Keep hydration guards on the specific leaf that mismatches. Do not call `useSearchParams()` in an ancestor Suspense that also renders route `{children}`: that nests the page segment inside the shell’s incomplete streaming boundary and can leave a persistent hidden `S:` clone (duplicate page-root `data-testid`s). Gate always-standalone pathnames with `isAlwaysStandaloneShellPath`, and bridge search params beside the shell body via `ShellSearchParamsBridge`.
18. Standalone mode-home `loading.tsx` files must render `ModeHomeRouteLoading` (phone top-aligned). Do not reuse unrelated results/medication skeletons.
19. `ClinicalDashboard` must stay out of the shared shell's static import graph (dynamic import) so namespaced mode routes do not parse the dashboard module.
20. Browser-mode phones keep `.phone-viewport-shell` in normal flow and use the document as the vertical scroll owner. This is required for Safari to minimize its own browser chrome; do not restore a fixed/inset root or a phone `overflow-y: auto` canvas.
21. Installed standalone phones use the same normal-flow root with the final `display-mode: standalone` `100vh` bound and an internal `.phone-scroll-surface`. Keep that override after the browser contract; do not substitute `svh`, `dvh`, `visualViewport.height`, or a fixed root on this WebKit workaround path. Every phone footer uses `.phone-footer-layer`: fixed to the viewport in browser tabs and absolute to the positioned 100vh frame in standalone, so the composer and its backdrop share the repaired PWA edge. Page-owned footer layers must render through `PhoneFooterLayerPortal`; `PhoneFooterLayerFrame` provides a frame-scoped, paint-free host after the scroll surface. An absolute footer left inside `.phone-scroll-surface` still scrolls and clips with that surface.
22. Document section navigation adds no chrome. The document header row carries the active section label and a
    weighted position track; the section list itself is the shared `Sheet` on phones (not viewport chrome, so no
    reserve and no second scroll owner) and an in-column card at `lg`. Both DocumentViewer sheets feed the
    `composerScrollHidden` guard so chrome cannot hide beneath an open overlay, and opening the section sheet blurs
    the document composer first. The viewer's sticky rail reads `data-scroll-hidden` from
    `universal-header-collapse` and drops its `lg:top` offset to the page-owned sticky document header height while
    the top bar is hidden; section anchors use `--document-anchor-offset`, published from the live collapse-row height
    plus that sticky header when the shared bar is away, instead of a fixed `scroll-mt`. Observe the shared header
    from the viewer; never edit it for this. The in-column section index card is `lg+` only — phones use the header
    disclosure and section sheet. Exactly one element may own `id="document-overview"` (the DocumentViewer overview
    landing wrapper); `DocumentClinicalSummary` must not reuse that id. The phone sheet lists only present sections —
    omit `source-images` when `visualCount === 0`, and do not require a "Tables and diagrams" sheet row in smoke for
    the empty-images lithium demo doc.
23. Safari's status bar, collapsing address bar, and pixels outside `window.innerHeight` are native browser/system controls. Do not use negative safe-area overscan, a fixed app root, synthetic document padding, or an opaque viewport slab to make CSS appear to own those pixels. Acceptance is no contrasting **app-owned** band around the native controls, with a matching opaque root canvas. Use the labelled physical-device matrix in [phone-chrome-physical-acceptance.md](phone-chrome-physical-acceptance.md).

## Results band (`SearchResultsHeaderBand`)

The band above every result list is not a composer and owns no dock reserve, but it is shared
chrome and changes to it land on every mode at once. Keep these rules:

0. **A faulted search never asserts a count.** This is the band's clinical invariant, not a
   style rule. `status` is a union (`ready | loading | refetching | error | unauthorized`); while
   faulted the count is absent from the DOM entirely and the spine reads "Couldn't search". A
   failed services search rendering "0 matches" states there are no crisis services when the
   search never ran. `0` with `status="ready"` is a real answer and still renders. Pages own the
   mapping from their own data source; five pages have no async source and are correct on the
   default.
1. **The query is the only heading element in the band.** It is the sole `<h1>`/`<h2>`; the count
   is never a heading. Nothing here is bold: the query uses weight 560 (`.search-band-query`) and
   the figure uses 580 (`.search-band-count`) — two nearby steps of the same scale, separated by
   tabular numerals and a hairline rather than by shouting. No eyebrow — the magnifier tile
   already says "search", and a `QUERY` / `RESULTS FOR` label costs a line to repeat it. The
   query truncates; the count does not. Weights live as numeric `font-weight` on `.search-band-*`
   classes in `globals.css`, not as Tailwind arbitrary values: `check:type-scale --strict` is a
   zero gate on arbitrary `text-[Npx]`, and Geist is a variable face so 470/540/560/580
   interpolate rather than snapping to 700. Judge weights only with the app font loaded.
2. **The count is neutral text, not a success pill.** `text-muted` with the figure itself
   `.search-band-count` (580, tabular-nums), stepping down to 470 and muted at zero. Success
   colour is reserved for states that were actually achieved, so it still carries meaning where
   it appears. The `role="status"` / `aria-live="polite"` announcement stays either way — except
   while faulted, when the spine goes `aria-live="off"` and the fault panel's `role="alert"`
   makes the single announcement instead of both speaking.
3. **Sort is a segmented control, not a select.** Two values do not justify a menu you must open
   to read. `ResultSortControl` renders `sortOptions` as `aria-pressed` buttons inside a
   `role="group"` named "Sort results"; add a third order only if it still fits the rail.
4. **Native selects are pinned to 16px below `sm`.** The unlayered iOS anti-zoom rule in
   `globals.css` ("Interactive element defaults") deliberately beats Tailwind's `text-*`
   utilities on `input`/`select`/`textarea`. Do not fight it with `!important` or a per-call-site
   override — a sub-16px control zooms the viewport on focus in Safari. Any control that must
   read quieter than the query steps down in **weight and colour**, never in size, and any
   select carrying variable-length values must set `truncate` or it clips mid-word rather than
   ellipsing (the "Current search" → "Current searcl" defect fixed 2026-07-27).
5. **The utility group is a swipe rail below `lg`, an inline row at `lg+`.** The row/stack switch
   moved to `sm` (640) so portrait tablets stop rendering the phone layout, but the rail's
   overflow, fade mask and trailing spacer stay on `lg` deliberately: at 640-1023px a page with
   chips, sort, a mobile filter and utility controls can exceed the width, and containing that
   inside a scrollable rail is what keeps `expectNoPageHorizontalOverflow` green. Children are
   `shrink-0` so they keep their natural width; overflow scrolls instead of wrapping into a
   second tinted band. The right-edge fade is applied via `data-overflowing` only while the rail
   actually overflows — never as a permanent mask.
6. **Active scopes render as removable chips at the head of that group**, in accent tone, so a
   constraint on the list is one tap from where it is read. Do not move them into a separate
   strip; `hasUtilities` already suppresses the whole group when nothing is active.
7. **The accent is the card's `border-top`, never an overlay.** An absolutely-positioned bar
   inside an `overflow-hidden` 12px-radius card is sliced by the corner arc, so it starts short
   and tapers while the 1px border curves past it — two lines, two geometries. A border mitres
   into the side borders and follows the radius by construction, and forced-colors maps it
   automatically. Under forced colors the rail survives as **thickness** (3px, and 6px `double`
   for a fault) because `--clinical-accent` resolves to `LinkText` and would otherwise be
   indistinguishable from the other borders — that is what keeps a failed search visually
   distinct from a successful one when colour is gone. The band's forced-colors rules **must
   remain the last block in `globals.css`**: at equal specificity a later rule wins, so an
   earlier block is silently overridden while still reading correctly.
8. **A new search page cannot skip the band.** `AppModeSearchConfig.resultsSurface` is required,
   so a new mode fails `typecheck` until it declares `results-band` or `answer`, and
   `tests/search-results-band-adoption.test.ts` then requires a matching mount plus a documented
   allowlist entry for any search route that legitimately has no result list.

Coverage: `tests/search-results-header-band.dom.test.tsx` (structure, sort wiring, count tone,
fault states and the no-overlay-rail guard), `tests/search-results-band-adoption.test.ts` (mode
and route adoption, forced-colors block ordering), `tests/ui-tools.spec.ts` (phone control pair
geometry and tap heights).

## Scroll hide/reveal

The universal **top bar** (mode, new chat, menu) is the only sticky desktop chrome: it hides on a deliberate scroll down and returns on a deliberate scroll up at **every** breakpoint. Tablet and desktop search are mounted at the top of normal page content, so they scroll away with that content and are independent of the header's hide state. Only the phone bottom search dock scroll-hides, and that stays phone-only. The top bar and phone dock read one `useScrollHideReporter` per host, so they can never disagree about direction.

Choose the hide mechanism from where the host's scrollport lives, because that decides what hiding costs the reader:

| Host                              | Scrollport                                                                                 | `hideOnScroll`                           | Mechanism                                                                                   |
| --------------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------- | ------------------------------------------------------------------------------------------- |
| `ClinicalDashboard` (answer view) | Document on browser phones; `<main>` in standalone and at `sm+`                            | `strategy: "overlay", allBreakpoints`    | Absolute glass top bar translates off; `<main>` keeps its top reserve; search stays         |
| `ClinicalDashboard` (other modes) | Document on browser phones; `<main>` in standalone and at `sm+`                            | `strategy: "collapse", wide: "collapse"` | Top-bar row collapses; tablet and desktop search portal into `<main>` page flow             |
| `GlobalSearchShell`               | Document in browser phones and at `sm+`; `#main-content` only in installed standalone mode | `strategy: "collapse", wide: "sticky"`   | Tablet and desktop portal search into `#main-content`, leaving a sticky auto-hiding top bar |

`GlobalSearchShell` defaults to `phoneMotion: "overlay"` on phones. The
safe-area region, universal top bar, and any page navigation portaled into the
collapse row form one fixed browser/absolute standalone layer, and the complete
layer translates over content without changing the scrollport or content
geometry. Tablet and desktop continue using `wide: "sticky"` for the top bar only.

**Collapse remains the deliberate exception** for `isCollapseMotionPhoneRoute`
(`/therapy-compass/*` and `/differentials/diagnoses/*`): those routes portal
page navigation into the collapse row and still have phone-scroll journeys that
assert in-flow collapse geometry. Migrating those contracts to overlay is
tracked separately — do not widen collapse beyond that predicate.

Elsewhere, collapse was the cause of the reported choppiness: a 1fr → 0fr grid
on the header row **plus** a `height` transition on `chrome-safe-area-top`
**plus** the reserve-pad `padding-bottom` transition handed layout back to the
scroller on every hide. Overlay removes that cause: `headerRelease` and
`phoneSafeAreaRelease` are both `0`, so hiding costs the scroller no layout.

Because overlay takes the stack out of flow, overlay phone routes own a
**constant** top clearance: `usePhoneOverlayChromeReserve` refines
`--phone-overlay-chrome-h` to the measured stack height and the shell's
`mobile-composer-reserve-pad` reads it as `max-sm:pt-[…]` only where overlay is
active. Three properties are load-bearing.

It is **measured, not tokenised**, because the collapse row grows with portaled
page navigation (`header-collapse-addon`) and a fixed `4rem` would clip those
routes. It **never varies with hide state** — `offsetHeight` ignores the hide
transform, so the same value is correct in both states; a reserve that animated
or zeroed on hide would reintroduce exactly the shift overlay removes. And it
must be **correct before the first paint**, which is a separate requirement from
both of those: the property is seeded in `globals.css` as
`calc(var(--safe-area-top) + var(--shell-header-h))` and refined in a
`useLayoutEffect`, never a passive `useEffect`, and the utility carries no `,0px`
fallback. Leaving the property unset until an effect ran painted the first
content underneath the out-of-flow header and then pushed it down at hydration —
a cold-load jump, which is the same defect class as the scroll jump this design
exists to remove (Codex P1, 2026-07-30). SSR cannot measure, so the seed is exact
only for routes without an addon row; addon routes refine by that row's height.

The clearance is only visible near scroll top, where the header is always
revealed, so it costs no usable height.

**Keep the resting state transform-free — a transform is a containing block.** A
non-`none` `transform`, _including `translateY(0)`_, makes an element a containing
block for `position: fixed` descendants. A phone bottom dock inside that subtree
resolves `bottom: 0` against the header stack rather than the viewport and lands
near the top of the screen — measured as a form bottom 772px from the viewport
bottom at 390×844, with `bottom` still computing to `0px`, which is why it reads
as a positioning puzzle rather than a CSS error.

So the revealed state applies **no** transform utility; only the hidden state
carries `max-sm:-translate-y-full`. A transition from `none` interpolates from the
identity transform, so the hide still animates. This ordering matters beyond
tidiness: a resting `translateY(0)` creates the containing block in the
server-rendered markup, before any portal exists to escape it, so the dock is
mis-anchored on first paint and only corrects at hydration (Codex P1,
2026-07-30). Resting-state-clean is the general rule — do not reintroduce a
no-op transform for symmetry with the hidden branch.

`MasterSearchHeader` additionally wraps the composer in `PhoneFooterLayerPortal`
when `phoneOverlayMotion && usesPhoneBottomDock`, which covers the during-hide
window when the transform genuinely exists, and matches the mechanism invariant
21 already requires of the DocumentViewer, calculator and differential footers.
Treat it as defence in depth, not the primary fix — `PhoneFooterLayerPortal`
starts with `isPhone === false`, so it does nothing until hydration and cannot
protect first paint on its own. Do not solve any of this by rendering the
composer twice per breakpoint: duplicate page-root `data-testid`s are their own
failure mode (see invariant 17).

Rules that keep this working:

- **Hide the top bar, not the search field.** The collapse wrapper (`data-testid="universal-header-collapse"`) wraps `header#search` plus page navigation mounted through `PhoneHeaderCollapsePortal` into `#phone-header-collapse-addon-slot`. Keep composers outside the collapse row: tablet and desktop result search scroll with page content rather than being translated by the header.
- **Every production phone navigation header has one collapse owner.** `PhoneHeaderCollapsePortal` moves Therapy section navigation, DocumentViewer navigation, and Differential detail navigation into `#phone-header-collapse-addon-slot` below `sm`; the same subtree stays in its existing page position at `sm+`. Do not add a second sticky/fixed phone header inside `#main-content`: the universal collapse row must own its safe area, focus pinning, timing, clipping, and measured release. Semantic content headings and modal/sheet headers are not viewport chrome and stay in their own flow/scroll context.
- **Document phone headers overlay as one stable stack.** Document detail/source routes keep the complete phone header at a stable height and translate the safe area plus both header rows and the section track together. Hidden overlay chrome is transparent and non-interactive; revealed chrome frosts and covers the document. `readChromeCollapseMetrics` counts zero released top-header geometry for this overlay, while continuing to measure the independently hidden document composer reserve. Reveal must not change the active owner's scroll offset or a stable document/PDF anchor.
- **Feed the reporter from the element that actually scrolls.** Both app hosts run `useDocumentScrollHideReporter` alongside their `<main>` reporter. In browser-mode phones the normal-flow shell and `overflow-y: visible` surface make the document the only vertical owner, which lets Safari minimize its browser UI. Installed standalone mode uses a normal-flow `100vh` shell plus bounded inner surface, so document scroll does not fire there. The hook measures the same collapse budget and blurs the same focused composer for either owner. Page-owned footer chrome must follow the same rule: `DocumentViewer` observes both the document and the inner surface, then combines the signals so only the active owner drives it. Its rendered footer, like calculator and differential page-owned footers, portals to the frame host so observing the inner scroll owner does not make the footer its descendant.
- **Keep browser-phone chrome attached to the viewport without fixing the app root.** Collapse-mode headers use one phone-sticky wrapper; answer overlay headers are fixed only in browser mode and remain absolute over the inner surface in standalone mode. Footer layers are likewise viewport-fixed in browser mode and shell-absolute in standalone. While either header or reserve transition changes document geometry, the corresponding transition marker disables anchoring on the active document/inner scroller so synthetic reverse scroll cannot cause a hide/reveal loop or reading-position jump.
- **Do not treat CSSOM bounds as physical iOS paint proof.** A fixed root can report perfect `getBoundingClientRect()` and hit-testing while WebKit leaves an app-external band. Keep browser/document and standalone/`100vh` static guards, then verify Safari and a freshly relaunched Home Screen app on a physical phone before merge. If iOS reports a web viewport shorter than `screen.height`, pixels outside that viewport are system-owned; keep the root canvas opaque and matching, but do not fake reachability with negative safe-area overscan.
- **Viewport stickiness belongs on the outer top-bar stack, not on `header#search`.** The top bar sits inside header-height boxes, which leaves a sticky rule on it zero travel. For the same reason the visible stack's ancestor in `GlobalSearchShell` is `display: contents` at every breakpoint rather than a block. The collapse result owns one phone-sticky wrapper (safe-area spacer + stack), while its `sm:` children retain the tablet/desktop offsets. At tablet and desktop widths the search portal leaves that outer stack holding only the top bar.
- **Collapse only the top-bar row inside the sticky stack.** Tablet and desktop page-flow search sit outside this stack entirely; the stack hides and reveals only the universal top bar.
- **Release the phone top inset with collapsing chrome.** For the default collapse motion, `chrome-safe-area-top` is a full-width sibling that is `h-[var(--safe-area-top)]` while the phone header is visible and `h-0` while hidden, using the same transition timing as the top-bar row. `readChromeCollapseMetrics` must charge that released phone height as well as the controls and dock reserve, or short pages clamp and oscillate at the bottom. The document overlay exception keeps this spacer inside the translated stack at a stable height and charges zero released top geometry. At `sm+` the spacer remains `h-[var(--safe-area-top)]`, and sticky chrome pins at `top: var(--safe-area-top)`. Do not leave a phone-only surface/status-bar band after collapsing controls hide.
- **One transition, no jump.** Phone page navigation belongs inside the universal 1fr → 0fr grid rather than running another scroll hook. The shared reporter may emit one hide on a deliberate descent and one reveal on deliberate upward intent; geometry must move monotonically through the 240ms hide / 200ms reveal and remain still at the bottom edge. Reduced motion removes the animation but not the complete edge release.
- **Do not sticky-position tablet or desktop result search.** The composer belongs to page flow at these widths; anchoring it overlays page controls (and blocks clicks) once the top bar collapses.
- **Tablet and desktop search are page-owned.** `desktop-page-search-composer-slot` is rendered at the top of normal shell/dashboard content and accepts the shared composer at `min-width: 640px`. The mode-home hero slot takes precedence. Never give the page composer, its slot, or an ancestor `fixed`/`sticky` positioning.
- **Rebase the reporter on geometry switches.** Pass `resetKey` when the host changes the scrollport under it (`ClinicalDashboard` passes `searchMode`, which swaps `<main>`'s header reserve); otherwise the carried-over offset spends the first post-switch scroll on a spurious hide or reveal. Shared mode-home shells should also reset on `pathname` so collapsed chrome/scroll offset does not carry across modes.
- **Do not carry composer focus into submitted result views.** Focus pins both chrome edges for keyboard safety. `GlobalSearchShell` must not pass `focus: true` with `run: true`, must gate `queryInputAutoFocus` on `!hasSubmittedModeSearch`, and both hosts must blur the dock input when the active result owner scrolls so hide-on-scroll can reclaim the header and bottom dock.

Coverage: `tests/header-scroll-hide-contract.test.ts` (wiring), `tests/use-hide-on-scroll.test.ts` (decision logic), `tests/ui-chrome-scroll.spec.ts` (tablet/desktop page-flow search plus top-bar hide/reveal), `tests/ui-phone-scroll.spec.ts` (shared shell header hide/reveal, per-mode top-edge release, collapse owner), `tests/ui-phone-scroll-routes.spec.ts` (per-route phone scroll sweep), `tests/ui-phone-scroll-page-owned.spec.ts` (document-viewer composer, standalone frame-owned footers, calculators dock, Services canvas) — the three share `tests/helpers/phone-scroll.ts`, and `tests/playwright-project-isolation.test.ts` asserts every sibling is collected by the required browser projects, `tests/ui-therapy-nav-scroll.spec.ts` (Therapy section nav hide/reveal with the top bar).

Run `npm run verify:phone-chrome` for phone-chrome work. For executable changes its classifier checks installed/lock parity first, runs focused static contracts and only the browser/PWA owners and route journeys implicated by the changed files, then escalates to `npm run verify:ui` automatically for shared chrome foundations. Documentation-only scopes run only documentation guards. Use `-- --dry-run` to inspect the plan, `-- --files <comma-separated paths>` for an explicit scope, and `-- --full=always|never` only for a deliberate override.

## Change checklist

Before changing search bar behaviour:

- Identify the page ownership row above.
- Confirm whether the page is using `GlobalSearchShell`, `ClinicalDashboard`, or `DocumentViewer` for the composer.
- Update the reserve helper and CSS token together when changing clearances.
- Add or update a focused static contract test for new constants or exceptions.
- For visual/scroll changes, run the relevant phone-scroll/overlap Playwright coverage through `npm run ensure` and `npm run verify:ui` when the environment supports the repo runtime.
- Complete [the physical iPhone checklist](phone-chrome-physical-acceptance.md) for shared safe-area/ownership changes; local Chromium cannot certify Safari or cold-launch PWA physical paint.
- For hide-on-scroll changes, re-read "Scroll hide/reveal" and prove the reveal at tablet and desktop, not just the hide.
- If a new route has a page-owned composer, document it here and add it to the route/search coverage rather than relying on comments in a component.
