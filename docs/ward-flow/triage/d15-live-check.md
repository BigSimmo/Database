# D15 live-defeat check — does the import-only guard miss a real path today?

**Read at:** `codex/task-ward-flow-live-state-20260831` = `b42b7e92268f5cda7016096bb1bbcab3f7c84a0c`
(working tree is stale; every claim below is from `git show <sha>:<path>`, not the checkout).

## Question

`tests/ward-referral-matching.test.ts`'s `collectModuleGraph`/`importStatementsOf` walk the
module graph from `ward-eligibility.ts` and `ward-referrals.ts` following only
`/\bimport\s+[\s\S]*?;/g` statements — never `export … from`. That is a real blind spot in the
_mechanism_. The question is whether the _current_ dependency graph actually contains an
`export … from` (or `export *`) edge that the guard would fail to follow, i.e. whether the
guard is defeated **today**, not just defeatable in principle.

## Method

Wrote a standalone Node script (not committed — scratch only) that reproduces the guard's own
`withoutComments` / statement-extraction / `@/` and relative-specifier resolution logic exactly,
but extends the statement regex to also capture `export {…} from "…"`, `export type {…} from "…"`,
and `export * from "…"`. Read every file via `git show b42b7e92268f5cda7016096bb1bbcab3f7c84a0c:<path>`
(never the working tree). BFS from both entry points, resolving `@/…` to `src/…` and `./…`
relative to the importing file's own git path, trying `.ts`, `.tsx`, `/index.ts`, `/index.tsx` —
identical resolution order to the guard.

## Control (run before trusting any negative result)

`ward-model.ts` is a file both entry points are known to reach (directly, via `import type`).
The traversal found it at depth 1 from both entries. **Control passed** — the method finds a
known path, so a "not found" result for the forbidden family is meaningful rather than a
methodology failure.

## Result

- **Closure size: 10 files. Max depth: 2 edges from the two entry points.**
- Files (depth): `ward-eligibility.ts` (0), `ward-referrals.ts` (0), `ward-clock.ts` (1),
  `ward-model.ts` (1), `ward-admissions.ts` (1), `ward-catchment.ts` (1), `ward-distance.ts` (1),
  `ward-change-reasons.ts` (2), `ward-diagnosis.ts` (2), `ward-travel-bands.ts` (2).
- **Zero `export … from` or `export *` statements exist anywhere in this 10-file closure** —
  confirmed two independent ways: (a) the script's own statement extractor, run against both
  `import` and `export…from` patterns, found none beyond what plain `import` already covers, so
  the import-only graph and the import+export-from graph are identical (both size 10, depth 2);
  (b) a manual `grep -nE "^\s*export\b.*from|^\s*export \*"` across all ten files independently,
  same empty result. Since there is no re-export edge in the graph at all, the guard's blindness
  to `export … from` has nothing to exploit right now.
- **`ward-bed-availability.ts` — one of the two files the forbidden family "lives mainly in" per
  the brief — is not reached at all**, at any depth, by either entry point.
- **`ward-model.ts` IS reached** (depth 1, via both entries), and it does define `BedRelease`
  (confirmed at the type declaration itself, `export type BedRelease = {…}`) plus the rest of the
  forbidden family. But neither entry point, nor any of the other 8 files in the closure, names
  any forbidden identifier in an import or export statement. Full import lists were read and
  checked by hand, not just regex-matched:
  - `ward-eligibility.ts` imports only `Instant`, and from `ward-model.ts`: `LegalStatus`,
    `Movement`, `Referral`, `Sex`, `SexDesignation`, `Unit`, `WardAddressing`,
    `WardReferralDestination`.
  - `ward-referrals.ts` imports `bedIsOccupied`/`Admission`, `formatElapsed`/`minutesUntil`/
    `Instant`, `lookupCatchment`, travel-band helpers, `candidateReason`/`referralEligibility`,
    and from `ward-model.ts` only `SUBURB_UNKNOWN_REASONS`/`suburbUnknownLabels`.
  - `ward-admissions.ts` and `ward-model.ts` itself both import `BedReleaseBlocker`/
    `BED_RELEASE_BLOCKERS` from `ward-change-reasons.ts` — this is the brief's named exclusion
    (a different, unrelated family) and correctly does **not** match the guard's own
    `\bBedRelease\b` word-boundary pattern (`BedReleaseBlocker` fails the trailing `\b` because
    the next character is a word character).
  - The three textual hits for the literal string `ward-bed-availability` anywhere in the closure
    are all inside block-comment prose in `ward-model.ts` (lines ~281, ~688, and the comment
    immediately above the `BedRelease` type declaration itself) — read individually and confirmed
    to be documentation, not code, so they carry no import/export statement to miss.
  - `ward-change-reasons.ts` and `ward-diagnosis.ts` have zero local imports (leaves).
    `ward-travel-bands.ts` imports only `HomeRegion` from `ward-model.ts` (already visited, no
    new depth).

## Verdict

**NOT DEFEATED TODAY** — closure is 10 files to depth 2, none names the forbidden `BedRelease`
family in any import or export statement, and the control (a known path to `ward-model.ts`)
confirmed the traversal method actually works rather than silently finding nothing everywhere.

## What was not covered

- The traversal follows only local specifiers (`@/…` and relative `./…`), exactly like the
  guard itself; it does not follow dynamic `import()`, `require()`, barrel re-exports through
  `node_modules`, or any non-static specifier. None were observed in the 10 files read, but a
  dynamic-import path was not separately searched for outside this closure.
- This checks the graph as of this one commit only. It says nothing about whether a future edit
  could introduce a re-export edge the guard would then fail to see — that risk is exactly what
  made the original finding worth raising, and it stands regardless of this result.
- I did not re-run the actual Vitest suite (read-only task, no test execution permitted) — this
  is an independent reproduction of the guard's traversal logic against `git show` file contents,
  not a run of the committed test file itself.
