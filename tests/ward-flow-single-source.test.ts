import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const WARD_DIR = "src/components/ward-management";

/** Files allowed to read the frozen fixture: the seed itself, and derivations that take it as a
 *  default parameter. Everything else must read the provider, or two surfaces will disagree. */
const ALLOWED = new Set(["ward-movements.ts", "ward-flow-reducer.ts", "ward-pressure.ts", "ward-derivations.ts"]);

/**
 * Files allowed to read `NOW_ANCHOR` at all — Task 6 fix round 3, replacing the earlier "both the
 * clock and the epoch" rule (see the report's fix round 2 section), which only text-matched a
 * file's own named import of `NOW_ANCHOR` alongside a real `useWardFlow()` call. That rule was
 * provably evadable three ways: a helper that reads `NOW_ANCHOR` internally and is called from a
 * component (the component itself never imports `NOW_ANCHOR`), a namespace import
 * (`import * as sites from ".../ward-sites"` then `sites.NOW_ANCHOR`, which the named-import regex
 * never matched), and any component that never calls `useWardFlow()` at all — which sat outside
 * the rule entirely regardless of what it read. Rather than attempt transitive import analysis
 * (out of scope — see the findings), the rule inverts: every file under `WARD_DIR` may read
 * `NOW_ANCHOR` only if it is named here, whether or not it also calls `useWardFlow()`.
 * `readsNowAnchor` below scans for the bare identifier after stripping comments and string
 * literals, so it catches every reading form (named import, namespace-qualified property access,
 * bare re-export) without needing a separate regex per form.
 *
 * Verified by hand (`grep -rln "NOW_ANCHOR" src/components/ward-management`, Task 6 fix round 3)
 * before writing this list: these three are the only files under `WARD_DIR` that mention
 * `NOW_ANCHOR` outside a comment.
 */
const NOW_ANCHOR_ALLOWLIST = new Set([
  "ward-sites.ts", // declares the constant and uses it to build the fixture's capacity timestamps
  "ward-movements.ts", // the movement fixture; every synthetic timestamp derives from it
  "ward-flow-provider.tsx", // the provider, which reads it once to derive the live `now`
]);

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
 * Strips `//` and `/* *\/` comments and the contents of every string/template literal, character
 * by character rather than with a single regex, so a URL or any other comment-shaped text inside a
 * string can never be mistaken for a real comment, and — the case this scan exists to get right —
 * a doc comment that merely *names* `NOW_ANCHOR` in prose is removed before the identifier scan
 * ever runs. `coordinator-screen.tsx` carries exactly that trap: a Task 5 doc comment names
 * `NOW_ANCHOR` while the file itself only ever reads the live `now`, and this file must stay green
 * against it.
 */
function stripCommentsAndStrings(source: string): string {
  let out = "";
  let i = 0;
  const n = source.length;
  while (i < n) {
    const two = source.slice(i, i + 2);
    if (two === "//") {
      i += 2;
      while (i < n && source[i] !== "\n") i++;
      continue;
    }
    if (two === "/*") {
      i += 2;
      while (i < n && source.slice(i, i + 2) !== "*/") i++;
      i += 2;
      continue;
    }
    const ch = source[i];
    if (ch === '"' || ch === "'" || ch === "`") {
      const quote = ch;
      i++;
      while (i < n && source[i] !== quote) {
        if (source[i] === "\\") i++;
        i++;
      }
      i++;
      continue;
    }
    out += ch;
    i++;
  }
  return out;
}

/**
 * True for any real read of `NOW_ANCHOR` — a named import, a namespace-qualified property access
 * (`sites.NOW_ANCHOR`), or a bare use of the identifier — never for a mention inside a comment or
 * a string. Deliberately not scoped to "import" forms alone: that scoping is what let the previous
 * rule (fix round 2) miss a namespace import entirely (Finding 1).
 */
function readsNowAnchor(source: string): boolean {
  return /\bNOW_ANCHOR\b/.test(stripCommentsAndStrings(source));
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
   * Task 6 fix round 3, Finding 1: the previous version of this guard ("has no component holding
   * both the live clock and the frozen epoch", fix round 2) only ever flagged a file that BOTH
   * called `useWardFlow()` AND imported `NOW_ANCHOR` by name — provably evadable via helper
   * indirection, a namespace import, or simply never calling `useWardFlow()` at all. This test is
   * scoped by declaration, not by co-occurrence with the clock hook: every file under `WARD_DIR`
   * must be on the named allow-list to read `NOW_ANCHOR` at all, so a route added later that reads
   * the frozen epoch — whether or not it also reads the live clock — is caught automatically.
   */
  it("scans a non-empty set of ward-management source files for the NOW_ANCHOR allow-list check", () => {
    // Same failure mode as the fixture-import guard above, checked again here rather than only
    // relied upon there: this specific check must not be able to pass by scanning nothing.
    const scanned = walk(WARD_DIR).filter(isScannable);
    expect(scanned.length).toBeGreaterThan(0);
  });

  it("restricts every read of NOW_ANCHOR to the named allow-list", () => {
    const offenders = walk(WARD_DIR)
      .filter(isScannable)
      .filter((file) => !NOW_ANCHOR_ALLOWLIST.has(file.split(/[\\/]/).pop()!))
      .filter((file) => readsNowAnchor(readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });
});
