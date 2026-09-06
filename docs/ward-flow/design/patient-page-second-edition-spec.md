# The individual patient page, second edition — what may change and what may not

**Ward Lead, 2026-09-05.** The owner asked for a "massive overhaul" of the individual patient page.
This spec's first job is to say plainly which half of that is available.

**Structure and appearance: fully open.** Panels, type, spacing, the modular tabular layout, the
figure strip, the action area — all of it can be rebuilt to the second edition.

**Content: closed, and not by oversight.** Every field a richer patient page would naturally add is
either unauthorised or unbuildable. That is an owner decision rather than a layout one, so it is put
back to the owner instead of assumed. Details in section 4.

---

## 1. THE DEFECT THIS REDESIGN WOULD INTRODUCE, AND EVERY EXISTING TEST WOULD STAY GREEN

`person-screen.tsx` renders two sensitive fields — **Aboriginal or Torres Strait Islander status**
and **interpreter / preferred language** — under a placement rule with two halves: they must not sit
adjacent to each other, and neither may sit directly above a psychiatric history panel. That file's
own comment records an earlier fix which satisfied only the first half while the single test passed
throughout, and `tests/ward-patient-placement-fields.dom.test.tsx` now asserts both halves, each
proved by its own mutation.

**Those tests assert DOM order. The rule is about what a reader sees.**

🔴 **CORRECTED 2026-09-05, AND THE CORRECTION IS THE WHOLE POINT: THIS SECTION ORIGINALLY SAID THE
DEFECT WAS A FUTURE RISK. IT WAS ALREADY LIVE.**

The sentence here read: _"Today the facts render as a single-column definition list, so DOM order and
reading order are the same thing and the tests are sound."_ **That was false when written.**
`.factList` was `display: grid` with `grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr))`
and `gap: 0.75rem` — as many columns as fit. Computed:

    1 col : Aboriginal r4c1, interpreter r6c1  -> separated
    2 cols: Aboriginal r2c2, interpreter r3c2  -> VERTICALLY ADJACENT
    3 cols: Aboriginal r2c1, interpreter r2c3  -> same row, separated by GP
    4 cols: Aboriginal r1c4, interpreter r2c2  -> separated

**Two columns is a phone in portrait.** `auto-fit` fills `floor((W + gap) / (9rem + gap))` tracks; a
375px viewport less the panel padding is about 21.9rem, which gives exactly 2. **So on the device a
ward coordinator actually holds, the two fields the placement rule keeps apart were stacked one
directly above the other — and every DOM-order assertion stayed green, because the DOM order never
changed.**

⚠️ **I wrote the false sentence while writing a document whose entire subject was that assumption's
failure mode.** I described the current state from memory rather than opening
`person.module.css`, and then reasoned carefully and at length from it. The reasoning was right; the
premise was not, and nothing downstream of a wrong premise can catch it — every conclusion in this
section was correct except _when_ it applied.

**Fixed:** `grid-template-columns: 1fr`, with the computed positions recorded at the declaration.
**Guarded:** `tests/ward-patient-sensitive-adjacency-css.test.ts`, which reads the stylesheet — jsdom
computes no layout, so a guard asserting positions there could not fail. It was written first and
**went red against the live code, naming the offending declaration**, which is a stronger proof than
a mutation because the defect was real. Re-proved by mutation after the fix.

This is the recurring shape on this project: a guard that is true, on-topic, and cannot fail in the
direction that matters.

**RULED:**

1. **The "Placement details" fact list stays SINGLE-COLUMN at every width.** Its tabular treatment
   is a definition table — label column, value column, one fact per row — never a multi-column grid
   of facts. That is also the better tabular form for label/value pairs, so nothing is given up.
2. **Before any layout change to that panel, extend the placement guard to assert VISUAL adjacency
   rather than DOM adjacency.** jsdom computes no layout, so asserting offsets there would be
   another check that cannot fail. The guard must read the CSS: that the fact list resolves to one
   column, and that no media block gives that panel more than one.
3. **Mutation-prove it by making the fact list two columns and watching the new assertion go red.**
   A green mutation here would invent confidence rather than remove it.

## 2. What must survive the overhaul, exactly

Each of these is asserted by a committed test or ruled by the owner. A redesign that drops one is a
regression however much better it looks.

- **Field ORDER in "Placement details" is the placement rule, not decoration:** sex/gender, address,
  suburb, **Aboriginal or Torres Strait Islander status**, GP, **interpreter / preferred language**,
  catchment community team, legal status LAST. GP separates the two sensitive fields; legal status —
  not either sensitive field — is what would sit above a history panel if one were ever built.
- **The `data-testid` hooks:** `ward-person-identity`, `ward-person-placement-details`,
  `ward-person-missing`, `ward-person-refer`, `ward-person-refer-note`, and `data-sensitive-slot` on
  both sensitive fields. `WardPanel` does not forward arbitrary props, which is why two of these sit
  on plain wrapper divs — keep the wrappers.
- **The unknown-person state renders the GAP, not a substitute.** Never the first patient in the
  list for an unrecognised id: that looks like a working screen and it is a different human being.
- **Age is DERIVED and says so on screen.** "Age is calculated from the date of birth above and is
  not stored on its own." A figure with no explanation invites somebody to store it later, and a
  record holding both can state an age that disagrees with its own date of birth.
- **"Not recorded" for every absent optional field.** Never a blank value, never a dash. A person
  just added through search-then-add has none of the nine.
- **"Refer Patient"** — the owner's wording, ruling 9, 2026-09-03. Not "Refer this person".
- **The refer note stays exactly as narrow as it is.** A referral records the link only; no name,
  date of birth or record number travels with it; this screen shows no referral history.
- **FD-23: no unit name and no referral list reaches this screen.** Two guards, deliberately — one
  on the rendered output, one that reads the source and fails if it consults the referral list at
  all. The first passes today only because `Referral` carries no patient link, so it would go quiet
  on the day that link lands, which is the day it is needed.

## 3. What the overhaul actually changes

- Both fact lists become definition tables in the second-edition treatment: label column in the
  quiet ink role, value column in body ink, row rule in `--ward-divider`, and the canonical padding
  from the block being extracted into `ward-table.module.css`.
- The header gains the second edition's page-title treatment; the identity panel keeps its single
  derived Age figure in a figure strip.
- "What you can do" becomes the second edition's action area, with the primary action given the
  prominence the ward home's "Open full bed board" received.
- Panel headers carry the border-and-type treatment, never a fill: **Ruling E1** — nothing in the
  ward palette clears 1.11:1 against a panel in the light theme.

## 4. THE OWNER QUESTION, STATED ONCE, WITH A RECOMMENDATION

A feature-rich patient page would show risk flags, diagnosis, next of kin, medication, past
psychiatric history and referral history. **None of it is available, and the two reasons differ,
which is why this needs the owner rather than a decision here:**

- **Not authorised.** `R-2026-09-04-A` ruled which fields `Patient` may HOLD; risk flags, diagnosis,
  next of kin, medication and "open to the team" are not among them. They DO appear in
  `mockup-patient.html`, so a reader comparing mockup with screen sees an incomplete implementation
  rather than a decision. Widening the set needs a ruling and a line in the `PLACEMENT_FIELDS` map
  in `tests/ward-patient-model.test.ts`.
- **Not buildable.** `Movement` carries no patient id — only `Referral` does — so there is no link by
  which a person's past admissions could be found at all. A "Past psychiatric history: None" panel
  built against that absence would state, of every patient, a clinical fact nobody has checked.

**Recommendation: ship the structural overhaul now against the fields already authorised, and widen
nothing.** The page will look considerably more finished without asserting anything new about
anybody.

Two of the nine are additionally held-but-unsettled for display — Aboriginal or Torres Strait
Islander status and interpreter/preferred language remain open with the Aboriginal health review,
which ruled only that the record may hold them, not that a screen may show them. Their presence
today is not that review's answer.

## 5. Sequencing

Hold implementation until Ward Builder Two's merge lands: it changes
`tests/ward-person-screen.dom.test.tsx`, whose resolution is ruled — master's side, which refuses to
import the age helper at all rather than routing through it plus a range band. Overhauling the
screen while its test is being resolved on another branch is how the wrong resolution becomes the
green one.
