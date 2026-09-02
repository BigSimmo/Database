import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const railCss = readFileSync(
  new URL("../src/components/ward-management/ward-management.module.css", import.meta.url),
  "utf8",
);
const coordinatorCss = readFileSync(
  new URL("../src/components/ward-management/coordinator/coordinator.module.css", import.meta.url),
  "utf8",
);

function cssBlock(source: string, selector: string): string {
  const start = source.indexOf(`${selector} {`);
  expect(start, `missing ${selector} block`).toBeGreaterThanOrEqual(0);
  let depth = 0;
  for (let index = source.indexOf("{", start); index < source.length; index += 1) {
    const character = source[index];
    if (character === "{") depth += 1;
    else if (character === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`${selector} block did not close`);
}

describe("Ward coordinator token bridge (DS-P0-05)", () => {
  it("declares --ward-border and --ward-chrome on .clinicalRail", () => {
    const block = cssBlock(railCss, ".clinicalRail");
    expect(block).toMatch(/--ward-border\s*:/);
    expect(block).toMatch(/--ward-chrome\s*:/);
  });

  it("does not put --ward-* aliases onto coordinator .screen", () => {
    const block = cssBlock(coordinatorCss, ".screen");
    expect(block).not.toMatch(/--ward-[a-z0-9-]+\s*:/);
  });
});
