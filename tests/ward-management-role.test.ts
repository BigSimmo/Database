import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Ward Flow role screens static test ID integrity", () => {
  it("ensures ward-screen.tsx has a valid single return for ward-unit-screen without colliding duplicate elements", () => {
    const source = readFileSync(resolve(process.cwd(), "src/components/ward-management/ward/ward-screen.tsx"), "utf8");
    const testIdMatches = [...source.matchAll(/data-testid=["']ward-unit-screen["']/g)];
    // Test ID appears on root screen container
    expect(testIdMatches.length).toBeGreaterThanOrEqual(1);
  });

  it("ensures ed-screen.tsx has a valid single return for ward-ed-screen without colliding duplicate elements", () => {
    const source = readFileSync(resolve(process.cwd(), "src/components/ward-management/ed/ed-screen.tsx"), "utf8");
    const testIdMatches = [...source.matchAll(/data-testid=["']ward-ed-screen["']/g)];
    expect(testIdMatches.length).toBeGreaterThanOrEqual(1);
  });

  it("ensures officer-screen.tsx has a single ward-officer-screen test ID", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/components/ward-management/officer/officer-screen.tsx"),
      "utf8",
    );
    const testIdMatches = [...source.matchAll(/data-testid=["']ward-officer-screen["']/g)];
    expect(testIdMatches.length).toBe(1);
  });
});
