# Every clinical word in Ward Flow — for the owner to strike or rewrite

**Read at `2c8f7eb9b`.** Compiled by Ward Verifier, 2026-09-02. No replacements are proposed
anywhere in this document: this is what is there.

**Status column:** did you choose the **shape** (that a list exists, and what kind), the **words**,
**both**, or **neither**? Several here you approved the shape of and never wrote a syllable of.

---

## ⚠️ First: the count is not thirteen

Searched mechanically rather than listed from memory: **42 fixed string lists and 33 label maps**
under `ward-management`. Most are internal codes or screen furniture. **About twenty are words a
clinician chooses from or reads at a moment of decision**, and they are below.

⚠️ **The important correction: roughly half the words you actually see are not in the lists at all —
they are in LABEL MAPS that turn a code like `no_suitable_bed` into "No suitable bed".** A list can
look owner-approved while the sentence on screen is written somewhere else entirely.

---

## A. Lists a clinician picks from

| #   | Where you see it                                         | The words today                                                                                                                                                                                                                           | Status                                      |
| --- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| 1   | **Coordinator overrides a placement** the system refused | The receiving team has agreed despite the mismatch · Clinical urgency outweighs the mismatch · The bed information is known to be out of date · Continuity with a previous admission at this unit · Closer to the person's home or family | **Both**                                    |
| 2   | **Marking a patient urgent**                             | Cannot safely prevent leaving · Cannot be observed safely here · Safety of others in this setting · No psychiatric cover at this site · Needs medical care unavailable here · Escort in place and unsustainable                           | ⚠️ **Shape only — see below**               |
| 3   | **A ward declines a referral**                           | No suitable bed · Age band not provided here · Sex designation unavailable · Secure bed unavailable · Belongs to another service · Referred elsewhere · **Another reason — needs follow-up**                                              | Shape yours; **words not** for the last one |
| 4   | **A ward declines on the board**                         | No bed available · Sex mix · Specialling unavailable · Acuity mix · Capability mismatch · Bed pulled for earlier referral · Out of catchment                                                                                              | Neither recorded                            |
| 5   | **Why a bed is not free yet**                            | Awaiting clean · Awaiting pharmacy · Awaiting placement confirmation · Awaiting service coordination · Awaiting accommodation · Awaiting transport · Awaiting receiving-service acceptance · Awaiting family or carer arrangement         | **Both** — words approved 2026-08-28        |
| 6   | **What a discharge is waiting on**                       | Awaiting ward round · Awaiting family or carer agreement · Awaiting accommodation · Awaiting community team acceptance · Nothing outstanding                                                                                              | Neither recorded                            |
| 7   | **A released bed being made ready**                      | Being cleaned · Awaiting maintenance or repair                                                                                                                                                                                            | Shape yours (your cleaning example)         |
| 8   | **Undoing a pulled bed**                                 | Clinical condition changed · Transport unavailable · **Placed elsewhere** · Admission declined · Pulled in error                                                                                                                          | Neither recorded                            |
| 9   | **Who was contacted on escalation**                      | State bed coordination desk · Duty psychiatrist · Bed management · Nurse unit manager (destination ward) · Escort or transport provider · Other service                                                                                   | Neither recorded                            |
| 10  | **Changing a patient's urgency**                         | Reassessed · New information · Correcting an error                                                                                                                                                                                        | Neither recorded                            |
| 11  | **Changing a legal status**                              | Recorded by treating team · Correcting an error                                                                                                                                                                                           | Neither recorded                            |
| 12  | **Cancelling transport**                                 | Provider unavailable · Patient not ready · Destination changed · Job created in error                                                                                                                                                     | Neither recorded                            |
| 13  | **Who is moving the patient**                            | Ambulance service · Patient transport service · Ward escort                                                                                                                                                                               | Neither recorded                            |
| 14  | **A referrer withdraws**                                 | Another unit accepted · Referrer withdrew                                                                                                                                                                                                 | ⚠️ **Deliberately left to you — see below** |

## B. Sentences a clinician reads at a decision point

| #   | Where you see it                       | The words today                                                                                          | Status                                                                  |
| --- | -------------------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 15  | **The ward's override form heading**   | _Record why this is going ahead anyway_                                                                  | Neither                                                                 |
| 16  | **The refusal that asks for a reason** | _…needs a recorded override reason_                                                                      | ⚠️ The code says "the exact clinical wording is the owner's to confirm" |
| 17  | **Why a ward failed a check**          | Capacity freshness · (and one label per gate)                                                            | Neither                                                                 |
| 18  | **A ward told a referral has ended**   | _Withdrawn — another unit accepted this patient._ / _Withdrawn — the referrer no longer needs this bed._ | ⚠️ **Flagged below**                                                    |

---

## ⚠️ C. The three you should look at first

### 1. You asked for ten urgent reasons. You have six. (#2)

The code says so in its own words: _"PLACEHOLDER VALUES. THE OWNER HAS NOT CHOSEN THESE. HE ASKED
FOR TEN TO BUILD AGAINST."_ You approved the **shape** — a fixed list a human picks, because urgency
outranks every wait and an easy tier inflates until it means nothing — and delegated the cut. **Four
were dropped and you have not seen which six survived.**

⚠️ One dropped entry is worth knowing about: a catch-all, _"this setting cannot continue current
care"_. It was removed because a catch-all gets chosen instead of the specific reason. **The trade is
recorded as reversible: dropping it forces a choice among six, which is better data and worse when
none of the six fits and somebody picks the nearest wrong one.**

### 2. Two sentences state a fact nobody checked (#18)

> _"Withdrawn — the referrer no longer needs this bed."_

⚠️ **Nothing knows that.** A referrer withdraws because the patient improved, went home, went
elsewhere, or died. This sentence asserts a motive on their behalf and puts it in the record.

> _"Withdrawn — another unit accepted this patient."_

⚠️ The file itself says this is **true only conditionally** — true today only because one code path
is the sole writer of these records. A second path with a different cause makes it quietly wrong.

**This is the defect class that already produced two rejected drafts of the decline catch-all** (one
recorded a conversation with the referrer that nothing knew had happened; one told the coordinator to
go and see the coordinator). **These two survived because nobody was looking at them.**

### 3. A word already ruled false is still in another list (#8)

The withdrawal list records a correction: an entry once read _"the patient was placed elsewhere"_ and
was changed, because accepting a patient leaves them **accepted, not moved** — the sentence asserted a
transfer that had not happened.

⚠️ **"Placed elsewhere" is still an option in the pull-release list (#8).** Different screen, possibly
a different meaning — but it is the same word that was ruled a falsehood one file away, and nobody has
said whether it means the same thing here.

---

## D. Constraints already recorded, so you do not spend a ruling re-deciding them

- **Chosen, never typed.** Every list is a picker. Free text was removed deliberately — a fixed list
  keeps clinical narrative out of a synthetic prototype by construction rather than by asking people
  to behave.
- **Operational, not clinical.** The change-reason lists deliberately describe _the bed, the setting or
  the process_, never the person. A reason reading "patient deteriorated" is narrative clinical
  content; one reading "order made" is a claim about the Mental Health Act. Both are barred.
- **One exception, made by you, and the reasoning is worth keeping** (#5): _"Awaiting family or carer
  arrangement"_ overturned that rule on purpose. A discharge held up because nobody can collect
  someone **is** a real reason the bed is not free, and excluding it did not stop it happening — it
  made wards record something else, and the record became wrong. **A wrong reason is worse than a blunt
  one.**
- **The withdrawal list (#14) has no reasons on purpose.** Why a referrer withdrew is a clinical fact
  about a person, so the flow was built and the vocabulary left to you.
- **Provenance, recorded against the bed blockers (#5):** _"these words were proposed by an agent
  session and APPROVED by the product owner. No charge nurse has seen them. If a clinician offers
  different words, theirs replace these verbatim."_

---

## E. What this page does not cover

Screen furniture — mode titles, role names, column headings, status chips — and domain vocabulary you
did not author (cohorts, sexes, suburbs, health services). **Deliberately excluded, not missed.** If
you want the boundary drawn somewhere else, it is one more pass.
