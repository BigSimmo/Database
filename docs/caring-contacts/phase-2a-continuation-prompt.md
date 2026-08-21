# Caring Contacts Phase 2A — continuation prompt

Paste the block below as the **first message** of a new Claude Code session. It is self-sufficient: it
names every path, every constraint, the complete file map, and the exact first action.

**Settings: Opus 5, high effort, plan mode OFF.** Reasoning in the "Settings" section at the foot of this
file.

---

```
Caring Contacts — Phase 2A, continue with Task 11b. Read before writing anything.

═══ WHERE THE WORK IS ═══
Repository:  D:\Repos\Database                              (remote: github.com/BigSimmo/Database)
Worktree:    D:\Worktrees\Database\caring-contacts-phase-2a  ← work HERE
Branch:      claude/suicide-contact-mockup-b5aaa0            (tree clean, 54 commits ahead of main)

Do NOT create or use a worktree under D:\Repos\Database\.claude\worktrees\. The original one for this
work was destroyed by another process on this workstation on 2026-08-21 mid-session, taking an hour of
uncommitted work with it; only committed work survived, and it happened repeatedly. Dependencies are
already installed at the path above and `npm ci` takes ~58 minutes here, so do not discard them.
Commit early and often — local commits cost nothing and are the only thing that survived.

═══ THE FILE MAP — everything that exists, and when to read it ═══

READ NOW, IN THIS ORDER. Stop once you can state the resume point back to me.
  1. docs/caring-contacts/PROGRESS-LEDGER.md
       Master ledger: programme shape, all three sessions, all 19 task states, verification evidence
       at every gate, both decision sets, carried risks, and where every record lives. The whole
       picture on one page. It is an INDEX — the detailed records win on any disagreement.
  2. docs/caring-contacts/phase-2a-handoff.md
       Session entry point: what this is, exactly where work stopped, the rules that fail the build.
  3. docs/caring-contacts/phase-2a-build-record.md
       THE ledger and the most important file here. All 34 rulings with what each costs if wrong,
       every deferred finding, every review outcome, every test result. Its FINAL "RESUME POINT"
       supersedes everything above it. Trust this file and `git log` over any assumption.
  4. docs/caring-contacts/phase-2a-sdd-archive/task-11b-brief.md
       YOUR TASK. Complete and self-contained — follow it rather than re-deriving it.

THE AUTHORITIES, if the brief sends you there or a conflict arises
  - docs/superpowers/plans/2026-08-19-caring-contact-phase-2a-foundations.md
       The plan: 19 tasks in 5 groups, plus Global Constraints every task inherits.
  - docs/superpowers/specs/2026-08-19-caring-contact-production-build-design.md
       The binding spec the plan argues from. Conflicts resolve AGAINST the spec.
  - docs/caring-contacts/phase-1-handoff.md
       Phase 1: what it built, its 13 owner-behalf decisions, and its 6 still-open items.
  - node_modules/next/dist/docs/
       REQUIRED before any route or layout code. This repo runs Next.js 16, which has breaking
       changes against most training data. Reading beats reasoning; more thinking does not repair a
       wrong prior.

THE CODE TASK 11b TOUCHES — three files, all large; let a subagent read them
  - tests/helpers/caring-contacts-repository-contract.ts   receives the moved tests — do this FIRST
  - tests/caring-contacts-repository.test.ts               loses the moved tests
  - src/lib/caring-contacts/db/postgres-repository.ts      the ~22 missing methods
  Reference for intended behaviour (read as specification, do NOT copy its structure):
  - src/lib/caring-contacts/in-memory-repository.ts
  - src/lib/caring-contacts/repository.ts                  the interface: 38 methods
  Also relevant:
  - tests/caring-contacts-postgres-repository.test.ts      carries temporary scaffolding 11b removes
  - tests/helpers/caring-contacts-postgres.ts              harness; CARING_CONTACTS_DATA_TABLES is a
                                                           hand-maintained truncation list every new
                                                           table must join
  - tests/caring-contacts-retention.test.ts                the one known-red test; Ruling 26, Step 0b

THE SEALED DOMAIN — src/lib/caring-contacts/ (27 modules). The store PERSISTS decisions; it must
never re-derive a rule a module already owns, even if the answer matches today:
  access-audit  assignment  audit  clock  contact-rescheduling  episode  fingerprint  hospital-events
  ids  in-memory-repository  message-copy  message-policy  message-rules  model
  notification-preferences  pathway-versions  permissions  referrals  repository  retention  schedule
  service-rules  service-state  simulation  synthetic-contacts  training  db/postgres-repository

THE SCHEMA — caring-contacts/supabase/migrations/ (NEVER supabase/migrations/)
  0001_caring_contacts_foundation.sql   0002_caring_contacts_rls.sql
  0003_caring_contacts_workspace.sql    ← Rulings 4, 9, 19-22, 25, 27-34 live here

NEEDED LATER, NOT NOW
  - docs/caring-contacts/interaction-matrix.md          frozen 24-row overlay table (Tasks 17-18)
  - docs/caring-contacts/atlas/ (44 PNGs) + screenshot-atlas-manifest.json + visual-reference-manifest.md
  - docs/caring-contacts/accessibility-acceptance.md, clinical-language-trace.md,
    verification-report.md, linked-prototype-handoff.md      Phase 1 design records
  - src/components/caring-contacts/mockups/                  design scratch, frozen, 404s in production.
                                                             Production code may NEVER import from it.
  - docs/caring-contacts/phase-2a-sdd-archive/               22 files: every brief and report

DO NOT READ
  - docs/caring-contacts/phase-2a-sdd-archive/00-live-ledger-verbatim.md
       A STALE snapshot frozen at Ruling 29, with a warning header. The build record is the live one.

OUTSTANDING WORK RECORDED OUTSIDE THIS PLAN
  - docs/outstanding-issues-inbox/049e0356-b6ad-4382-8f34-958d2681c60e.json
       Owner decision 2026-08-21 on patient case notes and the retention disposition of
       service_stops.note. Read it before touching that column.

RAW CHAT TRANSCRIPTS — outside the repository; you should not need them
  - D:\Repos\caring-contacts-handoff-2026-08-20\   sessions 1-2. Its README names a worktree that no
                                                   longer exists; ignore that path.
  - D:\Repos\caring-contacts-handoff-2026-08-21\   session 3, incl. the ONLY verbatim copy of the
                                                   fix-round-2 review that produced Rulings 32-34.
                                                   Also mirrors PROGRESS-LEDGER.md and this prompt.

THE SCRATCH WORKSPACE — generated, never a source
  - .superpowers/sdd/2026-08-19-caring-contact-phase-2a-foundations/
       A MIRROR. Rebuild with `node scripts/rebuild-caring-contacts-sdd-workspace.mjs`; verify with
       `--check`. Never edit it, and never start a second ledger there — append to the tracked build
       record instead. The original was git-ignored, was destroyed, and took the only copy of the
       session ledger with it. That is why it is now regenerable.

═══ STATE — nothing is outstanding ═══
Tasks 1-10 and Task 11a are COMPLETE and reviewed. Task 11a went through three fix rounds; Rulings
27-34 are implemented and verified. The caring-contact database suite is at 96 passed, and its three
newest tests are proven falsifiable by deliberate mutation, not merely green.

Two failures are EXPECTED and must NOT be "fixed" by weakening anything:
  - `npm run typecheck` is RED on src/lib/caring-contacts/db/postgres-repository.ts. The interface
    declares 38 methods, the in-memory store implements 38, Postgres implements 16 — a gap of 22.
    Task 11b closes it, and restoring typecheck is the task's headline deliverable. Do NOT narrow the
    interface and do NOT stub methods: a stub that satisfies the compiler while failing at runtime
    turns a visible failure into a hidden one.
  - `npm run test` has exactly one failure, tests/caring-contacts-retention.test.ts. Ruling 26
    specifies the fix and it is Step 0b of your brief.

═══ WHAT THIS IS ═══
A suicide-prevention caring-contacts workspace: patients discharged from hospital receive a fixed
schedule of brief, non-demanding messages. It lives inside the larger Clinical KB deployment but is a
STANDALONE APPLICATION owning its own sidebar — every heading and destination goes in ITS rail, never
the host app's navigation. The tools-catalogue entry is only the front door.

Synthetic, non-clinical prototype. Patient-visible copy is PROVISIONAL and not clinically approved.
Phase 2A is foundations; the clinician-facing screens are Phase 2B, a separate plan.

═══ METHOD — this matters for cost as much as for quality ═══
Execute with superpowers:subagent-driven-development. Dispatch a fresh implementer subagent for Task
11b so the large files are read in ITS context, not yours. Give it the brief verbatim plus the traps
below. Review what it returns, then run a task review. Do not read those files yourself unless the
review requires it.

Test-first, always. After each piece, deliberately break the implementation and confirm the covering
test goes red — and check FIRST that the mutation actually changes a value some assertion reads.
Three proposed proofs on this branch turned out to prove something other than they claimed, and four
tests across the programme were found unable to fail at all. A refusal path with no test is a defect;
enumerate them before committing.

═══ RUNNING TESTS — read this or you will lose an hour ═══
  docker run -d --name caring-contacts-pg -e POSTGRES_PASSWORD=caring-contacts-local -p 54329:5432 --restart unless-stopped postgres:17
  CARING_CONTACTS_DATABASE_URL=postgres://postgres:caring-contacts-local@127.0.0.1:54329/postgres npm run caring-contacts:db:test

Expect "Tests 96 passed (96)" before your changes. NEVER report a run from its exit code. If the
output carries no "Test Files" summary line THE RUN DID NOT HAPPEN — the cross-worktree lock
coordinator throws EPERM on owner.json/gate.lock under concurrency, which is an acquisition failure,
not a result. Retry it. Piping through `tail` has masked a real result here twice. Runs also queue
behind other worktrees' Playwright runs for 15-40 minutes when other AI sessions are open — ask me to
close them rather than polling tightly.

Run the FULL `npm run test`, not just focused files, before declaring complete any task that adds or
renames an exported symbol inside src/lib/caring-contacts/ — that directory is policed by static scans
living in files no such diff will contain. That is exactly how one real failure survived two tasks.

═══ HARD CONSTRAINTS ═══
- Do not push, do not open a pull request, and do not run verify:release or any provider-backed gate
  (eval:*, check:supabase-project, test:live) without asking me first.
- No message sent to any number, real or test. No SMS provider. No migration against the Clinical KB
  Supabase project sjrfecxgysukkwxsowpy. Caring-contact migrations live ONLY in
  caring-contacts/supabase/migrations/. Synthetic fictional data only.
- Never delete or loosen an existing assertion to make a change fit. The brief warns you will be
  tempted at one exact moment — when the shared contract starts creating its own parent records. If
  you find yourself about to change what a test expects, STOP and report instead.
- Domain isolation: nothing under src/lib/caring-contacts/ may import from @/components, @/app, any
  @/lib module outside itself, Supabase, or OpenAI.
- Production code may never import from src/components/caring-contacts/mockups/.
- Tap targets are min-h-12 (48px). Do NOT "fix" them to min-h-11 — that reintroduces a known flake.
- Prohibited in any interface string: high risk, safe, engagement score, campaign, lead, conversion,
  best match, inbox, conversation, clinical risk, risk score, wellbeing score, and any claim that
  replies are monitored. Transport words (Delivered, Not delivered, …) are never patient-state labels.

═══ MODEL SPLIT ═══
Sonnet 5 at medium-high for ordinary implementer work. Opus 5 at high for: migrations and row-level
security, Tasks 17-18 (the 24-overlay modality contract), anything displaying delivery or clinical
state, and the final whole-branch review.

═══ STOP AFTER Checkpoint 2. Do not start Task 12. ═══

═══ TELL ME AT THE END ═══
What was built, what you decided on my behalf and what each costs if wrong, and anything you could not
verify. I am a psychiatrist, not a software engineer: lead with the answer, plain English, numbered
steps if there is something for me to do, and say plainly when something is broken, risky or unverified.
```

---

## Settings, and why

**Model: Opus 5. Effort: high. Plan mode: OFF.**

- **Opus 5 at high** — not for the volume of code, but for one judgement. Task 11b moves existing tests
  into a shared contract that both stores must satisfy, and the brief itself warns that at one
  identifiable moment the cheap way out is to soften an assertion rather than make the store meet it.
  Recognising that moment and refusing it is the discipline this branch exists to protect, and it is not
  a mechanical check. The reading and typing are delegated to a subagent, so the strong setting pays
  only for the judgement.
- **Plan mode OFF** — the plan already exists in writing and is binding: 19 tasks, Global Constraints,
  and a complete self-contained brief for this task. Plan mode would re-derive a plan that is already
  written, costing tokens twice and risking a divergence a later reviewer must adjudicate.
- **The exception**: if reading the brief reveals a genuine conflict with the spec, stop and raise it
  rather than planning around it. Conflicts resolve against the spec, and a controller ruling is
  recorded in the build record.

## Durability — the one thing still open

As of head `a15127de4` the branch has **never been pushed**: 54 commits exist only on this workstation,
which is the machine that deleted a working directory mid-session. To close that:

```
cd D:\Worktrees\Database\caring-contacts-phase-2a && git push -u origin claude/suicide-contact-mockup-b5aaa0
```

It opens no pull request and changes nothing live. If the machine or account changes instead, copy
`D:\Repos\Database` and both `D:\Repos\caring-contacts-handoff-2026-08-2*\` bundles, then adjust the
worktree path at the top of the prompt.
