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
    expect(shellSource).toContain("useScrollHideReporter(false, true)");
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
    const composerIdx = headerSource.indexOf("{searchComposer}", collapseIdx);
    expect(collapseIdx).toBeGreaterThan(-1);
    expect(topBarCloseIdx).toBeGreaterThan(collapseIdx);
    expect(composerIdx).toBeGreaterThan(topBarCloseIdx);
  });

  it("gives the sticky chrome stack real travel against the viewport", () => {
    // A plain block around the stack is a containing block that leaves sticky
    // nowhere to stick. `contents` removes that box on GlobalSearchShell.
    expect(shellSource).toContain('className={mobileChromeVisible ? "sm:contents" : "hidden lg:contents"}');
    expect(shellSource).not.toContain('mobileChromeVisible ? undefined : "hidden lg:block"');
    // Sticky pins the outer [top bar | search] stack; translating that whole
    // stack would take the search field off-screen.
    expect(headerSource).toContain('className="sm:sticky sm:top-0 sm:z-30"');
    expect(headerSource).not.toContain("sm:-translate-y-full");
  });

  it("keeps the header out of sticky positioning wherever its row collapses", () => {
    // Sticky pins the bar inside the viewport and fights the 1fr -> 0fr grid.
    expect(headerSource).toContain('sticksAbovePhones || collapsesAtEveryWidth\n              ? "relative"');
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
  });
});
