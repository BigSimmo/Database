# CME mode — design decisions

**Status: direction agreed, nothing built.** This is the decision record behind the screen
boards. Where it and a drawing disagree, this file wins.

Boards: the canvas (21 screens, phone-first) and the earlier three-way home study in
[`prototypes/cme-screens.html`](prototypes/cme-screens.html), kept for provenance — its
three competing homes were superseded by the single perfected dashboard on 2026-09-19.

---

## 1. What this is

A continuing-education tracker for a doctor registered in Australia. It is the place the
record actually lives; the doctor's CPD home stays the system of record and this feeds it.

**Built to the national requirement, not to one college.** Every registered medical
practitioner is held to the Medical Board's CPD standard; specialists meet their college's
extra requirements on top, whichever CPD home they choose. So the app models one baseline
plus an optional overlay, and works for a GP, an anaesthetist or a psychiatrist without
redrawing anything.

## 2. The requirement model

A **requirement set** belongs to a year and is stamped onto it permanently. Changing status
next year never re-judges a closed year.

For a practitioner outside a training programme, a requirement is one of four shapes. An
hours-only model cannot express the last three, which is why most trackers quietly miss them:

| Shape                                        | Example                                                           |
| -------------------------------------------- | ----------------------------------------------------------------- |
| **Hours in a category**                      | Educational activities ≥ 12.5                                     |
| **Hours across several categories combined** | Reviewing performance + measuring outcomes ≥ 25, with ≥ 5 in each |
| **A count of activities**                    | One activity in each of four practice domains                     |
| **A task**                                   | A written development plan; an end-of-year self-evaluation        |

Categories are the national three: **educational activities**, **reviewing performance**,
**measuring outcomes**.

The **four practice domains** — culturally safe practice, addressing health inequities,
professionalism, ethical practice — sit in the national baseline, not in the college overlay.
They are a count requirement with no hours attached, which is exactly the shape an hours-only
tracker cannot hold. (Corrected 2026-09-20; the first draft had them as a college extra.)

**No target is hard-coded.** The owner confirms the set once; the app stores the confirmation
date and the document it came from, and every screen carries that provenance. The app never
looks a requirement up and never changes one quietly.

**Never pro-rata for part-time work.** Working part-time does not reduce the requirement. A
tracker that silently lowered a target would be the most dangerous thing in this design.

**A status transition is a different thing, and it is real.** Admission to Fellowship part-way
through a year, or first registration after the middle of the year, can legitimately change
that year's target — and colleges do it by two incompatible mechanisms: one reduces the target
by the months remaining, another leaves the target alone and grants a block credit with its
own category split. Neither is computed by this app. Both are held as an owner-confirmed
**period adjustment** on the year, carrying its own date, basis and source. Hard-coding either
one would be wrong for half its users.

## 3. An entry allocates hours; it does not pick one box

One activity can genuinely count toward more than one requirement — a peer review meeting is
both reviewing performance and practice improvement, and it also feeds a college peer-review
requirement that runs alongside rather than competing for the same hours. So an entry holds
one or more allocations of `{category, hours}`, and the capture sheet shows the running total
against the entry's stated hours.

Entry fields: date, title, activity type, allocations, a free-text reflection, evidence
attachments, an optional cost, a claimable flag, a "transcribed into my CPD home" flag, the
routine it came from where it came from one, and — where the app captured it — a link back to
what was read.

**The reflection box asks nothing.** A guided question ("what will you do differently?") was
proposed and declined by the owner on 2026-09-20. The label is "Reflection" and the box is his.

## 4. The dashboard

**The first 560 px is a fixed budget** and buys exactly three things: where you stand,
whether you are on pace, and the one action worth taking. Everything else scrolls.

1. **Total hours**, as a bar with a mark at the position you would need to be at _today_ to
   finish on time, and the shortfall between the two drawn as a hatched segment so the gap is
   an object rather than an absence. A bar at 65% looks identical in March and September; the
   mark is what separates them.
2. **The pace sentence**, directly beneath: _"At this rate, 45 hours by 31 December — about
   5 short."_ Flat arithmetic, never coloured, never a judgement. This is the single most
   load-bearing line on the screen, and the one thing that makes a March shortfall visible.
3. **Next** — one row, computed: drafts to confirm, else a routine due, else an unmet
   count-requirement, else the tightest hours gap, else nothing needed. Confirming a captured
   draft beats any form, because the typing is already done.

Then, scrolling: every requirement with what is short, the requirements that are not measured
in hours, routines due now, quick capture, what would not hold up if audited, the dates that
matter, and the provenance line.

### The dashboard has three seasons

The same three elements, doing three different jobs across the year:

- **January** — a rate computed from six days is noise, so the screen says nothing at all
  about pace. The action is writing the development plan.
- **February to November** — pace is the whole point, and the mark carries the screen.
- **The last fortnight** — pace stops being useful; you either finish or you do not. The
  screen becomes the year-end checklist and the action becomes closing the year.

This is one dashboard with conditional content, not three screens.

**Modules are the owner's to hide and reorder**, via show/hide toggles and move-up/move-down
buttons — never drag alone, which is unusable with a keyboard or a screen reader and fails
WCAG 2.2 SC 2.5.7. The repo already has this exact pattern in `use-sidebar-pins.ts`.

Conditionally-empty modules disappear; a module that has never had data shows a guided empty
state instead. A legitimate zero is information and is shown as a zero.

## 5. Routines

Most of a doctor's hours come from the same few things every month — supervision, journal
club, a peer review group. A routine holds the title, cadence, usual hours and usual
allocation, so logging it is one tap from the dashboard.

**A routine never logs itself.** It offers; the owner confirms. Only he knows whether he was
actually there, and a tracker that auto-filled attendance would be producing a false record.

## 6. Capture

Three routes in, in descending order of how much typing they save:

1. **What the app noticed.** It records **document titles and how long they were open**, on
   this account, and offers a draft the owner confirms. One draft per day, not per document.
2. **The guideline you just read.** The app already holds the clinical documents, so a "count
   this" control on the document itself pre-fills the entry and links the evidence to the
   document. No other CPD product can do this, because no other one knows what was read.
3. **A certificate shared in from email.** A PDF arriving in the mail app is shared straight
   into the vault and becomes a half-filled entry. Certificates are lost in exactly this gap.

Constraints on the first two:

- **Never the search text.** `src/lib/query-privacy.ts` stores a hash rather than the query,
  and a durable record of what was typed would reverse a deliberate commitment.
- Two-minute floor; measured minutes only; never counts time with the screen off; blind to
  the CME mode itself.
- A plain on/off switch beside the existing "save recent searches" control, and a plain
  statement of what is recorded on the Drafts screen itself.

**This still needs an explicit ruling.** It inverts all three conditions under which
recording the owner's own activity was previously permitted here
(`src/lib/on-call/recent-storage.ts`): never leaves the device, does not outlive the session,
stores nothing identifying. It also makes the shipped privacy copy pinned by
`tests/privacy-ui.test.ts` misleading, which must be corrected in the same change.

## 7. Evidence, and what it cost

Certificates, photographs and receipts live in a vault that **structurally cannot reach
clinical search**. `/api/upload` cannot be reused: it is administrator-gated, rejects JPEG and
PNG, and unconditionally enqueues ingestion, which would make a conference certificate
retrievable as clinical evidence. Reuse the owner-namespaced storage path and the signed-URL
helper; do not reuse the ingestion enqueue.

An entry with no evidence is marked, never blocked.

**An optional cost on each entry.** Conference fees, courses, journals and college dues are
deductible, and the receipt is already being stored beside the certificate. One optional field
turns the same vault into the tax-time folder, and gives a second reason to attach something —
which is the cheapest available fix for the missing-evidence problem. The year's total appears
on the export and nowhere else; this is a by-product of good record keeping, not a finance
feature.

## 8. Renewals

No Australian product ties registration renewal, indemnity cover, working-with-children
checks and mandatory training into one expiry view; they live in email, a wallet card and a
hospital system. They belong here because CPD compliance is declared at registration renewal.

Every date is one the owner entered. The app does not look them up and does not know when
they change, and says so.

## 9. The year end

**Audited today** answers one question: if someone asked for the record this afternoon, what
would not hold up? Entries with no evidence, an unmet requirement, an unwritten
self-evaluation. Where there is a button it offers one; where there is not — a category that
needs an activity rather than a tap — it says so instead of pretending. The screen carries one
unmissable line: this is the app's reading of his own record against his own confirmed
targets, not advice, and not a statement of what a regulator would ask for.

**Closing the year** is a distinct act with legal weight and it was missing from the first
design. Closing locks every entry in the year against editing, produces the summary and the
evidence bundle in one go, carries any unfinished plan goal into the next year, and opens the
next year asking for the targets to be re-confirmed against the current guide. It cannot be
undone, and the screen says so before the button.

Closing also accepts **a note explaining a shortfall** — leave, illness, anything. The note
goes on the record, where an explanation belongs. It does not reduce the requirement, and the
screen says that too.

## 10. In training

A doctor in an accredited training programme is **deemed to meet the CPD standard by the
programme itself**; there is no separate hour count. So for a trainee the app tracks the
programme.

The dividing line is not seniority. It is **enrolled in an accredited programme, yes or no** —
and it can change mid-year, and retroactively. An unaccredited service registrar carries the
full specialist requirement. A trainee on a long break can lose cover for a year that looked
covered. So the app models an **enrolment timeline** and resolves each requirement against the
state that held on each date, rather than a role field, which would be wrong for a meaningful
share of users a meaningful share of the time.

A trainee needs four requirement shapes a specialist never does:

| Shape                                | Why an hours model cannot hold it                                                                                                                                                                    |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A cadence with a coverage window** | An hour of supervision a week across forty weeks fails by distribution, not by volume. Two hours next week does not repair a week with none in it, so the app must show missed periods, not a total. |
| **A count scoped to a container**    | Assessments per activity, one observed activity per rotation. The key is compound, not a year-wide sum.                                                                                              |
| **A judgement, not a sum**           | The prevocational year ends in a panel decision with no minimum number of assessments to pass. A requirement whose outcome is entered rather than aggregated.                                        |
| **A due date on a training clock**   | Milestones fall due at a number of full-time-equivalent months, which pauses on breaks and halves at 0.5. The app must carry that clock beside the calendar and translate between them.              |

Rotations are the container almost everything else hangs from: dates, full-time fraction,
supervisor, and an end-of-rotation submission whose deadline is derived from the rotation's
end rather than entered.

**Employer mandatory training belongs on the renewals page, not here**, and it re-triggers
every time a trainee changes hospital — which is the one place a trainee's burden is heavier
than a consultant's, and the one no college system shows.

## 11. What comes out

1. **Copy for your CPD home** — per entry, fields on the clipboard in the portal's order,
   then the entry is ticked as transcribed. Built first; it is the control that gets pressed
   a hundred times.
2. **A summary document**, ordered by requirement, totalled. Use the repo's existing
   `PrintSection` / `PrintOutput` rather than writing a PDF generator.
3. **An evidence bundle**, a spreadsheet with a cost column, and an audit pack that is all of
   the above in the order someone would ask for it.

## 12. What this deliberately does not do

- **No streaks, badges or confetti.** Leave and illness break chains, and the evidence is
  that streak mechanics make people quit.
- **No red.** A shortfall is position, weight and words. `docs/design-system/TOKENS.md`
  reserves the clinical status colours for clinical states, and GOV.UK's own research found
  red status tags on this exact kind of checklist harder to read and anxiety-provoking.
- **No ring or gauge.** `Progress` is the only sanctioned progress primitive and a bar with a
  target mark says more in less space.
- **No daily reminders.** Two in-app banners a year, one at a time, each dismissible and
  snoozable, escalating by specificity rather than colour. The app has no notification
  channel today and building one for two messages a year is not worth it.
- **No guided reflection question.** Declined by the owner, 2026-09-20.
- **No pro-rata for part-time work, and no carry-over of hours between years.** Unfinished
  plan goals do carry forward; hours never do.

## 13. The design system for these screens

One stylesheet, shared verbatim by every board, so twenty-one screens read as one product.

- **Colour.** One accent — `--tone-indigo` `#43508f`, already sanctioned in
  `src/app/ckb-v2-tokens.css` — and a neutral ramp biased very slightly toward it, so the
  greys read as chosen rather than inherited. No second hue anywhere.
- **Dark is designed, not inverted.** The same token names are re-pointed for night; the
  accent lifts to `#97a3df` so it still carries on a dark ground. The boards include a
  side-by-side so the two can be judged together, because most of this app's on-call use is
  after dark.
- **Type.** Geist, at a phone scale rather than a desktop one: 15 px body, 13 px meta, 11 px
  eyebrows. The first draft's 13/12 was a desktop habit and was too small to read one-handed.
- **48 px is the floor for anything tappable**, matching the repo's `min-h-12` production
  rule. The first draft used 44 throughout.
- **Not everything is a card.** One card carries the screen's subject; lists are flat panels
  on a tinted ground; exactly one accented block per screen carries the thing that matters.
- **Figures are tabular** wherever they line up in a column.

## 14. Evidence status of the numbers in the drawings

**Corroborated, not verified.** Two research passes have now been run from this environment,
on 2026-09-19 and 2026-09-20. The second reached no primary source either: the egress proxy
blocked every direct fetch attempted — `medicalboard.gov.au`, `ahpra.gov.au`, `ranzcp.org`,
`racp.edu.au`, `amc.org.au`, `mdanational.com.au` and others — including neutral control
domains, so the block is indiscriminate rather than specific. Web _search_ worked, so
everything below is search-relayed text, not a read page.

The national figures (50 total; ≥ 12.5 educational; ≥ 25 reviewing and measuring combined
with ≥ 5 in each; 12.5 self-allocated; a written plan; an end-of-year self-evaluation;
three-year retention; a CPD year running 1 January to 31 December) were consistent across
several independent sources.

The trainee material in section 10 comes from the same second pass and carries the same
limit. Its _shapes_ — a weekly cadence, container-scoped counts, a panel judgement, an
FTE-month clock — were consistent across several colleges and are what the data model is
built on. Its _figures_ were not checked against a source page and must not be shown to
anyone as authoritative. One conflict is unresolved: record retention is given as three years
in one place and five in another.

Sections 2 and 10 are the mitigation, not a caveat. The app never asserts a requirement;
it holds the owner's confirmed numbers, with the date and the document he confirmed them
against, and shows that provenance on every screen that displays a target.
