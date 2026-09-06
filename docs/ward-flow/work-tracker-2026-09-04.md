# Ward Flow work tracker — 2026-09-04

**One file, updated by Ward Lead only.** Every other chat reads it and reports against it. It exists
because five sessions are building at once and a status held in chat messages is lost the moment a
context window turns over.

**Integration line:** `codex/task-ward-flow-live-state-20260831`, worktree
`D:/Worktrees/Database/ward-lead`. Last commit `bc5e13c78`.

⚠️ **Every figure in this file names the tree it was measured on.** Two accurate counts disagreed
tonight purely because one was taken on a branch and one on the integration line.

---

## The rule that makes parallel building safe

**ONE WRITER PER FILE. ONE COMMITTER PER WORKTREE.** The pre-commit hook inspects the whole tree, so
two agents mid-write in one worktree deadlock — that is correct behaviour and must never be worked
around. Peers build on their own branches in their own worktrees; Ward Lead folds.

⚠️ **The three pin files are shared and are the one real collision risk:**

    tests/ward-design-language-contract.test.ts   COVERING_THE_GROUND, KNOWN_HEX_BACKLOG
    tests/ward-primitives-shared.test.ts          KNOWN_BACKLOG, KNOWN_BREAKPOINTS

**Each chat removes ONLY its own rows. Never re-sort. Never reformat. Never tidy a neighbour's row.**
A one-line deletion merges cleanly; a reflowed list does not.

---

## Ownership, right now

| Chat                   | Worktree / branch                           | Holds                                                                         | Status                          |
| ---------------------- | ------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------- |
| **Ward Lead**          | `ward-lead` / integration line              | `ward-management-console.tsx`, `ward-management.module.css` (via its builder) | Page rebuild in flight          |
| **Ward Builder One**   | own / `claude/ward-builder-community-route` | `tests/ward-management-print.test.ts` (new)                                   | Print guard in flight           |
| **Ward Builder Two**   | own / `claude/ward-builder-two`             | `tests/ui-ward-forced-colors.spec.ts`                                         | Spec run in flight              |
| **Ward Builder Three** | own / `claude/ward-builder-three`           | nothing yet                                                                   | Pre-registered as page reviewer |
| **Ward Verifier**      | own                                         | nothing — read-only by role                                                   | Idle                            |

🔴 **`ward-management.module.css` AND `ward-management-console.tsx` ARE LOCKED TO THE PAGE REBUILD.**
No other chat opens either, for any reason, until the rebuild lands. That file is also in the
twelve-screen adoption backlog and it is **removed from it** — the rebuild adopts it.

---

## Outstanding work, everything, ranked

### A. The movement workspace page — the owner's priority

| #   | Task                                                                             | Owner               | Blocked by                        |
| --- | -------------------------------------------------------------------------------- | ------------------- | --------------------------------- |
| A1  | Rebuild the page in the Board language, findings 4–11 folded in                  | Ward Lead's builder | — in flight                       |
| A2  | Cold read of the built page, then technical pass                                 | Ward Builder Three  | A1                                |
| A3  | **The owner's own look** — the only genuinely cold read                          | Owner               | A1                                |
| A4  | Progress tracker: per-patient, no counts of other patients, reads `stageChanges` | Ward Lead           | A1 (same file)                    |
| A5  | Print guard for this page — it has never had one                                 | Ward Builder One    | — in flight, lands red on purpose |
| A6  | Two stale red gates                                                              | Ward Lead           | A1                                |

✅ **`stageChanges` (A4's dependency) is DONE** — staged, 12 tests, 3 mutations red, waiting only on
the tree to clear. ⚠️ Its vacuity trap bit exactly as predicted: **0 of 50 seeded movements** qualify
for the agreement check, **5 of 5** on the reducer-driven fixture. Written as one loop it would have
compared nothing and passed.

### B. The twelve remaining screen adoptions

Four of eighteen are done (`community-index`, `community`, `ed`, `referrals` — 288 edits, verified in
a live DOM). **`COVERING_THE_GROUND` holds 18 rows in committed HEAD, 17 in the working tree.** ⚠️ I earlier wrote "down to 14" — that was a figure relayed from another chat and never checked, and it is wrong. Counted by me on `bc5e13c78`: 18. **Anyone using 14 as an anti-vacuity control has a matcher that will report itself broken when it is working.** All twelve remaining have measured mapping
tables already written.

| Group | Files                                               | Measured                                                | Owner              |
| ----- | --------------------------------------------------- | ------------------------------------------------------- | ------------------ |
| A     | board, coordinator, discharges, escalation          | 600 edits, 14 DO-NOT-DELETE blocks, 3 unmappable values | Ward Builder One   |
| B     | handover, morning, officer, out-of-area             | 225 edits (166 pixel-exact), 1 unmappable               | Ward Builder Two   |
| C     | tracker, statistics-sections, ward-management-modes | ~89 edits                                               | Ward Builder Three |

⚠️ **Group C originally had four files.** `ward-management.module.css` is removed — the page rebuild
owns it.

### C. Parked, and staying parked

`docs/ward-flow/parked-debt-2026-09-04.md` — about ten measured items. The largest: 71 count-shaped
assertions that survive a member being swapped; 17 of 18 `.every()` calls with no anti-vacuity floor;
~9% of the whole repository's tests unreachable by a focused run; all five `KNOWN_HEX_BACKLOG` rows
stale; `WardPanel` unable to express a headerless panel that `board` needs for its print reset.

### D. Only the owner can close

1. **The word** — "journey" or "movement". Asked openly; his first, unprompted answer was _journey_.
2. **The Aboriginal health review** for the two sensitive patient fields. Untouched.
3. **Nothing has ever been pushed.** Ward Flow lives on this disk only.

---

## ✅ Verified tonight: worktree deletion cost nothing

Four checkouts recorded in `docs/ward-flow/live-state.json` no longer exist on disk — all under
`.claude/worktrees/`, the folder wiped mid-session twice before. **Every one of their five branches
survives and every head resolves at the exact recorded SHA:**

    claude/Ward-design                            623c0c6a5
    claude/Wardquestions                          023f8e9f9
    claude/ward-flow-print-fixes                  68e501e5f
    claude/ward-flow-setup-967aa0-wf              0c94814a6
    claude/ward-flow-wave1-referral-corrections   2e9499fb2

**The folders went; the work did not.** That is precisely what committing early buys — a branch ref
and its objects live in the shared repository, not in the worktree folder. The red
`ward-flow-chat-control` test is stale bookkeeping, not lost work, and it is worth keeping strict.

**Full backup taken 2026-09-03T211630Z** — 1,290 files, 791 MB, verified bundles plus plain copies,
at `C:/Users/joshs/Backups/claude-work/`.

---

## Reporting contract — every chat, every report

1. **State the SHA you measured on.** A count without a ref is not a measurement.
2. **State the tier of any subagent you used** — "Sonnet, extraction" or "Opus, review".
3. **Every guard ships with the mutation that proves it can fail**, and you quote the assertion that
   went red and its message. "The test failed" is not evidence.
4. ⚠️ **Any matcher must reproduce a count SOMEBODY ELSE MEASURED before a zero from it is trusted.**
   A regex built from a template literal or `new RegExp("…\\s…")` loses its escapes and returns 0 for
   everything — four separate agents hit this tonight, and a zero is indistinguishable from "no work
   needed".
5. **Discover a test set from disk, never by naming it.** A hand-picked set has shipped a red test
   twice on this project.
6. **Use `npm run test -- <paths>`**, not bare `npx vitest` — the wrapper scrubs ~30 provider
   credentials and takes the cross-worktree lease.
7. **When you relay an owner decision, quote the question you asked, verbatim.** The answer belongs
   to the question; two chats asking about one decision are asking two different things.
8. **Use your session scratchpad, never `/tmp`** — a shared `/tmp` file was silently overwritten by
   another agent tonight.

---

## Which command actually runs which guard — measured, not read

Selection verified by running the real patterns against the real file list.

| Guard set                   | Count | Collected by                       | Smallest command that runs it           |
| --------------------------- | ----- | ---------------------------------- | --------------------------------------- |
| `tests/ward-*.test.ts`      | 113   | vitest `node`                      | `npx vitest run --project=node <file>`  |
| `tests/ward-*.dom.test.tsx` | 80    | vitest `jsdom`                     | `npx vitest run --project=jsdom <file>` |
| `tests/ward-*.test.tsx`     | **0** | **nothing**                        | hazard real, currently unpopulated      |
| `tests/ui-ward-*.spec.ts`   | 6     | playwright `chromium-mockups` only | `npm run test:e2e:mockups`              |

🔴 **`verify:ui` RUNS 0 OF THE 6 WARD END-TO-END SPECS, AND THE TWO EXCLUSIONS ARE INDEPENDENT.**
They do not match `productionSpecPattern`, so the required projects never collect them; and `@mockup`
is grep-inverted, so a tagged test would be dropped even if collected.

⚠️ **REMOVING EITHER EXCLUSION ALONE CHANGES NOTHING.** Somebody who spots one, removes it, sees no
change and concludes the specs must already be running would be exactly wrong. That is a trap laid
for the next careful person.

⚠️ **There is NO umbrella command covering the 193 vitest guards AND the 6 browser specs.** That is a
fact about the repository, not an oversight to hunt — but it is why "the full ward suite is green"
has always meant something narrower than the people saying it believed.

**And `test:focused` (`vitest related --run`) cannot select a test that reads source as a string** —
18 ward tests have that shape, including both contract pins and all three print guards. For those,
the smallest command is naming the file.

### The three gaps are one shape, not three coincidences

    test:focused   cannot reach the 18 source-reading guards
    verify:ui      runs none of the 6 end-to-end specs
    both pins      sat red for days inside that gap

**The two loops people habitually run cover neither the contract guards nor the only end-to-end
coverage this feature has.** That is why every near-miss tonight was found by looking rather than by
testing. The `@mockup` split is deliberate — a red mockup must not mask a production regression — so
this is recorded as a known shape, not scheduled as a fix.

## Subagent use, per chat

The owner asked for maximum safe parallelism. ⚠️ **Ward Verifier declined to fan out and was right
to:** its own operating instructions require its user, a CLAUDE.md or a skill to ask, and a peer
relaying a request is still a peer request. Its second reason is the better one — parallelising a
verification is how two agents derive one population the same way and agree on the same wrong answer,
which has already happened here once. Sequential is the stronger choice for that role, not merely the
permitted one.

---

## 🔴 Two near-misses caused by Ward Lead relaying unverified claims

Both within one hour, both after writing the rule against it, both caught only because the receiving
chat checked before acting.

**1. `--ward-tap` is declared on ONE BRANCH and I relayed it as shared.** Measured on three refs:

    codex/task-ward-flow-live-state-20260831   NOT PRESENT
    Ward Lead working tree                     NOT PRESENT
    claude/ward-builder-community-route:94     --ward-tap: var(--spacing-tap)

I told two chats to use `var(--ward-tap)` and quoted a line number I had never opened. On their trees
it is an **undeclared custom property with no fallback**, and every use site is a tap-target
`min-height` — so the minimum touch target silently becomes nothing. No CSS error, no warning, no
test failure. Twelve sites across four files. **Fold the declaration and its uses together, never one
without the other.**

**2. I asserted a token divergence I had inferred, as a measurement.** `--ward-border` versus
`--ward-divider` under forced colours. A verifier had actually measured them as indistinguishable and
abandoned its own correct finding on my say-so. A Playwright spec settled it four hours later: they
render the same colour, because the user agent overrides both before the token divergence reaches
paint.

### The rules these produced, binding on everyone including Ward Lead

- ⚠️ **A claim about a shared file is only true of a NAMED REF.** "I added it" is not "it is there".
- ⚠️ **Label every claim MEASURED or INFERRED, in the sentence, not the surrounding prose** — a
  caveat in the paragraph around a claim does not survive a relay.
- ⚠️ **A correction to a finding you measured yourself needs measurement before you relay it
  onward.** Deferring to a coordinator is not verification, and _agreeing looks like humility_, which
  is social cover no other bias has.
- **Extraction fans out; judgement does not.** Three agents deriving one population the same way
  multiply the method, not the independence.
- **Derive a mapping independently BEFORE reading the table, not after.** Reading first anchors, and
  "verify" quietly becomes "agree". This is how the `--ward-tap` staleness was found.

## 🔴 Fold-blocking checks

1. **`ward-shell.module.css:53`** — `@media print { .shell { background: transparent } }` exists on
   the integration line and is ABSENT on `claude/ward-builder-two`. Six screens there have deleted
   the root backgrounds that used to cover the unreset ground, including handover and morning, the
   two people actually print. **The fold must be verified to bring line 53.**
2. **`--ward-tap`** — its declaration and its twelve uses must arrive in the same fold.
3. **`COVERING_THE_GROUND`** — three branches remove rows from one list. Check no two removed adjacent
   lines, which is where git manufactures a spurious conflict.

## Rulings reversed tonight, and why

| Ruling                                                              | Reversed to                             | Because                                                                                                                                                                                           |
| ------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Eligibility block stays visible on a closed movement, with a caveat | Behind a deliberate control             | A screenshot crops the caveat; "Eligible now" beside a patient who never got a bed reads as an accusation                                                                                         |
| The three `color-mix()` become baked hex tokens                     | Leave them                              | They mix themed tokens at runtime and are theme-correct for free; two hexes freeze a snapshot that cannot follow a re-point, and the failure is a wrong colour in one theme with every gate green |
| `--ward-divider` divergence is an accessibility defect              | A role rule about future re-points only | Measured: forced colours overrides both before the divergence reaches paint                                                                                                                       |
| `--ed-leading-prose` stays local                                    | Adopt `--ward-leading-prose`            | A local value that lost a consolidation adopts the winner — and the screen was checked afterwards                                                                                                 |

⚠️ **Every one of these was reversed by a chat pushing back with evidence, not by me re-reading my
own ruling.**

---

## 🔴 A relayed count became an anti-vacuity CONTROL, which is the worst place for one

I wrote "`COVERING_THE_GROUND` is down to 14 rows" into this tracker and into a subagent brief,
where it was used as the control: _"if your method cannot find 14, it is broken."_

**Counted by me on `bc5e13c78`: 18 in committed HEAD, 17 in the working tree.** The 14 was relayed
from another chat and never checked — the third time tonight I have passed on a number without a ref.

⚠️ **A wrong control is worse than a wrong finding.** A finding gets checked; a control is the
thing doing the checking. An agent whose matcher correctly found 18 would have concluded its own
method was broken and gone looking for a defect in itself. The agent that received this one flagged
the discrepancy instead of forcing its count to match — which is exactly right, and is the only
reason it surfaced.

**So the sharpened zero rule needs one more clause:** the control must reproduce a count somebody
else measured _and stated with its ref_. A count without a ref is not a control, it is a rumour with
a number in it.

## The fold, predicted

Snapshot at `bc5e13c78`; all three tips will move, so re-run before folding.

| Branch                                             | Ahead/behind | `merge-tree`          |
| -------------------------------------------------- | ------------ | --------------------- |
| `claude/ward-builder-community-route` (`e8f63041`) | 5 / 0        | CLEAN                 |
| `claude/ward-builder-two` (`56f4308e`)             | 14 / 2       | CLEAN                 |
| `claude/ward-builder-three` (`bc5e13c7`)           | 0 / 0        | nothing committed yet |

✅ **None of the three touches either locked file.**

⚠️ **But this worktree's own uncommitted edit to `tests/ward-design-language-contract.test.ts`
will make `git merge` refuse outright** — git blocks on any uncommitted touch to a file it needs,
regardless of whether the lines overlap. **Commit before folding.**

**Order: community-route → two → three** (re-check three is not still a no-op).

🔴 **ONE PREDICTED CONFLICT, and it is genuine rather than spurious.** Proven with a combined
three-way `merge-tree` in both orders, not each branch against HEAD separately:
`COVERING_THE_GROUND`, committed lines 273/274 — community-route deletes
`"referrals/referrals.module.css"`, two deletes `"search/search.module.css"`, **directly adjacent
with no separating line.**

⚠️ **The correct resolution is to delete BOTH rows.** Accepting one side silently re-covers a
stylesheet whose own author just proved it does not belong there — **and the contract test stays
green either way**, so a wrong pick here is not caught by the suite. This is the fold trap this
project has hit before, in the same file.

---

## 🔴 FOLD RULE: each group folds as ONE UNIT. There is no safe order within a group.

Every group produces **two** commits against the shared pin file: a stylesheet commit that stops N
files painting, and a pin-removal commit that takes their N rows out of `COVERING_THE_GROUND`.

**The pin asserts in BOTH directions, so splitting the pair breaks it whichever way you go:**

| Order                         | What breaks                                                                                                                 |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| stylesheets first, pin second | the files stop painting while still named → **`freed` goes red** on all of them                                             |
| pin first, stylesheets second | rows leave while the files still paint → **`added` goes red**, and in between the ground is covered by screens no pin names |

⚠️ **The two-sided pin that has caught three stale backlogs tonight is exactly what makes these
commits inseparable.** This is not a flaw in the pin; it is the pin working.

**And the pairs cannot interleave ACROSS groups either**, because the pin is one shared file. Three
groups landing in the wrong interleaving produces four separate red states, none of which is a real
defect — and a red that is not a defect is how a real one gets waved through.

**Therefore:** fold one group's stylesheet commits and its pin-removal commit together, with no other
group's commits between them; run the contract test green before starting the next group; and never
fold a group whose pin removal has not yet been committed.

## ⚠️ "Discover from disk" was itself a hand-list — of one filename prefix

Two ward tests do not begin with `ward-`: **`tracker-derivations.test.ts`** and
**`pressure-strip.dom.test.tsx`**. So every "full ward suite" figure quoted tonight — the 193, and
the guard map's 113 + 80 — rests on a **name prefix**, which is a hand-picked criterion wearing the
clothes of disk discovery. `tracker-derivations` is directly relevant to a file adopted tonight and
the glob would have dropped it silently.

🔴 **The honest statement is not "195". It is that nobody knows the population, because "a ward
test" is defined by a filename convention nobody enforces.** The number worth having is: how many
tests under `tests/` import from `src/components/ward-management/` but do NOT match `ward-*` — a
population defined by what a test exercises rather than by what somebody called it.

## ⚠️ A comment that COUNTS things decays silently

Removing one pin row left a committed comment reading _"THESE TWO WERE INVISIBLE TO THE OLD
DETECTOR…"_ describing one file while saying two. **Nothing local ever goes red**, and the next
reader has no way to know it once meant a pair. Fixed, with a note recording what it used to mean.

Same shape as the count-shaped assertions in the parked list: a number embedded beside a list it does
not own goes stale the moment the list moves.

## 🔴 ATOMIC FOLD UNITS — a second and third pairing, nested

Group C is **two commits that must fold together, in order**, and the first is internally atomic too:

    b634046cd   adopts the token layer; renames .field -> .fieldName across four statistics screens;
                deletes three root backgrounds AND removes their three COVERING_THE_GROUND rows
    582f10081   moves the seven claim locators in statistics-claims-register.ts onto the new class

    b634046cd alone   -> 7 claims red: "THE PLACE THIS CLAIM IS MADE HAS GONE"
    582f10081 alone   -> cannot apply; the locators point at a class that does not exist yet
    both, in order    -> green

**Fold both or neither.** And `b634046cd` cannot be split either: background-first reddens `freed`,
pin-first reddens `added`. ⚠️ **Neither red is a real defect and both look exactly like one.**

That is now three atomic units found by three different chats — Group B's stylesheet/pin pair, Group
A's `--ward-tap` declaration/uses pair, and this nested pair. **The two-sided pin that has caught
three stale backlogs tonight is the same property that makes these commits inseparable.** It is the
pin working, not a flaw in it.

## ⚠️ A string that looks like DOCUMENTATION of code is often an ASSERTION about code

`statistics-claims-register.ts` holds seven `rendered` locators. They read exactly like prose
describing what a screen says. **They are load-bearing:**
`tests/ward-statistics-claims.test.ts` asserts each locator appears on its own surface **exactly
once** — not that a string exists somewhere, but that the exact sentence proving a claim is still on
the screen that makes the claim.

A rename pass saw those strings, judged them documentation of rendered output, and moved on without
checking whether anything verified them. Something did.

⚠️ **The two are indistinguishable by reading.** The lesson is narrower than "run the suite":
before editing a string that looks like a description of behaviour, grep for it — a description
nobody asserts and a description something asserts look identical in the file that holds them.

## 🔴 THREE TIMES TONIGHT: a fact real on one branch, treated as real everywhere

| The fact                                              | Real on                                         | Treated as real on   | What it nearly cost                                                        |
| ----------------------------------------------------- | ----------------------------------------------- | -------------------- | -------------------------------------------------------------------------- |
| `--ward-tap` declared                                 | `claude/ward-builder-community-route:585a905d1` | the integration line | 12 undeclared `min-height` values — tap targets silently zero on 4 screens |
| `@media print { .shell { background: transparent } }` | the integration line                            | every branch         | 6 screens printing a near-black page from dark mode                        |
| `tests/ui-ward-forced-colors.spec.ts` and its result  | `claude/ward-builder-two`                       | all five sessions    | three rounds of reasoning from a measurement nobody could read             |

⚠️ **The pattern is not that people forget refs. It is that A RESULT TRAVELS AS A SENTENCE WHILE
THE ARTEFACT THAT PRODUCED IT STAYS PUT** — and only the artefact can be interrogated. The spec's
scope was recovered only when somebody ran `git show claude/ward-builder-two:<path>` and read its
header, which said in its own words that it measures the case a screen's repoint CANNOT reach.

**Rule: when reporting a measurement produced by something on a branch, give
`git show <branch>:<path>` in the same breath as the result.** A number can be doubted; only the
artefact can be checked.

⚠️ **And it is why the divider question survived three rounds.** Each round closed on a measurement
that answered a different question, and nobody could see the difference because nobody could open the
spec. It is a good spec answering "can a screen's repoint reach a primitive" — answer: no. It was
read as answering "do the two tokens differ under forced colours", which it never asked.

## ⚠️ `/api/local-project-id` DOES distinguish two worktrees of one project

I told a chat it would not, and that a second dev server would therefore be unsafe to trust. Wrong:
the ids differ per worktree (`clinical-kb:1ee38f27c4ef` vs `clinical-kb:d0a358b585df`). The chat
proved its branch by content anyway — a positive control (a class only on its branch) and a negative
one (the pre-rename class absent) — which is why my error cost nothing.

## 🔴 ADOPTION MAY HAVE DISCONNECTED EVERY SCREEN'S FORCED-COLORS REPOINT — 13 files at risk

**Status: population measured, defect NOT confirmed.** Ward Builder Two raised this as an explicit
hypothesis after its third forced-colors probe returned an uninterpretable reading and, unlike the
first two, said why.

**The shape.** A screen repoints a token for forced colours in its own file —
`@media (forced-colors: active) { .screen { --ward-border: var(--border); } }`. Adoption then adds
`composes: wardTokens` to that same `.screen`, which puts `.wardTokens`'s
`--ward-border: var(--neutral-500)` **on the same element**. Two single-class selectors tie, so
**emitted source order between two different stylesheets decides** — and the base declaration now
lives in a file the screen does not control.

⚠️ **Before adoption this could not happen.** Both declarations were in the screen's own file and
the repoint came later, so the repoint won. Adoption did not change a rendered pixel; it moved the
outcome from something the author controls to something the bundler decides.

**Population, measured 2026-09-04, brace-depth-aware scan of every `@media (forced-colors: active)`
block in every `*.module.css` under `src/components/ward-management`, counting only `--ward-*`
redeclarations in a file that also composes wardTokens:**

    codex/task-ward-flow-live-state-20260831   3   modes(2) ward-management(4) sidebar(1)
    claude/ward-builder-two                    9   + handover(2) morning(2) officer(2)
                                                     out-of-area(2) search(1) statistics(2)
    claude/ward-builder-community-route        7   + community-index(1) community(2)
                                                     ed(1) referrals(1)
    union after the fold                      13   all --ward-border; 6 also --ward-border-strong;
                                                   5 also --ward-divider

⚠️ **A collision is not a defect.** Which side wins is emitted source order, which nobody has read
yet. One browser reading on `search.module.css` says `.wardTokens` won — one measurement, one file,
pointing the bad way. **13 is the population, never a count of breakages.**

**Why no gate sees it.** Both candidate values are author hexes, and the UA force-adjusts both to the
same ink, so the page renders identically either way. The consequence is not a visible defect; it is
that a mechanism people believe they have is not connected.

**The fix if the order check confirms it** — specificity, not ordering:
`.screen.screen { --ward-border: var(--border); }`. Two classes beats one whatever the bundler emits
first, CSS modules hashes both halves to the same name, thirteen files, one line each. The same
doubling this repo already uses at `.ckb-v2.dark.ckb-v2` (`ckb-v2-tokens.css:326`). The structurally
cleaner alternative — move `wardTokens` off `.screen` onto a wrapper so screens inherit rather than
tie — is recorded so nobody rediscovers it as news, and is not proposed now.

**Durable follow-up, unassigned:** a static guard that any `--ward-*` redeclaration inside a
forced-colors block uses a selector able to beat the composed layer.

### ⚠️ My first scan of this said `search.module.css` had zero, and it was branch-local

It scanned my working tree — the integration branch — while the file lives on
`claude/ward-builder-two`. **Third branch-locality miss in this programme.** It cost nothing only
because a zero that contradicted a colleague's direct reading was implausible enough to re-check
before relaying. The habit that saved it was not caution; it was that the number clashed with
something already read. Scan by `git show <branch>:<path>`, never by the working tree, whenever the
subject is a peer's file.

### 🔴 CORRECTION, SAME NIGHT: the mechanism above is WITHDRAWN. The population stands.

The section above records source order as the leading explanation. **It is contradicted by
measurement and must not be read as settled.** Three corrections, in the order they landed:

1. **Source order is the wrong way round.** Live CSSOM on the dev server, `/mockups/ward-flow/search`:
   the wardTokens sheet is document position 2, the screen stylesheets are position 3 — **later**.
   On an equal-specificity tie the screen's repoint would win. Ward Builder Two measured this and
   withdrew its own hypothesis rather than let thirteen files be sized against it. ⚠️ Dev order, not
   production: the production bundle could not be read (the Playwright build dir is cleaned after
   each run, and the `.next` on disk is a day stale).

2. **The `#667085` reading is explained, and it is a probe defect.** The probe does
   `input.closest("div")`. In `patient-search.tsx` the input's ancestors are `<label>`, `<form>`,
   `<main>` — none of them divs — so the first div reached is **`div.screen` itself**, and
   `strip = field.parentElement` is the element ABOVE the screen. `ward-shell.module.css` composes
   wardTokens, so that element declares `--ward-border: var(--neutral-500)` on itself, and
   `--neutral-500` is `#667085` (globals.css:342). **The probe measured one level too high.**
   INFERRED from the JSX, not from a rendered DOM read; the element chain is explicit.

3. **The "globals is not applying either" candidate is eliminated.** MEASURED offline: `--border`
   is declared seven times across all 47 CSS files under `src/` — `#e6ebf2`, `#333a41`, `#e3e8ef`,
   `#2b3136`, `ButtonBorder`, `CanvasText`. **Never `#667085`.** So `var(--border)` cannot yield that
   reading in any state, applied or not.

**What is actually established:** nothing yet about whether a screen's forced-colors repoint reaches
anything. No measurement so far has looked at an element _under_ the repoint. The question has
stopped being answered wrongly; it has not been answered.

**The 13-file population stands** — it counts a shape (`--ward-*` redeclared in a forced-colors block
in a file that also composes wardTokens), and that count did not depend on the mechanism.
⚠️ **Do not apply the `.screen.screen` doubling to those files.** A repoint doubled to beat a tie
that is not the problem looks exactly like a fix, changes nothing, and is hard to unpick later.

### ⚠️ A selector's own comment is what stops it being checked

`const strip = field?.parentElement ?? null; // the filter strip, bordered with --ward-border`

The comment is wrong and the code is not obviously wrong, so the comment is what gets read. This is
the **fifth** instance of "the artefact you search is not the artefact that runs" in this programme —
and the second one _inside a file written because of the earlier ones_. The first was a dev-only
class name falling through to `body > div`; this one resolves to a real element, so nothing is empty
and nothing complains. **A lookup that returns something is not a lookup that returned the right
thing.** The general fix is the one Ward Builder Two already stated: prefer a design with no lookup —
a `data-*` hook — over an ancestor walk done correctly.

## DISPATCH — step-back model + reducer, and the R64 fixture sweep (Sonnet, in-worktree)

**Tier: Sonnet, implementation.** Output is a state — two named test files pass and `tsc` exits 0 —
and the brief carries the exact code. No veto applies: the clinical judgements were already made in
the brief's rulings, so this dispatch authors none.

**Proved outstanding before dispatching**, not assumed from the brief: `STEP_BACK` and
`WITHDRAW_ACCEPT` appear nowhere under `src/components/ward-management`, and all four specified test
files are absent from disk.

**Files handed over:** `ward-model.ts`, `ward-flow-events.ts`, `ward-flow-reducer.ts`,
`ward-movements.ts`, plus two new test files. Checked against all three peer branches first — none
has a commit ahead of HEAD touching any of them.

### 🔴 RULING: the DOM test and its UI controls are DEFERRED, not dropped

The brief's Task 5 also specifies `tests/ward-movement-step-back.dom.test.tsx` and the two controls
it exercises — a step-back control on a completed step with a four-option reason picker, and a
visibly separate "withdraw the acceptance" control on `accepted_awaiting_bed`. Both need
`ward-management-console.tsx`.

**Ward Builder Three is reading that component right now for its technical pass.** Changing it
underneath them would waste the read and invalidate whatever they find. The model and reducer half
is fully independent of the console and is the larger piece, so it goes first and the UI follows
once the pass lands.

⚠️ **Recorded as OWED, with its acceptance criteria intact**, because a deferral that loses the
brief's five DOM assertions is a silent scope cut. They are items 24-28 of the brief, and the
stepped-back movement they need is unreachable on today's static fixture — it must be built by
driving the reducer, which is exactly why it cannot be quietly folded into some other test later.

### ✅ SETTLED: the forced-colors repoint APPLIES. No defect, no 13-file fix.

Measured by Ward Builder Two, production build, forced colours active, all controls green,
committed at `claude/ward-builder-two` @ `c56b0d85d`:

    tokens    --ward-border = CanvasText      --ward-divider = #667085
    painted   from-border rgb(0,0,0)          from-divider  rgb(0,0,0)

**Two genuinely different resolution paths, proved by the token read.** `--ward-border` becomes the
system keyword through `var(--border)`; `--ward-divider`, repointed nowhere, keeps the author hex.
The screen's forced-colors block ran. It was never losing a tie, so **the `.screen.screen` doubling
is not needed and must not be applied.** The 13-file population stands as a population and is not a
defect list.

⚠️ **DO NOT RELAY THIS AS "THE BLOCK HAS NO EFFECT."** The finder nearly printed exactly that and
caught it: the block ran and produced a different token; the user agent then force-adjusted the
author hex to the same ink. Authoring a system keyword is the supported way to work WITH forced
colours. **Whether the two diverge under a real user's Windows high-contrast theme is untested and
stays untested** — Chromium's default palette cannot show it.

**Three probe defects had to be cleared to reach this**, each caught by a control the previous
version lacked: a dev-only `[class*=screen]` lookup that fell through and compared two empty
strings; `input.closest("div")` landing on the shell; and measuring a person row whose
`border-top: 0` makes `borderTopColor` fall back to `currentColor` — **comparing a border against
text.** ⚠️ **Three wrong elements in a row, not one of which produced an error.** The through-line:
_an empty result gets investigated; a wrong result that is confidently labelled does not._

### Ward Builder Three's technical pass — three findings, all real, all mine to fix

Report at `technical-pass-movement-workspace.md`. All 50 movement pages return 200 in dev with no
error overlay, so no RSC boundary fault and no unresolvable composes target on this route. A
production build is pending the merge approved above.

1. **`blockerReadinessState` returns early on `!open`,** collapsing the five blocker facts three
   lines below a comment saying they "are five different facts and stay that way". WF-007 renders
   "Nothing was recorded as holding this up" and "None — handover complete" on one page.
   ⚠️ **Two of the five can NEVER render:** `PATIENT_ARRIVED` writes `blocker` and `closure` in the
   same object, so the open-branch line testing for that value cannot execute. **A producer whose
   output nothing can read — the mirror of [[fields-with-no-producer]], and it passes every gate
   and renders as a legitimate empty state exactly the same way.**
2. **The route quotes back an id the user never typed.** `page.tsx` substitutes `"WF-"` for any id
   not starting with `WF-`, so `/movements/PT-004` renders `No synthetic movement matches "WF-"`.
   Well-typed cast, invisible to `tsc`, asserted by no test.
3. **`movementReferralLink` has no production consumer.** VERIFIED before ruling, not taken on
   trust: 24 references in its own test; in production only `ward-movements.ts`,
   `ward-derivations.ts`, `ward-model.ts`, `ward-flow-reducer.ts`, `shortlist-panel.tsx`,
   `ed-home-derivations.ts` — **zero in the console**, which builds its own prose and emits one
   string for both "nobody was ever asked" and "no record either way".
   **RULING: the workspace consumes it.** Those are different instructions to a coordinator — _ask
   someone_ versus _find out what happened_. The ruling R-2026-09-04-D does not name a screen, so
   this names one.

**4 → 2 re-taken and it holds** (0 on WF-011, a different blocker). ⚠️ But the better number is
Three's: the blocker _question_ is put to the reader **four** times — control, help text, readiness
verdict, facts pointer. That is the count matching the cold read's actual complaint, and it did not
exist until somebody counted the right unit.

**For the deferred step-back UI:** `done` and `stopped` are both "behind" states and the difference
is visible only in markup today. A control offered on one and not the other, with no visible
difference, is a button whose availability the user cannot predict.

## 🔴 A CORRECTION THAT ARRIVED ONE EDIT TOO LATE, AND CAUGHT A REAL BUG

Ward Builder Three reported two blocker sentences as **dead by construction** — "no fixture change
can make them render". I had already written that claim into `blockerReadinessState` and deleted the
two arms from the open branch on the strength of it. Three then re-read the reducer after a parallel
check disagreed, and withdrew the absolute.

**The escape:** `RECORD_MOVEMENT_BLOCKER`'s near-miss guard fires only on a CASE variant —
`inactive.toLowerCase() === blocker.toLowerCase() && inactive !== blocker`. An **exact** sentinel
fails the second half, escapes, and is stored verbatim. The page has a free-text blocker box
dispatching that event with the draft as typed.

⚠️ **So the deletion would have made a reachable state print "Nobody has recorded anything as
holding this up" over a value somebody had just typed** — the same false-absence defect the function
was being repaired for, carried forward under a comment asserting it could not happen.

**The accurate claim, which is what the code now says:** every reducer path that WRITES those two
values closes the movement in the same object, so no reducer flow can produce them on an open
movement — which is why neither has ever been on a screen. That is a statement about the flows, not
about reachability.

**The reusable part.** ⚠️ **An overstatement in a finding becomes an absolute in the fix, and the
fix is where it does damage.** The report said "can never render"; my comment said "could never
execute"; my code then acted on it. Three layers, no new evidence, each one firmer than the last.
The finder corrected it within the hour and the correction still nearly missed. Related:
[[relayed-numbers-lose-attribution]], [[a-mention-is-not-an-assertion]].

**RULING, made and owed:** refuse the exact string too. The guard's own comment says
`CLEAR_MOVEMENT_BLOCKER` "is what a person uses, and this refusal names it", so the escape is an
oversight, not a design, and letting a coordinator stamp "handover complete" on a patient who has
not arrived is worse than being routed to Clear. **Lands after the step-back build**, which owns
`ward-flow-reducer.ts`, and needs a test proving no existing flow depended on the escape.

## 🔴 WF-300 — the page said the patient was still in the emergency department she had left

Verified by Ward Builder Three on the rendered page and in the source. Closure read "Handover
complete at RPH Older Adult", step 7 of 7, arrived — and the facts panel read
**"Where the patient is / St John of God Midland Emergency Department"**, rendered from
`originEd.name` with no arrival branch.

**Worse: the row contradicted its own panel header.** The panel's blurb is "The record's own fields,
plainly labelled. Nothing here is derived" — and _where the patient is_ IS a derivation, depending
on the stage, the closure and whether anybody recorded an arrival.

**FIXED BY THE LABEL, NOT A BRANCH.** The row is now **"Came from"**, which is true in every state
including arrived, needs no derivation, and puts the panel back inside its own promise. Anything
genuinely about the patient's present location belongs in the narrative above, which already has a
tense.

⚠️ **This survived the redesign, the full suite and a cold read.** It was found by reading ten
rendered pages line by line — 1731 text lines. The two checks that could have caught it were a
person looking and nothing else.

## Eight further on-screen contradictions — two verified, six relayed, three unsure

Report: `contradiction-hunt.md` (Ward Builder Three's scratchpad). WF-300 and WF-015 are verified by
the finder; the other six are **relayed, not confirmed, and are recorded that way deliberately.**

    verified   WF-300  arrived, yet "where the patient is" names the origin ED        FIXED
    verified   WF-015  blocker "Awaiting transport escort" vs "No escort is required"  fixture?
    relayed    WF-009  "legal status has not changed" beside an examination that changed it
    relayed    WF-013 / WF-002  "Bound for" naming a ward that has not accepted / is ineligible
    relayed    WF-008 / WF-015  destination ward's health service wrong
    relayed    WF-008  cites a transport arrival when none was arranged

**I am not acting on the six until they are verified.** Twice tonight I acted on a relayed claim and
had to unpick it, and two of these would change clinical wording. ⚠️ **Each also needs classifying
as a RENDERING defect or a FIXTURE defect** — WF-015 reads like the second, and no rendering change
repairs seed data that disagrees with itself. They land in different files, and `ward-movements.ts`
is currently owned by the step-back build.

## Uncommitted right now, named rather than left silent

`ward-management-console.tsx`, `src/app/mockups/ward-flow/movements/[movementId]/page.tsx`,
`tests/ward-override-surfaces.test.ts`. The pre-commit hook refuses while the dispatched build holds
`ward-model.ts`, `ward-flow-events.ts` and `ward-flow-reducer.ts` unstaged. Correct behaviour, not
worked around; they land the moment the tree is mine.

⚠️ **`tests/ward-override-surfaces.test.ts` carries a type error I shipped in `c097f75bd`.**
`DispatchCallSite` never gained the `expression` field the rekey added. Vitest runs no `tsc`, so 19
tests passed and I committed it — the exact shape of [[the-suite-never-tests-the-absence]]. Fixed in
the working tree.

## ✅ ALL SIX RENDERING DEFECTS FIXED, AND A GUARD THAT GOES RED FOR EACH ONE

`tests/ward-movement-page-truthfulness.dom.test.tsx` — seven tests, six mutations, **each mutation
turning exactly one test red and the RIGHT one by name**, not merely the suite:

    M1  restore `acceptedUnitId ?? referredUnitIds[0]`   -> "never says a movement is bound
                                                            anywhere until a ward has accepted it"
    M2  print the ORIGIN service after the destination   -> "prints the destination's own health
                                                            service ... never the origin's"
    M3  "unchanged" instead of "no change recorded"      -> "says a legal status is unrecorded,
                                                            never that it is unchanged"
    M4  collapse the closed blocker branch again         -> "never reports an absence of
                                                            information it is displaying three
                                                            inches away"
    M5  label the origin "Where the patient is" again    -> "does not label a recorded origin
                                                            department as where the patient is now"
    M6  quote a sentinel instead of the requested id     -> "quotes back the id that was actually
                                                            requested"

Console restored to sha256 `d579255352079258` after every one.

⚠️ **THE FIRST M1 WAS A BROKEN MUTATION AND PROVED NOTHING.** It referenced `destinationUnit` after
the fix had removed that import, so every render threw and **five of seven tests went red** — a
result that looks far more impressive than the real one and discriminates nothing. Rewritten to
reproduce the old behaviour inline. **A mutation that fails everything is as useless as one that
fails nothing, and it is the more flattering of the two.**

⚠️ **THE EXISTING 59 DOM TESTS OVER THIS COMPONENT PASS BEFORE AND AFTER ALL SIX FIXES.** They
assert that things are rendered; not one asserted that what is rendered is true of the record beside
it. That is the whole gap, and it is why every property in the new file is over the WHOLE fixture
with its own population floor rather than a sentence pinned to an id.

⚠️ **A false positive I narrowed rather than deleted:** the blocker property first flagged four
movements carrying `"No blocker"`, which is the default and carries no information — saying "nothing
was recorded" beside it is not a contradiction. Narrowed to blockers that carry information (active,
or a `"None — ..."` sentinel saying WHY nothing is blocking). Recorded because loosening the
predicate the other way is what would have made this look like a passing sweep.

⚠️ **What the guard cannot see, stated in the file:** the not-found property renders the COMPONENT,
so it proves the component quotes what it is handed. The defect was in the ROUTE, an async server
component nothing here executes; reinstating the sentinel in `[movementId]/page.tsx` leaves the test
green. That path is covered by a production build and by E2E — and the ward E2E specs are excluded
from `verify:ui` twice over — so in practice it is covered by somebody opening the URL.

### Owed to the owner, not decided here

**WF-009 carries an examination whose outcome is an inpatient order, 320 minutes after the movement
opened, a legal status of "Involuntary inpatient", and `statusChanges: []`.** The page no longer
claims the status did not change. It also does not claim it did. **Whether an inpatient-order
outcome always means the legal status changed is a clinical rule, and inventing it would replace a
false claim with a new one nobody authorised.** Question for the owner.

## 🔴 R64, THIRD INSTANCE — five arrived movements that were never collected

Found by Ward Builder Three, verified against the reducer. `stageFields`' `case "arrived"` returns
`acceptedUnitId` and `closure` and **no `transport`**, while `case "moving"` three lines away does
set one, and `PATIENT_ARRIVED` refuses unless `stage === "moving" && movement.transport?.collectedAt`.

**WF-300, 307, 314, 321, 328 have arrived without ever having been collected.** On screen: a step
track reading "Moving — Passed" and "Arrived" beside a transport panel saying "Nothing was arranged
before this movement closed" — a patient who travelled between two hospitals with no transport
record.

⚠️ **THE GENERATOR ALREADY FIXED THIS CLASS ONCE, THREE CASES ABOVE.** The `handover_ready` remap
exists because a generated record was "a state the reducer could never produce, exactly the
ruling-R64 defect". The reasoning was written down and the fix was applied to `handover_ready`
only. **A ruling applied to the instance that prompted it, rather than to the class.** That is the
commonest way a correct fix fails to hold, and the written reasoning sitting three cases above the
next instance is what makes it invisible — it reads as _handled_.

**RULING: give `arrived` a completed transport job. Do NOT remap the index.** The two earlier cases
were remapped because the stage did not imply the missing fields; `arrived` does — the reducer will
not permit the state without `transport.collectedAt`, so the job is what the state MEANS, not a
decoration added to satisfy a test.

**Folded into the step-back build's Task 6**, which owns `ward-movements.ts` and is already writing
`tests/ward-movement-fixture-reducer-reachable.test.ts`. The instruction sent with it: **the test
must catch the class, not the five ids**; it must walk the GENERATED movements (all five are
generated, not seeded); and **it must be shown red against the unrepaired generator before the
fixture is touched** — a reachability test written after the repair and never seen red says nothing
about whether it can see this shape, and this is the third time the shape has passed something meant
to catch it.

### ✅ An UNSURE with a named unchecked premise beat a confident finding

This came out of the cold read's **UNSURE** list, not its findings: _"could be a legitimate
own-transport case; I could not check whether the model permits it."_ It named the exact measurement
that would settle it, somebody took that measurement against the reducer, and it became the most
serious fixture defect of the night.

⚠️ **Two of the three UNSURE items stayed uncounted on the same check** — WF-015's transport-need
line is the owner's R-2026-09-04-C absence behaving correctly, and WF-018's "family collateral" is a
judgement about a rule's scope rather than a contradiction. **That is what makes the category work:
it is not a softer way of asserting.** A finder who can say "I do not know, and here is what would
tell you" is worth more than one who is right more often.

## 🔴 PRINTING THE PATIENT SEARCH SILENTLY DROPS THE WAITING-TIME COLUMN

Measured by Ward Builder One in a browser at A4 portrait (794×1123) with 43 real rows:

    search/search.module.css  .tableScroll
      clientWidth 637   scrollWidth 704   hidden 67px
      present:  Movement · Stage · Department · Destination · Since arrival · Open
      CUT OFF:  "Since arrival"  and  "Open"

`search.module.css` carries **no `@media print` block at all**, so nothing unsets it. **The column a
person prints this list to read is the one that does not reach the paper** — no rule, no ellipsis, no
sign anything is missing. Routed to Ward Builder Two, whose file it is; fix is the shape
`ward-management-modes` already uses, `overflow: visible !important` under `@media print`.

### The rule that is worth more than the finding

**A scroll container only truncates on paper if it is CONSTRAINED.** `overflow: auto` with
`min-height` on the parent is inert — the element grows to content and the DOCUMENT scrolls.
`overflow: auto` with a fixed `height`, or a table wider than the page, is the defect.
⚠️ **Horizontal is the dangerous axis: vertical overflow paginates, horizontal simply does not exist
on the page.**

⚠️ **THE COUNT WAS 44 AND THE ANSWER WAS 1, and the 44 was never sent.** The static walk found 44
scroll containers in 25 files, 6 print-neutralised — a number that reads as a large backlog and means
nothing, because declaring `overflow: auto` does not make a scroll container. **Third proxy-versus-
property miss tonight, third one caught before it was relayed** (mine was `min-height: 100dvh`,
18-of-21 that was really 0-of-2). The greppable thing is always the proxy.

⚠️ **AND THE FIRST MEASUREMENT WAS INVALID IN THE SILENT DIRECTION.** The browser pane reported
`innerHeight: 0`, so every `min-height: 100dvh` computed to `0px`, nothing was constrained, and every
reading said "not scrolling". **A false NEGATIVE — a clean sweep that would have closed the
question.** Caught only because `screenMinHeight` came back `0px` against a source plainly saying
`100dvh`. **Any viewport-unit measurement in that pane without an explicit `resize_window` is
meaningless**, and that belongs in every browser brief from here.

**Controls run, because a zero is worthless without one:** the parser was shown to distinguish a rule
inside `@media print` from a top-level one (without it, every print-scoped rule reads as
screen-scoped and the answer becomes "nothing is neutralised anywhere"), and the live detector was
shown reproducing a known non-zero — coordinator's `.queueList`, 3,985px hidden — before any zero was
believed.

**Named blind spots, unprompted:** `composes:` targets unresolved by the static walk; only the routes
actually loaded, in the states they happened to be in (a panel that scrolls only when a list is long,
a drawer, a dialog, an expanded section — none opened); Chromium at an A4-sized viewport is a proxy
for width, and nothing was put on paper; inline styles and anything set in JS.
⚠️ **`search` was found precisely because it had 43 real rows — a screen with a short seed list reads
clean and prints badly in production.**

## 🔴 ModeBody routes six of eight modes by name and reaches the seventh by falling off the end

`ward-management-modes.tsx:1125`. `WardMode` has eight members; six are checked by name and
`governance` is returned by exhaustion. **A ninth mode silently renders the governance screen** — no
compile error, no runtime error, and the user sees the wrong page.

⚠️ **The finding is not the fallthrough; it is that the same file enforces totality twice.**
`modeCopy` and `WARD_VIEW_ICONS` are total `Record`s over that union and break at compile time. So
the one construct that fails soft is the screen router, and it is the only one whose failure a user
sees. An author reading that file sees exhaustiveness enforced twice and reasonably assumes the third
is too. **Owed to Ward Lead**; fix is to name `governance` and add a `never` tail so the union and
the router break together.

Found by a switch-ladder sweep: **62 ladders across 32 files, 5 suspect, 2 unclear, 54 justified and
itemised.** ⚠️ **The sweep's own stated limit is the important part: its member-name search list was
hand-picked, so a chain over a union whose member names it did not guess is invisible — and it found
one such ladder by accident, not by method.** `ModeBody` is an if-chain, not a `switch`. So the
highest-yield remaining search is the one the method is worst at: enumerate the exported
string-literal unions first, then look for every chain over each.

**`LEG_BADGE_CLASS` is the counter-example to keep**: its comment revisits the sibling BY NAME and
says why that one stays neutral. That is what a fix that swept looks like, and it is the shape to ask
for in review.

## ⚠️ CORRECTION: "the six ward journeys run in no gate" was MY over-statement in the relay

The source report said, verbatim: _"CI does run the six ward journeys on a qualifying PR, but only in
a non-blocking, advisory, draft-excluded job — never in the required gate."_ **I compressed that to
"runs in no gate anybody runs" in three messages and in a report to the owner.** The precise half
survived — 0 of 6 in the required aggregate — and the qualifier did not.

`test:e2e:advisory` passes `--project=chromium-mockups` with a `--grep` that SELECTS `@mockup`. The
lane is `continue-on-error: true`, fires on `pull_request` only, and skips drafts.

⚠️ **The two framings call for different fixes**, which is why the over-statement mattered: _unrun_
means add a runner; _advisory_ means a failure is printed and ignorable, and the question is whether
to promote a lane somebody already tuned deliberately (the comment at ci.yml:771 records the ~3m14
cost and why `advisory_ui_changed` exists). Undoing a considered trade on the strength of a sloppy
summary was one relay away.

**What is still true and is the reason to run them locally tonight: Ward Flow has never been pushed.**
Newest ward branch on the remote is 31 August; this line is 1,120 commits past it. **No lane,
advisory or required, has seen a single commit of tonight's work.**

## A guard hung on a precondition its own run cannot produce

Ward Builder Two's first guard for the print fix asserted `scrollWidth - clientWidth <= 0`, passed,
and **passed identically with the fix deleted** — because the query it issued did not seed enough
rows to overflow at A4. Green for the wrong reason, in the file written to hunt exactly that. Found
by deleting the fix, which is the only method that could have found it.

**The rule: if a guard needs the world to be in a particular state in order to fail, it will pass on
the day the world is not.** The defect needs 43 rows; the run could not reliably produce 43 rows, so
the row count was the wrong thing to hang it on. Redesigned to pin the three released constraints,
each deterministic.

## ⚠️ RE-OPENED: "the forced-colors repoint applies" was settled on a narrower basis than recorded

Earlier tonight this tracker recorded the forced-colors question as **settled** — `--ward-border`
resolves to `CanvasText`, the repoint applies, no defect. **That measurement was taken on ONE
screen-level token, on ONE screen.** It tells you about that token on that screen and nothing else.

**Re-opened after the print defect showed the same shape one level down**, and re-opening surfaced a
second mechanism that the print case does not have:

    1. SPECIFICITY   --ward-border set on .screen (0,1,0) loses to the same property set on
                     .screen .panel (0,2,0) or .table td (0,1,1). Identical to the print defect.

    2. PROXIMITY     🔴 NO ANALOGUE IN THE PRINT CASE. A custom property resolves at the element
                     where it is USED, against the NEAREST ancestor that defines it. Any
                     redefinition on an element BETWEEN `.screen` and the consumer defeats the
                     repoint — at EQUAL OR LOWER specificity. Specificity never enters it.

⚠️ **Mechanism 2 is why "the repoint applies" can be true on the token measured and false three
levels down, with no specificity conflict for anybody to notice.** The brief that first excluded
custom properties from the sweep did so on the reasoning that they inherit — true, and only true
while nothing redefines them closer to the consumer.

**Status: RE-OPENED, not settled. Do not quote the earlier conclusion.** A sweep is running; the
answer may still be "none found", and that will be reported as a measurement rather than as the
absence of one.

### The transferable rule

**A measurement of one property on one element is scoped to that property on that element.** Both
times tonight that a conclusion was recorded as settled — the forced-colors repoint, and the print
reset — the measurement was sound and the SCOPE was assumed. ⚠️ **Nothing in either result was
wrong; the sentence written around it was wider than the evidence.**

## `--reporter=basic` is invalid on vitest 4.1.10

It errors with "Failed to load custom Reporter from basic". **It fails loudly, so nothing is
contaminated** — but a brief carrying that flag dies at startup, and three briefs tonight had it.

⚠️ **The shape to watch for is an agent reporting a clean sweep off the back of a startup failure.**
Audited across every brief dispatched: two agents hit it, both said so out loud rather than
returning an empty result, and one live agent was corrected mid-run. **The rule going into every
brief from here: a run that produced no "N passed" line did not happen.**

## 🔴 A GUARD'S SILENCE IS NOT A PASS WHEN THE GUARD DOES NOT WALK THE FILE

`tests/ward-management-print-coverage.test.ts` (Ward Builder One, `0ef11cb62`) asserts the print
reset **WINS** rather than merely exists, with a specificity comparator carrying its own control.
It is the right artefact and it is the one to act on.

**Run against this line: 12 failed, 8 passed. Every named file was one of One's eight** — unfixed
here only because that commit has not folded. **None of my seven appeared.**

⚠️ **I was one sentence from writing "my seven are clean."** They are not in the guard's
`STYLESHEETS` list at all. Its own passing test says so — _"analyzes exactly the eight named
stylesheets"_ — and that is the only reason I checked rather than concluded.

**The same shape as the wildcard it was written to catch:** it does the right thing for everything
it reaches, and reaches less than the reader assumes. Its floor (`toBeGreaterThanOrEqual(1)`) proves
each NAMED file has something to check; **nothing proves the LIST is the population.** Requested:
assert the list covers every `*.module.css` under `ward-management`, or name the exclusions, so the
gap is a decision rather than an oversight.

## The routing table goes stale within the hour, so re-derive rather than reuse

A sweep listing `ward-management` 41 uncovered, `ward/ward` 25, `ward-index` 10, `person` 9,
`add-patient` 8 was already stale when it arrived — `85d6adeed` had landed twenty minutes earlier.
Measured here after it:

    ward-management  1 print block, 2 CanvasText !important      wards/ward-index  1 / 2
    ward/ward        1 / 2                                       patients/person   1 / 2
    ward-management-modes 2 / 2                                  patients/add-patient 1 / 2

**Not a criticism of the sweep — it read the tree it could see.** It means the table must be
re-derived after every fold, and only the guard can do that.

**`ward-shared` stands as the odd one: no print block and NO ROOT CLASS to hang one on.** The agent
declined to invent one, correctly. Its 3 uncovered declarations need a different answer.

## 🔴 THE PRIMITIVES OUTRANK EVERY PER-SCREEN FIX

`ward-chip` 7 · `ward-sidebar` 7 · `ward-figure` 4 · `ward-panel` 3 · `ward-shell` 1. **Neither
earlier sweep surfaced them as a group.** They are composed into many screens, so one fix reaches
further than any screen fix — **and a screen whose own reset now wins can still contain a primitive
declaring its own colour.** That reframes "fixed" for all fourteen files anybody has touched.

## A name-matching detector defeated by a name, twenty minutes after being written

A classifier split print hazards into "content" and "button-ish, likely moot", on the basis that
`globals.css` hides `header, nav, button`. **It put `link` in the moot bucket. Anchors are not
hidden and DO print** — `.wardLink`, `.unitLink`, `.personLink`, `.resultLink`, `.teamLink` and
others are real hazards. 329 → 345.

⚠️ **And the general form is worse than the instance: the classifier cannot see the TAG at all.** A
`<div role="button">` prints; a `.declineOption` that is a `<label>` prints. **"Moot" is a hint and
never a verdict**, and nothing downstream may treat that column as cleared work.
