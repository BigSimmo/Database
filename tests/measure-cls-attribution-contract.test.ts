import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../scripts/measure-cls-attribution.mjs", import.meta.url), "utf8");

describe("CLS attribution evidence contract", () => {
  it("accepts zero-shift routes only when both observers report successful installation", () => {
    expect(source).toContain("const routesMissingInstrumentation = Object.entries(results)");
    expect(source).toContain("window.__clsObserverReady = true");
    expect(source).toContain("window.__reserveObserverReady = true");
    expect(source).toContain("!result.instrumentation.clsObserverReady");
    expect(source).toContain("!result.instrumentation.reserveObserverReady");
    expect(source).toContain("if (routesMissingInstrumentation.length > 0)");
    expect(source).toContain("Treat those routes as failed evidence");
  });

  it("creates a requested nested evidence directory before writing", () => {
    expect(source).toContain("mkdirSync(path.dirname(outFile), { recursive: true })");
    expect(source.indexOf("mkdirSync(path.dirname(outFile)")).toBeLessThan(source.indexOf("writeFileSync(outFile"));
  });
});
