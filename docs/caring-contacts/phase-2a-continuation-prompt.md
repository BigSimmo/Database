# Caring Contacts Phase 2A — continuation prompt

Paste the block below as the **first message** of a new Claude Code session, started in this repository.
It is written to be self-sufficient: it names every path, every constraint, and the exact first action.

---

```
Caring Contacts — Phase 2A, resume mid-plan. Read before writing anything.

WHERE THE WORK IS
Repository:  D:\Repos\Database
Worktree:    D:\Repos\Database\.claude\worktrees\rag-readability-metric-split-7e8ac4
Branch:      claude/suicide-contact-mockup-b5aaa0   (head d2bc95796, tree clean)
The worktree's directory name is unrelated to this work — it was reused. Work THERE, not in the
main checkout, which is on a different branch. The branch is 43 commits ahead of main and has
never been pushed; it exists only on this machine.

READ FIRST, IN THIS ORDER
1. docs/caring-contacts/phase-2a-handoff.md
   The single entry point. What this is, where every artefact lives, exactly where work stopped,
   which failures are deliberate, the rules that fail the build, and the start-here sequence.
2. docs/caring-contacts/phase-2a-build-record.md
   The session ledger, verbatim: the pre-flight conflict scan, all 31 rulings with what each costs
   if wrong, every deferred finding, every review outcome. Its final RESUME POINT section
   supersedes everything above it. Trust this file and `git log` over any assumption.
3. docs/superpowers/plans/2026-08-19-caring-contact-phase-2a-foundations.md
   The plan: 19 tasks in 5 groups, plus the Global Constraints every task inherits.
4. docs/superpowers/specs/2026-08-19-caring-contact-production-build-design.md
   The binding spec the plan argues from. Conflicts resolve against it.
5. node_modules/next/dist/docs/ — before ANY route or layout code. This repo runs Next.js 16,
   which has breaking changes against most training data. Reading beats reasoning; more thinking
   does not repair a wrong prior.

Task briefs and implementer reports for all completed work are archived verbatim in
docs/caring-contacts/phase-2a-sdd-archive/ (21 files). Phase 1's handoff is
docs/caring-contacts/phase-1-handoff.md. The frozen 24-row overlay table, needed for Tasks 17-18,
is docs/caring-contacts/interaction-matrix.md.

Raw chat transcripts from both prior sessions (Phase 1 and the Phase 2A controller), including
every implementer and reviewer subagent, are saved outside the repo at
D:\Repos\caring-contacts-handoff-2026-08-20\chat-logs\ with an index in that folder's README.md.
You should not need them — everything decision-bearing was copied into the repository — but they
are the only verbatim record of the two code reviews.

WHAT THIS IS
A suicide-prevention caring-contacts workspace: patients discharged from hospital receive a fixed
schedule of brief, non-demanding messages. It lives inside the larger Clinical KB deployment but is
a STANDALONE APPLICATION owning its own sidebar — every one of its headings and destinations goes
in ITS rail, never the host app's navigation. The tools-catalogue entry is only the front door.

It is a synthetic, non-clinical prototype. Patient-visible copy is PROVISIONAL and not clinically
approved. Phase 2A is foundations; the working clinician-facing screens are Phase 2B, a separate plan.

STATE — three things you must not misread

1. Tasks 1-10 and Task 11a are complete and reviewed clean. Task 11a then had a fix round 1
   (Rulings 27-29), also complete: 87 database tests against a verified 55/55 baseline.

2. Commit 6afce3893 is Task 11a fix round 2 and is COMMITTED BUT NOT VERIFIED. The session
   implementing it was terminated by an account spend limit immediately after it reported
   "93 passed. Now the mutations." That run was never confirmed and NONE of the deliberate-breakage
   checks were performed. THIS IS YOUR FIRST JOB. The full recovery procedure is in that commit's
   own message; in short: start Docker, then
     docker run -d --name caring-contacts-pg -e POSTGRES_PASSWORD=caring-contacts-local -p 54329:5432 --restart unless-stopped postgres:17
     CARING_CONTACTS_DATABASE_URL=postgres://postgres:caring-contacts-local@127.0.0.1:54329/postgres npm run caring-contacts:db:test
   Confirm the decisive "N passed" line — 87 is the last verified count, 93 is claimed but
   unconfirmed. Then run the two Ruling 30/31 mutations, confirm each reddens the intended test,
   and only then dispatch a scoped re-review over 8d7319c54..HEAD.

3. Two failures are EXPECTED and are not yours to "fix" by weakening anything:
   - `npm run typecheck` is RED on src/lib/caring-contacts/db/postgres-repository.ts, which does not
     implement the ~21 methods Task 10 added to the interface. Task 11b fixes it. Do NOT narrow the
     interface and do NOT stub the methods — a stub that satisfies the compiler while failing at
     runtime turns a visible failure into a hidden one.
   - `npm run test` has exactly one failure, in tests/caring-contacts-retention.test.ts. It entered
     with commit 6bf9f6362 and is a naming quirk, not a real leak. Ruling 26 specifies the fix and
     it is already written into the Task 11b brief.

THEN CONTINUE THE PLAN
Task 11b next — brief at docs/caring-contacts/phase-2a-sdd-archive/task-11b-brief.md. Move the new
methods' behavioural tests into the shared contract so BOTH stores are held to them, then implement
the ~21 Postgres methods. This restores typecheck. Then Checkpoint 2, then Tasks 12-19, then a final
whole-branch review.

METHOD
Execute with superpowers:subagent-driven-development — a fresh implementer subagent per task, a task
review after each, a whole-branch review at the end. The ledger, briefs and reports are already in
the shape that skill expects. Its live workspace is
.superpowers/sdd/2026-08-19-caring-contact-phase-2a-foundations/ — note that directory carries a
.gitignore containing "*", so nothing in it is tracked; re-copy the ledger into
docs/caring-contacts/phase-2a-build-record.md at every checkpoint, as that file's own header instructs.

Test-first, always. After each piece, deliberately break the implementation and confirm the tests go
red — and check the mutation actually changes a value some assertion reads, because three proposed
proofs on this branch turned out to prove something other than what they claimed, and two tests were
found that could not fail at all. A refusal path with no test is a defect; enumerate them before
committing.

MODEL SPLIT
Sonnet 5 at medium-high for ordinary tasks. Opus 5 at high for: migrations and row-level security,
Tasks 17-18 (the 24-overlay modality contract), anything displaying delivery or clinical state, and
the final whole-branch review.

HARD CONSTRAINTS
- Do not push, do not open a pull request, and do not run verify:release or any provider-backed gate
  (eval:*, check:supabase-project, test:live) without asking me first.
- No message sent to any number, real or test. No SMS provider. No migration against the Clinical KB
  Supabase project sjrfecxgysukkwxsowpy. Caring-contact migrations live ONLY in
  caring-contacts/supabase/migrations/, never supabase/migrations/. Synthetic fictional data only.
- Never delete or loosen an existing assertion to make a change fit. If a test goes red, that is a
  defect in the change, not the test.
- Never report a gate as passing from an exit code alone. Paste the decisive "N passed" line. Piping
  through tail masks the real result — that has already happened once here.
- Run the FULL `npm run test`, not just focused files, before declaring complete any task that adds
  or renames an exported symbol inside src/lib/caring-contacts/. That directory is policed by static
  scans living in files no such diff will contain — that is exactly how the retention failure
  survived two tasks unnoticed.

TELL ME AT THE END OF EACH TASK
What was built, what you decided on my behalf and what each costs if wrong, and anything you could
not verify. I am a psychiatrist, not a software engineer: lead with the answer, use plain English,
give me numbered steps when there is something for me to do, and say plainly when something is
broken, risky or unverified.
```

---

## If you are also moving machines

Copy both of these, not just one:

1. `D:\Repos\Database` — or at minimum push the branch `claude/suicide-contact-mockup-b5aaa0`, which is
   43 commits ahead of main and has never left this workstation.
2. `D:\Repos\caring-contacts-handoff-2026-08-20\` — the chat transcripts.

Then adjust the two paths at the top of the prompt to wherever the repository lands.
