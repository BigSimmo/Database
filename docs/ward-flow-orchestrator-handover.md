# If the orchestrator session dies, start here

**Written 2026-08-30 during the autonomous run, because this session HAS ALREADY DIED ONCE tonight**
— a peer's reply bounced with `ENOINBOX: dead-owner` and it returned on a different transport.
**The machine is hitting `STATUS_COMMITMENT_LIMIT`, so assume it can happen again.**

> ⚠️ **This file is the ONE thing to read first. Everything else it points at.**

---

## 1. What this session is

**The Ward Orchestrator.** Worktree `ward-flow-prototype-design-bca00c`, branch
`claude/Wardquestions`. **Documents only — it never writes product code.** It holds the plan, the
rules, custody, the safety checklist, and the owner's open questions.

**Five other sessions build.** `ListAgents` finds them; `SendMessage` reaches them.

## 2. Read these three, in this order

```bash
git show claude/Wardquestions:docs/ward-flow-task-ledger.md        # the plan of record
git show claude/Wardquestions:docs/ward-flow-safety-checklist.md   # every rule, each from a real failure
git show claude/Wardquestions:docs/ward-flow-custody.md            # who holds what
```

⚠️ **All three exist on `claude/Wardquestions` ONLY. `cat` will not find them from another
worktree; `git show` will.** **Ten documents are in that state and it has already misled people
tonight.**

## 3. The state — ⚠️ AN OBSERVATION. RE-TAKE IT; DO NOT TRUST IT

```bash
for b in claude/ward-flow-phases-6-7-design claude/ward-flow-wave1-referral-corrections \
         claude/Ward-design claude/ward-flow-setup-967aa0-wf claude/ward-flow-print-fixes \
         claude/Wardquestions ; do
  printf '%-46s %s  behind %s / ahead %s\n' "$b" "$(git rev-parse --short $b)" \
    "$(git rev-list --count $b..claude/ward-flow-phases-6-7-design)" \
    "$(git rev-list --count claude/ward-flow-phases-6-7-design..$b)"
done
```

**The ROLES below are durable. Anything numeric is a timestamp.**

- ✅ **Phase 0 (the truth defects) is COMPLETE.** Re-measured; four of the original nine were
  already fixed, one was never a defect, two were latent hazards queued as live ones.
- ✅ **The PATIENT SCREEN has landed** (`da8faea5e`, `claude/ward-flow-phases-6-7-design`) — a new
  route, and search results now link to it. **It closed the silent-tiles item with it.**
- **The critical path is Ward Referrals** — the referral screen, the ED hub, the community hub —
  **and Ward Core, on the polish, the coordinator hub, the timeline and transport.**
- ⚠️ **Ward Board is PAUSED BY THE OWNER** (*"Hold off for now"*). **It HOLDS `ward-screen.tsx` and
  five phase-4 surfaces and is NOT working in them.** **Nothing is reassigned; a paused owner is
  still an owner.** **Do not schedule against motion there.**
- **Ward Decisions is designing**; the network diagram, the header, the ED hub, the coordinator hub,
  the community hub and transport are all specced. ⚠️ **Its specs live on `claude/Ward-design` and
  NOWHERE ELSE**, on a branch 200+ commits ahead that never folds.
- **Ward Verifier holds the audit and the browser.** ⚠️ **It is deliberately NOT a builder** — it
  assessed the seven design surfaces, and if it also builds them nobody independent verifies them.

## 4. What the owner is waiting on — nothing here blocks anybody

**Clinical:** the catchment suburb mapping · the real transport provider list · the real community
team list · **the ten urgent-mark reasons, which are his to choose** · **which FACTS travel with a
referral** · **`HD-Q1`: `/transport`, "Live tracker" and `live-tracker.tsx` are three names for one
page, and a header cannot be designed without choosing one.**

**Operational:** a page reload wipes a demonstration (`D9-8` is cut; he has been asked whether he
wants it back) · ⚠️ **~48 resident sessions and the machine at its commit limit — closing old
sessions is HIS action and cannot be done by anybody being more careful.**

## 5. How to work under the current machine condition

1. ⚠️ **VERIFY THE COMMITTED BLOB, NOT THE WORKING TREE.** `git show HEAD:<path> | grep <thing>`.
   **A tree check passes in the worst case: the edit landed, the commit died, the files look
   perfect and `HEAD` does not have them.**
2. ⚠️ **NEVER `git commit --amend`.** **It is the only common git operation that destroys the
   previous state as a precondition of creating the new one**, and a dying amend presents as a
   branch that lost a commit for no reason. **Add a follow-up commit.**
3. ⚠️ **Use `;` not `&&` in an inspection sequence.** A chain with a `grep -c` expecting zero
   aborts on the CORRECT answer and silently skips everything after it.
4. ⚠️ **A command that produces NO OUTPUT is not evidence of a quiet success.**
5. **Back up with `bash ~/.claude/scripts/backup-work.sh`** — verified bundles plus plain copies,
   into `C:/Users/joshs/Backups/claude-work/`. **Run it before any fold, merge or cleanup.** It
   copies out every ward file existing on exactly one branch, **by name, failing rather than
   skipping.**
6. **Write edits via a scratchpad Python file, not a heredoc.** Heredocs have mangled escapes and
   swallowed fallbacks tonight.

## 6. The one tool this session owns

```bash
node scripts/check-ward-citations.mjs             # 0 clean · 1 a citation broke · 2 REFUSED
node scripts/check-ward-citations.mjs --selftest  # must exit 1
```

**Every backticked SHA and repository path in the ward documents, verified against six branches.**
**It prints how many it scanned — read that number rather than one written here.**
⚠️ **It currently exits 1: 28 missing paths, ALL in dated plans from 14–25 August that name
`src/app/ward-management/**` — the structure moved. ZERO are in live documents.** **The remedy is a
supersession banner on those plans, NOT a change to the checker.**

## 7. ⚠️ The standing traps, in one line each

*(This heading said "the three standing traps" and listed four within the hour. A rule that COUNTS is
brittle; the fix is to stop carrying a count, not to correct it. Third time tonight.)*

- **Content relays fine; AUTHORITY does not.** Permissions, reversals and capabilities need the
  owner directly. **Three sessions correctly refused a relay tonight.**
- **An observation carries its BRANCH as well as its SHA.** Both of tonight's worst errors were
  possible only because the branch was implicit.
- ⚠️ **AN ALL-CLEAR LICENSES ACTION, so check it harder than a fact.** **A wrong fact misleads; a
  wrong all-clear authorises.** **And the sentence right after a correction is the one nobody
  re-checks** — that failed four times tonight, three of them the orchestrator's.
- ⚠️ **KNOWING A FAILURE MODE IS NOT IMMUNITY TO IT.** **Four controls were built tonight by people
  who had just written up the exact failure, and all four had it.** **The only defence that has ever
  worked here is mechanical: run the canary.**
