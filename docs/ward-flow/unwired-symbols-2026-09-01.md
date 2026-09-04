# What is built, tested, reasoned about — and reaches no screen

**Audit of every exported symbol under `src/components/ward-management/**`, 2026-09-01, at
`5026944a9`.** Read-only. Commissioned after `coordinatorWorklistReferrals` absorbed most of an
evening's reasoning by three chats, every step of which was correct, before anybody asked whether
anything used it.

**524 exported symbols across 83 files.** 347 reachable from an `src/app/**` entry point, 99 used
only by tests, 67 used only inside their own file, **11 used nowhere at all.**

---

## ⚠️ The headline is not in the eleven. It is a whole subsystem.

**Every one of `ward-referral-visibility.ts`'s twelve exports is test-only or file-local. Not one
reaches production.**

`WardScopedDestination`, `WardScopedAddressing`, `WardScopedReferral`, `CoordinatorScopedReferral`,
`wardScopedReferral`, `wardScopedReferrals`, `coordinatorScopedReferral`, `coordinatorScopedReferrals`,
`ReferralDirection`, `referralDestinationDirection`, `coordinatorWorksReferral` (54 lines of doc
comment, 22 test references), `coordinatorWorklistReferrals`.

**The whole ward-versus-coordinator referral-visibility engine is disconnected.** It is extensively
built, extensively tested, and carries more written reasoning than almost anything else in the
project — and no screen asks it anything. `coordinatorWorklistReferrals` did not turn out to be an
oversight in an otherwise-wired module; it is the module.

**Why this matters more than eleven unused helpers.** FD-23 — a ward may not see where else a patient
has been referred — is a privacy rule with an owner ruling behind it. Its computation exists and is
correct. **It is enforced today by the fact that no screen calls it**, which is a different and much
weaker guarantee than the one the tests appear to give. The day somebody wires it, every question
parked on it arrives at once.

⚠️ **This is why the audit's own category scheme understates it.** `coordinatorWorksReferral` sorts as
TEST_ONLY, not UNWIRED, because twelve tests call it. **A symbol with twenty-two test references and
no consumer looks healthier by every automated measure than one with none**, and is exactly as
disconnected.

---

## The traps among the eleven, ranked by how much reasoning they invite

**1. `NoHandoverYet` (`morning-page.tsx:268`) — the sharpest genuinely hidden one.** A fully built,
styled, `data-testid`-carrying component for a deleted feature. The file already warns that
`FrozenMorning` and `buildFrozenMorning` are dead — **and names only those two.** `NoHandoverYet` is
the same deleted cluster and the warning reads as a complete inventory. **A partial warning is worse
than none: it converts "I have not checked" into "somebody checked and this was not on the list."**

**2. `AWAY_GROUP_PLACEMENT_UNRESOLVED` (`ward-daily-sheet.tsx:78`) — an instruction pointing at
nothing.** Sixteen lines headed _"AN UNRULED LAYOUT DECISION, NAMED SO IT IS NOT MISTAKEN FOR A
SETTLED ONE"_, saying a named test asserts the placement so _"a ruling lands in one edit."_ The actual
placement is a hardcoded field order elsewhere. Nothing reads the constant — **not even the test it
names.** Somebody following its instruction would edit a value nobody consults and believe they had
ruled.

**3. `isMoreRestrictiveThanRequired` + `MORE_RESTRICTIVE_NOTE` (`ward-derivations.ts:384`).** Claims
the shortlist and diagram render this beside the passing gate "so a coordinator sees it before
confirming." Neither is surfaced. Lower risk than it looks — `flow-diagram.tsx:503` names the
successor and says these are kept unreferenced pending review — but the subject is a locked-ward
versus open-status distinction, and "pending review" is not a ruling.

**4. `cancelledAddressings` (`ward-referrals.ts:99`) — half a distinction.** Its sibling
`declinedAddressings` is wired in two files and five tests. **The model distinguishes a refusal from
a cancellation-by-somebody-else's-acceptance, and only the refusal is ever shown.**

The remaining seven are housekeeping: two membership validators with no caller yet, a forward-looking
vocabulary whose event is unbuilt, a derived type never used as an annotation, the two already
self-documented as dead, and `movementsByStage`, which this repository's own `AGENTS.md` already
records as a survivor of the 2026-08-20 cleanup sweep — **found independently here, which is a useful
corroboration of both.**

---

## What the method caught that a naive one would not

**Two systematic false-positive sources, both found by the auditor rather than by the brief:**

- **`statistics-claims-register.ts` quotes real source as string literals** — by design, since its job
  is pairing claims with exact substrings verified against disk. It contains zero imports. Every
  symbol name in it is quoted text. It made `admissionStagePosition` look consumed.
- **JSX prose naming a symbol without importing it** — a `{/* … */}` block whose interior lines carry
  no `*` prefix, and `<code>` tags used as on-screen documentation. One of these was
  `<code>wardStatistics()</code>` inside a paragraph that **says outright it has no consumer in the
  app** — the page documenting its own disconnection was the evidence that it was connected.

**And the control was run before any zero was believed**, per rule 7: the same search for
`referralQueueOrder` returned six real call sites across five files.

## ⚠️ And the headline nearly got retracted by a weaker check than the one that found it

Before committing this, Ward Lead re-verified the subsystem claim with
`git grep -l "ward-referral-visibility" HEAD -- src` and got **five files**, including the reducer
and a ward screen — apparently contradicting the audit outright.

**All eleven hits were comments. Zero were imports.** The looser pattern matched exactly the prose
mentions the audit had been careful to exclude, and one of the five was a `.css` file, which cannot
import anything. Re-run as `from "…/ward-referral-visibility"` it returns nothing, with the same
pattern finding three real importers of a neighbouring module as a control.

**The lesson is the direction of the error.** The instinct on seeing a subagent's finding contradicted
by your own quick check is to trust your own. Here the subagent's method was tighter than the
verification, so the sloppier check produced the more alarming answer and would have retracted a true
finding. **A contradiction is only evidence when the contradicting method is at least as careful as
the one it contradicts** — and "I checked it myself" carries no weight if what you ran was weaker.

## ⚠️ The unrendered half is where the defects accumulate, and that is a mechanism rather than a coincidence

Both defects later found in `ward-referral-visibility.ts` — the coordinator projection having **no
field-set allowlist at all**, and the ward allowlist's apparent pin being a type annotation the test
runner never evaluates — **are in the half of the module that reaches no screen.**

Its author's reading, and it is right: **the unrendered half is the half nobody re-reads.** A rendered
mistake is met by whoever opens the page. An unrendered one is met by nobody, and accumulates
precisely the defects that first matter **on the day it is wired** — the day everybody assumes the
guards they can see are the guards that exist.

**So "no consumer" is not a measure of low risk. It is a measure of low SCRUTINY**, and the two point
in opposite directions. That is the strongest argument in this document for why an audit of what
nothing uses is worth running at all, and it is the reason the owner's ruling to connect this module
was correctly postponed rather than merely delayed: **connecting it is the moment its unexamined half
becomes load-bearing.**

**First observed consequence:** `suburb` reaches neither projection. Not by rule — by omission from a
hand-written field list, in a module whose own doc comment says the coordinator "may see everything".
**Anything the model gains from here fails to reach the coordinator the same way, silently.**

## Addendum, 2026-09-04: two more unwired exports in `morning-page.tsx`, and why the print work needed to know

Found while verifying DOM containment for the print-colour fix, not by re-running the audit.

    NoHandoverYet   morning-page.tsx:268   exported. Only reference in src is its own definition.
    ViewControl     morning-page.tsx:470   exported. Only references in src are THREE DOC COMMENTS
                                           in its own file (166, 206, 209).
    ViewButton      morning-page.tsx:509   called only by ViewControl -> unreachable transitively.

Between them they own `noHandoverTitle`, `noHandoverButton`, `viewButton`, `viewButtonActive`,
`viewActiveMark` and `viewExplainer` in `morning.module.css`.

⚠️ **A NAME COLLISION MAKES THE NAIVE CHECK SAY "USED".** `grep -c '\bViewControl\b'` returns 6.
Two of those are a **different, file-local `ViewControl`** in `search-band-directions-mockups.tsx`,
and three are prose. **One symbol, two files, no relationship** — and the count reads as healthy.
This is the same shape the audit already records for TEST_ONLY symbols: references are not consumers.

**Why the print work cared, and the sentence worth keeping.** These classes were counted among
`morning.module.css`'s 21 themed-colour declarers when its print coverage was assessed. Several of
those "declarers" were never a live defect, because nothing renders them. **The raw declarer counts
in that exercise measure CSS rules, not defects** — a distinction that had been quietly lost.

⚠️ **AND A ROW THAT IS SAFE BECAUSE THE CODE IS DEAD IS NOT THE SAME AS A ROW THAT IS SAFE.** The
containment verdict behind the print fix covers **the DOM as it exists today**. Anyone re-wiring the
removed fixed/live toggle or the no-handover branch inherits an **unproven nesting assumption**, and
nothing in either file will say so.

**One genuine mitigation, and only for half of them.** `.viewControl` carries
`display: none !important` inside `@media print`, and `PrintViewMeta` exists specifically to survive
that hiding — so `viewButton`, `viewButtonActive`, `viewActiveMark` and `viewExplainer` could not
print wrong even if `ViewControl` were wired tomorrow. **`noHandoverTitle` and `noHandoverButton`
have no such protection**: they sit outside `.viewControl`, so re-wiring `NoHandoverYet` would put
two unreset declarations into a live printable DOM.

**⚠️ HOW THIS ADDENDUM WAS NEARLY WRONG, WHICH MATTERS MORE THAN ITS CONTENT.** Every claim above
arrived as a subagent's summary and was going to be written down as received. It was plausible, it
came from work that had been commissioned deliberately, and it agreed with what the commissioner
already believed. **Checking it took four commands and changed the finding materially in BOTH
directions** — one symbol called "unwired" is called; four classes called at-risk are protected by a
real mechanism.

**A document is where an unverified relay does the most damage, because it outlives the conversation
that could have corrected it.** A reader in three months cannot tell which sentences were measured
and which were carried. That is exactly the failure this audit exists to record — symbols that look
healthy by every automated measure — so an unchecked claim appended here is the same defect in the
same file, one level up. **Verify before appending, and mark what was measured.**

## Stated limits

- Only symbols with four or fewer outside references were manually checked for prose-versus-code. A
  wired symbol with many references, all of them prose, would not have been caught.
- "Wired" means reachable from some `src/app/**` file. Several chains bottom out at
  `src/app/mockups/**`, which 404s in production. That is the orphan-route question, gated separately.
- The dynamic-reference check is a whole-word literal search. A name assembled at runtime by string
  concatenation would escape it. No such pattern exists in this codebase's style, but grep cannot
  positively rule it out.
