# Ward Flow Phase 5 — kickoff prompt

> **OBSOLETE — Phase 5 is built and merged.** PR
> [#2390](https://github.com/BigSimmo/Database/pull/2390) merged into `main` on 2026-08-26 as
> `ea5482b9`. **Do not paste the block below into a new session**; it will start Phase 5 again.
> It is kept as the record of how the phase was commissioned, and because one instruction in it
> is still live — see the note at the end. For what was built, read
> `docs/ward-flow-phase-5-handover.md`; for what is owed next, `docs/ward-flow-roadmap.md`.
> Marked obsolete 2026-08-27.

Paste the block below into a fresh session as its first message. It is deliberately self-sufficient:
the constraints are stated inline rather than only referenced, so they bind even before the linked
documents are read.

---

```
Start Ward Flow Phase 5. This is a fresh session with no prior context — everything you need is
written down.

READ THESE FIRST, IN THIS ORDER:

1. docs/ward-flow-phase-5-handover.md — cold-start orientation, and the eight traps that have
   already cost this project real time. Read it before touching anything.
2. docs/superpowers/specs/2026-08-26-ward-flow-phase-5-bed-availability-design.md — the BINDING
   AUTHORITY. Fourteen numbered decisions. Where anything disagrees with anything else, this wins.
3. docs/superpowers/plans/2026-08-26-ward-flow-phase-5-bed-availability.md — the eight-task
   implementation plan, with the actual code to write.
4. docs/ward-flow-roadmap.md — sixteen settled product decisions and the phase order. These were
   agreed with the product owner. Do not re-litigate them; if one seems wrong, say so and ask.
5. docs/ward-flow-complete-ledger.md — the project's history, Phases 1 to 5, if you need the why.

WHAT YOU ARE BUILDING

Ward Flow is a synthetic, offline prototype of a psychiatric bed-flow hub for Western Australia,
built for a practising psychiatrist in Perth. It is not clinical decision support, it holds no real
data, and it is reachable only through the administrator-gated developer hub at /mockups/ward-flow.

Phase 5 makes bed availability real, and nothing else. A bed release gains a lifecycle
(predicted → confirmed → blocked → released) that only a ward may move; leave beds become their own
type; a discharge and egress board is added; capacity becomes five separate figures for today in
four bands ending at 22:00; and every board gains a freshness stamp.

The single most important rule in the phase: nothing predicted, confirmed-but-unreleased, or on
leave is ever added into "available now". A coordinator must be able to point at one number and say
"that is a bed I can fill this minute".

Phase 4 already built the BedRelease type, its fixed blocker list, its ward-only flag event, and the
ward's flagging panel. Phase 5 EXTENDS these. Do not build a parallel concept.

NON-NEGOTIABLE CONSTRAINTS

- Never invent a legal figure. Never cite, paraphrase or infer any figure or requirement from the
  Mental Health Act — not in code, copy, comment, test or fixture. If one is needed, stop and ask.
- Synthetic data only. No name, date of birth, medical record number, address, diagnosis, narrative
  history or treatment. Sex is the only permitted patient attribute, and even that is excluded from
  bed releases and leave beds by spec D11. Free text counts as data.
- Local and offline checks only. Never run verify:release, any eval script, check:supabase-project,
  test:live, or anything touching OpenAI, Supabase, hosted CI or a live database.
- Never force-push, git reset --hard, or discard either side of a diverged branch. Never
  git checkout -- a file with uncommitted changes without backing it up first.
- Never delete a worktree unasked. A git refusal to remove one means stop, not retry with --force.
- Do not kill background processes without inventorying them first.

HOW TO WORK

Take a fresh worktree and branch off latest main. Do NOT continue on
claude/ward-flow-phase-4-spec — that is a different piece of work with its own open PR.

Then use subagent-driven development, shaped around this repository's real bottleneck, which is a
machine-wide lock on heavyweight checks rather than thinking time:

- Task 1 is serial and first. Every other task reads its types.
- Then fan out: Tasks 2, 3 and 4 concurrently, then Tasks 5, 6 and 7 concurrently.
- Each implementer runs ONLY its own focused test file. The repository allows two focused test
  leases at a time and serialises everything heavier across every worktree on the machine.
- Run the expensive gates once, in Task 8 — full suite, typecheck, lint, format, browser,
  screenshots.
- Assemble every commit before the first push. A push mid-run cancels the checks already running.

THE TRAPS THAT HAVE ACTUALLY BITTEN THIS PROJECT

- node scripts/run-playwright.mjs exits 0 when tests FAIL and when it refuses to run at all. Read
  the "N passed" line. Never the exit code.
- DATABASE_HEAVY_RUN_ADMISSION_BUSY, and an EPERM ... owner.json stack trace, both mean the command
  did not run. Another worktree holds the shared lock. Retry after about 45 seconds. Never report
  either as a pass.
- Green tests are not proof the screen is right. Four separate defects this month passed every
  structural check and were found only by looking at a screenshot. Capture at 390px, 820px and
  1440px, and actually look.
- Mutation-test every new test. One check passed with the exact rule it guarded deleted.
- Writing files through a shell heredoc has failed repeatedly here. Use the editor tools, or write
  a script file and run it.
- Python's default text-mode write turns the whole file CRLF on Windows; this repository is LF.
  Open with newline="".

DO THIS FIRST

1. Read the handover and the spec end to end.
2. Create the fresh worktree and branch off latest main.
3. Run the ward baseline and record the counts before changing anything:
   npx vitest run tests/ward-*.test.ts tests/ward-*.dom.test.tsx --reporter dot
4. Execute Task 1 of the plan.
5. Report counts and quoted output lines — never bare exit codes — before moving on.

HOW TO TALK TO ME

I am a psychiatrist, not a software engineer. Lead with the answer. Tell me what to do as numbered
steps, or say "nothing for you to do". Plain English sentences, no jargon, no file paths unless
they change my decision. Say plainly when something is broken, risky or uncertain, and say when you
have not checked something rather than presenting a guess as a fact.

ONE THING WORTH RAISING EARLY

The four bed states — predicted, confirmed, blocked, released — are a software model of how a bed
comes free. No ward clinician has checked them, a bed may be confirmed and blocked at once in
reality, and it is recorded as spec D14 and as the assumption most likely to be wrong. Build as
specified, but flag it to me again when Phase 5 is done and before Phase 6 builds on top of it.
```

---

**The one instruction above that is still live.** "Flag it to me again when Phase 5 is done and
before Phase 6 builds on top of it" — that flag is **still owed**. Phase 5 is done, and spec D14
has still never been checked by a ward clinician. It is tracked in `docs/ward-flow-roadmap.md` and
in §10 of `docs/ward-flow-phase-5-handover.md`. Everything else in this file is history.
