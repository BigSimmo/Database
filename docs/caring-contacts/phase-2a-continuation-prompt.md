# Caring Contacts Phase 2A — continuation prompt

Paste the block below as the **first message** of a new Claude Code session. It is self-sufficient: it
names every path, every constraint, the whole context map, and the exact first action.

**Settings: Opus 5, high effort, plan mode OFF.** Reasons in the "Settings" section at the foot of this
file — the short version is that the plan already exists in writing, so plan mode would re-derive it at
cost, while the one genuine judgement call in Task 11b is worth the strong model.

---

```
Caring Contacts — Phase 2A, continue with Task 11b. Read before writing anything.

WHERE THE WORK IS
Worktree:  D:\Worktrees\Database\caring-contacts-phase-2a
Branch:    claude/suicide-contact-mockup-b5aaa0   (tree clean, 55 commits ahead of main)

Work THERE. Do NOT create or use a worktree under D:\Repos\Database\.claude\worktrees\ — the original
one for this work was destroyed by another process on this workstation on 2026-08-21, taking an hour of
uncommitted work with it. Only committed work survived. Dependencies are already installed at the path
above and `npm ci` takes ~58 minutes on this machine, so do not discard them. Commit early and often.

THE CONTEXT MAP — everything that exists, and whether to read it now

  READ NOW, IN THIS ORDER. Stop once you can state the resume point back to me.
  1. docs/caring-contacts/PROGRESS-LEDGER.md
       The master ledger: every session, every task status, every decision and carried risk across
       Phase 1 and 2A, as a one-page index. Read this first for the whole picture.
  2. docs/caring-contacts/phase-2a-handoff.md
       The single entry point: what this is, where every artefact lives, where work stopped.
  3. docs/caring-contacts/phase-2a-build-record.md
       THE ledger, and the most important file here. All 34 rulings with what each costs if wrong,
       every deferred finding, every review outcome, every test result. Its FINAL "RESUME POINT"
       section supersedes everything above it. Trust this file and `git log` over any assumption.
  4. docs/caring-contacts/phase-2a-sdd-archive/task-11b-brief.md
       Your task. Complete and self-contained — follow it rather than re-deriving it.

  READ ONLY IF THE BRIEF SENDS YOU THERE
  - docs/superpowers/plans/2026-08-19-caring-contact-phase-2a-foundations.md — the plan: 19 tasks in
    5 groups, plus Global Constraints every task inherits.
  - docs/superpowers/specs/2026-08-19-caring-contact-production-build-design.md — the binding spec the
    plan argues from; conflicts resolve against it.
  - node_modules/next/dist/docs/ — REQUIRED before any route or layout code. This repo runs Next.js 16,
    which has breaking changes against most training data. Reading beats reasoning.

  NEEDED LATER, NOT NOW
  - docs/caring-contacts/interaction-matrix.md — the frozen 24-row overlay table (Tasks 17-18).
  - docs/caring-contacts/phase-1-handoff.md and the Phase 1 design artefacts (atlas, accessibility,
    clinical-language trace, verification report).
  - docs/caring-contacts/phase-2a-sdd-archive/ — 22 files: every task brief and implementer report.

  DO NOT READ
  - docs/caring-contacts/phase-2a-sdd-archive/00-live-ledger-verbatim.md — a STALE snapshot frozen at
    Ruling 29. It says so in its own header. The build record above is the live one.

  RAW CHAT TRANSCRIPTS (outside the repository; you should not need them)
  - D:\Repos\caring-contacts-handoff-2026-08-20\ — sessions 1 and 2. Its README names a worktree that
    no longer exists; ignore that path.
  - D:\Repos\caring-contacts-handoff-2026-08-21\ — session 3, including the ONLY verbatim copy of the
    fix-round-2 code review that produced Rulings 32-34. Its README indexes both bundles.

  SCRATCH WORKSPACE
  - .superpowers/sdd/2026-08-19-caring-contact-phase-2a-foundations/ exists and holds copies of the
    briefs, but it is a GENERATED MIRROR -- rebuild it with
    `node scripts/rebuild-caring-contacts-sdd-workspace.mjs` and never edit it. Append rulings,
    findings and resume points to the tracked build record, never to a second ledger there. The original scratch ledger was lost with the
    deleted worktree; the tracked record is the only one now.

STATE — nothing is outstanding
Tasks 1-10 and Task 11a are COMPLETE and reviewed. Task 11a went through three fix rounds; Rulings 27-34
are all implemented and verified. The caring-contact database suite is at 96 passed, and the three newest
tests are proven falsifiable by deliberate mutation, not merely green.

Two failures are EXPECTED and are not to be "fixed" by weakening anything:
- `npm run typecheck` is RED on src/lib/caring-contacts/db/postgres-repository.ts. The interface declares
  38 methods, the in-memory store implements 38, Postgres implements 16 — a gap of 22. Task 11b closes
  it, and restoring typecheck is the task's headline deliverable. Do NOT narrow the interface and do NOT
  stub methods; a stub that satisfies the compiler while failing at runtime turns a visible failure into
  a hidden one.
- `npm run test` has exactly one failure, in tests/caring-contacts-retention.test.ts. Ruling 26 specifies
  the fix and it is Step 0b of the brief.

WHAT THIS IS
A suicide-prevention caring-contacts workspace: patients discharged from hospital receive a fixed
schedule of brief, non-demanding messages. It lives inside the larger Clinical KB deployment but is a
STANDALONE APPLICATION owning its own sidebar — every one of its headings and destinations goes in ITS
rail, never the host app's navigation. The tools-catalogue entry is only the front door.

It is a synthetic, non-clinical prototype. Patient-visible copy is PROVISIONAL and not clinically
approved. Phase 2A is foundations; the clinician-facing screens are Phase 2B, a separate plan.

METHOD — this matters for cost as much as for quality
Execute with superpowers:subagent-driven-development. Dispatch a fresh implementer subagent for Task 11b
so the three 1000+ line files are read in ITS context, not yours. Give it the brief verbatim plus the
traps below. Review what it returns, then run a task review. Do not read those files yourself unless the
review requires it.

Test-first, always. After each piece, deliberately break the implementation and confirm the covering test
goes red — and check FIRST that the mutation actually changes a value some assertion reads. Three
proposed proofs on this branch turned out to prove something other than they claimed, and two tests were
found that could not fail at all. A refusal path with no test is a defect; enumerate them before
committing.

RUNNING TESTS — read this or you will lose an hour
  docker run -d --name caring-contacts-pg -e POSTGRES_PASSWORD=caring-contacts-local -p 54329:5432 --restart unless-stopped postgres:17
  CARING_CONTACTS_DATABASE_URL=postgres://postgres:caring-contacts-local@127.0.0.1:54329/postgres npm run caring-contacts:db:test
Expect "Tests 96 passed (96)" before your changes. NEVER report a run from its exit code. If the output
carries no "Test Files" summary line THE RUN DID NOT HAPPEN — the cross-worktree lock coordinator throws
EPERM on owner.json/gate.lock under concurrency, which is an acquisition failure, not a result. Retry it.
Piping through `tail` has masked a real result here twice. Runs also queue behind other worktrees'
Playwright runs for 15-40 minutes when other AI sessions are open — ask me to close them rather than
polling tightly.

Run the FULL `npm run test`, not just focused files, before declaring complete any task that adds or
renames an exported symbol inside src/lib/caring-contacts/ — that directory is policed by static scans
living in files no such diff will contain. That is exactly how one real failure survived two tasks.

HARD CONSTRAINTS
- Do not push, do not open a pull request, and do not run verify:release or any provider-backed gate
  (eval:*, check:supabase-project, test:live) without asking me first.
- No message sent to any number, real or test. No SMS provider. No migration against the Clinical KB
  Supabase project sjrfecxgysukkwxsowpy. Caring-contact migrations live ONLY in
  caring-contacts/supabase/migrations/, never supabase/migrations/. Synthetic fictional data only.
- Never delete or loosen an existing assertion to make a change fit. The brief warns you will be tempted
  at one exact moment — when the shared contract starts creating its own parent records. If you find
  yourself about to change what a test expects, STOP and report instead.
- Domain isolation: nothing under src/lib/caring-contacts/ may import from @/components, @/app, any
  @/lib module outside itself, Supabase, or OpenAI.
- Tap targets are min-h-12 (48px). Do NOT "fix" them to min-h-11 — that reintroduces a known flake.

MODEL SPLIT
Sonnet 5 at medium-high for ordinary implementer work. Opus 5 at high for: migrations and row-level
security, Tasks 17-18 (the 24-overlay modality contract), anything displaying delivery or clinical
state, and the final whole-branch review.

STOP AFTER Checkpoint 2. Do not start Task 12.

TELL ME AT THE END
What was built, what you decided on my behalf and what each costs if wrong, and anything you could not
verify. I am a psychiatrist, not a software engineer: lead with the answer, plain English, numbered steps
if there is something for me to do, and say plainly when something is broken, risky or unverified.
```

---

## Settings, and why

**Model: Opus 5. Effort: high. Plan mode: OFF.**

- **Opus 5 at high** — not for the volume of code, but for one judgement. Task 11b moves existing tests
  into a shared contract that both stores must satisfy, and the brief itself warns that at one
  identifiable moment the cheap way out is to soften an assertion rather than make the store meet it.
  Recognising that moment and refusing it is the discipline this whole branch exists to protect, and it
  is not a mechanical check. The reading and typing are delegated to a subagent, so the strong setting
  pays only for the judgement.
- **Plan mode OFF** — the plan already exists in writing and is binding: 19 tasks, Global Constraints,
  and a complete self-contained brief for this task. Plan mode would re-derive a plan that is already
  written, costing tokens twice over and risking a divergence from the brief that a later reviewer would
  have to adjudicate. Go straight to executing under subagent-driven-development.
- **The exception**, if it arises: if reading the brief reveals a genuine conflict with the spec, stop
  and raise it rather than planning around it. Conflicts resolve against the spec, and a controller
  ruling gets recorded in the build record.

## If the machine or account changes

Copy these three things:

1. `D:\Repos\Database` — or at minimum push `claude/suicide-contact-mockup-b5aaa0`, which is 52 commits
   ahead of main and has never left this workstation.
2. `D:\Repos\caring-contacts-handoff-2026-08-20\` — transcripts for sessions 1 and 2.
3. `D:\Repos\caring-contacts-handoff-2026-08-21\` — transcripts for session 3, including the only
   verbatim copy of the fix-round-2 code review.

Then adjust the worktree path at the top of the prompt to wherever the repository lands.
