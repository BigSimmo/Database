# SDD ledger — plan: docs/superpowers/plans/ward-statistics-skeleton.md

Spec: the owner's own words, quoted verbatim at the top of the plan. That is the binding
authority; the plan is its argument.

## Pre-flight scan

### Pairs sharing a file or an interface

| A      | B                             | A produces                                                       | B consumes                                              | Found                                                                                                                                                               |
| ------ | ----------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Task 1 | Task 2                        | `statistics-sections.ts` — the section list, hrefs, descriptions | the hub index renders it                                | **Clean, but ordering is load-bearing.** Task 2 cannot start before Task 1 lands. Enforced by the plan and by Constraint 2.                                         |
| Task 1 | Task 2                        | new screen components + route files                              | nothing                                                 | **Disjoint.** Task 1 writes only new files.                                                                                                                         |
| Task 1 | Task 2                        | `tests/ward-statistics-sections*.ts(x)` (new)                    | `tests/ward-statistics.dom.test.tsx` (existing)         | **Disjoint file sets.**                                                                                                                                             |
| Task 1 | live constant-gap implementer | —                                                                | `statistics-screen.tsx`, `ward-statistics.dom.test.tsx` | **COLLISION AVOIDED BY CONSTRUCTION.** Both files are mid-edit by another agent right now; Constraint 2 puts them out of Task 1 entirely and defers them to Task 2. |

### Does each task's own text agree with itself?

| Task | Checked                                                       | Found                                                                                                                           |
| ---- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 1    | "no invented figures" vs "dynamic screens resolve their unit" | **Agrees.** Resolving a unit's NAME is not a figure. Reading `ward-model.ts` is a read; Constraint 1 restricts writes.          |
| 1    | files it creates vs files it later touches                    | **Agrees.** Every path is new.                                                                                                  |
| 1    | tests it specifies vs code it specifies                       | **Agrees.** `statistics-sections.ts` is the single source both the hub and the tests read — the fact cannot drift between them. |
| 2    | its edit vs Constraint 2                                      | **Agrees, conditionally.** Only after the constant-gap implementer commits.                                                     |

### Against the review rubric

| Plan mandates                                        | Rubric treats as                                              | Found                                                                                                  |
| ---------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Constraint 8, "prefer not shipping a control at all" | un-wired `<button>` is a lint failure and a known repo defect | **No conflict — the constraint is stricter than the rubric.**                                          |
| Constraint 4, "no `0` standing in for not-built"     | a test asserting nothing would be a defect                    | **No conflict.** The tests assert the ABSENCE of numerals in a placeholder, which is a real assertion. |

## Rulings made before execution

**Ruling: four new `page.tsx` files, and the route list is frozen for the whole plan.**
Why: every new page moves a count literal in `tests/ward-nav.test.ts`, which belongs to Ward Lead
and which I may not edit. A list that grows during execution would make it register the same file
repeatedly. Cost if wrong: a fifth section later needs a second registration round.

**Ruling: per-unit detail is DYNAMIC (`ward/[unitId]`, `ed/[edId]`), not a page per unit.**
Why: the owner asked for "detailed stats for each of the wards and ED" — that is one screen
serving many units, not ~20 routes. Dynamic routes also sit outside the static-route nav check, so
they need no nav entry at all. Cost if wrong: if a ward ever needs a genuinely bespoke page, it
has to be split back out.

**Ruling: `overview` and `compare` go to `WARD_NAV_INTENTIONALLY_UNLISTED`, not `WARD_NAV`.**
Why: they are reached by `<Link>` from the statistics hub, which is exactly the precedent
`WARD_REFERRAL_INTAKE_HREF` already sets in that file. Putting three statistics entries in the
sidebar would bury the hub the owner actually wants to land on. Cost if wrong: one of them is
harder to find than it should be — a one-line move for Ward Lead.

**Ruling: the home page KEEPS its existing reviewed figures for now, and gains the index above
them.** Why: the owner said skeleton, and moving reviewed, honesty-checked content into a new
Overview page is a content migration, not scaffolding — it would put 40 passing tests and two
closed Critical findings at risk for no structural gain. Cost if wrong: Overview starts emptier
than the owner pictured, and the migration happens during fleshing-out instead.

**Ruling: `tests/ward-nav.test.ts` will be MORE red during this plan, and that is declared rather
than discovered.** Why: it is already red at 3 failures from the statistics route; four new pages
move the count literal again. Ward Lead owns the fix and has taken it. Cost if wrong: nothing —
provided the final route list reaches Ward Lead before it makes its edit, which is why the list is
frozen above.

## Execution

Task 1 dispatched (opus) at BASE `e4a46590c`. Brief: `task-1-brief.md`. Report due at
`task-1-report.md`. Scoped to NEW files only — `statistics-screen.tsx` and
`ward-statistics.dom.test.tsx` are excluded because another implementer holds uncommitted
changes in both.

**Model choice:** opus, not sonnet. The catcher test fails: there is no named gate that catches
"the placeholder copy sounds like an invented figure" or "this reads like it belongs on that
page". The success criterion is a judgement, which is a veto.

## ⚠️ Concurrency hazard I created, and the mitigation

Two implementers are live in `src/components/ward-management/statistics/` at once: the skeleton
(new files only) and the constant-gap fix round (`statistics-screen.tsx` +
`tests/ward-statistics.dom.test.tsx`). Their FILE SETS are disjoint by construction, so no edit
can collide.

**Their COMMITS are not disjoint.** The pre-commit hook inspects the whole working tree and
refuses whenever other unstaged or untracked files exist under `src/components/` or `tests/` —
so whichever finishes second is blocked by the first's in-flight files, even though the work is
unrelated. That is correct hook behaviour and must not be worked around.

_Ruling: sequence the commits rather than relax the hook._ Both implementers are told: no
`--no-verify`, no `git add -A`, never stage a file you did not write, never clear the tree to get
through — report `DONE_WITH_CONCERNS` naming the blocking files and let me sequence. Cost if
wrong: one implementer idles until the other lands.

This hazard is mine: I dispatched the fix round while the skeleton was mid-write. The correct
order was to let the skeleton commit first. Recording it so the next controller sees the cost of
overlapping two implementers in one directory — the edits are safe, the commits are not.

## The mutual block, diagnosed from the hook rather than guessed

`.githooks/pre-commit` does not refuse on "other files exist". It refuses when the STAGED change
triggers a generator AND other working-tree files are **inputs to that same generator** — because
the generators read the working tree, so a mixed tree makes generated docs describe the wrong
commit.

The constant-gap pair (`statistics-screen.tsx`, `tests/ward-statistics.dom.test.tsx`) triggers
`sync_design_system_adoption`, whose input pattern is `^(src/app/|src/components/|tests/|…)`.
Every one of the skeleton's untracked files matches it. The skeleton's own commit will trigger the
same generator and be blocked by the constant-gap pair. **Genuinely mutual, and correct.**

_Ruling: land both sets as ONE commit, with the hook running normally, once the skeleton finishes
writing._ Rejected alternatives and why:

- `--no-verify` — forbidden, and it is what left `aa97b92a1` with stale generated docs that
  `e4a46590c` had to close later. The same mistake twice in one session is not a workaround, it is
  a habit.
- `SKIP_DOCS_SYNC_HOOK=1` — the hook's own scoped override, so not illegitimate, but it leaves the
  generated docs stale for a commit on the exact reasoning above. Not needed when waiting works.
- `git stash` — forbidden outright; the stash stack is shared with every other worktree on this
  machine and other sessions pop it concurrently.
- Staging one agent's files under the other's message — the precise thing both implementers were
  told not to do. The fix implementer had already staged its two files, hit the refusal, and
  **deliberately unstaged them** so a bare `git commit` from the other agent could not swallow them.
  That was the right instinct and it is why this is recoverable.

**Cost if wrong:** the two changes land together and are less independently revertible than two
commits would be. Accepted, because the alternative is either stale generated docs or an agent's
work claimed under another's message. The commit message will attribute both.

**Live risk while we wait:** the constant-gap pair is UNCOMMITTED — 2 files, 80 insertions, 12
deletions, `statistics-screen.tsx` at sha1 `e9594020b5bf16006bb81c206dc6d198b09a687b`. That is the
only state this repository can lose, and this session has already lost-then-recovered 399
insertions the same way. It is named here so a crash does not make it invisible.

## Carried into the fleshing-out — a partition trap, from Ward Verifier

**A patient can be PULLED to a bed that is still PENDING. Those states are not mutually exclusive,
so any statistic treating bed states as a partition will double-count or drop.**

Checked against the shipped derivations rather than accepted, and they are clear — but by luck of
construction, not by design:

- `bedsBeingPrepared` counts `BedRelease.preparing`, a boolean. No partition.
- `pullToArrival` measures per admission row. One row per person, no bed state involved.
- The only exhaustive switch is over `admission.state`, a single field with four values — a
  genuine partition, with a throwing `default:` and a `const unhandled: never`, both proved to
  fire by mutation.

**It will bite `/statistics/compare`.** That section is meant to hold "the same measure beside
every ward", and the obvious first measure is bed counts by state. That is precisely the sum this
warning is about. Recorded here so it is read before somebody writes it, not after.

Two more falsifiers to answer before any per-unit figure ships:

- **Attribution.** A referral decline sits on `ReferralAddressing`, which carries no unit at all,
  so a per-ward column would be fiction. Other measures likely fail the same test; which ones is
  not yet known.
- **`averageWaitlistWaitMinutes` is always `null`** — no instant on `Admission` marks entry to
  `"waitlisted"`. Rendered bare it looks like missing data rather than a missing field.

## Six red tests on this branch are STALENESS, not defects — do not investigate

Ward Lead's line is green at 131 files / 1696 tests (`31b4084cd`). This branch predates `fa616d1c9`,
which removed nine community referrals, and a commit adding `RECORD_LEAVING` and `WITHDRAW_REFERRAL`
with their permission-map entries. So this seed carries 18 referrals where the pins expect 9, and
37 events against a map covering 35.

That accounts for all six: `ward-referral-model`, `ward-referral-reducer`, `ward-referral-screens`,
`ward-network-referral-placement`, `ward-referral-control-labels`, `ward-event-permissions`.

**They clear on merge, which is Ward Lead's. Do not sync this branch.** My inference (three
behaviourally inert source files; a component href cannot reach a pure reducer test) reached the
right conclusion but could not see the cause — the pins moved under me.

## Phone-width browser check — PASSES on the frame, one page deferred

Checked at 375×812, 2026-09-01 ~18:10. The `@media` reserve works: on `/statistics/overview` and
`/statistics/compare` the "these are not real figures" disclaimer is fully visible with the fixed
phone bar above it, nothing covered and nothing clipped. Both pages render through
`statistics-section-frame.tsx`, so the reserve holds for all four by construction — but that is an
inference about the other two, not a measurement of them.

**`/statistics/ward/[unitId]` could not be checked: it threw `Runtime SyntaxError: Invalid or
unexpected token` plus a chunk-load failure.** NOT a defect, and I checked rather than assuming —
`statistics-ward-screen.tsx` was written at 18:12:05 and I loaded the page at 18:12:27, 22 seconds
later, with the implementer actively mid-edit. The dev server hot-reloaded a half-written file.

_Ruling: re-check both dynamic pages at phone width AFTER the fix round commits._ Cost if wrong:
one more browser pass.

**The lesson is mine and it is the same one twice today:** browser-checking a page while an
implementer is editing it manufactures a red that is not there, exactly as running two vitest
suites at once manufactured spawn errors. Concurrency is free for edits on disjoint files and is
not free for anything that observes the tree — commits, dev-server renders, test runs. Observe the
tree only when nothing is writing to it.

## Task 2 — statistics hub index + disclaimer fold: COMPLETE (2245e0ecf, review clean)

Spec ✅, task quality approved, no Critical or Important. `ab16d11a9..2245e0ecf`, six files, 130 tests.

**The disclaimer fold was the risk and it held.** The reviewer compared the actual before/after
text rather than the report's account, and confirmed a widening on both axes:

- Banner keeps the frame's "every instant **this prototype holds** is invented" — the broader claim,
  which entails the home page's "every instant they are computed from".
- Access becomes "can reach this page **and read everything on it**" — broader than the home page's
  "every figure on it" (figures ⊂ everything, nothing dropped) and a strict addition to the frame's
  bare "can reach this page".
- Both sentences now pinned by **whole-sentence equality on both sides**. The old tests asserted
  substrings, so a dropped clause would have passed green.

Nothing restated: every section label, description and href is consumed programmatically; zero
literal occurrences outside `statistics-sections.ts`.

## ⚠️ THREE ATTRIBUTION FAILURES TONIGHT, ONE SHAPE — and mine was the worst

**A claim that is true of something, passed on without saying of what.**

1. Ward Lead's "the routes are held visible by ward-nav.ts writing them as literals" — true of its
   tree, false of mine. I relayed it to an implementer as fact without opening the file.
2. Ward Answers' "Ward Builder Two changed two of your statistics files" — a two-dot diff from a
   merge base that predated Ward Lead's own work, crediting its commits to whichever branch it
   diffed toward.
3. **Mine.** I caught trap 2's shape, then substituted a check with the identical flaw one level
   up: `git merge-base 6df4f86fd claude/ward-builder-two` IS `6df4f86fd`, because that branch
   descends from it — so "its own base to its own tip" swept in everything it had MERGED and read
   it as authorship. I accused a peer, on a bad measurement, of crossing its own stated boundary.

**THE MECHANISM, which is the part that generalises: catching the first trap is what stopped me
looking for the second.** A near miss you have just successfully avoided is the strongest available
argument that you are now measuring correctly. It is not carelessness — it is the opposite failing,
and it is invisible from inside precisely because the care was real.

### The fix

    two-dot   A..B    everything in B and not in A, INCLUDING what B merged.  "What would I get."
    three-dot A...B   what B authored since diverging.                        "What did this branch do."

Both my measurements were two-dot and both read as authorship. **Name the tree, name the measurer,
name the command — and say which form answers which question**, because the two differ by one
character and both read as "what did this branch change".

**The same trap in miniature:** my RF-007 citation is `ward-movements.ts:1455`; Ward Builder Two's
is `:1301`. Same record, different tree, neither wrong. _A line number is a claim about a tree
wearing the costume of a fact about a file_ — and I cited line numbers to three chats today without
naming a tree once.

### The real conflict, measured

`git merge-tree --write-tree <master line> HEAD` → CONFLICT, in exactly ONE file:
`tests/ward-statistics-derivations.test.ts`, with Ward Builder Two's branch absent from the command
entirely. My side carries the audit corrections; Ward Lead's carries Ward Verifier's three
mis-attributed safeguards. Different assertions in one file — neither supersedes the other.
Offered to Ward Lead rather than resolved blind at the fold.

## Claims register — LANDED at f21ba35aa, with one unexplained red

929-line register, 312-line test. **74 claims pinned** to an exact substring of a real source file,
read from disk at test time, asserted to appear **exactly once**. **12 claims listed as
UNEVIDENCED** with the reason, so the gap is countable rather than invisible.

Cited across 12 files: `ward-model.ts` (31), `ward-flow-reducer.ts` (11), `ward-statistics.ts` (8),
`ward-admissions.ts` (7), the community derivations and screen (8), and the rest.

**Whitespace is the only normalisation** — so a Prettier re-wrap is not a false red, but a renamed
field, a changed type, a deleted line and a second copy of the same declaration all still fail.

**The register CITES the screen rather than holding its sentences**, and says why: the sentences are
JSX with `<code>`, `<strong>` and entity escapes, and two are conditional branches. Pulling them in
would flatten them out of the DOM tests' reach. So both ends are pinned — the screen still says it,
and the source still supports it.

### What it admits it cannot catch, in its own doc comment

The gap that matters: **a claim asserting an ABSENCE has no line to cite**, because the fact is that
no line is there. "There is no role check on this route", "no instant marks entry to `waitlisted`" —
adding the very field such a claim denies would break nothing here. Those are in `UNEVIDENCED_CLAIMS`
with the reason and, where one exists, the other test that guards them.

Also uncaught: claims about the seed fixture (a fixture is not a contract, and pinning one would go
red on every seed edit and teach a reader to ignore the red); whether a sentence still SAYS what its
summary claims, as opposed to still existing; and prose on a surface nobody has added to
`REGISTERED_SURFACES`.

### ⚠️ ONE RED I CANNOT EXPLAIN — recorded rather than dismissed

The very first run reported `Tests 1 failed | 11 passed (12)`. **Fourteen consecutive runs since
have been 12/12 green on byte-identical content**, tree clean, HEAD unmoved.

Most plausible cause: the run overlapped the implementer's own final verification, and this machine
is intermittently failing to fork — the exact hazard Ward Verifier flagged, where a command that
never ran returns output indistinguishable from a finding. **I cannot demonstrate that**, and a
guard that fails one run in fifteen is worse than no guard, because people learn to re-run it.

_Ruling: report it as unexplained rather than green, and watch it._ If it recurs, the register is
not trustworthy until the cause is found. Cost if wrong: one recorded anomaly that turns out to be
machine noise.

**The implementer's report has not been written** — no mutation proof and no statement of which of
the known false claims it would and would not have caught. Both are owed before this counts as
verified.

### The register's report — and its honest verdict on itself

`2245e0ecf..f21ba35aa`. tsc exit 0. Discovered list of 10 files echoed and count-guarded:
`187 passed | 1 expected fail (188)` — the expected fail is the `it.fails` nav tripwire.

**MUTATION PROOF 1 — the real defect shape, arriving a second time.** Added
`declinedUnitId?: string;` to `ReferralAddressing`, which is exactly the 2026-09-01 defect.
**Red, naming THREE claims across three screens.** The other nine suites ran
`175 passed | 1 expected fail` — green — and `tsc` passed. **Nothing else in the repository caught
it.** Restored, sha256 verified.

**MUTATION PROOF 2 — ambiguity, a different failure mode.** Added a plausible early return in
`wardStatistics()` that also sets `averageWaitlistWaitMinutes: null`. Nothing renamed, nothing
deleted. Red with "ITS EVIDENCE IS AMBIGUOUS … contains this fragment 2 times". Restored, sha256
verified.

### ⚠️ THE HONEST VERDICT, and it is the most useful line in the report

**Of the four false claims named in its brief, the register would have caught NONE of them on the
day they were written.** All four are absence claims, or an enumeration written against a record
that already contradicted the prose — any citation made that day would have been green beside a
false sentence.

What it does instead: **it makes every one of those four facts go red the moment the record
CHANGES**, and it forces an author to open and copy the record they are describing.
**Pressure, not detection.** The implementer declined to claim it as a catch, and it is right not to.

So the mechanism covers decay, not authorship. **The nine false claims found today were found by
people, and the register would not have changed that.** What it changes is the tenth.

### Two live risks the sweep found and could not close — owner decisions

- `community-index.tsx` states "sixty-five team pages" in prose. A fixture count cannot be a
  substring, and `tests/ward-community-index.test.ts` deliberately declines to pin the number.
- `statistics-ed-screen.tsx` states "most seeded referrals carry no `triagedAt`" — a **fifth**
  fixture claim of the class `statistics-derivations.ts` already records as having falsified itself
  silently four times on one paragraph.

Both are prose that asserts a property of today's data. The register cannot hold them and neither
can a test that anybody would keep believing.

## Figures 1, 2 and 4 — COMPLETE (`aeff0635b..321fa124b`, six commits)

**224 RAN**, 223 passed, 1 expected fail (the `it.fails` nav tripwire). `tsc` exit 0. Discovered set
echoed at 12 files; the empty-discovery refusal was armed and did not fire.

- **Figure 1** — "Referrals where every ward asked so far has refused", testid
  `ward-statistics-refused-so-far`. Reuses `handoverSnapshot`'s `declined_by_all`.
- **Figure 2** — "Empty beds that were not offered", rendered as an absence. No formula, no `held`.
  Pinned by a test asserting the block contains **no digit anywhere**.
- **Figure 4** — "Declines by reason", all seven rows from `DECLINE_REASONS.map` with no filter.
- **Figure 3** — held, nothing written.

Register gained 12 `MODEL_CLAIMS` and 2 `UNEVIDENCED_CLAIMS`, including the one whose reason records
that **if a closure or exhaustion marker is ever added to `Movement`, the heading must change from
"so far" to "every"** — a claim resting on an absence, recorded as unguarded rather than given a
citation that could not fail.

Adversarial proof: reinstating a `>0` filter on the tally turned 6 tests red; dropping "so far" from
the heading turned 1 red. Both files restored and SHA-256 verified.

### ⚠️ SIX THINGS MY BRIEF GOT WRONG — the implementer measured rather than accepted

1. **The base was not green and not 195.** `aeff0635b` ran **200 with one failure** —
   `ward-statistics-claims.test.ts`, two claims broken by my merge. I had reported the base as green
   from a count taken before the merge.
2. **`ward-statistics.ts` no longer clamps** — the owner's anti-clamp ruling landed there and it
   returns `null`. Three of our comments still described a deliberate divergence from a clamp that
   is gone. **The register caught this; nothing else could have.**
3. **`"left"` → `"departed"` has landed.** Three comments still said "is being renamed".
4. **Reducer line numbers stale** — `case "DECLINE"` is at `:961`, not `:826`.
5. **`declinedByAll` is NOT an exported derivation** — it is inline in `handoverSnapshot`, so reusing
   it drags in `units` and `now` and **inherits the escalation exclusion**. Neither affects the
   answer (pinned by a test at two clocks a century apart), and the exclusion is disclosed on the
   page as making the count a floor.
6. The `Decline` "optional note" contradiction is real — reported, not touched.

_Ruling: brief facts are measured at dispatch time and go stale inside one merge._ Four of the six
were true when I wrote them. Cost if wrong: an implementer that trusts a brief over the tree
propagates a stale fact into prose — which is the exact defect this screen exists to avoid.

---

## 2026-09-01 22:05 — a waiter with no runner, and the dispatch that follows it

**Incident.** A background shell task labelled "Wait for the scout to report" ran for **3h 12m**
(PID 361555, started 18:49:45) polling `tasks/a0a890ab9bbe58256.output` every 20 seconds. That
file was created 18:47 and **never received a single byte**. The agent it waited on produced no
transcript — three agent output files in that window (`a0a890ab9bbe58256`, `acc9550dcfa8ca952`,
`ad9f9531b1d833981`) are all 0 bytes. No ledger record of a "scout" dispatch exists anywhere under
`.superpowers/sdd/`, so whatever it was asked, the question and the answer are both lost.

**How it stayed invisible.** `ListAgents` reports SUBAGENTS. It does not report background SHELL
tasks. Ten minutes before the owner pointed at his own screen, I checked `ListAgents`, saw nothing,
and told him nothing was running — while a shell task sat in the UI with a running stopwatch.
**Two lists; I checked one and reported on both.**

**Ruling: never poll for a subagent's completion.** The harness delivers a completion notification
on its own. A `until [ -s "$F" ]; do sleep 20; done` wrapper around a dispatch adds nothing when the
agent succeeds and hangs forever when it does not — it converts a dead agent into an
indistinguishable-from-working stopwatch. Cost if wrong: none; the notification path is the
documented one.

**Ruling: a wait loop must be able to fail.** Any future wait gets a deadline and a non-silent
timeout branch. A loop whose only exit is success cannot report failure, which is the same defect
class as the assertion outside the negation in `ward-community-index.test.ts` and the
`| tail -25` that kept a verdict and destroyed the failure list. Third instance tonight of
**a check that cannot fail**.

**Ruling: dispatch the nine claims WITHOUT merging first.** HEAD `5b6f13189` is 41 commits behind
`codex/task-ward-flow-live-state-20260831`, but
`git diff --stat HEAD...codex/task-ward-flow-live-state-20260831 -- src/components/ward-management/community/ tests/ward-community-*.ts src/components/ward-management/ward-admissions-seed.ts`
returns EMPTY — the master line has touched no community file. The facts this task depends on have
not moved, so the staleness is real but not load-bearing here. Merging now would instead change
files under a running implementer. Cost if wrong: a rewrite against a fact that moved in a file the
diff says was not touched — which the diff rules out. **Merge AFTER the implementer reports.**

**Dispatched 22:05 (Opus):** nine false claims in `community-screen.tsx` /
`community-derivations.ts` / `tests/ward-community-*`. BASE `5b6f13189b1ff2c08505a0e9d0e048b70939db5f`.
Brief `task-nine-claims-brief.md`, report due at `task-nine-claims-report.md`.
Opus because the success criterion is _whether a claim follows from its evidence_ — no gate states it.

## 2026-09-01 23:05 — fan-out: one writer, three auditors

**Ruling: exactly ONE writing agent at a time; auditors are unbounded.** The pre-commit hook
inspects the WHOLE working tree, so a second writer's in-flight edits block the first writer's
commit — the two agents deadlock silently rather than failing loudly. Auditors are exempt because
`.gitignore:175` ignores `.superpowers/`, verified with `git check-ignore -v`, so a report file
cannot dirty the tree. Cost if wrong: a blocked commit and a confusing hook message, recoverable.

**Running (BASE `5b6f13189` for all four):**

| Agent                         | Tier     | Writes                  | Why this tier                                                                                   |
| ----------------------------- | -------- | ----------------------- | ----------------------------------------------------------------------------------------------- |
| nine false claims (retry)     | **Opus** | source + tests + commit | veto: output is a judgement — _does this claim follow from its evidence_ — which no gate states |
| statistics prose audit        | **Opus** | report only             | same veto; same defect class, unaudited files                                                   |
| register falsifiability audit | Sonnet   | report only             | mechanical: is the evidence in code or in a comment. Catcher: the substring's own line          |
| statistics test vacuity sweep | Sonnet   | report only             | mechanical: named pattern list. Catcher: "describe a code change leaving this green"            |

**First Opus attempt died at 22:0x** on the session rate limit (resets 22:50), having written nothing
— it failed on its first read. Retried 23:04 from an unchanged tree. Not a defect in the brief.

**The register audit is the one to watch.** It asks whether the falsifying-edit mechanism — built
today to make unfalsifiable claims impossible — can itself fail. If a claim's evidence sits in a
COMMENT, the pin is on a sentence rather than on behaviour, and the code can change underneath it
while the test stays green. That would be a **fourth** check-that-cannot-fail in one night, inside
the very mechanism built to stop them.

## 2026-09-01 23:1x — the sweep that swept two-thirds, and my wording that caused it

**The first vacuity sweep returned "92 files swept, 0 vacuous".** `ls tests/ward-*.test.ts
tests/ward-*.test.tsx` minus the 5 community files is **138**. So 46 files were never examined,
under a clean verdict.

**Its REPORT was honest; its RETURNED SUMMARY was not.** The report states the discovery found 138,
names the exclusion, and separates "full manual read" (12 files) from "swept mechanically" (~80).
The 120-word summary I asked for compressed all of that away and reached me as a flat clean result.
**Lesson: a coverage caveat that survives only in the file is a caveat that does not reach the
decision.** Ask for the caveat IN the return, or the return will be the optimistic half.

**The exclusion was MY defect, not the agent's.** My third bullet said "every other
`tests/ward-*.test.ts`" — `.ts`, not `.tsx`. The agent read that literally and dropped **51
`.dom.test.tsx` files**, verified by `ls tests/ward-*.dom.test.tsx | grep -v community | grep -v
statistics | wc -l` = 51. It flagged the exclusion in its report rather than silently widening.
That is correct behaviour and I will not treat it as a fault.

**Why the excluded set was the WORST possible one to drop.** The vacuity defect that actually
shipped tonight — the assertion outside its negation in `ward-community-index.test.ts` — is a
RENDERED-MARKUP assertion. `.dom.test.tsx` IS that family. The sweep covered the files least likely
to hold the defect and skipped the files most likely to.

**Ruling: hand the agent the file list; never let it derive one from prose.** Same defect as the
hand-picked test subset earlier tonight, arriving from the opposite direction — there I named files
by hand and missed one; here I described a set in prose and the description was wrong. **Both fail
because the set was not computed and echoed.** Three sweeps dispatched 23:1x with explicit
enumerated lists (18/16/17) and a per-file verdict required, so an unnamed file reads as unswept.

**Not a finding against the corpus.** The statistics/nav files WERE read in full and are clean; that
result stands. The 51 DOM files are Ward Lead's, so these sweeps are read-only reconnaissance for
handoff — no fix from here.

## 2026-09-02 — Ward Lead allocation, and three rulings

**Ruling: triage against `git show` rather than waiting for a merge.** The sweep documents Ward Lead
allocated against (de387bd1d, 973a67f20) are NOT ancestors of the master line — `git merge-base
--is-ancestor` returns NO for both. They are reachable as objects, so I read them with `git show`
and extracted the seven findings in my files. Cost if wrong: none to me; flagged to Ward Lead
because anyone else merging the master line and looking for those documents will find nothing, and
will conclude the TASK is stale rather than the DOCUMENT unmerged.

**Ruling: the triage batch is SEVEN**, not "the community and statistics findings" as a large set.
Enumerated from the .ts sweep headings: 1.6, 5.3, 7.7, 8.3 (statistics), 9.7, 13.3, 13.4
(community). ZERO from the DOM sweep — its table lists the sections DOM file as FINDINGS(1), already
closed at 246e56284, and the other as CLEAN. Cost if wrong: an under-scoped pass, which the
enumerated heading list makes checkable.

**Ruling: my own ruling-13 red-proof is HALF proven and I have said so rather than letting it
stand.** Ward Lead's trap entry 20 — one mutation per ASSERTION, not per test file — applies to it.
"Tests 1 failed | 1 passed (2)": the order assertion is proven; the non-vacuity guard beside it
passed under a mutation that could never have reddened it, so it is decoration until a second
mutation fires it. Cost if wrong: none — the correction is conservative. Second mutation owed when
that file is next touched.

**Dispatched (BASE 0221c3f7c):** the triage, Sonnet, mutating-but-restoring, restores verified by
SHA-256 hash comparison, >=100-file discovery floor, one-mutation-per-assertion, and an explicit
clause that a non-reproducing finding is success rather than failure.

**Ward Lead's state of me was stale by two commits** — it listed the community elapsed-dates build
(cfca5f432) and both stale-absence clusters (246e56284) as in flight. Corrected to it.
