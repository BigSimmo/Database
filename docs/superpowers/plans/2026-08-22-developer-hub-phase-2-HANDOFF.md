# Developer hub Phase 2 — handoff

Companion to the plan (`2026-08-22-developer-hub-phase-2.md`) and the approved spec
(`docs/superpowers/specs/2026-08-22-developer-hub-phase-2-design.md`).

**Status 2026-08-26: COMPLETE AND MERGED. Nothing in this phase is outstanding.** Read
this status note first; the rest of the file is the 2026-08-24 "at completion" write-up and
remains accurate for what Tasks 6-13 built and how they were verified.

The route this work took is worth recording, because the confusion in the middle of it is the
trap most worth not repeating:

| PR      | What it carried                                                                                                                                                                                                   |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `#2292` | Phase 2 Tasks 1-5 — the snapshot generator, and only that                                                                                                                                                         |
| `#2345` | Tasks 6-13. **Closed by the owner as a presumed duplicate of `#2292`. It was not** — `main` at that moment held a generator nothing called: no gate, no reader, no committed snapshot, and none of the four pages |
| `#2359` | Tasks 6-13 brought onto current `main`, carrying forward everything `#2345` had built                                                                                                                             |
| `#2366` | `PanelSection` extracted and section metadata cleaned — two of the three review findings §6 below records as deferred                                                                                             |
| `#2371` | Phase 3's live ingestion panel, and four placeholder panels removed for restating facts a green gate already guarantees                                                                                           |
| `#2372` | The issue-ledger reconciliation, and the owner's ruling that the hazard register stays in the hub                                                                                                                 |

An earlier revision of this file said the branch might exist only on one machine with no PR
opened. That claim was false and inherited unchecked, and it is what led to `#2345` being
closed. One open-PR query against the remote would have settled it. Never carry a "no PR yet"
claim forward without checking it.

---

## 1. Status

|              |                                                                                                                                                                                                                                                                                                                          |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Worktree     | `D:/Worktrees/Database/dev-hub-phase-1` — **not** `.claude/worktrees`, which has been wiped repeatedly                                                                                                                                                                                                                   |
| Branches     | All merged and finished: `claude/dev-hub-phase-2-plan` (`#2292`, `#2345`), the recovery branch (`#2359`), `claude/dev-hub-phase-3-plan` (`#2371`), `claude/issues-reconcile-2026-08-26` (`#2372`). All squash-merged, so `git merge-base --is-ancestor` reports them **unmerged** — verify by content, never by ancestry |
| Dependencies | Installed. Do **not** run `npm ci`; for a fresh worktree use `node scripts/setup-codex-worktree.mjs`                                                                                                                                                                                                                     |

## 2. What shipped

One generator reads four on-disk sources and writes a committed `data/repo-awareness-snapshot.json`.
One gate keeps it in step. One typed reader statically imports it. Four Server Component pages render
it, and the hub links to all four.

| Path                                 | What it answers                                                                                                                          |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `/mockups/development/routes`        | What pages, modes, redirects and API routes exist                                                                                        |
| `/mockups/development/documentation` | What documents exist, in which section, and whether the curated index lists them                                                         |
| `/mockups/development/test-health`   | What is quarantined and until when — currently nothing, said in words                                                                    |
| `/mockups/development/review-state`  | Which branches were reviewed, at which head, with what outcome                                                                           |
| `/mockups/development/ingestion`     | Whether an uploaded document actually indexed — added later by `#2371`, and the only panel that reads live data rather than the snapshot |

`work-in-flight` kept its id (ruling R9) and became **"Review state"**. The page says in its own words
that it shows review history and **not** open pull requests or their CI, so a reader cannot infer that
an absent branch has no PR.

## 3. Verification actually run, at HEAD `11b84f25c` (the old branch, pre-recovery)

| Gate                          | Result                                                                                                                                                              |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run build`               | exit 0; `Compiled successfully in 67s`; `Finished TypeScript in 64s`; no `Failed to type check`; all six developer routes Dynamic                                   |
| Live render, five routes      | all 200; zero `Event handlers cannot be passed`; back-link test id served; zero escaped pipes                                                                       |
| `npm run verify:pr-local`     | 24/28 checks completed; `test` fails **only** on two proven-environmental `gate-receipts` cases; the four checks it never reached were run individually, all exit 0 |
| `npm run verify:phone-chrome` | exit 0; 133/133; focused coverage sufficient, no escalation to `verify:ui`                                                                                          |
| Snapshot determinism          | two consecutive runs byte-identical; `git status` clean; gate reports "in step"                                                                                     |

This table is the pre-recovery record. The recovery branch's own merge resolution and verification
are recorded in `.superpowers/sdd/2026-08-22-developer-hub-phase-2/recovery-report.md`.

## 4. The known-failing baseline in the old plan is STALE — do not trust it

The plan and the original handoff both say to expect `tests/codex-cloud-setup.test.ts` (2) and
`tests/design-sync-contract.test.ts` (1). **Neither failed.** The current environmental failures are
two cases in `tests/gate-receipts.test.ts`, which chmod a fixture to `0o644` then `0o755` and require
different signatures. Measured on this filesystem: both yield mode `666` — chmod is a no-op on this
Windows ReFS Dev Drive, so the test cannot distinguish them here. The file predates this branch.

Classify failures by mechanism, not by matching a name against a list that has already gone stale once.

## 5. Traps this branch paid for — carry these forward

- **Only a real build sees some defects.** A page module exporting anything beyond `default`/`metadata`
  is a hard failure against Next's generated `.next/types/**` validator — invisible to
  `typecheck:source` (source-only), Vitest (imports the module directly), and lint. It shipped through
  13 tasks and 2 reviewers and was caught by the acceptance build. **Read both signals**: the failing
  build also printed `Compiled successfully`, which only means webpack finished.
- **Filtered test runs hide repo-wide contract breaks.** Ruling S2 had implementers run filtered
  suites, correctly — a full run serialises every agent on this machine. The cost is that Task 1's
  extraction of the back-arrow into a non-`mockup` path broke
  `tests/contextual-back-navigation-contract.test.ts` and nobody saw it for 13 tasks. Budget one full
  suite run at a mid-branch checkpoint, not only at the end.
- **Three signals on this branch meant the opposite of how they read.** `grep -c` returning 0 exits 1
  and silently truncates an `&&` chain; `grep '\|'` is alternation in BRE and matches everything;
  `verify:phone-chrome` prints `stage "focused-browser" failed` as **stderr from a passing test**.
  Each nearly produced a wrong report. Read the surrounding lines, always.
- **Format is in no other gate.** `lint`, `typecheck` and 8004 unit tests were green on nine
  unformatted files. `npm run format` exceeds this machine's tool timeout — run `npx prettier --write`
  on the changed files instead, and **commit the result**; a push sends commits, not your working tree.
- **The plan's own determinism instruction cannot pass.** It says regenerate twice and confirm
  `git status` is clean, but `docs/` and `src/app` are revision inputs, so the first regeneration after
  any commit legitimately moves `captured_revision`. The right check is that two consecutive runs are
  byte-identical.
- **Dispatching implementers.** Every dispatch must carry: an explicit Bash `timeout` of 600000; use
  `npm run test`, never `test:focused`; never pipe a gate through `tail`/`head`/`grep`; run
  `typecheck:source` too; never force the run-coordinator lock; verify the branch before committing.
  Retry the lock inline within your own turn — never hand waiting to a background job, monitor or
  scheduled wake-up. A subagent's background work dies with its turn.
- **Checks that cannot fail.** Before accepting any test, name the concrete source edit that turns it
  red, and where it matters, _watch it fail_.
- **Lock contention is the dominant cost.** Other sessions on this machine can hold the exclusive
  Playwright/typecheck lease; single gate acquisitions have taken up to 28 minutes.

## 6. Deliberately left undone

1. **No phone-viewport proof.** Server-render and jsdom only, as in Phase 1. Desktop-first by the
   owner's choice; the gap is real and stated.
2. **The environment strip was three-quarters unwired at the end of Phase 2** — `isDemoMode()`, the
   signed-in email, the document count. Spec §3 defers these to the phase that owns their data source.
   **Now closed (2026-09-01), with the owner's approval for the Supabase read that spec §3 reserved.**
   All four facts are wired. `isDemoMode()` is a synchronous env read. The signed-in email and the
   document count come from `src/lib/developer-area/environment-facts.ts` in one Supabase round trip,
   which is what makes the hub page an async Server Component — the change that also made the dom
   tests and the shared route table in `tests/in-page-nav-route-sections.dom.test.tsx` await their
   fixtures. Two rules in that module are load-bearing and are pinned by mutation-checked tests: the
   count is scoped to the caller's own documents by row-level security rather than by application
   code, and every failure path reports `null` ("document count unavailable") rather than `0`, so an
   empty corpus can never be confused with a read that failed.

3. **One panel remains a declared placeholder**: `hazard-register` (phase 4). Four others were
   removed in `#2371` for restating facts a green gate already guarantees, and `ingestion` was
   built. The owner ruled on 2026-08-26 that the hazard register belongs in this hub rather than
   as a separate clinical-safety surface — it is unbuilt, not unwanted. Building it is still a
   phase flip plus an href; the registry mechanism is unchanged.
4. **Spec open questions 2 and 3 are answered "no"** by rulings R1 and R3. To get orphan-route or
   document-age reporting, overturn those rulings; they are an argument, not an oversight.
5. **Three review findings were deferred by controller ruling; two have since landed.** `#2366`
   extracted the `PanelSection` primitive for the 17 repeated `<section aria-labelledby>` blocks
   and cleaned up the two per-section documentation counts that were emitted and never read. The
   `.prettierignore` asymmetry is the one still open, and it is cosmetic.
6. **`/review-state` renders 1.73 MB of HTML** — 454 records, deliberately unpaginated so the list can
   never disagree with its own count. Measured here for the first time. No gate watches it:
   `check:bundle-budget` weighs client JavaScript and these pages ship none. A future option is
   collapsible grouping by year as presentation only, never filtering.
7. **The snapshot is a conflict surface.** `docs/branch-review-records/` grows monotonically and is a
   generator input, so every ledger-appending PR must regenerate the snapshot — the same concurrent-PR
   collision that `ledger:append`'s immutable records were designed to escape.
8. **The staleness gate needs git.** It now sits in `verify:cheap`, `verify:pr-local` and CI, and shells
   out to `git ls-files`/`git log`. What it does in a git-less checkout — a `git archive` export, the
   very technique spec §8.2 names — has never been established.

## 7. Working notes

The session ledger, task briefs and reviewer reports live in the git-ignored
`.superpowers/sdd/2026-08-22-developer-hub-phase-2/`, with a copy outside the worktree at
`…/scratchpad/sdd-backup/`. It was preserved through the `#2345`/`#2359` recovery as the map back to work that
looked lost. That recovery is finished and everything it held is merged, so the directory is now
ordinary scratch — safe to delete, and safe to ignore. Everything a resuming session actually
needs is in this file, the plan, and the spec.

## 8. Outstanding for the owner, unrelated to this phase

Point-in-time recovery is still **off** on the live Supabase database (`#1K6T35`). Only the owner can
turn it on, from the Supabase dashboard.
