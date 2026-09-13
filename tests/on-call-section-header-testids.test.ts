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
  const headerSource = readFileSync(join(__dirname, "..", "src/components/in-page-nav/in-page-nav-header.tsx"), "utf8");

  it.each([
    ["header", "detail-header"],
    ["sectionTrigger", "section-trigger"],
    ["actionsTrigger", "actions-trigger"],
  ] as const)("composes %s from the prefix and the suffix the shared header emits", (key, suffix) => {
    expect(ON_CALL_SECTION_HEADER_TEST_IDS[key]).toBe(`${ON_CALL_SECTION_HEADER_PREFIX}-${suffix}`);
    expect(
      headerSource.includes(`data-testid={\`\${testIdPrefix}-${suffix}\`}`),
      `InPageNavHeader no longer renders a "${suffix}" testid`,
    ).toBe(true);
  });

  it("is the prefix the mode actually passes", () => {
    const modeSource = readFileSync(join(__dirname, "..", "src/components/on-call/on-call-nav-header.tsx"), "utf8");
    expect(modeSource).toContain("testIdPrefix={ON_CALL_SECTION_HEADER_PREFIX}");
    expect(modeSource).not.toContain('testIdPrefix="on-call-section"');
  });
});
