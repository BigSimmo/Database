# Care Plan — implementation handoff

What was built, where it lives, what it deliberately does not do, and what would have to
be true before any of it went near a patient.

**Binding sources.** The specification
(`docs/superpowers/specs/2026-08-20-care-plan-design.md`) is the product authority; the
glossary (`docs/care-plan-context.md`) is the terminology authority; the build ledger
(`docs/care-plan/sdd-ledger.md`) holds every ruling and every deferred finding. Where any
of them disagrees with this file, they win.

---

## What this is

A synthetic, memory-only, offline prototype of a tool for finding people with recurrent
psychiatric emergency-department presentations and making their current management plan
easy to find and use in the first minute of an ED assessment.

It is an interaction and domain model. It is **not** validated clinical decision support,
not a clinical record, and not connected to anything.

## The reset boundary — the most important sentence in this document

**Nothing is saved. Reloading any page starts over.**

There is no database, no storage, no cookie holding record state, no network call and no
provider of any kind — including for the Patient Plan, whose conversion is a pure
deterministic function that runs in the page. Every record is fictional and every
identifier carries a `SYN-` prefix. A refresh reconstructs the fixtures exactly, so two
runs of the same address produce the same screen and the same sheet of paper.

Two consequences worth stating plainly, because they surprise people during a
demonstration:

- Anything typed into the prototype is lost on refresh, including a draft being shown to
  somebody. The shell says so in those words, next to the synthetic-data marker.
- A browser-level navigation (typing an address, opening a link in a new tab) is a
  reload and therefore a reset. Moving between routes by clicking keeps the session.

## Routes

Twenty-one, all under `/mockups/care-plan`, all behind the developer-area gate and all
404 in production. Addresses are built in exactly one place —
`src/components/care-plan/mockups/routes.ts` — so no page file repeats a synthetic
identifier and no link can drift from the route it names.

| Route                                                | Heading                            |
| ---------------------------------------------------- | ---------------------------------- |
| `/`                                                  | Home                               |
| `/patients`                                          | Patients                           |
| `/patients/[patientId]`                              | Patient overview                   |
| `/patients/[patientId]/management-plan`              | Management Plan                    |
| `/patients/[patientId]/management-plan/edit`         | Draft Management Plan Version      |
| `/patients/[patientId]/management-plan/review`       | Review submitted version           |
| `/patients/[patientId]/management-plan/print`        | Print Management Plan              |
| `/patients/[patientId]/patient-plan`                 | Patient Plan                       |
| `/patients/[patientId]/patient-plan/edit`            | Draft Patient Plan                 |
| `/patients/[patientId]/patient-plan/print`           | Print Patient Plan                 |
| `/patients/[patientId]/safety-plan`                  | Personal Safety Plan               |
| `/patients/[patientId]/safety-plan/edit`             | Draft Personal Safety Plan Version |
| `/patients/[patientId]/safety-plan/print`            | Print Personal Safety Plan         |
| `/patients/[patientId]/presentations`                | ED Presentations                   |
| `/patients/[patientId]/presentations/new`            | Record ED Presentation             |
| `/patients/[patientId]/presentations/[presentation]` | ED Presentation                    |
| `/patients/[patientId]/history`                      | History                            |
| `/reviews`                                           | Reviews                            |
| `/team`                                              | Team                               |
| `/governance`                                        | Governance                         |
| `/system-states`                                     | System states                      |

A query string may name a deterministic specimen scenario and nothing else — never a
name, a contact detail or any record content.

## Fixtures

Five synthetic patients, all fictional:

| Identifier        | Name          | What it demonstrates                                                 |
| ----------------- | ------------- | -------------------------------------------------------------------- |
| `SYN-PATIENT-001` | Rowan Sample  | Current Plan version 2, Current Personal Safety Plan, seven episodes |
| `SYN-PATIENT-002` | Mira Example  | Current version 1 with version 2 Awaiting Approval                   |
| `SYN-PATIENT-003` | Jordan Test   | No plan in use, with objective presentation activity                 |
| `SYN-PATIENT-004` | Evelyn Demo   | Withdrawn plan                                                       |
| `SYN-PATIENT-005` | Alex Fiction  | Closed Identification Review, so a fresh referral is permitted       |

Four synthetic clinicians cover the role boundary: an emergency physician (the default),
an ED mental-health liaison clinician, a named senior clinician, and a care-planning
coordinator. The rail's role control is interaction modelling: it explains which actions
are offered, it authenticates nobody, and the reducer re-checks the role on every action
regardless of what the control says.

There are **no** Patient Plan fixtures. Every patient copy in the prototype has to be
made, filled and approved through the interface, which is deliberate: the conversion's
refusals are the point, and a pre-made copy would hide them.

## Limits

- **Chromium only.** The browser evidence is Chromium at five widths. Nothing here is
  acceptance for physical iPhone Safari or for an installed PWA.
- **No identification rule exists.** The Identification Policy is
  `pending_governance` with no threshold count and no lookback. Presentation counts are
  displayed as an observation over a stated window and decide nothing. Sort-by-count
  exists on exactly one screen, inside the Identification Review worklist, and the
  Governance page says so.
- **Contact actions are intents.** Opening a `mailto:` or `tel:` records that an external
  application was asked to open. The prototype holds no evidence of delivery, readership,
  reply or contact completion, and its wording never implies otherwise.
- **A printed sheet goes stale the moment it is printed.** Every printed clinician
  summary says so on its face.
- **The Patient Plan is an incomplete draft by design.** Anything the offline conversion
  cannot turn into everyday words with confidence becomes a visible gap for a clinician to
  write. The agreed-ED-approach section is never auto-converted under any circumstances,
  and a copy with an unfilled gap cannot be approved.

## Production-readiness boundary

Rendering a complete prototype and passing every local check satisfies none of the
following, all of which would be required before operational use: WA Health clinical
governance approval, an approved identification policy, patient and consumer co-design, a
privacy impact assessment, cultural-safety review, legal review, clinical-content
validation, data-retention rules, authoritative record ownership, identity matching, RBAC
and relationship-based access, break-glass controls, immutable audit, secure messaging,
integration contracts, concurrency control, downtime procedures, cybersecurity review,
accessibility acceptance on real assistive technology, training, monitoring, incident
response, and controlled deployment.

## Where to start reading the code

1. `routes.ts` — every address in the family.
2. `routable-suite.tsx` — address to surface, and the specimen-scenario bridge.
3. `types.ts` and `domain.ts` — the domain and its pure selectors.
4. `prototype-state.ts` — the reducer, the single-Current invariant, and
   `getPrototypeMutationBlockReason`, which re-checks capability, connectivity,
   permission, identity and version conflict on every action regardless of which controls
   were offered.
5. `docs/care-plan/sdd-ledger.md` — why things are the way they are, and what is still open.
