# Transport — design

**Status:** design complete, nothing built. **Decisions:** `TR-D1`…`TR-D4`, findings `TR-F1`…`TR-F3`.
**Register of record:** `docs/ward-flow-ledger.md` on `claude/Ward-design`. This document holds
reasoning; the ledger holds identity and status. A decision cited here without a matching ledger row
is a defect in one of them.

## What was already built, and why that matters

**`TransportJob` exists** (`ward-model.ts:281`) and carries `provider`, `escortRequired`,
`formRequired?`, and the lifecycle instants `acceptedAt`, `enRouteAt`, `collectedAt`, `arrivedAt`,
`cancelledAt`. **`MovementUndo` already supports `transport_cancelled` with a reason**, so cancelling
a transport no longer requires closing the movement outright.

**So the open question the owner delegated is narrower than it reads** (`TR-F1`): the data exists.
**What is undecided is who acts, and what the surface is.** This document answers those and fixes
three defects found in the existing model.

## Who does what

**The sending ward or ED books the transport** (`TR-D1`) — the team currently holding the patient.
They are the only people who know whether an escort is needed and whether the patient is settled
enough to travel, and `escortRequired` demands exactly that judgement.

**The receiving ward signals when it is ready, and that prompts the referring clinician**
(`TR-D4`).

```
ward accepts  →  ward signals readiness  →  sending team books  →  patient collected  →  arrived
                        (prompt)              (owns the job)
```

⚠️ **The prompt is not a transfer of responsibility.** The sending team books and continues to own
the job. A design where the prompt substitutes for ownership reintroduces the gap `TR-D1` names.

### The incentive problem, stated because it was accepted rather than avoided

**The sending team has the weakest reason to chase a booking: the patient is leaving them either
way.** The owner chose this arrangement with that cost on the table, so the design works against it
rather than assuming goodwill. Two mechanisms:

1. **`TR-D4`'s prompt** — they are not relying on their own memory; the receiving ward triggers them.
2. **The job stays on the sending team's board until the patient physically leaves** — not until it
   is booked. **A booking that disappears from the booker's view the moment it is made is a booking
   nobody is watching.**

## The three defects this design fixes

### 1. The provider is never chosen by anyone (`TR-F2`)

`ward-flow-reducer.ts:703` creates **every** transport job with `provider: "State patient transport
service"` hardcoded. The seed at `ward-movements.ts:140` uses `"St John WA"`. **Two names, no
vocabulary, nothing preventing a third** — and it renders straight to screen
(`live-tracker.tsx:116`) and into labels like *"St John WA accepted, awaiting departure"*
(`ward-derivations.ts:218`).

**So the screen states who is collecting a patient, and no user chose it.**

**Fix (`TR-D2`):** `provider` becomes a chosen option from an exported array of **obviously generic
placeholders** — ambulance service, patient transport service, ward escort, and so on. Recorded as
placeholders in the `CM-8` sense: **the owner's to replace, findable in one place, never presented
as the real set.**

- **Derived from the exported array, never hand-listed at a call site.** The `COHORT_OPTIONS`
  precedent: a hand-written list in `ed-screen.tsx` silently omitted `"Youth"`, so widening the
  union could never fail.
- ⚠️ **This removes two real organisation names from the prototype.** A demonstration should not
  state operational facts about real bodies that nobody has agreed to — same family as `PD-2`.

### 2. `formRequired` is a bare string, and it names a legal artefact

Worse than `provider`, because a form code is a legal document reference. **`SELECTABLE_LEGAL_FORMS`
already exists** as the controlled list it should draw from. **No figure, timeframe or threshold
from the Mental Health Act is introduced by this** — the field references a form that is already
selectable elsewhere, and nothing new is invented.

### 3. The lifecycle is not encoded in the type (`TR-F3`)

The instants are independent optionals, so `collectedAt` without `enRouteAt` is representable, as is
`arrivedAt` on a job that was `cancelledAt`. **The order is the fact, and a bag of optional instants
cannot express an order.**

**Nothing currently writes them out of order — this is a shape that permits it**, and a screen
reading those fields will render whatever it is given. An out-of-order job looks like a display
glitch rather than a bug.

**Fix:** the reducer is the only writer, and it refuses a transition whose predecessor is unset.
`R9` shape — **assert the impossible states are unreachable, rather than checking the reachable ones
look right.**

## The transport surface

**Not a separate hub.** Transport appears on the board of whoever owns it at that moment:

| Where | Who sees it | What they see |
| --- | --- | --- |
| **Sending team's board** (ED hub outbox, ward screen) | The team that must move the patient | The job, its state, and the action to book — **until the patient physically leaves** |
| **Receiving ward's board** | The ward expecting the patient | That a patient is coming and where they have got to |
| **Coordinator's board** | The coordinator | Everything, as now |

⚠️ **A dedicated transport-officer screen was rejected** (`TR-D1`) — a role that may not exist in
the service. **If it is ever wanted, it is a view over the same jobs, never a second place they
live.**

### Consequence for the ED Psychiatry Hub spec (`TR-D3`)

For an ED patient referred on to a ward, **the ED psychiatry team is the sending team.** So the
hub's outbox is **not merely a list of patients referred on — it is a list of patients this team
must still move.** The spec at `91bc7ebd8` does not say this and **must be updated before it is
handed to a builder.**

## Refusals that apply

- **No invented figures, timeframes or thresholds.** No transport SLA, no "overdue" flag, no
  colouring of elapsed time against a limit nobody supplied — same as `P9-D3`.
- **No free-typed values.** `provider` and `formRequired` become chosen options; nothing else on a
  transport job accepts typing.
- **No real organisation named** until the owner supplies the list.
- **Cancellation keeps its reason** — `MovementUndo` already requires one, and that must not be
  weakened into an optional field.

## What this design does not decide

- **The real provider list.** Placeholders until the owner supplies it (`TR-D2`).
- **Whether transport exists for non-bed movements** — a ward→ED-medical trip (`FD-19`) keeps the
  bed and may or may not raise a job. **Not ruled on, not inferred.**
- **Who cancels, and whether a receiving ward can.** Only the sending team books; **nothing says who
  may cancel**, and `MovementUndo` does not constrain it.
