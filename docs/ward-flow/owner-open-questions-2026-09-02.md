# Open questions for the owner — the actual list, written down

⚠️ **THIS FILE EXISTS BECAUSE TWO CHATS GAVE DIFFERENT COUNTS AND BOTH WERE INDEFENSIBLE.** Ward
Verifier said seven, then eight. Ward Lead said seven, then eight, then gave no number.

**The cause was not a miscount. WE WERE COUNTING DIFFERENT POPULATIONS AND NEITHER OF US SAID WHICH** —
Ward Verifier was tracking **wording** items; Ward Lead was tracking **everything awaiting an answer**,
which includes five product questions that are not about wording at all. ⚠️ **Two people, two correct
counts of two different things, one number in dispute.** _State what was counted._

⚠️ **AND THE SECOND DEFECT IS THAT NEITHER OF US COULD DERIVE IT FROM ANYTHING. It was carried in two
heads and in scattered messages. This file is the fix; the count below is reconstructed from the record
and should be checked, not trusted.**

## LIVE — awaiting an answer

| #   | Question                                                                                                                                                      | Kind        | Recommendation given                      |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ----------------------------------------- |
| 1   | Re-approaching a ward that already declined — does it need a written reason?                                                                                  | product     | **No**                                    |
| 2   | Add a demo patient referred to two places at once, so the privacy rule can be seen                                                                            | fixture     | **Yes**                                   |
| 3   | What the referral board says when a service declines something never asked of it                                                                              | **wording** | need one line                             |
| 4   | How many entries "recently answered" holds                                                                                                                    | product     | **Ten**                                   |
| 5   | Should the coordinator see a patient's suburb                                                                                                                 | product     | **Yes**                                   |
| 6   | ⚠️ Stale bed counts — should the system refuse on one at all, so reason 3 has something to answer                                                             | product     | **Yes — wire it**                         |
| 7   | ⚠️ Does _"the bed information is known to be out of date"_ become **two** sentences                                                                           | **wording** | **Yes — split it**                        |
| 8   | The coordinator-facing override wording — _"No bed is pulled"_                                                                                                | **wording** | need one line                             |
| 9   | Ward Builder Three's state-not-instruction refusal text                                                                                                       | **wording** | form is right, words are his              |
| 10  | B2's reason-control label                                                                                                                                     | **wording** | ships behind a marked placeholder         |
| 11  | Whatever sits above the **five `OVERRIDE_REASONS`** in B2's control                                                                                           | **wording** | ships behind a marked placeholder         |
| 12  | ⚠️ **THE DECLINE DEAD END** — with the fabricated default gone, a ward whose reason is not among the **six `REFERRAL_DECLINE_REASONS`** cannot decline at all | product     | **Add a chosen catch-all**, not free text |

### ⚠️ CORRECTED — rows 11 and 12 both said "the six reasons" and meant DIFFERENT LISTS. One was wrong.

**There are FOUR reason lists in this codebase and THREE different sizes. Measured from source, not recalled:**

```
OVERRIDE_REASONS          ward-change-reasons.ts   5   rendered by shortlist-panel.tsx:1319   <- item 11
REFERRAL_DECLINE_REASONS  ward-model.ts            6   rendered by referral-match.tsx:400     <- item 12
DECLINE_REASONS           ward-model.ts            7   rendered by ward-screen.tsx:1291
ED_DECLINE_REASONS        ed-screen.tsx:181            a filtered subset of REFERRAL_DECLINE_REASONS
```

⚠️ **Item 12's six was right; item 11's six was wrong — B2's control is the OVERRIDE control and that list has
five.** **Two adjacent rows in a document going to the owner used the same word for two different things.**

⚠️ **AND THE FIVE-VERSUS-SIX CONFUSION HAD ALREADY COST A CORRECTION TONIGHT (`27205da6d`, "the decline list is
six, not five") — so this is the same ambiguity reappearing one layer up, in the document written to stop
things being lost.** **Both rows now name the CONSTANT, because a number is ambiguous where a name is not.**

**TWELVE LIVE. Six wording, six product-or-fixture.**

## ⚠️ DRAFT SENTENCES PROPOSED — HE HAS NOT APPROVED THE WORDS. NO ROW LEAVES **LIVE** FOR THESE.

**He authorised Ward Verifier to CIRCULATE these as drafts. That is the whole of the authority behind
them.** ⚠️ **Every one ships behind the `PLACEHOLDER VALUES` pattern, never as plain neutral copy —
Ward Verifier applied that rule to its own drafts unprompted: _"a draft that ships unmarked becomes a
decision nobody made."_**

| For                                                 | Draft                                                                                                                                                                                               |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Reason 3 replacement**                            | _"I have confirmed the current bed state with the ward directly"_                                                                                                                                   |
| **Stale-count refusal** _(only if item 6 is wired)_ | _"This ward's bed count was last confirmed at 06:40. Placing now needs a recorded reason."_                                                                                                         |
| **Placement refusal**                               | _"This placement needs a recorded override reason before it can go ahead."_                                                                                                                         |
| **B2 control label**                                | _"Reason for placing this patient despite the mismatch"_                                                                                                                                            |
| **Above the five override reasons**                 | _"This ward does not meet one of the criteria for this patient. Choose the reason it is still the right placement — your choice is recorded against the admission."_                                |
| **Referral board decided note**                     | _"Accepting records which unit has agreed to take this referral, and nothing else. No bed is pulled, no patient is moved, and no transport is arranged from this board — each is a separate step."_ |
| **A service declining something never asked**       | _"This service declined the referral sent to it. It was never asked for a bed, and this decision does not refuse one."_ ⚠️ **Least confident — drafted without seeing the screen.**                 |
| **The decline catch-all**                           | _"Another clinical reason — discussed with the referrer"_                                                                                                                                           |

### ⚠️ MY SPLIT RECOMMENDATION IS WITHDRAWN. Ward Verifier's single sentence is stronger.

**I recommended splitting reason 3 into two sentences, one per honest reading.** ⚠️ **Its version gives
the FORBIDDEN reading no sentence at all** — _"I have confirmed the current bed state with the ward
directly"_ **names the ACT rather than making a claim about the number, so it cannot be stretched to
"it says full but isn't". A phone call is not a bed.**

**My split would have made both readings expressible and relied on the clinician picking the right one.
⚠️ A VOCABULARY THAT CANNOT SAY THE WRONG THING BEATS ONE THAT SAYS IT SEPARATELY.**

### ⚠️ AND ONE PRICE, STATED SO HE BUYS IT KNOWINGLY

**Every decline recorded as the catch-all is INVISIBLE to the statistics that count why wards decline.**
Not an argument against it — **the price. If that reporting matters, the entry needs periodic review to
see whether a pattern hiding inside it deserves its own row.**

### Two are held rather than built, and the distinction is deliberate

**The referral-board sentences REPLACE EXISTING SHIPPED COPY; they do not fill an empty control.** ⚠️
**The placeholder pattern works for new copy that must exist before he rules — a marked stand-in beats
nothing. It does NOT work for replacing text already on a screen that is merely improvable.** **Swapping
shipped clinical copy for an unapproved draft is a net loss even when the draft is better.** Same rule
for the reason 3 replacement, which changes his own approved list.

## ✅ STRUCK — no longer awaiting him

| #      | Question                                    | Why it is closed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------ | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ~~13~~ | ~~The specialling refusal assertion shape~~ | ⚠️ **The escalation EVAPORATED rather than being overruled.** The placement is repaired at the root — the SELECTION, not the movement, so re-ordering the seed cannot bring it back. The evidence is preserved in a test asserting the bench's own premise, so restoring `slice(0, 3)` reddens it. **And Ward Verifier, which raised the item and whose objection was that repairing it would destroy the record, WITHDREW that objection itself** — saying the premise test pins the evidence better than a fixture that had to stay wrong to carry it. **Nothing left for him to decide.** ⚠️ _If Ward Builder Three reads its escalation as undischarged, that outranks this and it has been told so._ |

## ✅ ANSWERED BY THE OWNER

| Question                                 | His ruling                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **The decline dead end** _(was item 12)_ | ⚠️ **ADD A CHOSEN CATCH-ALL. Not free text.** Given directly. **The example wording he offered — _"Another reason — see the coordinator"_ — is being treated as ILLUSTRATIVE, not as his ruling on the sentence; the shape is his decision and the words a ward reads are worth confirming separately.** ⚠️ **And it settles the held decline-default commit BY IMPLICATION rather than by statement — the question only exists if a ward must state a reason at all. Recorded as an implication, not as a sentence he typed.** |

### ⚠️ ONE RIDER ADDED TO AN EXISTING QUESTION, NOT A NEW ITEM

**`ed-screen.tsx:176` already carries this in its own comment:** _"THIS LIST IS KNOWN TO BE INCOMPLETE. The owner has been asked what a psychiatry team actually says when it will not review somebody, and neither survivor may be it."_

**The catch-all will reach that screen automatically** — `ED_DECLINE_REASONS` filters out bed-shaped reasons and a catch-all is not bed-shaped, and the file's comment forbids hand-listing. ⚠️ **THE RIDER: does "another reason" mean the same thing from a WARD as from an EMERGENCY DEPARTMENT?** **A product question, but not a new one — it belongs to the ED question already in his queue.**

## ⚠️ Item 12 is the one that nearly vanished, and the mechanism is the point

**Ward Lead found it, wrote it to Ward Verifier in full, and did not add it to the list. Ward Verifier
read it, called it a good find, and did not count it.**

⚠️ **THE PERSON WHO FINDS AN ITEM AND THE PERSON KEEPING THE LIST BOTH ASSUMED THE OTHER HAD IT.**

**Third instance tonight of one mechanism:** Ward Lead dropped the stale-count wiring it was personally
carrying; Ward Verifier missed the front door its own gate was built for; and now both of them dropped
the same item from opposite ends. ⚠️ **The thing you are carrying feels already-handled BECAUSE you are
carrying it — which is exactly when it stops being checked.** **Two carriers is not redundancy. It is
two people each believing the other is the check.**

## The rule this file enforces

⚠️ **A LIST HELD IN TWO HEADS IS NOT A LIST. It is two lists that agree until they do not, and nothing
detects the moment they stop.**

**Additions go here, in the same act as raising them. A number quoted without this file behind it is a
recollection.**

---

# ✅ FIVE RULINGS, GIVEN DIRECTLY TO WARD LEAD — 2026-09-02, LATE

**His words: _"I agree to the 5 questions your recommendations for all of them now list the wording
issues for me."_** **All five recommendations approved as put.**

| #   | Question                                                   | His ruling (= the recommendation as put)                                                                                            |
| --- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Should a stale bed count stop a placement?                 | ✅ **YES — and reason 3 is rewritten to _"I have confirmed the current bed state with the ward directly"_, which then answers it.** |
| 2   | Should the coordinator see a patient's suburb?             | ✅ **YES**                                                                                                                          |
| 3   | Does re-approaching a declined ward need a written reason? | ✅ **NO**                                                                                                                           |
| 4   | How many entries does "recently answered" hold?            | ✅ **TEN**                                                                                                                          |
| 5   | Add a demo patient referred to two places at once?         | ✅ **YES**                                                                                                                          |

⚠️ **RULING 1 IS THE ONE WITH TEETH AND IT WAS FOUND BY CHECKING, NOT BY ASKING.** `capacity_freshness`
refuses today and is NOT in `SUITABILITY_GATES`, so it is absolute — **which makes reason 3, _"The bed
information is known to be out of date"_, A DEAD OPTION. It names the one gate no reason can answer.**
**Anyone picking it records a justification unrelated to the actual refusal.** His ruling makes the
gate overridable and rewrites the reason as an ACT a person performed, which is answerable.

## 🔴 AND A DISCREPANCY THAT MUST REACH HIM BEFORE ANYBODY BUILDS ON IT

**Ward Builder Three reports FOUR rulings received directly from him in its own session, and one of
them does not match the record I hold:**

> **4. _"a referral must carry the patient's actual legal status"_**

⚠️ **MY RECORDED RULING SAYS THE REFERRAL GAINS EXACTLY ONE FIELD — `patientId` — and names legal
status among the facts that stay refused.** `docs/ward-flow/owner-ruling-patient-link-2026-09-02.md`.

**Two chats now hold two different accounts of what he authorised for the SAME privacy-guarded type.**
⚠️ **This is precisely the failure the guard exists to prevent, arriving through the people rather
than through the code.**

**RULED, pending him: I will NOT act on a relayed authorisation to widen `Referral` a second time,
and I have said so to Three.** ⚠️ **A peer's report of an owner ruling is not the owner ruling — not
because Three would misreport him, but because a truthful relay and a mistaken one are
indistinguishable from here, and this is a clinical privacy boundary.** **Three heard him directly
and may act on what it heard; I may not, and neither may anybody acting on my record.**

**Going to him as a single question: does a referral carry the patient's legal status, in addition to
the patient link?**

**Rulings 1 and 2 of Three's four AGREE with my item 1 above and are not in dispute** — a stale count
becomes refusable and reason 3 means the count is stale rather than the ward looking full. **Its
ruling 1 (the specialling fixture keeps its record and asserts a refusal) touches nothing I hold.**
