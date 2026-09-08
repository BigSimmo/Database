# On Call hub — expansion brainstorm

Status: **brainstorm, not an approved design.** Nothing here is agreed or scheduled.
Date: 2026-09-08
Prior art: `docs/superpowers/specs/2026-09-04-on-call-mode-design.md` (the shipped design)

Purpose: capture everything worth considering for the On Call section as a hub for junior
psychiatry doctors, so the decisions are made deliberately rather than by omission. Owner
review decides what, if anything, is built.

---

## 0. The constraint that governs every item below

**On Call content is currently readable by anyone on the internet.** The 2026-09-04 amendment
made reads public: `fetchSharedOnCallEntries` returns every entry to any caller, signed in or
not. `psychiatry.tools` has no login wall. The only content that stays private is an entry
ticked **Personal**, which never leaves the account that wrote it.

This is not a bug — it was an explicit owner decision — but it changes what belongs here:

| Content type                                   | Safe to publish? | Note                                                 |
| ---------------------------------------------- | ---------------- | ---------------------------------------------------- |
| Statewide public numbers (Poisons, MHERL, TIS) | Yes              | Already public information                           |
| Role-based internal extensions                 | Judgement call   | Reveals internal service structure                   |
| Named individuals + direct mobiles             | **No**           | Personal-flag only                                   |
| A daily roster naming who is on tonight        | **No**           | Names + location + time; also a security concern     |
| A Teams meeting join link                      | **No**           | Anyone on the internet could join a teaching session |
| Keycard/ID application process                 | Mostly yes       | Avoid naming the individual who approves             |
| Anything patient-related                       | **Never**        | The mode stores no patient information, by design    |

**Recommended structural change before adding content:** a third visibility state between
"mine only" and "the open internet" — signed-in readers only. The shipped design already
identifies cohort sharing as the right answer and defers it (§12). Several of the most useful
items below are blocked on it.

---

## 1. What already exists

Six sections, one entry store, local search across all of them, a printable one-page card,
offline-cached contacts, and a 12-month freshness stamp on every entry.

| Section     | Holds                                                                                                |
| ----------- | ---------------------------------------------------------------------------------------------------- |
| Contacts    | Role-first entries: role, phone, extension, after-hours phone, pager, name, availability             |
| Playbook    | Trigger + ordered escalation steps (who, when, phone) + links to the owner's own guideline documents |
| Referrals   | Accepts, exclusions, catchment, hours, how to refer, phone, fax, referral form URL                   |
| Orientation | Uploaded manuals, optionally with an owner-attributed pinned summary                                 |
| Education   | Recurrence, next occurrence, presenter, location, recording URL, topics                              |
| Logistics   | Category, location, hours, phone, URL                                                                |

Mapping the owner's request onto that:

| Asked for                                   | Status                                                                                           |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Important numbers                           | Covered — Contacts                                                                               |
| Important guidelines                        | Partly — Playbook links to documents; there is no plain "guideline shelf"                        |
| Teaching schedule / calendar / learning hub | Partly — Education holds the data; there is no calendar view and no add-to-calendar              |
| Link to Teams                               | **Not modelled** — Education has a recording link only, no join link                             |
| Orientation guides for rotation             | Covered — Orientation                                                                            |
| Orientation for new doctors                 | Partly — not distinguished from rotation-specific orientation                                    |
| Keycards, ID, applications                  | Partly — Logistics has no "how to apply" shape: no steps, no form, no who-to-email, no lead time |
| Rosters / daily roster                      | **Deliberately not built** — see §2                                                              |

---

## 2. Rosters — the one item the shipped design rejected

The original design ruled rosters out for a specific reason: a hand-maintained "who is on
tonight" decays within a fortnight, and its failure mode is a junior ringing the wrong person
in an emergency. Publishing one to the open internet adds a second problem.

Three options, in order of preference:

1. **Link out, do not copy.** A Contacts or Logistics entry that says "Tonight's roster lives
   in <the real rostering system>", with the link and the login route. Cannot decay, cannot be
   wrong, and works today with no new code. Recommended.
2. **Role-based cover, not named cover.** Already how Contacts works: "after-hours registrar",
   "consultant on call for Ward 4B". Survives every rotation.
3. **A real roster feature.** A live feed from the rostering system, signed-in readers only.
   Substantial: authentication tier, an integration, and a hard rule that a stale roster shows
   as unavailable rather than as fact. Only worth it if the rostering system has an accessible
   feed.

**Never:** a manually typed daily roster with names, published publicly.

---

## 3. Clinical and legal — the biggest real gap for a WA junior

All of it must render as links to the owner's own uploaded documents, never as app-authored
clinical text. That constraint is what the Playbook section exists to enforce.

**Mental Health Act 2014 (WA) and adjacent law** — the single most common on-call knowledge
gap:

- Form 1A referral for examination: who may complete it, how long it lasts, what to write
- Assessment and the involuntary treatment order forms; transport orders
- Which sites are authorised hospitals, and what that means at 3am
- Chief Psychiatrist's standards and guidelines
- Mental Health Advocacy Service, Mental Health Tribunal, review timing
- Seclusion and restraint: authorisation, review intervals, documentation
- Capacity and consent; Guardianship and Administration Act; Office of the Public Advocate
- Advance health directives; enduring power of guardianship
- Police and ambulance powers, and how to request them
- Reportable deaths and coroner notification
- Mandatory reporting: child protection, and Ahpra impairment notifications

**Escalation-shaped clinical scenarios** (Playbook cards, each linking to a real guideline):

- Acute behavioural disturbance / code black / rapid tranquillisation
- Clozapine: missed doses, neutropenia, myocarditis, rechallenge, and the monitoring hotline
- Lithium toxicity
- Neuroleptic malignant syndrome; serotonin syndrome
- Alcohol and benzodiazepine withdrawal; Wernicke's and thiamine
- Delirium versus dementia versus functional presentation
- Catatonia; emergency ECT
- Overdose and toxicology
- Absconding or missing patient
- Suicide risk assessment, safety planning, and post-attempt management
- Refusal of treatment / the patient wanting to leave

**Boundary to hold:** dose calculators, QTc tools, and titration schedules are clinical
decision support. They do not belong in this app.

---

## 4. Numbers most likely missing

Statewide and public (safe to publish):

- Poisons Information Centre — 13 11 26
- Translating and Interpreting Service — 131 450 (constantly needed, constantly forgotten)
- Mental Health Emergency Response Line; RuralLink for regional
- Crisis Care; Lifeline; 13YARN; 1800RESPECT; Kids Helpline
- Royal Flying Doctor Service / Patient Assisted Travel

Site-level (judgement call on publishing):

- Hospital switchboards
- Code black / security extension, per site
- MET call and code blue numbers
- Medical registrar, ICU, ED consultant
- After-hours pharmacy; imprest cupboard access
- Pathology, radiology, blood bank after hours
- Bed management / patient flow after hours
- Aboriginal liaison and cultural support, after hours
- Child protection crisis line
- Clozapine monitoring service
- IT service desk

---

## 5. Shift practicalities not yet represented

- **Handover** — when, where, the expected format, and what belongs in it versus what should be
  escalated overnight
- **When to wake the consultant** — an explicit, written permission to call. Probably the single
  highest-value paragraph in the whole hub for junior confidence
- **Documentation and systems** — which record system, how to get a login, what must be written
  where, and the after-hours process when a system is down
- **Prescribing practicalities** — which chart, Schedule 8 register, telephone-order policy,
  formulary quirks
- **Bed finding and transfer** — after-hours bed management, inter-site transfer, ambulance
  booking, which wards are locked or voluntary-only
- **ED liaison expectations** — response times, what the ED expects, what you can expect back
- **Death after hours** — verification, certification, who to notify, coroner criteria
- **Incident reporting** — the system, and what must be reported
- **Ward-by-ward quirks** — a short card per ward: where it is, its phone, its lock status, its
  patient mix

---

## 6. Employment and administration (the keycard/ID request, widened)

The gap here is a **shape**, not a section: Logistics has no way to express "a process with
steps". Anything of the form _who to email, what to bring, where to go, how long it takes,
what to do when it fails_ currently has nowhere to live.

- Keycard / door access: application, approval, which doors, and what to do when it fails at 2am
- ID badge
- Parking permit and after-hours parking
- Network login, clinical system access, remote access and multi-factor
- Pager or work phone: issue, and return at term end
- **Payroll, timesheets, overtime and on-call allowance claiming** — juniors routinely lose money
  here; a plain "how to claim your unrostered overtime" entry has immediate value
- Leave forms; sick leave — including who to ring when you are sick at 3am
- Rostering contacts and shift swaps
- Scrubs, lockers, on-call room access
- Library and journal access; point-of-care reference logins
- Mandatory training and its deadlines
- **Training and college**: RANZCP requirements, workplace-based assessments, supervision hours,
  logbook, in-training assessment timing, exam dates, rotation accreditation
- Term supervisor, Director of Clinical Training / Postgraduate Medical Education contacts
- Ahpra registration, indemnity insurance, prescriber number

---

## 7. Wellbeing and support — absent entirely, and it matters

- What to do after a serious incident, a death, or an assault: immediate steps and debrief
- Doctors' Health Advisory Service (WA)
- Employee assistance programme
- Peer support and registrar support
- Bullying, harassment and discrimination reporting; union / AMA contact
- Confidential health care for doctors — how to get a GP who is not a colleague
- Fatigue management: safe transport home after nights, and the taxi policy
- Second-victim support after an adverse outcome

---

## 8. Structural considerations (how the hub works, not what is in it)

1. **Which site am I at tonight?** The hub has no concept of site. A junior covering more than
   one hospital sees every site's numbers mixed together. A site tag plus a "my site" switcher
   would improve every section at once. Probably the highest-value structural change.
2. **Which term am I on?** A rotation tag would let Orientation show the relevant manual first.
3. **Freshness interval is one size.** Twelve months is right for a manual and far too long for a
   phone number. Per-section intervals — contacts at three or six months — would fit reality.
4. **Offline covers contacts only.** The escalation playbook is exactly what is needed in a
   basement with no signal. Extending the offline cache to Playbook is a small change with a
   large benefit.
5. **Only the owner can edit.** A hub one person maintains rots. A lightweight "this number is
   wrong" report — from a reader with no edit rights — would keep it honest. Requires the
   signed-in tier from §0.
6. **A shift-start screen.** One page answering: where am I, who do I call, what is on tonight,
   and what here is out of date. More useful at the start of a shift than six section tiles.
7. **Printable card, per site.** The card is one page for everything; a per-site card is what
   actually goes in a pocket.
8. **Teaching calendar.** An add-to-calendar file and a term-ahead view would make Education a
   schedule rather than a list. A Teams join link is only safe behind the signed-in tier.
9. **First-shift page.** "Your first fifteen minutes" — a deliberately short, ordered list.
10. **Search already spans all six sections and works offline.** Worth preserving in any change.
11. **No patient information, ever.** A handover or patient-list feature would breach this
    immediately. If handover tooling is ever wanted, it is a different product with a different
    privacy posture, not an addition here.

---

## 9. Suggested order, if any of this is built

1. Decide the visibility tier (§0). It gates rosters, Teams links, and reporting.
2. Add site tagging and a site switcher (§8.1) — improves everything already shipped.
3. Add a "process" shape so applications, claims and access requests have somewhere to live (§6).
4. Fill content: the Mental Health Act shelf, the missing numbers, wellbeing (§3, §4, §7).
5. Extend the offline cache to the Playbook (§8.4).
6. Everything else.

Steps 1–3 are code. Step 4 is content the owner can enter today, in the app, with no code at all.
