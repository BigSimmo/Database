# Coordination rules and locks — five chats, one repository

**Owner decision, 2026-08-29**, when asked whether to keep five parallel chats or collapse to one:

> _"Please keep it but create clear rules and locks for risky editing and build in coordination rules
> where chats will contact other relevant chats and update all documentation and again edit files
> that are safe and appropriate etc."_

**Everything below is measured from collisions that actually happened on 29–30 August, not designed
from what seemed likely.** Where a rule has no evidence behind it, it says so.

---

## 1. The price of parallelism, stated honestly before the rules

**A two-branch fold that went RIGHT still produced:** a conflict whose **wrong resolution was the
green one**, a fourth conflict nobody predicted, and seven failures no single branch could see. Both
branches were small, disjoint by intent, and coordinated hourly.

**That is the cost with the process working.** Anyone tempted to add a sixth chat should be shown
that number rather than a success story.

---

## 2. What actually collides — the four real ones

Most feared collisions are not real. These four are, and three of them are invisible to the checks
people reach for.

### 2.1 The git index is shared, and it is the sharpest edge

**A commit includes the whole index, not the paths you name.** So a subagent running in a worktree
where the controller has staged files **commits the controller's work under the subagent's message.**
Nothing errors.

- **Never `git add -A`.** Ever. Name every path.
- **A controller holding staged files must tell its subagents not to commit**, in the brief. The
  guard cannot be the index, because the index is the thing being shared.

### 2.2 One worktree, one committer — and this is enforced, not conventional

**Two chats in one worktree can never both commit, by construction.** The pre-commit hook refuses
while any other file under `src/components/` or `tests/` is unstaged or untracked.

**The enforcement looks like an unrelated documentation error rather than a lock**, which is why
sessions try to work around it. It is not a convention that can be relaxed for a quick change.

### 2.3 Custody is granted by a message, never inferred from a state

**A mutation probe restores between steps. So the tree reads clean at exactly the moments it is most
dangerous to touch, and no git command can see the difference.**

`git status --porcelain` empty is a fact about **one instant**. Custody is a fact about **a process**.

- **Only the holder can say a tree is free, and only after its own work has stopped.**
- **A clean read plus no handover line means WAIT.**
- **Say the state AND its time:** _"clean at `b386ab9f3`, probe finished, yours"_ is a handover.
  _"clean"_ is a reading.

### 2.3b Directories do not hold locks. Sessions do.

**Added 2026-08-30 after a session built a lock table from directory state and got both rows wrong,
in opposite directions.**

```
ward-flow-prototype-design   dirty=12  ->  read HELD   ->  right BY ACCIDENT
                                            (the 12 were untracked scratch, no work in flight)
ward-flow-untangle           dirty=0   ->  read FREE   ->  WRONG
                                            (that session was working in pr-2390-fix)
```

**Assigning into the second would have put one session in two trees at once.**

**A dirty directory does not mean a session is working there. A clean one does not mean it is
free.** The two questions are:

- _"Does this directory contain uncommitted changes?"_ — which `git status` answers, badly (see 2.3).
- _"Is a session working here right now?"_ — which **nothing** answers, because a session's attention
  is not a property of a filesystem. **A session can hold a tree it is not currently writing to, and
  can be idle in a tree while working in another.**

**So the lock table is built from what sessions have SAID, never from what directories look like** —
and a row with no message behind it is an assumption, not a lock. **This is 2.3 generalised: custody
is granted, not observed.**

### 2.4 The main-line worktree is a baton, not a room

**A branch can be checked out in one worktree at a time, and the owner has forbidden new worktrees.**
Three of five chats want the same one. **That — not file collisions, not the commit hook — is why the
main line's work is a queue.**

**Announce taking it and announce releasing it.** Both directions, explicitly.

---

## 3. The instruments, and which ones lie

| Question                           | Use                                                   | Do NOT use                                                                                                                      |
| ---------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Has this file really changed?      | `git hash-object` on both versions                    | `git status --porcelain` — **it cried wolf four times in one day**, every one a line-ending artefact with a byte-identical blob |
| Will these branches merge cleanly? | commit both sides, THEN `git merge-tree`, then report | `merge-tree` over a dirty tree — **it is blind to working trees and says nothing about it**                                     |
| Did that commit ship code?         | `git show --stat`                                     | the commit message — **a commit that RECORDS a decision reads identically to one that IMPLEMENTS it**                           |
| Which branch is a chat on?         | `git -C <worktree> rev-parse --abbrev-ref HEAD`       | a registry row, a session store, or the branch's name                                                                           |
| Is anyone editing this right now?  | **ask them**                                          | **nothing. No git command sees uncommitted work**                                                                               |

**A rule that produces false stops teaches people to ignore it.** `git status --porcelain` failing
four times in a day is not a safety margin; it is training.

---

## 4. When one chat must contact another

**Not "when in doubt" — that produces either constant noise or none.** These five, and they are
specific:

1. **Before touching a file another chat owns.** Ownership is in the registry; verify with
   `git rev-parse <their-branch>:<path>` before assuming.
2. **When a decision makes another chat's work wrong.** The moment you know, not when convenient.
3. **Before taking the baton, and on releasing it** — with the SHA and the tree state.
4. **When you are about to land something cross-cutting** — the clock is read by 50 of ~71 test
   files; every other chat's gate results become meaningless until they take it. **Say so before, not
   after.**
5. **When you have already sent something the other chat is planning around.** State what has gone
   out **before** any proposal about who does what next.

**Never message to ask whether a chat has finished.** Use an idle notification.

**And never ask another chat to do something your own permissions blocked.**

---

## 5. What may be edited safely, without asking

- **Files only your branch has touched since the merge base.** Check, do not assume:
  `git rev-list --count <base>..<other-branch> -- <path>`.
- **Your own documents**, as listed in the ownership registry.
- **Anything in your own worktree that no other branch has modified.**

**And the three that always need a message first:** a file another branch has changed; a shared
fixture; anything named in another chat's in-flight brief.

---

## 6. The documentation half of the ask

**A change that absorbs, renames or grows a shared thing updates the documents naming it in the same
commit** — the way adding a route updates the site map in the same commit.

**This is the rule that would have prevented the day's worst confusion.** The ownership registry
named the wrong live branch for a day. **Nobody was careless:** `claude/ward-flow-ward-board` was
correct every time it was named, right up to the fold that absorbed it; the work moved to
`print-fixes` and the registry did not move with it.

**"Be careful with branch names" cannot be checked and was not the failure. "The same commit" can be.**

**And when correcting a document: correct the body, never only prepend a note.** A stale section
under a fresh correction makes the page look maintained while the wrong text stays quotable — and the
wrong text is what gets quoted, because it sits where a reader expects the answer.

**Then apply the fact-versus-record rule:** a statement about _now_ gets corrected; a record of what
was true _then_ gets dated and never back-dated; a number whose basis moved gets **re-measured, never
renumbered**.

---

## 7. Before building anything: prove it is not already built

**The owner's instruction after a plan assigned already-shipped work twice within an hour.** In
order, and the first has no command:

0. **Ask the chats.** No git operation sees uncommitted work, and **this check fails silently
   whenever anybody is merely busy rather than careless** — which is why it goes first.
1. **`git grep` for what the finished work would CONTAIN**, not for a name you guessed. The absence
   of your guess is not the absence of the feature.
2. **`git show --stat`** to tell a recorded decision from an implementation.
3. **Check your BRIEF against the filesystem** — `git ls-tree`. A wrong path usually makes an agent
   go hunting and succeed, **which is worse than failing: the work lands and the brief stays wrong.**

---

## 7b. Every baton handover carries the stranded documents

**Owner instruction, 2026-08-30, after six of nine rules documents were found missing or stale on the
line everyone builds from** — including the plan a chat was building from, and a rule the owner
himself had written that morning.

### The structural cause, because the fix has to match it

**The rules session cannot land its own work at all.** A branch checks out in one worktree at a time,
new worktrees are forbidden, and that worktree belongs to whoever holds the baton. **So every
document the rules session writes is stranded by default.**

**That is not an oversight. It is the shape of the arrangement**, and it will keep producing the same
defect until something mechanical carries the documents across.

**And the harm is not "a document is out of date".** The working line's governance document listed
**"No diagnosis"** as a live refusal for hours after the owner reversed it and a chat had already
built the field. **A stranded rules document does not merely fail to inform — it actively forbids
work that has been approved and shipped.**

### The rule

**Whoever releases the baton runs this before handing it on. It is part of the handover, not a
favour, and it needs no judgement:**

```
git checkout claude/Wardquestions -- \
  docs/ward-flow-mission-and-refusals.md \
  docs/ward-flow-changeable-data-rule.md \
  docs/ward-flow-coordination-rules.md \
  docs/ward-flow-questions-rule.md \
  docs/ward-flow-decisions-2026-08-29.md \
  docs/ward-flow-master-sequence-2026-08-29.md \
  docs/ward-flow-ward-board-plan-corrections-2026-08-29.md \
  docs/superpowers/plans/2026-08-29-ward-flow-referral-front-door.md \
  docs/superpowers/plans/2026-08-29-ward-flow-truthfulness-and-demo-fixes.md
git commit -m "docs(ward-flow): carry the standing rules onto the working line"
```

**Documentation only. No test reads any of them, so it cannot affect anything in flight**, and it
happens at the one moment somebody is already in that tree.

> **NINE PATHS, NAMED. NEVER A GLOB — and this is not fastidiousness.**
>
> The first draft of this rule said `docs/ward-flow-*.md`. **Checked before publishing rather than
> after, that pattern selects 75 files**, including `ward-flow-complete-ledger.md` — **the design
> session's ledger** — the whole phase-3 workspace, the roadmap, and every historical handover.
>
> **A rule written to stop sessions overwriting each other would have had one session overwrite
> another's register of record**, in a single command, presented as safe and requiring no judgement.
> The convenience is exactly what made it dangerous: **a glob is a claim about ownership that nobody
> checks, wearing the appearance of a path.**
>
> **Add a path here only when this session authors that file.** If a document ever moves owner, the
> line moves with it.

**If the copy would lose anything, it will show in the diff** — and the answer is then to say so
rather than to resolve it, because the rules session is the author and this is the one case where
"take one side wholesale" is correct by construction.

### The detector, so the state is visible rather than remembered

**Run from any worktree. It answers "what does the working line actually hold", which is a different
question from "what did I write".**

```
W=claude/ward-flow-phases-6-7-design
for f in $(git diff --name-only $(git merge-base origin/main claude/Wardquestions)..claude/Wardquestions -- docs/); do
  if ! git cat-file -e "$W:$f" 2>/dev/null; then echo "ABSENT      $f"
  elif git diff --quiet "$W:$f" "claude/Wardquestions:$f"; then echo "up to date  $f"
  else echo "STALE       $f"; fi
done
```

### The principle, which is the part that generalises

**A document that cannot reach the line it governs is not a rule. It is a draft.**

Every rule written in a session that cannot land it is, until carried, **a private opinion held
confidently.** The author reads their own copy, believes the rule is in force, and reasons from it —
which is exactly how a correction to a false instruction sat unread for hours while every other
session was told the opposite.

**So the test for any new rule: name the line it governs, and check it is there.** Writing it down is
not the same as putting it in force, in precisely the way `git log` is not the same as
`git show --stat`.

---

## 8. The failure this whole document exists to prevent

**An absent signal reads exactly like a passing one.**

Every collision above is a case of it: a clean `git status` during a mutation probe, a `merge-tree`
blind to a working tree, a guard that stopped guarding, a registry answering a question whose
premise had expired.

**So the standing test for any rule or check added here: what does this indicator do WHILE the hazard
is active?** If the answer is _the same thing it does when there is no hazard_, it is measuring
something else, and it will be trusted anyway.

## Mutation testing: how to put the file back, and why the obvious check is the weak one

**Found twice tonight from opposite ends. Mutation testing is worth nothing unless the file goes back
exactly, and both obvious restore routes fail.**

- **`git checkout` with a path is REFUSED** by the protected-work hook.
- **Redirecting `git show HEAD:<path>` into the file is refused SITUATIONALLY** by the auto-mode
  classifier — it worked for one session and was refused for another within the hour.

> **A situational refusal is worse than a consistent one.** You plan around a route you have tested,
> and find the gap mid-task **with a mutated file on disk.**

**The reliable route: reverse the exact edit, and verify with `git hash-object` against a baseline
captured BEFORE mutating.** Capture the hash first, mutate, observe, reverse, compare.

### Why the hash and not a clean `git diff`

**An empty diff says the file matches HEAD. That is a different claim from _"my restore was
exact"_** — and it is **equally satisfied by a file that was never properly mutated in the first
place.**

> **The weaker check looks identical to the stronger one and never fails.** The night's whole theme
> arriving in the tooling: **verify the property, not a proxy for it.**

## An assertion of something already true passes forever and reads as coverage

**A brief claimed a UI confirmation was pinned by nothing. Three tests already pinned it.** Written as
specified, the new test would have been **green on day one and forever** — and counted as coverage by
anyone reading the file list.

> **Nothing catches this. A vacuous assertion has no failure mode to observe.**

**Two defences, and only two.** **Check a brief's premise before implementing it.** And **mutation: if
you cannot construct a change that reddens a new test, the test is not testing.**

### And the brief was CONFIDENT, which is the part that generalises

**Handing a careful implementer a wrong premise stated firmly is how careful work becomes careless —
the confidence substitutes for the check.**

**Pairs with the reporting rule and with the invented symbol name that reached another session's
code.** All three are the same thing: **what a stated thing does to the person receiving it.** A
confident sentence transfers authority it never earned, and the receiver has no signal that anything
is missing.

## The protection hook blocks notes that quote the commands they warn about

**Writing this section as a shell heredoc was refused**, because it names the commands it cautions
against. **Working as designed and documented.** The remedy is the prescribed one: **use a
data-carrying tool rather than a shell heredoc.**

> **Recorded so the next session does not read it as a bug and try to work around the guard.**

## "Written but not committed" is a real state, and no ledger had a name for it

**Work finished, verification unfinished, tree released deliberately.** The referrals session's Wave 1
sat in exactly that state: three corrections written, typecheck and lint clean, mutations never run,
**a patch outside the tree that restarts cleanly.**

> **Without a name it gets recorded as _"in progress"_ — which implies somebody is working on it — or
> _"abandoned"_, which implies it needs redoing. **Neither is true and both cost somebody an hour.**

**Record it as its own state, with what remains: what is written, what is unverified, and what it
restarts against.**

## Restoring a mutated file: capture the hash FIRST, and commit first anyway

**Two rules, and the order matters because the second is not a substitute for the first.**

**Restoring from `HEAD` restores what was COMMITTED** — which on an uncommitted file is the wrong
content: **cleanly, silently, and looking exactly like success.** That cost one session twenty
minutes; the restore worked perfectly and restored the wrong thing.

**Reverse the exact edit and compare `git hash-object` against a baseline captured BEFORE mutating.**
That never consults `HEAD`, so **it cannot restore the wrong thing** — it either matches the
pre-mutation bytes or visibly does not.

> **But commit before mutating anyway, because the hash method still assumes you remember exactly what
> you changed** — which is the assumption that fails at two in the morning.

## The protection hook anchoring its override is RIGHT, not fussy

**`CLAUDE_ALLOW_PROTECTED_DELETE=1` must LEAD the whole command.** Mid-chain after an `&&` it is
blocked — and the hook says why in its own comment: an unanchored match made a command that merely
**mentioned** the variable exempt, and **exempted every segment of a compound command when only one
was intended.**

> **The next person to hit this will be tempted to conclude the hook is fussy. It is not — an override
> buried in a chain cannot say which part it authorises.** Recorded here so that conclusion is
> available before the workaround is.

## A question with a wrong premise cannot return the right answer

**I asked two sessions whether one had _taken the tree back_. Both answered truthfully and neither
could have corrected me**, because my record had missed the **handover**, not the handback.

> **Same shape as the branch-family check: _"which of these three is live?"_ could never return
> _"none of them."_** **Before asking, state the premise the question rests on** — it is the part a
> respondent can correct, and the part they will otherwise answer around.

## The one number that predicts a painful merge: files changed on BOTH sides since the merge base

**Not commit counts, not "how divergent are they", not how long a branch has been open.** Those are
noise. **Ask instead: which files has each side changed since they diverged, and do those sets
intersect?**

**And ask it as a question with an answer.** _"Will you touch `<exact path>`?"_ is answerable.
**"Does this collide?" invites the other session to judge your plans**, which it cannot do, and it
will answer confidently anyway.

### And a merge on TEST files is the dangerous one

> **A take-both resolution on two test files compiles, passes, and is wrong in a way nobody can
> read.** Source conflicts announce themselves; test conflicts resolve into a suite that is green and
> no longer asserts what either side meant.

**Which is why "staying idle is cheaper than that merge" is a real calculation rather than caution.**
A lost fast-forward costs hours of one session. **An ambiguous green test suite costs the confidence
of everything downstream of it.**

## A suite where every test mounts fresh can never catch a staleness bug

**Caught by LINT, not by 11,432 tests.** The provider's `useMemo` omitted `state.patients` and
`state.admissions` from its dependency array, so **the context was memoised against a stale state.**

**What that meant in use:** a patient added during a session **would not have appeared in search**,
and a patient arriving on a ward **would not have appeared as an occupant.** The two things the last
two commits existed to make possible.

> **Every test passed. Not because the tests are weak — because each one MOUNTS FRESH**, and a
> component that is correct on first render and wrong on the second is invisible to a suite that only
> ever renders once.

**This is not a gap to close by writing more tests of the same kind.** It is a **property of how the
suite is built**, and it means:

- **Lint was the only instrument in the building that could see it.** The exhaustive-deps rule is not
  a style rule here; it is the only staleness detector that exists.
- **The class is wider than one hook.** Anything memoised, cached, or captured in a closure has this
  shape, and **the suite is structurally blind to all of it.**
- **A test that would catch it must act twice on one mount** — render, change state, assert again.
  **Those are the tests worth adding**, and they are rare here.

**The general form, and it is the night's theme once more:** _a suite can be exhaustive and still be
blind to an entire class, and its greenness says nothing about that class._ **11,432 passing tests was
a true measurement of something other than what it appeared to measure.**

## "Take yours wholesale" sounds like a complete instruction and is not

**My own merge instruction, and it would have quietly undone the thing the merge existed for.**

The resolution I relayed was: **take your `releaseBand` wholesale**, delete the provisional constant,
assert the band count. **Two of three were right.**

> **The kept function opens `release.state === "released"`.** Taking it as-is **compiles, passes every
> test, and reintroduces the old spelling in the one file the rename was most about.**

**A "take one side" instruction resolves ownership of the code and says nothing about the SWEEPING
CHANGE crossing it.** A rename is not a side of a conflict — **it is a property the result must have,
whichever side wins.**

**So a resolution instruction needs both halves:** _which side's logic survives_, **and** _which
invariants must hold on the result regardless._ The second is the half that gets left out, because
the first feels like the whole decision.

### And the conflict I did not predict

**I said one conflict, in `ward-bed-availability.ts`. There were two.** `search/patient-search.tsx`
also conflicted — **the board line taught that screen to search referrals while the working line
taught it to search people.** Both were kept; neither replaced the other.

> **`git merge-tree` reported one because it reports content conflicts, and the second was a
> conflict of INTENT that happened to also collide textually.** My "exactly one file" was true of the
> instrument and wrong about the merge.

### What went right, and it is the checkable part

**The rename ARRIVED and it was verified rather than assumed:** zero occurrences of the old literal
under `src/`, and `BED_RELEASE_STATES` reads `["predicted", "confirmed", "discharged"]`. **11,455
tests, 0 failed.**

**That check is the one this whole episode exists for** — a rename is only landed where the old word
is gone, and nothing else demonstrates it.

## A guard made VACUOUS by a legitimate refactor — no diff on the guard, no signal anywhere

**The privacy guard pins the exact field names a referral may carry.** The destination union moved
three fields onto a `destination` object.

> **`destination` is ONE permitted key with an object behind it. So a `notes` or `diagnosis` added to
> an arm would have passed every assertion in that block.** The guard would have **looked untouched**
> and stopped protecting the thing it was written for.

**This is a shape none of the others cover:**

|                          |                                                                             |
| ------------------------ | --------------------------------------------------------------------------- |
| A guard **deleted**      | shows in the diff                                                           |
| A guard **gone stale**   | its subject changed; somebody can notice                                    |
| **A guard made vacuous** | **no diff on the guard, its subject unchanged, and it now asserts nothing** |

**The refactor was correct. The guard was correct. Together they were a hole**, and **nothing about
either change would have looked wrong in review.**

> **Rule: when a refactor moves a guarded field behind a new key, the guard must be re-proved, not
> re-read.** Plant the forbidden thing in the new location and watch it fail. **A guard that has not
> failed since the shape changed is not known to still work.**

**The repair that holds:** pin **each arm's exact field set**, **fail when a new kind arrives with no
entry**, and **check every fixture** — then mutation-prove it, with the failure naming the arm.

### And a cast is a check that cannot fail, written in the type system

`as WardReferral` in a test helper **goes on compiling the day a fixture referral is re-addressed.**
A type predicate plus an assertion goes red. **Same family: the reassuring form and the load-bearing
form look identical until the day they differ.**

## A right conclusion with a wrong reason travels as the wrong reason

**I told a session the ledger could not be committed to the working line because it would put two
committers in one tree. The conclusion was right; that reason was not** — the session holds that
worktree and is its only committer.

**The real reason was the second one I gave: the register's owner does not hold the tree, so every
ruling would be relayed through a person** — and relaying is what produced most of the day's errors.

> **The wrong reason is the one that generalises to the next case, because reasons travel and
> conclusions do not.** A correct decision defended badly will be applied wrongly somewhere it does
> not fit. **Correct the reason even when the outcome stands.**

## A test that reads its expectation FROM the thing under test can never fail

**The sharpest instance of this family, because the others needed a mistake to trigger them and this
one could not have fired at all.**

**Every role test read `EVENT_ROLE[type][0]` from the source.** So both sides of every assertion came
from the same place.

> **1,231 tests stayed green while THREE permissions changed.** The table deciding who may do what in
> a clinical prototype had **no guard over it whatsoever**, and the suite reported full coverage of it.

**And it was carrying a live defect while it did so:** `decidedBy: "Flow coordinator"` was a literal,
so **the moment a ward could accept, a ward accepting was recorded as the coordinator having
decided** — a false entry in the only field naming who answered, and **exactly the fact the override
register exists to make accountable.**

**A permissions table with no guard is worse than an unguarded constant**, because widening one is
**invisible to a review looking at the feature** — the diff shows a feature working, not a permission
opening.

> **Rule: an expectation must come from somewhere the implementation cannot reach.** Hand-written,
> pinned, and failing when a new entry arrives with no decision behind it. **If the test can compute
> its expected value from the code, it is describing the code rather than checking it.**

### And pinning a table PROVES THE MECHANISM, not the contents

**Values read out of the source and pinned are today's table made tamper-evident — they are not a
statement that today's table is right.**

> **Two different claims, and the green tick looks identical for both.** _"Nobody can change this
> silently"_ is now true. _"This is correct"_ has never been checked, **and only a human reading the
> rows against intent can establish it.**

## An escalation is an alarming result and earns the same broken-instrument check

**A session nearly escalated two rulings as blocked on a privacy change — and the answer was in the
instruction it was escalating against:** _"another destination on the same REFERRAL"_, not the same
patient.

> **Re-read the instruction before escalating against it.** An escalation stops work, moves a
> decision up, and is acted on immediately — **the same properties that make an alarming measurement
> expensive to get wrong.**

## ⚠️ VITEST CAN REPORT GREEN WHILE SILENTLY DROPPING A FILE

**Found by the backup orchestrator on its first run, and it invalidates the form of evidence this
project has been accepting all day.**

**84 ward test files were handed in. A fork died with `VirtualAlloc failed`. Vitest printed:**

```
Test Files  83 passed (83)          <- 84 were handed in
                                    <- EXIT 0
```

> **The count printed agrees with ITSELF and not with the input.** _"83 passed (83)"_ is internally
> consistent, reads as complete, and **is one file short with nothing red anywhere.**

**A second run completed all 84 — 1,236 tests, 0 failed — so the tree is genuinely green.** The
defect is not in the code. **It is that a green report cannot be trusted from the pass line alone.**

**RULE: compare the file COUNT to the count handed in. Never the pass line by itself.** A gate report
must state both: _"84 handed in, 84 ran, 1,236 passed."_

**This is the project's own absent-signal failure arriving in the test runner** — and it is worse than
the instances found so far, because **every one of those needed a mistake to trigger it and this one
needs only memory pressure.** It could have been silently true of any green report today.

## Custody decayed a THIRD time, and I had already built the file that was meant to stop it

**Two rows wrong at once:** the main line's owner, and a worktree whose folder name matched **neither
its branch nor its owner** after a reassignment.

> **My own custody file was current. The global registry was not.** I built the custody file to stop
> custody living in memory — **and created a second custody record, of which the one outside the repo
> went stale.**

**Same failure as the two registers, arriving in the fix for a different one.** And the timing is the
lesson: **custody decayed within minutes of each of four handovers tonight.**

> **Custody is not a document problem. It is a document that must be written BY the handover itself**
> — the way a fold updates the registry row in the same commit. **Anything that must be remembered
> afterwards will not be.**

## "Unreachable" is two different questions, and neither answer was the number in the row

**My ledger said "seven unreachable exports". Measured properly there is no seven.**

```
17  exports in the file
 5  imported elsewhere
12  never imported by anything
10  of those 12 are RENDERED INSIDE THE FILE - only the `export` keyword is redundant
 2  genuinely dead
```

> **"Exports nobody imports" = 12. "Safe to delete" = 2. The row said seven, which is neither** — and
> **left a five-item margin in which to delete something the page renders.**

**The row never asked which question it meant**, and the two sets differ by ten.

### And the first measurement of it was a PROXY that produced a plausible table

**A word-grep of each symbol across `src` and `tests` returned confident numbers built from:**

- **a different component with the same name** in another directory, counted as a use
- **CSS class names in a `.module.css`**, counted as imports
- and it **missed** a multi-line `import { … } from ".../morning-page"`, which defeats a fixed
  context window — **the file had to be opened**

> **The thing to measure is what is IMPORTED FROM that module.** A word-grep measures **where the
> word appears**, which is a different query that answers confidently. **It was caught only because
> the hits looked too convenient.**

**Third time tonight a count was taken of something adjacent to the property being claimed** — after
the `wc -l` that read untracked scratch as work at risk, and the vitest pass line that agrees with
itself and not with its input.

## A search that returns nothing is evidence about the QUERY before it is evidence about the code

**Ward Verifier reported a governance claim absent. It exists, and my diagnosis of why it was missed
was also wrong — I said it stopped at the first plausible answer. It searched twice.**

**The two actual causes, and their intersection was empty:**

**It looked for the governance screen BY FILENAME.** `grep -i govern` found the route file — twelve
lines, pure delegation, no text. **The screen's words live in `ward-management-modes.tsx`, a filename
containing no "govern".** It found the route and believed it had found the screen.

**And its second search used the wrong word form.** The pattern held `recorded|reason is
(kept|recorded|stored)`; **the line says "record an override reason" — the bare verb.** One suffix,
and the pattern could not match the sentence it was written to find.

> **It searched for the WORD it expected the claim to use, not for the SUBJECT the claim would be
> about.** Grepping `overrid` across all ward `.tsx` would have hit it immediately — **it had used
> exactly that pattern earlier, restricted to filenames matching "govern".** Two reasonable
> narrowings, empty intersection.

**The class, and it is neither the proxy error nor stopping early:**

> **An empty result was treated as a finding.** That is the vitest pass line arriving in a search
> method — **an absent signal read as a passing one.** A search returning nothing has told you
> something about your query first, and about the code only after the query is known good.

**Remedy: before believing an absence, search for something you KNOW is there.** The canary again —
prove the query can find before trusting that it did not.

## Renaming a state: three ways the surface is bigger than the pattern that finds it

**From the `predicted` → `expected` rename, `390eba058`. All three were found by re-checking the
RESULT, never by reasoning about the pattern.**

### The surface was 39 files by one enumeration and 47 by another

**Enumerate TWICE, at different scopes, and print the count beside the list.** The eight invisible
ones were four stylesheets, a JSON data file, a test helper, a Playwright journey and a comment-only
test.

> **The stylesheets were the load-bearing miss.** A `[data-state="predicted"]` selector **has no
> quoted string literal and no identifier**, so it is invisible to a pattern built around either.
> **A renamed state with an unrenamed selector does not fail — it produces a silently unstyled chip.**

### A blanket sweep would have edited a CLINICAL data file

**`src/data/therapies-source.json` uses `"predicted"` for clinical therapy content**, and three tests
use it as ordinary English. **Four exclusions, named in the commit** — because the next person running
this rename hits them again.

> **A word can be the state you are renaming and also just the word.** The sweep cannot tell.

### Word boundaries do not see what you think they see

**`predictedToday`** — `dT` is not a word boundary. **`"0Predicted"`** — a digit is a word character.
**Sixty-eight occurrences survived the first sweep in silence.**

> **THE RULE, and it is the same one the `released` rename produced: after a rename, grep for the OLD
> name and require ZERO. Never trust the pattern that did the work to also prove it worked.**

## Do not relay a correction the owner already has

**Ward Core asked me to pass on a retraction; Ward Board had already given it to the owner directly,
and Ward Core withdrew the request.**

> **A correction arriving twice reads as TWO separate errors rather than one** — and the second copy
> gets attributed to whoever sent it as a fresh mistake.

**Before relaying a correction, ask who else has already told him.** The relay that feels like
diligence is the one that doubles the apparent error rate of the session that found it.

## A CITATION WITHOUT A ROW looks live to every reader

**The decision register lost two rows and nobody noticed for hours.** `FD-17` and `FD-18` were
written, **announced to two sessions**, and **cited from a third row** — then deleted by a later edit
that **slice-replaced the whole region between two anchors.**

> **The edit was correct about the region it meant to rewrite, and silently discarded two rows
> inserted between those anchors an hour earlier. Nothing failed. The tooling printed the rows it had
> recorded.**

**It surfaced only because a task READ the register instead of writing to it** — the owner asked for a
list of open decisions and an anchor did not match.

> **A citation without a row is worse than a missing row.** A missing row is a gap somebody notices.
> **A live citation pointing at nothing looks correct to every reader and every other session** — and
> the sessions it was announced to had already acted on it.

**Remedies, all three:**

- **Never slice-replace a region. Insert before a single anchor.** A two-anchor region silently owns
  everything somebody else put inside it.
- **After any register edit, assert every CITED id also exists as a row.**
- ⚠️ **And that check needed correcting twice before it answered the question** — first flagging bare
  prefixes as ids, then missing a second row format. **A verification written in a hurry to check a
  failure is written by the same hands that caused it.**

**This is the register failing in exactly the way it exists to prevent, by its maintainer, using its
own tooling** — which is the strongest possible argument that **the checking role must not sit with
the writing role.**

## A CSS custom property that does not exist falls through to its fallback in silence

**The urgent flag reached for `--surface-critical` and `--text-critical`. Neither exists in this
project.**

> **CSS custom properties do not error on a missing name — they take the fallback.** So the flag,
> whose entire job is to be **visible**, would have rendered **identically to every other pill on the
> row**, and nothing anywhere would have failed.

**After writing a rule, check each token exists.** Same family as the `[data-state="…"]` selector that
survived a rename: **CSS fails by looking fine.**

## A test that passes BEFORE the code is written proves nothing, and looks like proof

**The naive assertion — flagged patient above unflagged — PASSED before any implementation existed**,
because tier 1 already outranked tier 3 for an unrelated reason. **Only the flip assertion failed:
the order changing when the flag is removed.**

> **Test-first is not the discipline. Watching the red is.** A test written first and green first is
> **worse than no test**, because it will be counted as coverage of the thing it never checked.

**And the same session applied it to its own fixture choice:** it picked the movement **least able to
reach the top any other way** — tier 3, shortest wait, earliest stage — **and asserted that property
rather than trusting it**, because a later fixture edit making that movement ordinarily top would
**hollow out the proof silently.**

## A relay is not the owner's request — THIRD refusal tonight, all three correct

**Ward Core cannot spawn subagents unless the owner asks directly.** My relay of his instruction does
not qualify.

**Three sessions have now refused a relay of mine and every one was right:** a constraint I could not
lift, an instruction that had already changed, and a capability only he can enable.

> **The pattern is not that my relays are unreliable. It is that the things worth refusing are
> precisely the things a relay cannot carry** — permissions, reversals, and capabilities. **Content
> relays fine; authority does not.**

## ⚠️ AN ALARM THAT NAMES A COUNT IS BELIEVED AT THE STRENGTH OF THE COUNT

**Ward Verifier warned that an archive move would relocate ~16 plan files and needed a quiet moment.
I cleared a window for it. Then it measured before moving: ONE ward plan is wholly superseded.** The
other fifteen are live, or complete and unmarked, **and moving those would have been wrong.**

**The 16 was never measured.** It was the assumption that *"archive"* meant *"every finished plan"*.

> **I acted on the figure and not on its provenance — and a number is exactly what makes a warning
> feel checked.** A warning that says *"this will disturb some files"* invites a question. A warning
> that says *"this relocates 16 files"* sounds like somebody counted.

**THE RULE: a warning that names a count must say whether the count was MEASURED or ASSUMED.** This is
the read/ran/inferred discipline applied to **raising** an alarm rather than to reporting a result,
and it is the half nobody applies, because an alarm feels like the responsible act already.

**The cancellation was worth more than the move.** The gate learned to read a completion banner
instead; no paths changed, and no chat went hunting for relocated files.

## ⚠️ THE VACUOUS TEST WAS WRITTEN BY THE SESSION HUNTING VACUOUS TESTS

**Ward Verifier's guard against the dangerous direction — a live plan wrongly demoted — used a
`## Complete the intake form` heading. The pattern never matched a `#` line, so widening the scan to
the whole document left all 29 tests green.**

**Written by the session that had spent the day hunting checks that cannot fail. Inside the commit
that fixed one.**

> **This is not carelessness, and reading it as carelessness loses the finding. It is the strongest
> evidence yet that the failure is INVISIBLE FROM THE INSIDE** — expertise in the failure mode does
> not confer immunity to it, because the thing that hides it is that the test is green and you wrote
> it to be green.

**The only defence is mechanical and it is the same one every time: make it go red before you believe
it.** Verifier caught its own and rewrote it to fail under mutation and pass when restored. **That is
the standard, and self-catching is not luck — it is what running the mutation buys you.**

## ⚠️ RECORD A CUT AT THE THING, NOT IN A LIST OF CUTS — Ward Referrals, and it is the better rule

**Nine Phase 9 items are recorded owner decisions cut before being built. I put that in the cut list
and called it done.** Ward Referrals saw why that fails:

> **The cut list is a document you have to already know exists. The decision register is a document
> you ARRIVE AT.**

**A fresh session told to build out remaining work reads the register, finds nine decisions with no
implementation, and reasonably concludes somebody forgot. It never finds the cut list, because nothing
points it there.**

**The remedy already exists in this programme and it worked: the medical-ward arm.** Its absence is not
recorded in a plan somewhere — **the owner's reason sits in `ward-model.ts` WHERE THE ARM WOULD HAVE
BEEN**, so a session that knows a psych ward can refer to a medical ward in real life **meets the
reason before it writes the code.**

**Generalised: a deletion, a deferral or a cut must be recorded where the thing would have been,
because that is the only place the person about to re-add it is guaranteed to look.** A list of
removals is read by people who already know; the site of the removal is read by people who do not.

## ⚠️ "PHASE 9" IS TWO DIFFERENT THINGS — the third same-name collision, and this one sent work to the wrong session

**I told Ward Decisions that nine decisions in its register needed a cut status. It checked all nine.
NOT ONE IS IN THAT REGISTER.**

> **The register's `P9-` series is the ED PSYCHIATRY HUB — `P9-D1`…`P9-D9`, `P9-F1`, `P9-F2`. A
> different Phase 9 entirely.** The nine cut decisions are `D9-1`…`D9-9` in
> `docs/ward-flow-phase-9-decisions.md`, which is **absent from that branch altogether** and lives on
> the working line.

**The concern was right and the location was wrong.** Acting on my report as written would have
stamped rows that do not exist — and Ward Decisions caught it only because it checked before writing.

**Third instance of one shape:** two `Q4`s, `R31` aimed at a plausible wrong object, and now two Phase
9s. ⚠️ **The failure is not ambiguity — it is that BOTH readings resolve to something real.** A
dangling reference errors; a colliding one returns a confident wrong answer, and the session receiving
it has no reason to doubt it.

**THE RULE: cite a decision by its DOCUMENT AND ID TOGETHER, never by a phase number.** `D9-4` in
`ward-flow-phase-9-decisions.md` is unambiguous. *"The Phase 9 decisions"* is not, and was not.

**And the second half, which is mine: name the file before assigning work in it.** I assigned nine
edits to a session whose branch does not contain the file. **One `git rev-parse <branch>:<path>` would
have caught it, and it is the check this project already has a rule for.**

## ⚠️ THE REFUSAL REGISTER FORBADE WORK THE OWNER HAD ALREADY APPROVED

**Ward Verifier saw a full name, record number and date of birth on a patient screen, against a
refusal register saying *"Sex is the only permitted patient attribute"*. It nearly filed the day's
worst breach.**

**It is not a breach. `PD-1`, the owner's ruling that same morning, authorises exactly those fields on
the Patient record.** ⚠️ **THE REGISTER WAS THE THING THAT WAS WRONG** — a stranded rule forbidding
shipped, approved work, **and the startup prompt handed to every new chat said the same wrong thing.**

> **A refusal register decays in the one direction nobody watches.** Everyone checks whether the code
> broke a rule. **Nobody checks whether the rule still describes what the owner wants** — and a rule
> that has gone stale does not go quiet, it **accuses**.

**Two costs, and the second is the larger:** a session almost reported approved work as a serious
breach; and **every new chat started from a prompt asserting a constraint the owner had lifted.**

**THE RULE: when a ruling widens what is permitted, amend the refusal register IN THE SAME ACT** — and
**scope the amendment to the ruling, never wider.** Verifier amended to `PD-1` alone and re-verified
that the Referral and Admission guards are still closed and address is still denied. **A stale
prohibition and an over-wide repair are the same failure in opposite directions.**

## ⚠️ A PAGE RELOAD RESETS THE PROTOTYPE, AND IT INVALIDATED A TEST OF THE PRODUCT

**Ward Verifier marked a patient arrived, navigated BY URL, saw no change on the ward, and was about
to report that the transition does not work.** A full page load resets the provider to seed — **the
patient was back in the transport queue.** Redone with in-app links only, it works.

> ⚠️ **The method was broken, and the broken method produced a confident product failure.** It was
> caught only because **the reset was visible.** A subtler reset would have produced a bug report
> about working code.

**THE RULE: when checking a running app, change one thing and reach the second screen the way a USER
would.** A URL is not navigation in an app that holds its state in memory.

**And the separable half, which is the owner's:** **anybody demonstrating this who refreshes, or opens
a link in a new tab, loses everything they just did.** `D9-8` names *"the prototype's memory"* and it
is **cut** — **but a demonstration risk is not the same object as a feature gap**, and he should hear
it before a room rather than during one.

## ⚠️ THE INSTRUCTION TRAVELLED AND THE TOOL DID NOT

**`scripts/run-ward-tests.mjs` — the wrapper that refuses unless every file handed in produced a
result — existed on ONE unfolded branch. Four chats were told to use it. THREE COULD NOT RUN IT.**

**It is the stranded-document failure wearing a different hat, and the tell is different:**

| Stranded thing | How it fails |
| --- | --- |
| **A document** | **Silently unread.** Nobody knows it exists, so nobody misses it |
| **A tool** | ⚠️ **A confident *"command not found"* that reads as the READER'S mistake** |

**The second is worse to diagnose, because the session that cannot run it assumes it has the name
wrong or the path wrong** — exactly the shape of *"you go looking for something obvious, do not find
it, and assume the failure is yours."* **Ward Board did not assume that. It measured three branches
and reported the absence, which is why it was found in minutes rather than days.**

**THE RULE: before relaying a tool as a standing discipline, confirm it is reachable from every
branch that is being told to use it.** `git rev-parse <branch>:<path>` — **the same check already
required before editing a file, applied before recommending one.**

**Fixed by MERGING the branch rather than cherry-picking the file** — the branch was cut from the
working line, **so a cherry-pick would have left a duplicate to conflict at the real fold.** Landed
`1fcca3498`; proved at `51f53c26c` with **87 handed in, 87 ran, 1269 passed, exit 0.**

## ⚠️ I COMMITTED THE STRANDED-THING FAILURE WITHIN THE HOUR OF WRITING IT UP

**Ward Board found that `run-ward-tests.mjs` lived on one branch while four sessions were told to use
it. I wrote that up as a rule.** ⚠️ **Then I told four sessions to read
`docs/ward-flow-safety-checklist.md`, WHICH EXISTS ONLY ON `claude/Wardquestions`. None of them could
open it.**

**That is TWICE IN ONE NIGHT, from two different sessions, in the same shape:**

| Who | What they had just done | What they then did |
| --- | --- | --- |
| **Ward Verifier** | spent the day hunting checks that cannot fail | **wrote a vacuous test, inside the commit fixing one** |
| **The orchestrator** | wrote up the stranded-tool rule | **stranded a document, in the message citing the rule** |

> ⚠️ **KNOWING A FAILURE MODE IS NOT IMMUNITY TO IT. The only defence that has ever worked here is
> MECHANICAL** — Verifier's mutation run caught its test; **the regenerated inventory caught my
> document. Neither was caught by a careful reader, including the one who wrote the rule.**

**THE RULE, and it is one line: before naming any file in an instruction, run
`git rev-parse <their-branch>:<path>`.** **The check already exists and is already required before
EDITING a file. It is now required before CITING one.**

### The remedy is `git show`, and NOT a copy

```bash
git show claude/Wardquestions:docs/ward-flow-safety-checklist.md
git show claude/Wardquestions:docs/ward-flow-task-ledger.md
```

⚠️ **Copying the two most-needed files onto the working line is the tempting shortcut and it is
forbidden by the changeable-data rule: it creates a SECOND HOME for a fact that changes hourly.**
**One home, read remotely, is correct. A full docs fold would also be correct and is 257 commits,
so it belongs to a quiet moment and to the session that owns folds.**

### The measurement that found it

**130 ward documents across SIX branches. 16 exist on one branch only — TEN of them mine, SIX on the
design branch, including all four specs three sessions are building from.**

⚠️ **And one number about this session's own position: `claude/Wardquestions` can read 102 of the
130. TWENTY-EIGHT of the project's ward documents are not readable from the orchestrator's worktree
at all.** **The citation check passes only because it resolves paths across all six branches rather
than the one it runs on — which was the right design and was not deliberate.**

## ⚠️ AUTHORITY AND EVIDENCE ARE DIFFERENT THINGS, AND WINNING ON EVIDENCE DOES NOT SETTLE AUTHORITY

**I argued that a relay whose SUBJECT is a conflict carries its own ordering: the owner was told two
of his instructions contradicted each other and he adjudicated, so his answer sits after both.**
✅ **Ward Referrals agreed the argument was sound, said so, kept it as a principled exception to its
own rule — and did not act on it.**

> ⚠️ **"YOU HAVE WON THE POINT YOU WERE ARGUING. IT IS NOT THE POINT THAT BLOCKS ME."**

**Its reason, and it is correct:**

> **It had put the same question to the owner IN ITS OWN CHAT twenty minutes earlier and had no
> answer there.** ⚠️ **A peer's report, however well-evidenced, CANNOT DISCHARGE A QUESTION A SESSION
> PUT TO ITS USER.** **That is a standing constraint, not a judgement to be re-made when the evidence
> looks good.**
>
> ⚠️ **"The better the evidence, the more tempting it is to treat as an answer — which is exactly
> when the rule earns its keep."**

**THE DISTINCTION: evidence tells you what is TRUE. Authority tells you whose word CLOSES a question.
A relay can carry the first perfectly and cannot carry the second at all** — which is
*content relays fine; authority does not*, sharpened by a case where the content was airtight.

**And the asymmetry is what decides it rather than the principle:** ⚠️ **waiting costs a sentence;
building a whole hub on second-hand authority costs the hub if ANY of three links in the chain is
wrong.** **Tonight produced four stale pointers, a false register row and a fabricated commit hash.**
**This is the one place where being slow is free.**

### ⚠️ AND THE SAME TEST APPLIES TO A RELAY I HAD ALREADY SENT

**I relayed *"yes, record the referral arrival"* to Ward Core as an answer.** ⚠️ **Ward Referrals
pointed out that it answers a question WARD CORE put to the owner, and that Ward Core had said it
would ask him directly and build to HIS answer rather than to anybody's reading of it.**

**So it should hear that from him, not from me relaying him.** ✅ **Ward Referrals declined to pass it
on for the same reason, rather than treating "the orchestrator already relayed it" as making the
relay safe** — **which would have LAUNDERED the same relay through a third session.**

**THE RULE: when a session asks the owner a question directly, the answer must reach it directly.**
**A coordinator can carry the NEWS — *"he has answered, ask him"* — and must not carry the ANSWER as
though it closed the question.**

### ✅ And the correction it volunteered is the model

**It had told the owner that BOTH community-hub instructions were second-hand.** **One was
first-hand — typed to the orchestrator — and it corrected that to him unprompted**, noting that its
error had made his own conflict look like a garbled message rather than two things he said at
different times.

⚠️ **That is the harder correction to make: it exonerates somebody else at the cost of your own
report.**

## ⚠️ A NUMBERED LIST IS AN ADDRESS, AND TWO PEOPLE CANNOT BOTH USE IT

**Two numbered question lists were live in the owner's chat at the same time. He replied with bare
numbers.**

```
mine        1. community hub   2. record the ARRIVAL TIME   3. the median   4. recommendations
Ward Core   1. join a referral to a person   2. record someone's SUBURB   3. urgent reasons   4. (withdrawn)

his reply   1. Build community hub       <- names MY subject; matches Core's item 1 not at all
            2. Yes record                <- BARE. Fits SUBURB and ARRIVAL equally
            3. What is governance median <- names MY subject
            4. Give recommendations      <- answers MY item 4
```

⚠️ **Three of four point at my list. The FOURTH is the one that would have moved the model** — and
**the word *record* does equal work in both items.** **Balance of evidence is not the same as an
answer when the cost of being wrong is the keystone.**

**THE RULE: a numbered list is an ADDRESS. Whoever is SECOND into a chat must name the SUBJECT in
each item, never the number** — *"the community hub:"*, *"the arrival timestamp:"* — **so an answer
carries its own routing.**

⚠️ **AND ALL THREE OF US DID IT INSIDE ONE EXCHANGE, EACH HAVING JUST STATED THE RULE.** **Ward
Referrals wrote *"two of us asking near-identical questions within an hour is how one answer gets
stretched to cover both"* and then asked the escort question in the same breath; Ward Core put a
fourth item on its list that was already with him; I ran a numbered list into a chat that already
had one.**

**Resolution, and it is the shape to copy: ONE ASKER.** ✅ **Ward Core holds one of the two lists and
is the direct chat, so it asks which question was answered — and relays his EXACT WORDS rather than
its reading of them.** ⚠️ **Nobody else re-asks, because re-asking is the loop that produced this.**

**And the disambiguating question beats the re-asked one:** *"did you mean the suburb or the arrival
time?"* — **either answer is useful and neither makes him re-decide anything.**

### ⚠️ AN EVIDENCE LEG THAT FITS BOTH HYPOTHESES IS NOT EVIDENCE FOR EITHER

**I offered three subject-matches. Ward Core corrected one of them — in MY favour, which is why it is
the leg I would never have questioned.**

⚠️ **It had asked him for recommendations on ITS four items, in those words, at about the same
time.** **So *"4. Give recommendations"* is evidence of a message he sent IT as much as one he sent
me.** ✅ **The conclusion survives; the honest count is TWO strong matches, not three.**

> **A leg that fits both hypotheses is the one you notice last, because it agrees with you.**

**And the shape of the correction is the point: it made my case weaker while confirming my
conclusion.** ⚠️ **A session that only corrects you where it disagrees is auditing the argument, not
the evidence.**

### ✅ WHEN BLOCKED ON AN ANSWER, TAKE THE WORK DISJOINT FROM **BOTH** BRANCHES

**Ward Core is building the transport booking event while it waits: `Movement` and `TransportJob`,
not `Referral`** — **so nothing it writes now needs unwinding whichever way the answer lands.**

⚠️ **Not the work that is *probably* fine. The work that is fine EITHER WAY.** **The escort control
stays held for a separate ruling while the event carrying the judgement proceeds — the same split,
done at the right seam.**


## ⚠️ A QUESTION ROUTED TO WHOEVER DECIDES DOES NOT REACH WHOEVER BUILDS

**Ward Board found a gap in `FD-23` and sent it to Ward Decisions. Correct choice of
decision-maker, and the question still would not have reached the screen.** ⚠️ **The ownership
registry gives the `FD-23` ward-blindness rule — and the whole referral surface — to Ward
Referrals, reassigned by the owner on 2026-08-30.**

> ⚠️ **So a ruling would have landed with the session that decides it and never reached the session
> that implements it, and the rule and the screen would have drifted apart with nobody wrong.**

**THE RULE: a question about a rule goes to TWO addresses — whoever rules on it, and whoever owns
the surface that implements it.** **When those are the same session, say so; when they are not,
name both, and say which is which.**

### ⚠️ AND THE REASON IT MIS-ROUTED IS THE PART THAT WILL REPEAT

**Nothing was wrong with the reasoning. `FD-23` questions went to Ward Decisions until 2026-08-30,
and that was right until the owner moved the surface.** ⚠️ **A ROUTING HABIT OUTLIVES THE
OWNERSHIP IT WAS BUILT ON, AND NOTHING FAILS WHEN IT DOES** — the message sends, the recipient is
real, the question is good, and the answer simply arrives somewhere that cannot act on it.

> ✅ **So an ownership change is not finished when the registry row is edited. It is finished when
> every session that ROUTES to the old owner has been told** — which is a coordination task, not a
> bookkeeping one.

**This is the same shape as the branch trap in the registry: the live board branch is
`claude/ward-flow-print-fixes`, named after nothing it builds.** ⚠️ **Both are cases where the
addressing scheme silently stopped describing the thing it addresses.**

## ⚠️ THE PEER MESSAGE AND THE OWNER MESSAGE CANNOT BE COMPOSED IN THE SAME TURN

**Ward Referrals asked me to decide whether a question should go to the owner, and asked him in the
same turn.**

```
to me    "Tell me if it should go to the owner."
to him   "One question that may be yours, and I'd rather you decided it than me: ..."
```

⛔ **It handed me a decision and took it before I could answer.** ⚠️ **Worse than announcing and
executing in one move, which is the version already in these rules** — **there, nobody was asked.**

### ⚠️ IT HAD WRITTEN THIS RULE DOWN AN HOUR EARLIER AND THAT CHANGED NOTHING

> ⚠️ **"A decision announced and acted on simultaneously cannot be coordinated with."** — **its
> own note, written an hour before it did this for the third time tonight.**

**Its diagnosis, and it is right:**

> ⚠️ **"The failure does not feel like a decision at the time. Asking him felt like REPORTING to
> him, and the routing question felt like a SEPARATE CONVERSATION with you. They were one thing."**

✅ **THIS IS THE STRONGEST FORM OF "A MEMORY NOBODY READS IS NOT A CONTROL", because here the
memory WAS read and written and STILL did not fire.** ⚠️ **A rule only fires at a moment that
presents itself as a decision. This moment presents itself as two unrelated pieces of
correspondence.**

> ✅ **SO THE FIX IS MECHANICAL, NOT ATTENTIONAL: when a question is going to the owner, the
> message to the peer and the message to the owner MUST NOT be composed in the same turn.** **One
> of them waits for a reply.** ⚠️ **There is no version of "be careful" that catches this** — **it
> has now been tried and it failed while the ink was wet.**

### ✅ AND WHAT NOT TO DO ABOUT THE DUPLICATE

**He now has the question twice. Neither of us is sending a third message explaining that.**

> ✅ **He does not care who asked. A correction about the collision costs him more than the
> collision did.** **He answers once, wherever he answers, and whichever session receives it tells
> the other.**

⚠️ **RECORDED SO A LATER READER DOES NOT MISREAD THE SILENCE: question 12 may be answered in
EITHER chat.** **An unanswered copy is not evidence the question is open.**

## ⛔ THE MEMORY STORE IS SHARED, UNVERSIONED, AND TWO SESSIONS WRITE TO IT

**Ward Core went to record a lesson in `~/.claude/projects/D--Repos-Database/memory/`, found I had
already written it, removed its own weaker version and left mine.** ✅ **Exactly right, and it
flagged the collision rather than leaving two copies.**

> ⚠️ **"A durable lesson written by either of us is visible to both, and duplicating one costs the
> next reader the thing that makes it findable."** — **and its own verdict: *"I got lucky that the
> collision was obvious."***

⛔ **THE PART THAT MATTERS MORE THAN THE DUPLICATE: THAT DIRECTORY IS OUTSIDE GIT.** ⚠️ **There is
no history, no `git checkout HEAD --`, no diff against a parent.** **The truncation that emptied a
61KB document earlier tonight would, in that directory, have been UNRECOVERABLE except from a
backup.**

### ✅ HOW A SHARED-STORE EDIT GETS VERIFIED WITHOUT VERSION CONTROL

**My file measured 9,419 bytes against the 10,351 I had written. 932 bytes missing is not something
to accept on an explanation.**

```
backup 2026-08-30T150130Z    7,151    the last copy before either edit
what I wrote                10,351
now                          9,419    <- 932 short
diff(backup, now) removals       0    <- NOTHING deleted
```

✅ **Zero removals against the backup proves no pre-existing content was lost, and the arithmetic
then has exactly ONE consistent history: Ward Core's 932 bytes were already in the file when I read
it, my append preserved them inside my 10,351, and it later removed its own.** **Both totals
reconcile, and no other sequence produces both.**

> ⚠️ **THE EXPLANATION WAS TRUE, AND I COULD NOT HAVE KNOWN THAT WITHOUT THE BACKUP.** **In a git
> tree this is one `git diff`; here the backup IS the version control, which is the whole argument
> for running it often rather than at the end.**

**RULES FOR THAT DIRECTORY, all three cheap:**

1. ✅ **Read before appending. Check for an existing section on the same lesson and extend it**
   rather than adding a second — the duplicate is what makes neither findable.
2. ✅ **Back up before writing to it**, because the backup is the only rollback that exists.
3. ⛔ **Never `open(path, "w")` there.** **Encode first, temp file, `os.replace`** — the failure
   mode that merely cost a `git checkout` in the repo costs the file itself here.
