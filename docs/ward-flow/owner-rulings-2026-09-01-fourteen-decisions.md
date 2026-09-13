# Owner rulings — the fourteen decisions, 2026-09-01

**Ruled in one message: _"Accept all recommendations except below — 5. Ward manager / 10. Connect it
/ 12. Raise it."_** So twelve stand as recommended and three carry his own answer.

**Recorded in full rather than as "yes to the recommendation", because a bare yes in a transcript is
not a ruling anybody can act on in six weeks.** Each entry states the question as it was put, the
ruling, and — where it matters — what it costs and what must happen first.

⚠️ **Two of these are not yet built and must not be read as describing the app.** Ruling 2 and
ruling 10 both have sequencing constraints recorded below. Everything here is a DECISION; the
"Built?" column is the only thing that says whether it is also a fact.

---

## The fourteen

### 1. One-to-one nursing is recorded as the ward's staffing of the bed — not as a fact about the patient

**Question:** a ward that can watch one person one-to-one currently accepts an unlimited number,
because the limit is a number typed into the ward's record and nothing counts the people actually
being watched. Fixing it means recording it somewhere, and what we store about a patient only widens
with an owner ruling.

**Ruled:** record it as the ward's staffing of the bed. That is what the capacity figure counts.

⚠️ **This is the only ruling on the list where the app currently DOES something wrong rather than
SHOWS something wrong** — it hands out a bed the ward cannot staff. The privacy allowlist in
`tests/ward-admission-model.test.ts` is therefore widened for a fact about the WARD'S ACT, not about
the person, and that distinction is the ruling. **Built? NO.**

### 2. The community rule runs BOTH ways

**Question:** the owner ruled that a community referral means the patient is on their way out. From
that, a community follow-up is correctly protected from cancellation when a ward takes the bed. Does
the same reasoning run backwards — a community team accepting cannot settle whether the person needs
a bed?

**Ruled: yes, both ways.** An acceptance of a `leaving` destination cancels nothing.

⚠️ **THE PREMISE WAS HIS; THE SYMMETRY WAS NOT, UNTIL NOW.** The code's existing carve-out cites his
definition and reasons from it. Reasoning from an owner's premise to a second decision is how this
project has previously invented rules and attributed them to him, which is why it was put as a
question rather than applied. **It is now his, in his own words.**

**Sequencing, recorded at the site in `ACCEPT_REFERRAL` and non-negotiable:** Ward Builder Two's
branch-2 fix must be on the line first — it is, at `9a76616c9`. Without it the change creates a
reachable shape that the old predicate hides, so a correct fix would introduce the very defect it
closes. **And it turns a privacy test red in a file this change does not own**, and no rearrangement
of `multiDestinationReferral()` clears that red: the marker set must be split, which is Ward Builder
Two's work. **Built? NO.**

### 3. Form 4A and 4C may carry a deadline the person types in

**Question:** four seeded patients carry a transport or transfer deadline and the escalation screens
use them, but nobody using the app can create one — the form never asks.

**Ruled:** ask for it, on those two forms only, entered by the person, **never filled in
automatically.**

⚠️ **This does not disturb the 2026-08-23 ruling to leave the examination clock alone.** That ruling
was about the examination timeline; this is about transport and transfer orders, and the app still
invents no statutory figure of its own — the person types what the order says.
`tests/ward-legal-figure-guard.test.ts` must not be relaxed. **Built? NO.**

### 4. Clearing a discharge date does NOT wipe the count of how many times it moved

**Question:** two readers already disagree about this and nothing says so.

**Ruled:** no, keep the count. It records how often the ward revised its plan, and erasing it on a
clear hides exactly the churn the figure exists to show.

⚠️ `ward-statistics.ts:176` reads `dischargeDateMoves` BEFORE the `hasExpectedDate` guard, while
`ward-discharge-dates.ts:249` and `ward-board-derivations.ts:305` gate on `dischargeDateSetAt`.
**The ruling must be pinned by an assertion, because the two readers currently disagree in silence.**
**Built? NO.**

### 5. ⚠️ THE WARD'S ROLE IS CALLED **"Ward manager"** — everywhere, one spelling

**Ruled by the owner in his own words: _"Ward manager"._**

Three spellings are live today: `WARD_FLOW_ROLE_LABELS.ward` is `"Ward manager"`, and the seed's
`DISCHARGE_DATE_SETTERS` carries `"Flow coordinator"` and `"Nurse unit manager"`. **`"Ward manager"`
wins. The other two are reconciled to it or removed.**

⚠️ **This was blocking the discharge-date work**, which could not proceed without knowing what to
write into `dischargeDateSetBy` — a field typed `string | null` with no runtime vocabulary at all.
It now has one. **Built? NO.**

### 6. A refusal shows on the board as soon as it is given

**Question:** today a refusal is invisible until every service has answered.

**Ruled:** show it, in full, with the reason. Somebody ringing round needs to know who has already
said no. **Built? NO** — the helper (`refusalLines()`) exists from the refusals-visible work; the
queued row and card do not yet use it.

### 7. A clinician can see a referral they refused

**Question:** it vanishes from their list the moment they refuse it, because that list is a worklist.

**Ruled:** yes — add a short "recently answered" section beneath it.

⚠️ **Do not fix this by loosening `edReferralsFor`.** Its filter to `queued` is a stated contract and
the worklist depends on it. This needs a SECOND selector and a second section. **Built? NO.**

### 8. "Refused" and "cancelled because somewhere else said yes" are shown differently

**Question:** the model records both; only refusals are ever displayed, so a request that ended
because another ward accepted looks on screen as though nothing happened to it.

**Ruled:** show both, labelled differently. **Nobody refused that patient and the record must not
imply anyone did.**

`cancelledAddressings` already exists in `ward-referrals.ts:99` and is used nowhere, while its
sibling `declinedAddressings` is wired in two files and five tests — half a distinction, built and
unused. **Built? NO.**

### 9. A patient on an open status placed in a locked ward: the coordinator is told before confirming

**Question:** the computation exists and was written to be surfaced "so a coordinator sees it before
confirming". It is displayed nowhere, and a note beside it says a replacement superseded it, pending
review.

**Ruled:** yes, show it. **This one was put to him as a clinical judgement rather than a code
question, and answered as one.** Whether `isMoreRestrictiveThanRequired` / `MORE_RESTRICTIVE_NOTE`
or the successor `restrictionNotice` carries it is an implementation choice; that the coordinator is
told, before confirming, is the ruling. **Built? NO.**

### 10. ⚠️ CONNECT the referral-visibility subsystem — OVERRULING the recommendation to park it

**Recommended: leave it parked.** **Ruled: connect it.**

All twelve exports of `ward-referral-visibility.ts` are test-only or file-local; the whole
ward-versus-coordinator visibility engine reaches no screen. Confirmed three times independently.

⚠️ **ONE THING MUST HAPPEN FIRST, AND IT IS NOT A HEDGE AGAINST THE RULING.** Ward Verifier's
distinction: **unwired is not unexposed.** If a ward-facing surface already shows a patient's other
destinations by some other route, then wiring the projection does not close that hole — and the
projection's existence would make everybody believe it had. One screen has been checked and is
clean; a sweep of every ward-scoped surface is running. **Connect after that sweep reports, not
before.**

**And connecting pulls rulings 2, 6, 7 and 8 in with it**, because they all concern what appears on
these surfaces. Sequence: sweep → rulings 2/6/7/8 → connect. **Built? NO.**

### 11. `tests/.fmtbase` is removed

**Ruled: yes.** Five throwaway copies left by a helper. Explicit approval, required because the
protection guard blocks removals under this path. **Done.**

### 12. The seven-module cap is raised

**Ruled: raise it.** `tests/ward-flow-seam.test.ts` caps the ward system at seven interconnected
modules and we have reached it; the alternative was duplicating a panel to get under a counter.

⚠️ **Raised by ONE, with the reason recorded in the test.** The recommendation was "by one"; the
ruling says "raise it" without a number, and one is the smallest change consistent with it. **If
more headroom than that was intended, say so and it is a one-line change.** A cap raised without a
recorded reason is a cap that will be raised again without one. **Built? NO.**

### 13. The "away" group sits LAST on the daily sheet

**Question:** recorded in the code as explicitly unresolved, with a note saying settling it is a
one-line edit — pointing at a constant nothing reads.

**Ruled:** last, after the current occupants. They are not on the ward right now.

⚠️ **The edit is NOT in `AWAY_GROUP_PLACEMENT_UNRESOLVED`.** That constant is read by nothing, not
even the test its own comment names. The real placement is a hardcoded field order in
`dailySheetGroups()`. **Somebody following the comment would edit a value nobody consults and believe
they had ruled.** Remove the constant when the ruling lands. **Built? NO.**

### 14. The production route-reachability work stays parked

**Ruled:** leave it. It belongs in the main application rather than Ward Flow, and it is the only
item on this list that reaches outside this machine — it needs a pull request and provider access.
**Built? NO.**

---

---

## ⚠️ CORRECTION, 2026-09-01: this document's "Built?" column is unreliable, and the reason is not staleness

**Three of the first four rulings examined were already built or partly built**, and every one of the
three was recorded here as `Built? NO`. **A chat acting on this document would have rebuilt working
features.**

- **Ruling 9 — BUILT.** `restrictionNotice` is live at six call sites across `shortlist-panel.tsx`
  and `flow-diagram.tsx`, all rendering to visible text, and the eligibility note sits above the
  footer holding the confirm control. _The coordinator is told before confirming_ — the ruling,
  verbatim.
- **Ruling 13 — ALREADY SATISFIED.** The away line renders after the groups block. Nothing kept it
  satisfied, which is the real work.
- **Ruling 8 — HALF BUILT.** `referral-match.tsx:255` already ships _"Cancelled — this referral was
  accepted somewhere else."_ It is untested; no test anywhere drives a `cancelled` state on a screen.
  Corrected counts: `declinedAddressings` has **one** production call site (the second was its own
  definition) and **three** direct test call sites, though six tests pin decline rendering.

### ⚠️ Why — and the first explanation was wrong, in a way worth recording

The first diagnosis was staleness: the document assessed a symbol that a later change had replaced.
**Measured against git, that is false.** All three symbols entered in **one commit**, `16f33d9c8`:

```
restrictionNotice              16f33d9c8
isMoreRestrictiveThanRequired  16f33d9c8
MORE_RESTRICTIVE_NOTE          16f33d9c8
```

**The dead pair was not superseded. It was written alongside its replacement, in the same commit, and
never wired.** Two approaches to one behaviour landed together and only one was connected.

**So the document did not lag reality. Both symbols were equally old and equally available, and the
assessment picked the one that was never connected** — because the questions came from an audit whose
job was finding dead code, so the dead symbol is what it named.

⚠️ **That makes it an instance of the traps file's entry 12 — a rule existing twice with nothing
comparing the copies — one level up: two plausible symbols for one behaviour, side by side, with
nothing marking which is live.** Reading either one tells you nothing about the other.

### What follows

**The remaining ten `Built?` lines are under re-check**, against the BEHAVIOUR rather than the symbol,
each stating which symbol was assessed and why that one is live. **Until that lands, treat every
`Built? NO` here as unverified.**

**And the dead pair stays.** `npm run check:dead-code-candidate` refuses both — pinned by a committed
test, introduced within the 30-day threshold, and named in three documents. One of those reasons is a
comment match rather than a true pin, and that is not grounds to override the other two: tuning a gate
to admit a diff already decided on is the thing the gate exists to prevent.

### ✅ RE-CHECK COMPLETE — the damage is bounded at three, and the other ten stand

**All ten remaining rulings re-examined against BEHAVIOUR rather than symbol — searching the wording,
the `data-testid`s and the underlying mechanism, not the name the ruling cited. Every one is
genuinely ABSENT.** Rulings 1, 2, 3, 4, 5, 6, 7, 10, 12, 14.

Coverage stated rather than implied: 14 rulings, 3 excluded as already resolved (8, 9, 13), **10
examined, verdict reached on all 10, none unreachable.** Positive control run before any absence was
claimed.

⚠️ **So the fault was real but NOT systemic, and the distinction matters.** All three failures share
one shape — a dead symbol assessed while a live sibling did the job — and all three sit exactly where
the audit feeding this document had been hunting dead code. **The method failed in the one place it
was guaranteed to, and nowhere else.** Anyone told earlier to treat every `Built? NO` as unverified
can stop: only rulings 8, 9 and 13 were wrong.

**Three findings from the re-check worth carrying:**

- **Ruling 10's own justification is the template the other thirteen should have used.** It states its
  measurement with a positive control and names the commit it measured at. Copy its form.
- **⚠️ Ruling 1 is worse than its own description.** It is not that nothing counts one-to-one
  patients — **`Admission` has no field at all recording that a patient needs one-to-one care**, so
  the eligibility gate can only ask whether a ward has _any_ capacity, never whether it has any
  _left_. A fields-with-no-producer problem underneath a counting problem. **Building the count first
  would produce a number with nothing to count.**
- **Rulings 3 and 4 both protect a user action that does not exist.** No form lets anyone type a 4A/4C
  deadline (`dueAt` is seed-only), and there is no "clear discharge date" action in the reducer at
  all. Both are correctly marked absent, but each is a smaller job than it reads: **there is no
  behaviour to preserve, only one to create.**

## What this list is not

**Twelve of the fourteen are unbuilt.** This document records decisions, not behaviour. Anyone
reading it to find out what the app does today will be wrong about twelve things.

**The two with sequencing constraints — 2 and 10 — are the ones where building in the wrong order
produces a defect rather than a delay.** Both constraints are recorded at the code site as well as
here, because a note that lives only in a document is a note the person making the change does not
read.
