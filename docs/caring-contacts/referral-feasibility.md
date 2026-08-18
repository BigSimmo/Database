# Referral feed feasibility — the questions to ask, and who to ask

**Status:** open, 19 August 2026. Owner: Josh, then a sponsoring service.

**Why this document exists.** Every screen, rule and database table in this programme assumes a structured
referral arrives from a hospital system and a structured outcome is written back. No document names an
actual Western Australian system, and nobody has confirmed the feed is possible, who owns it, or what it
costs. This is the largest single risk to the programme and it is not a software risk — the build itself
is insulated, because it runs against a provider-neutral referral interface with a synthetic adapter
(hazard **H-44**).

The purpose of this document is to make one conversation productive. It is not a technical integration
spec.

## What the service needs to receive

The minimum structured referral, per the approved decision lock:

| Field                                                                                    | Why it is needed                                             | Failure if absent                                           |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------- |
| Patient identity from the source system                                                  | Identity confirmation before enrolment                       | Manual re-entry, transcription error                        |
| Adult status                                                                             | Objective eligibility                                        | Ineligible enrolment                                        |
| Qualifying discharge, with actual discharge date and time                                | The entire schedule is anchored to it                        | No schedule can be built                                    |
| Mobile number                                                                            | Delivery                                                     | No delivery                                                 |
| **An explicit flag that the mobile is patient-controlled and suitable for discreet SMS** | Prevents messages reaching family, carers or shared handsets | Hazard H-13, the most serious privacy failure in the design |
| Agreement confirmed, yes or no                                                           | Activation gate                                              | Cannot activate                                             |
| Referring clinician and team                                                             | Ownership until acceptance                                   | Ownership ambiguity                                         |
| Aboriginal and Torres Strait Islander status                                             | Aggregate reach reporting only                               | Cannot answer the equity question                           |

The patient-controlled-mobile flag is the field most likely not to exist. A plain mobile-number field is
explicitly insufficient. If the source system cannot supply it, the enrolment process must capture it
another way, and that changes the clinical workflow rather than the software.

## What the service needs to send back

Structured write-back on referral outcome, activation, pause, withdrawal, cancellation, material delivery
exception and completion. Detailed transport and access evidence stays in Caring Contacts and does not go
to the record.

## Questions to ask

**About the system**

1. Which system holds emergency-department and inpatient mental-health discharges for the candidate
   service, and which one would originate a referral?
2. Does it support outbound structured referrals to an external service, and by what mechanism?
3. Can it accept structured write-back, or is the only route a free-text progress note?
4. Is there an existing integration pattern for an external follow-up service, or would this be the first?

**About the data**

5. Is there a field recording that a mobile number is patient-controlled and suitable for discreet
   contact? If not, what would it take to add one, or where else could it be captured?
6. Is discharge date **and time** available, or date only? The schedule anchors to actual discharge time.
7. Is Aboriginal and Torres Strait Islander status available in a form that can be transmitted?

**About ownership and permission**

8. Who owns the integration decision — the health service, a statewide digital health function, or both?
9. What approval is required before any external system receives patient identifiers: privacy impact
   assessment, information-sharing agreement, security assessment, procurement?
10. Roughly how long does that take, and does it need a sponsoring executive before it can start?

**About cost and effort**

11. Is integration work charged to the requesting service, and is there a rough order of magnitude?
12. Is there a queue, and what does joining it require?

## Who to ask

In rough order of usefulness: a digital health or clinical informatics lead in the candidate health
service; the mental-health service manager who would sponsor the pilot; anyone who has recently taken an
external clinical system live in the same service, because they will know the real path rather than the
documented one.

## What a bad answer means

If a structured feed is not achievable in a reasonable timeframe, the programme is not dead — but the
first pilot becomes **manual referral entry by the aftercare team** from the existing discharge process,
with write-back as a progress note. That is a genuine fallback: it changes workload and the identity
confirmation step, not the clinical model. It should be designed deliberately rather than discovered late.

## What to do with the answers

Record them here, then update the production build specification's open register and this programme's
hazard **H-44**. If manual entry becomes the pilot route, that is a decision-lock revision and needs
writing up as one.
