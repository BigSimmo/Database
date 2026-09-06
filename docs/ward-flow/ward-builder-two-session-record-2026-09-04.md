# Ward Builder Two — session record, 2026-09-04

**Purpose.** Everything decided, found, asked and left open in one long owner session, in one place, so
no other chat has to reconstruct it from a transcript. Written at the owner's instruction: _"send all
of your information to the Ward Lead… all of your important decisions… all of your questions asked and
a clear file."_

**Branch:** `claude/ward-builder-two`. **Written at:** `5be6a7045`.

> **Provenance rule, and it is the point of this file.** Every owner decision below is tagged
> `(OWNER, 2026-09-04)`. Everything untagged is my reasoning and carries no authority. An audit today
> established that this codebase cites decisions in a form that cannot be told apart from decisions
> nobody made, and that **citation status is wrong in both directions** — Ward Verifier traced two
> rules end to end and found one uncited rule that _was_ a genuine owner ruling and one that was
> invented. **So do not treat "uncited" as "inferred", and do not copy any line out of this file
> without its tag.**

---

## 1. The two documents this session produced

| Document                                                                     | What it is                                                                                                 |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `docs/superpowers/specs/2026-09-04-ward-flow-direction-and-delays-design.md` | The spec. Owner-approved. Direction, the ward-model defect, the Delays view, the matcher, the bed picture. |
| `docs/superpowers/plans/2026-09-04-ward-flow-mixed-locked-open-beds.md`      | The implementation plan for spec §6, in seven tasks. Task 1 in flight.                                     |

---

## 2. Owner decisions from this session

### 2.1 Direction

- Ward Flow is a **lightweight, fast, statewide bed-flow tool** a coordinator opens instead of making a
  phone round. It is intended to be **used on real patients** — three lighter destinations were offered
  and rejected. `(OWNER, 2026-09-04)`
- **Two jobs, both:** show the whole bed state at a glance; show why each person is stuck.
  `(OWNER, 2026-09-04)`
- 🔴 **It recommends. It never decides.** _"It can never make a clinical decision on its own. It can
  guide and give recommendations that the final acceptance comes from the users."_ `(OWNER, 2026-09-04)`
- 🔴 **`spec D4` — "the board records and shows, it suggests nothing" — is WITHDRAWN**, as
  `R-2026-09-04-G`. It was never the owner's; it was inferred by the build team, written into four files
  in capitals, enforced by a test, and obeyed by everyone. The owner's actual intent is stronger than
  merely permitting a hint: _"I want it to use all the information it has to make accurate suggestions
  about what patients best fit the wards."_ `(OWNER, 2026-09-04)`
- **Good enough** is judged by the owner using it for a week against his own service and not reaching for
  anything else. `(OWNER, 2026-09-04)`
- **Build the lightweight version now; design so the heavy version adds without rework.** Given five
  separate times in different words. **Do not start authentication, integration or AI.**
  `(OWNER, 2026-09-04)`

### 2.2 Scope

- **Primarily adults**, plus older adult, forensic/secure and youth. **Youth is 16–24 and follows the
  same pathway** — different unit eligibility, not a different journey. **Under-16 paediatrics is out of
  scope.** `(OWNER, 2026-09-04)`
- **Desktop is the primary screen**, to 1280×800. Phone must work and no longer sets the shape of new
  screens. **Paper is a first-class output.** `(OWNER, 2026-09-04)`
- **Journeys may start from a community team**, bypassing an ED — reversing _"every journey begins at an
  emergency department"_. Direct admission comes **only from a community team**, and the receiving ward
  still accepts. `(OWNER, 2026-09-04)`
- **Crisis and short-stay units (MHEC, MHOA) are wards**, not a third kind of place — but a patient
  placed there who still needs a longer-stay bed **stays visible on Delays**. `(OWNER, 2026-09-04)`

### 2.3 ⚠️ The wait clock — settled late in the session, and it replaces what the spec first said

> _"There is two wait times. When a patient is referred, and how long a patient is waiting in ED. The
> main one used is WAITING IN ED… This only begins when they arrive in ED or are referred in ED. When a
> community patient is referred to ED, the wait for a bed only begins when they arrive in ED. This is
> because many times it takes days for patients to arrive."_ `(OWNER, 2026-09-04)`

| Clock                       | Starts                                                        | Standing          |
| --------------------------- | ------------------------------------------------------------- | ----------------- |
| **Waiting in ED for a bed** | **Arrival** in the department — or referral, if already in it | **The headline.** |
| Time since referred         | When the referral was raised                                  | Secondary         |

**A community referral to an ED does not start the ED clock.** Counting the days before arrival as an ED
wait overstates urgency on the main view, which pushes a genuinely urgent person down the list.

### 2.4 Delays, the matcher, the bed picture

- ⚠️ **A fixed list of delay kinds, one named constant, easy to extend** `(OWNER, 2026-09-04)`. **THE
  NINE MEMBERS ARE MINE, NOT HIS.** He ruled the list exists; he has never ruled what is in it. Shown to
  him, unanswered. **An open question that was wearing an owner tag — in the document that introduced the
  tagging.** A patient may have several at once. Optional
  free-text note; who recorded it; when it started and ended; **cleared delays are kept**.
  `(OWNER, 2026-09-04)`
- **Anyone may record a delay on any patient**, attributed — delay is often known by whoever is _not_
  holding the patient. **The system clears only what the system set.** `(OWNER, 2026-09-04)`
- **Two sections on one page**, people above and wards below, ward names linked across both.
  `(OWNER, 2026-09-04)`
- **Sorted by total wait, longest first — except an expiring legal authority, pulled to the top.** No
  invented threshold. `(OWNER, 2026-09-04)`
- **Note visible to coordinator and author; wards see the kind only.** `(OWNER, 2026-09-04)`
- **Matcher: all four factors** — clinical fit and legal authority; distance; wait plus legal clock;
  continuity. 🔴 **It shows the tension rather than resolving it** — best-for-patient and
  best-for-board side by side, with the reason, only when they differ. `(OWNER, 2026-09-04)`
- **Top few shown, every other ward reachable by search.** **Overrides are recorded and used to improve
  the matcher** — the concrete answer to what must exist before AI. `(OWNER, 2026-09-04)`
- **Staleness is displayed age, never withdrawal.** A ward that has not updated shows its last number,
  greyed, **plus an affordance for the coordinator to request an update, which flags on that ward.**
  `(OWNER, 2026-09-04)`
- **Each ward page gains a notifications section, and it clears by acting, never by dismissing.**
  `(OWNER, 2026-09-04)`
- **Statistics is for loose performance tracking and seeing where the deficits are**, as well as the
  coordinator's is-today-unusual question. Not a formal reporting product. `(OWNER, 2026-09-04)`

### 2.5 Standing rules

- 🔴 **Simple must not mean reduced.** _"ensure the actual functionality is not reduced and the design
  and style is not impacted. It still must be visually appealing and very functional."_ **"Design for a
  stranger" must never become "design for a beginner".** `(OWNER, 2026-09-04)`
- **A ward's three routine acts — answer a referral, update beds, record a delay — must work cold, with
  no training, at 3am.** Coordinator actions may assume familiarity. `(OWNER, 2026-09-04)`
- **All synthetic data must be easy to change later** — one place per value, marked invented.
  `(OWNER, 2026-09-04)`
- **History kept seven years**, longer for under-18s, past state reconstructable. `(OWNER, 2026-09-04)`

### 2.6 The thirteen recommendations, all approved

The owner answered **"Yes to all recommendations"**, with two amendments already folded above (statistics
purpose; the ED clock). In build order:

1. Mixed locked/open beds first — the only place the app gives a **wrong** clinical answer.
2. The app learns **which ward you are**; the sidebar shrinks to fit.
3. **Delays beside Command**, not replacing it; revisit after a week.
4. **Request-an-update** puts an item in the ward's notifications panel _and_ marks the figure for
   everyone looking at it.
5. Prototype status ends when the owner's own week-long test passes. No feature list.
6. Statistics: build no more until Delays exists. **Delete nothing.**
7. Wait clock as §2.3.
8. **Sex versus gender identity: encode no rule**, show the facts, say on screen that no automatic rule
   applies.
9. Aboriginal cultural safety review is a **hard gate before any real patient**; build distance-from-home
   so a connection-to-community factor can sit beside it.
10. **Nothing adopted that could not run inside a health network.**
11. Build to seven years; treat a host's policy as a later constraint.
12. **Two of the three "not a medical device" claims change; the third stays.**
13. The two items owed by me follow the mixed-ward work.

---

## 2.7 ⚠️ WHAT A LATER READER CAN ACTUALLY VERIFY IN THIS FILE — read before quoting any of it

> **A tag meaning "he said this" and a tag meaning "he agreed when I proposed this" are different claims,
> and section 2 uses one mark for both.**

**Roughly 22 decisions here are tagged as the owner's. Six carry his own words. About sixteen are a
paraphrase, and nobody outside the session that produced them can check any of the 22 against what he
actually said. About twenty describe things not yet built — so they have never been contradicted by
anything, which is not the same as having been confirmed.** (Ward Verifier's framing, adopted verbatim.)

**The three tiers, so a quotation can carry its own weight:**

| Tier                                                                 | Which                                                                                                                                                                                                                                                                                                                                              |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **VERBATIM — his words, still readable in the conversation**         | The wait-clock ruling (§2.3); the AI wording ruling (§3.6c); statistics purpose; "some wards are locked, some are voluntary and some are mixed"; sex-across-locked-beds being "less important, mainly just voluntary or involuntary"; "Yes to all recommendations".                                                                                |
| **QUOTED FROM A SUMMARY — high confidence, broken chain of custody** | The Bentley locked/open example; "sometimes ED doctors refer patients prior to medical clearance"; the adults-not-youth correction; "ensure the actual functionality is not reduced". **Believed to be his words; the originals can no longer be re-read to prove it.**                                                                            |
| 🔴 **MY READING OF WHAT HE MEANT, tagged as though he said it**      | **"Build the lightweight version now; design so the heavy version adds without rework"** — my synthesis of a pattern across five answers, no one of which said it. **It is the most-quoted line in the spec.** Also "the two jobs it must do better than a phone"; "the system clears only what the system set"; "one entry per kind per journey". |

⚠️ **The third tier is dangerous precisely because a synthesis of five answers may state his intent better
than any single answer did.** It reads as a quotation, it is load-bearing, and it is the sentence somebody
will cite to justify a shortcut. **Keep the tier attached when the line travels.**

## 3. Findings — measured in this session, at `5be6a7045` unless stated

⚠️ **Each says how it was established.** A measurement has a shelf life and a scope.

### 3.1 🔴 The mixed locked/open ward defect — MEASURED, and being fixed

`Unit.security` is `"Open" | "Secure"` for a whole ward. `ward-eligibility.ts:123` reads
`movement.security === "Open" || unit.security === "Secure"`. The gate is asymmetric: an Open patient
passes everywhere, a patient needing a locked bed passes only a **wholly** Secure ward.

**So a mixed ward recorded as Open hides every one of its locked beds from every patient who needs one.**
The owner's own example — Ward 7 at Bentley — is flattened in the fixture to "BTY Adult Secure".

**Blast radius, measured and then independently re-derived:** 16 references across **10** source files — my first count said 8 files and the file count was wrong, though the 16 was right. Every other `.security` receiver in the tree (`movement.`, `patient.`, `candidate.`, `draft.`) was checked and is movement-side, so none is a hidden unit-side reader. 23 unit literals in `ward-sites.ts`.
**20 test files mention "security" — that is an UPPER BOUND, not a breakage count**; I have not separated
unit-side from movement-side mentions and am deliberately not refining it mid-change.

### 3.2 🔴 The `openedAt` clock defect — MEASURED, not yet owned by anyone

`RAISE_REFERRAL` (`ward-flow-reducer.ts:822`) creates the movement with `openedAt: event.now`. **Today
that equals arrival**, because a journey can only be raised at a department the patient is already in —
`originEdId` is required and the reducer refuses a referral not addressed to that department.

**The moment a community team can raise a journey directly — which this spec authorises —
`openedAt` becomes a referral time**, and every duration measured from it becomes a different quantity
under the same name. `ED_ACCESS_TARGET_MINUTES`' own comment calls it _"how long the patient has been in
the department"_.

⚠️ **The failure is silent and looks correct** (Ward Builder One's sharpening, adopted): no type changes,
no test goes red, a number simply becomes larger and stays plausible. The owner's words are that arrival
can take **days**, so the wrong version reads as a crisis.

⚠️ **The fix is a SEPARATE arrival instant written by arrival — never a reinterpretation of `openedAt`.**

⚠️ **I have NOT traced every reader of `openedAt`.** Treat "everything counting up from it" as the shape
of the problem, not an inventory. That caveat is part of the finding.

**Model context, verified rather than recalled:** `openedAt`, `referredAt` and `formedAt` already keep
these clocks apart, and `formedAt`'s comment says _"the legal clock and the department clock are
different clocks"_. The ruling confirms an existing distinction rather than inventing one.

### 3.3 Ward Flow is two design systems wearing one name — MEASURED

- **41 CSS modules.** **19 are fully unconverted**: zero uses of the shared `--ward-*` layer, and each
  declares its own private token prefix.
- **The four largest files are all unconverted** — `coordinator.module.css` (2,478 lines),
  `board.module.css` (2,238), `referrals.module.css` (1,327), `ward-management-network.module.css`
  (1,296).
- ⚠️ **CORRECTED after independent re-derivation. My first figure was "16 declarations, 16 names, four
  values" and it was wrong on all three counts — I had mixed `*-leading-body` tokens with
  `*-leading-prose` ones, which is how a fourth value appeared that no `*-leading-body` token has.**
  Measured: **22 declarations of a `*-leading-body` token, across 20 distinct names, with three distinct
  values** — 1.35, 1.4, 1.45. There is no 1.5 among them.
- 🔴 **And the re-derivation found something worse than the number I got wrong: a PREFIX COLLISION.**
  `--dc-leading-body` is declared **twice with different values** — 1.4 in `discharges.module.css` and
  1.35 in `ward-demo-controls.module.css`. Two unrelated files independently chose the prefix `dc`. So
  the private-token scheme is not merely duplicated, it is **ambiguous**: the same token name means two
  different things depending on which stylesheet you are reading. (`--ward-leading-body` is also declared
  twice, but with the same value, which is redundancy rather than ambiguity.)
- ⚠️ **`coordinator.module.css` still carries `--co-leading-tight: 1.2` and `--co-leading-prose: 1.5`.**
  Those are the exact two values `ward-tokens.module.css`'s own comment says it consolidated **away**
  from (to 1.15 and 1.55). The correction reached three files; the biggest screen was not one of them.

### 3.4 The app has no sense of place — MEASURED

`ward-management-navigation.tsx` renders `WARD_VIEWS` (8) and `WARD_NAV` (15) **unconditionally** — 23
destinations to every viewer. There is **no current-role or current-ward state anywhere**: the role
switcher is a set of `<Link>`s. Three approved decisions assume that state exists (shared per-location
logins, "just the current ward or ED or team", per-ward notifications), so **none of the three can be
built until it does.**

### 3.5 "Notification" — MY CLAIM WAS OVERSTATED, and the correction makes the work smaller

**What I told the owner:** that "notification" already names a referral purpose, so a notifications panel
would put two unrelated meanings of one word on the same screen.

⚠️ **The on-screen half of that is wrong.** Surveyed: the referral-purpose type's members are
`"bed" | "psychiatric_review" | "medical_assessment"`. **"Notification" is never a value in it and is
never rendered anywhere in the ward tree** — it exists only in comments and prose describing the ward→ED
purpose. So the collision is real **in the code's vocabulary, for the next developer**, and **not on any
screen, for a clinician.** Those are different severities and I reported the larger one.

**A third meaning does exist in visible copy, outside the ward tree** — "Notifications" appears in the
wider app's settings and in Caring Contacts. That is a real reason to choose the ward panel's name
deliberately, but it is not the reason I gave.

🔴 **AND THE FINDING THAT MATTERS MORE THAN THE WORD: the surface may already exist.**
`ward-screen.tsx` already renders **"Incoming referrals awaiting an answer"** — a per-ward list of things
that ward must respond to, with accept and decline, **which clears by acting rather than by dismissing.**
The emergency department screen has its own inbox.

**That is the owner's requirement, already built, under a different name.** His request — _"a notifications
section on each ward page, easy to see, carrying everything that ward must respond to… it clears by
acting, never by dismissing"_ `(OWNER, 2026-09-04)` — may therefore be to **widen an existing section to
carry more kinds of item**, not to build a new one.

**Recommendation: extend it, do not add a second list beside it.** Two lists of things a ward must answer
is worse than one list under an imperfect name — a ward would have to check both, and the failure mode is
an unanswered referral sitting in whichever one nobody looked at.

⚠️ **Caveat carried from the survey rather than dropped: a name-based search cannot prove absence.** The
report records which names and files were searched. Treat "nothing else found" as "not found by these
searches".

### 3.6 The three "not a medical device" claims — ALL THREE READ

⚠️ **Cite these by their SENTENCE, never by their line number.** Between my reading them and Ward Lead
confirming the correction, `NotAMedicalDeviceStatement` moved from line 828 to line **925** — shifted by
an eighteen-line comment added to the same file within the hour. A line number is a claim about a file
at a moment. **Naming the sentence is what let this be caught at all**; a bare line number would have
sent the next reader to the wrong place and they would have concluded something else was meant.

**Two are made false by the owner's withdrawal of `spec D4`, and both need rewriting:**

- `referral-board.tsx` — _"never allocates, never ranks units by suitability, and never suggests which
  bed is best"_.
- `referral-match.tsx` — _"never ranks units by suitability and never suggests which bed is best"_. Ward
  Lead's note: this repeats the board's denial **deliberately**, on the screen where the accept decision
  is actually taken, because a coordinator deciding there has scrolled past the board's banner. So it is
  a second surface to fix, not a duplicate to delete.

**One must NOT change** — `NotAMedicalDeviceStatement` in `ward-management-modes.tsx`, rendered on two
screens including Command:

> _"This screen is not a medical device. It orders operational placement work only — it never assesses a
> patient's risk, acuity or treatment. A human coordinator confirms or overrides every suggestion."_

Its risk/acuity/treatment denial was independently confirmed accurate by the governance sweep, it
contains no rank/suggest/allocate denial at all, and **its second sentence presupposes suggestions
rather than denying them** — so the matching work keeps it true.

⚠️ **AND THE REPAIR IS PRODUCT-LEVEL OR NOTHING — measured by Ward Verifier, after correcting me.**

I claimed in a message that at least one banner was **already** false against `eligibleCandidatesAmong`.
**That was unmeasured and it is wrong.** All three screens build their unit lists with
`referralCandidates()` — a plain `.map` with no `.sort` — so **each sentence is true of its own screen.**

**What is false is the impression, not the sentence.** A clinician reads three screens saying "never
ranks units by suitability" and forms a belief about the product; the product ranks on other surfaces.
Each sentence is individually defensible and **the set misleads.**

🔴 **Why the distinction decides the rewrite: a rewriter who believes one banner was narrowly false will
fix that one and stop.** All three are narrowly true, so there is nothing to fix one at a time. That is
what makes it the owner's decision rather than a wording pass. **The replacement must be true of code
that already ranks, not merely of code that is about to.**

The withdrawal of `spec D4` did not turn a hidden defect into an owned one. **It turned a set of true
sentences that together misled into a set the owner now has a reason to replace.**

🔴 **Three claims were escalated to the owner and one of the three was the wrong file.** Corrected by
Ward Lead at `966c861cf`, with the correction itself recorded at `7c4767aeb` because it rode into a
merge commit that did not mention it. Without the catch, the owner would have been asked to rule on a
sentence needing no change while one that does need changing went unlisted.

### 3.6b — SUPERSEDED BELOW. The count of six is withdrawn; the count is THREE, and it is now derived.

⚠️ **Read 3.6b-final first. The section immediately below overstated the number (six) on a report that
its own author has since retracted. The methodological point in it survives; the number does not.**

### 3.6b-final 🔴 THREE SENTENCES NEED CHANGING, NOT TWO AND NOT SIX

**Settled by derivation rather than by anybody's list.** Ward Lead enumerated every rendered denial of
ranking, suggesting or allocating across the ward tree at `bbc09d536`: **exactly three.**

| Sentence                                                                                                               | Verdict                                                                                                    |
| ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `escalation-board.tsx:44-45` — _"never ranks a ward the patient does not fit… never states what would need to change"_ | **Change.** Confirmed present at this branch's head.                                                       |
| `referral-board.tsx` — _"never allocates, never ranks… never suggests which bed is best"_                              | **Change.**                                                                                                |
| `referral-match.tsx` — _"never ranks units by suitability and never suggests which bed is best"_                       | **Change.**                                                                                                |
| `NotAMedicalDeviceStatement` (`ward-management-modes.tsx`)                                                             | **KEEP UNCHANGED.** It denies assessing risk, acuity or treatment — not ranking — and both halves survive. |

⚠️ **My §3.6 named a DIFFERENT three**: it included the modes statement, which is not a ranking denial,
and omitted the escalation board, which is. **So my conclusion "two need changing" was wrong; three do.**
The modes verdict is unaffected — it was right and stays right.

⚠️ **Two separate lists of three were in circulation**, overlapping in two members: mine in §3.6, and the
owner escalation document's. **Ward Verifier read my description of the owner escalation and reported
against it as though it were the owner escalation**, concluding the escalation board had fallen out of the
owner's list. It had not — it is row one. That claim is withdrawn by its author.

**The methodological point survives both retractions, and is now proved rather than argued.** Ward Lead's
earlier correction fixed a wrong MEMBER of a list and nobody then checked its LENGTH. Both are needed, and
**the derivation is what settled it** — a list that is enumerated from the code is checkable; a list that
is merely correct is not. **A correction landing inside a list is when the list feels most verified and is
least verified.**

⚠️ **And one of the three is about to be made false by my own proposal**: I have suggested the Delays view
show near-miss wards and name the gate each failed. `escalation-board` currently promises the app _"never
states what would need to change for one to work"_.

> 🔴 **OWNER RULING ON THE AI LABELS, 2026-09-04:** _"still provide recommendations though based on
> patient matching criteria and AI in the future but build it in in the future properly."_
> `(OWNER, 2026-09-04)`
>
> ⚠️ **So the correction is to the WORD, never to the behaviour.** Removing "AI" from a label must not
> remove a suggestion, soften a recommendation, or return any surface toward the withdrawn `spec D4`.
> The matcher stays and gets stronger; only the claim about _how_ it works comes off. **An
> over-correction here would quietly reinstate the rule the owner withdrew this morning** — which is the
> single most likely way this session's main decision gets undone by someone tidying up.
>
> AI arrives later and is **built in properly**, not relabelled onto sorting that already exists.

### 3.6c — CORRECTED. The AI labels are fixed on the master line and NOT in this branch.

**What I verified, and what it actually means.** At **this branch's head** `ward-management-modes.tsx:207`
still renders `aria-label={`AI best-fit review for ${patient.id}`}` and `:415`
`aria-label="AI best-fit review unavailable"`, over deterministic sorting.

**They were fixed at `394e6309e`, which reads "Eligibility review".** `git merge-base --is-ancestor`
confirms **that commit is NOT in this branch's history**, though it exists in the repository.

⚠️ **So neither measurement was wrong — we measured different artefacts.** Ward Verifier reported the
strings as current from `fffda3266`, about twenty commits behind the fix; I reported them as present from
a working tree that does not contain the fix. **Two people can verify in source, disagree, and both be
right, when neither says which head they stood on.** Every measurement in this file is dated and branched
for exactly this reason.

**What remains, per Ward Verifier and NOT verified by me at their head:** the `aiBadge` class name and the
Sparkles icons on five surfaces. Their argument is that the icon is a claim to a clinician and the class
name is a claim to the next developer. Both belong to Ward Lead.

**What this changes for the owner:** he was told the app currently announces AI. **On the product's master
line that is no longer true; on my branch it still is.** The correction has been given to him.

### 3.6b 🔴 MY DEVICE-CLAIM LIST WAS INCOMPLETE, AND THE WAY IT WAS WRONG MATTERS MORE THAN THE ITEM

**Ward Verifier's sweep found six false statements of that kind. My §3.6 names three. Verified myself:
`escalation-board.tsx:44-45` carries the withdrawn `spec D4` instruction very nearly verbatim** —
_"It never ranks a ward the patient does not fit, and it never states what would need to change for one
to work."_ It is not in my three.

⚠️ **The methodological point, which is the reason this is recorded at all.** Ward Lead's earlier
correction established that one of three escalated claims named the wrong file, and I treated the list as
settled. **That check tested MEMBERSHIP. It never tested COMPLETENESS.** Confirming that the right three
files were named says nothing about whether three was the right number — and it read as a thorough audit
because a real error had just been found in it. **A correction landing inside a list is the moment the
list feels most verified and is least verified.**

⚠️ **And its second clause is about to become false by my own hand.** _"It never states what would need to
change for one to work"_ — I have just proposed to the owner that the Delays view show near-miss wards
and name the gate each failed. **That is precisely the thing this sentence promises the app never does.**

### 3.6c 🔴 THE APP ALREADY TELLS CLINICIANS IT USES AI, AND IT DOES NOT

Verified in source: `ward-management-modes.tsx:207` renders
`aria-label="AI best-fit review for {patient.id}"`, `:415` renders `aria-label="AI best-fit review
unavailable"`, `:210` applies a class named `aiBadge`, and a Sparkles icon appears on five surfaces
including `ward-management-network.tsx:484` and `:1090` and `ward-management-console.tsx:238`.

**What sits behind those labels is deterministic sorting.** No model, no inference.

⚠️ **This is against an explicit owner instruction** — _"do not start authentication, integration or
AI"_ `(OWNER, 2026-09-04)`, with AI deferred until the infrastructure exists — **and it is a false
statement to a clinician.** An `aria-label` is not decoration: it is what a screen-reader user is told the
panel _is_.

🔴 **Note the shape, because the app is currently wrong in BOTH directions at once.** Three banners tell a
clinician the app **never ranks**, which understates what it does. Five surfaces tell a clinician the
ranking is **AI**, which overstates what it is. **The same sorting code is described falsely twice, in
opposite directions, on screens a coordinator moves between.**

### 3.6d The `openedAt` reader inventory — no longer a caveat, now an inventory

My §3.2 recorded that I had not traced every reader. **Ward Verifier has: 15 production readers, all
clinician-visible, at `ab0194b48`.** The widest is `elapsedLabel` (`ward-derivations.ts:194`), rendered at
15 call sites across 11 files.

🔴 **And the worst site is not a duration at all.** `ed-screen.tsx:613` computes
`isCommunityFormed = movement.formedAt !== undefined && movement.formedAt < movement.openedAt`, and `:621`
falls back to `openedAt` as the legal-clock reference otherwise. **A referral-time `openedAt` would
misclassify a hospital-formed patient as community-formed and switch the rendered legal-clock label.**
Every other reader inflates a number; **this one flips a category, on a statutory surface.** A comparison
between two instants breaks differently from a subtraction, and my original framing missed that.

⚠️ **Nothing in the suite can catch any of it.** `tests/ward-movement-stage-changes.test.ts:379-424` pins
that the creation `stageChange.at` equals `movement.openedAt` — **internal self-consistency, which stays
true under the redefinition.** The rest operate on synthetic numbers, not on what an instant means. **The
suite cannot express the question.**

**And the model has already written down why the fix must be a separate instant**, in the mirror
direction: `referredAt`'s comment says a row without one _"says so rather than falling back to
`openedAt`"_, because _"substituting arrival time under a 'referred' label answers a different question
while reading as plausible."_ A separate arrival instant is not a new principle — it is that one, applied
to the other side.

### 3.6a 🔴 A prerequisite for the Delays view — a guard that cannot fail

**Established by Ward Verifier, 2026-09-04, by mutation rather than by reading.**

`tests/ward-person-screen.dom.test.tsx:76-81` looks like it guards the rendered age. **It cannot fail.**
It computes the expected age and then discards it — the value's only use is `typeof age === "number"` —
and matches the render against `/\d+\s*(years|year)/i`, which any digits followed by "years" satisfies.

**Mutation-proved, with the mutant shown to have executed:** `ward-patients.ts:76` `return age;` →
`return 999;`. `ward-patient-model.test.ts` went red — _"expected 999 to be 36"_ — which proves the
mutant ran. **The person-screen test stayed green while the screen rendered "999 years".** File restored
byte-identical.

⚠️ **Why this lands on the Delays view specifically.** Delays is entirely about durations, and it will
be built beside surfaces whose age assertions are of this shape. **An assertion must be able to fail
before anything downstream of it is trusted** — otherwise the new view rests on a guard that certifies
nothing.

**Related, and corrected by its own author before it reached me:** `ward-flow-provider.tsx:134` reads the
system clock for `dayZero`. The first report said it "ignores `initialNow`", which implies a fix that
does not exist — `Instant` is a number of minutes against `NOW_ANCHOR` and **carries no date at all**, so
there is nothing in `initialNow` to derive a date from. The accurate statement is that it reads the
system clock unconditionally and **no pinned date exists anywhere to read instead; any repair must
invent one.** Measured: nothing currently asserts a calendar date derived from `dayZero`, so this is a
hazard to record rather than a defect to repair today.

⚠️ **Order matters if it is ever repaired: make the assertion capable of failing first.** A `dayZero` fix
landed before that has nothing to prove it worked.

### 3.7 `Unit.held` is dead — FLAGGED, DELIBERATELY NOT TOUCHED

Its own doc comment records zero reads across src, tests and scripts; every "Held" figure is derived.
**It is out of scope for the current plan and must not be deleted as a tidy-up** — removal needs its own
change with its own proof.

---

## 4. Questions put to the owner in this session, and his answers

Roughly a hundred questions were asked across several rounds. The ones whose answers **changed the
product** rather than confirming it:

| Question                                    | Answer                                                                               |
| ------------------------------------------- | ------------------------------------------------------------------------------------ |
| Is the app a record, a matcher, or a board? | **A matcher.** Reframed the product.                                                 |
| Should it suggest?                          | **Yes, strongly** — `spec D4` withdrawn.                                             |
| Is this for youth?                          | **No — primarily adults**, plus older adult, forensic and youth on the same pathway. |
| Do wards mix locked and open beds?          | **Yes** — Ward 7 Bentley. Became the first build item.                               |
| High dependency, or involuntary?            | **Locked / open**, in keeping with WA Health.                                        |
| Does the ED clock start at referral?        | **No — at arrival.** See §2.3.                                                       |
| Should medical clearance start the clock?   | **No** — _"sometimes ED doctors refer patients prior to medical clearance."_         |
| One coordinator or several?                 | One now; **design the login to accept area scoping.**                                |
| Per-person login?                           | **Shared per-location logins now**, per-person and Microsoft SSO later.              |
| Short-stay units — a third kind of place?   | **No, model them as wards** — but the patient stays visible on Delays.               |

---

## 5. Still open — nobody has answered these

| Item                                           | Owner of the answer                                                       |
| ---------------------------------------------- | ------------------------------------------------------------------------- |
| **When the ACEM access-block clock starts**    | Product owner — parked. Separate from §2.3, which is settled.             |
| **Sex versus gender identity in bed matching** | **A clinician with specific expertise. Not a design task.**               |
| **Aboriginal cultural safety review**          | **Aboriginal health practitioners. A hard gate before any real patient.** |
| Hosting, and therefore single sign-on          | Undecided; must remain possible inside a health network.                  |
| Retention if a host has its own policy         | Whoever holds the data.                                                   |
| The two "not a medical device" rewrites        | Product owner — approved in principle; wording not yet drafted.           |
| **What a webPAS feed would require**           | **Owed by me**, after the mixed-ward work.                                |
| **When the app is hardest to use**             | **Owed by me** — the owner was unsure and asked me to work it out.        |

---

## 6. What I got wrong today

Recorded because the pattern outlives the errors, and because two of these were caught by other people.

- **I told the owner blockers existed only on discharges.** They exist on **every movement**, are derived
  at each stage transition, and are guarded by a test.
- **I told him a stylesheet was unused and its removal was his call.** Three files reference it, including
  the component whose layout was built from it. **Ward Lead made the identical error independently and
  recommended deletion; the owner agreed.** _"Does anything import this"_ answers a narrower question
  than _"is it safe to delete"_.
- **I advised against any time threshold as "a target in disguise" — while Australia already had one.**
  ACEM's eight-hour access block, published and clinician-owned. An inferred house rule had become my own
  assumption.
- **I classified the rules register by whether a rule cites an owner decision.** That test is wrong in
  both directions; the individual findings stand on positive evidence, the totals do not.
- ⚠️ **RECLASSIFIED — this one is not mine, it is the project's.** My first parity test passed with the
  guard deleted — the movement it chose was blocked by a
  different guard anyway. Two guards in series mask each other.

  🔴 **It is instance FOUR of the same class, found by three sessions in one night** — an age assertion
  that computes an expected value and discards it (mutation-proved: the real value replaced by 999, a
  sibling test red on "expected 999 to be 36", that one green while the screen rendered "999 years"); a
  `Map` whose comment claimed it prevented a duplicate; a length guard whose first half could not fail,
  removable with all 25 tests still green; and mine. **Two of those four are attested by a single source,
  so it is four instances from three independent discoveries.**

  ⚠️ **Three people making the same class of mistake independently in one night is not carelessness — it
  is what this codebase's guards do by default.** And the harm is specific: **a guard that cannot fail
  reads as a safeguard, so the next person stops looking.** That is worse than no guard, not weaker than
  one.

  ✅ **REMEDY, adopted for the remaining mixed-ward work rather than filed as a policy: before trusting
  any new guard, break the thing it guards once, watch it go red, restore, and hash-check the restore.**
  All four were found that way. **None was found by reading.**

---

## 7. State of the current build

**Plan:** `docs/superpowers/plans/2026-09-04-ward-flow-mixed-locked-open-beds.md`, seven tasks.

**Task 1 (model + helper module) is IN FLIGHT** and paused on the machine-wide test lock held by another
worktree. Nothing of it is committed yet.

**Two plan-author decisions the spec does not settle** — both marked as mine in the code, both a one-line
change if the owner rules otherwise:

1. **An Open patient passes a ward with any free bed, locked or open.** Narrowing it would newly hide
   beds from someone who could use them. A **Secure** patient passes only where a locked bed is free —
   that part is the defect being fixed and is not optional.
2. **`allocatableLocked` splits the `allocatable` figure, not `empty`** — every gate has always asked
   about allocatable beds.

⚠️ **Warning carried from Ward Lead, and it changes the design of the new gate:** `eligibility()` and
`referralEligibility()` both emit a gate named `allocatable_bed` with **different pass conditions** —
raw `allocatable.value > 0` on the movement path, `min(allocatable, empty) > 0` on the referral path.
That divergence is deliberate; the safety comes from `PATIENT_ARRIVED` refusing when `empty.value <= 0`,
three events downstream. **A tidy-up hoisting the empty check earlier "for symmetry" would look like a
strengthening and would break accept-in-principle.** The new bed-kind gate must decide which of the two
questions it is asking, and **the two paths may need different answers.**

⚠️ **Second warning, from Ward Lead:** `typecheck` catches every reader of a removed field and is **blind
to a site that merely compiles** — a test constructing a unit by spreading a fixture silently acquires
whatever the fixture now has. **Grep the 23 unit literals by hand.**

⚠️ **Third, from Ward Builder Three:** `tests/ward-screen-capacity-wording.dom.test.tsx` is floored on
units where the ward holds empty beds it is not offering. If the designation work changes how `empty` or
`allocatable` are derived, **that population can empty and the floor will go red — and the red will look
like their test being broken when it is actually mine.**
