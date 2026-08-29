# Plan — the universal referral system

Written 2026-08-30 after the owner redirected the referral work. Supersedes
`plan-phase-9-departments.md`, which was written before the patient-centred redesign and is now
wrong in its entry point. **Correct that document's body when this lands; do not leave it under a
note saying it is superseded** — a stale section under a fresh correction stays quotable.

## What the owner asked for, in his words

- _"I want a universal referral system."_
- _"The workflow is ED hubs and Ward hubs which take incoming referrals and can make outgoing
  referrals… For wards outgoing referrals to community."_ A hub is the department's own page: for
  a ward, the existing page with the beds; for an ED, the page showing referrals in and out.
- _"The referring page should appropriately route patients to the correct inbox from the single
  referring page."_
- _"Wards can also refer to ED for medical issues as well."_
- _"It is opened when clicking on a patient… a patient is searched via the system. A patient will
  then pop up. If no patient pops up, they can be added."_
- _"Consider building a useful high yield patient screen for when patients are individually
  clicked on in the hubs."_
- Search key: _"Either the patient UMRN or the patient Name, Age and DOB. Note to search patients
  with related name from this."_
- _"I am going to connect this to a database. Using supabase. Leave it for now and just build the
  structure. So yes, you will store all this information."_
- Coordinator: _"It is the coordinator who has the ability to override wards and accept a patient.
  AI and catchment will automatically route patients to required or possible wards, however things
  may come up and the coordinator is about ensuring everything flows smoothly with overarching
  control."_
- _"if referred to more than 3, a reason has to be given as to why… also if referred out of
  catchment ward… a reason as to why"_
- Ward→ED medical: _"shows as an incoming referral in the psychiatry ED but it is somehow flagged
  as medical only just so psych are aware of it."_
- _"an acceptance automatically drops any other outstanding referrals for the patient"_
- _"Update all state documents. The system needs to store patient information. Correct all
  documents"_

Community teams: **parked as future work by the owner.** Ward→community destinations are built
and addressed; the receiving hub is not.

## Rulings already made, and where they came from

- `FD-11` a referral names its destination — owner, direct.
- `FD-13` the five-fact rule is retired; exactly one free-text story field — owner, direct,
  recorded as a REVERSAL of his own standing refusal rather than as compliance with it.
- ED escalation: statewide; declared, never calculated; stood down by the raising department or
  the coordinator only.
- Sex stays Female or Male. `FD-4` closed **by rejection** — do not reopen it as an oversight.
- An ED may close to all admissions, never refuse a named patient (`FD-3`, decided).
- A ward→ED medical trip does **not** free the bed. My ruling, his to overturn; and the board's
  tile should show the person is away — a flag on the admission, not a new bed state.

## The two things blocking, both with the owner

1. **The catchment map** — which wards serve which regions. Clinical knowledge; will not be
   invented. Blocks catchment routing and the out-of-catchment reason, nothing else.
2. **`REFERRAL_SOURCES`** — once a referral is raised from a hub, the source IS the hub, while the
   existing list (`community`, `crisis_service`, `police`, `ambulance`, `inter_hospital`) is a list
   of **external referrers**. Two different kinds of fact about to share one field. Does not block:
   destination is buildable first and the source answers afterwards without rework.

---

## Build order

### Wave 1 — the three approved corrections (brief already written)

Transport starts unanswered · the sent-confirmation pinned by a test · a guard that an ED may close
to all but never refuse a named patient. Independent of everything below. Restarts from
`wave1-owner-corrections-brief.md`.

### Wave 2 — the patient record (the foundation; everything else needs it)

A `Patient` entity, synthetic throughout: UMRN, name, date of birth, age band, sex, home region.
Stable id. Structured so a database backs it later — **no Supabase work now, and nothing of mine
touches a provider.**

- **Identity lives ONLY on the patient.** A referral points at a patient id and never copies a
  name onto itself. The existing allowlist guard on `Referral` stays live and re-pointed, not
  deleted — so a later attempt to copy an identifier onto a referral still fails.
- **Duplicate warning on add**: a close match on name + date of birth warns before creating a
  second record. Duplicate patient records are how these systems rot.
- **Document correction lands in the same commit.** Several documents currently claim the system
  holds no patient identity. That becomes false here. Correct the body of each; the true claim
  becomes "identities are synthetic, and a referral never carries one."

### Wave 3 — search, and the patient screen

Search by UMRN, or by name with **forgiving matching** so a partial or approximate spelling
returns candidates. Results show name, age and date of birth to confirm the right person. No
match → add.

Patient screen (his "high yield"): where they are now and how long · open referrals and who has
answered · tentative diagnosis · what they need in a bed · history of moves · actions: refer on,
withdraw a referral, mark arrived.

- **Exactly one free-text field exists in this system and it is the referral's story field.** The
  patient screen is the most likely place in the whole prototype for a second "notes" box to feel
  necessary. It is deliberately absent, and that must be a comment in the code, not only here.
- Open referrals sit at the top, and raising a second warns.
- **Rule 1 of the instant sweep applies hardest here**: nothing on a patient's history may render
  a bare time without saying which day. A patient screen is all history.

### Wave 4 — the referral gains a destination

`Referral` carries where it is going. The downstream fork is **not settled and must not be settled
inside a screen design**: whether `Movement.referredUnitIds` generalises beyond units, or a
destination becomes a tagged union of kinds. **An ED is not a unit and a community team is not a
unit** — that type does not carry the owner's model unchanged.

- Referral carries its **purpose**: seeking a bed, or medical assessment.
- Ward→ED medical arrives in the psychiatry ED's incoming list, **flagged medical**, and is
  **actionable by nobody** — an ED cannot decline a bed referral and nobody can even accept a
  medical one. **If a screen offers an action on it, the screen is wrong.**
- **Acceptance drops every other outstanding referral for that patient**, not only the parallel
  ward ones.
- Breadth: `PARALLEL_REFERRAL_CAP = 3` applies. Wards may take up to three at once; ED and
  community destinations are always one — you do not shop a patient around emergency departments.

### Wave 5 — the hubs

ED hub: referrals in, referrals out. Ward hub: widen the existing "This department's patients"
filter — **never a separate incoming-referrals panel**, which re-creates the inbox this system
exists to replace and puts one person in two places on one screen.

ED index page modelled on `wards/ward-index.tsx`, and **honouring his ward-index ruling: no bed
counts, no availability, no pressure colour.** Two surfaces answering one question in wording that
can drift is this project's most reliable defect.

Hand-maintained counts that move, each only for a verified reason: `ward-nav.test.ts:128 toBe(23)`,
`ward-landmarks.test.ts:166 toBe(23)` and `:181 toBe(22)`, the repo-awareness routes count, the
generated site-map lines, and `ward-flow-service-coverage.test.ts:57` if a screen groups by health
service — the ED index will.

### Wave 6 — routing, reasons, and the coordinator

**Routing is deterministic, not a model.** Catchment + what the patient needs in a bed + distance,
all of which exist or are addable, and the screen says WHY a ward is suggested. A rule a clinician
can read is a rule they can disagree with; a suggestion that cannot explain itself is clinical
decision support, which is a larger claim than this prototype should make. **It ranks beds, never
people** — the line held everywhere else.

**Reasons must be RECORDED, and today's are not.** `shortlist-panel.tsx:373-381`: the coordinator's
override requires a typed reason, then puts it in `setOverrideRecord` — component state. The
dispatched `REFER_TO_UNITS` does not carry it. **It is gone on refresh and was never in the
event.** Building the two new reasons the same way would be theatre.

- Reason for going beyond three, and reason for an out-of-catchment ward: **fixed lists, not free
  text**, per his own typed rule, and carried in the event.
- `DB-15` already decided four override reasons — agreed mismatch (more restrictive), clinical
  urgency, out-of-date bed information, closer to home. Decided, unbuilt. Build them here.
- `PARALLEL_REFERRAL_CAP` becomes soft (three, or more with a reason). **Keep
  `tests/ward-legal-figure-guard.test.ts` intact** — it is what proves that number is service
  courtesy and not a Mental Health Act figure.
- **Catchment was deliberately removed as a decline reason.** A ward may not refuse someone for
  being out of catchment. Catchment guiding where a referral goes is compatible; it must not creep
  back as grounds to say no. There is a live assertion against the word — keep it.

### Wave 7 — ED escalation

Declared, never calculated. No threshold, no count of formed patients, no named level — computing
"escalated" from a patient count decides a Mental Health Act threshold, and this codebase has
already deleted one hallucinated MHA figure. Statewide. Stood down by the raising department or the
coordinator only; a third department attempting it must fail, and that must be a test rather than a
UI affordance that happens to be absent.

### Wave 8 — retire the ED's own form. LAST, alone, and carefully.

`ward-ed-referral-form` (`ed-screen.tsx:359`, introduced `66c4f7b80`, 2026-08-22) dispatches
`RAISE_REFERRAL` and creates a **`Movement`**. The shared form (`c12d73eb7`, 2026-08-28) dispatches
`RECEIVE_REFERRAL` and creates a **`Referral`**. **No document ratifies two forms** — the ED screen
was built first and Phase 7 never reconciled against it. His own words at the time were _"same
stages, different front door"_.

**Every ED pressure figure is computed from the `Movement` path.** Replacing it carelessly changes
the coordinator's numbers silently. So: measure `edPressure` before and after and compare
explicitly; this wave ships alone.

---

## Traps carried into every wave

- **Reasons that are collected and not recorded.** The existing override proves the shape.
- **Bands that assume today.** `["now","by-midday","by-1600","tonight"]` renders a 09:00-tomorrow
  discharge as _"tonight"_. Any window widened past today, over bands that assume today, fails
  silently and in the direction of false urgency. Same defect as `Instant` meaning two things —
  a value crossing a day boundary into a representation with no room for days. **One concept, not
  two fixes.**
- **Pickers derived from the exported array, never a hand-written list.** A hand-written
  `COHORT_OPTIONS` silently omitted `"Youth"`, and widening the union could never fail.
- **`ReferralDraft` is not `Referral`.** Two types sharing a stem; open the declaration.
- **The two owner-chosen label pins** — "Send referral" and "Decline referral". If one goes red
  during this work, **stop and take the wording to him.** Do not update the test to what the new
  code prints. The remaining eighteen unpinned labels are DECLINED, not a backlog.
- **Mockup exemption is narrower than `CLAUDE.md` says.** `src/components/ward-management/**` is
  NOT lint-exempt; only route files and `*-mockups.tsx` are.
- Never invent a Mental Health Act figure, timeframe, threshold or duration.
- Production tap targets `min-h-12` (48px). Never 44px.

## Verification, unchanged

`GATE_RECEIPTS=refresh`; suite discovered from disk; quote `Test Files N passed (N)` and
`Tests N passed (N)` as absolute numbers, never the exit code and never a ratio. Mutation-prove
every new assertion, predict the failure message first, and treat an unexpected number or an
unexpected failing test as a second finding. Documentation lands in the same commit as the change,
and corrections rewrite the body rather than prepending a note.
