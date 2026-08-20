import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
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
 * the tree, which would silently exempt it. `readsNowAnchor` below parses each candidate file
 * with the TypeScript compiler's own parser and walks the resulting AST for a real identifier
 * reference, so it catches every reading form (named import, namespace-qualified property
 * access, bare re-export) without needing a separate regex per form, and without being fooled by
 * a comment or string that merely mentions the name.
 *
 * Verified by hand (`grep -rln "NOW_ANCHOR" src`, Task 6 fix round 4) before writing this list:
 * six files under `src` mention the string `NOW_ANCHOR` at all, but three of those — `ward-derivations.ts`,
 * `ward-flow-reducer.ts`, and `coordinator-screen.tsx` — only name it in a comment (confirmed by
 * inspecting each match with context, and re-confirmed in fix round 5 against the AST-based
 * scanner below). These three are the only files anywhere under `src` with a real (non-comment,
 * non-string) read of the identifier.
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
 * True for any real read of `NOW_ANCHOR` — a named import, a namespace-qualified property access
 * (`sites.NOW_ANCHOR`), or a bare use of the identifier — never for a mention inside a comment or
 * a string literal.
 *
 * Task 6 fix round 5: the previous implementation (`stripCommentsAndStrings`, deleted) was a
 * hand-rolled character-by-character scanner with no concept of a regex literal. A quote
 * character inside a `/…/` regex opened a phantom string that desynced the scanner's comment and
 * string tracking for the rest of the file, making every later line invisible to the identifier
 * scan — reproduced by hand against `src/components/clinical-dashboard/search-utils.ts:331`
 * (`/"[^"]+"|(?:^|\s)'[^']+'(?=\s|$)/`) and `src/lib/document-summary-badges.ts:61` (a regex with
 * an apostrophe inside a character class): appending a real `NOW_ANCHOR` import after either
 * regex left the suite fully green. Teaching the scanner to recognise regex literals was
 * rejected — telling a regex literal from a division operator requires knowing the preceding
 * token, which is exactly why ad-hoc JavaScript scanners get this wrong, and a heuristic here
 * would only have bought a fourth version of the same overclaim.
 *
 * Instead this walks the real AST that the TypeScript compiler itself parses `.ts`/`.tsx` files
 * into (`typescript`, already a repo dependency — it is what `tsc` runs on): every `Identifier`
 * node named `NOW_ANCHOR` is a real reference (import specifier, property access, or plain use),
 * because comment text is trivia attached to token positions rather than a node the walk ever
 * visits, and the contents of a string or template literal are `StringLiteral`/template nodes,
 * never `Identifier` nodes. Comments and strings are excluded by construction, not by a second
 * regex layered on top of the first mistake. A cheap `source.includes("NOW_ANCHOR")` pre-filter
 * runs first so the parser is only invoked for files that could possibly match — verified by
 * hand (`grep -rln "NOW_ANCHOR" src`) that only six files under `src` contain the substring at
 * all, so this discards essentially the whole tree before any parsing happens.
 */
function readsNowAnchor(source: string, fileName: string): boolean {
  if (!source.includes("NOW_ANCHOR")) return false;

  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ false,
    fileName.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  let found = false;
  const visit = (node: ts.Node): void => {
    if (found) return;
    if (ts.isIdentifier(node) && node.text === "NOW_ANCHOR") {
      found = true;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
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
      .filter((file) => readsNowAnchor(readFileSync(file, "utf8"), file));
    expect(offenders).toEqual([]);
  });
});
