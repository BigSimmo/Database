# SDD ledger — plan: docs/superpowers/plans/2026-08-24-caring-contact-phase-2b-screens.md

**This is the Phase 2B build record and the SDD ledger, in one tracked file.** Per Phase 2A's
Ruling 67, this programme does not keep a ledger in git-ignored `.superpowers/sdd/` scratch — a
git-ignored session ledger was destroyed once already and took the only copy of its session's record
with it. The build record IS the ledger.

**Where Phase 2A's record ends and this one begins:** `phase-2a-build-record.md` holds Rulings 1–67
and every Phase 2A task. Ruling numbering CONTINUES here from 68 so a ruling number is unique across
the whole programme.

Base commit for this plan: `875c8b604`.

**How to find a ruling in this file.** Every ruling is headed `**Ruling [N] — …**`, with square
brackets. A brief that asks you to "read Rulings 96–99" is naming those, and `grep "Ruling 96"`
finds nothing because of the brackets — search `Ruling \[96\]`, or just `[96]`. Task 6's implementer
reported Rulings 96–99 as absent from this file ("the build record stops at 94"); they were present
at lines 1051–1081 the whole time, and Ruling 95 with them. Its brief restated all four in full, so
the work did not proceed without them — but the report is wrong on the fact, and the cause is this
file's citation style not matching the briefs'. Briefs from here on use the brackets so the two
match. A pointer nobody can follow is a pointer that will be reported as a missing document.

---

## Pre-flight scan of the plan

Run before dispatching Task 1, per the method. The output is a table, not a verdict.

### Task pairs sharing a file or an interface

| Tasks                  | Shared surface                      | What one produces / the other consumes                               | Finding                                                                                                                                                               |
| ---------------------- | ----------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 4 → 5, 13, 15, 18      | `shell.tsx` destination lists       | Task 4 adds the first `href`; each screen task adds its own          | **Sequential edits to one file.** No contradiction. Implementers are never dispatched in parallel, so this is a merge risk only if that rule is broken.               |
| 1 → 5, 13, 15, 18      | the empty-state component           | Task 1 produces it; four list screens consume it                     | Clean. Task 1 must land before any consumer.                                                                                                                          |
| 2 → 5, 12, 17          | the list-read API pattern           | Task 2 produces the helper + contract test; three routes consume it  | Clean, and this is the whole reason Group 0 exists.                                                                                                                   |
| 3 → 11, 14, 16, 18, 20 | the overlay trigger                 | Task 3 produces it; five tasks wire overlays with it                 | Clean. Ruling 69 keeps wiring with the owning screen.                                                                                                                 |
| C → 16                 | `message-copy.ts`                   | Task C rewrites the reply wording (items A2/A3); Task 16 renders it  | **Ordering constraint.** C must land first, or Task 16 renders wording that is about to change. Recorded, not a conflict.                                             |
| 7–9 ↔ 13               | the nine-contacts / closing-message | Corrections #3 and #4 touch the activation review AND every schedule | **Genuine cross-task requirement.** Whichever lands first sets the shape; the second must not re-derive it. Both must read the same source of truth in `schedule.ts`. |
| 5 ↔ 6                  | `getEpisode` vs `listPlans`         | Task 5 must NOT call `getEpisode`; Task 6 is the one screen that may | Clean, and stated in the plan. Worth re-stating in both briefs.                                                                                                       |

### Per-task self-consistency

| Task(s) | Its own text agrees with itself?                                                                                                                                                |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C       | Yes — six named edits in two named modules.                                                                                                                                     |
| 1–4     | Yes.                                                                                                                                                                            |
| 5–11    | Yes, with the `getEpisode` restriction stated.                                                                                                                                  |
| 12–14   | Yes.                                                                                                                                                                            |
| 15–16   | **NO — defect found, see Ruling 73.** The design-corrections table routes correction #2 to "Group 3, Task 11", but Task 11 is Group 1's overlay wiring; Group 3 is Tasks 15–16. |
| 17–18   | Yes, with Ruling 72's scope limit stated.                                                                                                                                       |
| 19–21   | Yes.                                                                                                                                                                            |

### Anything the plan mandates that the review rubric treats as a defect

None found. The plan mandates no test that asserts nothing and no verbatim duplication of a logic
block.

---

## Rulings

**Ruling [73] — the design-corrections table's "Group 3, Task 11" is a typo for Task 16; corrected in
the plan.** — Why: Task 11 is Group 1's overlay wiring and cannot carry a Group 3 copy correction. The
correction is the reply-handling wording, which belongs to the message-preview surface built in Task 16. — Cost if wrong: had it stood, Task 11's implementer would have received a requirement it had no
surface for, and either implemented it in the wrong place or reported BLOCKED — a wasted dispatch
either way. This is exactly what the pre-flight scan is for and it is the first thing the scan found.

**Ruling [74] — Group 4 is built at the approved roster-table depth, and the owner is told plainly
rather than asked again.** — Why: this is Ruling 72 carried into execution. The owner was asked
directly whether "workload and coverage" means a staff list or something richer, and answered "go
ahead" to the plan without narrowing it. The method's standing instruction is to rule rather than
stall, and only the roster table has an approved design — inventing a capacity view would be design
work done by an implementer, which is worse than delivering the designed thing. — Cost if wrong: if
he meant rosters, leave and caseload, Phase 2B delivers a thinner group 4 than he expected. It costs a
design pass and one more group later, not rework: nothing built at roster depth becomes wrong.
**Flagged to him in the closing report, not buried here.**

**Ruling [75] — Guidance and Reports (Task 19) are deferred to the END of Phase 2B, and may be cut to
Phase 3 without blocking anything.** — Why: both sit outside the owner's stated four groups, both
already have approved designs, and neither is a dependency of any other task. Deferring them costs
nothing and protects the four groups he actually asked for. — Cost if wrong: if he wanted Reports
early — the equity reach section is the one part with external interest — it arrives later than he
hoped. Reversible at any point by moving one task.

**Ruling [76] — the approved copy changes are executed as ONE batched task (Task C) ahead of Group 0.** — Why: the method says to batch small same-shape work into one dispatch rather than one subagent
per item. All six approved edits are small, independent, and land in two adjacent modules
(`message-copy.ts`, `message-policy.ts`). They also unblock nothing else, so they are cheap to do
first and get the owner's approved wording into the tree before any screen renders it. — Cost if
wrong: one review surface covers six changes, so a weak review could let one through. Mitigated by
requiring a separate covering test per item, named by item number.

**Ruling [77] — A9 (add Lifeline) is NOT dispatched, in spite of being approved.** — Why: the approved
recommendation is conditional on a real crisis number existing, because the message is ~9 characters
from its two-segment maximum and nothing can be added until something is removed. No real number
exists. Dispatching it would force an implementer to choose which patient-facing sentence to delete —
precisely the decision the owner was asked to make and which his "go ahead" does not answer. — Cost if
wrong: the message carries no Lifeline number for now, which is the status quo and is the safe
direction. **Re-ask when a real crisis number exists.**

**Ruling [78] — no push, no pull request, at any point in this plan without the owner saying so.**
— Why: he was asked directly and has not answered; the method's own stop conditions name a push to a
shared branch as something to ask about. Commits accumulate locally, which is what protected this work
before. — Cost if wrong: the work sits on one machine, which is the machine that has destroyed four
working directories. Mitigated because commits on a worktree branch live in the shared object store
and survive the worktree itself.

---

**Ruling [79] — A1 is implemented as an acknowledged validator issue, not as a prohibited term.**
— Why: the owner approved "refuse any message still containing the word Fictional", but BOTH approved
patient messages contain `Fictional Support Line` today, so adding it to `prohibitedTerms` makes every
existing message invalid and the check would have to be disabled to ship. A disabled check is worse
than no check. Instead `validateGovernedMessage` gains a `fictional-contact-detail-present` issue and
`GovernedMessageInput` gains an explicit `syntheticFictionalContactsAcknowledged` flag; the prototype's
callers pass it, so the acknowledgement is greppable and attached to each call site. The day a real
send path is built, someone must consciously pass a flag whose name says it is synthetic, or remove
the fictional numbers. — Cost if wrong: more machinery than a one-line string check, and one more
field on a widely used input type. The alternative was a check that could not coexist with the
messages it guards.

**Ruling [80] — A3's "something automatic comes back" goes ONLY in the reply message, not in the
first message.** — Why: Message A measures 252 septets against a two-segment ceiling — about nine
characters of headroom — and the addition does not fit. Message B has room and is where a patient who
has just replied actually reads. Measured with the repository's own `calculateGsm7`, not estimated:
Message A 252, current Message B 218, proposed Message B **210**, all two segments and GSM-7 valid.
— Cost if wrong: a patient reading only the first message is not told an automatic reply exists. They
learn it the moment they reply, which is the only moment it matters.

## Task progress

Task C: dispatched (sonnet), base `ac87293f2`. Returned **DONE_WITH_CONCERNS** at `9a4cf055c`, seven
commits. Full suite `Tests 2 failed | 9778 passed | 74 skipped (9854)`; typecheck and lint clean.

**The two failures are NOT this diff, and I verified that myself rather than accepting the report.**
They are `tests/gate-receipts.test.ts` > "gate receipts — file modes", both failing inside
`chmodSync(..., 0o755)`. Run alone: `Tests 2 failed | 32 passed (34)`. The diff does not touch that
file, touches nothing filesystem-related, and the failing group is specifically about **file modes** —
which this workstation cannot represent, being a Windows ReFS Dev Drive with `core.fileMode=false`.
Environmental, and now a known third local failure alongside the session-start-hook and
worker-observability ones.

**Implementer concern 1, confirmed and consequential: `validateGovernedMessage` has ZERO production
callers.** The brief told it to "update the prototype's existing callers" to pass the new
acknowledgement flag; there are none. `grep -rn validateGovernedMessage src/ worker/` returns only its
own definition. That is coherent — nothing is ever sent, so nothing validates — but it means the A1
guard protects a path that does not exist yet. **The owner should not read "the validator refuses an
unacknowledged fictional number" as "the system refuses it".** Captured to the issues inbox as P2.

**Implementer concern 3, out of scope and captured:** `tests/helpers/caring-contacts-prohibited-language.ts`
carries the same `\bleads?\b` job-title collision for interface copy that B2 just fixed for messages.
Captured as P3. The implementer reported it rather than fixing it, which is what the brief asked for.

Task C: task review dispatched (opus), with four named questions — B2's narrowing of what is now
permitted, whether A1's derived marker tracks the owner's intent, whether an unwired A4 refusal
achieves the approved outcome, and whether B3's scan can actually fail.

### Task C review — spec ✅, quality approved with findings

Reviewed on opus with four named questions. **Spec ✅**: all six items, exact values verbatim, nothing
extra. **No assertion deleted or loosened** — the only removed test lines are the two `septets: 218 →
210` pins, and six existing tests that gained the acknowledgement flag kept their `toEqual`
expectations intact. Domain isolation holds. Mutation proofs judged genuine on internal evidence
rather than trust: the A2/A3 proof reports septets moving 210 → 221 and the injected `" definitely"`
is exactly 11 septets; the B3 proof quotes Vitest's exact `expected 0 to be greater than 0`.

Three Important, four Minor. **The two findings worth carrying forward as lessons:**

- **An allowlist cannot close an open-ended set.** B2 narrowed the "lead" prohibition by enumerating
  nine commercial modifiers and six companions. Every phrasing not thought of is now permitted —
  `lead magnet`, `lead nurturing`, `qualify this lead`, `convert the lead` all pass and all previously
  failed. The correct shape is the inverse: refuse `\bleads?\b` by default and exempt the job-title
  collocations, because THAT set really is closed in this domain (`incident lead`, `programme lead`,
  `clinical lead`, `team lead`, `service lead`). **Enumerate the safe set, never the dangerous one.**
- **A guard on a chokepoint fires; a guard beside one does not.** A1 and A4 look like the same kind of
  delivery and are not. A1's check lives inside `validateGovernedMessage`, which any future sender
  must pass through, so it fires automatically the day a sender exists. A4's
  `resolveClosingContactMessageBody` is a standalone function nothing obliges anyone to call, so a
  future author can resolve a closing body any other way and never meet it. Same "unwired" label,
  opposite futures.

**Ruling [82] — the A1 marker finding is PROMOTED from Minor to Important and enters the fix round.**
— Why: as built the marker is `crisisSupportContact.split(":")[0]` = the literal "Fictional Support
Line", so a message carrying the reserved NUMBER with no label raises nothing — and that is precisely
the shape that would reach a sender. A1's whole purpose is stopping a fictional crisis number reaching
a real patient; the number is the artefact that matters and the label is the harmless one. Two
realistic reformattings of the crisis contact also silently disable it without reddening a test.
— Cost if wrong: one extra item in a fix round that was happening anyway. The reviewer graded it Minor
on scope grounds and was not wrong to; I am weighting it by what it is guarding.

**Ruling [83] — A4 is NOT recorded as closed, and the owner is told so.** — Why: the approved outcome
was "refuse loudly rather than send nothing". Nothing refuses today, and nothing can be made to
refuse without a future author choosing to call a function they are not obliged to call. Recording it
closed would convert an open safety gap into a solved one in the only document anyone will read later.
— Cost if wrong: the item stays open in the ledger slightly longer than a generous reading needs.

Minors 5, 6 and 7 were bundled into the same fix round rather than deferred — each is a one-line
assertion or a comment reconciliation, and a round was happening anyway, so bundling extends nothing.
Recorded because the method's default is that Minors do not enter the loop.

Task C: fix round 1/5 dispatched — resumed the original implementer with 7 findings (3 Important, 1
promoted, 3 bundled Minors).

### Task C fix round 1 — returned DONE at `a865d6aa9`, and the B2 inversion verified independently

Full suite `Tests 2 failed | 9785 passed | 74 skipped (9861)` — the same two pre-existing
`gate-receipts` file-mode failures, untouched by this round. Typecheck and lint clean.

**I tested the inverted "lead" pattern myself rather than accepting the report**, because it is the
change most able to fail quietly in the permissive direction. The new pattern is a negative lookbehind
— `/(?<!\b(?:incident|programme|clinical|team|service)\s)\bleads?\b/i` — refusing the word by default
and exempting only the closed job-title set. Executed against 18 cases:

- **All ten previously-leaking commercial phrasings are now refused**: `lead magnet`, `lead nurturing`,
  `qualify this lead`, `convert the lead`, `your lead`, `leads database`, `lead gen`, `lead score`,
  `sales lead`, `lead generation`. Note `lead score` — the case Important 2's `scoring?` typo let
  through — is among them, so the typo is genuinely moot rather than merely relocated.
- **All eight job-title and ordinary-English cases still pass**: `the incident lead`,
  `the clinical programme lead`, `team lead`, `service lead`, `clinical lead`, plus `leadership`,
  `misleading` and `we are leading the way`, which the word-boundary handles.

The A1 marker became `/Fictional|<each reserved number>/i` built from
`DESIGNATED_FICTIONAL_MOBILE_NUMBERS`, so the label, the bare number, a relabelling and a reordering
are each independently sufficient to fire it. `message-rules.ts` gained its first import
(`./synthetic-contacts`) — inside the sealed domain, and `synthetic-contacts.ts` imports nothing, so
there is no cycle and no isolation breach. Both checked directly.

**The lesson the inversion confirms, stated as a rule for the rest of this plan: when a check must
distinguish a safe set from a dangerous one, enumerate whichever set is CLOSED.** Here the job titles
this domain uses are five; commercial vocabulary for "lead" is unbounded. The first attempt enumerated
the unbounded side and was permissive in exactly the places nobody thought of. The same test applies
to every allowlist, ignore list and exemption this plan will add.

Task C: fix round 1/5 (7 addressed, 0 open by the implementer's account; commits `9a4cf055c`..`a865d6aa9`).
Scoped re-review dispatched.

### Task C scoped re-review — ALL SEVEN ADDRESSED, no new Critical or Important

The re-reviewer re-derived every claim by executing the regexes and re-running the B3 scan against the
real tree rather than reading the report's assertions. Verified independently of my own check: the
inverted pattern refuses all six leaked phrasings plus `lead score`, and exempts all five job titles;
the A1 marker catches the relabelled, reordered and bare-number shapes; B3's new pass finds
`inbox`/`campaign` in a fixture written as bare JSX text with no quotes anywhere, and finds 0 in the
real tree across 15 files.

**Two mechanism-level checks worth keeping, because both are the kind that a test-level check would
have passed over:**

- **The A1/patient-mobile double report is benign, and for a reason.** The patient-mobile check is
  independent of `syntheticFictionalContactsAcknowledged`, which gates only the fictional check. So a
  caller that acknowledges synthetic contacts silences the noisy code and keeps the safety-critical
  one. The changed expectation is a tightening — the original assertion survives with a second true
  code beside it, in the order the validator actually pushes them.
- **The global-regex handling is correct**, which is easy to get wrong: the prohibited-language regex
  stays non-global for `.test()`, and the `g` copy is used only with `matchAll`, which never advances
  the original's `lastIndex`. A shared global regex with `.test()` would have skipped every second
  match.

**Mutation proofs judged genuine, 5 of 5, and B2's is two-directional as asked**: reverting to the
allowlist makes `lead nurturing` valid and reddens the refusal test; widening to a bare `\bleads?\b`
makes `the incident lead` invalid and reddens the exemption test. Those bracket the behaviour from
opposite sides rather than being two views of one assertion, which is what "prove it discriminates"
actually requires.

**Deferred minors — pointed at the final whole-branch review, not fixed now:**

1. **New Minor 8 — the job-title exemption requires WHITESPACE adjacency, but this domain writes
   `team-lead`** (`contact-rescheduling.ts`, `repository.ts`, and the mockup overlay copy). Inert
   today: those files are outside B3's two scan roots, neither approved message contains "lead", and
   the validator has no production callers. Conservative direction. One-character fix (`[\s-]`) if
   ever needed. The verb sense (`can lead to relief`) is also refused and I would NOT change that
   without the owner — refusing it is defensible in a safety vocabulary.
2. `stripCommentsAndClassNameValues` strips `//` and `/* */` inside string literals too; a future URL
   literal would blank the rest of its line. Narrow, because the quoted pass still covers quoted text.
3. The raw-prose pass scans identifiers and JSX attribute names, not only prose. Zero hits today;
   fail-closed, so acceptable.
4. `scanRootForProhibitedLanguage` is now used only by fixture tests while the real-tree test inlines
   its own walk — two code paths that must stay in step.
5. The A1 marker matches literal number strings, so `+61491570158` or `0491 570 158` still evade.
6. Minor 7's floor is aggregate across both roots, so one root emptying would still pass.

Task C: fix round 1/5 (7 addressed, 0 open; commits `9a4cf055c`..`a865d6aa9`).
**Task C: COMPLETE (commits `ac87293f2`..`a865d6aa9`, review clean, 6 minors deferred).**

## Reading the API layer properly shrank the plan — three rulings

Written while Task 1 ran. I went to write Task 2's brief, read the code it was meant to extract a
pattern from, and found the pattern already there. Two more of the plan's premises fell over the same
way. **All three came from recon reports that were factually correct and whose implications I had
carried too far** — a distinction worth naming, because the reports are not at fault and the same
mistake is available on every remaining task.

**Ruling [84] — Task 2 (the list-read API pattern) is CUT.** — Why: `readHandler` in
`caring-contacts-server/handler.ts` already IS the pattern. It gates on the demo flag, resolves the
actor, opens the store, wraps the read in `auditedRead`, and maps outcomes to responses — including
the subtle ones: `access-audit-unavailable` produces 503 (a read nobody can prove happened is worse
than a read refused), failed produces 500, denied produces `not-found`. **Eight routes already use
it** and four already share the `COLLECTION = "all"` objectId convention for a collection read.
Extracting a helper from call sites that already share a factory would deliver a wrapper around a
wrapper. — Cost if wrong: the three new list routes have no shared helper of their own — but they
still share `readHandler`, which is where the audit and refusal semantics actually live, so the thing
worth holding together is already held.

**What survives the cut, and must move into the first list route's brief:** one contract test pinning
that an **empty list is 200 with an empty array, never a 404**. That is not obvious from the code —
`auditedRead` maps a null-or-undefined release to `denied`, which becomes `not-found`, and an empty
array is neither. The factory's own comment says the trail cannot distinguish "you may not see these"
from "there are none" for a list, which is exactly why the HTTP shape must be pinned by a test rather
than left to reading.

**Ruling [85] — Task 5 does NOT build a patients read; it consumes the one that exists.** — Why:
`GET /api/caring-contacts/plans` already lists the team's plans via `readHandler`
(`objectType: "plan"`, `kind: "search"`). The domain recon noted a `patientDirectory` access-object
type "whose repository read isn't confirmed wired", and I read that as a gap. It is not: that object
type is already used by the **referrals** route, deliberately, because a referral names a patient who
may not yet have a plan. Both reads exist and they are different reads. — Cost if wrong: if a patients
directory eventually needs patients with no plan and no referral, a new read appears then — but
nothing built now becomes wrong, because listing plans is what a caseload screen shows.

**Ruling [86] — design correction #1 is already implemented in the domain; only the control is
missing.** — Why: spec section 2.3 (the coordinator sets the first contact date) is recorded in
`phase-2a-visual-differences.md` as a difference the mockup does not reflect, and the plan routes it
to Task 6 as though it were unbuilt. In fact `schedule.ts` takes `firstContactDate` and validates it,
and the plans POST schema already accepts `firstContactDate` and `firstContactReason`. The correction
is therefore a **screen** change only. — Cost if wrong: none identified; if the domain's handling
turns out incomplete, Task 6 discovers it against a real API rather than building a second path.

**The lesson, and it is the one to carry into every remaining brief.** A reconnaissance report tells
you what it looked at. Three times here I turned "X was not confirmed wired" or "X is recorded as a
difference" into "X does not exist", and each time the thing existed. **Before a brief says "build
this", open the file and look.** The cost of not doing so is not a wasted task — it is a SECOND
implementation of something that already works, sitting beside the first, both maintained.

## Ruling 87 — Task 3 cannot ship a trigger without the commit contract

Verified in the code before writing Task 3's brief, applying the lesson from Rulings 84-86.

**What already exists:** `workspace-overlays.tsx` is already a Client Component, and
`openWorkspaceOverlay(id)` is already exported and covered by DOM tests. It pushes
`?overlay=<id>` onto history so Back closes the overlay. So Task 3 is NOT "build an overlay
opening mechanism" — that is built. What is missing is a small client-side control a Server
Component screen can render to call it.

**What reading it also exposed, and this is the part that matters.** `WorkspaceOverlays`'
`commit` callback currently **closes the overlay and records nothing**, with an honest comment
saying so: the screens that raise these overlays and the stores their decisions are written to
are later tasks, and "nothing in the workspace opens an overlay yet, so no control in the
interface currently advertises an action this does not perform."

**That last clause is load-bearing, and Task 3 is precisely what would break it.** The moment a
screen can open an overlay, its confirm button becomes a control that advertises an action the
system does not perform — which is exactly what this repository's button-wiring gate exists to
forbid, and what the "Language and region" defect of 2026-07-21 was. The overlays are currently
safe only because they are unreachable.

Ruling: [87] Task 3 delivers the trigger **and** the commit contract together. The trigger
component must **require** a commit handler from its caller — not default it to a no-op, and not
accept an optional one. A screen must be unable to open an overlay it has not wired. Where an
overlay's action genuinely is not built yet, the caller passes an explicit unavailable-state
handler in the shape `unavailable-destination.tsx` already uses (`aria-disabled`, an inert
handler, a stated reason), so the control still says what it is. — Why: splitting them would
ship, for the length of one task, an interface whose confirm buttons do nothing — and a later
task would have to find every one of them. Requiring the handler at the type level means the
compiler finds them instead. — Cost if wrong: Task 3 is larger than the plan sized it, and the
first screen to use it carries more wiring than "open a panel". That is the honest cost of the
overlays being decision surfaces rather than dialogs.

**The general shape, worth keeping:** a mechanism that is safe only because nothing reaches it is
not safe, it is unreached. Before making something reachable, check what its arrival makes true.

## Task 1 — the shared EmptyState component

Dispatched sonnet, base `ff79cb6ce`. Returned **DONE** at `97a7ff782`.
New file `tests/caring-contacts-empty-state.dom.test.tsx`: `Tests 9 passed (9)`. Full suite
`Tests 2 failed | 9794 passed | 74 skipped (9870)` — the two known `gate-receipts` file-mode
failures and no others. Typecheck and lint clean, both after real lease acquisition rather than a
lock-contention exit.

**The lock incident, and the correction it produced.** The implementer paused mid-task waiting on the
repository's heavy-run lease, held by a concurrent session's Playwright run — with its work
UNCOMMITTED. On a machine that has destroyed four working directories mid-session, that is the
expensive shape of an ordinary delay. Resumed with an explicit instruction ordering: **commit first,
then retry the gate, bounded.** It committed, retried twice, acquired the lease and finished for real.

The instruction is now standing for every remaining brief: _commit before waiting on any gate, and a
lock-acquisition failure is neither a pass nor a failure — if the output carries no summary line the
run did not happen, whatever the exit code says._ Machine health was checked rather than assumed:
`node --version` returned in 0.083s, so this was ordinary lease contention and not the
process-spawn starvation that has previously made everything slow.

**Task C's B3 scan caught a defect in Task 1, one task after being built.** The first draft used
lucide-react's `Inbox` icon; `caring-contacts-interface-vocabulary.test.ts` rejected it, because
"inbox" is banned as reply-monitoring language. The implementer switched to `FolderOpen`.

This is worth recording precisely, because it cuts both ways. It **fired on a bare identifier, not on
user-facing prose** — which is exactly deferred item 2 from Task C's re-review ("the raw-prose pass
scans identifiers, imports and JSX attribute names, not only prose … a future `const conversation = …`
would fail the test with a confusing message"). That deferred concern materialised within one task,
so it is real and will recur. Whether it was a _false_ positive is a judgement I have put to Task 1's
reviewer rather than settled myself: an icon named `Inbox` is not text a patient or clinician reads,
but it is also the kind of name that leaks into a `data-testid` or an `aria-label` without anyone
noticing. If the reviewer judges it over-reach, narrow the scan; if not, leave it and accept the
occasional harmless rename. **Do not narrow it merely because it was inconvenient once.**

Task 1: task review dispatched (sonnet), with four open questions — the missing `role="group"`
wrapper that the sibling `AutomatedState` has, whether typing `action` as `ReactNode` weakens the
button-wiring guarantee, whether the discriminated union delivers its promise at the type level, and
whether the mutation proof is genuine.

### Task 1 review — spec ✅, quality NOT approved as-is; two Important findings

**The mutation narrative was wrong, and the reviewer found it by re-running both mutations rather
than reading the report.** The report described mutating the `"filtered"` branch and claimed
`Tests 2 failed | 7 passed`. Applying exactly that edit produces `Tests 1 failed | 8 passed` — with
the guard hardcoded `true` the else-branch is dead code, so touching it cannot affect the `"no-data"`
case. Putting the placeholder in the branch that ALWAYS executes reproduces the reported numbers
exactly, including the two failure messages quoted.

So the evidence is genuine and reproducible; the account of **which branch was mutated** is not, and
the mutation actually run is coarser than the brief asked for — it broke both kinds' content equally
rather than making `"filtered"` render as `"no-data"`. The distinction is still proven. But a report
that misdescribes its own proof is a report whose other proofs cannot be taken on trust, which is why
this is Important rather than a note. **Self-reported mutation results need independent
re-derivation, and this is the second time on this programme that re-deriving one changed the
answer.**

**Ruling [88] — the component is renamed `ListEmptyState`, and the naming collision was MY defect,
not the implementer's.** — Why: `src/components/ui-primitives.tsx` already exports an `EmptyState`,
a registered design-system primitive; `EmptyState` appears across 43 files. My brief mandated the
colliding name. The consequence is not cosmetic: `scripts/generate-design-system-adoption.mjs`
matches test files to components with a bare `new RegExp("\b" + name + "\b")` over raw file text,
with **no import-path awareness** — verified at line 1562. So the regenerated
`docs/design-system/adoption-manifest.json` now credits `tests/caring-contacts-empty-state.dom.test.tsx`
as proof coverage for a shared primitive that test never imports. **That is false evidence about test
coverage in a governance artifact**, which is precisely the class of defect this programme keeps
finding, and it cannot be fixed at the call site because the matcher never looks at imports.
`ListEmptyState` is unused anywhere in `src/` or `tests/`. — Cost if wrong: a rename across one
component, one test file and the regenerated manifest. Cheaper than a manifest that overstates
coverage for a component used in 13 places.

**The accessibility gap is real and is fixed in the same round.** `AutomatedState` wraps its three
pieces in `role="group"` + `aria-label` so a screen reader reaching the state reaches the reason and
remedy without hunting. `ListEmptyState`'s `"filtered"` branch has the identical three-piece shape —
name, why, what-changes-it — and no role, no grouping, no heading element. Ruling 81 forbade
rendering `AutomatedState`; it never forbade reusing its accessible structure, and I should have said
so explicitly in the brief.

**Two of the reviewer's answers settle open questions and are recorded as settled:**

- **`action: ReactNode` is the right trade, not a weakening.** An `onClick`-shaped prop cannot cross a
  Server-to-Client boundary at all, so it would force this component to become a Client Component —
  exactly what Ruling 13 forbids. Enforcement lives in `eslint-rules/require-button-wiring.mjs`, a
  repo-wide AST scan that fires wherever a `<button>` is authored, which is the call site. Delegating
  there is the established `ServiceStateBanner`/`UnavailableDestination` precedent.
- **The `Inbox` → `FolderOpen` swap was the scan working correctly, and the scan will NOT be
  narrowed.** An identifier is not user-facing text, but it is one accidental `aria-label` away from
  becoming so, and a scan restricted to string literals would miss exactly that near-miss. In a
  suicide-prevention product with explicit vocabulary rulings already in force, flagging identifiers
  is the correct conservative posture and the fix cost one icon name. This closes Task C's deferred
  item 2 as **decided, not deferred**.

Task 1: fix round 1/5 dispatched — 3 items (mutation narrative corrected and re-run as specified, the
`ListEmptyState` rename, the `role="group"` structure).

## Ruling 89 — Task 4 is merged into Task 5, because as written it ships a false statement

Found while writing Task 4's brief, verifying its premises in code first.

**What is already there, and does not need building:** `src/lib/caring-contacts-routes.ts` declares
all fifteen destinations plus typed helpers for every dynamic route (`patientRoute`, `planRoute`,
`contactRoute`, `pathwayRoute`, `episodeTimelineRoute`). `shell.tsx`'s own comment says the change to
light up a destination is exactly "adding an `href` here". So Task 4's mechanical half is one line.

**The problem is its other half.** The plan has Task 4 create `patients/page.tsx` rendering the empty
state, as Group 0's proving step — before Task 5 gives it real data. A page that renders
`ListEmptyState` unconditionally **says "No patients yet" whether or not patients exist**. That is a
false statement on a clinical caseload screen, and it is the _precise_ defect Task 1's component was
built to prevent: an empty-looking list that is not empty. Shipping it, even for one task, would mean
the first screen of this phase overclaims in exactly the way the phase's first component exists to
stop.

Ruling: [89] Task 4 is **merged into Task 5**. Its real deliverables — the `href` in
`PRIMARY_DESTINATIONS`, `npm run sitemap:update`, the `docs/codebase-index.md` entry, and the
reachability assertion — travel with the screen that has real data, and the page is never reachable
in a state where it can lie. — Why: the alternative is a page whose only content is a claim it cannot
support. "It is only temporary" is not a defence a clinical surface gets, and the orphan-route gate
would have forced the inbound link at the same moment, making the false state reachable rather than
merely present. — Cost if wrong: Group 0 loses its proving step, so the first thing that exercises the
scaffolding end to end is a larger task with more to go wrong at once. Accepted, because Task 5 was
the immediate next task anyway and nothing else in Group 0 waits on it.

**The general shape, and it is the same one as Ruling 87:** before making something reachable, ask
what its arrival makes true. There the answer was "confirm buttons that do nothing"; here it is "a
caseload screen that says empty when it is not". Both were invisible while the thing stayed
unreachable.

### Task 1 scoped re-review — ALL THREE ADDRESSED, no new breakage

The re-reviewer traced the corrected mutation through all 11 tests from the code rather than accepting
the reported count, and landed on the same `Tests 2 failed | 9 passed (11)` for a reason worth keeping:
the action slot sits **outside** the mutated ternary, which is why exactly two tests fail rather than
three. That is the kind of detail that separates a re-derivation from a re-reading.

The rename was verified end to end: no bare `EmptyState` word survives in the test file, the file move
is a real rename rather than delete-plus-add, and the manifest diff is exactly one deleted line inside
the `ui-primitives.tsx` entry with nothing else disturbed. The four surviving `EmptyState` mentions in
the component's own comments are safe because the generator's `testFiles` list is built from a
`tests/`-only walk — checked in the generator source, not assumed.

`role="group"` is present, hook-free, and applied to **both** kinds rather than only `"filtered"`. The
re-reviewer judged that defensible rather than a defect: a named group on the two-piece `"no-data"`
case is slightly more verbose but never misleading, and it buys one consistent pattern across all four
list screens. Left as a two-line reversal if a later reviewer prefers the brief's letter.

**Deferred minors:** the transient mutation would not have survived `tsc --noEmit` (the untouched
`"filtered"` branch reads an unnarrowed union once the guard is hardcoded) — cosmetic, never
committed, and it does not affect a vitest-based proof because esbuild strips types without checking.
And the both-kinds-vs-filtered-only judgement above.

**Task 1: COMPLETE (commits `c0f84112f`..`caef3c7c3`, review clean, 2 minors deferred).**

Task 3: dispatched on **opus** rather than the default implementer tier. The model split reserves the
stronger setting for architecture, and this task carries a genuine one: `WorkspaceOverlays` is
rendered once by the shell rather than per screen, so a screen's commit handler has to reach it
somehow, and every obvious answer — module-level mutable state, a context provider, lifting the host
per screen — has a different cost against Ruling 13's client-payload limit. That is a design decision,
not transcription.

## Owner answered the three open questions, 2026-08-24 — one ruling REVERSED

Asked directly rather than left to inference, because two of them were shaping work already underway.

**1. Push authorised.** The branch goes to `origin` after each task from now on. No pull request, no
merge, nothing live. This closes the durability gap that has cost this programme three working
directories: commits on a worktree branch already survive the worktree, but not the machine.
**Ruling 78 is superseded** — it forbade pushing precisely because he had not been asked yet, and now
he has.

**2. Team screen: the simple staff list. Ruling 74 CONFIRMED by the owner, not merely by me.** Each
staff member with their active plans, unclaimed work and anything overdue for escalation — the
roster-table depth the approved design actually covers. Rosters, leave and caseload fullness are NOT
in scope. This was the item I flagged as most likely to under-deliver against what he pictured; it is
now his decision rather than my inference, which is the outcome flagging it was for.

**3. Guidance and Reports are IN this phase. Ruling 75 is REVERSED.** I ruled them deferred to the
end and cuttable to Phase 3, reasoning that they sit outside his stated four groups. He wants them
built. That is his call and it is a reasonable one: both already have approved designs, so deferring
them was optimising for a scope boundary he did not ask for. **Task 19 is therefore a committed part
of Phase 2B, not a contingency**, and Reports carries the §2.5 equity reach section with small-cell
suppression.

**Worth recording about the reversal rather than just the reversal.** Ruling 75's reasoning was sound
on its own terms and still produced the wrong answer, because it optimised against a constraint —
"protect the four groups he asked for" — that he had never expressed as a constraint. The method's
instruction to rule rather than stall is right, and this is its cost: a ruling made in the owner's
absence is a guess with reasoning attached. **Where a ruling is cheap to un-make and the owner is
reachable, ask.** All three of these took one question and reversed one of my decisions.

### Task 3 review — spec ✅, quality NOT approved; 4 Important, 5 Minor

The architecture was judged well-argued and honestly written, the six mutation proofs all genuine
(re-derived from the real test bodies — the trigger file has 12 tests and the host 14, so the reported
26 is only obtainable from a real run), and the incident-`note` boundary held **mechanically**: a
module-graph walk proves it rather than asserting it. But three findings must be settled before any
screen adopts the contract.

**Ruling [90] — the no-staged-commit refusal applies ONLY to rows that mutate state. The implementer
considered this and rejected it; I am overruling that.** — Why: eight of the 24 rows have
`mutatesState: false`, and their controls are not confirmations, they are **exits** — `session-expiry`
"Sign in again", `offline-banner` "Try connecting again", `recoverable-error` "Try loading again",
`permission-unavailable` "Back to the plan", and four more. None records anything, so none can be "a
confirm button that records nothing" and Ruling 87 does not reach them. Refusing them contradicts the
host's own Rule 9 three lines above the change, and renders a sentence — "there is nothing here to
carry out" — that is **false about the control it points at**, whose action is to leave.

**And on two rows it is actively harmful.** `session-expiry` and `offline-banner` are
`dismissal: "recovery-only"`: Escape and backdrop are deliberately inert, pinned by the Playwright
spec. Their only control is now `aria-disabled`. **That is the one overlay a person must not be able
to walk away from, and it now offers them nothing at all** — a dead end, live in production today,
because the shell renders `WorkspaceOverlays` and any deep link reaches it.

This is decidable rather than a matter of taste, which is why it is an overrule and not a preference:
the question "does this row record a decision?" has an answer for each of the 24, and for these eight
it is no. — Cost if wrong: if a `mutatesState: false` row later gains a recording action, the refusal
must be re-widened to it. Cheap, and the row's own flag is what would change.

**The other three Important findings, each reasoned from the code:**

- **A refusal flashes on confirm.** `record` then `clear` then `close`, but `close` is
  `history.back()` and popstate is asynchronous, so React commits an intermediate frame where the URL
  still names the overlay and the slot is already empty — rendering the action `aria-disabled` with
  the "opened by address" refusal. After confirming "Withdraw this patient", that is the worst
  available sentence to flash. Every existing test uses `waitFor` on the final state, which is exactly
  why nothing catches it.
- **The staged slot is never cleared on Back.** The code's comment claims clearing stops a forward
  traversal re-entering with a live commit; that is false on the workspace's PRIMARY dismissal route,
  because `close` is only called by the Sheet and Back closes through popstate without it. So Back
  then Forward re-enters with the original commit live, and a commit staged on one screen survives a
  client-side navigation to answer a later same-id overlay raised for a different record — the
  design's own ten-`Pause`-rows case, one row's commit answering another row's overlay, with nothing
  in the overlay naming the record so the clinician cannot see the mismatch.
- **The async deferral is not neutral.** What ships is not "no policy" but "close optimistically, drop
  the rejection" — and because `record` returns `void`, the later task cannot add a policy without a
  breaking signature change. Defer the policy; widen the signature now.

**The lesson worth keeping from Important 1, and it generalises past this task:** a rule derived from
a real defect (Ruling 87) was applied uniformly to a set whose members differ in exactly the property
the rule depends on. The rule was right; its domain was assumed rather than checked. **Before applying
a rule to a set, ask which members it is actually about** — here the frozen matrix already carried a
`mutatesState` flag that answers it row by row.

### The browser gate answers Task 3's concern 2 — measured, not reasoned

The implementer could not run `verify:ui` and honestly declined to claim it passed, flagging that its
change adds a paragraph to every overlay which could in principle touch the 24-overlay matrix test's
`toBeInViewport({ratio: 1})` at a 900px viewport. The reviewer confirmed the risk was correctly
identified but understated in size — the refusal string is ~150 characters, roughly 4-5 wrapped lines
at 390px rather than "one extra short paragraph".

I ran it against Task 3's head rather than leaving it inferred:

```
32 passed (53.8s)
EXIT=0
```

No failures. **Concern 2 is closed by measurement.** Both the implementer's and the reviewer's
reasoning about the risk were sound; the margin held.

**One thing this result does NOT cover, stated so nobody reads it as broader than it is:** it was
taken at `9a36d292e`, BEFORE fix round 1. Ruling 90 changes which rows render that paragraph at all,
and the fix to the confirm sequence changes what renders at commit time. **This green must be re-taken
after the fix round** — a browser result names the commit it ran against or it means nothing, which is
the rule this branch learned the expensive way when a concurrent session invented both a phantom
failure and a phantom pass.

### Task 3 fix round 1 — all four Important plus M-3, at `1306c0b7d`

`Tests 2 failed | 9823 passed | 74 skipped (9899)` — the two known `gate-receipts` file-mode failures
and no others. Typecheck and lint clean. Test count rose 9884 → 9899.

**Two corrections the implementer made to MY framing, both of which I had wrong:**

- **Important 2 was worse than I described, and my suggested fix would not have worked.** I proposed
  "close before clearing". Both `clear` and `close` are synchronous while the URL change is not, so
  reordering them changes nothing — the intermediate frame survives either way. The confirm handler
  now clears nothing at all. **A controller's suggested remedy is a hypothesis like any other**, and
  this one was falsified by someone who read the code more carefully than I did.
- **Important 4 — "I deferred the signature along with the policy"** is the implementer's own summary
  of its error, and it is a better statement of the finding than mine was.

**The self-caught non-run is the most valuable thing in this round.** Its first N5 mutation gate was
written as `grep -c "<class>" <file> && npm run test:focused …`. The mutation had stripped those
classes, so the count was `0` — and **`grep` exits non-zero when it matches nothing**, so `&&`
short-circuited and the test never ran. No summary line, and the command reads as "confirm the
mutation landed, then test it". It reported the non-run and re-ran with `;` rather than quietly
repeating it.

This is a fifth member of a family this repository keeps meeting: a hook reporting on stderr, `grep`
on a binary file, a pipeline masking an exit code, a tautological re-check, and now a guard chained
behind a `grep -c` that legitimately matches nothing. **The tell that unites them: ask what the check
prints when it FAILS, and confirm you have seen that output at least once.** Four of the five produce
no output at all in the failing case, which is exactly why they read as passes.

Task 3: fix round 1/5 (5 addressed, 0 open by the implementer's account; commits
`9a36d292e`..`1306c0b7d`). Scoped re-review dispatched, told to judge the Important-3 token claim
hard — "one rule closes all six cases" is the kind of claim most likely to be over-stated. Browser
gate re-running at the post-fix head, because the earlier green is stale by this branch's own rule.

### Browser gate re-taken after fix round 1 — green, and the staleness rule paid for itself

```
32 passed (51.2s)
EXIT=0
```

Zero failures, run against the tree at `744fb7a99` (source state `1306c0b7d`). The earlier green at
`9a36d292e` was correctly declared stale: Ruling 90 changed **which** rows render the refusal
paragraph and the confirm-sequence fix changed **what** renders at commit time, so neither the input
nor the output of the assertion that mattered was the same thing twice.

Both greens say `32 passed`, which is exactly why the rule matters rather than exactly why it does
not. **Identical numbers across two different trees are not evidence of the same fact** — they are two
separate measurements that happen to agree, and only one of them describes the code that now exists.
Had the fix broken the viewport assertion, the stale green would have said `32 passed` about a tree
nobody was shipping.

### Task 3 scoped re-review — ALL FIVE ADDRESSED, no new Important

The re-reviewer checked Ruling 90 against `definitions.ts` itself rather than the report: exactly 8
rows carry `mutatesState: false`, their `decision` fields are the eight exits word for word, the
withholding reads the frozen flag rather than re-deciding it, and `definitions.ts` is untouched across
the whole task range — so the flag was consulted, not edited. `session-expiry` deep-linked with
nothing staged is covered twice, once parameterised across all eight and once by a named recovery-only
gate.

**It corrected one of my own claims, and the correction matters.** I described the Important 3 fix as
"a one-shot token". It is **two** mechanisms — the token in `history.state` AND a reconciliation effect
that empties any slot whose token is not the current entry's — and **neither alone closes the set**:
disabling the effect reddens 2 tests, dropping the token match reddens 1. The report's summary table
attributes several cases to the token alone; its body states both. I repeated the summary. **A
mechanism described as one thing that is actually two is a description under which a later maintainer
can delete half and still believe the comment.**

It walked all seven cases rather than accepting "one rule closes them" — Back, Back-then-Forward,
cross-screen, spent commit, deep link, two triggers in quick succession, and page reload. All closed;
Back-then-Forward is closed by composition of two asserted facts rather than driven directly, which it
flagged as a coverage note rather than a gap.

**The generated-manifest line is a DIFFERENT problem from Ruling 88, and the implementer was right to
stage it.** Ruling 88's defect was a **false** attribution — that test never imported `EmptyState`.
Here the trigger test really does render the shared `Sheet` and assert inside it, so the attribution is
**true**; the generator reached a correct answer for a bad reason. Rewording accurate technical prose
to dodge a regex would have been gaming the generator, and Ruling 88's own remedy was to fix the name,
not the comment. **Same weak mechanism, opposite verdicts — which is why "we saw this before" is not
itself an answer.**

**Deferred minors, pointed at the final whole-branch review:**

1. The trigger hand-rolls a near-duplicate of `floatingControl` and its comment overstates the match —
   it uses `--border`/`--surface-subtle` where `floatingControl` uses `--border-lux`/`--surface-raised`
   and reserves `--surface-subtle` for hover. So the control that OPENS an overlay and the overlay's
   own secondary action will not look alike. Consistency, not correctness.
2. A rejection after unmount is now fully silent, where it previously surfaced as an unhandled
   rejection. Narrow — `WorkspaceOverlays` lives for the route — and the deferred policy task owns it.
3. Back-then-Forward is argued rather than driven; one `history.forward()` call would assert it.
4. `NO_STAGED_COMMIT_REASON` says "opened by address rather than from a control", which is literally
   false for Forward-into-a-spent-commit. Pre-existing wording looseness.
5. The `overlayId: string` render-time throw — needs `definitions.ts`, which the brief forbade.

**Task 3: COMPLETE (commits `16d666039`..`1306c0b7d`, review clean after 1 fix round, 5 minors
deferred).** Browser gate green at the post-fix head: `32 passed`, exit 0.

**Group 0 is finished.** Task 2 was cut (Ruling 84), Task 4 merged forward (Ruling 89), so the shared
scaffolding is: `ListEmptyState`, the overlay trigger and its commit contract. Group 1 begins.

## Task 5 — the Patients directory, and the question it was right to stop on

Returned complete at `d27030405`. `Tests 2 failed | 9851 passed | 74 skipped (9927)` — the two known
`gate-receipts` file-mode failures only. Typecheck and lint fresh passes, not reused receipts. Twelve
mutations, each red on its covering test, presence proved with `;` rather than `&&` — the previous
task's non-run lesson applied without being restated.

**Browser gate green at this head: `32 passed`, exit 0.** The implementer flagged that changing
Patients from an unavailable button to a link shifts unavailable-control counts (its own DOM
equivalents went 16 → 14) and warned the Playwright spec might carry the same counts. It does not.
Measured rather than assumed, and the warning was the right one to give.

**Ruling [91] — a names-only projection is built, as its own task. The OWNER decided this, not me.**
The brief forbade `getEpisode` on a list, and instructed the implementer to stop and report if the
approved design needed a name rather than decide for itself. It did exactly that: the design shows
`row.name`, `PersonAvatar initials` and a "Search name or synthetic ID" box, and it built rows headed
by the synthetic identifier instead.

That was the correct stop. The tension is real in both directions: `getEpisode` is the only read that
releases patient name **together with** mobile number, identifiers and cultural identity, so using it
for a list would pull all four into a page that shows one — and yet **a caseload a clinician cannot
recognise their own patients in is barely a caseload.** Put to the owner, who chose the narrow read:
a projection returning the name alone, permission-checked in its own right, never widening
`getEpisode`.

— Cost if wrong: it changes `repository.ts`'s interface, so both stores and the shared contract suite
move together; that is the price of the storage contract being the thing that holds them equal, and it
is the reason this is **its own task rather than a fix round on Task 5**. A fix round would have
balloonded into a domain change reviewed as a screen change.

**The implementer's own recommendation was the one the owner picked**, arrived at independently. Worth
recording: an implementer told to stop and report rather than decide produced a better-reasoned option
than the brief anticipated, because it had read the design and the read contract side by side.

**Concern 2 is a false-evidence claim and must be fixed, not deferred.** The adoption generator
refuses an undeclared production page route, so the new route had to join the
`caring-contacts-workspace` surface — whose proof is declared `passed` with
`tests/ui-caring-contacts-workspace.spec.ts` as its evidence. **That spec has never visited
`/caring-contacts/patients`.** So the design-system contract now asserts browser proof for a route
nothing has proved. Same family as Ruling 88: a governance artifact making a claim about coverage that
is not true. The remedy is a visit in the spec, not a quieter claim.

**Two concerns carried to the review rather than settled here:** the role-restricted empty state uses
`ListEmptyState`'s `"filtered"` kind for something that is not a filter (an auditor cannot view plans,
so `listPlans` returns `[]` and "No patients yet" would be a lie) — a third `"not-permitted"` kind may
be right, but it touches a Group 0 component; and the prohibited vocabulary now bites ordinary English
(`\bleads?\b` matches "team lead", `\bsafe\b` is banned outright), which the Team screen will hit
immediately.

### Task 5 review — spec ✅, quality NOT approved: 1 Critical, 4 Important, 5 Minor

The twelve mutation proofs were all traced to the assertion reading the mutated value and judged real,
including a self-corrected one (M4 → M4b) recorded rather than quietly re-run — the opposite of the
two misreported mutations earlier in this programme. Reads are clean: `getEpisode` is absent and
pinned by a spy, and `PlanRecord` excludes `patientDetail` structurally, with the in-memory store
projecting through `toPlanRecord` rather than returning the stored object, so nothing rides along.
Filtering is genuinely server-side — both filters are navigations, no new client boundary.

**C-1 is worse than the implementer reported, and it found it itself.** The design-system contract
declares the `caring-contacts-workspace` surface with **all five** proof categories — dark,
forced-colours, compact-320, print, browser — as `passed`, evidenced solely by
`tests/ui-caring-contacts-workspace.spec.ts`. That spec pins `WORKSPACE_ROUTE = "/caring-contacts"`
and every `page.goto` in 952 lines uses it. It has never loaded `/caring-contacts/patients`.

Three things make this Critical rather than untidy:

- **The spec's own header states the rule this breaks**: "a proof pointer at a suite that never visits
  this route is a red gate that has been silenced." The change made that sentence untrue about the
  file it is written in.
- **No honest weaker declaration exists.** The generator fails any v2 surface whose proof category is
  not `passed`, so "declare it more quietly" is unavailable, and a separate surface would be forced to
  `passed` too. The generator also cannot detect the problem — evidence paths are checked for being
  tracked files, never for relevance to the route.
- **The remedy is bigger than a `goto`.** Four of the five are accessibility-mode claims, so honesty
  requires the dark / forced-colours / 320px / print coverage to run against the new route as well.

**Which family:** unambiguously Ruling 88's — a **false** attribution — not the true-attribution case
kept in Task 3. Fix, do not keep. Credit where due: the implementer found it, described it accurately,
and refused to edit a spec it could not run.

**Ruling [92] — `ListEmptyState` gains a third kind, `"not-permitted"`.** — Why: an auditor cannot view
plans, so `listPlans` returns `[]`; `"no-data"` would say "No patients yet", which is a lie, so the
implementer used `"filtered"` — whose own documentation says records exist, and whose icon selection
renders a struck-through magnifying glass **on a screen where no search was performed**, in a component
whose comment says the icon "is part of what states the difference wordlessly". The screen's words are
honest; the type and the icon are not. `ListEmptyState` has exactly ONE consumer today, so this is the
cheapest it will ever be, and Schedule, Templates and Team will each meet the same role case and copy
whatever Patients did. — Cost if wrong: a fourth kind later, and a union that is one member wider than
strictly needed. Against that: leaving it reintroduces at the type level exactly the blur the component
was built to refuse.

**Ruling [93] — the role-restricted remedy must say what is true, and there is no role switcher.**
The screen currently says "What changes it: The role switcher changes which role you are acting in."
I verified it myself: `CARING_CONTACTS_ROLE_COOKIE` appears exactly once in `src/`, its own
declaration in `session.ts`, and nothing writes it — `resolveDemoActor` silently defaults to
coordinator. Spec §4.4 requires a **reachable** remedy, and **naming a control that does not exist is
worse than naming none**, because a clinician will hunt for it. The covering test asserts the
_presence_ of "What changes it:" and never that its content is real, so this whole class is invisible
to the gate. — Cost if wrong: if a switcher is built later the wording needs revisiting, which is a
one-line edit at the moment someone is already in the file.

**The lesson C-1 and Ruling 93 share.** Both are false statements that passed every gate, because the
gates check **shape** rather than **truth**: the generator checks an evidence path is a tracked file,
never that the suite visits the route; the empty-state test checks a remedy is present, never that it
exists. **A gate that checks a claim is well-formed will certify a well-formed lie.**

### Task 5 fix round 1 — all ten, and the browser gate went 32 to 38

`Tests 2 failed | 9860 passed | 74 skipped (9936)` (the two known `gate-receipts` file-mode
failures), typecheck and lint fresh passes, and the Playwright gate **`38 passed (58.3s)`, exit 0** —
six new Patients tests, so C-1's proof claim is now backed by coverage rather than by a pointer.

**Ruling 93's PREMISE WAS WRONG, and the error was mine.** I wrote that
`CARING_CONTACTS_ROLE_COOKIE` "appears exactly once in `src/`, its own declaration, and nothing writes
it". The implementer corrected it and I verified the correction myself: the constant appears **four**
times and `src/app/api/caring-contacts/session/route.ts:53` **does** write the cookie.

**How I got it wrong is the part worth keeping.** I grepped `"caring-contacts-demo-role"` — the
cookie's string _literal_ — which appears exactly once, at the `const` that names it. Every actual use
goes through the constant. So my grep returned a true answer to a question I was not asking, and I
reported it as though it answered the one I was. The reviewer made the identical mistake independently,
which is what made it feel confirmed.

This is the same family as the five "checks that cannot fail" already recorded, and it is the variant
that catches careful people: **not a check that cannot fail, but a check that answers a neighbouring
question.** When grepping for whether something is used, grep the SYMBOL, not the value it holds — and
when two people agree, check whether they ran the same flawed command rather than two different ones.

**The conclusion survives:** there is still no role-switching control in the interface, so naming one
was false and the new wording is right. Only the stated fact was wrong. Recorded rather than quietly
amended, because the server half of a switcher existing matters to whoever builds the UI.

**Three findings the mutations PRODUCED rather than confirmed:**

1. **`expect(status).toBe(200)` cannot catch a `notFound()` on this route.** With `notFound()` added
   the route still answered **200**: it is dynamic and streams under a Suspense boundary, so headers
   flush before the render reaches the refusal and the 404 arrives as content. Only the content
   assertions failed. The status assertion is kept — it still catches a refusal made before the stream
   opens — but the test now names which assertions are load-bearing. **The "gates check shape, not
   truth" lesson landed on a test written in the same round it was issued.**
2. **I-4's branch had no covering test at all.** Restoring `?? []` left all 56 tests green, because
   the branch is unreachable through the real stores — which is precisely why it was wrong and why
   nobody noticed. Now pinned by spying `listPlans` to `null`.
3. **M-9's assertion covered less than it looked.** It checked the filter chips but not the empty
   state's own remedy link; stripping the attribute from that one link left the file green.

**A process failure that was MINE.** Partway through this round I switched this worktree to
`claude/caring-contacts-foundation` to fix the PR's CI — **while an implementer was working in it**.
Its source files vanished from disk and two of its edits landed on the wrong branch. It recovered
cleanly: saved the stray diff, restored that tree exactly as found, switched back, re-applied. Nothing
was lost, and the recovery was better than the incident deserved. **Never switch a worktree's branch
while a subagent is working in it** — one worktree, one branch, for the duration of a dispatch. If a
second branch needs work, it needs a second worktree.

**Still open and captured:** nothing enforces that a new screen joins `WORKSPACE_SCREENS`, so a Task 6
screen added to the adoption surface but not to the spec recreates C-1 exactly. The implementer
identified this and did not build the closure.

**PR #2350 (the foundation: Task C, Task 1, Task 3) MERGED to `main` at 2026-08-24T15:49:29Z**, by the
owner's armed auto-merge once the checks went green. Two CI failures were fixed on the way, both mine:
a stale outstanding-issues snapshot, and five broken path references — two from Ruling 88's rename that
my own briefs still pointed at, one a quoted `tsc` diagnostic whose `path(line,col)` the link checker
read as a path, and a Task 5 brief describing work that PR did not contain.

### Task 5 scoped re-review — all ten ADDRESSED, three new Minors, one repeat

C-1's remedy was judged real rather than cosmetic: `openWorkspace()` is parameterised by screen so the
route-specific heading travels with it, and three of the four modes earn their category on evidence
only the new route can supply — a 48px tap-target measurement at 320px, a `borderTopWidth` read off an
element that exists only on Patients, and the heading under print media. Dark is the thinnest: its
load-bearing comparisons come from shell chrome identical on both routes, so it is substantively
Today's proof re-run on a second URL. Not a re-creation of C-1 — the route genuinely loads in dark —
but named and sent back.

**Ruling [94] — drop the client-component count; keep the conclusion. The replacement was wrong the
same way the original was.** "The workspace ships five client components in total" misses
`src/app/caring-contacts/error.tsx`, which is a Client Component because Next requires it, sits inside
the workspace by the very paragraph doing the correcting, and pulls a sixth client module
(`route-error-boundary.tsx`) into the route's bundle. The implementer had scoped its count to
`workspace/**`, which is defensible, but no site said so and "in total" forecloses it.

— Why drop rather than re-count: **this is the second time in two rounds that this one paragraph has
carried a false number**, and it is now replicated across three files exactly as "one" was. A count in
prose is a claim that decays whenever anyone adds a file, and nothing checks it. What actually carries
Ruling 13 is the module boundary — the dashboard cannot reach this workspace's chunks — which is true
independent of how many client components exist. — Cost if wrong: a reader loses a number that was
never reliable anyway.

**The generalisable shape: a fact that must be restated to stay true will eventually be false.**
Prefer the invariant over the tally.

**Three new Minors, each a different flavour of the same week's lesson:**

- **N-1** — the new null guard tests `=== null` while `auditedRead` treats **null or undefined** as
  denied. `released` is typed `T | null`, so the compiler cannot see the gap and the pinning test mocks
  `null` specifically. Fails closed either way, but with a `TypeError` rather than the stated message,
  and the branch the item is about would not be the one that fired.
- **N-2** — an absorbed contact and a transition-suppressed contact in the same plan disagree: the
  count subtracts all suppressed contacts, the explanation covers only absorption. Exactly the blur
  M-8 fixed, one case further along.
- **N-3** — `scheduled` changed its definition this round from absorbed-only to all-suppressed, and
  **nothing asserts that clinician-facing number**. Same shape as the implementer's own I-4 finding,
  and the same shape as the Ward Flow lesson where green tests missed a wrong value on every screen.

**The mutation ledger does not close, and that is worth more than the two missing lines.** Thirteen
claimed, eleven verifiable; two Vitest mutations are counted and never named. Every mutation the report
_describes_ was traced to an assertion reading the mutated value — the descriptions are sound. But
**a total that outruns its itemisation is the weakest form of the misdescription problem** this
programme has already met twice. Sent back to be named or corrected to eleven. Also flagged: M-6's
mutation raises the test's own threshold, so it proves the assertion executes rather than that the
floor detects anything — accurate as described, but not product proof.

**The reviewer answered the open enforcement question, and its caution is the valuable half.** A static
check comparing the adoption surface's `routes` against the spec's screen list is the right closure —
it converts the generator's _shape_ check into a _truth_ check, which is precisely C-1's lesson — and
is ~30 lines offline if scoped to this surface. **But it must not be generalised**: `ward-management`
declares 12 routes evidenced by generic contract suites that enumerate no routes at all, so a repo-wide
rule goes red immediately on surfaces nobody asked to remediate, and the pressure would then be to
weaken the rule rather than fix them. Opt-in marker, joined deliberately.

Task 5: fix round 2/5 dispatched — Ruling 94, the mutation ledger, N-1, N-2, N-3, and the dark-mode
assertion.

### Task 5 fix round 2 re-review — all six ADDRESSED, nothing new

Ruling 94's fix verified at all three sites, and the reviewer checked the replacement claim is
actually true today rather than taking it on faith — it grepped for imports of the workspace from
outside its own route segment and found none. It also grepped all three files plus `error.tsx` for a
reintroduced number and found none. One file says "a handful", which is deliberately vague rather than
a tally that can go stale; read as consistent with the ruling rather than a loophole.

**The ledger closed by dropping the total rather than forcing a reconciliation**, which the reviewer
read — correctly — as the same move Ruling 94 makes: every attempt is now a row, including the skipped
anchor-mismatch and the two that did NOT go red, and no aggregate is claimed. A reader who wants a
number adds it up themselves. That is the right way round: the itemisation is the evidence, the total
was only ever a summary of it.

**One of my instructions was overstated and the reviewer said so.** I asked for N-3's two mutations
"from opposite directions". Both — subtract-only-absorbed, and subtract-nothing — produce a count that
is too HIGH, so they are not opposite; they are two plausible wrong implementations of the same
definition. The practice is sound mutation method and the fix is right; my geometry was wrong. Recorded
because a controller's framing gets copied into later briefs if nobody corrects it.

The reviewer also traced the store invariant the N-2 fix relies on — that absorbed contacts always land
terminal-`suppressed` — back to `createPlan` in the in-memory store rather than accepting it as an
assumed invariant. That is the standard this programme keeps asking for and rarely has to ask twice.

**Task 5: COMPLETE (commits `efb84c556`..`6df257b35`, review clean after 2 fix rounds, 4 minors
deferred).** Playwright `38 passed`, up from 32 — the six new tests are the Critical finding's remedy.

**Ruling [95] — Task 5b's names-only read is its own repository method with its own capability check,
and that check reuses the existing `viewPatientRecord` rather than minting a new capability.**
— Why: the owner approved "a narrow read that returns just the name, permission-checked separately".
The substance he was buying is **data narrowing** — a caseload that no longer pulls mobile number,
identifiers and cultural identity for every row to show one field — and a separate projection delivers
that completely. A new capability would only buy something if some role should see names but not
records, and no such role exists: `viewPatientRecord` is granted at five sites covering the human
roles that can list plans at all. Minting `viewPatientName` would invent a permission tier nobody has
asked for, and every role's grant would have to be decided to satisfy the exhaustiveness guard.
— Cost if wrong: if a see-names-but-not-records role ever appears, the capability splits at that
point. The split is mechanical precisely because the read is already its own method — which is the
part that matters and is being built now.

**Stated plainly because it is a narrowing of my own words to the owner:** I said "permission-checked
separately", and separately means its own method and its own check, not a new capability. If he meant
a new permission tier, this is the sentence that will let him say so.

## Task 5b — the names-only projection, and the implementer improved on my ruling

Returned complete at `c6cd1ede8`. Full suite **`Tests 9985 passed | 74 skipped (10059)`, zero
failures**; Postgres suite `Tests 182 passed (182)`; typecheck and lint recorded passes. Twelve
mutation attempts itemised, eleven red, one (M7) not red — fixed and re-run red as M7b, with the
failed attempt kept in the table. No aggregate total claimed, per Ruling 94's shape.

**Ruling [95] is REFINED, and the refinement is the implementer's.** I ruled the read reuse the
existing `viewPatientRecord` rather than mint a capability. It honoured that — no new capability
exists — and then found the hole my ruling left open:

`READ_ACTIONS.plan` is `"viewReferral"`, and that is what gates listing plans at all. The **auditor**
holds `viewPatientRecord` but NOT `viewReferral`. So on `viewPatientRecord` alone, `listPatientNames`
would have handed the auditor **an enumeration of every patient name in the team** — obtainable by no
route that exists today. **A change whose entire purpose is narrowing would have widened auditor
access.**

`PATIENT_NAME_READ_ACTIONS` is therefore an ALL-of list, `[READ_ACTIONS.plan,
READ_ACTIONS.patientName]`, and the reasoning is not arbitrary: the projection **enumerates** the
team's plans, so it must release a name only for a plan the actor could already see. The in-memory
implementation filters by exactly `listPlans`' predicate and then by the name capability on top, so
the result is always a subset of the plans that actor can already list. It also builds the returned
objects rather than deriving them from the stored plan, "so no widening can ride along by accident:
there is no spread of `patientDetail` to forget to narrow."

**What I take from this about ruling.** My ruling answered the question I had asked myself — "does
this need a new capability?" — and was correct on it. It did not ask the adjacent question: "what
does the capability I am reusing already grant, to whom?" A ruling scoped to the question that
prompted it can be right and still leave a hole, and the implementer nearest the code is the one
positioned to see it. **Rulings should be written to be improvable, and an implementer that says "you
may want to overrule this" should be read as doing its job rather than hedging.** Upheld as built.

**A STALE STANDING INSTRUCTION, corrected — and it was mine.** I have been telling every subagent to
"expect exactly 2 failures in `tests/gate-receipts.test.ts`". Those failures are **gone**: the merge
from origin brought `cbde6ecbb` "Make the gate-receipt tests environment-explicit so they pass under
CI", and the file now runs `Tests 34 passed (34)`. This implementer noticed the prediction did not
match reality and said so.

The hazard is not the wasted sentence, it is the direction it points: **an instruction to expect a
named failure tells a reader to look past a file that can once again fail for real.** A standing
"known noise" note is a licence to ignore, and it must expire the moment the noise does. Removed from
the briefs and corrected in durable memory.

**Two concerns carried to review rather than settled here:** a row cannot distinguish "de-identified"
from "your role may not see names" — it states the kind of thing the heading is and claims nothing
more, which is conservative but may not be enough; and `patientDirectory` now names two different
reads in the access trail, distinguishable by `objectId` but not by action name.

### Task 5b fix round 1 — browser gate

`npm run test:e2e -- tests/ui-caring-contacts-workspace.spec.ts --project=chromium` against the fix
tip: **`38 passed (1.0m)`**, exit 0, zero failures. The fix round changed a Server Component's reads
and a role notice; the journeys are unaffected, which is what the gate says rather than what I
assumed.

## Rulings 96-99 — Task 6, the Patient overview

**Ruling [96] — the first-contact-date CONTROL belongs to the activation screen, not this one; the
DISPLAY belongs here.** — Why: the plan routes design correction #1 to Task 6, but spec section 2.3's
own Consequences sentence says "the review-and-activation screen gains a first-contact-date control",
which is Tasks 7-9. The spec is the binding authority and it names a different screen. Task 6 shows
the first contact date and, when it is not the default, its recorded reason in place (section 4.4
explained automation). — Cost if wrong: the control lands one task later than the plan said. Nothing
is built twice, and the same fact is still surfaced here, so the cost is ordering only.

**Ruling [97] — the overview is scoped to ONE plan and never chooses which.** — Why: the route is
patient-keyed (`patientRoute(patientId)`, already the href Task 5 reserved) while `getEpisode` and
`getPlan` are plan-keyed, and one patient can honestly hold two episodes -- `repository.ts` says so
and `markRetentionCleared` clears detail per plan, so two plans for one patient can differ in what
they still hold. Zero plans gets an honest empty state rather than a 404, because a 404 would
distinguish "another team's plan" from "no plan", which `getPlan` deliberately refuses to do. More
than one plan gets a chooser, and the chooser takes its name from `listPatientNames`, so `getEpisode`
is reached exactly once and only for a determined plan. — Cost if wrong: one extra click in the
multi-plan case, which is rare. The alternative -- silently picking a plan -- would render one plan's
schedule under a heading carrying the patient's name, and that is the error that matters here.

**Ruling [98] — the contact count is derived from the schedule, never written as a literal.** — Why:
the approved mockup hard-codes `"10 contacts over 12 months"` and `aria-label="Ten-contact
continuity"`, and both are wrong. `schedule.ts` builds ten cadence entries (Day 1, Week 1, months 1,
2, 3, 4, 6, 8, 10, 12); Week 1 carries `suppressed: { reason: "absorbedByFirstContact" }` exactly
when the first contact was set to discharge + 7, giving **nine** sendable contacts in that case only
(design correction #4 is conditional, not a new fixed number); and Month 12 is `messageType:
"closing"`, a distinct kind (design correction #3). A suppressed contact is the system acting on its
own, so section 4.4 requires the reason stated in place. — Cost if wrong: a screen that states a
count it did not measure, on a clinical caseload -- which is the exact defect `ListEmptyState` was
built to prevent, reappearing one screen later in numeric form.

**Ruling [99] — Task 6 wires the directory row control, because it is the destination that makes it
available.** — Why: `patients-directory.tsx` renders each row's detail control as
`UnavailableDestination` under Ruling 52 (an unbuilt destination is an unavailable control with a
stated reason, never a link into a 404), and its own comment names swapping it for
`<Link href={patientRoute(...)}>` as the whole of the later change. Without the swap the new route
has no inbound link and the orphan-route gate fails the build. — Cost if wrong: if the swap turns out
not to be the whole change, the reachability gate says so before merge rather than after.

### Task 5b scoped re-review — all eight ADDRESSED, one new Important, two new Minors

Every finding from the task review was verdicted ADDRESSED, and the reviewer checked the mechanism
rather than the claim in each case: it confirmed `PLAN_COLUMNS` really does carry
`patient_mobile_number` and `patient_identifiers` and that `listPlans` really does select it verbatim
(so I-1's qualification is qualifying something true), and it traced the new `"patientName"` object
type end to end — the store boundary's type, both stores' equality filters, the route's hand-written
enum, and the absence of a CHECK constraint on `audit_events.object_type` — before agreeing the
distinction is genuinely askable and no migration is owed.

**On the unreachable role notice: shipped, and it is not the governance failure it resembles.** The
distinguishing test the reviewer applied is the right one, and it is worth keeping. A governance
artifact fails when it CLAIMS something untrue. This one claims the opposite: it documents its own
unreachability at the branch, in the report, and in a test that supplies the prop directly. It cannot
fire wrongly because nothing infers it from data — its only input is a capability call. And the
alternative is worse: were such a role ever granted, a caseload of identifier-headed rows would
render with no explanation at all, which is the silent-wrong the whole empty-state programme exists
to prevent. A written-ahead contract, not debris.

**On the four-hour lock refusal: the judgement was right and I want it copied.** The implementer was
refused the exclusive Vitest lease for about four hours by another worktree's Chromium lease, retried
rather than forcing, did the cheap read-only work in between, and pasted the real Vitest line when
the run finally happened. Forcing would have bought a table row at the cost of possibly flaking
another worktree's run. **`ADMISSION_BUSY` has its own exit code precisely so it is not read as red.**

**Ruling [100] — I fixed the new Important myself rather than spending a fix round.** — Why: it was
three sentences of documentation drift in `task-5b-report.md` and one stale positional count in a code
comment, with no behaviour attached; a full round plus scoped re-review would cost two dispatches to
change prose I can change correctly in one edit. — Cost if wrong: the corrections are mine and
unreviewed, so an error in them would carry my name rather than an implementer's. Recorded here so
that is visible.

What the Important actually was, because it is the most instructive finding of the task: the report's
"What was built" section still asserted, in the present tense, the access identity that fix round 1
had REPLACED — 160 lines above the round-1 section that recorded the replacement correctly. **The
document asserted a fact and its contradiction at the same time.** That is finding I-2's exact shape
— a correction landing without the sentences that depended on it — reproduced in the governance
artifact rather than in the code, in the very round that fixed it in the code. Two smaller instances
of the same drift sat beside it (the unqualified "never fetched into the process at all", and the
auditor still named as the sole role holding `viewPatientRecord` without `viewReferral` when M-8 had
corrected it to three). All three are now corrected in place, each saying what it used to say and
which finding moved it.

**The lesson, and it is a new one.** Ruling 94 said a fact that must be restated to stay true will
eventually be false. This adds the corollary: **the artifact describing a fix is subject to the same
decay as the thing fixed, and it decays in the same round.** A fix round updates the code and appends
its own section; nothing sweeps the earlier prose that the fix falsified. From here, a fix round's
report must re-read its own "What was built" section against what the round changed — and the scoped
re-review should verdict that as well as the code.

**Task 5b: complete.** Full suite `Tests 9990 passed | 74 skipped (10064)`; Postgres contract
`Tests 182 passed (182)`; typecheck and lint clean; browser gate `38 passed (1.0m)`.

**Deferred from Task 5b to the whole-branch review, not dropped:**

1. Narrow `listPlans`' column list so the mobile number and identifiers are never fetched for a list
   read — filed in the inbox, P2.
2. Patient names reaching the URL through the GET search form — filed, P2; needs an owner decision
   before any deployment with real names.
3. A contract test pinning `access-trail/route.ts`'s hand-copied `z.enum` to `AccessedObjectType`. A
   subset still typechecks, so a future member added to the union and forgotten in the route is
   silently unaskable — the exact defect I-3 identified, one sync point later.
4. Two membership claims stated where the property would hold (the notice's "a coordinator sees the
   names", and `repository.ts`'s `getEpisode` equivalence). True today; both decay.
5. Concern 2 stands: a row still cannot distinguish "de-identified" from "your role may not see
   names", and the notice only makes that inference sound at the page level.

**Task 6 dispatched**, BASE `fa7f8ac98d12ef7c9c2a632101100712972483af`. Brief: `task-6-brief.md`.

### Task 6 browser gate

`npm run test:e2e -- tests/ui-caring-contacts-workspace.spec.ts --project=chromium` against `6d79a8432`:
**`43 passed (1.6m)`**, exit 0, zero failures. Up from 38, and the five added are the overview
screen's own describe block — that is the whole of the increase.

**I wrote a wrong sentence here and caught it before it set.** I first recorded that the third
`WORKSPACE_SCREENS` entry "carries the existing accessibility-mode and service-stop proofs onto the
new route". It does not. Those suites name `TODAY_SCREEN` and `PATIENTS_SCREEN` as literals; nothing
iterates the array. Five new tests is exactly one new describe block and nothing else, and the
arithmetic said so before I checked the code — a third screen joining six-width parameterised suites
could not have cost five tests.

So `WORKSPACE_SCREENS` is a **registry, not a driver**: joining it proves nothing by itself. That is
the silenced-gate hazard its own comment warns about, one level deeper than the comment describes —
a screen can be listed there and still be visited by no accessibility-mode or service-stop proof.
Carried to the Task 6 review rather than settled here.

### Task 6 task review — PASS with one material shortfall; one Critical, three Important, four Minor

Spec compliance PASS: route hygiene complete (inbound link, sitemap, codebase index, reachability
assertion), no new client boundary, service-state `note` never crosses to a Client Component,
`getEpisode` called from exactly one site, no hex, no `min-h-11`, no prohibited vocabulary, no path
literals. Quality high: the mutation ledger was called genuinely good work and both gates the
implementer caught itself were independently re-derived as really closed.

**The Critical, and it is the instructive one.** The screen's schedule summary derived sendability as
"entries minus those whose state is `suppressed`", so **every other non-sendable terminal state
counted as sendable**. A withdrawn plan, or one stopped by a recorded death, renders `10 entries, and
every one of them will be sent.` directly above ten rows each reading "Caring contact · Cancelled".
On a suicide-prevention screen. `cancelled` is reachable today by ordinary store writes
(`cancelAllNonTerminalContacts` from `withdrawPlan` and from `recordHospitalStatusEvent`), and
`missed` is non-sendable too.

**What makes it worth recording is HOW it happened.** The implementer saw the rule "a screen must
never re-derive a rule a module already owns", reasoned about it explicitly, found a genuine defect in
the module's number (`EpisodeCounts.contactsScheduled` keys off `planned.suppressed`, so it overstates
a transition-suppressed plan — confirmed), and departed from the rule on that basis. The direction was
right. The replacement predicate was **narrower than the true one and wrong on a path the domain
reaches today**, while the module's number is only wrong on a path nothing reaches yet. It traded a
latent error for a live one. **Seeing the rule and reasoning about it is not the same as being
protected by it** — the protection is in putting the predicate where the domain can be held to it, not
in deciding carefully where to put a copy.

No test covered it, and no mutation would have found it, because no assertion read that path. That is
the same fact stated three ways.

**Ruling [101] — the sendability predicate goes in the sealed domain, and `EpisodeCounts` does not
change meaning.** — Why: the fix must not be a second copy in the screen, and it must not be a silent
redefinition of a number other code may already read. A new named export deriving the non-sendable set
from the contact state machine in `model.ts` satisfies both; the screen consumes it. — Cost if wrong:
one more domain export to keep honest. The alternative — editing `contactsScheduled` in place — would
change a value's meaning under every existing reader without any of them being reviewed.

**Ruling [102] — extend the brief to cover cancelled and missed rows with a stated reason.** — Why:
Ruling 98 named only suppression, so a row reading "Caring contact · Cancelled" with nothing beside it
is within the letter of the brief and is exactly the bare-status-chip shape spec section 4.4 exists to
prevent. Shipping the count fix without it leaves the row still unexplained, and the same edit touches
both. — Cost if wrong: a slightly wider fix round than the finding strictly required.

**Ruling [103] — correct the false coverage comment now; parameterise the suites as separate work.**
— Why: the spec file's comment now claims the accessibility-mode proofs "run against every screen on
the surface". They do not — those suites name `WORKSPACE_ROUTE` and the `TODAY_SCREEN` default as
literals and nothing iterates `WORKSPACE_SCREENS`. A false claim is fixed immediately; making it TRUE
by parameterising is the right eventual fix but the service-stop test asserts `maxOffset >
bannerTravel` and would fail on a short empty-state page, which needs deliberate handling rather than
a fix round. — Cost if wrong: the gap stays open one task longer, on a surface where it has been open
since Task 5 and is not a Task 6 regression.

**Ruling [104] — the synthetic caseload is out of scope, and the consequence is stated rather than
implied.** — Why: the plan's own "Deliberately NOT in Phase 2B" section gives the synthetic caseload
to Phase 3. The reviewer ranked seeding one above parameterisation as the single highest-value change,
because it would fix the Critical's testability, the short-page problem, and the jsdom-only gap at
once. It is still Phase 3. — Cost if wrong: **every Phase 2B screen's populated state is proved in
jsdom only, and that is a structural property of the phase rather than any task's shortfall.** Said
plainly here so the final review does not discover it as news.

**The scope correction that matters, and it cuts the other way from my own finding.** I reported to the
reviewer that the new screen might be reached by fewer browser proofs than the two beside it. It is
not: neither parameterised suite has EVER covered `/caring-contacts/patients` either, and Task 6
achieved exact parity with Task 5 — five browser tests each. The real gap is workspace-wide and one
screen wider than before, not a regression. **My finding was right about the mechanism and wrong about
the blast radius**, and the direction of the error is the one worth noticing: I framed a pre-existing
hole as a new task's shortfall. Checking whether the thing I found was already true would have cost one
grep.

**Deferred from Task 6, filed rather than dropped:**

1. `EpisodeCounts.contactsScheduled` keys off `planned.suppressed` and overstates a
   transition-suppressed plan. A real domain bug, found by the implementer. Own change, own blast
   radius.
2. Parameterise the accessibility-mode and service-stop suites over `WORKSPACE_SCREENS`, turning the
   registry into a driver so a future entry carries coverage automatically. Caveat: the service-stop
   assertion needs seeded content or an explicit stated skip on a short page — not a silent pass.
3. The first-contact reason is validated and then discarded — no `StoredPlan` field, no
   `caring_contacts.plans` column, in either store. Needs a field, a column, a migration and both
   stores. **Owner decision.**
4. The patient's mobile number is released by `getEpisode` here and deliberately not displayed.
   **Owner decision**, one line either way.

## Owner decisions, 2026-08-25 — both deferred Task 6 questions answered

Put to the owner in plain terms with a recommendation and a cost on each. Both answered the same day.

**1. Store the reason a first contact date was moved — APPROVED.** This closes the gap behind Ruling 96. The system currently refuses a non-default first contact date without a reason and then discards
the string: no `StoredPlan` field, no `caring_contacts.plans` column, in either store. The owner's
reasoning matched the recommendation — a reason you demand and then throw away is worse than not
asking, and it leaves nobody able to review why dates were changed. Becomes **Task 6b**: a field, a
column, a migration, both stores, the shared contract, and the screen's display. Migration goes in
`caring-contacts/supabase/migrations/`, **never** `supabase/migrations/` — the Clinical KB project is
not this workspace's database.

**2. Display the patient's mobile number on the patient overview — APPROVED, and this OVERRULES my
recommendation.** I recommended leaving it hidden: nothing on the screen needs it, and every place a
number appears is another place it can be read over a shoulder. The owner decided to show it. Folded
into the Task 6 fix round already in flight, with requirements attached so it does not become a second
decision — identity strip rather than a buried row, taken from the `Episode` already read (no new
read, no widened read, and no licence travelling to any other screen), cleared-value handling matching
the cleared-name path, labelled as synthetic, and **not** a `tel:` link.

**Recorded because the direction matters.** This is the owner overriding a privacy-conservative
default, deliberately and on the record, not a default drifting open because nobody looked. The
implementer flagged it rather than deciding silently, which is what made the question reachable at
all — the decision existed to be made because someone declined to make it quietly. If it is ever
revisited, revisit it as a decision, not as an oversight.

## Rulings 105-108 — Task 6b, storing the first-contact reason

**Ruling [105] — the reason never reaches `PlanRecord`, and retention clearance must clear it.** —
Why: `PlanRecord` is what `listPlans` returns and what the caseload renders for every patient in the
team, so a free-text clinical note keyed to a patient must not be fetched for a list screen — that was
Task 5b's whole argument. And the clearance point is the one most likely to be missed and the one that
matters clinically: the reason is prose a clinician wrote, and a real one says things like "patient
asked to wait until she is home from her sister's". `CLEARED_PATIENT_DETAIL` blanks four fields and
would not touch a fifth added elsewhere, so a de-identified record would keep identifying prose.
Pinned in the shared contract suite, with the clearance deliberately broken to prove the test goes
red. — Cost if wrong: if the field's shape turns out to need to sit inside `patientDetail` after all,
that is a smaller change than the alternative; but a clearance that silently misses it would leave
identifying free text in a record the system reports as de-identified, which is the failure this
ruling exists to prevent.

**Ruling [106] — cap the reason's length, refuse rather than truncate.** — Why: it is unbounded free
text going into a database column, and a clinical reason cut off mid-sentence can invert its meaning.
The refusal gets its own identifiable reason, matching the shape `first-contact-reason-required`
already has. — Cost if wrong: a cap set too low irritates; it is one constant to change. A silent
truncation is not recoverable, because nothing records that it happened.

**Ruling [107] — the write path exists; do not build a second one.** — Why: the plans POST schema
already accepts `firstContactDate` and `firstContactReason` and `schedule.ts` already validates the
pair (Ruling [86]). The change is to stop the reason being dropped between validation and the store.
— Cost if wrong: if schema and store disagree, that is a finding to report, not a third path to
invent. Ruling 86's own lesson was that this programme has twice nearly built a second implementation
of something that already worked.

**Ruling [108] — the screen states what is held, and an old plan's missing reason is its own fact.** —
Why: with storage there are three cases, not two — default date (no reason required), moved date with
a stored reason (show it in place, spec section 4.4), and moved date with none stored because the plan
predates the column. That third case is real and will persist. **Do not migrate a placeholder string
into old rows to make the screen simpler.** — Cost if wrong: an extra sentence on a rare state. A
fabricated reason on a clinical record is not comparable.

**Task 6b brief written** at `docs/caring-contacts/phase-2b-sdd-archive/task-6b-brief.md`. Not
dispatched yet — Task 6's fix round is still in re-review and this worktree runs one implementer at a
time.

### Task 6 scoped re-review — all five ADDRESSED, no new Critical or Important

Browser gate on the fix tip: **`43 passed (1.1m)`**, exit 0, zero failures. **Task 6: complete.**
Full suite `Tests 10019 passed | 74 skipped (10093)`; typecheck and lint clean.

The reviewer verified each mechanism rather than each claim: it counted the `ContactState` union at
eleven members and confirmed the new switch covers all eleven with a `never` default; it read the
load-time assertions and confirmed they can actually fire; it confirmed `EpisodeCounts` is untouched
by checking `episode.ts` is absent from the diffstat; and it rendered all four schedule sentences.

**Three things it found that the implementer's own report did not say, all worth keeping.**

**1. The C1 guard is complete by two mechanisms, not one.** `missed`, `scheduled` and `processing`
are in neither `TERMINAL_CONTACT_STATES` nor `DISPATCHED_CONTACT_STATES`, so misclassifying `missed`
would **not** trip the load-time assertion. That hole is covered by a DOM test instead, and mutation
R1-M3 is exactly that mutation going red. The coverage is real; the single-mechanism story the
assertions imply is not. A guard that covers part of a union reads as though it covers the union.

**2. One new fixture pins a branch no store write can reach.** "A cancelled contact on a
still-running plan" is unreachable: every `{type:"cancel"}` travels with a plan transition to
`cancelled` or `withdrawn`, and `applyDeathCorrection` deliberately leaves the plan cancelled. The
branch is right to have and the fallback text is truthful, but the report's framing that these tests
are store-built over-claims by one case. Recorded because it is the same shape as Task 5b's
unreachable role notice — and gets the same answer, for the same reason: it documents nothing false
and it cannot fire wrongly.

**3. The mutation ledger's honesty is structurally checkable, and nobody said so.** An unmatched
anchor produces a **green** line, never a red one. Every attempt except two reported RED with a
specific failure count, and a red result is itself proof the mutation was in the tree. So the two
non-red outcomes are the only two that needed accounting for, and both were accounted for. **That
argument turns "did the implementer report its misses honestly?" from a matter of trust into
arithmetic**, and it should be made every time rather than rediscovered.

**On R1-M2 — "the module won't load" is legitimate evidence, and refusing to score it RED was the
right instinct.** Classifying `cancelled` as still-to-send trips the load-time assertion, so the
module cannot import. That is strictly stronger than a red test for that state — a build carrying the
error cannot start. But it proves a different proposition than the mutation's heading claimed, and
the ledger said so rather than laundering it. R1-M3 is a valid control.

**On the lock refusals — scoping correct, one evidence gap to close next time.** It terminated only
its own orphaned run and retried rather than forcing past another worktree's Playwright lease.
Killing the other worktree's process would have been the violation and it did not. **The gap: it
established the orphan was its own from a live PID with a live child, but never checked the process's
working directory against this worktree.** Given this repository's history of cross-worktree
destruction, ownership should be proved, not inferred. Carried into future briefs.

**Deferred from Task 6, added to the list already carried:**

5. The "cancelled on a still-running plan" branch is unreachable through any store write — keep it,
   but say in a comment that it is defensive so a future reader does not go hunting for the path.
   **Folded into Task 6b**, which touches that file.
6. A one-entry plan would render "1 entry, and none of them will be sent." — "them" against a
   singular. Every schedule is ten entries so it is unreachable, and a guard for an unreachable
   grammatical case is not worth the line today. Recorded, not fixed.

**Task 6b dispatched**, BASE `6fc194039d3bbd3849339472540f8ae628e313f1`. Brief: `task-6b-brief.md`.

### Task 6b browser gate, and the migration location checked by me

`npm run test:e2e -- tests/ui-caring-contacts-workspace.spec.ts --project=chromium` against
`22d6073f6`: **`43 passed (1.1m)`**, exit 0, zero failures — unmoved from the Task 6 tip, which is
what the implementer predicted and gave its reasoning for. A prediction with reasoning attached is
worth more than a guess, and running the gate anyway costs a minute.

**I verified the migration's location myself rather than waiting for the review**, because it is the
one mistake in this task that would be expensive: `git diff --name-only` shows
`caring-contacts/supabase/migrations/0005_caring_contacts_first_contact_reason.sql` and **nothing
under the repository root's `supabase/`**. That root directory replays against the live Clinical KB
project `sjrfecxgysukkwxsowpy` and merging to `main` applies it there within seconds; a
caring-contacts migration placed there would reach a live clinical database. Clean.

The migration itself refuses a backfill in writing and says why: a placeholder such as "not recorded"
would put a fabricated sentence on a clinical record and make it indistinguishable from one a
clinician typed. It is nullable with no default, transactional, replay-safe, and carries a
`comment on column` recording the clearance obligation — so the obligation travels with the schema
rather than living only in a test.

### Task 6b task review — spec compliance PASS, quality GOOD, two Important and three Minor

The reviewer verified the two highest-risk items itself before anything else, and both hold. Clearance
is real in all three places rather than only in the suite: the in-memory store spreads
`CLEARED_PATIENT_DETAIL` whole, the Postgres store sources its `first_contact_reason = $5` from that
same constant, and `CLEARED_PATIENT_DETAIL` is now typed `StoredPatientDetail` so **omitting the field
stops the module compiling**. `DeidentifiedEpisode` is an explicit literal rather than derived from
`Episode`, so the field cannot leak into a de-identified projection structurally, and the retention
test pins it at runtime with a content grep. The migration is in
`caring-contacts/supabase/migrations/` and the repository root's production-deploying directory is
untouched — checked independently by both the reviewer and me.

**I-1, and it is the finding worth carrying forward.** The `PLAN_COLUMNS` guard — this task's best
work — was installed in `tests/caring-contacts-postgres-repository.test.ts`, which is in
`caringContactsDbTestFiles` and **unconditionally excluded from the offline `node` project**. And
`grep -rn "caring-contacts" .github/workflows/` returns **zero hits**: CI never runs the caring-contacts
database suite at all. So the guard holding the narrowing that this task's headline finding is about
fires only when a human happens to have Docker Postgres running. The guard needs no database — it is
a `readFileSync` and a regex.

**This is "a check that cannot fail" arriving one step later than usual.** The usual shape is a guard
whose assertion is vacuous. This one's assertion is sound and its positive control is not vacuous —
the reviewer verified that a rename or deletion of `PLAN_COLUMNS` goes red rather than passing by
matching nothing, which is exactly how this class of scan normally fails silently. **The guard is
correct; it is the runner that cannot reach it.** Worth stating as its own failure mode: _where a
check lives decides whether it exists._

The second half of that — that the **rest of that database project** never runs in CI either,
including every row-level-security and cross-team assertion the shared contract makes against real
SQL — is bigger than this task and is filed.

**No count here, and the reason is a correction against me.** I first wrote that sentence with a test
count in it, and filed an issue record carrying the same count. Moving the guard to the offline
project changed it by one **inside this same branch**, so both were true when written and false before
the issue record could be reconciled. The record's summary also double-counted, naming the guard
separately from a total that already contained it. Cancelled (`9b9b8f4f`) and re-filed stating the
invariant (`b2e5f3fc`).

**Ruling 94, written by me, broken by me, inside one round — and in the one artifact that is durable
cross-session memory.** The build record is at least read next to its own corrections; an inbox record
is reconciled into the canonical ledger as written and outlives everyone who could remember what it
meant. If a count must not go in prose, it must **especially** not go in a record that will be copied
somewhere else months later.

**On the length cap's duplicated literal: the cited precedent is real but NOT symmetric, and the
asymmetry is the whole argument.** `plan_assignments_coverage_is_calendar_days` does hardcode a
pattern duplicating `CALENDAR_DAY_PATTERN`, so the pattern is established. But the calendar-day
TypeScript check is _strictly stricter by construction_ — it also rejects `2026-02-30` — so drift
there can only make the SQL redundant. Here it is the other way: raising
`FIRST_CONTACT_REASON_MAX_LENGTH` without the SQL converts a **named refusal into a raw constraint
violation on a clinical write**. A scan is owed. **"There is precedent" answers whether a pattern is
novel, never whether it is safe.**

**On the format disclosure, which lands on its own axis.** The implementer disclosed writing "format
changed nothing" after reading `git status` while Prettier was still running, corrected it, and re-ran
two mutations against the formatted tip. The reviewer checked and the **ledger is sound** — the
reflowed hunk sits below M9's anchor and no other mutation touches a formatted file. But the sentence
explaining _why_ the re-run was sufficient is false: Prettier touched three files, and
`patient-overview.tsx` carries two mutations, M9 and M10, of which only M10 was re-run or mentioned.
**A disclosure whose moral is "check the claim rather than assert it" contained an unchecked claim.**
That is not hypocrisy, it is how hard the habit is; recorded because noticing it in someone else's
disclosure is much easier than in one's own.

**Also filed:** carrying `retention_state.cleared_at` onto `Episode` so the screen stops inferring
clearance from a blank patient name (`7ab6b272`, P3). The reviewer traced why the inference is sound
today and why it is worth closing anyway: the guarantee lives in a Zod schema at the API edge, not as
a domain invariant — `createPlan` does not validate it and the column permits `""` — and this task
made a second statement depend on it.

### A process failure that was MINE, again, and it is the same family as the last one

**My commit `15559437f` contains 23 lines of the implementer's SQL migration change, and its message
says nothing about it.** I ran `git add -A` to commit a ledger entry and two issue-inbox files while
an implementer was working in this worktree with an edit uncommitted. The change is correct and the
implementer disclosed it; the defect is mine. The result is a commit whose message is false about its
contents, and an implementer's own commit table that is one commit narrower than reality through no
fault of its own.

**The rule, and it is the sibling of the one already recorded here.** Phase 2B already carries "never
switch a worktree's branch while a subagent is working in it". This is the same hazard through a
different door: **never `git add -A` while an implementer is working in the worktree.** Stage explicit
paths. The controller and the implementer share one working tree, and every wildcard the controller
types can claim the implementer's uncommitted work.

**Not rewritten.** The commit is two commits back with an implementer live in the tree; rebasing to fix
a message would be a larger risk than the wrong message. Recorded here instead, which is where a
reader looking for what happened will be.

**Related, and left alone deliberately.** The implementer hit the PR-babysit stop hook — its `Monitor`
call was denied — and suggested clearing the marker. I checked: the marker is **not stale**. Its
session id is this session's, and this session did open PR #2350 on 2026-08-24 at 22:42; the 30-minute
budget expired long ago and the hook is doing exactly what it was built to do. It is over-broad — it
denies `Monitor` for a purely local test-gate wait, which is the gap `docs/pr-handoff-stop-cross-agent-gap.md`
already names — but **deleting a safety marker to make an unrelated wait more convenient is not a
trade I will make unasked**, and the implementer completed the wait without it. Left in place.

### Task 6b fix round 1 browser gate

`43 passed (1.1m)`, exit 0, unmoved. The implementer predicted no movement and gave its reasoning
(two test files, one SQL check expression, one migration comment; no rendered output). Second
prediction it has made about this gate and second time it held.

### Task 6b scoped re-review — all six ADDRESSED, no Critical, no Important

Browser gate `43 passed (1.1m)`, exit 0. The reviewer verified each mechanism rather than each claim:
it executed both cap regexes against the real files, confirmed the moved guard is collected by the
default `npm run test`, and confirmed the constraint name occurs exactly twice in the migration so
M18's rename genuinely kills the match and fails with "expected undefined to be defined" — the
positive control firing, not the scan passing on an empty match.

**It also reconciled the test arithmetic from both sides**, which is the right way to check a claim
that a count moved for a benign reason: the database project lost one case and the offline suite
gained three — the moved scan, the new cap scan, and the I-2 case — with skips unchanged. Nothing was
lost. That is a stronger check than reading either number alone, and it is worth copying.

**Two of the three new findings were mine.** The count above is one. The other is the deferred anchor
weakness below, which is the implementer's but which I am treating as worth fixing rather than
filing.

**The residual worth carrying about lease evidence.** The implementer identified an orphaned run as
its own from `scripts/test-run-lock.mjs`'s lease record, which does carry
`worktree: path.resolve(projectRoot)` — so it read a recorded working directory rather than inferring
from a PID, which is what the standing requirement asks. The reviewer's addition is the useful part:
a recorded `worktree` plus `processIsAlive(pid)` is still weaker than reading the live process's cwd
from the OS, and a stale lease plus PID reuse would defeat it. **It did not matter because the only
action taken was to wait — and that same evidence would not have justified breaking the lease.** The
strength of evidence required scales with the destructiveness of what is done with it. Carried into
future briefs.

**Sent back as fix round 2 rather than filed: the cap scan's SQL anchor.** The regex anchors on the
first occurrence of the constraint name — the `where c.conname =` existence guard, not the constraint
body — then takes the first `<=` after it. A future edit inserting any other numeric `<=` between
those points makes the scan read the wrong literal and agree with the TypeScript constant while the
real cap has drifted. The positive control does not cover it: it proves _a_ number was found, not
that it is the cap's. This is the same shape as the finding that started the task — a scan correct
today that cannot stay correct by construction — which is why it is worth a round rather than a row.

### Task 6b round-2 re-review — both ADDRESSED. **Task 6b: complete.**

The reviewer re-derived M20 itself rather than trusting the transcript — applied the mutation in
memory, ran both regexes over the same mutated bytes, and got the reported line byte for byte. It
also confirmed the old anchor is fooled _only_ when the inserted `<=` falls between the name's first
occurrence and the constraint body, which is exactly what the report claimed: **precise rather than
overstated**, and worth noticing as its own quality, since a report that overstates its own defect is
as unreliable as one that understates it.

**The comment stripper survived a hard look, and fails closed where it fails.** A `--` inside a
string literal _is_ wrongly removed — the reviewer confirmed it by injecting one — but it cannot
produce a false green: in the one place truncation could reach the cap it deletes the `<=` and trips
the "both literals found" control. The repo's existing `CREATE INDEX CONCURRENTLY` scan carries the
identical limitation, so this is consistent with the standard rather than a new weakness. And the
stripping's own control is deliberately built so a stripper that removed the markers but not the text
would still be caught.

**Playwright deliberately skipped this round, and the skip was checked rather than assumed.** The
reviewer diffed the migration's _executable_ content across the round — with `--` comments and blank
lines removed, the SQL is byte-identical to `5b6b7d21e`. One test file, prose, and Markdown: zero
schema delta and no rendered output. Recorded as a reasoned skip, not a pass.

**The one finding, and it is Ruling 94 for the third time today — travelling through me.** The report
read "the two intentional survivors … and both are labelled as such" above a table containing exactly
one. **I then inherited the "two" into the re-review brief without checking it against the table.**
Corrected at its own site with a note saying so.

**What the third instance teaches that the first two did not.** The first was a count that went stale;
the second was a count in a durable record. This one was **false on arrival and adjacent to its own
disproof** — the table was directly beneath the sentence. It still propagated, because I copied the
prose rather than reading the table. So the rule needs a second half:

> Do not restate a count in prose — **and do not carry one forward from a document you are
> summarising without recounting it at the source.** A count inherited is a count unverified, and a
> brief is exactly where an unverified one acquires authority.

## Owner decision, 2026-08-25 — the activation wizard keeps its in-progress answers in the browser

Put to the owner before Task 7 was written, because the three ways to carry a half-finished sign-up
across four steps differ in where a patient's name and mobile number end up, and that is not a
technical preference.

**The question:** a clinician signing a patient up goes agreement → pathway → personalisation →
review. If interrupted partway, what happens to what they typed?

**The answer: keep it in the browser, and it must survive a page refresh** — cleared when the tab
closes. Rejected: discarding it on interruption (my recommendation), and saving a draft server-side.

**I asked twice, because my first description of the chosen option was wrong.** I labelled it
"nothing is stored". That is true only of in-memory component state, which dies on refresh — and the
owner's own words, "vanishes when they close it", describe `sessionStorage`, which **writes the
patient's name and mobile number to disk on the clinician's machine**. Those are materially different
privacy properties on a clinical system, and the difference was created by my wording, not by
anything he said. Put back to him plainly with the exposure named — a shared ward computer — and he
chose the storing version knowingly.

**The rule that produced the second question, and it is worth keeping.** An owner's answer is only
as good as the description of the option. When a choice is made against a label that turns out to be
inaccurate, the decision is not theirs yet — it is mine, wearing their name. **Re-ask.** The cost is
one exchange; the alternative is patient details written to a ward machine on my say-so and his
signature.

**Ruling [109] — the wizard gets a Client Component, and it is the first deliberate one.** — Why: the
owner's decision requires state that survives a refresh, which cannot be done from a Server Component
or from URL parameters. And URL parameters are independently forbidden here regardless of the
decision: `plans/route.ts` already records why — "the patient's name and mobile number travel in the
BODY, never in the URL — a query string is logged by every proxy between here and the browser."
Ruling 13 holds this workspace's client payload to a rounding error, not to zero; Tasks 5 and 6
achieved zero because a list screen genuinely needs none, and a four-step data-entry form is a
different thing. — Cost if wrong: the wizard's chunk is the workspace's largest client payload. It is
one route, loaded only by a clinician starting a sign-up, and it must not pull the rest of the
workspace in behind it.

**Ruling [110] — `sessionStorage` only, cleared on both exits, and the clinician is told.** — Why:
`localStorage` outlives the tab and would leave patient details on a shared ward computer
indefinitely; the owner chose tab-lifetime, not permanence, and the storage API must enforce that
rather than a comment promising it. The draft must be cleared explicitly on successful activation
**and** on abandoning the flow — relying on tab close alone means a clinician who finishes and walks
away leaves the previous patient's details behind for the next person at that machine. And because
this is data at rest that a clinician did not ask for, **the screen says so in plain words, in
place** — the same standard spec section 4.4 sets for the system acting on its own. — Cost if wrong:
if the notice proves unnecessary it is one sentence removed. If the clearing is wrong, a patient's
name and mobile number sit on a ward machine after the clinician has gone, which is the failure this
whole ruling exists to prevent, and it must be proved by a test rather than asserted.

## Rulings 111-113 — Task 7, the activation wizard's shell and stages 1-2

**Ruling [111] — the wizard starts from an accepted referral, named in the URL by id.** — Why:
`createPlanSchema` requires `referralId`, `patientId` and `pathwayVersionId`, so a plan is created
_for_ a referral rather than from nothing. A referral id in a query string is acceptable; a patient's
name or mobile number never is, and `plans/route.ts` already records the reason in the code — "a query
string is logged by every proxy between here and the browser". Team ownership is validated before use,
exactly as Task 6 validates `?plan=`, and an unseeable referral gets an honest state rather than a 404
that would distinguish "does not exist" from "another team's". — Cost if wrong: if the flow later needs
to start without a referral, that is an added entry point rather than a rebuild.

**Ruling [112] — stage 1 shows what a referral ACTUALLY carries, and the mockup shows fields that do
not exist.** — Why: `AgreementStage` renders an identity row (`patient.fullName · patient.id`) and a
mobile-suitability row, both sourced "Imported referral record". `Referral` in `model.ts` is exactly
five fields — `id`, `teamId`, `patientId`, `state`, `pathwayVersionId` — and **there is no patient name
and no mobile number on a referral anywhere in this domain.** They arrive in
`createPlanSchema.patientDetail`, supplied by the clinician at stage 3. So the assurances are the
coordinator's own confirmations, not imported facts, and the wording must say which is which: **an
interface that presents a clinician's own tick as an imported record is lying about provenance, on a
screen whose entire purpose is assurance.** — Cost if wrong: if an assurance must be _recorded_ rather
than confirmed in-session, there is no field for it today; the implementer reports that rather than
inventing one or letting it live in the draft as though the draft were durable.

**Ruling [113] — the pathway may already be chosen, and stage 2 must say so.** — Why:
`transitionReferral`'s `accept` action carries a `pathwayVersionId` and `Referral.pathwayVersionId`
holds it, so an accepted referral can already name a pathway decided by whoever accepted it. Stage 2
shows that as the existing decision with its provenance, rather than an empty choice implying nothing
had been decided; changing it reads as changing an earlier decision. Spec section 4.4 again. — Cost if
wrong: if in practice the referral never names one, the branch is unreached and says nothing false.

**How Rulings [112] and [113] were found, and it is the same method both times.** Neither came from
reading the mockup or the plan. Both came from opening `model.ts` and the referrals route and reading
what the types actually hold, before writing a line of the brief. Ruling [86]'s lesson was "before a
brief says _build this_, open the file and look"; these are the same lesson pointed the other way —
**before a brief says _show this_, open the file and check it exists.** A brief that mandates rendering
a field the domain does not have costs an implementer a whole round to discover.

**Task 7 dispatched.** Brief: `task-7-brief.md`. Scope is the route, the shell, and stages 1-2 only;
stages 3-4 are left as a typed extension point for Tasks 8 and 9.

**The branch was pushed for the first time before dispatching**, at the owner's instruction: 114
commits existed only on this machine, which has destroyed working directories mid-session twice.
Remote head `22887351e`, zero ahead. No pull request; this is a safety copy, not a handoff.

## Speed review, 2026-08-25 — measured, not estimated

The owner asked what is required, what is not, and how to go faster. **Group 4 (Tasks 17 and 18, the
team roster and workload screens) is DEFERRED on his instruction.** The templates library (Task 15)
stays — he named one item, not two, and I am not widening a cut he did not make. Everything else
proceeds.

### Where the time actually goes, and the measurement that settled it

I went looking rather than estimating, and the answer was not what I had been telling him.

- **The browser gate is not the cost.** ~2 min build plus ~1.1 min run, five times today: about
  15 minutes total.
- **The full unit suite is.** Implementers run all ~10,000 tests two to four times per task — once
  per fix round — because `AGENTS.md` requires it, and for a real reason: this tree is policed by
  static scans living in files a diff will not contain, and that is exactly how a real failure once
  survived two tasks.
- **But the true bottleneck is the cross-worktree heavy-run lease, and it is not mine to fix.**
  `scripts/test-run-lock.mjs` permits ONE exclusive heavy job across every worktree of this
  repository. Attempting the guard set below returned, verbatim:

  > `Database focused-test capacity is full (current owner PID 62660, worktree
D:\Worktrees\Database\care-plan-impl, started 2026-08-25T02:32:32.647Z): playwright
--project=chromium-mockups tests/ui-care-plan-mockup.spec.ts`

  Checked rather than assumed: that lease was 5.5 minutes old and PID 62660 was alive, so it is a
  legitimate active run, **not a stale lock**. Earlier today an implementer waited about four hours
  behind the same mechanism. So the tax is recurring rather than stuck, and it scales with how many of
  the owner's projects run at once.

### Lever 1 — a named guard set instead of the full suite during fix rounds

`test:focused` **refuses** a list of test files ("Focused test selection is unsafe: test or
configuration paths changed"), which is correct and fail-closed. The sanctioned way to run a named
subset is `node scripts/run-vitest.mjs run <files>`, exactly as the existing `test:ci-workflows`
script does.

The tree-walking scans a caring-contacts diff cannot contain are nameable:

```
tests/caring-contacts-domain-isolation.test.ts      the sealed-domain import guard, PLAN_COLUMNS, the cap scan
tests/caring-contacts-interface-vocabulary.test.ts  prohibited vocabulary across every workspace string
tests/caring-contacts-retention.test.ts             the hard-coded-retention-period walk
tests/caring-contacts-overlay-definitions.test.ts   the frozen 24-row matrix
tests/route-reachability.test.ts                    orphan production routes
tests/design-system-adoption.test.ts                the adoption manifest and its proof pointers
```

**From here: that set plus the task's own tests during iteration and every fix round; the FULL suite
once, at the end of the task, before the report.** That is the same coverage at the moment it
matters and removes two to three full-suite runs per task.

**Unmeasured, and said so deliberately.** I could not time it — the lease was busy, which is the
finding above. The saving is expected, not proven, and the first task to use it should report both
numbers so this paragraph can be replaced with evidence rather than reasoning.

### Lever 2 — reviews are read-only and take no lease, so stop serialising them

Every task so far has run build → review → fix → re-review → next build, strictly in sequence. **A
review holds no lock and touches no file.** It can run concurrently with the next task's implementer
whenever the two do not share files. Task 8 builds directly on Task 7's shell, so that pair cannot
overlap — but the schedule work in Group 2 touches none of the wizard, and those can.

**The rule, so this does not become a way to build on an unreviewed defect:** overlap only when the
next task does not consume the code under review. If it does, wait.

### Lever 3 — match review depth to risk

Full loop (build → review → fix → re-review) stays for anything touching patient detail, a write
path, permissions, or the sealed domain. It has found a real defect in nearly every task, including a
screen that told a clinician a stopped plan would still send. **A single review pass, no fix round
unless it finds something, is proportionate for a read-only screen or an API on an established
pattern** — Task 12 and Task 15 qualify.

### What I will NOT cut, and why it is not a candidate

**The mutation proofs.** They are cheap and they are the reason any of this is trustworthy. In the
last three tasks alone they caught: a guard installed where no runner could reach it; a scan counting
its own explanatory prose; and a `PLAN_COLUMNS` widening that left all the database tests green.
Removing them would make the suite faster and the result worthless.
