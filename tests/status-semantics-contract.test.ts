import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  findColourOnlyStatusIndicatorsInSource,
  findStatusColouredNumeralsInSource,
} from "../scripts/design-system-contract-utils.mjs";

const owners = [
  "src/components/calculators/calculator-ui.tsx",
  "src/components/ui-primitives.tsx",
  "src/components/clinical-dashboard/visual-evidence.tsx",
] as const;

function source(path: (typeof owners)[number]) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("clinical status semantics", () => {
  it.each(owners)("keeps %s free of colour-only status and status-coloured numerals", (path) => {
    const contents = source(path);
    expect(findColourOnlyStatusIndicatorsInSource(path, contents)).toEqual([]);
    expect(findStatusColouredNumeralsInSource(path, contents)).toEqual([]);
  });

  it("gives every calculator severity tone a distinct non-colour edge pattern", () => {
    const calculator = source("src/components/calculators/calculator-ui.tsx");
    expect(calculator).toContain('success: "border-b-2 border-[color:var(--text-heading)]"');
    expect(calculator).toContain('info: "border-t-2 border-[color:var(--text-heading)]"');
    expect(calculator).toContain('warning: "border-y-2 border-[color:var(--text-heading)]"');
    expect(calculator).toContain('danger: "border-2 border-[color:var(--text-heading)]"');
    expect(calculator).toContain("aria-label={`Score severity scale from ${calc.minScore} to ${calc.maxScore}`}");
  });

  it("distinguishes ready, review, and muted markers by geometry as well as tone", () => {
    const primitives = source("src/components/ui-primitives.tsx");
    expect(primitives).toContain("statusDotReady = `${statusMarkerBase} rounded-full border-2");
    expect(primitives).toContain("statusDotReview = `${statusMarkerBase} rotate-45 rounded-sm");
    expect(primitives).toContain("statusDotMuted = `${statusMarkerBase} rounded-full bg");
  });
});
