# On Call — review of the shipped hub, and what to build next

**Date:** 2026-09-19 · **Scope:** the seven `/on-call/**` routes, their components under
`src/components/on-call/`, and the domain modules under `src/lib/on-call/`.

Two companion mockup studies carry the drawings this document argues for:

- [`/mockups/on-call-shift-cover`](../../../src/components/on-call-shift-cover-mockups.tsx) —
  four boards rebuilding surfaces that already ship.
- [`/mockups/on-call-calendars`](../../../src/components/on-call-calendars-mockups.tsx) —
  four boards proposing surfaces that do not exist.

## How this review was done

The seven routes were rendered at 390px against the local dev server in demo mode and read
beside their source. That combination is deliberate: three of the four defects below are
invisible in source (they are layout and data-shape faults that only appear once real strings
meet a narrow column), and one of them is invisible on screen (it only shows on the printed
card). The `mockup-conformance.md` ledger was read as the record of what was already known.

Nothing provider-backed was run. No live data was touched.

## Where the hub stands

Change A of [`on-call-hub-build-prompt.md`](on-call-hub-build-prompt.md) has fully landed:
across the conformance ledger's 115 rows, **78 are `built`, 20 are recorded `deviation`s, and
none is `open`**. The 17 `change-b` rows are all waiting on the same migration — the `forms`
section value, the `site` column and the `on_call_sites` table — which is why the home has no
shift context and no site switcher, and why there is no Forms section.

The parts that are built are good, and two of them are better than the drawing they came
from: the after-hours number switch is time-aware and wakes itself on the boundary rather than
going stale on a page left open overnight, and the teaching strip rolls a recurrence forward
instead of going blank the afternoon a typed date passes. Neither was in the original brief.

What follows is what is wrong with it anyway.

## Findings

### 1. The printed pocket card drops every ward extension — **fixed in this change**

`CARD_NUMBER_FIELDS` in `on-call-card.tsx` read `phone`, `afterHoursPhone`, `pager` and `fax`.
A ward contact stores its number in `details.extension` and nothing else, so all three demo
wards — every one of them flagged `includeOnCard` — printed as a title and a subtitle with no
number under them.

This is the same omission the on-screen Contacts list found, fixed and left a comment about
("this section carried its own copy of _the number this row rings_ that omitted `extension`").
The card carried a second copy of the same idea and never got the fix, and no test looked at
paper. It matters more here than anywhere: the card is the one artefact in this mode that
leaves the app, and a phone list with the numbers missing is not a degraded card, it is a
blank sheet with headings on it.

Fixed, with a regression test, in `tests/on-call-card.dom.test.tsx`.

**The general lesson is worth more than the fix.** There are now three independent
implementations of "which number does this entry have" — `home-modules.onCallPrimaryNumber`,
`on-call-contacts-section`'s local copy, and the card's `CARD_NUMBER_FIELDS` — and they have
already diverged twice on the same field. A fourth surface will diverge again. One exported
resolver in `src/lib/on-call/` with the preference ladder in it, called by all three, is the
change that stops this recurring.

### 2. A contact's name is truncated to make room for its number

At 390px the Contacts row puts the title, the number, a dial disc and a copy control on one
line. The title loses, every time: _Demo bed management, after hours_ renders as _Demo bed
manageme…_, _Demo registrar on call_ as _Demo registrar on…_, and the hospital switchboard as
_Demo Hospital…_.

That is the wrong thing to sacrifice. The number is a string of digits you are about to tap —
you do not read it. The name is the only thing that tells you the tap is going to reach the
right desk. Board B of study 1 gives the name the full row width and puts the number beneath
it, where nothing competes.

### 3. The Contacts list has no right-hand edge

The trailing controls are conditional, so a row without a copy button ends roughly 58px short
of the row above it. Scanning down the list, the right margin moves in and out. Board B uses a
fixed-width trailing column present on every row, with the controls going quiet rather than
disappearing.

### 4. The Playbook truncates the half of the sentence that grants permission

An escalation step renders its condition on one clamped line: _"If the registrar is
unreachable for ten minute…"_. The condition is the clinically load-bearing half of an
escalation rule — it is the sentence that says whether you are allowed to make the next call —
and it is the half being thrown away.

Two smaller faults sit beside it. Every step wears a phone glyph whether or not it has a
number, so _Ward clerk_ advertises a dial that does not exist. And the _no local guideline
linked_ empty state is a five-line paragraph repeated verbatim under every scenario; with two
scenarios on screen it is already most of the page, above an escalation ladder that is the
reason anyone opened it.

Board C rewrites the ladder as something you work down: conditions wrap in full, dial
affordances appear only where a number exists, and the page keeps the clock — _called 02:14 ·
escalate from 02:19_. That last line is the whole difference between a ladder as a policy
document and a ladder as a tool, and it costs nothing but browser state.

### 5. The home never says who is on, or where you are in the shift

This is the largest gap and it is not a bug — the Shift module has been correctly parked on
the database change since 2026-09-12. But the module as specified (site, hours, wards,
progress bar) is only half of what is missing. It answers _where am I in the shift_. It does
not answer _who is the registrar tonight_, which is the question a caller actually has.

The hub currently holds role numbers with no time dimension at all, so "who is on next Tuesday
night" lives in a PDF roster in somebody's email. Board A of study 1 draws the shift band and
an on-cover strip together; Board A of study 2 draws the calendar behind it.

**One rule is load-bearing if this is built:** a named roster nobody confirmed is more
dangerous than no roster, because a reader who sees a name stops checking. Every cover row
states its provenance, and a role with no confirmed name shows the role's standing number
rather than inventing a person.

### 6. Teaching is a list of two cards pretending to be a programme

The page renders one flat list with a chip reading _"Next: Tue 22 Sep 2026, Next week,
08:00"_ — the computed date and the owner's free-text sentence glued together, saying the same
thing twice and neither cleanly. There is no month, no term, no way to put a session into your
own phone calendar, and no record that you attended, which is the one thing a registrar is
actually asked for at the end of the year.

Board B of study 2 keeps both fields doing the job each is good at: the computed date becomes
a week rail, the owner's own words stay as the pattern chip where they carry the exceptions a
three-value enum cannot.

## What the two studies propose

**Study 1 — `/mockups/on-call-shift-cover`.** Four boards against findings 1–5: the home with a
shift band and an on-cover strip, the Contacts row rebuilt, the Playbook ladder as a working
surface, and the pocket card at the size it is actually carried (two columns, one side of one
card, with a QR back to the live page — the honest answer to paper going stale).

**Study 2 — `/mockups/on-call-calendars`.** Four surfaces the hub does not have:

- **Cover calendar.** A month of cover two roles deep, initials in the grid and full names one
  tap away in the day sheet. No colour coding by person — seventeen consultants would need
  seventeen hues, and _status never by colour alone_ applies doubly where the status is who to
  ring.
- **Teaching term with attendance.** A week rail, an `.ics` export (a text file the phone
  already knows how to open — no account, no provider, no integration), and an attendance
  total kept in the browser like Recent.
- **Shift log.** The tail every shift generates and this hub throws away: which chart still
  needs re-writing, who was going to ring the family, which bed request is still open. Drawn
  with **no patient field at all** — a job is a ward, a task and a time — because `AGENTS.md`
  forbids this mode becoming a patient list, and a form that cannot take an identifier is
  stronger than a rule asking people not to type one.
- **Who covers this?** Referrals already stores `accepts`, `exclusions`, `catchment` and
  `hours`. Today they are a list you read at 2am. Asked as a question — an age, a suburb, a
  time — the same four fields answer directly. Every row shows which stored fact produced its
  verdict, and services that were ruled out stay on screen rather than being filtered away, so
  a stale catchment is obvious rather than invisible.

## Proposals not drawn

Ordered by what they would change for a person on a shift, against what they cost.

| Idea                                 | What it is                                                                                                                                                                                                             | Cost   | Verdict                                       |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | --------------------------------------------- |
| **One number resolver**              | Collapse the three copies of "which number does this entry have" into one exported function. Finding 1 is the second divergence.                                                                                       | Small  | Do it next                                    |
| **Ward extension keypad string**     | `onCallTelHref` turns extension `0001` into `tel:0001` — correct from a hospital handset, useless from the personal phone this hub is designed to live on. Store or derive the full switchboard-plus-extension string. | Small  | Confirm the intended handset first            |
| **Handover countdown in the header** | Once the shift is known, the time to handover is useful on every page, not only the home.                                                                                                                              | Small  | With the Shift module                         |
| **"Is this still right?" on dial**   | After a call fails, one tap to flag the number as suspect. The freshness stamp answers _when was this checked_, never _did it work_.                                                                                   | Medium | Strong candidate                              |
| **Cover calendar**                   | Board A, study 2.                                                                                                                                                                                                      | Medium | Highest value of the new surfaces             |
| **Teaching term and attendance**     | Board B, study 2.                                                                                                                                                                                                      | Medium | Do with the calendar                          |
| **"Who covers this?"**               | Board D, study 2.                                                                                                                                                                                                      | Medium | Do after the calendar                         |
| **Offline-first pocket mode**        | The contacts cache already exists. A dedicated "no signal" screen that shows only what is cached, with its age, beats a banner on a normal page.                                                                       | Medium | Worth a study                                 |
| **Shift log**                        | Board C, study 2.                                                                                                                                                                                                      | Medium | Needs clinical sign-off first                 |
| **Swap and leave requests**          | Rostering workflow on top of the cover calendar.                                                                                                                                                                       | Large  | Out of scope — this is not a rostering system |
| **Roster import**                    | Parsing the hospital's PDF or spreadsheet roster.                                                                                                                                                                      | Large  | Only after the calendar earns it              |
| **Paging / bleep integration**       | Real integration with hospital paging.                                                                                                                                                                                 | Large  | Not without an institutional agreement        |

Three ideas were considered and **rejected**, recorded so they are not re-proposed:

- **A patient list or handover of clinical detail.** Forbidden by the mode's clinical boundary,
  and rightly — it would turn a reference hub into a clinical record with none of the controls
  one needs.
- **Generated clinical guidance on a Playbook scenario with no linked document.** The existing
  empty state refuses to fall through to generated content. That refusal is the single most
  important line of behaviour in the mode; the fix for the empty state is to make it _shorter_,
  never to fill it.
- **A freshness warning on the home.** Removed twice already on the owner's instruction. Board
  A does not restore it.

## Recommended order

1. The number resolver (finding 1's general form), and check the ward `tel:` string.
2. Change B, as already planned — sites, Forms, and the Shift module — with the on-cover strip
   added to the module's scope, since the schema work is the same work.
3. The Contacts row and the Playbook ladder. No schema, no migration, and they fix the two
   places where the hub currently truncates the thing that matters.
4. The cover calendar, then teaching attendance.
5. The shift log only after a clinician has signed off what may and may not be written in it.
