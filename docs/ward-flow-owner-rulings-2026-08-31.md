# Owner rulings, 2026-08-31 — five decisions taken in one answer

**Status: DECIDED.** The owner was given five questions, each with a single recommendation, and
answered **"Yes to all your recommendations."** These are his decisions; the wording of the
recommendations is a session's. That distinction is preserved below because it changes what a later
reader may treat as his language and what they may not.

⚠️ **Ruling 1 is the exception and must not be read as closed** — see below.

---

## 1. The ten urgency-mark reasons — ⚠️ STILL OPEN

**The recommendation he approved was a PROCESS, not a wording:** that he should not author ten
reasons from scratch, but read the ten placeholders, keep the ones he would actually say to a
colleague, and replace the rest.

⚠️ **So the placeholders in `src/components/ward-management/ward-change-reasons.ts` REMAIN
PLACEHOLDERS.** Approving how the words will be chosen is not supplying them. The `⚠️ PLACEHOLDER
VALUES. THE OWNER HAS NOT CHOSEN THESE.` block stays exactly as it is until he gives the list.

**Blocking:** yes — this is the only ruling here that blocks work.

---

## 2. A bed held for a named patient must NOT count as available

**Decided.** Availability currently ignores movement-side holds entirely: `ward-bed-availability.ts`
contains no reference to `bedHold` / `heldFor` / `holdExpires` / `bedHeldUntil` (measured
2026-08-31), so a bed held for a specific person still counts as one a coordinator can be offered.

**Rationale as put to him:** it matches what is true on the ward, and it dissolves the two-meanings
problem in the word "Held" without inventing new labels — the capacity chip and the card beside it
stop disagreeing because the underlying quantity is reconciled rather than relabelled.

**Owner of the change: Ward Core** (`ward-bed-availability.ts` / `ward-derivations.ts`).
**Not** the session that found it. **Consequence to expect:** every coordinator's available-bed
figure changes. That is intended.

---

## 3. A patient every approached ward has declined must be FLAGGED, never auto-escalated

**Decided.** The escalation mechanism already exists and is deliberately human: a person declares the
referral network exhausted and rings the state bed coordination desk (`ward-derivations.ts:614`,
`:711` — `escalated` is a fact about the record, stamped by a human).

**What was missing is the prompt, not the mechanism.** `WF-009` — involuntary, on constant
observation, declined by `rph-adult-secure` (no bed), `gry-adult-secure` (acuity mix) and
`bty-adult-secure` — sits at `destination_review` with `referredUnitIds: []` and no escalation, and
nothing anywhere tells a coordinator he is stuck rather than merely waiting.

⚠️ **The boundary is the ruling: when every approached ward has declined and none remain
outstanding, flag it to the coordinator. Do NOT declare the network exhausted on their behalf.**
Declaring stays a human act, for the same reason the software never marks a patient urgent itself.

---

## 4. The end-to-end walk-through is to be finished

**Decided.** Walked so far: the coordinator hub and priority queue, the ED screen, governance, and
raising a referral end to end (`WF-901`, every field verified round-tripped). Remaining: a
coordinator matching a patient to a bed, the ward accepting, and the patient arriving.

**Timing was part of the recommendation and part of the yes:** after the fold settled, not during it,
because a walk over a moving tree produces findings that expire before they are read.

---

## 5. Ward Flow is NOT to be pushed to a public repository as it stands

**Decided.** This upholds the standing rule ("nothing is ever pushed") against a live proposal to
reverse it.

**The measured reason.** Eight synthetic patients carry a full name, a UMRN and a date of birth
(e.g. `PT-001, UM100001, Talia Halloway, 1988-03-14`). They are invented; **they do not look
invented.** Publishing a psychiatrist's repository containing what reads as a patient list with
record numbers and birthdates puts the burden of realising it is synthetic on whoever finds it.

⚠️ **Blanking one file is NOT sufficient, and this is the part most likely to be got wrong.**
Measured 2026-08-31: the names appear in **five** files (`ward-patients-seed.ts`, `ward-patients.ts`,
`patient-search.tsx`, `tests/ward-patient-model.test.ts`,
`tests/ward-patient-search.dom.test.tsx`), the UMRNs in **two**, and both appear in **three past
commits**. **Publishing a repository publishes its history**, so a clean working tree today still
ships the old versions.

**What he approved instead:**

- **A private repository** if the goal is backup or showing it to someone — none of the above applies.
- **If genuinely public:** replace every name and UMRN wherever they appear, then publish a **fresh
  repository with a single initial commit** rather than carrying this history across.

**Until he says otherwise, nothing is pushed.**
