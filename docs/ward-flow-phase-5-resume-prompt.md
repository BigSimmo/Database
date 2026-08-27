# Ward Flow Phase 5 — resume prompt

Paste everything between the two rules into a fresh Claude Code session on the workstation. It is
written to be self-contained: it names the branch, the one open decision, the reading order, and the
constraints that override everything else.

---

I am resuming **Ward Flow Phase 5** on the `BigSimmo/Database` repository. A previous session built
it, opened the pull request, and left one check red. Do not start fresh work — continue this.

## Start here, in this order

1. `git fetch origin claude/ward-flow-phase-5-p8rwcm && git checkout claude/ward-flow-phase-5-p8rwcm`
2. **Read `docs/ward-flow-phase-5-handover.md` in full before doing anything else.** It is the master
   handover: what was built, what is proven and by what evidence, what is still red, the defects
   found and fixed, and the process traps that cost the last session time. Everything below is a
   summary of it.
3. Read the binding spec: `docs/superpowers/specs/2026-08-26-ward-flow-phase-5-bed-availability-design.md`
   (14 decisions, D1–D14). Where the spec and anything else disagree, **the spec wins**.
4. Read `AGENTS.md` and `CLAUDE.md` — repository rules and gates. These override generic habits.

## Where things stand

- **Branch:** `claude/ward-flow-phase-5-p8rwcm` · **Pull request:** #2390, open, not draft.
- **Phase 5 is functionally complete.** Every planned task is built, reviewed and pushed, including
  all four findings from automated code review (one was a real P1).
- The last commit that changed _code_ is `400cedd9`. Commits after it are documentation. Check the
  branch tip rather than assuming a SHA.
- **One check is red: `Build`, on `check:bundle-budget`.** It needs a decision, not more code. See
  below. Nothing else is known-red.

## The one open decision — do not act on it unilaterally

`check:bundle-budget` fails the **mockups** bucket at **+25.7%** against a **25%** ceiling.

Measured, not estimated (both from a clean `rm -rf .next && npm run build`):

| Ref                      | mockups bucket | vs baseline 487.6 KiB |
| ------------------------ | -------------- | --------------------- |
| clean `origin/main`      | 608.1 KiB      | **+24.7%**            |
| this branch (`400cedd9`) | 613.1 KiB      | **+25.7%**            |

`main` is already at +24.7%, so **~96% of the overage predates this branch**; Phase 5 adds one
percentage point and merely tips it over. Production is unaffected — 1660.7 KiB on main against
1661.2 KiB here, a 0.5 KiB difference, and within tolerance either way. This is outstanding issue
`#QSHHGK` happening exactly as written.

**The trap:** `npm run check:bundle-budget -- --update` rewrites **every** baseline in
`bundle-budget.json` — production and per-route included — so it would silently re-baseline
production's own drift. The conservative fix is to refresh **only** `mockups.gzipBytes`.

**This is the product owner's call.** It is a repo-wide config change governing every future pull
request. Ask before changing it; do not decide it for them.

## Constraints that override everything

1. **Never invent a legal figure.** Nothing from the Mental Health Act may be cited, paraphrased or
   inferred — not in code, copy, comment, test or fixture. If a figure is needed, stop and ask.
2. **Synthetic data only.** No name, date of birth, medical record number, address, diagnosis,
   narrative history or treatment. Sex is the only permitted patient attribute, and spec D11
   excludes even that from bed releases and leave beds. Free text counts as data.
3. **Local and offline checks only.** Never run `verify:release`, any `eval:*` script,
   `check:supabase-project`, `test:live`, or anything touching OpenAI, Supabase, hosted CI or a live
   database.
4. **The rule the phase exists to hold:** nothing predicted, confirmed-but-unreleased, or on leave is
   ever added into "available now".
5. **Never** force-push, `git reset --hard`, or discard either side of a diverged branch. Never
   delete a worktree unasked. Never kill background processes without inventorying them first.
6. **Do not skip a gate, delete an assertion, loosen a test, or lower a tolerance.** If a change
   would reduce what can honestly be claimed, do not make it — say so instead.

## Document map

**Phase 5 — the current work**

| Document                                                                         | What it carries                                                           |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `docs/ward-flow-phase-5-handover.md`                                             | **Master handover.** Read first. State, evidence, what is red, next steps |
| `docs/superpowers/specs/2026-08-26-ward-flow-phase-5-bed-availability-design.md` | **Binding spec**, D1–D14. Wins every conflict                             |
| `docs/superpowers/plans/2026-08-26-ward-flow-phase-5-bed-availability.md`        | The implementation plan that was executed                                 |
| `docs/ward-flow-phase-5-kickoff-prompt.md`                                       | The original brief this phase was built from                              |
| `docs/ward-flow-complete-ledger.md` §5d                                          | What was built, what the screenshots caught, what is open                 |

**Ward Flow — direction and history**

| Document                                                                          | What it carries                                      |
| --------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `docs/ward-flow-roadmap.md`                                                       | **Settled decisions, phase order, refusals + why**   |
| `docs/ward-flow-phase-handoff.md`                                                 | State of work in flight across phases                |
| `docs/ward-flow-context.md`                                                       | Background and problem framing                       |
| `docs/ward-management-decisions.md`                                               | Phase 1–3 rulings                                    |
| `docs/ward-management-context.md` · `docs/ward-management-mode-map.md`            | Earlier context and the mode map                     |
| `docs/ward-flow-phase-3-handover.md` · `-ledger.md` · `-rulings.md`               | Phase 3's own handover set                           |
| `docs/superpowers/specs/2026-08-25-ward-flow-phase-4-specialist-boards-design.md` | **Phase 4 spec** — Phase 5 extends this, never forks |
| `docs/superpowers/specs/2026-08-19-ward-flow-phase-3-role-screens-design.md`      | Phase 3 spec                                         |
| `docs/superpowers/specs/2026-08-18-ward-flow-metro-patient-flow-design.md`        | The metro/patient-flow design                        |
| `docs/superpowers/specs/2026-08-14-ward-management-design.md`                     | The original ward-management design                  |

**Repository rules and gates**

| Document                          | What it carries                                        |
| --------------------------------- | ------------------------------------------------------ |
| `AGENTS.md`                       | **Rules, gates, shortcuts, safety boundaries**         |
| `CLAUDE.md`                       | Orientation: what the system is and how it is laid out |
| `docs/codebase-index.md`          | The deep map — start here for any real task            |
| `docs/process-hardening.md`       | Which gate to run for which change                     |
| `docs/testing.md`                 | Test execution, focused/live runs, flake policy        |
| `docs/wiring-conventions.md`      | Button wiring, navigation, new-route checklist         |
| `docs/search-chrome-behaviour.md` | Search chrome and phone composer contracts             |
| `docs/design-system/README.md`    | Tokens, component contracts, adoption                  |
| `docs/outstanding-issues.md`      | Cross-session memory — read with `/issues`             |
| `docs/site-map.md`                | Routes and modes (generated)                           |
| `bundle-budget.json`              | The three size budgets named in the open decision      |

**Code touched by Phase 5** — all under `src/components/ward-management/`: `ward-model.ts`,
`ward-flow-events.ts`, `ward-flow-reducer.ts`, `ward-bed-availability.ts`, `ward-change-reasons.ts`,
`ward-derivations.ts`, `ward-freshness.tsx`, `ward-movements.ts`, `discharges/discharge-board.tsx`,
`ward/ward-screen.tsx`, `ward-management-modes.tsx`; plus the route
`src/app/mockups/ward-flow/discharges/page.tsx`.

## What is owed before Phase 6

Both are recorded in `docs/ward-flow-roadmap.md`; neither blocks Phase 5.

1. **Spec D14 has never been checked by a ward clinician.** `predicted → confirmed → blocked →
released` is a software model of how a bed comes free; a bed may be confirmed and blocked at once
   in reality. Cheap to change while everything is synthetic, and Phase 6 is built entirely from
   these numbers, so the cost of it being wrong rises the moment Phase 6 lands.
2. **Design Phases 6 and 7 in one conversation, and 8 and 9 in another.** Each phase still gets its
   own written specification; only the conversation is shared.

## Traps that already cost this project time

- **Formatting is in none of `test`, `typecheck` or `lint`.** Run `npm run format` **and commit the
  result** before pushing.
- **`npm run lint` uses a per-file cache.** Clear `node_modules/.cache/eslint` first or a real
  failure stays invisible.
- **Generated files drift when a commit hook is skipped.** Regenerate with the repo's own tooling;
  never hand-edit `data/*-snapshot.json`.
- **`scripts/run-playwright.mjs` exits 0 when tests fail and when it refuses to run.** Read the
  "N passed" line; an exit code is not evidence.
- **`rm -rf .next` before any bundle measurement** — a cached build reports stale numbers as though
  they were fresh.
- **Never run tests while a helper agent is editing source.** The dev server rebuilds on change and
  produces failures that are not real.
- **Never assume `localhost:3000`.** Use `npm run ensure` and the URL it prints.
- Green tests are not proof the screen is right. Four real defects in this phase were caught only by
  screenshotting at 390 / 820 / 1440 and looking.
- Mutation-test every new test: break the thing it guards, watch it go red, restore.

## First actions

1. Read the master handover and the spec.
2. Confirm the branch state and what CI currently says on pull request #2390.
3. Put the bundle-budget decision to me with your recommendation. Do not change `bundle-budget.json`
   until I answer.
4. While waiting, settle the one known unknown in §9 of the handover: run
   `node scripts/run-playwright.mjs tests/ui-ward-roles.spec.ts --project=chromium-mockups` three
   times on a quiet tree, and three times on `origin/main` in a worktree. If it is this branch's
   regression, fix the product — never the assertion.

---
