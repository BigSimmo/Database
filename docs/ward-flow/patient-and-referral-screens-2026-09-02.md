# The patient screens the owner asked for already exist. The gap is somewhere else.

⚠️ **HE ASKED FOR FIVE THINGS TO BE BUILT AND ALL FIVE ARE BUILT, REACHABLE, AND WIRED.** That is
not a reason to dismiss the request. **A request to build something that exists is evidence that
what exists does not do what he expects** — and in this case it does not, for one specific reason
that is a decision of his and not a defect of ours.

## What exists, verified

| He asked for                     | It exists at                                                                           | Reachable how                                                      |
| -------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| A screen to **search** patients  | `/mockups/ward-flow/search`                                                            | In the rail, group "board", labelled _Patient search_              |
| A screen to **add** a patient    | `/mockups/ward-flow/people/new`                                                        | Deliberately off the rail — reached from search's empty state      |
| An **individual patient** screen | `/mockups/ward-flow/people/[patientId]`                                                | From a search-result tile, and after adding                        |
| A **Refer** button on it         | `person-screen.tsx`, `data-testid="ward-person-refer"`                                 | Navigates to the referral form                                     |
| The **referral screen**          | `/mockups/ward-flow/referrals/new` (intake) and `/mockups/ward-flow/referrals` (board) | Board is in the rail; intake off it, same pattern as add-a-patient |

**Thirty-one Ward Flow routes exist in total.** Two chats' branches were checked: neither has
unfolded work on any of these five screens.

⚠️ **METHOD, BECAUSE AN ABSENCE IS ONLY WORTH WHAT THE SEARCH BEHIND IT CAN FIND.** Four independent
methods were used — route enumeration, component-name search, a grep for what the screens SAY rather
than what files are called, and a read of the nav array and its intentionally-unlisted companion.
The enumeration was proved against a screen already known to exist before being pointed at unknown
ones. **The Refer control was then opened by hand rather than taken on the report's word.**

## 🔴 THE ACTUAL GAP, AND IT IS HIS DECISION, NOT OUR OMISSION

**A referral carries no link to the person it is about.** Search a patient, open them, press Refer,
and you arrive at a blank referral form that does not know who you came from.

**This is deliberate, argued, and structurally enforced.** `Referral`'s own doc comment:

> Carries a deliberately tiny, governed set of facts about the person referred and nothing else: no
> name, date of birth, record number, address, diagnosis, or narrative history or treatment.

⚠️ **AND `patientId` IS NAMED BY THE GUARD AS A FIELD IT EXISTS TO CATCH.** `ward-referral-model.test.ts`
asserts the field set structurally, so adding a patient link **fails a test on purpose**. The comment
is explicit that widening the set _"is a governance decision, not an implementation one, and the
structural test is what makes that true rather than aspirational."_

⚠️ **THE SCREEN ALREADY SAYS SO, IN PLAIN WORDS, RATHER THAN IMPLYING A JOIN IT CANNOT KEEP:**

> _"A referral started here is not yet attached to this person. This prototype has no way to join the
> two, so the referral will carry only the facts you enter on it."_

**That note is the conservative-failure rule arriving where it was most tempting to skip.** A Refer
button that implied the referral carried this person's identity would be the screen making a claim
the model cannot keep, and nobody would find out until somebody went looking for a person's
referrals and they were not there.

## THE RECOMMENDATION, AND IT SPLITS INTO TWO DECISIONS HE SHOULD NOT BE ASKED AS ONE

### ⚠️ CORRECTED — MY PREFILL RECOMMENDATION WAS BUILT ON A FIELD SET THE PATIENT RECORD DOES NOT HAVE

**I wrote, one commit ago, that prefilling was the easy win because _"the referral already carries
`ageBand`, `homeRegion`, `suburb` and `sex`, and those are facts the patient record can supply."_
⚠️ **THE PATIENT RECORD SUPPLIES NONE OF THEM.** Measured, not recalled — `Patient`
(`ward-patients.ts`) has exactly five fields:

```
id  umrn  givenName  familyName  dateOfBirth
```

**Occurrences of `ageBand`, `homeRegion`, `suburb`, `sex` and `cohort` in that file: zero, all five.**

⚠️ **I HEDGED THE CLAIM AND THE HEDGE IS WHAT SAVED IT** — I wrote _"only buildable if the
patient record actually holds those facts, and the recommendation is conditional on it"_ while an
agent was checking. **The hedge is now discharged and the answer is no.** Recorded this way rather
than quietly rewritten, because a conditional recommendation whose condition fails is a different
event from a recommendation that was never made.

**1. PREFILL — buildable, but it carries ONE fact, not four.** Age is derivable from
`dateOfBirth` (`patientAgeYears`, and age is deliberately derived-never-stored), so a referral form
opened from a patient could arrive with the age band already chosen. **Home region, suburb and sex
would still be typed by hand every time**, because the person record has never held them.

⚠️ **That is a real but thin win, and it should be sold as one.** It does not deliver
_"search a patient and refer them"_; it saves one field out of four.

**2. THE STORED LINK — his call, and now clearly the ONLY thing that answers his request.** Does a
referral RECORD which patient it came from? **That is the widening the guard refuses**, and with
prefill reduced to a single field it is no longer one option among two — **it is the answer or
there is no answer.**

**Recommendation: yes, store the link, and add nothing else.** A bed-management system in which you
cannot open a person and see their referrals is missing the thing a coordinator most needs at 3am.
The guard was right to stop us and the ruling is his — but the alternative I offered him has
mostly evaporated, and he should be told that rather than given a menu with a dead option on it.

⚠️ **AND ONE CONSEQUENCE HE SHOULD SEE, because it is the reason the guard exists.** A stored
link makes a person's referral history findable. `FD-23` already says a ward may not see where else
a patient has been referred and a coordinator may — so the link must be readable by role, not by
whoever holds the URL. **That is not an argument against it. It is the second half of the same
decision, and shipping the first half without the second would be the leak.**

## What this changes about the request

**Nothing was skipped. The screens are there.** ⚠️ **What is missing is the THREAD BETWEEN THEM, and
the code stopped rather than faking it.** That is the system behaving as designed — and the reason he
experienced it as "not built" is that a flow which forgets the patient halfway through does not feel
like a flow at all.

---

# 🔴 THE FRONT-DOOR FIX CLOSED ONE DOOR AND WIDENED A FOURTH. Reviewed by Ward Builder Two, measured in a browser on the merged tree.

**`b273dc96b` fixes a real defect and its evidence holds under an independent re-run. It must NOT be
recorded as closing the duplicate-record defect.**

## The acceptance test still fails, as predicted

```
"Halowin"  ->  0 people, "Nobody of that name or record number is known", + Add this person
"Marowby"  ->  0 people, same            (Ines Marrowby IS in the system)
"UM10000"  ->  8 people                  ✅ the record-number fix works
"Oquinn"   ->  2 people                  unchanged
```

**A substring match on the record number does nothing for a dropped letter in a name.** Real but
partial, and reported that way.

## ⚠️ AND IT MADE THE DUPLICATE PATH FASTER, WHICH NOBODY NAMED — INCLUDING ITS OWN COMMIT

The Add link now carries `?name=Halowin` and the form fills it in:

```
Given name  = "Halowin"     ⚠️ a misspelt FAMILY name, in the FORENAME field
Family name = ""
warning about similar existing names = NONE
```

⚠️ **BEFORE THE FIX, A CLINICIAN CREATING THE DUPLICATE HAD TO RETYPE THE NAME — AND MIGHT HAVE
TYPED IT CORRECTLY. The fix removed the one accidental barrier to a clean duplicate.** A convenience
that carries a misspelling forward, into the wrong field, with no check.

### ⚠️ The commit names the WRONG limitation, and that is the transferable part

It records, honestly and in two files, that _"a partial record number typed into a name field is the
known limitation of that choice"_. **But all three confusable pairs in the fixture are SURNAMES, and
the empty state is reached overwhelmingly by names.** ⚠️ **So the limitation it wrote down is the
RARE case and the one it did not write down is the COMMON one.**

**The judgement itself is still right** — whole string into `givenName` rather than a whitespace
split, because "Mary Anne" and "van der Berg" are real and a wrong split writes wrong words into an
identity record. ⚠️ **What is wrong is not the choice. It is which risk was written down beside it.**
**A disclosed limitation reads as diligence, and nobody re-checks whether the disclosed one is the
one that matters.**

## The red-before-green claim is TRUE, and was re-run rather than read

Ward Builder Two reverted the fix itself and read the failures by name:

```
× finds a patient by a bare, partial record number
× is case-insensitive on the partial record number too
× finds the same person by a bare, partial record number
  Tests  3 failed | 44 passed (47)
```

Restored, byte-identical by `sha256sum -c`. **The claim I called easiest to overstate is not
overstated.** Its doc-comment read was also verified honest.

## 🔴 THE MISSING PIECE, AND IT IS NOT WHERE ANYONE PUT IT

**Both halves of the planned fix — `nearPatients` in the matching, suggestions on the screen — sit on
the SEARCH screen. The harm happens on the ADD screen.** ⚠️ **A suggestion prevents nothing for the
clinician who did not read it.**

**The missing control is a check at the MOMENT OF CREATION:**

> _"You are adding Halowin. Hallowin (UM100002, born 1961-11-02) already exists — is this the same
> person?"_

**It reuses `nearPatients` unchanged, so it ARGUES FOR the seam rather than against it** — but it
means that function has two callers, not one, and must not be made private to the search screen.

**Ward Builder Three's rule for the suggestion list is better than anything specified for it: never
rank one suggestion above another. A best match is an invitation, on the one screen where an
invitation is the hazard.**

## Assignment

- **`nearPatients` + search-screen suggestions — Ward Builder Three** (`ward-patients.ts`, `patient-search.tsx`).
- **The creation-time duplicate check — Ward Builder Two** (`add-patient.tsx`), consuming `nearPatients` once it lands. **Disjoint files; only `ward-patients.ts` is shared and only Three writes it.**

⚠️ **AND THE ORDER MATTERS FOR HONESTY, NOT JUST FOR CODE: until the creation-time check exists, the
prefill should be understood as having made the duplicate easier to create than it was this
morning.**
