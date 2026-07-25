import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

/**
 * Static contract for the shared header hide/reveal.
 *
 * The header hides on scroll down and returns on scroll up at every breakpoint,
 * while the bottom search dock stays a phone-only behaviour. Getting that right
 * depends on three things no runtime unit test can see: which scroll source
 * feeds the reporter at each width, whether the chrome collapses its layout row
 * or sticks and translates, and whether the sticky wrapper actually has any
 * travel against the viewport. Each was individually wrong at some point while
 * the desktop header "only came back at the top of the page".
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
    // releasing the header's flow row there would jump the page mid-scroll.
    expect(shellSource).toContain('hideOnScroll={{ strategy: "collapse", wide: "sticky"');
    // ClinicalDashboard's <main> is the scrollport at every width (the shell is
    // dvh-tall and overflow-hidden), so the released strip goes to the content.
    expect(dashboardSource).toContain('{ strategy: "collapse", wide: "collapse"');
  });

  it("gives the sticky chrome wrapper real travel against the viewport", () => {
    // A plain block here is a header-height containing block, which leaves the
    // wrapper's sticky rule nowhere to stick: the bar scrolled off with the
    // page and only reappeared at scroll top. `contents` removes that box.
    expect(shellSource).toContain('className={mobileChromeVisible ? "sm:contents" : "hidden lg:contents"}');
    expect(shellSource).not.toContain('mobileChromeVisible ? undefined : "hidden lg:block"');
    expect(headerSource).toContain("sm:sticky sm:top-0 sm:z-30 sm:transition-transform");
  });

  it("transforms the sticky wrapper only while the chrome is hidden", () => {
    // A standing transform would make the wrapper the containing block for the
    // fixed-position menus and composers rendered inside it.
    expect(headerSource).toContain('sticksAbovePhones && headerChromeHidden && "sm:-translate-y-full"');
  });

  it("keeps the header out of sticky positioning wherever its row collapses", () => {
    // Sticky pins the bar inside the viewport and fights the 1fr -> 0fr grid.
    expect(headerSource).toContain('sticksAbovePhones || collapsesAtEveryWidth\n              ? "relative"');
  });

  it("counts the collapse budget only where the wrapper really collapses", () => {
    // Chrome that sticks and translates releases no layout, so charging the
    // header's height against the scroll runway would suppress valid hides.
    expect(hookSource).toContain('window.getComputedStyle(collapse).display === "grid"');
  });

  it("rebases the reporter when a host swaps its scroll geometry", () => {
    // ClinicalDashboard toggling answer mode adds/removes <main>'s header
    // reserve; a carried-over offset spends the first post-switch scroll on a
    // spurious hide or reveal.
    expect(hookSource).toContain("}, [allowAllBreakpoints, resetKey]);");
  });

  it("keeps the bottom search dock a phone-only behaviour", () => {
    // The user-visible contract: the header hides everywhere, the footer search
    // bar hides on phones only. Both gates below require the phone layout.
    expect(headerSource).toContain(
      "const bottomComposerScrollHiddenActive = Boolean(hideOnScroll && phoneBottomSearchDockActive);",
    );
    expect(headerSource).toMatch(/const phoneBottomSearchDockActive =\s*\n\s*usesPhoneSearchLayout &&/);
    expect(headerSource).toContain("const usesPhoneFooterDock = usesBottomComposerPlacement && usesPhoneSearchLayout;");
  });

  it("documents the cross-breakpoint behaviour alongside the code", () => {
    expect(behaviourDocSource).toContain("Header hide/reveal is cross-breakpoint");
  });
});
