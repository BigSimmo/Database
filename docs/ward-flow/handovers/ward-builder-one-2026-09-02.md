# HANDOVER — Ward Builder One to Ward Lead, 2026-09-02

**Branch `claude/ward-builder-community-route`, HEAD `6702ba7e2`, tree clean.**
**8 ahead / 0 behind master `977018794`.** Measured at the moment of writing, not recalled — and by
the time you read this the position will have moved, so re-measure rather than quoting these.

**Read this from git. Do not wait on messaging** — I have never had a reply from a Ward Lead
session, while three other chats replied within the hour.

---

## ⚠️ 1. THE ONE URGENT THING: MASTER IS RED AND THE FIX IS SITTING UNFOLDED

**You reported master red at `977018794` — `ward-statistics-claims.test.ts`, 2 of 2,196 failing.**

**The fix already exists.** `989bd2e23`, committed before your message arrived, and re-verified
against your current tip after merging it: **19 tests RAN, 19 passed.**

**Master is red because the fix has not been folded, not because it is wrong.**

**Fold `6702ba7e2` and master goes green.** It carries everything below.

---

## 2. WHAT THE FOLD BROKE, AND THE THIRD THING READING IT FOUND

**Ruling 1 inserted `specialling: movement.specialling` between `unitId` and `referralId` in the
admission the reducer builds.** That broke a **contiguous multi-field citation** in the claims
register.

**THE CLAIM SURVIVED.** The reducer still writes `referralId: null` when it builds an admission from
a movement, so the sentence on the page is untouched. **Re-anchored, not rewritten.**

⚠️ **THE THIRD THING — found only because the failure message forbids re-pointing without reading.**
The claim's own doc comment **named the wrong event.** It said `PATIENT_ARRIVED`. The admission is
built in **`PULL_PATIENT`** — the only `const admission: Admission = {` in the reducer, and the only
place one is built from a movement. The later `const departed: Admission` is a spread of an existing
admission, not a build; I checked rather than assumed. **A silent re-anchor would have gone green and
preserved that error indefinitely.**

**The new anchor is the single line `referralId: null,`**, which occurs exactly once in the reducer.
**A contiguous citation spanning several fields is one any neighbouring change can falsify without
touching the claim.**

**Proved, not merely green:** mutated the reducer's `referralId: null` to a minted id →
**2 failed, 17 passed, "ITS EVIDENCE IS GONE"**. Restored and hash-verified.

---

## 3. A SECOND BREAKAGE NO TEST RUN WOULD HAVE SHOWN YOU

**Master was also failing `tsc`**, and a green suite says nothing about it because **vitest runs no
typecheck.**

```
tests/ward-community-corrected-claims.test.ts(552,3): error TS2741
Property 'specialling' is missing … but required in type 'Admission'
```

**`blankAdmission()` is typed as `Admission` specifically so a new field fails to compile there
rather than leaving a stale shape** — its own comment says so, and **it did exactly that. That is how
the breakage was found at all.**

⚠️ **Check whether other `Admission` literals written before ruling 1 have the same gap.** I found
one more (§4) and it was hidden.

---

## 4. A THIRD DEFECT, FOUND BY ASKING "ARE THERE OTHERS"

**`tsc` is clean across the tree — so there is no other instance AS A COMPILE ERROR. But a cast does
not produce one.** A search for `as <ModelType>` over `src/` and `tests/` found **six sites, two
hiding real discrepancies.**

**MINE — fixed at `796169a64`.** `tests/ward-statistics-incoherent-gap.test.ts` built its fixture
`as Admission`. Removing the cast revealed **one phantom field (`cohort`, which `Admission` does not
have) and eight absent required fields.** I removed the cast rather than topping the fields up, so
the guarantee is structural there now.

⚠️ **NOT MINE, AND WORSE — `tests/ward-release-band-day-boundary.test.ts:34`, `as unknown as
BedRelease`.** A **double** cast, which defeats excess-property checking as well as missing-property
checking:

- **Three phantom fields the type does not have:** `blocked`, `blockReason`, `basis`.
- **Six required fields absent:** `blockedBy`, `blocker`, `confirmedBy`, `preparationNote`,
  `preparing`, `waitingOn`.

**Nine discrepancies behind one cast**, and `blocker` is the field the blocked-discharges figure
counts. **Every test using that helper exercises a shape the model does not define. Flagged, not
touched — bed-release bands are outside statistics and community.**

**Four other casts are legitimate and I checked each against its type rather than judging by the
word `as`:** two deliberately spread a real object and cast only so the next line can `delete` a
field, with the intent in a comment; one is a non-null assertion on a `find()`; two cast existing
objects rather than literals.

**The two failure modes differ: a single `as T` still rejects phantom fields on a literal;
`as unknown as T` rejects nothing at all. Search for the double cast first.**

---

## 5. A MERGE HAZARD WORTH A TRAPS ENTRY

**Master and this branch independently added `specialling: false` to the same helper.** The comments
differed, so **git saw two distinct additions, merged both cleanly with zero conflicts, and produced
`TS1117` — an object literal with the same property twice.** Fixed at `6702ba7e2`; I kept master's
block because its comment is the better one.

⚠️ **A clean merge is not evidence two branches did different things. Duplicate independent fixes
conflict only if they are textually identical, and two chats writing their own comments guarantees
they are not.**

---

## 6. A TRAP FOR ANYONE DOING MUTATION WORK ON THIS MACHINE

After mutation-proving the new anchor I restored the reducer — **and the sha256 did not match.**
`git diff` reported **no content change.**

**A Python text-mode write had converted 2,721 line endings to CRLF.** The same had happened to the
register (2,070) and a test file (588). **Converted all three back to LF and the hash then matched
exactly.**

**`git diff` calls that clean. Only the hash caught it.** **Verify a restore by hash, never by diff,
and check `git ls-files --eol` after any scripted write.**

---

## 7. QUESTIONS FOR THE OWNER — none are mine to decide

1. ⚠️ **Cross-page inference on the community hub.** 65 team pages, each listing who was referred to
   that team, all reachable from one index. **Anyone who can open two pages can learn a person was
   referred to both**, without the software ever displaying it. FD-23 governs a _ward-scoped_ viewer;
   **a community team page is a viewer scope nobody has defined.** **Not answerable by any search over
   source.** Currently moot **only because every seeded referral is single-destination** — which Ward
   Builder Two confirmed by hand count, and which the fixture has changed three times today.
2. **Does the claims register cover every figure?** Figure 3 shipped without an entry, judged a
   heavyweight per-entry commitment already covered by its derivation and DOM tests. **The sibling
   figures do have entries.** Parity follow-up, or a decision that the register is not per-figure.
3. **`specialling` on the ED referral form.** Ward Builder Two left it unset-able and flagged it while
   ruling 1 was open. **Ruling 1 has landed and the reducer now enforces one-to-one capacity, so by
   the corrected reasoning in §8 it feeds a gate rather than a display.**
4. **Small:** the community hub reads _"Expected discharge was 1 week ago"_ when overdue — past tense
   rather than the banned word "overdue". **Implementer's choice, not a ruling.**

---

## 8. A RECOMMENDATION I GAVE THE OWNER AND HAD TO WITHDRAW

**I said pre-selected defaults were "tidying rather than a safety matter", because a wrong value is
displayed somewhere and so detectable.** **True of the three controls I had opened; false as a
generalisation.** Ward Builder Two refuted it with line numbers I then verified:
`requiresAuthorisedDestination(movement.legalStatus)` at `ward-eligibility.ts:97` drives the
`authorisation` gate, and `ward.sex` feeds `sex_mix`.

**So a sex and a legal status nobody chose changed which wards came back as eligible.** The form was
defaulting to Female and Voluntary. **The class splits: a displayed audit-trail default is tidying; a
default feeding a gate silently changes the system's answer.** Amended at `63f38f31d`.

---

## 9. A NUMBER I WITHDREW THREE TIMES — do not quote any version of it

**"Roughly half of the 131 findings are not work."** From a sample of 10. **Then I "corrected" it into
an aggregate — 12 of 37 across three chats — which was worse:** 27 of those 37 were **reasoned, not
observed**, and pooling them **manufactured corroboration.** Ward Builder Two states no mutation was
run on any of its 24; Ward Builder Three's are the same.

**And my own base was not clean either:** my 5-of-10 pooled my observed 7 with another chat's
reasoned 3, while I was correcting everyone else for pooling.

**The only defensible statement: one chat ran mutations on seven findings; three were mis-attributed,
one of those with its own stated caveat. Everything else in the network is reasoning.**

⚠️ **What survives, unchanged, is the reformulation — "triage before allocating, because a meaningful
fraction are not gaps." It never depended on a rate, which is why it outlasted three withdrawals.**

---

## 10. STILL UNANSWERED AFTER SEVEN ASKS

**`tests/ward-screen-fd23-leaks.dom.test.tsx` — who owns it?** Same `allUnits()`-only blind spot at
line 214 that I closed at `64b4c1388`. **Ward Builder Two opened the file and ruled it out of its own
scope** (imports `WardScreen` from `ward/ward-screen.tsx`, outside `coordinator/**` and `ed/**`; its
only mention of Two's modules is a comment at line 41 citing a ruling). **By elimination it is
yours.** One file; the shape is already worked out in `64b4c1388`.

---

## 11. HOUSEKEEPING YOU MAY NOT KNOW ABOUT

**Four `trial-merge-*` branches exist**, one of them — `trial-merge-1130` — **checked out in the
master-line worktree** holding a merge of `claude/ward-builder-three`. **I swept none of them.**

⚠️ **The protection hook's own printed remedy does not work.** It says to re-run prefixed with
`CLAUDE_ALLOW_PROTECTED_DELETE=1`; refused as both a prefix and an export. **Branch removal is
currently impossible by the documented route — do not plan a cleanup around it.** Unverified by
anyone else, because verifying it means attempting a protected deletion.

---

## 12. WHAT I BELIEVE AND HAVE NOT RE-CHECKED AT THIS TIP

- **All 34 statistics pages cold-start reachable.** Established several merges ago.
- **The FD-23 sweep of community and statistics found one direct read**, a boolean predicate
  structurally unable to leak. **Measured at `f8cd8d17b`, long superseded.**
- ⚠️ **A self-defeating-guards sweep returned four negatives of UNDETERMINED method.** Its transcript
  was 0 bytes so read-versus-matched cannot be established, and **the wrong method would have produced
  an identical report. Do not treat "those 14 files are clean" as established.**
- **Three of my four mutation proofs from the previous session overstate.** `2baf11a0f`'s "every pin
  fired" is false — an aborting loop demonstrates at most one assertion per run.
- ⚠️ **`BedRelease.waitingOn` never read back, and `dischargeConfirmedAt` having no runtime writer,
  are UNVERIFIED LEADS** from an audit whose parent died before synthesising its children. **Two other
  findings from that same run were false and I withdrew both.**

---

## 13. STATE OF MY HOLDINGS

**Idle.** Community files, statistics surface, the claims register, four traps documents, and this
handover. **Everything allocated to me is complete.** Gate at HEAD: **`tsc` exit 0; 15 files
discovered, 305 tests RAN, 305 passed.**
