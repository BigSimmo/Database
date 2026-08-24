# SDD ledger — plan: docs/superpowers/plans/2026-08-24-caring-contact-phase-2b-screens.md

**This is the Phase 2B build record and the SDD ledger, in one tracked file.** Per Phase 2A's
Ruling 67, this programme does not keep a ledger in git-ignored `.superpowers/sdd/` scratch — a
git-ignored session ledger was destroyed once already and took the only copy of its session's record
with it. The build record IS the ledger.

**Where Phase 2A's record ends and this one begins:** `phase-2a-build-record.md` holds Rulings 1–67
and every Phase 2A task. Ruling numbering CONTINUES here from 68 so a ruling number is unique across
the whole programme.

Base commit for this plan: `875c8b604`.

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
