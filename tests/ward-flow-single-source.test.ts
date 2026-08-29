import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

import { seedWardFlowState } from "../src/components/ward-management/ward-flow-reducer";

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
 * Files allowed to import the ADMISSION seed (`ward-admissions-seed.ts`) — the sibling of the
 * `ALLOWED` rule above, added Phase 8 Task 5 fix round 1, and it guards a SENTENCE rather than a
 * number.
 *
 * `Admission` is currently not in reducer state and no `WardFlowEvent` creates, ends or moves one,
 * so `wardAdmissions` is the only record of who is in a bed. The out-of-area ledger therefore reads
 * the seed as a default parameter — and, because it does, that screen tells the reader in its own
 * words that the list is seeded, that nothing done on these screens adds to it or takes from it,
 * and that it is not a live statewide count.
 *
 * **That sentence is true today and nothing else keeps it true.** The moment admissions become live
 * — a reducer key, an arrival event, a departure event — the screen's paragraph becomes false while
 * every one of its tests stays green, because those tests pin the sentence's PRESENCE and cannot
 * pin its TRUTH. This list is the tripwire: a second reader of the seed, or a move of the ledger
 * off it, fails here and sends a reviewer back to that paragraph. It replaced a sentence this
 * project had already had to correct once for being false on exactly this axis
 * (`docs/ward-flow-phase-8-decisions.md`, D8-9), which is why it gets a guard that outlives the
 * session that wrote it.
 *
 * Full paths from the repo root with forward slashes, matching `NOW_ANCHOR_ALLOWLIST`'s convention
 * rather than `ALLOWED`'s bare basenames — this rule is scoped to the whole of `SRC_DIR`, where a
 * bare basename could collide with an unrelated same-named file and silently exempt it.
 *   - `ward-admissions-seed.ts` declares the fixture.
 *   - `out-of-area/out-of-area-board.tsx` is the ledger screen. Adding a second entry here is not a
 *     paperwork step: read that screen's provenance paragraph first and decide whether it is still
 *     true.
 */
const ADMISSION_SEED_ALLOWLIST = new Set([
  "src/components/ward-management/ward-admissions-seed.ts",
  "src/components/ward-management/out-of-area/out-of-area-board.tsx",
  // Added at the ward board fold, 2026-08-29, following this constant's own instruction that a
  // second entry is not a paperwork step — the provenance paragraph was read and assessed rather
  // than waved through. The sentence it protects is "the list is seeded, no event in this prototype
  // adds to it or removes from it, and it is not a live count of anything." `ward-board.tsx` reads
  // the seed as `const admissions = wardAdmissions` and contains no `dispatch`, no `useState`, no
  // `useWardFlow` and no `useReducer` — verified by grep before the entry was added. A read-only
  // consumer emits no events, so it cannot make that sentence false. The comment's fear — that a
  // second reader is usually the change that falsifies it — is a good prior and does not hold here.
  //
  // The guarantee is now carried by the companion assertion below rather than by this list being
  // short: no file reading the admission seed may also dispatch a Ward Flow event. That is the
  // property the prose actually promises, and it keeps biting if this board later gains the
  // discharge-confirmation handler its own DB-2 work points at.
  "src/components/ward-management/board/ward-board.tsx",
]);

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
 * Files allowed to read `allUnits` or `unitById` from `ward-sites.ts` anywhere under `SRC_DIR` —
 * whole-branch review I1, the units-capacity sibling of the `NOW_ANCHOR` rule above. I1 named
 * this exact gap: `ward-flow-single-source.test.ts` guarded the frozen MOVEMENTS fixture
 * (`ALLOWED` above) but had no equivalent rule for the frozen UNITS fixture, which is how
 * whole-branch review Critical 1 shipped — a ward could confirm zero allocatable beds and the
 * coordinator's shortlist would still read "Eligible now" for it, because `eligibleCandidates`,
 * `destinationUnit` and several components resolved units via `allUnits()`/`unitById()` instead
 * of the provider's live `units`. Keys are full paths from the repo root with forward slashes,
 * matching `NOW_ANCHOR_ALLOWLIST`'s own convention — a bare basename could otherwise collide with
 * an unrelated same-named file elsewhere in `src`.
 *
 * Verified by hand (`grep -rn "allUnits\|unitById" src`, this fix, after converting every
 * live-surface caller) before writing this list: the only real, non-comment identifier reads of
 * either name anywhere under `src` are the three files below.
 *   - `ward-sites.ts` declares both functions — a function declaration's own name is itself an
 *     `Identifier` node, so the declaring file must be excluded the same way
 *     `NOW_ANCHOR_ALLOWLIST` excludes the file that declares `NOW_ANCHOR`.
 *   - `ward-movements.ts` (the movement fixture) calls `allUnits()` to build its own synthetic
 *     unit-name lookups at module load — a fixture-to-fixture read at data-authoring time, never
 *     a live surface a user's screen renders from.
 *   - `ward-scenarios.ts`'s `scenarioUnits` calls `structuredClone(allUnits())` exactly once —
 *     the single legitimate place ANY live state is ever initialised FROM the frozen fixture, for
 *     either scenario. Ward Flow Phase 4 Task 1 moved this read here from `ward-flow-reducer.ts`:
 *     `seedWardFlowState` no longer touches `allUnits()` itself, it calls `scenarioUnits(scenario)`,
 *     so `ward-flow-reducer.ts` has left this list and `ward-scenarios.ts` has taken its place.
 *     Every later read of unit state anywhere in the app must come from that live `state.units`
 *     (via the provider's `units`), never from `ward-sites.ts` again.
 * `ward-derivations.ts` is no longer on this list (final-fix-wave R70): its own explicitly
 * deprecated `eligibleCandidates(movement, now, limit)` wrapper — kept only because
 * `tests/ward-flow-contracts.test.ts` called it with the pre-fix three-argument shape while a
 * concurrent session owned that test file — has been deleted now that the concurrent session is
 * finished. `tests/ward-flow-contracts.test.ts` calls `eligibleCandidatesAmong` directly with the
 * walk's own live `units`, the same as every other caller.
 * Every ward-management component that used to resolve a unit's own capacity, name or existence
 * via `unitById`/`allUnits` — `ward-screen.tsx`, `flow-diagram.tsx`, `shortlist-panel.tsx`,
 * `ward-management-console.tsx`, `ward-management-modes.tsx`, `ward-management-network.tsx`,
 * `ward-role-switcher.tsx`, `ed-screen.tsx`, and `ward-derivations.ts`'s own `destinationUnit`/
 * `eligibleCandidatesAmong` — now takes the provider's live `units` as a parameter instead.
 */
const UNITS_FIXTURE_ALLOWLIST = new Set([
  "src/components/ward-management/ward-sites.ts",
  "src/components/ward-management/ward-movements.ts",
  "src/components/ward-management/ward-scenarios.ts",
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
 * A source-tree file, read once and cached: `file` is the raw walked path (backslashes on
 * Windows, exactly as `ALLOWED`'s basename lookup and the AST helpers below expect), and
 * `normalizedFile` is the forward-slash form `NOW_ANCHOR_ALLOWLIST` and the `WARD_DIR` prefix
 * filter compare against.
 */
interface ScannedFile {
  readonly file: string;
  readonly normalizedFile: string;
  readonly source: string;
}

/**
 * Task 6A fix round 2 (performance): every rule below used to independently call `walk(SRC_DIR)`
 * and `readFileSync` each of the ~896 scannable files under `src` — five separate full-tree
 * walks and reads across this file's nine tests (measured before this round: 61.19s total, one
 * test timing out past the 30s per-test ceiling). None of that redundancy was buying extra
 * safety: every rule's own pre-filter (a substring check, or `NOW_ANCHOR_ALLOWLIST`/`ALLOWED`
 * membership) still runs exactly as before, unchanged, against the same in-memory content — this
 * is a single shared read, not a weaker scan.
 *
 * `srcDirFiles()` walks `SRC_DIR` and reads every scannable file exactly once, then caches the
 * result for the lifetime of this module (a single test-file process). `wardDirFiles()` does not
 * re-walk the tree: `WARD_DIR` (`src/components/ward-management`) is a subdirectory of `SRC_DIR`,
 * so its file set is derived by filtering the already-read `srcDirFiles()` list on the
 * `WARD_DIR/` path prefix — this is the same file set `walk(WARD_DIR)` would produce, not a
 * narrower or wider one, because `SRC_DIR`'s walk already visited every file under `WARD_DIR`.
 * The scope each rule enforces is unchanged: the fixture-import rule still only ever sees
 * `wardDirFiles()`, and the `NOW_ANCHOR`/`ED_ACCESS_TARGET_MINUTES` rules still only ever see the
 * full `srcDirFiles()`. Do not unify those call sites — only the underlying I/O is shared.
 */
let srcDirFilesCache: ScannedFile[] | undefined;
function srcDirFiles(): ScannedFile[] {
  if (!srcDirFilesCache) {
    srcDirFilesCache = walk(SRC_DIR)
      .filter(isScannable)
      .map((file) => ({ file, normalizedFile: normalizePath(file), source: readFileSync(file, "utf8") }));
  }
  return srcDirFilesCache;
}

let wardDirFilesCache: ScannedFile[] | undefined;
function wardDirFiles(): ScannedFile[] {
  if (!wardDirFilesCache) {
    const prefix = `${normalizePath(WARD_DIR)}/`;
    wardDirFilesCache = srcDirFiles().filter((entry) => entry.normalizedFile.startsWith(prefix));
  }
  return wardDirFilesCache;
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

/**
 * True for any real read of `allUnits` or `unitById` — a named import, a namespace-qualified
 * property access (`sites.allUnits()`), or a bare use of either identifier — never for a mention
 * inside a comment or a string literal.
 *
 * Whole-branch review I1: the same AST-identifier approach as `readsNowAnchor` above, for the
 * same reason (see that function's own doc comment on the hand-rolled `stripCommentsAndStrings`
 * scanner it replaced, and this file's history of guards that overclaimed their own scope — one
 * scoped by co-occurrence, one walked a single directory while its name claimed the whole tree,
 * one was blinded by a quote inside a regex literal). This walks the real TypeScript AST rather
 * than hand-rolling a fourth scanner: every `Identifier` node named `allUnits` or `unitById` is a
 * real reference (import specifier, property access, or plain use) because comment text is
 * trivia attached to token positions rather than a node the walk ever visits, and the contents of
 * a string or template literal are `StringLiteral`/template nodes, never `Identifier` nodes. A
 * cheap `source.includes(...)` pre-filter runs first so the parser is only invoked for files that
 * could possibly match, exactly like `readsNowAnchor`'s own pre-filter.
 */
function readsUnitsFixture(source: string, fileName: string): boolean {
  if (!source.includes("allUnits") && !source.includes("unitById")) return false;

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
    if (ts.isIdentifier(node) && (node.text === "allUnits" || node.text === "unitById")) {
      found = true;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
}

/**
 * Task 6A Minor 1 (fix round 1): `ED_ACCESS_TARGET_MINUTES` (`ward-model.ts`) is the emergency
 * department's access target (four hours when this guard was written; the product owner
 * superseded that figure to 24 hours on 2026-08-22 — see the constant's own doc comment) — a
 * departmental performance measure counted UP from `openedAt`. Its own doc comment forbids it
 * from ever touching a `LegalForm`, gaining a
 * `dueAt`, or feeding a legal-breach count, but Task 6A only pinned its numeric value
 * (`tests/ward-model.test.ts`). Nothing structural stopped a later change — Task 11's emergency
 * department screen is the first real consumer — from wiring it back onto a legal form, which is
 * exactly the mistake Task 6A exists to undo. The two checks below give that prohibition a shape
 * that can actually fail, mirroring the `NOW_ANCHOR` read-restriction rule above rather than only
 * pinning a value.
 *
 * Scope, named precisely after fix round 2: a reviewer probed twelve construction shapes and
 * confirmed every one of the following evades both checks below whenever the consuming file does
 * not also spell out a fresh `{code, label, kind}` object literal. These two checks are a
 * tripwire for the naive, direct case only — real value, but not a data-flow analysis — and they
 * cannot see:
 *   - an intermediate local variable holding the constant before it reaches `dueAt`
 *   - an aliased import (`import { ED_ACCESS_TARGET_MINUTES as target }`)
 *   - a spread construction (`{ ...base, dueAt }`)
 *   - a helper function in another file that builds the `dueAt` value
 *   - direct mutation (`legalForm.dueAt = ED_ACCESS_TARGET_MINUTES`) after construction
 * Closing these was deliberately ruled out: it is a type-checker's job, it was already rejected
 * for the sibling `NOW_ANCHOR` guard above, and chasing it is exactly how this file grew a
 * scanner that took five fix rounds to get right (see `readsNowAnchor`'s doc comment). Task 11's
 * emergency department screen is this constant's only real consumer, and will very likely derive
 * its `dueAt` from an existing movement rather than author a fresh `LegalForm` literal — i.e.
 * exactly the shape these two checks cannot see. Enforcement for that shape is Task 11's brief
 * and its review to carry, not this file's; that is why the two tests below are named for the
 * literal case they actually catch, not for the constant's reach in general.
 */
const LEGAL_FORM_REQUIRED_FIELDS = ["code", "kind"];

/**
 * True if the file contains an object literal carrying both `code` and `kind` on the same object
 * literal — the shape a populated `LegalForm` is written in. This matches without needing the
 * type checker.
 *
 * **The field list was `["code", "label", "kind"]` until 2026-08-24.** `LegalForm.label` was
 * deleted that day, when the product owner approved taking form titles from the Chief
 * Psychiatrist's register instead of storing them, so the old triple matched nothing at all and
 * this guard would have been silently inert. `["code", "kind"]` matches a strict SUPERSET of the
 * literals the triple did, so the quarantine below is now stricter, not weaker.
 *
 * Re-measured after the change with this same AST-walk run standalone against all of `SRC_DIR`:
 * exactly two files match — `ward-movements.ts` (the fixture) and `ward-legal-forms.ts` (the
 * declared list a clinician chooses from) — both genuine `LegalForm` sites, zero false positives.
 *
 * TWO LIMITS, stated rather than glossed:
 *   - `kind` is OPTIONAL, so an entry written without it (Form 3D) does not match on its own.
 *     `ward-legal-forms.ts` still matches because its other four entries carry one.
 *   - `ward-flow-reducer.ts` no longer matches, because it no longer authors a form at all — it
 *     attaches one the clinician chose. That is a narrowing of what this predicate has to watch,
 *     not a gap: `tests/ward-legal-figure-guard.test.ts` pins the reducer's authored-code list at
 *     empty, so a reappearing literal there fails that guard.
 */
function constructsLegalForm(source: string, fileName: string): boolean {
  if (!LEGAL_FORM_REQUIRED_FIELDS.every((name) => source.includes(name))) return false;

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
    if (ts.isObjectLiteralExpression(node)) {
      const names = new Set(
        node.properties
          .map((prop) => (prop.name && ts.isIdentifier(prop.name) ? prop.name.text : undefined))
          .filter((name): name is string => name !== undefined),
      );
      if (LEGAL_FORM_REQUIRED_FIELDS.every((name) => names.has(name))) {
        found = true;
        return;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
}

/**
 * True for any real read of `ED_ACCESS_TARGET_MINUTES` anywhere in the file — the same
 * AST-identifier approach as `readsNowAnchor` above, for the same reason: a plain substring match
 * would also fire on a comment or string that merely mentions the name.
 */
function referencesEdAccessTarget(source: string, fileName: string): boolean {
  if (!source.includes("ED_ACCESS_TARGET_MINUTES")) return false;

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
    if (ts.isIdentifier(node) && node.text === "ED_ACCESS_TARGET_MINUTES") {
      found = true;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
}

/**
 * True if any `dueAt` property's initializer expression anywhere in the file references
 * `ED_ACCESS_TARGET_MINUTES` — a narrower, independent check that does not require the enclosing
 * object literal to also carry `code`/`label`/`kind`, so a partial or spread construction the
 * field-triple check above would miss still cannot smuggle the value through.
 */
function assignsDueAtFromEdAccessTarget(source: string, fileName: string): boolean {
  if (!source.includes("dueAt") || !source.includes("ED_ACCESS_TARGET_MINUTES")) return false;

  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ false,
    fileName.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  const initializerReferencesConstant = (node: ts.Node): boolean => {
    if (ts.isIdentifier(node) && node.text === "ED_ACCESS_TARGET_MINUTES") return true;
    return Boolean(ts.forEachChild(node, initializerReferencesConstant));
  };

  let found = false;
  const visit = (node: ts.Node): void => {
    if (found) return;
    if (ts.isPropertyAssignment(node) && ts.isIdentifier(node.name) && node.name.text === "dueAt") {
      if (initializerReferencesConstant(node.initializer)) {
        found = true;
        return;
      }
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
    const scanned = wardDirFiles();
    expect(scanned.length).toBeGreaterThan(0);
  });

  it("has no component reading the frozen fixture directly", () => {
    const offenders = wardDirFiles()
      .filter(({ file }) => !ALLOWED.has(file.split(/[\\/]/).pop()!))
      .filter(({ source }) => /from "[^"]*ward-movements"/.test(source))
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it("scans a non-empty set of src source files for the admission-seed allow-list check", () => {
    // Same failure mode as every other rule here: a scan that came back empty would make the check
    // below vacuous, and a vacuous check is worse than no check because it reads as a guard.
    expect(srcDirFiles().length).toBeGreaterThan(0);
  });

  it("lets only the ledger screen read the admission seed, so its 'this is not live' sentence keeps a guard", () => {
    const offenders = srcDirFiles()
      .filter(({ normalizedFile }) => !ADMISSION_SEED_ALLOWLIST.has(normalizedFile))
      .filter(({ source }) => /from "[^"]*ward-admissions-seed"/.test(source))
      .map(({ normalizedFile }) => normalizedFile);
    expect(
      offenders,
      `file(s) reading the admission seed outside ADMISSION_SEED_ALLOWLIST: ${offenders.join(", ")}. ` +
        "Read that constant's comment before adding one — the out-of-area board states in its own words " +
        "that this list is seeded and not live, and a second reader is usually the change that makes that false.",
    ).toEqual([]);
  });

  it("lets no admission-seed reader dispatch a Ward Flow event, which is what that sentence promises", () => {
    /*
     * The companion to `ADMISSION_SEED_ALLOWLIST`, added at the fold when the ward board became its
     * third entry. A bare allowlist entry would weaken the guard permanently: the rule would then
     * be "these three files are trusted" rather than "nothing that reads this list can change it".
     *
     * This asserts the property the provenance paragraph actually promises — no event adds to or
     * removes from the list — against every reader including the allowed ones. A reader that later
     * grows a dispatch fails here even though it is on the list above, which is precisely the change
     * the original comment was worried about and the one a longer allowlist would have stopped
     * catching.
     */
    const offenders = srcDirFiles()
      .filter(({ source }) => /from "[^"]*ward-admissions-seed"/.test(source))
      // `dispatch(` only, deliberately narrow. The first draft of this rule also matched
      // `useWardFlow(` and immediately fired on `out-of-area-board.tsx` — which calls that hook to
      // READ `{ units, now }` and dispatches nothing. Reading the provider cannot falsify the
      // sentence; only emitting an event can. A check that fires is a question, not a verdict.
      .filter(({ source }) => /\bdispatch\s*\(/.test(source))
      .map(({ normalizedFile }) => normalizedFile);
    expect(
      offenders,
      `file(s) reading the admission seed AND dispatching a Ward Flow event: ${offenders.join(", ")}. ` +
        "The ledger's provenance paragraph promises that no event adds to or removes from this list. " +
        "A reader that dispatches can falsify it, whether or not it is on ADMISSION_SEED_ALLOWLIST.",
    ).toEqual([]);
  });

  it("keeps the reducer's state free of any admissions key, which is the thing that sentence depends on", () => {
    /*
     * The two-line complement to `ADMISSION_SEED_ALLOWLIST` above, and it guards the scenario that
     * constant's own comment names rather than the file shape.
     *
     * The import rule is a tripwire for the LIKELY change — a second module reading the seed — but
     * three routes get past it: a re-export through a module that is already allowed, a dynamic
     * `import()`, and admissions entering reducer state with no seed import at all (a new event
     * building them, or a fetch). All three end in the same place, which is why the assertion is
     * made there: the moment `WardFlowState` carries admissions, the out-of-area board's paragraph
     * — "this prototype does not record admissions as they happen ... this is not a live statewide
     * count" — is false, while every test that pins that paragraph stays green, because they pin
     * its PRESENCE and cannot pin its TRUTH.
     *
     * Matched case-insensitively on the substring rather than by exact key, so `admissions`,
     * `wardAdmissions` and `admissionsById` are all caught: this is a tripwire meant to fire on the
     * shape of the change, not a list of names someone has to remember to extend.
     */
    const stateKeys = Object.keys(seedWardFlowState());
    // A seeded state that came back empty would make the filter below vacuous.
    expect(stateKeys.length).toBeGreaterThan(0);
    const admissionKeys = stateKeys.filter((key) => key.toLowerCase().includes("admission"));
    expect(
      admissionKeys,
      `WardFlowState now carries ${admissionKeys.join(", ")}. Before removing this assertion, re-read the ` +
        "out-of-area board's provenance paragraph (out-of-area-board.tsx): it tells the reader this list is " +
        "seeded and not live, and admissions in reducer state is what makes that false.",
    ).toEqual([]);
  });

  it("keeps every ADMISSION_SEED_ALLOWLIST entry pointing at a file that exists", () => {
    // A stale entry is an exemption for nothing, and it hides the day the real reader moves.
    const scanned = new Set(srcDirFiles().map(({ normalizedFile }) => normalizedFile));
    for (const allowed of ADMISSION_SEED_ALLOWLIST) {
      expect(scanned, `${allowed} is allow-listed but no longer exists`).toContain(allowed);
    }
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
    const scanned = srcDirFiles();
    expect(scanned.length).toBeGreaterThan(0);
  });

  it("restricts every read of NOW_ANCHOR under src to the named allow-list", () => {
    const offenders = srcDirFiles()
      .filter(({ normalizedFile }) => !NOW_ANCHOR_ALLOWLIST.has(normalizedFile))
      .filter(({ file, source }) => readsNowAnchor(source, file))
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  /**
   * Whole-branch review I1. Same failure mode as the two zero-match guards above, checked again
   * here: this specific check must not be able to pass by scanning nothing.
   */
  it("scans a non-empty set of src source files for the units-fixture allow-list check", () => {
    const scanned = srcDirFiles();
    expect(scanned.length).toBeGreaterThan(0);
  });

  /**
   * Whole-branch review I1: the units-capacity sibling of the NOW_ANCHOR restriction above, and
   * the guard that would have caught Critical 1. It enforces exactly one thing — no file under
   * `src` outside `UNITS_FIXTURE_ALLOWLIST` may hold a real identifier reference to `allUnits` or
   * `unitById` — and nothing broader: it says nothing about whether a component actually THREADS
   * the live `units` it receives correctly, only that it cannot reach for the frozen fixture as
   * an alternative in the first place.
   */
  it("restricts every read of allUnits/unitById under src to the named allow-list", () => {
    const offenders = srcDirFiles()
      .filter(({ normalizedFile }) => !UNITS_FIXTURE_ALLOWLIST.has(normalizedFile))
      .filter(({ file, source }) => readsUnitsFixture(source, file))
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
  });
});

describe("ED access target stays quarantined from the legal clock (Task 6A Minor 1)", () => {
  it("detects a real LegalForm construction, so the field-triple predicate cannot pass vacuously", () => {
    // Guards the two checks below against passing only because they never actually matched
    // anything: proves `constructsLegalForm` fires on a known-real construction (the fixture)
    // before trusting it to fire on a hypothetical bad one.
    const file = join(WARD_DIR, "ward-movements.ts");
    expect(constructsLegalForm(readFileSync(file, "utf8"), file)).toBe(true);
  });

  it("scans a non-empty set of src source files for the ED access target checks", () => {
    // Same failure mode as the other scans in this file, checked again here rather than only
    // relied upon there: these two checks must not be able to pass by scanning nothing.
    const scanned = srcDirFiles();
    expect(scanned.length).toBeGreaterThan(0);
  });

  // Direct/literal case only (see the scope comment above `LEGAL_FORM_REQUIRED_FIELDS`): fires
  // when a file spells out a fresh `{code, label, kind}` object literal AND references
  // `ED_ACCESS_TARGET_MINUTES` anywhere in that same file. It cannot see the constant reaching a
  // `LegalForm` through an intermediate variable, an aliased import, a spread, a helper in
  // another file, or direct mutation — Task 11's brief and review carry those shapes.
  it("never lets a file with a direct {code, label, kind} LegalForm literal also reference ED_ACCESS_TARGET_MINUTES", () => {
    const offenders = srcDirFiles()
      .filter(({ file, source }) => constructsLegalForm(source, file) && referencesEdAccessTarget(source, file))
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  // Direct/literal case only (see the scope comment above `LEGAL_FORM_REQUIRED_FIELDS`): fires
  // when a `dueAt` property's initializer expression directly references
  // `ED_ACCESS_TARGET_MINUTES`. It cannot see the same indirections listed above — an
  // intermediate variable, an aliased import, a spread, a helper in another file, or direct
  // mutation after construction — Task 11's brief and review carry those shapes.
  it("never assigns dueAt: ED_ACCESS_TARGET_MINUTES as a direct property initializer", () => {
    const offenders = srcDirFiles()
      .filter(({ file, source }) => assignsDueAtFromEdAccessTarget(source, file))
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
  });
});
