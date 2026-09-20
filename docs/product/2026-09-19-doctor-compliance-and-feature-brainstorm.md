# A personal compliance tracker, and twenty-two other things worth building

**Date:** 2026-09-19 · **Status:** brainstorm, nothing decided, nothing scheduled.

Companion to the drawings at [`/mockups/doctor-compliance`](../../src/components/doctor-compliance-mockups.tsx)
(six boards) and to the two On Call studies recorded in
[`docs/on-call/design/2026-09-19-review-and-proposals.md`](../on-call/design/2026-09-19-review-and-proposals.md).

Part 1 is the compliance system in depth: the two design rules it stands on, what it would
hold, what could go wrong with it, and what to build first. Part 2 is a wider list of feature
ideas across the app, each one chosen because the function and the design are the same idea
rather than a feature with a skin on it.

---

# Part 1 — What one doctor has to keep current

## Why the obvious version fails

A compliance tracker is easy to build and almost always useless within a year. The failure is
predictable, and it is worth naming before any design:

1. It becomes a list of thirty rows sorted by expiry date.
2. Eleven of them go amber at once, because renewal cycles cluster.
3. Amber stops meaning anything, because a fire-safety eLearning module and a lapsed medical
   registration are rendered identically.
4. It gets closed, and the real tracking moves back to a diary and a shoebox of PDFs.

Every design decision below exists to break that chain at step 3.

## The two rules

### Rule 1 — Sort by consequence, never by date

A row's group is decided by **what happens if it lapses**, and nothing else:

| Tier                        | What it means                                    | Examples                                                                               |
| --------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------- |
| **Stops you working**       | You cannot practise at all.                      | Medical registration, indemnity cover, hospital credentialing.                         |
| **Stops part of your work** | You can practise; specific things become closed. | Prescribing authorisations, Mental Health Act role status, a clearance one role needs. |
| **You will be chased**      | Nobody is stopped; somebody emails.              | Mandatory eLearning, immunisation records, annual appraisal.                           |

This is deliberately not a severity scale. "Critical / high / medium" invites the question
"high to whom?" and gets argued about forever; "you cannot work" is a property of the
requirement that needs no interpretation and never changes with proximity.

The payoff is that the page stays readable when eleven things are amber at once, which is the
exact moment every other tracker becomes wallpaper.

### Rule 2 — It never says "compliant"

This is the rule the whole feature turns on, and it is a safety rule, not a legal-cover one.

A green tick beside "Medical registration" is an assertion about a person's legal standing,
made from a date they typed in themselves months ago. The app cannot know about a condition on
registration, a notification, a failed payment, a certificate that was withdrawn, or a
requirement that changed. A tracker that displays confidence it does not have is worse than no
tracker, because it replaces checking with reassurance.

So every row is phrased as a record of what the reader told it:

- **"You recorded this expires on 30 September"** — never "current" or "valid".
- **Provenance on every row, always visible** — you typed this / read off your certificate /
  you checked the register. Three states, one line, never hidden in a detail view.
- **"This app has not checked this with Ahpra, and cannot"** sits in the middle of the detail
  card, not in small print at the foot.
- **A confirm control** that stamps the date you checked with the body that actually knows —
  the same freshness contract On Call already uses for phone numbers, for the same reason and
  with the same wording.

## What it holds

A requirement is a small record. Sketched, not specified:

```
requirement
  name                  "Medical registration"
  required_by           "Ahpra"            — the answer to "do I actually have to?"
  consequence           stops-work | stops-part | chased
  authority_url         link to the body that holds the real answer
  expires_on            date, nullable — some requirements have no expiry
  lead_time_days        how long THIS renewal takes; not a site-wide default
  provenance            typed | read-from-certificate | confirmed
  last_confirmed_at     set only by a human action, never inferred
  site                  nullable — a requirement can belong to one workplace
  evidence[]            private files
  is_personal           always true. This is the most personal data in the app.
```

Two fields are doing unusual work and are worth defending:

**`lead_time_days`, per requirement.** A registration renewal wants six weeks; a fire-safety
module wants twenty minutes. A uniform "warn me 30 days out" is how a tracker teaches people
that its warnings are noise. Lead time is a property of the renewal, so it lives on the
requirement.

**`required_by`.** The most common real question is not "when is this due" but "do I actually
have to do this, and who says so?". Naming the body and linking to it answers that, and it is
also what keeps the app out of the business of asserting requirements it cannot keep current.

## The five features that make it worth building

Anything can hold dates. These are the parts that would change a working week.

1. **The renewal horizon.** Twelve months as one strip, with a mark per renewal. The useful
   output is not a date, it is a **cluster**: registration, indemnity and the CPD year all land
   within a fortnight of each other, and nobody discovers that by reading a list sorted by
   expiry — they discover it in the last week of September. Three marks stacked over one month
   is the whole argument, visible without reading a word. (Board A and E.)

2. **Spread the cluster.** Several renewals are movable — you can sit a life-support refresher
   early, you can bring a credentialing submission forward. Offering to move one out of a
   crowded month is the one thing a calendar can do that a list cannot. It **proposes and never
   applies**: a real deadline changes only when you change it in the real world.

3. **The evidence pack.** Every credentialing application, every new site, every locum agency
   asks for the same bundle: registration, indemnity, life support, immunisation record,
   clearance. It is the same weekend spent digging through email attachments, every time. One
   selectable export, with a cover sheet that **names what is missing** rather than quietly
   leaving it out — because a pack that silently omits an expired certificate is how somebody
   submits an incomplete application and finds out three weeks later. (Board D.)

4. **CPD as an instrument, not a total.** "34 of 50 hours" is the least useful number in the
   system, because the hours you are missing are never the hours you are short of. A programme
   with per-category minimums fails on a small category while the total looks healthy: twenty
   hours of lectures does nothing for a five-hour audit requirement, and a flat total hides
   that until December. So the total is a footnote and the categories are the page, with the
   short one named in words above them. (Board C.)

5. **CPD fed by the teaching calendar.** Sessions ticked as attended on the On Call teaching
   page already are CPD. Logging them twice is how a log stops being kept. This is the single
   strongest argument for the tracker living in this app rather than in a spreadsheet — and it
   is why the two studies from this session belong together. Anything imported says where it
   came from and stays editable, because an automatic number nobody can correct is worse than
   no number.

## What could go wrong

Listed because these decide whether it ships, not as an afterthought.

| Risk                                                                  | What to do about it                                                                                                                                                                                                                                                                          |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Certificates leak into the answer corpus.**                         | This is the most serious one. Uploaded certificates carry a name, a registration number and sometimes a date of birth. They must live in a bucket the ingestion worker **cannot** read, and must never be indexed, embedded, or reachable by retrieval. This needs a gate, not a convention. |
| **The app is believed over the register.**                            | Rule 2. Provenance on every row; no "compliant"; the authority linked from every detail card.                                                                                                                                                                                                |
| **A shipped list of requirements goes stale and is read as current.** | Do not ship any regulator's or college's requirement list as fact. Ship an **empty** tracker with optional starter templates the reader edits and owns, clearly labelled as a starting point, not a specification.                                                                           |
| **It becomes a record of somebody else's compliance.**                | The supervisor board (F) shows three states and a date — never a certificate, a number, or a reason for a gap. Who may see whose state is an employment question, not a product one; the board is drawn so it is easy to leave out.                                                          |
| **The most personal data in the app gets the least protection.**      | Owner-scoped, row-level security on, private by default with no way to make a requirement public, and excluded from search, from the pocket card, and from every shared read.                                                                                                                |
| **The wallet card gets lost.**                                        | It carries dates only. No registration number, no policy number, no date of birth. A card designed to be lost harmlessly is a card you will actually carry.                                                                                                                                  |

## What to build first

1. **The record and the three tiers**, with provenance and no verdict anywhere. Empty by
   default; add your own rows. This alone replaces the diary.
2. **Lead-time reminders**, because they are what make step 1 get looked at.
3. **The evidence vault and the pack export.** The weekend-saver, and the reason the files are
   here at all.
4. **The horizon and the spread suggestion.** Cheap once the dates exist.
5. **CPD categories, fed by teaching attendance.** Do this after the On Call teaching
   attendance board, not before — it is the consumer, not the producer.
6. **The supervisor roll-up.** Only if you actually want it, and only after somebody has
   decided who may see what.

---

# Part 2 — Twenty-two other ideas

Grouped by where the value is. Each one is here because the function and the design are the
same idea; a rating in the last column says what I would actually do.

## Things that make the app trustworthy

| Idea                               | What it is                                                                                                                                                                                                                                                                               | Verdict                                |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| **"Last checked" everywhere**      | On Call has a freshness stamp. Compliance needs one. Documents could use one. Make it one shared primitive with one rule — anything with an age says its age, in the same words, in the same place — instead of three surfaces inventing it separately.                                  | Do it, as a small refactor             |
| **What changed since you read it** | When a guideline is re-ingested, show a "changed since you last opened this" ribbon on the sections you have actually read, with the diff. For a reference library this is the highest-value thing on the list: the danger is not a document you never read, it is one you read in 2024. | Strongest idea in part 2               |
| **Watch a fact**                   | "Tell me if the neutrophil threshold in my corpus changes." A saved query that re-runs on re-ingest and tells you when its answer moves. Sibling of the above; same machinery.                                                                                                           | After the above                        |
| **Provenance on every number**     | Any figure rendered anywhere states where it came from and when. Partly true today; make it a rule with a component behind it.                                                                                                                                                           | Do it                                  |
| **A decision log**                 | "I looked this up at 02:40 and this is what it said." Defensible-practice support. But a log of clinical lookups is a clinical record with none of a clinical record's controls, and it changes what the app _is_.                                                                       | Do not build without governance advice |

## Things that help at 3am

| Idea                              | What it is                                                                                                                                                                                                                                               | Verdict           |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| **"Now" as a real filter**        | On Call already switches to the after-hours number at 17:00. The same idea generalises: services that are open now, teaching this week, requirements due now. Time as a first-class filter, stated in words on screen so it is never a silent narrowing. | Good, incremental |
| **One-handed mode**               | You are holding a phone handset in one hand. Everything you need is at the bottom of the screen, reachable by a thumb. A layout variant, not a new app. Almost nothing in clinical software takes this seriously and it is a real design opportunity.    | Worth a study     |
| **Cold-start offline mode**       | The contacts cache exists. Extend it to a single, honest "no signal" surface: what is cached, how old it is, and nothing that pretends to be live. Better than a banner on a normal page that looks live and is not.                                     | Worth a study     |
| **Printable artefacts as a type** | The pocket card, a ward card, a medication card, the safety plan. The print machinery already exists; a small catalogue of printables, all built the same way, would get used.                                                                           | Cheap, do it      |
| **Clipboard identifier guard**    | A repo-wide refusal to copy text that matches a patient-identifier shape — record number, date of birth. Cheap, invisible until it fires, and it prevents the single most likely privacy accident in an app like this.                                   | Do it             |

## Things that turn lists into answers

| Idea                               | What it is                                                                                                                                                                                                                | Verdict                           |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| **"Who covers this?"**             | Referrals already stores catchment, age range, exclusions and hours. Asked as a question rather than read as a list, it answers the most common out-of-hours administrative question there is. Drawn in study 2, board D. | Build after the cover calendar    |
| **"Can I prescribe this here?"**   | Same shape, different data: your own authorisations plus a formulary note. Answers a real question and stays administrative.                                                                                              | Only with the compliance tracker  |
| **Escalation as a working ladder** | The Playbook with a clock — "called 02:14, escalate from 02:19". Drawn in study 1, board C.                                                                                                                               | Cheap, high value                 |
| **Forms router**                   | The planned Forms section, asked as a question: which form, who signs it, how long it takes.                                                                                                                              | With the Forms migration          |
| **Cover calendar**                 | Who is on, which night, two roles deep. Study 2, board A.                                                                                                                                                                 | Highest-value new On Call surface |

## Things that reduce work you are already doing

| Idea                                    | What it is                                                                                                                                                                                                 | Verdict                        |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| **Read the expiry off the certificate** | Drop in a PDF; the app proposes the expiry date and you confirm it. The OCR pipeline already exists for clinical documents, so this is reuse, not new infrastructure. Never accepted without confirmation. | Strong, once the vault exists  |
| **Requirement starter templates**       | "Consultant psychiatrist, WA public hospital" seeds a list you then edit and own. Explicitly a starting point, never a claim of completeness.                                                              | Yes, with the caveat in Part 1 |
| **Site-scoped requirements**            | The same doctor has different mandatory training at each workplace. Requirements attach to a site — and On Call's planned `on_call_sites` table is already the right home for that concept.                | Reuse, do not duplicate        |
| **Archive a site, keep its history**    | You changed jobs. Credentialing still asks about the past, so a site is archived, never deleted.                                                                                                           | Small, easy to forget          |
| **Teaching attendance → CPD**           | One tick, two purposes. Part 1, feature 5.                                                                                                                                                                 | Do both or neither             |
| **Practice profile**                    | Adult vs older adult, public vs private, this state. Defaults across search, services and referrals. Risk: silent filtering. It must be visible on screen and switchable in one tap, or it is a trap.      | Worth a study, carefully       |
| **Batch "still correct?" sweep**        | Once a year, walk every stale contact, service and requirement in one pass instead of finding them one at a time. On Call has the per-page version already.                                                | Cheap                          |

## Rejected, recorded so they are not re-proposed

- **A patient list, or clinical handover content, anywhere in On Call.** Forbidden by the mode's
  clinical boundary. The shift-log board is drawn with no patient field at all for this reason.
- **Generated clinical guidance where no document is linked.** The existing empty state refuses
  to fall through to generated content. That refusal is the most important behaviour in the
  app; the fix for a long empty state is to make it shorter, never to fill it.
- **A compliance score, percentage or grade.** It would be the one number everybody looks at
  and the one number the app has no standing to produce.
- **Automatic renewal on the reader's behalf.** Even where an authority allows it. The app
  should never be the thing that did or did not renew your registration.

---

## Recommended order across everything

1. The two cheap On Call fixes with no schema change — the Contacts row and the Playbook
   ladder.
2. On Call change B as already planned, with the on-cover strip folded into the Shift module's
   scope, since the schema work is the same work.
3. The compliance record — three tiers, provenance, no verdict. Empty by default.
4. The evidence vault and pack export, with the ingestion exclusion gated, not assumed.
5. The cover calendar, then teaching attendance, then CPD categories fed by it.
6. "What changed since you read it" — the strongest idea in part 2, and independent of all
   of the above.
