import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const WARD_DIR = "src/components/ward-management";

/** Files allowed to read the frozen fixture: the seed itself, and derivations that take it as a
 *  default parameter. Everything else must read the provider, or two surfaces will disagree. */
const ALLOWED = new Set(["ward-movements.ts", "ward-flow-reducer.ts", "ward-pressure.ts", "ward-derivations.ts"]);

/**
 * Files allowed to hold both the live clock and the frozen epoch. Empty on purpose: Task 6 fix
 * round 1 found no case where a component that reads `useWardFlow()` genuinely needs
 * `NOW_ANCHOR` rather than `now` — `ward-flow-provider.tsx` (which legitimately reads
 * `NOW_ANCHOR` to derive `now` in the first place) never calls its own `useWardFlow()` hook, and
 * every fixture/reducer module that reads `NOW_ANCHOR` is not a component at all. If a real
 * exception is ever found, name it here with the reason rather than loosening the two regexes
 * below to quietly stop catching the class.
 */
const CLOCK_EXEMPT = new Set<string>();

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

/**
 * True only for a real invocation — `const { now } = useWardFlow();`, `return useWardFlow();` —
 * never for the hook's own declaration. `ward-flow-provider.tsx` contains the literal substring
 * `useWardFlow()` as part of `export function useWardFlow(): WardFlowContextValue {`, so a bare
 * `/useWardFlow\(\)/` match would misidentify the one file that defines the hook as a file that
 * calls it. Requiring `=` or `return` immediately before the call is what a real destructure or
 * direct read always has and a function declaration never does.
 */
function callsUseWardFlow(source: string): boolean {
  return /(?:=|return)\s*useWardFlow\(\)/.test(source);
}

/**
 * True only for a real named import of `NOW_ANCHOR` from `ward-sites` — never for a comment that
 * merely mentions the constant. `coordinator-screen.tsx` carries exactly that trap: a Task 5
 * doc comment names `NOW_ANCHOR` while the file itself only ever reads the live `now`, and a
 * bare `/NOW_ANCHOR/` substring match would have flagged it as an offender it is not.
 */
function importsNowAnchor(source: string): boolean {
  return /import\s*\{[^}]*\bNOW_ANCHOR\b[^}]*\}\s*from\s*"[^"]*ward-sites"/.test(source);
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

  /**
   * Task 6 fix round 1 pinned one call site (the movements board's elapsed label) to the live
   * clock. Fix round 2 exists because pinning one call site guards an instance, not the class:
   * every other `NOW_ANCHOR` read in the same three files was equally frozen and equally
   * untested, since every other test in this suite pins the clock with `initialNow` and never
   * advances it. This test is scoped by the rule itself — a component may read the live clock or
   * the frozen epoch, never both — rather than by naming the three files, so a route added later
   * that makes the same mistake is caught automatically instead of needing a fourth fix round.
   */
  it("scans a non-empty set of ward-management source files for the clock-consistency check", () => {
    // Same failure mode as the fixture-import guard above, checked again here rather than only
    // relied upon there: this specific check must not be able to pass by scanning nothing.
    const scanned = walk(WARD_DIR).filter(isScannable);
    expect(scanned.length).toBeGreaterThan(0);
  });

  it("has no component holding both the live clock and the frozen epoch", () => {
    const offenders = walk(WARD_DIR)
      .filter(isScannable)
      .filter((file) => !CLOCK_EXEMPT.has(file.split(/[\\/]/).pop()!))
      .filter((file) => {
        const source = readFileSync(file, "utf8");
        return callsUseWardFlow(source) && importsNowAnchor(source);
      });
    expect(offenders).toEqual([]);
  });
});
