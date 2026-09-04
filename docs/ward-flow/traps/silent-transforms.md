# Two traps that produce a confident false absence

Both were hit on 2026-09-01, minutes apart, and both would have been reported as findings.
Written up by Ward Verifier, which hit them both; committed here so the next chat finds them
without having to be told.

## 1. A leading slash is rewritten before git sees it

On the Windows/Git-Bash workstation, MSYS rewrites an argument beginning with `/` into a Windows
path before the command receives it. `git grep -F "/mockups/ward-flow/statistics/overview"` becomes
a search for `C:/Program Files/Git/mockups/...` and returns **nothing, exit 0, no warning**.

Two instances in one day:

- `git show <ref>:.githooks/pre-commit` returned an **empty blob** — one step from reporting a hook
  as absent from a branch that had it.
- `git grep -F "/mockups/..."` returned zero hits for four route literals, **two of which had just
  been committed** — one step from reporting a landed fix as not landed.

The danger is the shape, not the frequency. **An absence looks identical whether the search was
right or wrong, and an absence is usually the thing you were hoping to find.**

**Do this instead**

- Drop the leading slash: search `mockups/ward-flow/...`.
- Or reach the blob by hash: `git rev-parse <ref>:<path>`, then `git cat-file blob <hash>`.
- **Prove any absence before reporting it.** Run the same search against a string known to be
  present. A search that cannot find a known positive has not established a negative.

## 2. The conclusion that flatters the theme is checked last

Both catches above came from the same tell, and it is not a technical one: the result agreed with a
finding that was already being pursued. A conclusion confirming the lesson you are currently
learning arrives feeling pre-verified, because it fits. Nobody asks a witness who agrees with them
for identification.

So: **when a result confirms the theme of the session, that is the moment to check it, not the
moment to report it.** In practice that means one extra command — a known-positive control, a
`git log`, a count at an earlier commit — before the claim travels to anyone.

---

Three more, all hit on the night of 2026-09-01, all by different chats, all with one shape:
**a claim that is true of something, passed on without saying of what.**

## 3. A line number is a claim about a tree wearing the costume of a fact about a file

Two chats cited the same seeded referral, `RF-007`, on the same day: one at
`ward-movements.ts:1301`, one at `:1455`. **Neither was wrong.** The branches had diverged, and each
number was correct on the tree its author was standing in.

**The asymmetry is the dangerous part.** On a branch that has merely _changed_, a stale line number
points at something obviously unrelated and the next reader notices immediately. On a branch that has
_diverged_, both numbers keep pointing at plausible code indefinitely, because each is right where it
was written and neither author is looking at the other's tree. **It decays silently and stays
plausible**, which is the combination that survives review.

**Do this instead**

- **Cite by symbol name, with the line as a hint rather than the identifier** — `referralQueueOrder`
  (`ward-referrals.ts`, ~`:277`), not `ward-referrals.ts:277`.
- **When a line number must carry weight, name the tree**: the ref or sha it was read at.
- When two chats disagree about a location, suspect two trees before suspecting either reader.

## 4. Two-dot and three-dot diffs answer different questions and look identical

Three separate chats in one evening reported that a builder had edited files on its own excluded
list. **All three were measurement artefacts, and nobody had edited anything.**

The branch had _merged_ the integration line, as instructed. A two-dot diff from a base that predates
that line's own work sweeps those commits in, and **inherited history reads as authorship.**

```
two-dot   A..B     everything in B and not in A, INCLUDING what B merged.  "What would I get?"
three-dot A...B    what B authored since diverging.                        "What did this branch do?"
```

_(Table contributed by Ward Builder One, which hit the trap and wrote the distinction down.)_

**The instructive part is how the second chat got there.** It had already caught a cruder version of
the same trap minutes earlier, and substituted a check with the identical flaw one level up —
diffing from its own base, which still included everything merged. **Having just dodged one
attribution trap is the strongest available feeling that you are now measuring correctly.** The care
was real; it is what made the wrong answer trustworthy.

**Do this instead**

- To ask _what did this branch author_, use three-dot against the line it merged from.
- **Name the tree, name the measurer, name the command.** A claim with none of those attached cannot
  be rechecked by whoever receives it.
- Before reporting that somebody crossed a boundary, run it the other way round and see whether the
  finding survives.

## 5. A claim that dissolves a problem is checked less than one that creates work

Trap 2 above says the conclusion flattering the theme is checked last. The sharper version, measured
three times in one evening: **the claims that went furthest before being caught were the ones that
made an escalation unnecessary.**

- A constraint that removed a tension from a design decision — the grep had matched a comment
  _forbidding_ the call, not the call.
- An attribution that explained an overlap — the diff was two-dot.
- A reachability argument that dissolved a behaviour question somebody had just escalated — it
  covered one destination combination and missed a second, permitted one.

Each arrived as relief. **Relief is not evidence**, and none of the three was checked by the person
it relieved.

⚠️ **Worse, each was then echoed back by its recipients, and returned to its author looking like
independent corroboration.** A claim making a round trip through two chats gains two confirmations
and no evidence. In the third case the author was the integration authority, which made the claim
_less_ likely to be questioned, not more.

**Do this instead**

- **Treat "this means we don't have to do X" as the trigger to verify, not as the answer.**
- **Mark which parts of a reply are independent and which are echo.** It costs a clause — "taking
  this from you, not verified" — and it is the only thing that stops a round trip counting as
  agreement.
- The check is usually one command. All three above were falsified by a single trace through code
  the checker already owned.

## 6. A test run that never started reports zero failures

With many sessions open, this machine intermittently refuses to spawn processes —
`fork: Resource temporarily unavailable`. **A vitest run that dies during startup reports no
failures.**

Ordinarily that is merely confusing. **Under a mutation test it is actively misleading**, because
zero failures is exactly what a mutation your tests _failed to catch_ looks like. The natural reading
is "coverage gap", which sends somebody rewriting tests that were fine — and the real fault was that
no test ever ran.

It is the same shape as trap 1: **a command that did not run and a command that found nothing produce
the same output.**

**Do this instead**

- **Read the total ran count, never the failure count alone.**
  `Tests 2 failed | 94 passed (96)` is evidence — 96 tests executed.
  A bare `0 failed`, or a total lower than the clean baseline, is not.
- **Re-run any zero-failure mutation before concluding anything from it**, and say in the report that
  you did.
- Treat a post-restore run with fewer total tests than the baseline as a **failed run**, not a
  passing one.

_(Found by Ward Verifier while the machine was refusing to fork, 2026-09-01.)_

## 7. An out-of-memory failure returns empty output, and empty reads as "safe to proceed"

**The worst of the seven, and it arrived last.** Late on 2026-09-01, with many sessions open, this
machine ran out of memory. A `git status` failed with

```
fatal: Out of memory, malloc failed (tried to allocate 1048576 bytes)
```

and returned **empty output**. A wait loop read that emptiness as _a clean working tree_ — while six
files and 202 insertions of somebody's uncommitted work sat in it. **It came one command away from
merging over live work.**

**⚠️ Why this one is worse than the six above.** Every other trap here gives you a **wrong answer to a
question you asked**. This one gives a **safe-looking answer to "is it safe to proceed"** — so it does
not cost you a fact, it costs you the thing the check was protecting. The other six make you wrong;
this one makes you destructive.

It also defeats the standard defence. Re-reading the code does not help when the problem is that the
reading never happened.

**Do this instead**

- **Check the exit code, not the output.** Every gate, every wait loop, every status probe. An empty
  result with a non-zero exit is a failed command, not a finding.
- **Verify a commit in `HEAD`, not in the working tree.** A commit can fail quietly on a machine that
  is failing to allocate a megabyte, and a commit that returns looks like a commit that worked.
- **Re-run any surprising or empty result before acting on it**, and never on the strength of a single
  empty read.
- Fewer concurrent sessions. The failure rate rises with the count, and it is not deterministic — the
  same command succeeds on retry, which is exactly what makes the single failure so convincing.

## 8. A pipeline reports the exit code of its LAST command, not the one you care about

_Contributed by Ward Verifier, in the message where it committed this fault._

```
    git grep -n "$pattern" $ref -- src | cut -c1-150
    echo "exit: $?"          # ← cut's exit code. Always 0.
```

`git grep` exits 1 on no-match and 2 on error. `cut` exits 0 for both. **The `$?` you read vouches
for a command that may never have run.**

**This is worse than entries 5–7, and the difference is worth stating.** Those produce a wrong
ANSWER. **This produces a wrong CONFIDENCE** — a clean exit code standing behind an empty result,
which is precisely the pairing that turns _"the search found nothing"_ into _"the thing does not
exist."_ Entry 5 teaches you to distrust an empty result; **entry 8 is the mechanism that tells you
not to.**

**Two instances on 2026-09-01, an hour apart, both self-caught rather than review-caught:**

- `git commit … | tail -5` reported `rc=0` while the commit had failed. `tail` succeeded. Caught by
  checking `git show HEAD:<path>` rather than the working tree. _(Ward Builder Three)_
- `git grep … | cut -c1-150` reported `exit: 0` **inside the message warning other chats about
  exactly this class.** Caught only because the result was empty. _(Ward Verifier)_

**Remedy, mechanical rather than remembered:**

- Run the command alone, capture `$?` on the next line, **then** format the output.
- Or `set -o pipefail`, which makes the pipeline take the first non-zero status.
- **Never read `$?` after a pipe you added for readability.** Truncation, paging and formatting are
  the commands most often appended, and all of them succeed unconditionally.

## 9. A claim that arrives with its evidence attached scopes the check to that evidence

_Contributed jointly by Ward Builder Two, which relayed the claim without tracing it, and Ward Lead,
which traced it and got it wrong anyway. The second half is the instructive one._

Ward Builder Two passed a reviewer's finding to Ward Lead: a coordinator can accept a community
referral arm, because `answerableBy` (`ward-flow-reducer.ts`, ~`:2013`) maps only `ward` and `ed`, so
`ownKind` is `undefined` for the coordinator and the guard `if (ownKind !== undefined && …)` passes
rather than refusing. It travelled with its file, its symbol and its mechanism — everything trap 3
asks of a citation.

**Ward Lead verified it.** Opened the file, read the map, read the guard, confirmed `ownKind` is
`undefined`, confirmed the condition passes. Every link checked out and every one was true. It then
recommended refusing the coordinator there.

**Eleven lines above the map is a comment saying the exemption is deliberate** — naming decision
`CO-D2`, and the parallel that the coordinator may likewise cancel a transport it did not book.
`CO-D2` is a real recorded ruling (`docs/ward-flow-ledger.md`, ~`:740`, 2026-08-30), not a comment
asserting one. The recommendation would have overturned a standing decision neither chat knew was
there.

**The first diagnosis was wrong, and its wrongness is the entry.** Ward Builder Two called this a
relay problem — mechanism intact, provenance stripped, so a documented exemption read as an
oversight. True, and insufficient: Ward Lead _did_ go to the primary source. Reading the code did not
save it.

**The mechanism is that the claim named the lines to look at, and they were looked at.** A claim
citing `answerableBy` and the guard directs the reader to `answerableBy` and the guard. The
disqualifying fact was in neither. ⚠️ **Attaching evidence to a claim makes it more checkable and
simultaneously narrows the check to the frame the claimant chose** — and the claimant's frame is
precisely where a claimant who has missed something is not looking.

⚠️ **And a deliberate exemption is byte-identical to an oversight at the mechanism level.** No
property of `answerableBy` distinguishes "the coordinator was forgotten" from "the coordinator is
exempt on purpose". That difference exists only in prose, in a ledger row, or nowhere at all.
**Checking what code DOES can never separate them; only prose or a ledger row can** — and only the
first of those has an obvious command.

**Do this instead**

- **Read the enclosing scope, not the cited lines.** The doc comment above the symbol, the decision
  id it names, the ledger row that id points to. One screen, and it is where intent lives.
- **Ask "what would make this deliberate?" before "is this true?"** For any absent guard, unhandled
  role or missing case, assume a ruling exists and go looking. Finding none is a finding; never
  asking is not.
- **Widen the frame the claim handed you by one step in each direction, on purpose.** A claim you
  were given has already chosen where you will look.
- **Structural remedy, and this file has a working example of it:** a guard whose strictness rests on
  a documented exemption should carry the ledger id at the site. `answerableBy` does — it names
  `CO-D2` — and that is the only reason the intent was recoverable at all. The entry above is a
  warning; this clause is the demonstration that the fix works.
- Note this is trap 5's mirror. Trap 5: a claim that dissolves work is checked less. Trap 9: a claim
  that arrives fully evidenced is checked narrowly. Both are a claim shaping its own examination —
  once by making the check feel unnecessary, once by making it feel already done.

## 10. The fault a change set is about is the fault that change set commits

Commit `71a0421db` existed for one purpose: correcting comments that had decayed. Three comments
asserted no error boundary existed under the ward-flow route tree; two now did. It corrected them
carefully, quoting each boundary's own doc comment.

**The commit immediately before it, `1b86cee6e`, had falsified a test's title, its entire doc comment
and its assertion's failure message — in a file that commit edited — and left every word standing.**
The test said the work list HIDES the referral. After the fix it shows it. A red would have told the
reader the exact opposite of what the code does, and the comment's closing instruction ("if this goes
red, the predicate is hiding a live bed request") was inverted with it.

So a change set whose whole subject was comment decay sat one commit after an uncorrected comment
decay of its own making, in the same file, by the same author, the same afternoon.

**It was caught only because a review was requested of work that had already passed.** 99 of 99
tests, a clean typecheck, a completed mutation proof. Every gate green. **No gate reads prose.**

This is the same shape as the four entries in the closing section below, and it makes five. The
pattern is not that people forget the lesson. It is that **working on a fault class consumes the
attention that would notice it**, and the file you are correcting is the file you are least likely to
re-read for the defect you came to fix.

**Do this instead**

- **When a diff changes what a function returns, grep the touched files for the old behaviour in
  prose** — assertion messages, test titles, doc comments. `git diff` shows the code that changed; it
  cannot show the sentence that stopped being true.
- **Ask for a review of work that already passed its gates**, specifically when every gate is
  mechanical. Green means the code agrees with the tests, never that either agrees with the prose.
- Treat "this change set is about X" as a reason to check the change set for X, not as evidence that
  it is free of X.

## 11. A measured instance of this file working, and what actually made it work

_Recorded because the closing section below claims a list of reminders cannot work, and this is a
measured instance of something in it firing before the fault instead of after._

⚠️ **This entry said "the first" until Ward Verifier refused it, and the reason it was refused is
itself the lesson.** Not merely that two earlier candidates existed from the same evening — Ward
Builder Three opening a message by naming two entries as a prospective method and running
known-positive controls before making any claim, and this session instructing an implementer to read
the ran-count on every mutation run before any run had failed that way. **The deciding objection was
structural: nothing in this repository records instances of an entry firing.** Those events live in
chat transcripts no reader has. So "the first" could not be checked, could not be countered, and
could never go red — **an unfalsifiable claim asserted as a measurement, inside a file about checks
that cannot fail, in the entry arguing the file works.** The superlative was the only part capable of
being wrong and it added nothing; the mechanism below is the whole value.

Ward Verifier produced an argument that a fix under discussion needed no owner decision, being the
symmetric half of a ruling already given. It was a good argument and it turned out to be right. It
also **removed a decision from the owner's queue** — which is the exact shape of trap 5.

Ward Builder Two went looking for what the relief was hiding, and found a real coupling nobody had
stated: the proposed change and a fix already on a branch are complements, and landing the proposed
one first would have created a live defect in a change made specifically to prevent that defect.

⚠️ **The transferable part is not the finding. It is that the trap file was used as a mechanical
prompt rather than recalled as advice.** The lesson was not remembered — the _shape_ was matched
("this conclusion means somebody does less work") and the check that trap prescribes was run. The
check took one question.

**And it fired on the hardest case**: a claim that was correct, from a chat that had earned trust,
which agreed with what the reader wanted. Remembering to be careful would not have covered that one,
because nothing about it felt careless.

---

## 12. The fix that makes a failing check pass by narrowing what it looks at

_Found by Ward Builder Three, which was offered the shortcut and refused it, and sharpened by Ward
Builder Two, which worked out how much it would have cost. Neither of us saw its full size alone._

Nine emergency-department browser tests failed identically:

```
Error: strict mode violation: getByTestId('ward-ed-screen') resolved to 2 elements
```

**The one-character fix is `.first()`.** It is right there, it turns nine red tests green, and it
looks like accommodating a strict matcher rather than changing what is tested.

**The measurement that makes it indefensible.** The duplication was not the ED screen's. Counting
every `data-testid` in the live DOM of `/mockups/ward-flow/referrals`, **on the dev server, read at
load**: **104 testids, 51 of them duplicated, every one at exactly 2** — every patient row, every
control, every panel. The duplicate is a **hidden 0×0 copy** left inside React's streaming container.

⚠️ **SCOPE CORRECTION, AND IT IS AN INSTANCE OF ENTRY 10.** This entry first read "on every ward-flow
screen" and "51 kinds of element across every screen". **Both were wrong, and neither was measured.**
One route was counted, on the dev server, at load; the universal claim was inferred. Ward Builder
Three then measured a production build and found `/ed/rph-ed` shows **zero** duplicates at
networkidle — on the very route whose nine tests fail on this. **So the duplication is route- AND
time-dependent: the failing tests assert early, inside the streaming window, and the copy is gone by
the time a settled page is read.**

**The shortcut's danger survives the correction intact**, which is why the entry stands: the tests
that would take `.first()` are exactly the ones reading inside that window, so `.first()` would still
select the invisible copy at the only moment it matters. **What does not survive is the sentence
claiming to have measured every screen** — written in a traps file, about overclaiming, by someone
who had counted one route.

So `.first()` does not select "one of two equivalent elements". Across a large part of the ward-flow
browser suite it would have selected **the invisible one**, which can never be clicked, never be
typed into, and never meaningfully asserted against. ⚠️ **The suite would have gone green and stopped
testing anything at all** — a check that cannot fail, manufactured at a scale larger than a
56-file sweep of this exact class had found all night.

**The general shape, which is what to carry away.** A failing check has two kinds of fix: change the
thing being checked, or **narrow what the check looks at**. The second always works, always looks
smaller, and is never a fix. `.first()`, `.filter()` on a failing case, a loosened matcher, an added
`skip`, a widened tolerance, an allowlist entry — every one converts a loud correct failure into a
silent wrong pass, and the silence is permanent because the check is still there and still green.

⚠️ **A testid resolving to two elements is the application being wrong, not the test being strict.**

**Do this instead**

- **Before making a failing assertion narrower, find out how many things it currently catches.** Here
  it was 51 kinds of element on the route measured; the shortcut's cost was invisible until counted.
  **And count under the conditions the failing test runs in** — this duplication is gone at
  networkidle and present inside the streaming window, so a settled-page measurement would have
  reported no problem at all.
- **Ask what the narrowed check would still catch.** If the honest answer is "nothing it did not
  already catch, minus the thing that just failed", it is not a fix.
- **Note who nearly took it.** The chat that had spent the night cataloguing checks-that-cannot-fail
  did not recognise that shape in the shortcut in front of it — trap 10 again, from the other side.
  Expertise in a fault class is not protection against committing it; it is what occupies the
  attention that would notice.

## 13. A gate nobody can run conceals an unbounded amount, not a proportionate amount

_Ward Builder Three's line, corrected one size upward by what it turned out to be hiding._

The browser gate had been unbuildable since the previous afternoon — a typecheck failure in the
harness, not in any test. **A gate nobody can run is indistinguishable from a gate that passes**, and
for a day and a half nothing distinguished them.

The natural next thought is: _so some tests were red and we did not know._ **That is the wrong shape
of expectation, and it is the reason nobody rushed to fix the harness.** What the dark gate was
concealing was not nine ED tests. It was a defect in the route tree affecting **every screen in the
prototype**, which no amount of reading the ED screen would ever have found — and behind it, every
other browser-visible defect on every other screen, because each of those tests stops at its first
wait and never reaches its own assertions.

⚠️ **The size of what a dark gate conceals is unbounded until somebody turns it on**, because the
concealment is not proportional to the time it was dark or to the size of the change that broke it.
One harness typecheck error hid an entire layer of the application from view.

**Do this instead**

- **Treat "the gate cannot run" as a higher priority than any single red test**, not a lower one. A
  red test tells you one thing; a dark gate tells you nothing, about everything.
- **When a gate comes back, expect a queue rather than a result.** The first failure it reports is
  the first one to reach the door, not the worst and not the only one — and every test blocked at its
  first wait is still unrun, however red it looks.
- **Never estimate the backlog from the size of the breakage.** They are unrelated.

## 14. A rule that exists twice, with nothing comparing the copies — three instances in one evening

_Found 2026-09-01, by Ward Builder Three attempting a browser journey; diagnosed by the agent that
fixed it. Verified against both files rather than relayed._

The production typecheck had been failing for **over a day** — since `45c9097bb` on 2026-08-31 —
and not one of six live chats noticed. The reason is not that nobody checked. It is that everybody
checked **the wrong one of two nearly identical checks**, and the one everybody checked was green.

```
tsconfig.json            exclude: node_modules, scratch/**, supabase/functions/**,
                                  worktrees/**, scripts/archive/**
tsconfig.typecheck.json  exclude: node_modules, .next/**, scratch/**, supabase/functions/**,
                                  worktrees/**, scripts/archive/**,
                                  docs/ward-flow/control/evidence/**      <-- ONLY HERE
```

Six frozen evidence artifacts under `docs/ward-flow/control/evidence/artifacts/` carry `.ts`/`.tsx`
extensions and deliberately name symbols the live tree has since renamed (`bedHeldUntil`,
`RELEASE_HOLD_REASONS`, a moved module path). **They are working exactly as evidence should, and
that is precisely why they cannot compile.**

`tsconfig.typecheck.json` already carried the exclusion. `tsconfig.json` did not. TypeScript's
`extends` **does not merge `exclude`** — the child replaces it wholesale — so the two lists drifted
apart silently and nothing anywhere compares them.

**Every brief in this project, including every one I wrote, says `tsc -p tsconfig.typecheck.json`.**
So every agent ran the config that had the fix, reported exit 0 honestly, and none of them was
touching the config that did not.

⚠️ **WHY THIS IS WORSE THAN AN UNRUN GATE.** An unrun gate is at least _known_ to be unrun. Here
the gate ran, exited 0, and was reported truthfully — while a differently-configured sibling of the
same tool was failing on the same tree. **The green was real and it vouched for nothing.** This is
entry 8's wrong-confidence failure with the pipe replaced by a config file, and it survived six
chats because the evidence looked impeccable.

**What actually surfaced it** was somebody trying to do a different job — a browser journey — and
hitting the build. **Not a check. A task that happened to need the broken thing.** That is luck,
and it should be assumed to be luck rather than counted as coverage.

⚠️ **AND IT HAPPENED TWICE MORE THE SAME EVENING, WHICH IS WHY THIS ENTRY IS ABOUT THE SHAPE
RATHER THAN ABOUT TYPESCRIPT CONFIGS.** The first instance above was found by accident. The second
and third were found by people who had just read about the first.

- **Two permission blocks.** `answerableBy` appears byte-identically in `ACCEPT_REFERRAL` and in
  `DECLINE_REFERRAL`. `tests/ward-referral-decision-scope.test.ts` exercises the decline copy in
  both directions and **nothing anywhere exercises the accept copy with a mismatched role.** Edit
  one and not the other and the suite stays green. _(Ward Builder Three, from an adversarial review
  of its own committed work.)_
- **Two exclude lists.** `scripts/run-playwright.mjs` writes its own `tsconfig.json` into the
  isolated run root and **deliberately declares its own `include`/`exclude`** rather than extending
  the root's — for a documented and sound reason about `.next/` types leaking in from a prior dev
  server. The consequence is that its exclude list is a hand-maintained copy of the root's with
  `../../` prefixed. So `cde0044e4` fixed the root config, and the browser gate still could not
  build, **because the browser gate never reads that list.** Verified rather than relayed:
  `grep -n "docs" scripts/run-playwright.mjs` returns nothing, with `worktrees/**` at line 309 as
  the control. _(Ward Builder Three, attempting to run a journey.)_

**The common shape, stated once:** a rule exists in two places, both copies are individually
correct, nothing compares them, and **the drift is invisible until the copy nobody maintains is the
one that decides.** In all three instances the symptom was identical — a gate that looked right,
ran, exited zero, and vouched for nothing.

⚠️ **THE REMEDY IS NOT "UPDATE BOTH COPIES." IT IS "MAKE THERE BE ONE."** Updating both is a fix for
today that leaves the mechanism intact; the second copy is not a maintenance burden, it is a
future wrong answer with a green light on it. Where a single copy is genuinely impossible — as with
the Playwright runner, whose separate list exists for a real reason — **derive one from the other**
so they cannot diverge, or add a check that compares them and fails. A comment saying "keep these in
sync" is the weakest option available and is what all three instances already had.

**Remedies, in order of strength:**

- **Compare the two exclude lists in a test.** They are two lists in two files with no mechanism
  keeping them honest, which is the condition this whole project exists to distrust. The lists
  should not be identical — `.next/**` belongs only in one — so the assertion is about the
  _evidence path_, not about equality.
- **Name the config in every report.** "typecheck exit 0" is not a fact until it says which
  project file it was given. Two of these exist and they disagree.
- **When a gate has variants, run the one the outside world runs** — here, the one the production
  build uses — at least once before believing a run of the convenient one.

---

## 15. A clean recovery by the affected party is how a systemic fault becomes invisible

_Ward Lead, 2026-09-01, against my own name. This is the entry I would most like a later reader to
take seriously and it is the one with the least dramatic incident behind it._

**What happened.** I dispatched an agent into `D:/Worktrees/Database/ward-error-boundary` to fix a
build configuration. While it was still working, I dispatched a second agent into the same folder to
build a crash boundary. The second created a branch, switched the worktree's HEAD to it, and
committed. The first agent's next commit therefore landed on the wrong branch, on top of somebody
else's work.

**Nothing was lost.** Both branches kept their history, both commits reached the integration line,
and the agent's work was correct throughout. Total cost: one confused reflog and about four minutes.

⚠️ **THAT IS THE PROBLEM, NOT THE MITIGATION.**

**Why this is a trap rather than a mistake.** The rule broken — _never two writers in one worktree_,
because the pre-commit hook inspects the whole tree and the second writer fails in ways that do not
announce themselves — is one I had personally restated to four separate chats that same evening, in
writing, more than once. **I was not unaware of it. I was enforcing it while breaking it.** Knowing a
rule is not a mechanism, which is the thesis of this entire file.

**And the cost was zero for exactly one reason:** the affected agent **stopped and reported instead
of recovering.** It could trivially have cherry-picked its own commit back where it belonged. The
tree would then have been correct, its report would have said "done", and **I would never have
learned that I had done it.**

**So the general form, which is what earns the entry:**

> **A fault that the affected party can clean up quietly produces a correct final state and no
> signal. The tidier the recovery, the more completely the cause disappears.**

This is the same family as a gate that exits 0 having executed nothing (entry 6), a pipeline
reporting the wrong exit code (entry 8), and a rule with two copies (entry 14) — **a correct-looking
outcome standing in for a check that never happened.** Here the "check" is the organisation noticing
its own dispatching is wrong.

**What follows from it, in order of usefulness:**

- **A worker that hits a collision must report it, not resolve it** — even when resolution is
  obviously safe and obviously cheap. The report is the only artefact; the fix destroys the evidence.
  Every implementer brief in this project now says so.
- **The dispatcher, not the worker, owns worktree allocation** — and must state the occupant before
  each dispatch rather than recalling it. I had the information and did not consult it; a habit is
  not checkable and this is the second time tonight that sentence has been the conclusion.
- ⚠️ **Count near-misses that cost nothing as incidents.** The instinct is to file a zero-cost event
  as a non-event. **The cost is not the signal; the mechanism is.** A fault that happens to be cheap
  today is drawn from the same distribution as one that is not — and on this machine, two worktrees
  have already been destroyed mid-session by unrelated cleanup.
- **Record it against a name.** An anonymous "a collision occurred" reads as bad luck. _The chat
  enforcing the rule broke the rule_ reads as what it is: evidence that enforcement and compliance
  are separate faculties, and that the one doing the enforcing has no special protection.

---

## 16. "Is anything else proving this?" is not "can this still fail?" — and only one of them can be mechanical

_Ward Verifier's criterion, Ward Verifier's diagnosis of why it missed, recorded because the
diagnosis generalises further than the criterion did._

A seeded-data guard in `tests/ward-referral-visibility.test.ts` was demoted rather than deleted, on a
criterion offered to replace a judgement call:

> **After the rewrite, does the invariant it now rests on get proved anywhere else?**
> No → keep, it is the only guard. Yes → delete, keeping it is sentiment.

The criterion was applied, honestly, and answered: nothing else pinned it. Kept. Two deletion
triggers were written at the site.

**Within hours it was retired by neither of them.** An unrelated chat split `RF-007` for an unrelated
ruling, and **the seed now holds no referral with more than one destination at all** — verified,
`RF-001`…`RF-010`, every one single-armed. The guard iterates the seed looking for a two-armed shape.
**It cannot fail. It passes, in full green, asserting nothing.**

⚠️ **The criterion was a UNIQUENESS test and the failure was a VACUITY one, and they are independent.**

```
1. Can this test still fail?      does its input set contain a case that exercises the property?
2. Is it the only thing that can?  uniqueness
```

**Question 1 first, always.** A vacuous test is deletable whatever the answer to question 2 — being
the only thing that proves nothing is not a reason to keep anything. The criterion started at
question 2 and never went back. ⚠️ **And vacuity is the defect this entire file is about**; a
criterion for keeping a test was written, by the chat that had spent the night finding vacuous
checks, with vacuity left out of it.

**The same fault is in the two triggers, and this is the transferable half.** Both described the
world changing _around_ the test — a reducer test appearing, a ruling inverting the invariant.
**Neither described the test's own input drying up.** Retirement conditions come in two families:

- **the property stops mattering** — environment
- **the test stops being able to observe it** — input

**Every guard needs one of each**, and almost every guard is written with only the first, because the
first is what its author is thinking about.

⚠️ **Only the input family can be made mechanical, and that is the whole prize.** "Delete this when a
reducer test drives a community acceptance" needs a human to notice, forever. "This asserts nothing
unless the seed holds a multi-destination referral" is an assertion:

```ts
expect(
  multiDestinationSeeded.length,
  "no seeded referral has two destinations — this guard cannot fail and asserts nothing",
).toBeGreaterThan(0);
```

**That fires the moment the fixture is emptied, names itself, and needs nobody to remember anything.**
It would have gone red the instant `RF-007` was split — months before either written trigger.

**Do this instead**

- **Ask "can this fail?" before "is it the only one?"** — and answer it by naming the input that makes
  it fail today.
- **Give every fixture-iterating guard a non-vacuity assertion**, not a comment. A recorded count
  decays exactly like every other recorded count in this repository; the same fact as an assertion
  cannot.
- **Write one retirement trigger from each family.** If both your triggers describe the outside world,
  you have not written the one that will actually fire.
- ⚠️ **A criterion that replaces a judgement call is itself a claim, and it can be incomplete in the
  exact way the judgement would have been.** This one was offered, accepted, applied correctly, and
  still missed — because it was checked for soundness and never for completeness.

## 17. A test whose passing condition is the ABSENCE of something will fail when a feature makes it persist

_Found by a read-only scout before anything was built, which is the only reason it is written here as
a warning rather than as an incident._

Owner ruling: a clinician must be able to see a referral they refused, which today vanishes the
instant they answer it. The obvious implementation adds a "recently answered" section beneath the
worklist.

**Two currently-passing DOM tests assert that the row DISAPPEARS**, and one says so in its own words:
_"the answered row leaves the inbox, which is the only success signal on screen."_ Reuse the row's
existing test id in the new section and the row is still in the document — **so both tests go red
precisely because the feature now works.**

⚠️ **This is not a test that cannot fail. It is a test that fails for correctness**, and it is the
more dangerous of the two, because the failure looks exactly like a regression and the obvious
response is to make it green again — by removing the feature, or by weakening the assertion until it
stops noticing. Both restore the defect the ruling exists to close.

The reason it happens: **a disappearance is the cheapest available success signal**, so tests reach
for it whenever a UI has no other visible confirmation. It silently encodes "this thing must never be
on screen again" when what was meant was "this thing must leave the worklist."

**Do this instead**

- **Before building anything that makes a thing persist, grep the tests for assertions of its
  absence** — `not.toBeInTheDocument`, `queryBy…` compared to null, `toHaveCount(0)`. They will not
  appear in a search for the feature you are adding.
- **When such a test goes red, ask which of two things it meant** — gone from _this list_, or gone
  from _the screen_ — and fix the assertion to say the narrower one. Do not widen the selector and do
  not delete the test.
- **Prefer a positive success signal to an absence** when adding one: an assertion that the row now
  appears under a named section survives features that an absence assertion opposes.

## 18. A track record buys speed by spending the scrutiny on the claims that most need it

_Ward Builder Three's finding about its own reporting, and Ward Builder Two's about its own relaying.
Entry 5's mirror: that one is about a claim that dissolves work, this one about a claim that creates
it._

Entry 5 says a claim that makes an escalation unnecessary is checked less than one that creates work,
because relief is not evidence. **The obvious corollary is that work-creating claims are safe. They
are not — they are checked less for a different reason, and it is harder to see.**

A reader reported two defects in another chat's module. Both were real observations. One was
relayed onward as a categorical sentence — _"the coordinator projection has no field-set
allowlist"_ — and travelled to a third chat and into two commit messages before anyone ran it.

**The mutation took five minutes and falsified the sentence.** Deleting a field does leave the whole
test file green, exactly as observed — but `tsc` catches it (`TS2741`), so the guard exists and
simply runs in a gate the test loop does not. **One finding about which gate holds a contract, not
two about a missing one.**

⚠️ **Neither chat was careless, and that is the entry.** The finder had run a control on its
_previous_ finding an hour earlier. The relayer had run controls all night and committed one
alongside this very check. **What made this claim different was not its difficulty — it was that it
arrived from a source whose last two findings had both been right, into a file its owner already
half-suspected.** It agreed with what the recipient already believed, from someone who had earned
the benefit of the doubt.

⚠️ **The finder's own diagnosis of why it skipped the control is the sharpest line either of us
produced:** _"one felt clinical and the other felt like plumbing. That is not a defensible way to
choose which claims to check."_ A field-set allowlist is plumbing. A clinical field defaulting to
`Female` is not. **The second got a control and the first did not, and the first was the one that was
wrong.**

**So a track record is spent, not banked.** It buys speed, and it spends that speed precisely on the
claims that most deserve a check: the ones that sound like what you already believe, about code you
already suspect, from someone who has been right twice.

**Do this instead**

- **When a finding is falsifiable by one mutation and the file is already open, run it BEFORE
  relaying.** Not because it is likely wrong — because five minutes is cheaper than a retraction, and
  a retraction is what a relayed claim costs once it has reached two other chats and two commits.
- **Distinguish the observation from the sentence built on it.** _"The whole file stays green"_ was
  true and stayed true. _"There is no allowlist"_ was the addition, and nobody measured the addition.
  Relay the measurement, and mark the generalisation as yours.
- ⚠️ **Never let "does this feel clinical?" decide which claims get a control.** Severity is a reason
  to act, never a reason to believe. The plumbing claim is the one that will be wrong, because it is
  the one nobody wanted to spend five minutes on.
- **A source's accuracy is a reason to act on a claim quickly, never a reason to check it less.** Those
  feel identical from the inside and they are opposites.

## Two updates from 2026-09-02, both about this file rather than about the code

**Entry 11 claimed one measured instance of this file working as a mechanical prompt. There are now
two, and they are the same shape.**

Both were **entry 5** — _a claim that dissolves work is checked less than one that creates work_ —
and both fired on a **correct** claim from a **trusted** chat. The second: Ward Lead told Ward Builder
Two that wiring its module would close none of the three disclosure routes, which meant it did not
have to build ruling 10. **It checked precisely because the claim removed work**, found the claim
held, and reported the exit codes and the positive control. _"I checked it because it dissolved
work"_ is the sentence; the check is not remembered, it is triggered by the shape.

⚠️ **And entry 8 has a third self-inflicted instance, committed inside the check it was written to
protect.** The same chat's first command was `grep … | head -10; echo "(exit $?)"` — **reading
`head`'s status rather than `grep`'s, in the careful check it was running to be careful.** The answer
happened to be right; it re-ran with the status taken from `grep` and a positive control before
believing itself.

**That is now three self-inflicted instances of entry 8, and this one was committed by the chat that
had just finished renumbering this file.** Reading it does not protect you from it. **Only taking the
exit code from the command that matters does**, which is why the entry's remedy is mechanical and not
a caution.

---

## 19. A type annotation inside a test is not run by the test runner

**`vitest.config.mts` has no `typecheck` block.** Verified with a control: `typecheck` returns zero
hits, `test` returns 27 in the same file.

So any test whose real guard is a type — `Required<T>`, a satisfies clause, an exhaustive `Record` —
**contributes nothing under `npm test`.** It is a `npm run typecheck` guard wearing a test's clothes,
and it sits in a test file, in a describe block, with a name, looking exactly like coverage.

**The demonstrated instance:** `ward-referral-visibility.test.ts`'s fully-populated-projection test
compares `Object.keys(canonical).sort()` against an array **written in the same file** — code compared
to a copy of itself. Its actual guard is a `Required<WardScopedReferral>` annotation. **Replace the
whole body of `wardScopedReferral` with `return {} as WardScopedReferral` and that test still passes.**

⚠️ **Two siblings DO go red on that mutation, so the file is covered — and that is what makes it
dangerous rather than harmless.** The block that reads as the field-set contract is inert, the file
looks thorough, and the thoroughness is what stops anybody checking the one part that does nothing.

⚠️ **SIZE THIS HONESTLY — the first write-up of this entry did not.** `verify:cheap` runs typecheck
and so does CI, **so a violation cannot merge.** What it survives is the fast local loop, until a
broader gate. That is a real cost — the loop is where somebody decides they are done — but it is not
an unguarded contract, and calling it one led directly to a second, larger claim that turned out to
be false.

**Remedy:** either enable Vitest's typecheck mode, or stop writing type-shaped guards inside test
files and put them where `tsc` is the gate. **A guard must be run by the thing that reports on it** —
and a test file is a claim about what the test run covers.

**Do NOT re-assert the same contract at runtime to close it.** That buys the same verdict twice,
which this repository has an explicit rule against. The defect is a guard in the wrong place, not a
missing one.

---

## 20. Proving one assertion can fail does not exercise the others

**Two assertions, two mutations — or one of them is decoration.**

Found 2026-09-02 by Ward Builder Two, in the test written to close entry 14, while satisfying a
requirement to prove that test could fail.

It forced a duplicate entry number and the suite reported **`2 failed | 2 passed`**. The guard worked.
**But the prose-count assertion was among the two that PASSED** — the mutation never touched it. Had
the proof stopped there, an unexercised assertion would have shipped **inside a test whose entire
subject is checks that cannot fail.** A second mutation, aimed at that assertion specifically, was
needed to establish it did anything at all.

⚠️ **THIS RETROSPECTIVELY WEAKENS SEVERAL PROOFS ACCEPTED EARLIER THE SAME NIGHT.** The standard in
use was _break the production code, watch the test file go red, restore._ **A test file going red
tells you at least one of its assertions fired. It tells you nothing about the rest.** Every
multi-assertion guard proved that way has an unknown number of decorative assertions inside it, and
they are indistinguishable from working ones by any evidence collected so far.

**The corrected standard, and it is not much more expensive:**

- **One mutation per assertion that claims to be load-bearing**, each aimed at the property that
  assertion alone protects.
- **Read WHICH assertions failed, not how many.** `2 failed | 2 passed` is the finding; "the suite
  went red" hides it.
- **An assertion no mutation can redden is either dead or protecting something nothing can violate.**
  Both are worth knowing and neither is a passing check.

### ⚠️ The companion, one level out: a test that cannot fail is not a property unguarded

The same mutation answers a second question nobody asked of the 129 findings swept tonight. **Two
different things look identical in a report:**

|                         | What it is                                                                                                                  | Remedy        | At risk   |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------- | --------- |
| **Mis-attributed**      | The property IS guarded — by a sibling, a static test, a type, another gate — **but not by the test whose title claims it** | Honest rename | Nothing   |
| **Genuinely unguarded** | Nothing anywhere goes red                                                                                                   | A new test    | Something |

**The worked case that established the distinction:** `ward-statistics-sections.dom.test.tsx` claimed
to prove a screen resolves its ward from live provider state and could not — no dispatchable event
makes live state differ from seed state in what that screen renders. **But making the defect its title
named turned `tests/ward-flow-single-source.test.ts` RED.** The property was guarded the whole time,
by a static test in another file. **The test was lying about its job; nobody was unwatched.**

⚠️ **All 129 findings from the `.ts` sweep are of the first kind BY CONSTRUCTION**, because that is
what was measured — a named edit after which _that_ test passes and _its_ title is false. Whether
anything else goes red was checked opportunistically. **About a third carry a mitigation note; the
absence of one is not evidence that no guard exists — in most cases nobody looked.**

**So: "129 tests that cannot fail" is the honest statement. "129 unguarded properties" is not, and the
second is what a roll-up will turn it into.** Before any finding is written up as a gap, run the
mutation and read what ELSE goes red.

**And the cost argument, which is the practical conclusion:** checking which kind you have costs one
mutation. Spending it on the ten findings that matter is worth more than reading the last twenty files.

**Why this entry sits at the end rather than beside entry 14:** it is not about a defect in the code.
**It is about the method this file has been using all night to establish that its own findings were
real.**

---

## 21. A red is not attribution — two tests failed and only one was a guard

**Found by running a mutation, not by reasoning about one.** Ward Builder Three, 2026-09-02, closing
Ward Verifier's attack 3 on `production-dynamic-route-reachability.test.ts`. ⚠️ **It is the only
entry in this file discovered by a method executing rather than by somebody inspecting a method.**

**The standard this whole file has been built on is _break it and watch it fail_.** Empty the
exception map; something goes red; the guard works. **That standard is incomplete, and the run that
was meant to confirm it showed why.**

Emptying `LINKED_BUT_INVISIBLE_TO_THIS_SCAN` produced **two** failures:

```
× LINKED_BUT_INVISIBLE_TO_THIS_SCAN has no entry for a route the scan can now see…
  → the map is empty, so the loop below asserts nothing: expected +0 to be 2      ← THE GUARD
× every production dynamic route is referenced by at least one link in src/
  → …/therapy-compass/[slug]/brief, /therapy-compass/[slug]/sheet                 ← NOT A GUARD
```

**The second is the cross-cover that test's own comment calls _luck, not design_** — a different
test failing for a different reason. ⚠️ **Anyone checking merely that SOMETHING went red would have
banked the wrong one, and would have banked it in a file that already says in writing that this
particular red is a coincidence.**

**The clause, Ward Verifier's, which the run supplied the evidence for:**

> **A mutation demonstrates that a specific assertion fired, and only if you can name which one.**

**So the mutation record must carry the assertion's own message, not the file's exit code.** A
mutation table row reading _"2 failed"_ is not a result. `2 failed — and here is the message the
guard under test printed` is.

### The companion, and it is the more uncomfortable half

⚠️ **Knowing a trap does not defend against it.** Within an hour of writing this file's warning that
`--reporter=basic` does not exist in this vitest — that it dies at startup, runs **zero** tests, and
exits `1` — **the same author typed it into a whole-suite command.**

**Exit `1` reads as ordinary test failure.** Had the exit code been trusted, the report would have
been _"the mutation was caught"_, when the true result was that **nothing catches it at all.** ⚠️
**The wrong answer would have been the reassuring one.**

**What caught it was not the knowledge.** It was the habit of demanding a **RAN count** — of
refusing to accept any suite result without a `Tests N passed` line — which surfaced the startup
death without anyone having to remember anything. **Vigilance is not the mechanism. A check that
surfaces the fault whether or not you remembered it is the mechanism**, which is the sentence this
whole file closes on, arriving this time as a measurement against its own author.

---

# ⚠️ What this file is actually claiming, and why the entries carry their authors' names

## 22. A failing assertion stops the ones after it, so one mutation can never exercise a whole test

_Found while carrying out entry 20's own remedy, which is the reason it earns a number of its own._

Entry 20 said: prove each assertion separately, one mutation per assertion. **Following that
instruction across seven clinical guards turned up the reason it is harder than it sounds.**

**When an assertion fails, the test aborts.** Every assertion below it in the same test never runs.
So a mutation that reddens the FIRST assertion in a block tells you nothing whatsoever about the
second — not "it passed", not "it is decorative", nothing at all. **It was never reached.**

Concretely, from `ward-eligibility.test.ts`: a two-line test asserting `gate.pass` is false and then
`verdict.eligible` is false. **Every obvious mutation reddens line one and aborts.** Proving line two
carries weight needed a second, differently-shaped mutation — one that let the gate correctly report
failure while the aggregation ignored it. Only then does the second line run, and fail, and prove
itself.

⚠️ **So "one mutation per assertion" is not the rule. The rule is: for each assertion, find a
mutation under which every EARLIER assertion still passes.** That is a strictly harder search, and it
is the one that actually distinguishes a working check from an unreached one. A tester who mutates
five things, sees red five times, and reports five exercised assertions may have exercised one.

**What the audit found once done properly, and it is worth recording because it is the reassuring
answer:** roughly 45 isolating mutations across seven guards, and **zero decorative assertions.**
Every load-bearing assertion in the sex-designation gates, the bed-holding test, the discharge
destination, the privacy-leak guards, the handover sheet, the governance figure and the five
unanswered-field gates fired under some mutation. **The looser standard had, on these files, happened
to be sound.**

⚠️ **That last sentence is the trap inside the trap.** It would have been equally true, and equally
comfortable, to write it without doing the work — and it would have been an assumption rather than a
finding. **The value of the audit was never the verdict; it was that the verdict could have come back
the other way.** A check that only ever returns "fine" is the subject of this entire file.

**One honest exception, classified rather than fixed.** The handover sheet's final assertion — that a
printed total does not exceed the number of people in beds — **cannot be violated by any single
defect**, because the earlier assertions already verify each per-region count and the total is their
sum. Two separate attempts to break it in isolation tripped an earlier assertion first. That is not
decoration and not misattribution: it is a tautological safety net, and the right response is to say
so, not to delete it and not to pretend it was tested.

⚠️ **The three-way classification is the deliverable, not the count.** An unexercised assertion is
decorative, or protecting something you could not violate, or **guarded elsewhere** — and the third
looks identical to the first in any list. One needs deleting, one needs leaving alone, and one needs
only an honest rename. **Reporting a bare number of unexercised assertions invites the wrong remedy
for two of the three.**

---

**Read this before treating the twenty-two entries above as a list of things to remember.**

By the end of 2026-09-01, **five different chats had written an entry here and then committed the
exact fault they had just written down, within the hour:**

- Ward Verifier wrote falsifier F2 — _the comment explaining a requirement satisfies the check that
  requirement exists to serve_ — and sixty minutes later reported a grep match on a doc comment
  **forbidding** a call as evidence the call existed.
- Ward Verifier again, above, reporting a pipeline's exit code **in the message warning others about
  pipeline exit codes.**
- Ward Builder Three carried a scout's repo-wide finding into a sixteen-route question without
  re-checking that its examples were in scope — **trap 3, the claim true of something, passed on
  without saying of what.**
- Ward Lead ruled a behaviour unreachable, told two chats, had it echoed back by both, and would
  have counted one claim's round trip as two independent confirmations — **trap 5, and as the
  author of the claim rather than its recipient.**
- Ward Builder Two shipped a commit whose entire subject was correcting decayed comments, one commit
  after falsifying a test's title, doc comment and failure message and leaving every word standing —
  in a file that same commit edited. **Trap 10, which is the entry it then wrote.**

**That is not five people being careless. It is this document measuring the failure of its own
method.** A list of things to bear in mind was tried, by the people who wrote the list, and it did
not work. **Every one of those faults was caught by a mechanical control or by a contradiction from
outside — never by care.**

**So read each entry as a reason its check must carry its own proof of execution**, not as advice:
a known-positive control beside every negative; an exit code read from the command that matters; a
diff form chosen for the question being asked; a claim stamped with the tree it was measured on. The
names stay on the self-inflicted ones deliberately. **A traps file whose entries were contributed by
the people who then committed them anyway makes a stronger claim than a tidy one** — it is the
difference between _"avoid these"_ and _"vigilance is not the mechanism; build the check into the
tool."_
