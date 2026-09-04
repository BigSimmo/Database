# Plan — the patient record, and the ward screens

**Ward Builder Three, 2026-09-04.** Planning only; no repository edits, no branch. Read from
`codex/task-ward-flow-live-state-20260831` with `git show`.

---

## ⚠️ First, a correction to the brief: the two ward screens are the other way round

The brief describes `mockup-ward-home.html` as "the questions-to-answer page with the control that
takes you through to the beds", leading to `mockup-ward-entry.html`. **Measured from the files:**

| file                     | `<h1>`               | what it actually is                                                                                                    |
| ------------------------ | -------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `mockup-ward-home.html`  | **Ward overview**    | Nine ward cards grouped by health service. Every control is a link to one ward. **No questions, no bed-list control.** |
| `mockup-ward-entry.html` | **RPH Adult Secure** | **"Confirm today's numbers" — the three questions** — and the `Open bed list` control.                                 |

**The questions and the bed control are both on `ward-entry`.** The plan below names them correctly.
If the brief's ordering was deliberate rather than a slip, stop me before Task B.

---

## Decision 1 — the bed-list control is NOT gated, and the prototype already says so

**Asked: is the control disabled until the questions are answered?** ⚠️ **It is already answered, in
words, on the screen** — I did not need to propose a rule:

```html
<p class="hero-availability">Always available — an unanswered question below never blocks this.</p>
```

The control is an `<a class="cta">` carrying neither `disabled` nor `aria-disabled`, while the
question panel reads `0 of 3 confirmed today`. **The standing rule — a coordinator decision is never
blocked, only recorded — does reach here, and the prototype applies it.**

**So this task PINS the decision rather than making it.** The risk is not that somebody argues for a
gate; it is that somebody adds one while improving the form, and nothing fails.

---

## Decision 2 — zero admissions is a state, not an empty render

The prototype states the absence positively and counts it as `None`, not `0`:

> **Past psychiatric history — None.** "No previous admission to a WA mental health ward. This is a
> first presentation — the absence of history is itself a clinically significant fact, not a sign
> that the record is incomplete."

**Its reasoning, which this plan keeps:** an empty panel is indistinguishable from a panel that
failed to load. **Planned as a real state with its own test.**

**Audit of every other count on that screen**, as asked: the record carries `048213` (MRN),
`14 Mar 1987`, `39`, `3 Feb 2019`, `2 days ago`, three admission durations, and `last contact 8 days
ago`. ⚠️ **None of these has a zero state, because none can be zero for a patient who exists.** The
one other zero-shaped case — "Can be added once the record exists — None of these block creation" —
is already worded. **The treatment is consistent; the test pins the WORDING, not only the count.**

---

## ⚠️ Decision 3, which the brief did not ask for: "one place" and "not adjacent" are in tension

The brief asks that Aboriginal or Torres Strait Islander status and interpreter need be **"a single,
clearly-marked, removable unit — one component, one place"**. The prototypes' README records that
their **placement has been reviewed so that neither sits adjacent to the other**.

**In the file today they are separated by the GP row:**

```
Address · Suburb · Aboriginal or Torres Strait Islander status · GP · Interpreter / preferred language
```

⚠️ **A single visual block would put them back side by side and undo the cultural-safety placement
review, while satisfying the letter of the instruction.** The two requirements are compatible only if
"one place" means **one place in the CODE, not one place on the SCREEN**.

**Resolution: one module owns both fields; the layout renders them into two separate slots.** Removal
stays a one-file edit; adjacency stays broken. Both requirements met, neither traded.

⚠️ **The reason belongs in the code, not only here: whether these fields belong on this screen at all
remains OPEN with the Aboriginal health review. The layout fix did not settle it and must never be
cited as if it had.**

---

## Task A: The patient record

**Files**

- Create: `src/components/ward-management/patients/person-identity.module.css`
- Create: `src/components/ward-management/patients/sensitive-identity-fields.tsx` — **the removable unit**
- Modify: `src/components/ward-management/patients/person-screen.tsx`
- Test: `tests/ward-patient-record.dom.test.tsx`

**Interfaces**

- Consumes `.wardTokens`, `ward-panel`, `ward-chip` (`WardKindChip` for legal status), `ward-figure`,
  `ward-shared` (`.field`, `.hint`, `.wardName`).
- Produces `SensitiveIdentityFields`, exporting **two named slots** (`CulturalIdentityField`,
  `InterpreterField`) from one module.

- [ ] **Step 1 — the failing test, before any component**
  - `renders the two sensitive fields in NON-ADJACENT slots`: assert at least one other field sits
    between them. ⚠️ **Assert on the rendered ORDER, not on the module** — the module is the
    removability guarantee, the order is the review's guarantee, and only one of the two is visible
    to a patient.
  - `removing the module removes both fields and nothing else`.
  - `the screen makes no claim of cultural-safety approval`.
- [ ] **Step 2 — the zero-admissions state**
  - `a patient with no admissions renders the worded absence, not a blank panel`.
  - `the count reads "None", never "0"`. ⚠️ **Two assertions, because a `0` and a blank panel are
    different defects**; one test covering both passes while either ships.
- [ ] **Step 3 — implement.** Tokens only, no raw hex.
- [ ] **Step 4 — MUTATION, each with its expected message named**
  - Move the interpreter field adjacent to the cultural field → **`renders the two sensitive fields
in NON-ADJACENT slots`** fails. Report the message and the collected count.
  - Replace the worded absence with an empty `<div>` → the zero-state test fails **by name**.
  - ⚠️ Change `None` to `0` → the count test fails **separately**, proving the two are not one
    assertion wearing two titles.

---

## Task B: The ward overview (`ward-home`) and the ward screen (`ward-entry`)

**Files**

- Create: `src/components/ward-management/wards/ward-overview.module.css`
- Modify: `src/components/ward-management/wards/ward-index.tsx`,
  `src/components/ward-management/ward/ward-screen.tsx`
- Test: `tests/ward-overview-and-entry.dom.test.tsx`

**Interfaces** — consumes `ward-shell`, `wardPlaceFor`, `ward-panel`, `ward-figure`, `ward-chip`.

- [ ] **Step 1 — the failing test**
  - `the bed-list control is available with zero questions answered`: assert **no `disabled` AND no
    `aria-disabled`**, with the panel showing `0 of 3 confirmed`.
  - `the screen says so in words`: assert the sentence, ⚠️ **because the attribute check passes on a
    control that is inert for some other reason.** An enabled control and a stated promise are
    different claims.
  - `the overview links to every ward and asks nothing`: no form control on `ward-home`.
- [ ] **Step 2 — implement.**
- [ ] **Step 3 — MUTATION**
  - Add `aria-disabled="true"` to the control → the availability test fails by name.
  - Delete the "Always available" sentence → the **wording** test fails while the attribute test
    still passes. ⚠️ **If both fail together they are one test wearing two names.**

---

## Figures: none invented

Every figure named here is **quoted from the prototypes**, which take ward and suburb names from the
repository's WA reference data and list their invented figures in their own footer. **This plan adds
no new figure.**

⚠️ **`--ward-space-N` is N PIXELS; the surfaces are `--ward-ground`, `--ward-canvas`, `--ward-chrome`
and `--ward-subtle`; and a `--ward-*` that is not declared renders invisible rather than failing.**

## Left open

1. **Whether the two sensitive fields belong on the screen at all** — Aboriginal health review,
   unresolved. **Nothing in this plan depends on their presence.**
2. **The ward-home / ward-entry naming in the brief** — flagged above; confirm before Task B.
3. **`--ward-border-subtle` does not exist anywhere in `src/`.** The patient screen must not reach
   for it; only a `currentColor` fallback renders it today.
