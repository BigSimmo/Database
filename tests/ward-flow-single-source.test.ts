import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const WARD_DIR = "src/components/ward-management";

/**
 * Scope for the `NOW_ANCHOR` read-restriction rule. Task 6 fix round 4: widened from `WARD_DIR`
 * after fix round 3's guard was proven to check only reads inside
 * `src/components/ward-management` while its own test name claimed "every read of NOW_ANCHOR" —
 * a probe file at `src/lib/ward-probe/frozen.ts` (outside `WARD_DIR`, deleted after proving the
 * point) named-imported `NOW_ANCHOR` and the fix-round-3 suite stayed fully green. The repo has
 * roughly 200 modules under `src/lib` alone, so a ward screen importing a time helper from
 * outside `WARD_DIR` is an ordinary shape, not an exotic one. The fixture-import rule below
 * (`ALLOWED`) stays scoped to `WARD_DIR` — only the `NOW_ANCHOR` rule widens.
 */
const SRC_DIR = "src";

/** Files allowed to read the frozen fixture: the seed itself, and derivations that take it as a
 *  default parameter. Everything else must read the provider, or two surfaces will disagree.
 *  Scoped to `WARD_DIR`, not `SRC_DIR` — the fixture only ever needs importing from within the
 *  ward-management feature, so bare basenames are unambiguous here and this rule is unchanged
 *  from fix round 3. */
const ALLOWED = new Set(["ward-movements.ts", "ward-flow-reducer.ts", "ward-pressure.ts", "ward-derivations.ts"]);

/**
 * Files allowed to read `NOW_ANCHOR` anywhere under `SRC_DIR` — Task 6 fix round 4, widening fix
 * round 3's rule (which was scoped only to `WARD_DIR` despite its test name claiming "every
 * read"). Keys are full paths from the repo root with forward slashes, not bare basenames: across
 * the whole of `src` a bare basename can collide with an unrelated same-named file elsewhere in
 * the tree, which would silently exempt it. `readsNowAnchor` below scans for the bare identifier
 * after stripping comments and string literals, so it catches every reading form (named import,
 * namespace-qualified property access, bare re-export) without needing a separate regex per form.
 *
 * Verified by hand (`grep -rln "NOW_ANCHOR" src`, Task 6 fix round 4) before writing this list:
 * six files under `src` mention the string `NOW_ANCHOR` at all, but three of those — `ward-derivations.ts`,
 * `ward-flow-reducer.ts`, and `coordinator-screen.tsx` — only name it in a comment (confirmed by
 * inspecting each match with context). These three are the only files anywhere under `src` with a
 * real (non-comment, non-string) read of the identifier.
 */
const NOW_ANCHOR_ALLOWLIST = new Set([
  "src/components/ward-management/ward-sites.ts", // declares the constant and uses it to build the fixture's capacity timestamps
  "src/components/ward-management/ward-movements.ts", // the movement fixture; every synthetic timestamp derives from it
  "src/components/ward-management/ward-flow-provider.tsx", // the provider, which reads it once to derive the live `now`
]);

/**
 * Normalises a walked path to forward-slash form so it can be compared against the
 * forward-slash keys in `NOW_ANCHOR_ALLOWLIST`. `walk` below builds paths with `node:path`'s
 * `join`, which emits backslashes on Windows — comparing those raw against forward-slash keys
 * would never match, silently exempting nothing (failing the whole suite on every legitimate
 * reader) or, if the comparison were ever inverted by mistake, silently exempting everything.
 */
function normalizePath(file: string): string {
  return file.split("\\").join("/");
}

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)],
  );
}

/**
 * `.tsx` alone left the `.ts` entries in `ALLOWED` inert, and let a `.ts` module reintroduce a
 * direct fixture import completely unseen by this test (Task 6 review of the brief's own draft).
 * Scanning both extensions keeps every name in `ALLOWED` doing real work, and the zero-match
 * guard below stops a typo'd directory constant from silently passing with nothing scanned at all.
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
 * a string. Deliberately not scoped to "import" forms alone: that scoping is what let the fix
 * round 2 rule miss a namespace import entirely.
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
   * Task 6 fix round 4: the fix-round-3 guard scanned only `WARD_DIR` while its test name claimed
   * to restrict "every read" of `NOW_ANCHOR` — a file placed anywhere else under `src` (proven
   * with a probe at `src/lib/ward-probe/frozen.ts`) could import the frozen epoch and this suite
   * stayed green. This test is scoped to `SRC_DIR`, the whole source tree, so a reader placed in
   * any module — ward-management or not — is caught.
   */
  it("scans a non-empty set of src source files for the NOW_ANCHOR allow-list check", () => {
    // Same failure mode as the fixture-import guard above, checked again here rather than only
    // relied upon there: this specific check must not be able to pass by scanning nothing.
    const scanned = walk(SRC_DIR).filter(isScannable);
    expect(scanned.length).toBeGreaterThan(0);
  });

  it("restricts every read of NOW_ANCHOR under src to the named allow-list", () => {
    const offenders = walk(SRC_DIR)
      .filter(isScannable)
      .filter((file) => !NOW_ANCHOR_ALLOWLIST.has(normalizePath(file)))
      .filter((file) => readsNowAnchor(readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });
});
