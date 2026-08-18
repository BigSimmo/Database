# Caring contacts — clinical and content boundaries

**Status:** binding language contract for synthetic design, 15 August 2026  
**Limit:** records settled product language; it is not clinical approval.

## 1. Core boundary

A caring contact is a brief, governed, one-way message supplemental to usual care and active
person-to-person follow-up. It is not monitoring, crisis response, triage, a safety check, clinical
advice, treatment or evidence that clinical follow-up occurred. The workspace does not assess,
predict or represent suicide risk, urgency, wellbeing, engagement or response.

## 2. Exact distinctions

### Transport is not patient state

`Scheduled`, `Processing`, `Sent`, `Delivered`, `Not delivered`, `Number invalid`, `Contact changed`,
`Status unavailable` and `Missed` describe systems and events only. Delivered does not prove that a
patient saw, read or understood a message and never implies safety, wellbeing, engagement or benefit.
A failure does not imply deterioration or increased risk. It creates named operational work only.

Never relabel transport as `Reached`, `Engaged`, `Responded`, `Safe`, `Concern` or `Clinical
follow-up`. A permanent failure pauses future contacts and creates a same-day operational task; it
does not automatically trigger patient contact or clinical review.

### Pending referral is not accepted ownership

Until explicit acceptance, the referring team retains responsibility. `Received`, `Awaiting review`
and `Clarification requested` show `Awaiting handover` and the referring team, not an aftercare owner.
After acceptance, coordinator claim/assignment identifies coordination; it does not erase the
handover history or independently transfer duty of care.

### Objective eligibility is not inferred risk

Eligibility uses adult status, qualifying discharge/referral, pilot-service scope,
patient-controlled/suitable-for-SMS evidence and `Agreement confirmed: Yes`. Diagnosis,
presentation, risk assessments, notes, delivery or non-response never drive automated eligibility or
priority. Order referrals by discharge and first eligible window. Do not use `high risk`, `risk
score`, `priority patient`, `best match` or unqualified `needs attention`; name the exact condition,
remedy and owner.

### Imported evidence is not overstated verification

The label is `Agreement confirmed: Yes/No`, not legal or treatment consent. Callback imports the
current hospital-record mobile without a test SMS, read-back or separate attestation, so do not label
it as separately destination-verified. Activation separately requires the source flag that the destination is
patient-controlled and suitable for discreet SMS; family, carer and shared destinations are
ineligible.

## 3. Sender, one-way and support rules

- Keep contact roles distinct: the Rowan patient mobile, staffed programme line and crisis-support
  contact are separate fictional numbers. A patient mobile is never displayed as the programme or
  crisis contact.
- Use a non-receiving sender with a discreet, recognisable, neutral team identity; do not expose
  suicide, crisis or mental-health treatment on a lock screen.
- Sign every message with the named coordinator under governed substitution rules.
- Do not receive, store, analyse or display replies. No inbox, conversation, urgency detection or
  triage route exists.
- Enrolment and the first SMS state the no-reply boundary, programme phone and staffed hours,
  emergency direction and one locally approved crisis-support contact.
- Later messages retain the short no-reply boundary and programme contact.
- Patients request timing changes, pause or withdrawal through the programme phone, staffed seven
  days during every sending window; any authorised team member may act immediately.

The design fixes these required meanings, not final sentences. Exact sender label, phone, hours,
emergency wording, crisis contact and message text require a versioned locally approved set with
clinical programme lead and lived-experience/content approval. Synthetic prototypes demonstrate
structure using clearly fictional details. Never invite a reply with wording such as `Reply if`,
`Text us`, `Tell us`, `Let us know` or `We monitor this number`.

## 4. Governed message rules

Every message is warm, brief, non-demanding and discreet. It may substitute preferred name, neutral
team identity, coordinator signature and an approved variant only. There is no unrestricted free
text, generative authoring or dynamic translation; translated pathways need professional translation
and cultural approval.

Every message:

- makes no claim about current patient state or clinical effect;
- requests no task, appointment response or disclosure by reply;
- includes its required one-way/support content;
- shows the exact fully substituted patient-visible text before activation; and
- is limited to two concatenated SMS segments including notices and signature, with encoding and
  exact count shown; overflow blocks activation.

The first message includes discreet team identity, bounded caring-contact purpose, coordinator
signature, no-reply statement, programme phone/hours, emergency direction and one approved crisis
support contact. Later messages retain the short no-reply statement and programme contact. Final
activation shows the exact first message, not a generic summary.

## 5. Clinical/operational action terms

- **Pause:** reversible; preserves the original calendar; contacts within the pause are skipped;
  resumption begins with the next future contact.
- **Withdrawal:** patient preference; immediately cancels unsent contacts; no approval; reason
  optional; terminal with immutable history.
- **Cancellation:** distinct authorised operational action with a reason.
- **Readmission:** source event that pauses future contacts; later discharge needs a new referral.
- **Recorded death:** source event that irreversibly cancels unsent contacts; a correction is an
  incident and any future plan needs a new referral.
- **Mobile change:** source event that pauses future contacts for coordinator review; never silently
  switch destination.

None is inferred from transport, reply or engagement data.

## 6. Claims and reporting

The illustrative twelve-month cadence is locally governed, not a universal prescription. Until
approved, label it `Illustrative locally governed pathway`, never `Recommended`, `Best practice` or
`Proven`. The pilot tests operational safety, reliability, clinician usability and separately
consented patient acceptability; it is not a clinical-effectiveness study.

Each plan has one selected sending preference. All 10 planned contacts derive the same service
window; only different patients may contribute to different window aggregates on Schedule. A
one-contact exception is explicit, reasoned and audited and does not silently replace the plan
preference.

Reporting may cover operational counts, completeness, due/dispatched/delayed contacts, exact
transport exceptions, resolution time, pauses/withdrawals/cancellations, duplicates, schedule drift
and versions. Approved demographics require small-cell suppression. Never rank clinicians or infer
patient safety, suicide risk, wellbeing, engagement, therapeutic response or effectiveness.

## 7. Review reject list

Reject any copy or visual that implies delivered means safe/read/helped; failure means deterioration;
pending means accepted ownership; coordinator assignment transfers duty of care; imported mobile is
independently verified; agreement is legal/treatment consent; the cadence is universally effective;
or that replies are received or monitored. Reject real patient information or PHI in
URLs/toasts/logs/analytics/page titles/screenshots, free/generated message text, and any
reply/inbox/conversation surface. Prototype and test screenshots are still required to contain
clearly fictional synthetic identities and details so boundary states can be reviewed without using
real data.

Final patient-facing content and the complete prototype require separate lived-experience and
clinical-language approvals; either may block progression.
