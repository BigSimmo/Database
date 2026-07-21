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

describe("dashboard scroll-padding keeps keyboard focus clear of fixed chrome", () => {
  const dashboard = source("src/components/ClinicalDashboard.tsx");

  it("keeps the reservation on the #main-content scroll container", () => {
    // The scrollport (overflow-y-auto) and the scroll-padding must be the same
    // element — padding on a non-scrolling ancestor would not move focus targets.
    expect(dashboard).toMatch(/id="main-content"[\s\S]*?overflow-y-auto/);
  });

  it("reserves scroll-padding-bottom whenever the mobile composer docks", () => {
    // Both dock branches (answer-with-content and non-answer views) reserve the
    // dock clearance; a bare pb reservation is not enough because focus scrolling
    // honours scroll-padding, not padding.
    const reserve = "max-sm:[scroll-padding-bottom:var(--mobile-composer-reserve)]";
    const occurrences = dashboard.split(reserve).length - 1;
    expect(occurrences).toBeGreaterThanOrEqual(2);
    // Each reservation is paired with the matching content padding.
    expect(dashboard).toContain("max-sm:pb-[var(--mobile-composer-reserve)] " + reserve);
  });

  it("reserves scroll-padding-top under the absolute answer header", () => {
    // The glass answer header is absolute over the scrollport, so focusing a field
    // near the top must clear the header too.
    expect(dashboard).toContain("[scroll-padding-top:calc(4.5rem+max(0.5rem,env(safe-area-inset-top)))]");
  });
});
