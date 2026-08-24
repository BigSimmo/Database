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

| Tasks                        | Shared surface                      | What one produces / the other consumes                                | Finding                                                        |
| ---------------------------- | ----------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------- |
| 4 → 5, 13, 15, 18            | `shell.tsx` destination lists       | Task 4 adds the first `href`; each screen task adds its own            | **Sequential edits to one file.** No contradiction. Implementers are never dispatched in parallel, so this is a merge risk only if that rule is broken. |
| 1 → 5, 13, 15, 18            | the empty-state component           | Task 1 produces it; four list screens consume it                       | Clean. Task 1 must land before any consumer.                   |
| 2 → 5, 12, 17                | the list-read API pattern           | Task 2 produces the helper + contract test; three routes consume it    | Clean, and this is the whole reason Group 0 exists.            |
| 3 → 11, 14, 16, 18, 20       | the overlay trigger                 | Task 3 produces it; five tasks wire overlays with it                   | Clean. Ruling 69 keeps wiring with the owning screen.          |
| C → 16                       | `message-copy.ts`                   | Task C rewrites the reply wording (items A2/A3); Task 16 renders it     | **Ordering constraint.** C must land first, or Task 16 renders wording that is about to change. Recorded, not a conflict. |
| 7–9 ↔ 13                     | the nine-contacts / closing-message | Corrections #3 and #4 touch the activation review AND every schedule    | **Genuine cross-task requirement.** Whichever lands first sets the shape; the second must not re-derive it. Both must read the same source of truth in `schedule.ts`. |
| 5 ↔ 6                        | `getEpisode` vs `listPlans`         | Task 5 must NOT call `getEpisode`; Task 6 is the one screen that may    | Clean, and stated in the plan. Worth re-stating in both briefs. |

### Per-task self-consistency

| Task(s) | Its own text agrees with itself?                                                             |
| ------- | -------------------------------------------------------------------------------------------- |
| C       | Yes — six named edits in two named modules.                                                  |
| 1–4     | Yes.                                                                                         |
| 5–11    | Yes, with the `getEpisode` restriction stated.                                                |
| 12–14   | Yes.                                                                                         |
| 15–16   | **NO — defect found, see Ruling 73.** The design-corrections table routes correction #2 to "Group 3, Task 11", but Task 11 is Group 1's overlay wiring; Group 3 is Tasks 15–16. |
| 17–18   | Yes, with Ruling 72's scope limit stated.                                                     |
| 19–21   | Yes.                                                                                         |

### Anything the plan mandates that the review rubric treats as a defect

None found. The plan mandates no test that asserts nothing and no verbatim duplication of a logic
block.

---

## Rulings

**Ruling [73] — the design-corrections table's "Group 3, Task 11" is a typo for Task 16; corrected in
the plan.** — Why: Task 11 is Group 1's overlay wiring and cannot carry a Group 3 copy correction. The
correction is the reply-handling wording, which belongs to the message-preview surface built in Task
16. — Cost if wrong: had it stood, Task 11's implementer would have received a requirement it had no
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

**Ruling [76] — the approved copy changes are executed as ONE batched task (Task C) ahead of Group
0.** — Why: the method says to batch small same-shape work into one dispatch rather than one subagent
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
