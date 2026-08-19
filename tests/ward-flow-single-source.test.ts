import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const WARD_DIR = "src/components/ward-management";

/** Files allowed to read the frozen fixture: the seed itself, and derivations that take it as a
 *  default parameter. Everything else must read the provider, or two surfaces will disagree. */
const ALLOWED = new Set(["ward-movements.ts", "ward-flow-reducer.ts", "ward-pressure.ts", "ward-derivations.ts"]);

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)],
  );
}

/**
 * `.tsx` alone left the `.ts` entries in `ALLOWED` inert, and let a `.ts` module reintroduce a
 * direct fixture import completely unseen by this test (Task 6 review of the brief's own draft).
 * Scanning both extensions keeps every name in `ALLOWED` doing real work, and the zero-match
 * guard below stops a typo'd `WARD_DIR` from silently passing with nothing scanned at all.
 */
function isScannable(file: string): boolean {
  return file.endsWith(".tsx") || file.endsWith(".ts");
}

describe("one source of truth", () => {
  it("scans a non-empty set of ward-management source files", () => {
    // A test that can vacuously pass because its own file list came back empty is a test that
    // cannot fail — guard against WARD_DIR ever silently resolving to nothing scannable.
    const scanned = walk(WARD_DIR).filter(isScannable);
    expect(scanned.length).toBeGreaterThan(0);
  });

  it("has no component reading the frozen fixture directly", () => {
    const offenders = walk(WARD_DIR)
      .filter(isScannable)
      .filter((file) => !ALLOWED.has(file.split(/[\\/]/).pop()!))
      .filter((file) => /from "[^"]*ward-movements"/.test(readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("no longer exports a stage summary frozen at import time", () => {
    const source = readFileSync(join(WARD_DIR, "ward-derivations.ts"), "utf8");
    expect(source).not.toMatch(/export const movementStageSummary/);
  });
});
