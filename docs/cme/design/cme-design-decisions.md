# CME mode — design decisions

**Status: direction agreed, nothing built.** This is the decision record behind the screen
boards. Where it and a drawing disagree, this file wins.

Boards: the canvas (13 screens, phone-first) and the earlier three-way home study in
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

A requirement is one of three shapes. An hours-only model cannot express the last two, which
is why most trackers quietly miss them:

| Shape                                        | Example                                                           |
| -------------------------------------------- | ----------------------------------------------------------------- |
| **Hours in a category**                      | Educational activities ≥ 12.5                                     |
| **Hours across several categories combined** | Reviewing performance + measuring outcomes ≥ 25, with ≥ 5 in each |
| **A count of activities**                    | One activity in each of four practice domains                     |
| **A task**                                   | A written development plan; an end-of-year self-evaluation        |

Categories are the national three: **educational activities**, **reviewing performance**,
**measuring outcomes**. Everything else is a college overlay.

**No target is hard-coded.** The owner confirms the set once; the app stores the confirmation
date and the document it came from, and every screen carries that provenance. The app never
looks a requirement up and never changes one quietly.

**Never pro-rata.** Working part-time does not reduce the requirement. A tracker that
silently lowered a target would be the most dangerous thing in this design.

## 3. An entry allocates hours; it does not pick one box

One activity can genuinely count toward more than one requirement — a peer review meeting is
both reviewing performance and practice improvement, and it also feeds a college peer-review
requirement that runs alongside rather than competing for the same hours. So an entry holds
one or more allocations of `{category, hours}`, and the capture sheet shows the running total
against the entry's stated hours.

Entry fields: date, title, activity type, allocations, a two-line reflection, evidence
attachments, a claimable flag, a "transcribed into my CPD home" flag, and — where the app
captured it — a link back to what was read.

## 4. The dashboard

**The first 560 px is a fixed budget** and buys exactly three things: where you stand,
whether you are on pace, and the one action worth taking. Everything else scrolls.

1. **Total hours**, as a bar with a mark at the position you would need to be at _today_ to
   finish on time. A bar at 65% looks identical in March and September; the mark is what
   separates them.
2. **The pace sentence**, directly beneath: _"At this rate, 44 hours by 31 December — about
   6 short."_ Flat arithmetic, never coloured, never a judgement. This is the single most
   load-bearing line on the screen, and the one thing that makes a March shortfall visible.
   It says nothing at all in January, when a rate is meaningless.
3. **Next** — one row, computed: drafts to confirm, else an unmet count-requirement, else the
   tightest hours gap, else nothing needed. Confirming a captured draft beats any form,
   because the typing is already done.

Then, scrolling: every requirement with what is short, quick capture, recent entries, loose
ends (missing evidence, not yet transcribed), the dates that matter, and the provenance line.

**Modules are the owner's to hide and reorder**, via show/hide toggles and move-up/move-down
buttons — never drag alone, which is unusable with a keyboard or a screen reader and fails
WCAG 2.2 SC 2.5.7. The repo already has this exact pattern in `use-sidebar-pins.ts`.

Conditionally-empty modules disappear; a module that has never had data shows a guided empty
state instead. A legitimate zero is information and is shown as a zero.

## 5. Automatic capture

The app records **document titles and how long they were open**, on this account, and offers
a draft the owner confirms. One draft per day, not per document.

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

## 6. Evidence

Certificates and photographs live in a vault that **structurally cannot reach clinical
search**. `/api/upload` cannot be reused: it is administrator-gated, rejects JPEG and PNG,
and unconditionally enqueues ingestion, which would make a conference certificate retrievable
as clinical evidence. Reuse the owner-namespaced storage path and the signed-URL helper; do
not reuse the ingestion enqueue.

An entry with no evidence is marked, never blocked.

## 7. Renewals

No Australian product ties registration renewal, indemnity cover, working-with-children
checks and mandatory training into one expiry view; they live in email, a wallet card and a
hospital system. They belong here because CPD compliance is declared at registration renewal.

Every date is one the owner entered. The app does not look them up and does not know when
they change, and says so.

## 8. What comes out

1. **Copy for your CPD home** — per entry, fields on the clipboard in the portal's order,
   then the entry is ticked as transcribed. Built first; it is the control that gets pressed
   a hundred times.
2. **A summary document**, ordered by requirement, totalled. Use the repo's existing
   `PrintSection` / `PrintOutput` rather than writing a PDF generator.
3. **An evidence bundle**, and a spreadsheet.

## 9. What this deliberately does not do

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
- **No pro-rata, and no carry-over between years.**

## 10. Evidence status of the numbers in the drawings

**Corroborated, not verified.** The egress proxy in the authoring environment blocked every
primary and secondary source tried — `medicalboard.gov.au`, `ranzcp.org`, `mdanational.com.au`,
`insightplus.mja.com.au` and the app stores among them — so every figure comes from search
summaries.

The national figures (50 total; ≥ 12.5 educational; ≥ 25 reviewing and measuring combined
with ≥ 5 in each; 12.5 self-allocated; a written plan; an end-of-year self-evaluation;
three-year retention) were consistent across several independent secondary sources. The
college-specific figures were not, and one conflict is unresolved: record retention was given
as three years in one place and five in another.

Section 2 of this document is the mitigation, not a caveat. Confirm the set once, in the app,
against the current guide.
