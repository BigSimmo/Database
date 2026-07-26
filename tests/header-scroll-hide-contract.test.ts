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
const dashboardResultComposerSlotSource = read(
  "src/components/clinical-dashboard/dashboard-desktop-result-composer-slot.tsx",
);
const composerSlotSource = read("src/lib/mode-home-composer.ts");
const phoneHeaderPortalSource = read("src/components/clinical-dashboard/phone-header-collapse-portal.tsx");
const therapyNavSource = read("src/components/therapy-compass/nav.tsx");
const documentViewerSource = read("src/components/DocumentViewer.tsx");
const differentialDetailSource = read("src/components/differentials/differential-detail-page.tsx");
const behaviourDocSource = read("docs/search-chrome-behaviour.md");

describe("shared header hide/reveal wiring", () => {
  it("widens both app shells past the phone media gate", () => {
    // Second argument is `allowAllBreakpoints`; leaving it off is what pinned
    // hide-on-scroll to phones.
    // GlobalSearchShell also passes pathname as resetKey so shared mode homes
    // do not inherit a collapsed top bar across routes.
    expect(shellSource).toContain("useScrollHideReporter(false, true, pathname)");
    expect(dashboardSource).toContain("useScrollHideReporter(false, true, searchMode)");
    expect(hookSource).toContain("export function useScrollHideReporter(disabled = false, allowAllBreakpoints = false");
  });

  it("feeds GlobalSearchShell the document scroll it uses above the phone breakpoint", () => {
    // #main-content is the scrollport only on phones there, so its React
    // onScroll never fires on tablet/desktop and the chrome could never hide.
    expect(hookSource).toContain("export function useDocumentScrollHideReporter");
    expect(shellSource).toContain("useDocumentScrollHideReporter(chromeScrollHide.reportScroll)");
  });

  it("picks the hide mechanism from where each host's scrollport lives", () => {
    // GlobalSearchShell hands scrolling back to the document above phones, so
    // the outer stack sticks while only the top-bar row collapses.
    expect(shellSource).toContain('hideOnScroll={{ strategy: "collapse", wide: "sticky"');
    // ClinicalDashboard's <main> is the scrollport at every width (the shell is
    // dvh-tall and overflow-hidden), so the released top-bar strip goes to the
    // content.
    expect(dashboardSource).toContain('{ strategy: "collapse", wide: "collapse"');
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
    // fallbacks remain in normal flow. The observer survives shell remounts.
    expect(phoneHeaderPortalSource).toContain("useLayoutEffect");
    expect(phoneHeaderPortalSource).toContain("createPortal(children, phoneHost)");
    expect(phoneHeaderPortalSource).toContain("phoneHeaderCollapseAddonSlotId");
    expect(phoneHeaderPortalSource).toContain('window.matchMedia("(max-width: 639px)")');
    expect(phoneHeaderPortalSource).toContain("new MutationObserver(sync)");

    expect(therapyNavSource).toContain("<PhoneHeaderCollapsePortal>");
    expect(documentViewerSource).toContain("<PhoneHeaderCollapsePortal>");
    expect(documentViewerSource).toContain('<header className="edge-glass-header');
    expect(documentViewerSource).toContain("max-sm:pt-2");
    expect(differentialDetailSource).toContain("<PhoneHeaderCollapsePortal>");
    expect(differentialDetailSource).toContain('data-testid="differential-detail-header"');
    expect(differentialDetailSource).toContain("max-sm:static sm:sticky sm:top-0");
  });

  it("gives the sticky chrome stack real travel against the viewport", () => {
    // A plain block around the stack is a containing block that leaves sticky
    // nowhere to stick. `contents` removes that box on GlobalSearchShell.
    expect(shellSource).toContain('className={mobileChromeVisible ? "sm:contents" : "hidden lg:contents"}');
    expect(shellSource).not.toContain('mobileChromeVisible ? undefined : "hidden lg:block"');
    // Sticky pins the outer [top bar | search] stack below the wide-layout
    // safe-area spacer. Translating that whole stack would take the search
    // field off-screen. Overlay hosts still use max-sm:-translate-y-full —
    // strip that before asserting sticky collapse does not revive the sm:
    // translate path.
    expect(headerSource).toContain('data-testid="chrome-safe-area-top"');
    expect(headerSource).toContain('className="sm:sticky sm:top-[var(--safe-area-top)] sm:z-30"');
    expect(headerSource.replaceAll("max-sm:-translate-y-full", "")).not.toContain("sm:-translate-y-full");
    expect(headerSource).not.toContain('sticksAbovePhones && headerChromeHidden && "sm:-translate-y-full"');
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
    expect(hookSource).toContain("document.querySelector('[data-testid=\"chrome-safe-area-top\"]')");
    expect(hookSource).toContain("window.matchMedia(phoneMediaQuery).matches");
    expect(hookSource).toContain("headerRelease + phoneSafeAreaRelease + reserveRelease");
  });

  it("rebases the reporter when a host swaps its scroll geometry", () => {
    // ClinicalDashboard toggling answer mode adds/removes <main>'s header
    // reserve; a carried-over offset spends the first post-switch scroll on a
    // spurious hide or reveal.
    expect(hookSource).toContain("}, [allowAllBreakpoints, resetKey]);");
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
    expect(behaviourDocSource).toContain("Release the phone top inset with hidden chrome");
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
    expect(shellSource).toContain(
      "if (target.scrollTop > 8 && inputRef.current && document.activeElement === inputRef.current)",
    );
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
