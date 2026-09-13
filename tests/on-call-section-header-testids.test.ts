import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  ON_CALL_SECTION_HEADER_PREFIX,
  ON_CALL_SECTION_HEADER_TEST_IDS,
} from "@/components/on-call/on-call-nav-header";

/**
 * `InPageNavHeader` builds its testids by interpolating a prefix, so the
 * strings never appear whole in that file. Two records outside React need them
 * whole: `docs/on-call/design/mockup-conformance.md` cites them as proof a
 * board's element is built, and its gate finds a testid only by scanning
 * `src/components/on-call/` for literals.
 *
 * So the mode writes them out — and this pins the copies to the two facts they
 * are derived from, which is the only reason it is safe to write them out at
 * all. Renaming the prefix, or a suffix inside the shared header, fails here
 * rather than silently emptying the ledger's proof.
 */
describe("the On Call section header's testids", () => {
  // Two files, because two components emit these: the header owns the row and
  // both sheets, the rail owns the bar and its More slot.
  const headerSource = [
    readFileSync(join(__dirname, "..", "src/components/in-page-nav/in-page-nav-header.tsx"), "utf8"),
    readFileSync(join(__dirname, "..", "src/components/in-page-nav/in-page-section-rail.tsx"), "utf8"),
  ].join("\n");

  it.each([
    ["header", "detail-header"],
    ["sectionTrigger", "section-trigger"],
    ["sectionRail", "section-rail"],
    ["sectionOverflow", "section-overflow"],
    ["sectionSheetBack", "section-sheet-back"],
  ] as const)("composes %s from the prefix and the suffix the shared header emits", (key, suffix) => {
    expect(ON_CALL_SECTION_HEADER_TEST_IDS[key]).toBe(`${ON_CALL_SECTION_HEADER_PREFIX}-${suffix}`);
    expect(
      headerSource.includes(`data-testid={\`\${testIdPrefix}-${suffix}\`}`),
      `Nothing in the in-page-nav template renders a "${suffix}" testid any more`,
    ).toBe(true);
  });

  it("is the prefix the mode actually passes", () => {
    const modeSource = readFileSync(join(__dirname, "..", "src/components/on-call/on-call-nav-header.tsx"), "utf8");
    expect(modeSource).toContain("testIdPrefix={ON_CALL_SECTION_HEADER_PREFIX}");
    expect(modeSource).not.toContain('testIdPrefix="on-call-section"');
  });

  /**
   * The header's wiring, asserted on source rather than on rendered DOM.
   *
   * Not laziness: `useResolvedPageSections` decides which declared groups are
   * on screen with `getClientRects()`, and jsdom reports that empty for every
   * element, so no section resolves in any DOM test and the header never
   * reaches its rail there. The bar rendering, folding at each width and
   * marking the current group is proven in a browser by
   * `tests/ui-on-call-boards.spec.ts`. What is decidable offline is that the
   * mode asks for the right things — which is what silently regressed for
   * medication's rail in PR #2686.
   */
  it("asks for a bar of this page's groups, in the mode's own colour", () => {
    const modeSource = readFileSync(join(__dirname, "..", "src/components/on-call/on-call-nav-header.tsx"), "utf8");

    // Named for the page, not for the mode: cross-page navigation lives in the
    // mode pill, and this row is the page in front of you.
    expect(modeSource).toContain('label: "Sections of this page"');
    // Its own calibrated label family, never Therapy's `extended`.
    expect(modeSource).toContain('density: "wordmark-five"');
    // Teal by attribute. A dynamic Tailwind class (`var(--x-${id})`) produces
    // no CSS at all, and an inline style is ceilinged by the drift ratchet.
    expect(modeSource).toContain('modeIdentity: "on-call"');
    // The mode pill above names the page and carries its actions, so the row
    // holds neither. Both would be a second copy in the same 96px block.
    expect(modeSource).toContain("titleHidden");
    // Scoped to the section header: the pocket card's header, higher in the
    // same file, keeps both an arrow and an actions sheet and must not be
    // caught by either rule.
    const sectionHeader = modeSource.slice(modeSource.indexOf("export function OnCallSectionNavHeader"));
    expect(sectionHeader).not.toContain("actions=");
    // No back arrow: every page in this mode is a destination in the pill's own
    // list, the hub included, so an arrow to the hub named a parent that is not
    // one — and put a control that LEAVES the page at the head of a row whose
    // whole job is moving around inside it.
    expect(sectionHeader).not.toContain("back=");
  });
});
