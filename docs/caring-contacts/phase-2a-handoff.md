# Caring Contacts Phase 2A — session handoff

**Read this first.** It is the single entry point for continuing the Caring Contacts production build in a
new session, a new machine, or a new account. Everything below is either in this repository or named with
an exact path on the workstation.

Written at head `6afce3893` on branch `claude/suicide-contact-mockup-b5aaa0`. Nothing has been pushed; there
is no pull request; the branch exists only locally.

---

## 1. What this is

A suicide-prevention **caring contacts** workspace: patients discharged from hospital receive a fixed
schedule of brief, non-demanding messages. It lives inside the larger Clinical KB deployment but is a
**standalone application owning its own sidebar** — its destinations never go in the host app's navigation.

It is a **synthetic, non-clinical prototype**. No real patient data, no SMS provider, no message is ever
sent to any number real or test, and no migration ever runs against the Clinical KB Supabase project
`sjrfecxgysukkwxsowpy`.

Patient-visible copy is **PROVISIONAL and not clinically approved**. Lived-experience and clinical sign-off
are still required before any real use.

---

## 2. The two chat sessions this work came from

Claude Code stores full transcripts as JSONL on the workstation. They are **outside the repository** and are
not backed up by git — copy them if the machine or account is changing.

| Session                                                                                | Transcript                                                                                                                                                                                                                          |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phase 1 + early Phase 2A ("Suicide 1")                                                 | `C:\Users\joshs\.claude\projects\D--Repos-Database--claude-worktrees-rag-readability-metric-split-7e8ac4\cb52ea30-1a66-447e-a1e5-7ece8b217a2f.jsonl` (Aug 19 01:04) and `c762b098-99b3-4606-b457-64355e8be144.jsonl` (Aug 19 12:57) |
| Phase 2A controller ("Suicide 2")                                                      | `C:\Users\joshs\.claude\projects\D--Repos-Database--claude-worktrees-caring-contacts-phase-2a-6c1ea2\8c22c6b7-984f-4804-842f-a4bc62b4adad.jsonl` (Aug 20 22:37)                                                                     |
| Subagent transcripts for that session — the implementer and reviewer reasoning in full | the `subagents/` directory beside it: `agent-a394147b89c86ab7c.jsonl` (Task 10 fix), `agent-a3a402e10992769c3.jsonl` (Task 11a + both fix rounds), `agent-ae2b3252297f75796.jsonl` (Task 11a review)                                |

**You should not need them.** Everything decision-bearing was copied into this repository before the handoff
— see §3. They are listed so the record is complete, and because the subagent transcripts contain the only
verbatim copy of the two code reviews.

---

## 3. Where the history lives now

**The problem this solves:** the build ran under the `superpowers` subagent-driven-development skill, whose
workspace is `.superpowers/sdd/2026-08-19-caring-contact-phase-2a-foundations/`. That directory carries its
own `.gitignore` containing `*`, so **every ledger, brief and report in it is invisible to git** and would be
destroyed by `git clean -fdx` or by deleting the worktree.

All of it has been copied into tracked files:

| Tracked file                                                                                                                                                                                                               | What it holds                                                                                                                                                                                                                              |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `docs/caring-contacts/phase-2a-build-record.md`                                                                                                                                                                            | The live session ledger, verbatim: the pre-flight conflict scan, all **31 rulings** with what each costs if wrong, every deferred finding, every review outcome, and the resume point. **This is the most important file in the handoff.** |
| `docs/caring-contacts/phase-2a-sdd-archive/`                                                                                                                                                                               | Every task brief and every implementer report, verbatim (21 files). `00-live-ledger-verbatim.md` is a second copy of the ledger.                                                                                                           |
| `docs/caring-contacts/phase-1-handoff.md`                                                                                                                                                                                  | The Phase 1 handoff, from the earlier session.                                                                                                                                                                                             |
| `docs/superpowers/plans/2026-08-19-caring-contact-phase-2a-foundations.md`                                                                                                                                                 | **The plan.** 19 tasks in 5 groups, plus the Global Constraints every task inherits.                                                                                                                                                       |
| `docs/superpowers/specs/2026-08-19-caring-contact-production-build-design.md`                                                                                                                                              | **The spec.** The binding authority the plan argues from; conflicts resolve against it.                                                                                                                                                    |
| `docs/caring-contacts/interaction-matrix.md`                                                                                                                                                                               | The frozen 24-row overlay modality and dismissal table (Tasks 17–18).                                                                                                                                                                      |
| `docs/caring-contacts/clinical-language-trace.md`, `accessibility-acceptance.md`, `verification-report.md`, `linked-prototype-handoff.md`, `visual-reference-manifest.md`, `screenshot-atlas-manifest.json`, `atlas/*.png` | Phase 1 design artefacts: the frozen screen atlas and the language, accessibility and verification records.                                                                                                                                |

The `review-*.diff` files in the scratch directory were **not** archived — they are plain `git diff` output
over commits already in history and are regenerable with
`bash <superpowers-skill>/scripts/review-package <plan> <base> <head>`.

The live scratch directory still exists on disk and is still authoritative while the plan runs. If you
continue in the same worktree, keep appending to it and re-copy it to the build record at each checkpoint.
If you start fresh, **the tracked build record becomes the ledger** — say so in its first line.

---

## 4. Exactly where the work stopped

**Branch:** `claude/suicide-contact-mockup-b5aaa0`
**Worktree:** `D:\Repos\Database\.claude\worktrees\rag-readability-metric-split-7e8ac4`
(note: the worktree directory name is unrelated to this work — it was reused)
**Head:** `6afce3893`. Working tree clean. Nothing pushed, no PR.

### Done and reviewed clean

- **Tasks 1–9** — the sealed domain rules layer. Checkpoint 1 passed: 7604 tests, typecheck and lint green.
- **Task 10** — the storage contract and in-memory store (~21 new methods). Reviewed, one fix round, all
  seven findings verdicted addressed. 101 tests.
- **Task 11a** — migration `0003_caring_contacts_workspace.sql`. Reviewed and **approved**, then fix round 1
  (Rulings 27–29). 87 database tests, verified against a 55/55 baseline.

### In flight, and the one thing you must deal with first

**Task 11a fix round 2 is committed at `6afce3893` but is NOT VERIFIED.** The session implementing it was
terminated by an account spend limit immediately after it reported `93 passed. Now the mutations.` The
controller never confirmed that run, and **none** of the deliberate-breakage checks were performed.

The commit message on `6afce3893` carries the full recovery procedure. In short:

1. Start Docker Desktop, then:
   ```
   docker run -d --name caring-contacts-pg -e POSTGRES_PASSWORD=caring-contacts-local -p 54329:5432 --restart unless-stopped postgres:17
   ```
2. ```
   CARING_CONTACTS_DATABASE_URL=postgres://postgres:caring-contacts-local@127.0.0.1:54329/postgres npm run caring-contacts:db:test
   ```
   Confirm the decisive `N passed` line. `87` was the last **verified** count; `93` is claimed but unconfirmed.
3. Run the two Ruling 30/31 mutations and confirm each reddens the intended test — checking first that the
   mutation actually changes a value that test asserts on:
   - remove the immutability trigger → the "closed incident cannot be rewritten" test must redden, while the
     `restarted_at` update still passes;
   - restore `stopped_reason`/`stop_note` to `service_state` → the single-source assertion must redden.
4. Only then dispatch the scoped re-review over `8d7319c54..HEAD`.

### Known-red, and deliberately so

- **`npm run typecheck` is RED** on `src/lib/caring-contacts/db/postgres-repository.ts`, which does not
  implement the ~21 methods Task 10 added to the interface. **Task 11b is what fixes it.** Do not narrow the
  interface and do not stub the methods — a stub that satisfies the compiler while failing at runtime turns a
  visible failure into a hidden one.
- **`npm run test` has exactly one failure**, in `tests/caring-contacts-retention.test.ts`. Verified by
  counting matches per commit: it entered with Task 10's commit `6bf9f6362`. It is not a real leak — the
  hard-coded-period half of the check still passes; only the word-mention half trips, on the plan-mandated
  `markRetentionCleared`. **Ruling 26** specifies the fix and it is written into the Task 11b brief.

### Remaining work

**Task 11b** (brief: `phase-2a-sdd-archive/task-11b-brief.md`) — move the new methods' behavioural tests into
the shared contract so both stores are held to them, then implement the ~21 Postgres methods. This restores
typecheck. Then Checkpoint 2.

Then **Tasks 12–19**: database configuration that cannot point at the Clinical KB project (12); the demo role
switcher (13); route handlers that audit every view (14); the route group, four width states and inbound link
(15); the service-state banner (16); the frozen 24-row overlay table (17); one renderer for all 24 overlays
(18); browser proof at six widths (19). Then the final whole-branch review.

Phase 2A is **foundations**. The working clinician-facing screens are Phase 2B, a separate plan.

---

## 5. Rules that will fail the build if you miss them

These are the ones most easily violated by accident. The full set is the plan's **Global Constraints**
section — read it before writing anything.

- **Migrations live only in `caring-contacts/supabase/migrations/`**, never `supabase/migrations/`. Nothing
  targets the hosted Supabase project.
- **No existing assertion may be deleted or loosened to accommodate a change.** If a test goes red, that is a
  defect in the change, not the test. Exactly one test is knowingly rescoped in this plan, at Task 15, and it
  is replaced with a strictly stronger assertion.
- **Test-first, then prove the test can fail.** After each task, deliberately break the implementation and
  confirm the covering test reddens — **and check first that the mutation actually changes a value some
  assertion reads.** Three proposed proofs on this branch turned out to prove something other than what they
  claimed, and two tests were found that could not fail at all. This discipline is the reason they were caught.
- **Never report a gate as passing from an exit code alone.** Paste the decisive `N passed` line. Piping
  through `tail` has already masked a real result once here.
- **Run the full `npm run test`**, not just focused files, before declaring complete any task that adds or
  renames an exported symbol inside `src/lib/caring-contacts/` — that directory is policed by static scans
  living in files no such diff will contain. This is how the retention failure survived two tasks.
- **Domain isolation:** nothing under `src/lib/caring-contacts/` may import from `@/components`, `@/app`, any
  `@/lib` module outside itself, Supabase, or OpenAI.
- **Prohibited vocabulary** in any string: `high risk`, `safe`, `engagement score`, `campaign`, `lead`,
  `conversion`, `best match`, `inbox`, `conversation`, `clinical risk`, `risk score`, `wellbeing score`, and
  any claim that replies are monitored. Transport words (`Delivered`, `Not delivered`, …) are never patient-state labels.
- **Do not push, do not open a pull request**, and do not run `verify:release` or any provider-backed gate
  (`eval:*`, `check:supabase-project`, `test:live`) without asking the owner first.
- Tap targets are `min-h-12` (48px). Do **not** "fix" them to `min-h-11` for a generic accessibility rule —
  that reintroduces a known `ui-smoke` flake.

---

## 6. The decisions taken on the owner's behalf

There are **31 numbered rulings**, each recorded with its reasoning and **what it costs if wrong**, in
`docs/caring-contacts/phase-2a-build-record.md`. Do not re-litigate them; do read them, because several bind
tasks that have not been written yet.

The ones that shape the remaining work:

- **Ruling 9 / 19 / 20** — the service safety stop is a schema-enforced **singleton**, read by every dispatch
  path regardless of team, with a row-level-security policy scoped to "this session named some team" rather
  than to a specific team. A team-scoped policy on a service-wide stop _is_ the leak: every other team would
  read zero rows and conclude the service is running during a live incident.
- **Ruling 4 / 28** — restart approvals are keyed to the **incident**, never the team, and incidents are
  immutable rows in a `service_stops` history table. This is what stops one incident's three approvals being
  counted toward the next one — a zero-approval restart.
- **Ruling 25 / 27** — plan → referral, plan → pathway version, and both assignment tables use **composite
  same-team foreign keys**. Foreign-key checks bypass row-level security, so a bare key silently permits
  cross-team links. This caught a real defect already sitting in a test fixture.
- **Ruling 23 / 24** — Task 11 is split, and the new methods' behavioural tests move into the **shared
  contract** both stores run, so the database implementation cannot be built against no proof.
- **Ruling 13** — the workspace's client code sits behind a lazy route boundary from its first commit, so the
  Clinical KB dashboard never downloads it (Task 15).
- **Ruling 26** — the retention scan fix described in §4.

**Owner clarification, binding on Task 15 and all of Plan 2B:** Caring Contacts is a standalone application
owning its own sidebar. Every one of its headings and destinations goes in **its** rail, never the host app's
navigation. The tools-catalogue entry is only the front door.

---

## 7. Deferred findings the final review must triage

Recorded in full in the build record. The one worth naming here, because it is clinical content:

- **`savePathwayVersion` stores the authored message `snapshot` by reference.** A caller retaining the input
  object could still mutate stored clinical message content in place, with no version bump and no audit
  event. Pre-existing, not reachable from any screen that exists, and the Postgres store will not inherit it
  (jsonb serialisation copies) — so after Task 11b the two stores will differ here. Flagged as the
  highest-value deferred item.

---

## 8. Starting a new session

```
cd D:\Repos\Database\.claude\worktrees\rag-readability-metric-split-7e8ac4
git log --oneline -5
git status
```

Then, in order:

1. Read `docs/caring-contacts/phase-2a-build-record.md` — the ledger, and specifically its final **RESUME
   POINT** section, which supersedes everything above it.
2. Read the plan and the spec (§3).
3. Read `node_modules/next/dist/docs/` before any route or layout code. This repo runs **Next.js 16**, which
   has breaking changes against most training data. Reading beats reasoning; more thinking does not repair a
   wrong prior.
4. Deal with the unverified `6afce3893` first (§4).
5. Continue with Task 11b.

The build ran with the `superpowers` **subagent-driven-development** skill: a fresh implementer subagent per
task, a task review after each, and a whole-branch review at the end. To continue that way, invoke
`superpowers:subagent-driven-development`; the ledger, briefs and reports are already in the shape it
expects.

**Model guidance the owner set:** Sonnet 5 at medium-high for ordinary tasks; **Opus 5 at high** for
migrations and row-level security, Tasks 17–18 (the 24-overlay modality contract), anything displaying
delivery or clinical state, and the final whole-branch review.
