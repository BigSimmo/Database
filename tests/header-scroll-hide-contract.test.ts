import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

/**
 * Static contract for the shared top-bar hide/reveal.
 *
 * The top bar (mode / new chat) hides on scroll down and returns on scroll up at
 * every breakpoint, while the search field stays pinned on tablets and belongs
 * to normal page flow on desktop. The bottom search dock stays phone-only. Getting that right depends on wiring no
 * runtime unit test can see: which scroll source feeds the reporter, whether
 * only `header#search` is inside the collapse row, and whether sticky hosts pin
 * an outer [top bar | search] stack instead of translating the search away.
 *
 * The Chromium proof lives in tests/ui-chrome-scroll.spec.ts; this file keeps
 * the cheap suite honest about the wiring that proof depends on.
 */

const read = (relativePath: string) => readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
const hookSource = read("src/components/clinical-dashboard/use-hide-on-scroll.ts");
const headerSource = read("src/components/clinical-dashboard/master-search-header.tsx");
const shellSource = read("src/components/clinical-dashboard/global-search-shell.tsx");
const dashboardSource = read("src/components/ClinicalDashboard.tsx");
const dashboardCoordinatorSource = read("src/components/clinical-dashboard/use-dashboard-chrome-coordinator.ts");
const activeScrollOwnerSource = read("src/components/clinical-dashboard/use-active-scroll-owner.ts");
const dashboardResultComposerSlotSource = read(
  "src/components/clinical-dashboard/dashboard-desktop-result-composer-slot.tsx",
);
const composerSlotSource = read("src/lib/mode-home-composer.ts");
const phoneHeaderPortalSource = read("src/components/clinical-dashboard/phone-header-collapse-portal.tsx");
const phoneFooterPortalSource = read("src/components/clinical-dashboard/phone-footer-layer-portal.tsx");
const therapyNavSource = read("src/components/therapy-compass/nav.tsx");
const documentViewerSource = read("src/components/DocumentViewer.tsx");
const calculatorSearchSource = read("src/components/calculators/search-page.tsx");
const documentViewerChromeHookSource = read("src/components/clinical-dashboard/use-document-viewer-chrome-scroll.ts");
const differentialDetailSource = read("src/components/differentials/differential-detail-page.tsx");
const differentialPresentationSource = read("src/components/differentials/differential-presentation-workflow-page.tsx");
const behaviourDocSource = read("docs/search-chrome-behaviour.md");

describe("shared header hide/reveal wiring", () => {
  it("widens both app shells past the phone media gate", () => {
    // Second argument is `allowAllBreakpoints`; leaving it off is what pinned
    // hide-on-scroll to phones.
    // GlobalSearchShell also passes pathname as resetKey so shared mode homes
    // do not inherit a collapsed top bar across routes.
    expect(shellSource).toContain("useScrollHideReporter(false, true, pathname)");
    expect(dashboardSource).toContain("useDashboardChromeCoordinator(searchMode)");
    expect(dashboardCoordinatorSource).toContain("useScrollHideReporter(false, true, resetKey)");
    expect(hookSource).toContain("export function useScrollHideReporter(disabled = false, allowAllBreakpoints = false");
  });

  it("feeds both app hosts from browser-phone document scrolling", () => {
    // Browser phones need document scrolling for Safari chrome collapse;
    // standalone phones retain their bounded main scroller.
    expect(hookSource).toContain("export function useDocumentScrollHideReporter");
    expect(shellSource).toContain(
      "useDocumentScrollHideReporter(chromeScrollHide.reportScroll, mainElement, inputRef)",
    );
    expect(dashboardCoordinatorSource).toContain(
      "useDocumentScrollHideReporter(chromeScrollHide.reportScroll, mainScrollRoot, composerInputRef)",
    );
  });

  it("feeds DocumentViewer footer chrome from both possible phone scroll owners", () => {
    expect(documentViewerChromeHookSource).toContain("const innerScrollHidden = useHideOnScroll");
    expect(documentViewerChromeHookSource).toContain("scrollContainer: shellScrollContainer");
    expect(documentViewerChromeHookSource).toContain("const documentScrollHidden = useHideOnScroll");
    expect(documentViewerChromeHookSource).toContain("documentCollapseRoot: shellScrollContainer");
    expect(documentViewerChromeHookSource).toContain("innerScrollHidden || documentScrollHidden");
  });

  it("holds DocumentViewer chrome open while either of its sheets is showing", () => {
    // A sheet is not chrome, but hiding the header and composer underneath one
    // releases both edges while an overlay still covers the document.
    expect(documentViewerSource).toContain("mobileActionsOpen || sectionSheetOpen");
  });

  it("drops the DocumentViewer rail offset when the universal top bar hides", () => {
    // Otherwise a dead band the height of the hidden bar stays above the rail.
    // When the universal bar is hidden, the rail still clears the page-owned
    // sticky document header on sm+.
    expect(read("src/components/document-viewer/document-rail-panels.tsx")).toContain(
      'headerHidden ? "lg:top-[var(--document-sticky-header-height,0px)]" : "lg:top-[69px]"',
    );
    expect(read("src/components/document-viewer/use-document-chrome-metrics.ts")).toContain(
      'data-testid="universal-header-collapse"',
    );
    expect(documentViewerSource).toContain("data-document-sticky-header");
  });

  it("measures section anchor offsets from the live collapse row", () => {
    // A fixed scroll-mt strands headings whenever the row is a different height
    // or hidden entirely.
    expect(documentViewerSource).not.toContain("scroll-mt-24");
    expect(documentViewerSource).toContain("scroll-mt-[var(--document-anchor-offset,6rem)]");
    const chromeMetricsSource = read("src/components/document-viewer/use-document-chrome-metrics.ts");
    expect(chromeMetricsSource).toContain("--document-anchor-offset");
    expect(chromeMetricsSource).toContain("data-document-sticky-header");
    expect(chromeMetricsSource).toContain('"(max-width: 639px)"');
  });

  it("picks the hide mechanism from where each host's scrollport lives", () => {
    // GlobalSearchShell hands scrolling back to the document above phones, so
    // the outer stack sticks while only the top-bar row collapses.
    expect(shellSource).toContain('strategy: "collapse"');
    expect(shellSource).toContain('phoneMotion: isDocumentViewerOwnedRoute(pathname) ? "overlay" : "collapse"');
    expect(shellSource).toContain('wide: "sticky"');
    // ClinicalDashboard uses the document on browser phones and <main> in
    // standalone/sm+; both feed the same collapse reporter.
    expect(dashboardSource).toContain('{ strategy: "collapse", wide: "collapse"');
    expect(headerSource).toContain('className="phone-sticky-header-stack sm:contents"');
    expect(headerSource).toContain('"phone-overlay-header sm:absolute sm:inset-x-0 sm:top-0"');
    expect(shellSource).toContain('data-chrome-transitioning={chromeTransitioning ? "true" : undefined}');
    expect(dashboardSource).toContain('data-chrome-transitioning={chromeTransitioning ? "true" : undefined}');
  });

  it("uses overlay phone motion only for document-viewer-owned routes", () => {
    expect(headerSource).toContain('phoneMotion?: "collapse" | "overlay"');
    expect(headerSource).toContain('const phoneMotion = hideOnScroll?.phoneMotion ?? "collapse"');
    expect(headerSource).toContain('hideStrategy === "collapse" && phoneMotion === "overlay"');
    expect(shellSource).toContain("isDocumentViewerOwnedRoute");
    expect(shellSource).toContain('phoneMotion: isDocumentViewerOwnedRoute(pathname) ? "overlay" : "collapse"');
    expect(dashboardSource).not.toContain("phoneMotion:");
    expect(headerSource).toContain("data-phone-motion={phoneMotion}");
    expect(headerSource).toContain("max-sm:pointer-events-none max-sm:-translate-y-full max-sm:opacity-0");
    expect(behaviourDocSource).toContain("`/documents/search` and every non-document route keep the default");
  });

  it("moves submitted search composers into normal page flow on desktop only", () => {
    expect(composerSlotSource).toContain(
      'export const desktopPageComposerSlotId = "desktop-page-search-composer-slot"',
    );
    expect(headerSource).toContain('const desktopPageComposerMediaQuery = "(min-width: 1024px)"');
    expect(headerSource).toContain("desktopHomeComposerSlotId ?? desktopPageComposerSlotId");
    expect(headerSource).toContain('placement: "default" | "desktop-home" | "desktop-page"');
    expect(headerSource).toContain("data-composer-placement={placement}");
    expect(headerSource).toContain(
      '"document-mobile-search-edge universal-top-search-edge relative z-20 mx-auto w-full max-w-3xl px-4 py-3 lg:max-w-4xl"',
    );
    expect(shellSource).toContain('data-testid="desktop-page-search-composer-slot"');
    expect(shellSource).toContain('className="hidden lg:block lg:empty:hidden"');
    // Dashboard result slot lives in a budget-extracted helper so ClinicalDashboard
    // stays under the maintainability no-growth ceiling.
    expect(dashboardSource).toContain("DashboardDesktopResultComposerSlot");
    expect(dashboardResultComposerSlotSource).toContain('data-testid="desktop-page-search-composer-slot"');
    expect(dashboardResultComposerSlotSource).toContain('className="hidden lg:block lg:empty:hidden"');
    expect(behaviourDocSource).toContain("Desktop search is page-owned");
  });

  it("collapses only the top bar and keeps the search composer outside that row", () => {
    // Wrapping headerAndComposer (top bar + search) is what made tablet/desktop
    // search disappear with the mode bar.
    expect(headerSource).toContain("const collapsingTopBar = (");
    expect(headerSource).toContain("{topBar}");
    expect(headerSource).toContain("{searchComposer}");
    expect(headerSource).not.toContain("{headerAndComposer}");
    // The collapse testid must sit on the top-bar wrapper, not a joint stack.
    const collapseIdx = headerSource.indexOf('data-testid="universal-header-collapse"');
    const topBarCloseIdx = headerSource.indexOf("{topBar}", collapseIdx);
    const addonIdx = headerSource.indexOf('data-testid="header-collapse-addon"', topBarCloseIdx);
    const composerIdx = headerSource.indexOf("{searchComposer}", collapseIdx);
    expect(collapseIdx).toBeGreaterThan(-1);
    expect(topBarCloseIdx).toBeGreaterThan(collapseIdx);
    // Page-owned phone navigation may sit after the top bar inside the
    // collapse row; the search composer must stay outside it.
    expect(addonIdx).toBeGreaterThan(topBarCloseIdx);
    expect(composerIdx).toBeGreaterThan(addonIdx);
  });

  it("provides one generic collapse host for every production phone header", () => {
    expect(composerSlotSource).toContain(
      'export const phoneHeaderCollapseAddonSlotId = "phone-header-collapse-addon-slot"',
    );
    expect(headerSource).toContain("phoneHeaderCollapseAddonSlotId");
    expect(headerSource).toContain("phoneHeaderCollapseAddonHost");
    expect(headerSource).toContain("setPhoneHeaderCollapseAddonRef");
    expect(headerSource).toContain("document.activeElement");
    expect(headerSource).toContain("new MutationObserver(clearIfFocusLeftHost)");
    expect(headerSource).toContain("queueMicrotask(clearHeaderFocus)");
    expect(headerSource).toContain('addonHost.addEventListener("focusin", handleFocusIn)');
    expect(headerSource).toContain('addonHost.addEventListener("focusout", handleFocusOut)');
    expect(headerSource).not.toContain("headerCollapseAddonSlotId?: string");
    expect(headerSource).toContain('data-testid="header-collapse-addon"');
    expect(headerSource).toContain('className="w-full min-w-0 max-w-full empty:hidden"');
    expect(headerSource).toContain(
      '"w-full min-w-0 max-w-full max-sm:flex max-sm:min-h-0 max-sm:flex-col max-sm:justify-end"',
    );
    // Addon host must be declared inside collapsingTopBar, not beside search.
    const collapseIdx = headerSource.indexOf('data-testid="universal-header-collapse"');
    const addonHostIdx = headerSource.indexOf('data-testid="header-collapse-addon"', collapseIdx);
    const collapsingClose = headerSource.indexOf("if (sticksAbovePhones)", collapseIdx);
    expect(addonHostIdx).toBeGreaterThan(collapseIdx);
    expect(addonHostIdx).toBeLessThan(collapsingClose);

    // One subtree is moved before paint on phones; sm+ and missing-host
    // fallbacks remain in normal flow. The observer survives shell remounts;
    // the tracked real DOM addon host owns portaled focus forwarding and
    // observes focused-child removal above.
    expect(phoneHeaderPortalSource).toContain("useLayoutEffect");
    expect(phoneHeaderPortalSource).toContain("createPortal(children, phoneHost)");
    expect(phoneHeaderPortalSource).toContain("phoneHeaderCollapseAddonSlotId");
    expect(phoneHeaderPortalSource).toContain('window.matchMedia("(max-width: 639px)")');
    expect(phoneHeaderPortalSource).toContain("new MutationObserver(sync)");

    expect(therapyNavSource).toContain("<PhoneHeaderCollapsePortal>");
    expect(documentViewerSource).toContain("<PhoneHeaderCollapsePortal>");
    expect(documentViewerSource).toContain("data-document-sticky-header");
    expect(documentViewerSource).toContain("edge-glass-header");
    expect(documentViewerSource).toContain("max-sm:pt-2");
    expect(differentialDetailSource).toContain("<PhoneHeaderCollapsePortal>");
    expect(differentialDetailSource).toContain('data-testid="differential-detail-header"');
    expect(differentialDetailSource).toContain("max-sm:static sm:sticky sm:top-0");
  });

  it("gives the sticky chrome stack real travel against the viewport", () => {
    // A plain block around the stack is a containing block that leaves sticky
    // nowhere to stick. `contents` removes that box on GlobalSearchShell.
    expect(shellSource).toContain('className={mobileChromeVisible ? "contents" : "hidden lg:contents"}');
    expect(shellSource).not.toContain('mobileChromeVisible ? undefined : "hidden lg:block"');
    // Sticky pins the outer [top bar | search] stack below the wide-layout
    // safe-area spacer. Translating that whole stack would take the search
    // field off-screen. Overlay hosts still use max-sm:-translate-y-full —
    // strip that before asserting sticky collapse does not revive the sm:
    // translate path.
    expect(headerSource).toContain('data-testid="chrome-safe-area-top"');
    expect(headerSource.split('"phone-sticky-header-stack sm:contents"').length - 1).toBe(2);
    expect(headerSource).toContain('className="sm:sticky sm:top-[var(--safe-area-top)] sm:z-30"');
    expect(headerSource.replaceAll("max-sm:-translate-y-full", "")).not.toContain("sm:-translate-y-full");
    expect(headerSource).not.toContain('sticksAbovePhones && headerChromeHidden && "sm:-translate-y-full"');
  });

  it("uses one adaptive phone footer positioning owner", () => {
    expect(headerSource).toContain("phone-footer-layer");
    expect(documentViewerSource).toContain("phone-footer-layer document-viewer-composer");
    expect(calculatorSearchSource).toContain("phone-footer-layer answer-footer-search-dock");
  });

  it("exposes one stable diagnostic contract across each phone chrome owner", () => {
    for (const source of [shellSource, dashboardSource, documentViewerSource]) {
      expect(source).toContain("data-phone-scroll-owner");
      expect(source).toContain("data-phone-footer-owner");
      expect(source).toContain("data-phone-composer-reserve");
      expect(source).toContain("data-phone-chrome-transition");
    }
    expect(dashboardCoordinatorSource).toContain("useActiveScrollOwner(mainScrollRoot, resetKey)");
    expect(activeScrollOwnerSource).toContain('export type ActiveScrollOwner = "pending" | "main" | "document"');
    expect(activeScrollOwnerSource).toContain('window.matchMedia("(display-mode: standalone)")');
    expect(activeScrollOwnerSource).toContain("new ResizeObserver(update)");
    expect(activeScrollOwnerSource).toContain("new MutationObserver(update)");
  });

  it("portals every page-owned phone footer beside the standalone scroller", () => {
    expect(phoneFooterPortalSource).toContain("PhoneFooterLayerContext");
    expect(phoneFooterPortalSource).toContain('className="phone-footer-layer-host contents"');
    expect(phoneFooterPortalSource).toContain('data-testid="phone-footer-layer-host"');
    expect(phoneFooterPortalSource).toMatch(/\{children\}[\s\S]*phone-footer-layer-host/);
    expect(phoneFooterPortalSource).toContain("isPhone && host ? createPortal(children, host) : children");
    expect(phoneFooterPortalSource).toContain('window.matchMedia("(max-width: 639px)")');

    expect(phoneFooterPortalSource).toContain("export function PhoneFooterLayerFrame");
    expect(shellSource).toContain("<PhoneFooterLayerFrame");
    expect(dashboardSource).toContain("<PhoneFooterLayerFrame");
    expect(calculatorSearchSource).toContain("<PhoneFooterLayerPortal>");
    expect(documentViewerSource).toContain("<PhoneFooterLayerPortal>");
    expect(differentialPresentationSource).toContain("<PhoneFooterLayerPortal>");
    expect(differentialPresentationSource).toContain('data-testid="differential-presentation-phone-footer"');
  });

  it("shares the frame's authoritative scroll decision with the calculator footer", () => {
    expect(phoneFooterPortalSource).toContain("export function usePhoneFooterLayerScrollHidden");
    expect(shellSource).toContain("scrollHidden={chromeScrollHide.hidden}");
    expect(dashboardSource).toContain("scrollHidden={chromeScrollHidden}");
    expect(calculatorSearchSource).toContain("const frameScrollHidden = usePhoneFooterLayerScrollHidden()");
    expect(calculatorSearchSource).toContain(
      "const footerHidden = frameScrollHidden ?? (innerFooterHidden || documentFooterHidden)",
    );
  });

  it("releases the phone top safe-area with hidden chrome while retaining the wide inset", () => {
    // A fixed phone safe-area sibling survives the 0fr header collapse as an
    // opaque band. It must share the hidden state, while sm+ sticky chrome keeps
    // its safe-area offset independently.
    expect(headerSource).toContain('data-testid="chrome-safe-area-top"');
    expect(headerSource).toMatch(/headerChromeHidden\s*\?\s*"max-sm:h-0/);
    expect(headerSource).toMatch(/:\s*"max-sm:h-\[var\(--safe-area-top\)\]/);
    expect(headerSource).toContain("sm:h-[var(--safe-area-top)]");
    expect(headerSource).toContain("max-sm:transition-[height]");
    expect(headerSource).toContain('hideStrategy === "collapse" ? "pt-2" : "pt-[max(0.5rem,var(--safe-area-top))]"');
    expect(behaviourDocSource).toContain("`h-0` while hidden");
  });

  it("keeps the header out of sticky positioning wherever its row collapses", () => {
    // Sticky pins the bar inside the viewport and fights the 1fr -> 0fr grid.
    expect(headerSource).toMatch(/sticksAbovePhones \|\| collapsesAtEveryWidth\s*\?\s*"relative"/);
  });

  it("counts the collapse budget only where the wrapper really collapses", () => {
    // Sticky hosts now collapse only the top-bar row (still `display: grid`), so
    // the budget correctly charges that height; non-grid wrappers stay at 0.
    expect(hookSource).toContain('window.getComputedStyle(collapse).display === "grid"');
    expect(hookSource).toContain('collapse.dataset.phoneMotion === "overlay"');
    expect(hookSource).toContain("!phoneOverlayMotion");
    expect(hookSource).toContain('collapseKind: headerRelease > 0 ? "in-flow"');
    expect(hookSource).toContain("document.querySelector('[data-testid=\"chrome-safe-area-top\"]')");
    expect(hookSource).toContain("window.matchMedia(phoneMediaQuery).matches");
    expect(hookSource).toContain("headerRelease + phoneSafeAreaRelease + reserveRelease");
  });

  it("only blurs the focused dock input for explicit outside scroll intent", () => {
    expect(hookSource).toContain('window.addEventListener("wheel", releaseComposerFocusOnOutsideScrollIntent');
    expect(hookSource).toContain('window.addEventListener("touchmove", releaseComposerFocusOnOutsideScrollIntent');
    expect(hookSource).toContain('window.addEventListener("pointerdown", releaseComposerFocusOnOutsideScrollIntent');
    expect(hookSource).toContain('window.addEventListener("keydown", releaseComposerFocusOnKeyboardScrollIntent');
    expect(hookSource).toContain('const composer = input.closest("form")');
    expect(hookSource).toContain('event.key !== "PageDown" && event.key !== "PageUp"');
    expect(hookSource).not.toMatch(/const offset = window\.scrollY;[\s\S]{0,300}?\.blur\(\)/);
  });

  it("rebases the reporter when a host swaps its scroll geometry", () => {
    // ClinicalDashboard toggling answer mode adds/removes <main>'s header
    // reserve; a carried-over offset spends the first post-switch scroll on a
    // spurious hide or reveal.
    expect(hookSource).toContain("}, [allowAllBreakpoints, resetKey]);");
  });

  it("holds transition anchoring through the final CSS frame", () => {
    expect(hookSource).toContain("reserveTransitionMs + reserveTransitionSettleMs");
  });

  it("keeps the bottom search dock a phone-only behaviour", () => {
    // The user-visible contract: the top bar hides everywhere, the footer
    // search bar hides on phones only. Both gates below require the phone layout.
    expect(headerSource).toContain(
      "const bottomComposerScrollHiddenActive = Boolean(hideOnScroll && phoneBottomSearchDockActive);",
    );
    expect(headerSource).toMatch(/const phoneBottomSearchDockActive =\s*\n\s*usesPhoneSearchLayout &&/);
    expect(headerSource).toContain("const usesPhoneFooterDock = usesBottomComposerPlacement && usesPhoneSearchLayout;");
  });

  it("documents tablet pinning and desktop page ownership independently from the top bar", () => {
    expect(behaviourDocSource).toContain("Hide the top bar, not the search field");
    expect(behaviourDocSource).toContain("Top-bar hide/reveal is cross-breakpoint");
    expect(behaviourDocSource).toContain("Every production phone navigation header has one collapse owner");
    expect(behaviourDocSource).toContain("One transition, no jump");
    expect(behaviourDocSource).toContain("Do not double-sticky tablet search inside an outer sticky stack");
    expect(behaviourDocSource).toContain("desktop-page-search-composer-slot");
    expect(behaviourDocSource).toContain("Release the phone top inset with collapsing chrome");
    expect(behaviourDocSource).toContain(
      "Collapse-everywhere hosts still drop their own sticky search offset while the top bar is hidden",
    );
  });

  it("does not carry dock focus into GlobalSearchShell submitted result views", () => {
    // focus=1 + run=1 left the Forms/services dock focused, which pins both
    // chrome edges and freezes hide-on-scroll with the bottom white rail visible.
    expect(shellSource).toContain("focus: !trimmedQuery");
    expect(shellSource).toContain("queryInputAutoFocus={requestedFocus && !hasSubmittedModeSearch}");
    expect(shellSource).toContain("if (hasSubmittedModeSearch)");
    expect(shellSource).not.toContain("target.scrollTop > 8 && inputRef.current");
    expect(hookSource).toContain("releaseComposerFocusOnOutsideScrollIntent");
    expect(behaviourDocSource).toContain("Do not carry composer focus into submitted result views");
  });

  it("keeps sticky-stack search in normal flow and only self-stickies collapse-everywhere hosts", () => {
    // Double sticky (outer stack + composer top offset) overlays page controls
    // once the top bar collapses — that blocked the services decision rail.
    expect(headerSource).toContain("const stickySearchOwnedByOuterStack = sticksAbovePhones");
    // Bare `fixed` must not remain on sticky-stack composers (cascade fight).
    expect(headerSource).toMatch(/stickySearchOwnedByOuterStack\s*\?\s*"relative"/);
    expect(headerSource).toMatch(/stickySearchOwnedByOuterStack\s*\?\s*"relative"\s*:\s*cn\("fixed"/);
    expect(headerSource).toContain('stickySearchOwnedByOuterStack ? "relative z-20" : cn("sticky z-20"');
    // Dashboard collapse-everywhere composers still drop the 4.75rem clearance.
    expect(headerSource).toContain("const stickySearchClearsTopBar");
    expect(headerSource).toContain('hideStrategy === "collapse" && headerChromeHidden');
    expect(headerSource).toContain('"top-0 sm:top-0"');
  });
});
