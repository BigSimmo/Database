# Caring Contacts Phase 2A — continuation prompt

Paste the block below as the **first message** of a new Claude Code session. It is written to be
self-sufficient: it names every path, every constraint, and the exact first action.

**Recommended setting: Opus 5 at high effort.** Not because the coding is hard, but because Task 11b
moves existing tests into a shared contract where both stores must satisfy them, and the brief itself
warns that at one exact moment the easy way out will be to soften an assertion rather than make the
store meet it. Recognising that moment and refusing it is the judgement this branch exists to protect.
The bulk reading and typing go to a subagent, so the strong setting pays only for the judgement.

---

```
Caring Contacts — Phase 2A, continue with Task 11b.

WHERE THE WORK IS
Worktree:  D:\Worktrees\Database\caring-contacts-phase-2a
Branch:    claude/suicide-contact-mockup-b5aaa0   (tree clean, never pushed, ~51 commits ahead of main)

Work THERE. Do NOT create a worktree under D:\Repos\Database\.claude\worktrees\ — the original one was
destroyed by another process on this workstation on 2026-08-21, taking an hour of uncommitted work with
it. Only committed work survived. Dependencies are already installed at the path above and `npm ci`
takes ~58 minutes on this machine, so do not discard them. Commit early and often.

READ FIRST, IN THIS ORDER — stop once you can state the resume point back to me
1. docs/caring-contacts/phase-2a-handoff.md — the single entry point.
2. docs/caring-contacts/phase-2a-build-record.md — THE ledger. All 34 rulings with what each costs if
   wrong, every deferred finding, every review outcome. Its FINAL "RESUME POINT" supersedes everything
   above it. Trust this file and `git log` over any assumption.
3. docs/caring-contacts/phase-2a-sdd-archive/task-11b-brief.md — your task. Complete and self-contained;
   follow it rather than re-deriving it.
Do NOT read the plan, the spec, or the other archive files unless the brief sends you there. Do NOT read
00-live-ledger-verbatim.md at all — it is a stale snapshot and says so in its header.

STATE
Tasks 1-10 and Task 11a are COMPLETE and reviewed; 11a went through three fix rounds and Rulings 27-34
are all implemented and verified. Caring-contact database suite: 96 passed, and the three newest tests
are proven falsifiable by deliberate mutation, not merely green. Nothing is outstanding.

Two failures are EXPECTED and are not to be "fixed" by weakening anything:
- `npm run typecheck` is RED on src/lib/caring-contacts/db/postgres-repository.ts. The interface declares
  38 methods, the in-memory store implements 38, Postgres implements 16 — a gap of 22. Task 11b closes
  it, and restoring typecheck is the task's headline deliverable. Do NOT narrow the interface and do NOT
  stub methods; a stub that satisfies the compiler but fails at runtime turns a visible failure into a
  hidden one.
- `npm run test` has exactly one failure, in tests/caring-contacts-retention.test.ts. Ruling 26 specifies
  the fix and it is Step 0b of the brief.

METHOD — this matters for cost as much as for quality
Dispatch a fresh implementer subagent for Task 11b so the three 1000+ line files are read in ITS context,
not yours. Give it the brief verbatim plus the traps below. Review what it returns, then run a task
review. Do not read those files yourself unless the review requires it.

Test-first, always. After each piece, deliberately break the implementation and confirm the covering test
goes red — and check FIRST that the mutation actually changes a value some assertion reads. Three
proposed proofs on this branch turned out to prove something other than they claimed, and two tests were
found that could not fail at all. A refusal path with no test is a defect; enumerate them before
committing.

Append rulings, findings and resume points directly to docs/caring-contacts/phase-2a-build-record.md.
Do NOT start a second ledger in .superpowers/ — that scratch workspace exists and holds copies of the
briefs, but its progress.md is only a pointer. The original scratch ledger was lost with the deleted
worktree; the tracked record is the only one now.

RUNNING TESTS — read this or you will lose an hour
  docker run -d --name caring-contacts-pg -e POSTGRES_PASSWORD=caring-contacts-local -p 54329:5432 --restart unless-stopped postgres:17
  CARING_CONTACTS_DATABASE_URL=postgres://postgres:caring-contacts-local@127.0.0.1:54329/postgres npm run caring-contacts:db:test
Expect "Tests 96 passed (96)" before your changes. NEVER report a run from its exit code. If the output
carries no "Test Files" summary line THE RUN DID NOT HAPPEN — the cross-worktree lock coordinator throws
EPERM on owner.json/gate.lock under concurrency, which is an acquisition failure, not a result. Retry it.
Piping through `tail` has masked a real result here twice. Runs queue behind other worktrees' Playwright
runs for 15-40 minutes when other AI sessions are open; ask me to close them rather than polling tightly.

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

STOP AFTER Checkpoint 2. Do not start Task 12.

TELL ME AT THE END
What was built, what you decided on my behalf and what each costs if wrong, and anything you could not
verify. I am a psychiatrist, not a software engineer: lead with the answer, plain English, numbered steps
if there is something for me to do, and say plainly when something is broken, risky or unverified.
```

---

## If the machine or account changes

Copy these three things:

1. `D:\Repos\Database` — or at minimum push the branch `claude/suicide-contact-mockup-b5aaa0`, which is
   ~51 commits ahead of main and has never left this workstation.
2. `D:\Repos\caring-contacts-handoff-2026-08-20\` — transcripts for sessions 1 and 2.
3. `D:\Repos\caring-contacts-handoff-2026-08-21\` — transcripts for session 3, including the only
   verbatim copy of the fix-round-2 code review.

Then adjust the worktree path at the top of the prompt to wherever the repository lands. Note that the
2026-08-20 bundle's README names a worktree that no longer exists.
