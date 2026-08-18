# Caring contacts — content style guide

**Status:** binding synthetic-design language, 15 August 2026  
**Applies to:** every screen, overlay, fixture, test and future implementation described by the
[binding specification](../superpowers/specs/2026-08-15-caring-contact-coordination-design.md)

## 1. Voice and structure

Use Australian English, sentence case and plain operational language. Lead with the observable
condition, then the remedy and owner. Actions are verb-first and name their object: `Review
fictional referral`, `Pause future contacts`, `Record operational review`. Do not use urgency,
engagement or patient-state shorthand when the system only knows a workflow or transport event.

One filled command leads a region. Headings and explanatory text come before controls. Patient
identity, current ownership, availability and the effect of an action remain visible before the
decision. Destructive or protected decisions state whether fresh authentication, a reason or an
approval is required.

## 2. Closed terminology

| Meaning                 | Required wording                                                                                                                     | Do not substitute                                                            |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| Referral not accepted   | `Awaiting handover`; `[referring team] remains responsible until explicit acceptance`                                                | owned, assigned, accepted by aftercare                                       |
| Source agreement        | `Agreement confirmed: Yes/No` plus source/referrer/time                                                                              | consented, treatment consent, legal consent                                  |
| Mobile evidence         | `Imported mobile`; `patient-controlled and suitable for discreet SMS`; source named                                                  | destination-verification claims, confirmed destination                       |
| Pathway status          | `Illustrative locally governed pathway` until approved                                                                               | recommended, best practice, proven                                           |
| One-way channel         | `Replies are not received, stored, analysed or monitored`                                                                            | reply, text us, tell us, inbox, conversation                                 |
| Schedule                | one selected plan preference: `Morning 10:00 am AWST`, `Afternoon 2:00 pm AWST` or `Early evening 5:00 pm AWST`                      | rotating windows within one plan, local time, later today, ASAP              |
| Transport state         | `Scheduled`, `Processing`, `Sent`, `Delivered`, `Not delivered`, `Number invalid`, `Contact changed`, `Status unavailable`, `Missed` | reached, engaged, responded, safe, helped                                    |
| Delivery interpretation | `Delivered means transport receipt only. It does not show that the message was read.`                                                | received by patient, read, contact successful                                |
| Operational exception   | exact condition, remedy and owner                                                                                                    | concern, high risk, clinical priority, needs attention without qualification |
| Pause                   | reversible; original calendar retained; contacts during pause skipped                                                                | defer and catch up, restart cadence                                          |
| Withdrawal              | patient preference; unsent contacts cancelled immediately; terminal history                                                          | opt out later, reversible withdrawal                                         |
| Cancellation            | separately authorised operational action with reason                                                                                 | withdrawal                                                                   |
| Recorded death          | `Recorded death — irreversible cancellation`; correction is an incident                                                              | undo, reinstate                                                              |
| Small cell              | `Suppressed`                                                                                                                         | zero, fewer than a guessed threshold                                         |

`Needs action` is permitted only as a section heading whose rows name the observable condition,
remedy and owner. It is never a patient-risk category.

The canonical patient-visible no-reply notice is exactly `Replies are not received, stored,
analysed or monitored`. Use those four verbs in that order, with this capitalisation. It is a
complete sentence in the exact message, template, preview and review surfaces; do not shorten or
paraphrase it.

## 3. Patient-facing message rules

Patient-visible copy is warm, brief, discreet and non-demanding. It may substitute only the approved
preferred name, neutral team identity, coordinator signature and governed variant. It must not ask
for a reply, disclosure, task completion or reassurance. The exact fully substituted text, encoding
and segment count appear before activation. More than two SMS segments blocks progression.

The first contact includes the discreet team identity, bounded caring-contact purpose, named
coordinator, no-reply statement, fictional programme phone and staffed hours, emergency direction
and one approved crisis-support contact. Later contacts retain the short no-reply statement and
programme contact. Exact real wording remains subject to clinical programme and lived-experience
approval; the synthetic text is not approved patient content.

## 4. Synthetic names, identifiers and numbers

All design and test evidence must use visibly fictional details. Approved patterns are:

- names containing `Example`, `Sample` or `Fiction`;
- identifiers prefixed `SYN-`;
- fictional organisations such as `Example Aftercare Team` and `Fictional Ward A`;
- `.invalid` email domains; and
- only the designated fiction contact numbers and their frozen roles:
  - Mira patient mobile: `+61 491 570 006`;
  - Rowan patient mobile: `+61 491 570 156`;
  - staffed programme line: `+61 491 570 157`;
  - crisis-support contact: `+61 491 570 158`.

Patient, programme and crisis roles are pairwise distinct. Never reuse a patient mobile as a
programme or crisis-support contact, and never use the programme line as the crisis-support contact.

Do not improvise plausible Australian patient, staff, service, provider or phone details. Real PHI
must never enter fixtures, screenshots, tests, URLs, page titles, logs or analytics. All person,
service and contact identifiers are synthetic. The emergency direction intentionally uses the real
Australian emergency number `000`; it is safety instruction, not a person, service-programme or
contact identifier.

## 5. Dates, times and missing values

Store and exchange ISO 8601 timestamps. Render with `en-AU` and `Australia/Perth`; show `AWST` on
every operational send time. Use full dates where a decision depends on the date, for example
`Saturday 22 August 2026`. Use `10:00 am`, `2:00 pm` and `5:00 pm`, retaining the minute and meridiem.
Never infer the user's device zone.

Use an explicit phrase for absence: `No named exceptions for this day`, `Approval evidence missing`
or `Status unavailable`. Never use a bare dash.

Store one selected sending preference on each plan and derive every planned contact window from it.
For the Rowan fixture, the current value is `Morning 10:00 am AWST` across all 10 contacts. The
Schedule dashboard may aggregate different patients across all three service windows; it does not
permit one episode to rotate windows. A preference overlay must label the current value separately
from any proposed change.

## 6. Accessibility labels and announcements

Accessible names match the visible action and object. Overlay titles name the decision, close
controls name the object, and unavailable controls reference the visible reason. Announcements are
short outcomes without patient identity: `Operational review recorded`, not a name, phone, message
or identifier. Status uses visible words plus an icon, mark or structure; colour never carries the
meaning alone. The continuity graphic is decorative support for the immediately following ordered
list named `Caring-contact schedule`.

## 7. Privacy-safe transient language

Toasts, live regions, push alerts and page titles contain no patient name, identifier, phone number,
message text or clinical detail. Use object-neutral outcomes such as `Review recorded`, `Plan paused`
or `Accepted referral remains unclaimed. Open Callback.` If an exact object must be identified, keep
it inside the authenticated page body and audit record, not the transient surface.

## 8. Prohibited claims

Do not say or imply that Callback monitors a patient, detects or predicts risk, provides crisis
response, proves safety or wellbeing, records replies, establishes engagement, provides treatment,
replaces follow-up, proves effectiveness, independently verifies an imported mobile, or transfers
duty of care merely through coordinator assignment. Do not use diagnostic labels to determine
eligibility or priority. These prohibitions apply to visible copy, accessible names, icons, colours,
charts, ordering, empty states and analytics labels.
