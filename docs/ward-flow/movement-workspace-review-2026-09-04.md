# Movement workspace review, 2026-09-04

A read-only review of the four tabs of `WardPatientWorkspace` — Overview, Legal & forms, Transport,
Timeline — commissioned after the seven-step track above them was found to have three faults at
once and **nobody had reported it as broken. It simply looked plausible.**

Eleven findings. Every one was read in source **and** observed live at a running server, on five
movements chosen to cover a closed record, a flagged tier-3, a fully-declined-and-escalated, one in
transit, and one with an expired bed pull — plus two demo-clock advances to cross a deadline and
midnight.

**Coverage, stated because an unexamined question and a clean one produce the same silence:** the
four tabs' own code 100%; the derivations they call ~85% traced to source; live on 5 of 50
movements × 4 tabs. Not done: no test run, no narrow-viewport or keyboard pass, no audit of the
eligibility gate semantics.

---

## 🔴 1. A closed movement renders as live and actionable on three of four tabs

**WF-008 holds `closure: { outcome: "did_not_proceed", reason: "Patient self-discharged from ED
before transport arrived" }`.** The page shows: _"Current stage: Accepted, awaiting bed"_,
_"Eligibility: Eligible now"_, _"Transport: Not yet requested"_, and no closure marker in the header.

The closure appears in three places only — the Timeline tab, and as a parenthetical inside two
panels two-thirds down the page, where it exists to explain why a button is missing.

**A coordinator would book transport for a patient who is not there, and leave a bed held.**
`isOpen()` exists in `ward-derivations.ts:205`. This workspace never calls it.

## 🔴 2. A voluntary patient is offered locked wards as "Eligible", with the legal warning stripped

**WF-008 is `Voluntary` on an `Open` ward. Alternatives lists "RPH Adult Secure — Eligible now" and
"FSH Adult Secure — Eligible now".**

`restrictionNotice()` returns, for exactly this pairing: _"Voluntary patient on a locked ward —
review legal status before admission."_ **Three other surfaces render that text** — the
coordinator's shortlist, the flow diagram, and the ward screen. **This workspace calls the same
function only to reorder the list and throws the sentence away.**

⚠️ **Detaining a voluntary person on a locked ward without an order is detention in fact, and this
is the one screen in the app that shows the option without the warning.**

## 🔴 3. Statutory form deadlines print with no day and no breach state

`legalFormReadinessLine` uses `formatInstant`, which discards the day (`instant % 1440`).

**Observed on WF-004, a transfer order 4C.** At 03:48 it read _"due 08:48"_. The clock was advanced
to 10:50 — two hours past — and it read, unchanged and unmarked, _"due 08:48"_. Advanced past
midnight to 04:52 the next day, **twenty hours overdue, it still read "due 08:48"** — which now
scans as four hours in the future.

`clockState()` and `formatInstantWithDay` both exist and are used by the coordinator's queue, which
at 10:50 was showing _"Legal timing breached · WF-004"_ **while the patient's own legal tab showed a
plain grey line.** The line directly beside it — _"Movement opened 20:58 yesterday"_ — uses the
day-aware formatter, so the inconsistency sits on one screen.

## 4. The Transport tab makes four claims about itself and none is true

It states: _"Provider, ETA, risk documentation and legal-form readiness are visible here."_

- **Provider** — dropped by `transportStatusLabel` once a job is en route, collected, arrived or cancelled.
- **ETA** — no such field exists anywhere in the model.
- **Risk documentation** — does not exist. The nearest thing, `escortRequired`, is never rendered on any tab.
- **Legal-form readiness** — not on this tab.

**Observed on WF-006, a secure involuntary patient in transit with `escortRequired: true`.** A
coordinator checking whether an escort is needed reads that risk documentation is visible here, sees
nothing, and concludes none is required. **It is.**

## 5. "Not yet requested" collapses three situations, one into its opposite

`transportStatusLabel(undefined)` asserts a booking is outstanding. **On WF-004 the Readiness list
says "Transport: Not yet requested" while four lines below the same screen says "Current blocker:
Escort provider organising secure transport."** The screen contradicts itself.

`MovementTransportNeed` and `transportNeedState()` exist precisely to keep _not needed_ / _not
booked_ / _not recorded_ apart, and the model's doc comment forbids collapsing them. This workspace
never calls it. Today it is an unearned claim on all 50 movements and becomes an outright falsehood
the moment anything records `needed: false`.

## 6. "Tier N leads" contradicts two other statements on the same page

**WF-018, one page, one instant:** summary card _"Tier 3 leads"_; urgent-flag panel _"This patient
leads the queue ahead of every urgency tier, including tier 1."_ **WF-008:** _"Tier 3 leads"_ beside
_"This movement is closed … it is not in the queue at all."_

The phrase is a three-word compression of a sentence about the **sort key**, placed under a
patient's eligibility verdict where it reads as a statement about **this patient's position**.

## 7. An expired bed pull is never stated

**WF-004 carries `pullExpiresAt: NOW_ANCHOR - 10` — expired on every page load, permanently, because
the fixture is re-anchored.** The page says _"Current stage: Bed pulled"_. The coordinator's inbox
raises _"Bed pull expired"_ for exactly this condition. **The workspace reads `pullExpiresAt`
nowhere at all.**

## 8. The "Synthetic audit timeline" is not the audit

It emits only opened, legal-status changes, declines, four transport stamps, and closure. **Silently
omitted:** escalations, examinations, urgency changes, released bed pulls, cancelled transports,
withdrawn referrals, the acceptance, the bed pull, transport requested, and every blocker record.

**On WF-009 — five declines, an escalation to the state bed coordination desk, and an examination —
the timeline showed the five declines and nothing else.**

Its decline lines also read _"Declined by referral: no bed"_, never naming the declining unit and
phrasing it as though the referral declined. The panel immediately below gets it right. The timeline
uses `reason.replace(/_/g, " ")` while `declineReasonLabels` sits unused twelve lines away.

## 9. "Alternatives" shows three of sixteen, unmarked, including wards that already refused

**On WF-009: "RPH Adult Secure — Already declined this movement", "SCGH Adult Open — Open ward does
not meet a secure requirement", "FSH Adult Secure — Already declined this movement"** — under a
heading calling them alternatives, on a page whose escalation panel says all five secure units were
tried. No statement that the list is truncated. No empty state (latent, not reachable today).

## 10. "Response" labels the free-prose blocker as the receiving unit's answer

`<dt>Response</dt>` sits directly beneath `<dt>Referral</dt><dd>{destination.name}</dd>` and renders
`patient.blocker`. **On WF-004: "Referral: BTY Adult Secure / Response: Escort provider organising
secure transport."** A coordinator would conclude Bentley said that. `blocker` is free prose about
what is holding the movement up; the unit's answer is `declines` / `acceptedUnitId`.

## 11. The tabs are not tabs, and one is pure duplication

The Overview grid renders **unconditionally** — byte-identical under all four selections, confirmed
in the live DOM. The other three tabs append below it rather than replacing it, and clicking
"Overview" while active does nothing.

The **Legal & forms** panel duplicates two lines already in the Readiness list directly above and
contains nothing else. Meanwhile `destinationNoLongerLawful()` — the mid-flight _"this patient's
status now requires an authorised destination and their accepted ward is not one"_ exception — is
not on the legal tab at all.

---

## The nulls, named

- **Facts about other patients on one patient's page:** one hit, the already-known `stageSummaries`
  call. **Partial hit:** the eligibility gates print _"7 male occupants already"_ and _"2
  allocatable"_ without naming the ward, so they read as assertions about this patient. Otherwise
  **nothing found** — all five reads of the full movements collection were checked.
- **Controls not doing what they promise:** the two already known. **Nothing found otherwise, and
  this is genuinely clean** — the four interactive controls were traced handler-to-reducer. Legal,
  Transport and Timeline contain no controls at all.
- **Absence stated or blank:** two hits. **Nothing found otherwise, and this area is unusually well
  done** — six distinct explicit-absence strings, all correctly separating "the record holds
  nothing" from "the answer is no".
- **Unreachable or dead:** one hit, the Legal tab. **Nothing found otherwise.**
