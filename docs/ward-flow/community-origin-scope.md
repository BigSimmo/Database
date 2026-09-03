# Scope — a journey that starts at a community team

**Approved by the owner on 2026-09-01.** He was answering my explanation that the app cannot record a
journey beginning anywhere but an emergency department, and he had already pushed back correctly on
the framing: _"lots of patients can start by being referred to ED from community"_. He is right about
the world. This document scopes the change; it does not make it.

**Measured at `6de8017dc`.** Every number below was counted, not recalled.

## Why this exists — the same wall hit twice from opposite directions

**The transport ruling.** He ruled on 2026-08-31 that a community team may arrange transport, because
it sometimes sends people to an ED via police or ambulance. Measured 2026-09-01: not built, and three
blockers deep. The third was the real one — the reducer refuses any movement origin that is not a
hospital emergency department, so there is nothing for a community team's booking to attach to.

**The nine community referrals.** Added to populate the community hub, removed at `fa616d1c9`. Two
attempts to make them work each died on a different invariant: narrowing the bed queue's predicate
would have left them in neither of the coordinator's two lists, and marking them accepted failed the
guard that an accepted referral must name a real unit passing eligibility — a community team is not a
unit.

**Two unrelated guards, one conclusion: the model is ward-bed-shaped throughout.** That is a finding
about the model, not two failed patches, and it is why this is scoped rather than patched.

## What the model says today

- `Movement.originEdId: string` — **required**, `ward-model.ts:415`. Its comment reads _"Where the
  patient physically is."_
- `RAISE_REFERRAL` rejects an origin that is not an emergency department —
  `ward-flow-reducer.ts:441-444`, against `allEmergencyDepartments()`, which derives solely from
  hospital sites' `emergencyDepartment` field.
- **A community team is a NAME AND NOTHING ELSE.** `COMMUNITY_TEAM_PAGES` is derived from the S2015
  catchment table's clinic spellings; a team has an id and a name, no site, no service, no location.

## ⚠️ The question the whole change turns on, and it is not the type

`movementHealthService` (`ward-derivations.ts:178`) resolves origin → emergency department → site →
**health service**. **Twelve call sites depend on it — nine in `src/`, three in `tests/`.**

> ⚠️ **THIS SAID TWENTY UNTIL WARD VERIFIER CHECKED IT, AND TWENTY WAS THE NUMBER THE WHOLE COST
> RESTED ON.** I had counted OCCURRENCES of the name, which include the declaration itself, four
> mentions inside prose comments and four import lines. Counting the thing beside the thing, for the
> fifth time in one day. The corrected figures were re-derived independently before being written here:
> `grep -c "movementHealthService("` minus the declaration gives 12, split 9 and 3.

**A community team has no health service in this model, because the catchment table does not carry
one.** So widening the origin to a union is the easy half; the hard half is that a movement originating
at a community team cannot answer "which service owns this?" — a question twenty places ask today.

Three honest answers, and the owner should choose rather than have me pick:

1. **Give community teams a service.** Truest, and the most work: somebody must map each team to a
   service, which is a clinical routing fact I must not invent.
2. **Let the origin service be genuinely unknown.** **Far cheaper than this document first claimed,
   and the reason is that the unknown state ALREADY EXISTS.** `movementHealthService` is already typed
   `HealthService | undefined` and already returns `undefined` whenever an origin fails to resolve to
   an emergency department. **Option 2 therefore introduces no new state — it only makes an existing
   one occur more often.** Eight of the nine `src` call sites already render an explicit absence with
   `?? "Unknown"`. The discipline is real and stated in those words in four independent files
   (`priority-queue.tsx:71`, `escalation-board.tsx:141`, `ward-management-console.tsx:423`,
   `ward-management-modes.tsx:787`), not one comment I flattered.
3. **Keep the ED as the origin and record the community team as the REFERRER.** Smallest change by
   far, and it may be the right one: a person referred from the community still arrives at an ED, and
   the app's record could legitimately start there while naming who sent them.

**⚠️ Option 3 may satisfy the owner's ruling without any model surgery at all, and it must be tested
against his intent before the other two are costed.** His words were about a community team ARRANGING
TRANSPORT to an ED — which is a journey ending at the ED, not a bed-seeking movement beginning there.
If what he needs is "the record says who sent this person, and that sender can book the ambulance",
option 3 is a field and a permission, not surgery.

## Blast radius, counted

| Thing                                                                      | Count                       |
| -------------------------------------------------------------------------- | --------------------------- |
| References to `originEdId` in `src/` and `tests/`                          | 81                          |
| Files in `src/` reading it                                                 | 17                          |
| Invocations of `movementHealthService`                                     | **12** (9 `src`, 3 `tests`) |
| — of the nine in `src`, already rendering an explicit absence              | 8                           |
| Sites where `undefined` silently changes a COMPARISON rather than a render | **3**                       |

## What this scope deliberately does NOT decide

Which option. That is the owner's, and putting it to him costs one question and saves the difference
between a field and a fortnight.

## What must be true of any option before it is built

- **No invented clinical routing.** If a team's service is unknown, it renders as unknown.
- **No silent widening of a permission.** `tests/ward-event-permissions.test.ts` pins the whole event
  table exactly; any new role reaching an event is named there with its reason.
- **The seed must not record a state the reducer could not produce.** That guard exists because it was
  once violated, and both dead approaches above were caught by relatives of it.

## ⚠️ The silent break, found by Ward Verifier against this scope before anything was built

I asked it to hunt for the case where a widened type passes typecheck at a site that only COMPARES the
value, while changing what the comparison means. It exists, and it is three sites — not eighty-one, and
not one of them is a type error.

- `ward-management-network.tsx:188` — `if (unitService && unitService === movementHealthService(patient))`.
  `undefined` makes the comparison false, so a community-origin movement is silently treated as **not
  matching** the unit's service rather than as unknown.
- `tests/ward-management.test.ts:180` — `unitService !== undefined && unitService !== movementHealthService(movement)`.
  **This is the worse one.** It returns TRUE for an unknown service, so the patient is classified into
  the wrong GROUP rather than merely shown a wrong word — and the test asserting it stays green.
- `tests/ward-management.test.ts:174` — same shape. Both guard `unitService !== undefined`, which
  protects the UNIT side and leaves the MOVEMENT side unguarded.

**Whichever option is chosen, these three are the work.** The eighty-one references are mostly noise;
these three are where the meaning changes silently.

## What no test can settle, and it gates everything above

This document's central claim is that option 3 may already satisfy the owner's ruling. **That is a
claim about what he MEANT, and no gate, test or measurement can settle it** — not by me, not by the
verifier, not by any amount of code reading. It is the one question here that only he can answer, and
it decides the cost of everything else.

**One case to put to him alongside the choice, rather than discover afterwards:** a person a community
team sends who is turned around at the emergency department and never becomes a movement at all.
Option 3 changes who is NAMED on a movement that exists; it does not create one where none does. So
that person's transport booking hangs off nothing, exactly as it does today.
