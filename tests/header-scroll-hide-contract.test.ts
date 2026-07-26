import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

/**
 * Static contract for the shared top-bar hide/reveal.
 *
 * The top bar (mode / new chat) hides on scroll down and returns on scroll up at
 * every breakpoint, while the search field stays on tablet/desktop and the
 * bottom search dock stays phone-only. Getting that right depends on wiring no
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
    const addonIdx = headerSource.indexOf("headerCollapseAddonSlotId", topBarCloseIdx);
    const composerIdx = headerSource.indexOf("{searchComposer}", collapseIdx);
    expect(collapseIdx).toBeGreaterThan(-1);
    expect(topBarCloseIdx).toBeGreaterThan(collapseIdx);
    // Optional page chrome (Therapy section nav) may sit after the top bar
    // inside the collapse row; the search composer must stay outside it.
    expect(addonIdx).toBeGreaterThan(topBarCloseIdx);
    expect(composerIdx).toBeGreaterThan(addonIdx);
  });

  it("hosts Therapy section nav inside the collapse row on non-home therapy routes", () => {
    expect(shellSource).toContain("therapyHeaderCollapseAddonSlotId");
    expect(shellSource).toContain('pathname.startsWith("/therapy-compass") && pathname !== "/therapy-compass"');
    expect(headerSource).toContain('data-testid="header-collapse-addon"');
    // Addon host must be declared inside collapsingTopBar, not beside search.
    const collapseIdx = headerSource.indexOf('data-testid="universal-header-collapse"');
    const addonHostIdx = headerSource.indexOf('data-testid="header-collapse-addon"', collapseIdx);
    const collapsingClose = headerSource.indexOf("if (sticksAbovePhones)", collapseIdx);
    expect(addonHostIdx).toBeGreaterThan(collapseIdx);
    expect(addonHostIdx).toBeLessThan(collapsingClose);
  });

  it("gives the sticky chrome stack real travel against the viewport", () => {
    // A plain block around the stack is a containing block that leaves sticky
    // nowhere to stick. `contents` removes that box on GlobalSearchShell.
    expect(shellSource).toContain('className={mobileChromeVisible ? "sm:contents" : "hidden lg:contents"}');
    expect(shellSource).not.toContain('mobileChromeVisible ? undefined : "hidden lg:block"');
    // Sticky pins the outer [top bar | search] stack below the always-on
    // safe-area spacer. Translating that whole stack would take the search
    // field off-screen. Overlay hosts still use max-sm:-translate-y-full —
    // strip that before asserting sticky collapse does not revive the sm:
    // translate path.
    expect(headerSource).toContain('data-testid="chrome-safe-area-top"');
    expect(headerSource).toContain('className="sm:sticky sm:top-[var(--safe-area-top)] sm:z-30"');
    expect(headerSource.replaceAll("max-sm:-translate-y-full", "")).not.toContain("sm:-translate-y-full");
    expect(headerSource).not.toContain('sticksAbovePhones && headerChromeHidden && "sm:-translate-y-full"');
  });

  it("keeps the OS top safe-area outside the collapse hide", () => {
    // Releasing the status-bar inset with the chrome lets scrolled text paint
    // under the system clock/signal icons on notched phones (service detail).
    expect(headerSource).toContain('data-testid="chrome-safe-area-top"');
    expect(headerSource).toContain("h-[var(--safe-area-top)]");
    expect(headerSource).toContain("relative z-[32] h-[var(--safe-area-top)]");
    expect(headerSource).toContain('hideStrategy === "collapse" ? "pt-2" : "pt-[max(0.5rem,var(--safe-area-top))]"');
    expect(behaviourDocSource).toContain("OS top safe-area band");
  });

  it("keeps the header out of sticky positioning wherever its row collapses", () => {
    // Sticky pins the bar inside the viewport and fights the 1fr -> 0fr grid.
    expect(headerSource).toMatch(/sticksAbovePhones \|\| collapsesAtEveryWidth\s*\?\s*"relative"/);
  });

  it("counts the collapse budget only where the wrapper really collapses", () => {
    // Sticky hosts now collapse only the top-bar row (still `display: grid`), so
    // the budget correctly charges that height; non-grid wrappers stay at 0.
    expect(hookSource).toContain('window.getComputedStyle(collapse).display === "grid"');
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

  it("documents that tablet/desktop search stays while the top bar hides", () => {
    expect(behaviourDocSource).toContain("Hide the top bar, not the search field, above phones");
    expect(behaviourDocSource).toContain("Top-bar hide/reveal is cross-breakpoint");
    expect(behaviourDocSource).toContain("Page chrome that must match the top bar portals into the collapse host");
    expect(behaviourDocSource).toContain("Do not double-sticky the search inside an outer sticky stack");
    expect(behaviourDocSource).toContain("Pinned search can cover wide side rails");
    expect(behaviourDocSource).toContain("Keep `chrome-safe-area-top` outside the hide mechanism");
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
    expect(headerSource).toContain(
      'stickySearchOwnedByOuterStack\n                            ? "relative"\n                            : cn("fixed"',
    );
    expect(headerSource).toContain('stickySearchOwnedByOuterStack ? "relative z-20" : cn("sticky z-20"');
    // Dashboard collapse-everywhere composers still drop the 4.75rem clearance.
    expect(headerSource).toContain("const stickySearchClearsTopBar");
    expect(headerSource).toContain('hideStrategy === "collapse" && headerChromeHidden');
    expect(headerSource).toContain('"top-0 sm:top-0"');
  });
});
