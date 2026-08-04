import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../scripts/measure-cls-attribution.mjs", import.meta.url), "utf8");

describe("CLS attribution evidence contract", () => {
  it("accepts a zero-shift route when the reserve timeline proves instrumentation ran", () => {
    expect(source).toContain("const instrumentationMissing");
    expect(source).toContain("result.entries.length === 0 && result.reserveTimeline.length === 0");
    expect(source).toContain("if (allZero && instrumentationMissing)");
  });

  it("creates a requested nested evidence directory before writing", () => {
    expect(source).toContain("mkdirSync(path.dirname(outFile), { recursive: true })");
    expect(source.indexOf("mkdirSync(path.dirname(outFile)")).toBeLessThan(source.indexOf("writeFileSync(outFile"));
  });
});
