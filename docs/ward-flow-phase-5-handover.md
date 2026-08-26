# Ward Flow Phase 5 — cold-start handover

**Written 2026-08-26 for a session that has no prior context.** Read this file first, then the two
it points at. You should not need the conversation that produced it.

---

## 1. Read in this order

| Order | File                                                                             | Why                                                                                                    |
| ----- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 1     | this file                                                                        | orientation, traps, and how to start                                                                   |
| 2     | `docs/superpowers/specs/2026-08-26-ward-flow-phase-5-bed-availability-design.md` | **binding authority.** Fourteen numbered decisions. Where anything disagrees with anything, this wins. |
| 3     | `docs/superpowers/plans/2026-08-26-ward-flow-phase-5-bed-availability.md`        | the eight-task implementation plan, with code                                                          |
| 4     | `docs/ward-flow-roadmap.md`                                                      | settled direction and the sixteen product decisions. Do not re-litigate these.                         |
| 5     | `docs/ward-flow-complete-ledger.md`                                              | the whole project's history, Phases 1 to 5                                                             |

Everything else is optional. `docs/ward-flow-context.md` has the original problem statement if you
want the why.

## 2. What this is, in three sentences

Ward Flow is a synthetic, offline prototype of a psychiatric bed-flow hub for Western Australia,
built for a practising psychiatrist in Perth. It coordinates a patient from the community mental
health team's decision to admit, through the emergency department, to an inpatient bed — and, from
Phase 5 onward, back out again through discharge. It is **not** clinical decision support, it holds
**no** real data, and it is reachable only through the administrator-gated developer hub.

## 3. Non-negotiable constraints

These come from the product owner directly and override anything else you read.

- **Never invent a legal figure.** Never cite, paraphrase or infer any figure or requirement from
  the Mental Health Act — not in code, copy, comment, test or fixture. If one is needed, stop and
  ask. This is why the statutory clock board is unbuilt.
- **Synthetic data only.** No name, date of birth, medical record number, address, diagnosis,
  narrative history or treatment. **Sex is the only permitted patient attribute**, and even that is
  excluded from bed releases and leave beds by spec D11. Free text counts as data.
- **Local and offline checks only.** Never run `verify:release`, any `eval:*` script,
  `check:supabase-project`, `test:live`, or anything touching OpenAI, Supabase, hosted CI or a live
  database.
- **Never force-push, `git reset --hard`, or discard either side of a diverged branch.** Never
  `git checkout --` a file with uncommitted changes without backing it up first.
- **Never delete a worktree** without being asked. A `git` refusal to remove one means stop, not
  retry with `--force`.
- **Do not kill background processes without inventorying them first.**

## 4. Where things stand

**Built and merged into the prototype:** Phases 1–3 (the movement model, the coordinator screen,
the four role screens), Phase 4 (handover, escalation, patient search, the role switcher, the demo
clock, capacity columns, bed releases, the change audit, effectiveness numbers).

**Built on 2026-08-26 and pushed to PR #2373 on branch `claude/ward-flow-phase-4-spec`:** the
sandbox move to `/mockups/ward-flow`, and a complete sidebar rebuild — a phone drawer below 40rem,
the icon rail from 40rem, an optional 17rem labelled panel from 64rem whose state persists. That PR
also carries the Phase 5 spec, the plan, the roadmap, and three outstanding-work inbox requests.

**Designed but not built:** Phase 5, which this handover is for.

**Deliberately unbuilt:** the statutory clock board (needs real legal figures from the product
owner), and redirects for old Ward Flow addresses (the owner chose to leave them broken).

## 5. What Phase 5 is

Bed availability becomes a number you can plan against. Nothing else.

1. A bed release gains a lifecycle: `predicted → confirmed → blocked → released`. Only a ward may
   move it. A coordinator may look, and may mark a ward's count as refresh-requested — that is the
   only thing a coordinator can do to a ward's bed data, and it changes no number.
2. Leave beds become their own type, never merged into availability.
3. A discharge and egress board, blocked rows first because those are the ones somebody must act on.
4. Predicted capacity for **today only**, in four bands, with "tonight" ending at **22:00**.
5. A freshness stamp on every board — today only the capacity board has one.

**The single most important rule in the phase:** nothing predicted, confirmed-but-unreleased, or on
leave is ever added into "available now". A coordinator must be able to point at one number and say
"that is a bed I can fill this minute".

**Important:** Phase 4 already built the `BedRelease` type, its fixed blocker list, its ward-only
flag event, and the ward's flagging panel. Phase 5 **extends** these. Do not build a parallel
concept.

## 6. How to start

Take a fresh worktree and branch off latest `main` — do **not** continue on
`claude/ward-flow-phase-4-spec`, which is a different piece of work with its own open PR. The
repository has a `newtask` skill for exactly this.

Then work the plan with **subagent-driven development**, shaped around this repository's real
bottleneck:

- **Task 1 is serial and first.** Everything reads its types.
- **Then fan out:** Tasks 2, 3 and 4 concurrently, then 5, 6 and 7 concurrently.
- **Each implementer runs only its own focused test file.** The repository allows two focused test
  leases at a time and serialises everything heavier across every worktree on the machine.
- **Run the expensive gates once, in Task 8** — full suite, typecheck, lint, format, browser,
  screenshots. Running them after every task is what makes this slow.
- **Assemble every commit before the first push.** A push mid-run cancels the checks already running
  and restarts them.

## 7. Traps that have actually cost time here

Every one of these has bitten this project. They are not hypothetical.

1. **`node scripts/run-playwright.mjs` exits `0` when tests fail.** It also exits `0` when it
   refuses to run at all. Read the `N passed` line; never the exit code. The same is true of some
   wrapper scripts.
2. **`DATABASE_HEAVY_RUN_ADMISSION_BUSY` and `EPERM … owner.json` mean the command did not run.**
   Another worktree on this machine holds the shared lock. Retry after ~45 seconds; never report it
   as a pass, and never conclude the check is broken.
3. **Green tests are not proof the screen is right.** Four separate defects — the prototype wearing
   the host application's name, a logo linking out of the sandbox, a phone board crushing its own
   table, a sidebar duplicating its own title — passed every structural check and were found only by
   looking at a screenshot. **Take screenshots at 390px, 820px and 1440px, and look at them.**
4. **Mutation-test every new test.** One phone-contract check passed with the exact rule it guarded
   deleted, because its assertion substring also matched a different selector further down the file.
5. **Do not run two sessions in the same worktree folder, or two sessions aimed at the same PR.**
   On 2026-08-26 that produced a merge with conflicts and an edit to a test that broke it in a way
   only a browser run could find.
6. **Prettier never converges on the Phase 4 plan file.** Two `--write` passes leave thirty lines
   differing. If a format guard blocks a push solely on that file, `SKIP_FORMAT_GUARD=1` is the
   documented route; never `--no-verify` on the push itself.
7. **Writing files through a shell heredoc has failed repeatedly in this repo.** Use the editor
   tools, or write a script file and run it.
8. **Python's default text-mode write turns the whole file CRLF on Windows.** The repository is LF.
   Open with `newline=""`.

## 8. The first five things to do

1. Read the spec (file 2 above) end to end. It is the binding authority and it is short.
2. Create a fresh worktree and branch off latest `main`.
3. Run `npx vitest run tests/ward-*.test.ts tests/ward-*.dom.test.tsx --reporter dot` and record the
   baseline counts before changing anything, so a later failure can be attributed.
4. Execute Task 1 of the plan. It is serial, it is the foundation, and its structural privacy test
   is the one that keeps the whole prototype honest.
5. Report the counts — not exit codes — before moving on.

## 9. Open questions for the product owner

None blocking. Two worth raising when convenient:

1. **The four-state model is unvalidated.** `predicted → confirmed → blocked → released` is a
   software model of how a bed comes free, and no ward clinician has checked it. A bed may be
   confirmed and blocked at once in reality. Recorded as spec D14 and as an outstanding-work item.
   It is cheap to change while everything is synthetic, and it should be checked before Phase 7
   builds on top of it.
2. **Guardianship, financial arrangements and family availability are excluded from the blocker
   list**, because each describes the person rather than the bed. They are real and common blockers
   in practice. Adding any of them is a one-line change and a recorded product decision.

## 10. What comes after

Phase 6 is the morning state-of-the-state page — one fixed printable page, five figures, identical
everywhere. It was promoted ahead of the community work deliberately: it is small, it is built
entirely from Phase 5's numbers, and it is the artefact that can be put in front of colleagues.
Finding out whether any of this is right is worth more than the next feature.

Phases 7 to 9 and six further agreed enhancements are listed in `docs/ward-flow-roadmap.md`.
