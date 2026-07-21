import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

// A11Y-FOCUS-01 (WCAG 2.4.11 — focus not obscured). On phones the composer docks
// over the #main-content scrollport, so the scroll container must reserve
// scroll-padding-bottom = the dock height; otherwise the browser scrolls a
// below-fold Tab target to rest underneath the fixed dock. This reservation only
// renders in specific app states (answer-with-content, and every non-answer view)
// that are impractical to reach deterministically in a browser test, so it is
// pinned at the source instead — the repo's established pattern for phone
// scroll-geometry invariants (see mobile-interaction-regressions.test.ts). The
// reduced-motion scroll behaviour (ANIM-01) is covered live in ui-accessibility.spec.ts.

function source(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

// Extract the <main id="main-content"> opening tag, so every assertion binds to
// the real scrollport rather than to source-wide occurrences — a class that
// silently drifts onto a child or a non-scrolling wrapper must fail the guard.
// The className holds a `>` inside a comment ("<main> reserves…"), so we cannot
// stop at the first `>`; the JSX opening tag ends at the first line whose only
// non-space content is `>`.
function mainContentOpeningTag(dashboardSource: string): string {
  const idIndex = dashboardSource.indexOf('id="main-content"');
  if (idIndex < 0) return "";
  const openIndex = dashboardSource.lastIndexOf("<main", idIndex);
  if (openIndex < 0) return "";
  const closeOffset = dashboardSource.slice(openIndex).search(/\n\s*>/);
  return closeOffset < 0 ? "" : dashboardSource.slice(openIndex, openIndex + closeOffset);
}

describe("dashboard scroll-padding keeps keyboard focus clear of fixed chrome", () => {
  const dashboard = source("src/components/ClinicalDashboard.tsx");
  const mainContentTag = mainContentOpeningTag(dashboard);

  it("keeps the reservation on the #main-content scroll container", () => {
    // The scrollport (overflow-y-auto) and the scroll-padding must be the same
    // element — padding on a non-scrolling ancestor would not move focus targets.
    expect(mainContentTag).not.toBe("");
    expect(mainContentTag).toContain("overflow-y-auto");
  });

  it("reserves scroll-padding-bottom in both mobile composer dock branches", () => {
    // Both dock branches (answer-with-content and non-answer views) must pair the
    // content padding with the scroll-padding reservation — focus scrolling honours
    // scroll-padding, not padding, so a bare pb is not enough. Require the paired
    // reservation in both branches; a single bare occurrence can no longer satisfy
    // the guard.
    const pairedReserve =
      "max-sm:pb-[var(--mobile-composer-reserve)] max-sm:[scroll-padding-bottom:var(--mobile-composer-reserve)]";
    expect(mainContentTag.split(pairedReserve).length - 1).toBeGreaterThanOrEqual(2);
  });

  it("reserves scroll-padding-top under the absolute answer header", () => {
    // The glass answer header is absolute over the scrollport, so focusing a field
    // near the top must clear the header too.
    expect(mainContentTag).toContain("[scroll-padding-top:calc(4.5rem+max(0.5rem,env(safe-area-inset-top)))]");
  });
});
