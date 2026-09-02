# Re-export blindness sweep — is `ward-referral-matching.test.ts`'s hole a pattern?

Read at `codex/task-ward-flow-live-state-20260831` = `425fba106b58f99f38aa2b775e8837bda154ca35`,
via `git show <sha>:<path>` / `git archive <sha> -- tests` into a scratch extraction (no working-tree
reads). No files edited; this report is the only file created.

## The confirmed defect (context, not re-derived here)

`tests/ward-referral-matching.test.ts`'s own `collectModuleGraph`/`importStatementsOf` walks
`source.match(/import\s+[\s\S]*?;/g)` only. It never looks at `export … from` statements, so a
passthrough module (`export { BedRelease } from "./ward-model"`) is visited, found to contain no
`import` statement, and the walk stops without reaching what it re-exports.

## Coverage figures (required)

- **Enumerated:** 1069 files under `tests/` at the pinned commit (via `git ls-tree`, screenshots
  excluded).
- **Opened in full or substantially:** 24 files — the 4 confirmed-relevant Ward Flow files, the 2
  shared architecture-boundary files, `tests/helpers/module-graph.ts`, and 17 further candidates
  found through targeted keyword search (`queue`/`entryFiles`/`collectModuleGraph`, `readdirSync`
  - `readFileSync`, boundary/contract/guard filename patterns). Two of the largest (`rsc-boundary
.test.ts` at 1699 lines, `ward-legal-figure-guard.test.ts` at 1730 lines) were read to the point
    the graph-construction logic was fully visible (~1400 and ~1030 lines respectively) — the
    unread remainder is fixtures/assertions, not additional graph-building code.
- **Judged by pattern/grep alone:** roughly 40 further files matched broad greps (`readFileSync`,
  `"from"` + quote, `boundary|seam|graph|isolation`) that were ruled out by a second, narrower
  grep showing the match was unrelated (SQL/CSS comment-stripping locals also named
  `withoutComments`, a single-file text check, or an exhaustive non-graph scan) — not by opening
  the file. This is a pattern scan, not a full read, for that set.
- **Could not resolve / not reached at all:** the remaining ~1000 files were never searched
  individually beyond the keyword passes above. A test that builds an import/module graph using
  vocabulary this sweep didn't search for (a helper function or local named neither "queue" nor
  "collectModuleGraph" nor "entryFiles", with no boundary/seam/contract/guard-shaped filename)
  would not have surfaced. This is a real gap, not a formality — the brief's own worked example
  was found only because its filename and doc comments were distinctive.

## BLIND

**`tests/ward-referral-screen-boundary.test.ts`** — enforces FD-23 (a ward-facing screen may reach
referral data only through the ward-scoped projection, per the owner's 2026-08-30 ruling that "a
ward cannot see where else a patient has been referred"). Its own comment says the module-graph
machinery is "lifted from `tests/ward-referral-matching.test.ts`'s D15 contract... `collectModuleGraph`,
`scanSource` and the two tests that pin the comment scanner are lifted from there deliberately."
The lift is verbatim: `importStatementsOf` (line 333) is `withoutComments(source).match(/import\s+[\s\S]*?;/g) ?? []`
— the identical regex, never matching `export … from`. **Smallest edit that slips past it:** add a
barrel file under the ward-only subgraph, e.g. `export { Referral } from "./ward-model";`, imported
by a ward-facing component as `import { Referral } from "./referral-barrel"`. `FULL_REFERRAL_VOCABULARY`
would flag the identifier `Referral` if it appeared in an _import statement_ the walk reaches, but the
walk never reaches the barrel's re-export line to discover it forwards `Referral`, and the ward
component's own import of the barrel names no forbidden identifier either (it imports `Referral` from
a specifier the vocabulary check doesn't recognise as referral-bearing, since `REFERRAL_BEARING_MODULES`
only matches the _target_ module names `ward-model`/`ward-referrals`/`ward-referral-visibility`, not an
arbitrary barrel). This is the same class of hole as the original, on a privacy/visibility boundary
rather than a matching-independence contract — arguably higher-consequence, since it is the guard
against a ward screen leaking a patient's other referral destinations.

**`tests/ward-referral-matching.test.ts`** — already confirmed by the brief; not re-derived.

No other file in the 24 opened, and none of the ~40 ruled out by narrower grep, reproduces this
exact regex-only-import scanner.

## NOT BLIND (built or reused a re-export-aware mechanism)

| File                                                                            | Rule                                                                                                                                                        | Mechanism                                                                                                                                                                                                  | Why not blind                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/architecture-boundaries.test.ts`                                         | No runtime import cycles; server/provider modules stay out of the client graph; no runtime→scripts imports; no static/dynamic import collision              | Shared `runtimeGraph()`/`moduleSpecifiersFromSource` in `tests/helpers/module-graph.ts`, `@babel/parser` AST                                                                                               | `moduleSpecifiersFromSource` explicitly handles `ExportNamedDeclaration`/`ExportAllDeclaration` with a `source` (lines 55–67 of the helper), adding them to `staticImports` unless type-only                                                                                     |
| `tests/rsc-boundary.test.ts`                                                    | RSC boundary: no server-side event handler, no server module reading client-exported data                                                                   | Own `moduleComponents()` AST walk (babel) tracking `reExports`/`starReExports`, `exportedBindingIsClient`/`exportIsFunction` recurse through them with a `seen` cycle guard                                | Explicitly follows named, default and star re-export barrels in both check A and check B; has a dedicated test ("reports a handler rendered through a client component re-exported by a barrel") pinning exactly this case                                                       |
| `tests/ward-flow-seam.test.ts`                                                  | Ward Flow reaches outward only for 7 approved shared modules; nothing outside imports ward code; no relative escape; route hardcoded only in 4 named places | `ts.createSourceFile`, and `moduleSpecifiers()` checks `ts.isImportDeclaration(node) \|\| ts.isExportDeclaration(node)` (line 110)                                                                         | Explicitly captures `export … from` via the real TS AST; also exhaustively scans every file directly rather than transitively walking from entry points, so a re-exporting file's own export statement is inspected regardless                                                   |
| `tests/ward-flow-data-boundary.test.ts`                                         | No file outside the data layer states a ward/site/department name                                                                                           | `ts.createSourceFile`, collects string literals only                                                                                                                                                       | No import/export graph walk at all — exhaustively scans every `.ts(x)` file under two ward dirs directly, so nothing to "lose track of"                                                                                                                                          |
| `tests/ward-legal-figure-guard.test.ts` (Part 3, the identifier denylist)       | No fabricated MHA duration figure reaches a legal form                                                                                                      | `ts.createSourceFile`, collects every `ts.isIdentifier` occurrence per file                                                                                                                                | Exhaustive per-file identifier scan across the whole ward directory, not entry-point graph traversal — a re-export barrel that never names the identifier is irrelevant, because the actual _reader_ must still name the identifier to use it, and that file is scanned directly |
| `tests/ward-flow-single-source.test.ts`                                         | Only named files read `NOW_ANCHOR`/the admissions seed                                                                                                      | Same exhaustive per-file `ts.isIdentifier` scan pattern as above                                                                                                                                           | Same reasoning — direct identifier occurrence, not import-graph reachability                                                                                                                                                                                                     |
| `tests/forms-client-boundary.test.ts`                                           | `@/lib/forms` value-import never reaches a client module graph                                                                                              | Regex `FROM_STATEMENT_PATTERN = /^(import\|export)\s+([\s\S]+?)\s+from\s+["']([^"']+)["']/gm`, BFS over `valueImports` built from both keywords                                                            | The graph-construction regex captures `import` **and** `export` `... from` (including bare `export * from`) identically, so `valueImports` already includes re-export edges before the BFS runs                                                                                  |
| `tests/services-client-boundary.test.ts`                                        | `@/lib/services` value-import never reaches a client module graph                                                                                           | Identical mechanism to `forms-client-boundary.test.ts` (explicit sibling/mirror); doc comment states "star re-export, and value re-export forms are treated as runtime"                                    | Same `(import\|export)...from` regex                                                                                                                                                                                                                                             |
| `tests/cross-mode-differentials-index.test.ts`                                  | The lazy cross-mode chunk's resolved import graph never reaches the full differentials snapshot                                                             | Same `(import\|export)...from` regex + BFS, applied from one real entry point (`cross-mode-differentials.ts`)                                                                                              | Same mechanism as the two client-boundary tests above                                                                                                                                                                                                                            |
| `tests/search-results-band-adoption.test.ts`                                    | (component-adoption reachability check within this file)                                                                                                    | Babel AST module graph explicitly modelling `graph.reexports` and `graph.starReExports` (`ExportNamedDeclaration`/`ExportAllDeclaration` handling, `nextHops` follows re-exports "by their own semantics") | Most explicit of the group — a dedicated `reexports` array followed by export-name matching, not simplified away                                                                                                                                                                 |
| `tests/client-secret-surface.test.ts`                                           | No client module graph reaches `src/lib/env.ts` (server secrets)                                                                                            | `@babel/parser` AST; `localImports()` explicitly checks `statement.type === "ExportNamedDeclaration" \|\| statement.type === "ExportAllDeclaration"` alongside `ImportDeclaration`                         | Explicit re-export handling in the graph edge collector, DFS with cycle guard via `visiting`                                                                                                                                                                                     |
| `tests/caring-contacts-domain-isolation.test.ts`                                | The caring-contacts domain imports nothing external and never escapes its own directory                                                                     | Regex `\b(?:from\|import\|require)\s*\(?\s*["']([^"']+)["']/g`, applied to every file directly (no graph walk needed)                                                                                      | The regex matches the `from` keyword itself, so `export { send } from "./dispatch"` is captured — proven by the file's own test asserting that exact fixture line extracts `"./dispatch"`                                                                                        |
| `tests/retrieval-owner-filter-guard.test.ts`, `tests/owner-scope-guard.test.ts` | Every API route directly queries only owner-scoped tables                                                                                                   | `ts.createSourceFile`/AST, scans each `route.ts` file's own `.from("table")` calls directly                                                                                                                | No import-graph traversal at all — every route file under the API directory is read and analysed on its own, so a re-export elsewhere is irrelevant to what this rule checks                                                                                                     |

## N-A (reads source text but does not traverse a module/import graph)

These enforce a rule by reading one or a handful of named files directly, or by reading whole-file
text/identifiers exhaustively without ever following an import edge — there is no "walk" for a
re-export to hide from:

`tests/dsm-category-colour-boundary.test.ts`, `tests/calculator-mockup-boundary.test.ts`,
`tests/production-mockup-boundary.test.ts`, `tests/favourites-demo-boundary.test.ts`,
`tests/mode-home-loading-contract.test.ts`, `tests/chip-contract.test.ts`,
`tests/api-validation-contract.test.ts`, `tests/hosted-migration-role-guard.test.ts`,
`tests/installed-lock-parity.test.ts`, `tests/test-runner-safety.test.ts`,
`tests/ward-travel-grouping.test.ts` (its "only ward-distance.ts reads the fixture" test is an
exhaustive whole-`src`-directory text scan, not a graph walk — separately, it duplicates
`ward-referral-matching.test.ts`'s comment-scanner `scanSource`/`withoutComments` for its own
purposes and pins that copy with its own tests, but does not duplicate `collectModuleGraph`).

## False positives ruled out (matched a grep, not the pattern)

`tests/caring-contacts-migrations.test.ts`, `tests/ckb-v2-token-contract.test.ts`,
`tests/empty-catch-disposition.test.ts`, `tests/pwa-lifecycle.dom.test.tsx`,
`tests/ui-style-contract.spec.ts` — each has an unrelated local variable also named
`withoutComments`, stripping SQL or CSS comments, nothing to do with import graphs.

## What this sweep did NOT cover

- The ~1000 files never individually opened or grepped beyond the keyword passes listed above. A
  graph-walker using different vocabulary (no "queue", "entryFiles", "collectModuleGraph", and a
  filename not shaped like `*-boundary`/`*-seam`/`*-contract`/`*-guard`) would not have surfaced.
- Files under `tests/` that are Playwright specs (`*.spec.ts`) were included in the enumeration and
  keyword passes but not specifically read end-to-end for graph-walking logic, beyond the ones the
  keyword search already surfaced (`ui-style-contract.spec.ts`, ruled a false positive).
- No attempt was made to statically prove the _absence_ of a third BLIND file beyond the two found;
  this is a targeted sweep against a known defect shape, not an exhaustive proof.
