# Raise a referral — locked design, and the plan to build it

**Design of record:** [`prototypes/mockup-referral-intake-v5.html`](prototypes/mockup-referral-intake-v5.html)
**Superseded, kept for comparison:** [`prototypes/mockup-referral-intake-v4.html`](prototypes/mockup-referral-intake-v4.html)
**Screen:** `src/components/ward-management/referrals/referral-intake.tsx` (1,526 lines, one component today)
**Status:** design locked, not yet built. Nothing in this plan has been implemented.

---

## ⚠️ v5 REVERSES A SAFETY CONSTRAINT. READ THIS BEFORE TASK 1.

**The owner asked for a written patient history, and v5 adds one:** three bounded free-text boxes —
_why now_ (required), _background_, _risk and safety_.

**That is clinically necessary and it removes a guarantee.** Until v5 this form had no free-text
control of any kind, so it was _structurally incapable_ of recording a name, an address or a clinical
note. Three screens' worth of copy said so, truthfully. With a text box it becomes a policy someone
has to keep, not a property the software holds.

**Everything that promised otherwise has already been rewritten inside the v5 mockup** — the
governance banner, the anchor footer, the rail's consequences panel, and appendix rule 6. Do not
carry a v4 sentence into the build.

### Two committed tests pin the old guarantee and WILL go red

| Test                                                | What it asserts                                         |
| --------------------------------------------------- | ------------------------------------------------------- |
| `tests/ward-referral-screens.dom.test.tsx:453`      | no text input, textarea or contenteditable **anywhere** |
| `tests/ward-referral-destinations.dom.test.tsx:513` | `textarea` and `[contenteditable]` both length **0**    |

⛔ **Do not delete either one.** They are not obstacles; they are the only thing standing between
"three deliberate history fields" and "free text crept onto this form somewhere nobody looked".

✅ **Rewrite them to the new boundary:** free text exists in exactly the three named history fields
and nowhere else on the screen — assert the _count and the identity_ of the permitted fields, so a
fourth box added later still goes red. Prove the rewritten guard can fail by adding a stray
`<textarea>` outside the history and watching it catch that, specifically.

⚠️ **Floor it on the fields walked, not on the violations found.** A guard that counts violations
goes green the day somebody deletes the history, which is the one change it most needs to notice.

---

## Part 1 — For the owner

### What is locked

The v4 mockup is the specification, not a picture. It draws **every state the screen can reach**, which
is the part that makes it lockable: a state nobody drew is a state somebody invents later, at speed,
without thinking. The appendix at the bottom of the mockup is as binding as the top half.

Five things are settled by it:

1. **The person is never off screen.** A full identity band sits above the form; once you scroll past
   it, the app bar keeps the name and record number with a link straight to the profile.
2. **Every question is in exactly one of four states** — answered, outstanding, not applicable, or
   refused — each with one appearance, defined once.
3. **Colour is never decoration.** Green means in catchment or answered. Amber means outstanding or
   out of catchment. Red means a refused combination. Grey means not recorded. If a thing is coloured,
   the colour is the claim.
4. **A step spine** down the left shows where you are without you reading anything.
5. **The right-hand rail has a primary**: one panel showing exactly what the referral will record,
   with the consequences of sending beneath it.

### The one decision I made on your behalf, and why

Two facts a person's record can hold — **Aboriginal or Torres Strait Islander status**, and
**interpreter or preferred language** — are marked in the code as _held but not settled for display_.
Whether they belong on a screen at all is still open with the Aboriginal health review. The profile
screen shows them only because a real defect in their placement had already been fixed there, and
removing them would have re-opened a decision nobody had re-opened.

A brand-new screen has no such history. So **the referral anchor does not show either of them.** It
carries a link saying two further identity facts sit on the profile. Three reasons:

- The anchor's job is _who am I referring_, not a clinical profile. The profile is one click away.
- Adding them here would be a fresh widening of a display decision that is under review — not a
  layout choice, and not mine to make.
- The profile screen binds those two fields with a rule that they must never sit next to each other.
  My first draft of the anchor put them side by side in a row of chips. That is exactly the defect
  the rule exists to prevent, and it would have passed every existing test, because those tests are
  written against the profile screen and not this one.

**If you want them on the referral screen, say so and I will add them** — under the same
non-adjacency rule, with its own guard. I am not recommending it before the review reports.

### What I need from you

**Nothing, to start.** Every other decision is settled by the mockup or by existing code. One optional
question, which you can answer whenever:

> The anchor heads with **"Maya Whitlock"**, because that is what the system's existing name helper
> produces and matching it avoids a second way of writing a name. Clinical systems often prefer
> **"Whitlock, Maya"** so lists sort by family name. Changing it would change every screen that shows
> a name, not just this one. **My recommendation: leave it as it is** — it is consistent, and the
> gain is small next to touching every screen. Say the word if you would rather have the other.

### How it lands

Ten steps, each one small enough to check on its own, and each with something that goes red if it is
wrong. Sixteen existing test files watch this screen; the plan keeps all of them green and adds
coverage to the one part — the right-hand rail — that has none today. The first step is pure safety and changes nothing you can see. Nothing in the plan touches a
live database, an outside service, or costs anything to run.

---

## Part 2 — The plan

### 2.1 What makes this hard, stated plainly

Three facts about the current screen shape everything below.

**One file, one component, 1,526 lines.** There is no seam to change one part without reading all of
it. Modularity is not a nicety here; it is the difference between a two-hour change and a two-day one.

**The stylesheet is shared with two frozen screens.** `referrals.module.css` holds 95 classes.
Measured against the three files that import it:

| Owner                         | Classes | Examples                                                                                          |
| ----------------------------- | ------: | ------------------------------------------------------------------------------------------------- |
| `referral-board.tsx` (frozen) |      27 | `screen`, `main`, `governanceBanner`, `pageHeader`, `pageTitle`, `prototypeBadge`, `headerAction` |
| `referral-match.tsx` (frozen) |      39 | `fieldLegend`, `select`, `rejection`, `matchPanel`, `waitBadge`                                   |
| `referral-intake.tsx` only    |      27 | `intakeLayout`, `fieldCard`, `destinationList`, `summaryRow`, `submit`                            |

Restyling the intake by editing a shared class silently restyles a frozen screen that nobody opened.
**Task 1 removes this hazard permanently** rather than asking every future change to remember it.

**The screen already does the hard part correctly.** It reads `?patientId=` from the URL, checks it
against the real patient list, refuses to open on an id it does not recognise, and carries the id —
and only the id — into the referral. The anchor is a presentation layer over work that already exists.
It invents no data.

### 2.2 Target structure

`referral-intake.tsx` stays where it is and keeps every export, so no import anywhere changes. It
becomes a composition root of about 250 lines. The parts move to a sibling folder:

```
src/components/ward-management/referrals/
  referral-intake.tsx          composition root + the existing public exports (re-exported)
  intake/
    intake.module.css          ← the intake's OWN stylesheet. Zero classes shared with any other file.
    intake-anchor.tsx          PatientAnchor — three states
    intake-step.tsx            Step + StepSpine
    intake-field.tsx           Field (four states), YesNo
    intake-destinations.tsx    DestinationCard + list
    intake-record-rail.tsx     "What this referral will record"
    intake-send.tsx            SendBar — three states
    intake-state.ts            field-state derivation; answeredProgress; referralSummaryRows
```

**Why its own stylesheet, given that it duplicates a few shell rules.** It is a deliberate fork, not
accidental duplication. The intake is being redesigned; the frozen screens are not. Their rules are
_supposed_ to diverge from this point on, and holding them in one file makes divergence look like a
bug and makes an accident look like a refactor. After Task 1 the frozen screens are unreachable from
any intake change — provable in one grep, rather than remembered.

### 2.3 The tasks

Each task lists the files it touches and **the catcher** — the specific thing that goes red if the
task is done wrong. A task without a catcher is not ready to dispatch; go and build the catcher first.

---

**Task 1 — Give the intake its own stylesheet. No visual change whatsoever.**
Create `intake/intake.module.css` holding the 27 intake-only rules plus copies of the shared shell
rules the intake uses (`screen`, `main`, `governanceBanner`, `prototypeBadge`, `pageHeader`,
`pageTitle`, `pageSubtitle`, `headerAction`, `fieldLegend`, `select`, `rejection`). Repoint
`referral-intake.tsx` at it. Delete nothing from `referrals.module.css` — the frozen screens still
need every rule in it.

⚠️ **The trap in this task is `tests/ward-referrals-print.test.ts`.** It reads the _stylesheet text_
and checks that thirteen named classes — `fieldCard`, `choiceCard`, `choiceOption`,
`destinationOption`, `destinationName`, `rejection`, `confirmation`, `select`, `fieldLegend`,
`fieldNote`, `destinationNote`, `destinationFact`, `governanceBanner` — carry the print rules that
stop the form printing white-on-white. It never renders the component. So if the intake's classes move
to a new file or get new names, **that guard keeps passing while describing dead CSS**: it would go on
certifying print rules for a stylesheet the screen no longer uses. Repoint it at
`intake.module.css` in this task, in the same commit, or it silently stops protecting anything.

⚠️ **The same file pins `.screen > aside` as a _direct child_ relationship**, which the v4 layout does
not have — its rail sits inside a workspace wrapper. Either keep the `<aside>` a direct child of the
top-level screen element, or update that selector deliberately. Do not discover this at print time.

_Catcher:_ a new guard test asserting `referral-intake.tsx` imports no stylesheet but its own, **plus
the entire existing referral suite staying green** — which is what proves nothing moved on screen.
Prove the guard can fail by pointing one class back at the shared module and watching it go red. Then
prove the repointed print guard can fail too, by removing one print rule from the new stylesheet.

---

**Task 2 — Map the palette onto the ward tokens. Add nothing that already exists.**
The mockup names its own colours so it can stand alone. The build must not. The ward token set
already covers almost all of it:

| Mockup                                   | Ward token                                                  |
| ---------------------------------------- | ----------------------------------------------------------- |
| `--accent` / `-wash` / `-edge`           | `--ward-blue` / `--ward-blue-soft` / `--ward-blue-border`   |
| `--good` / `-wash`                       | `--ward-success` / `--ward-success-soft`                    |
| `--warn` / `-wash`                       | `--ward-warning` / `--ward-warning-soft`                    |
| `--crit` / `-wash`                       | `--ward-danger` / `--ward-danger-soft`                      |
| `--surface` / `--surface-2` / `--ground` | `--ward-canvas` / `--ward-subtle` / `--ward-ground`         |
| `--ink` / `--muted`                      | `--ward-text` (headings `--ward-heading`) / `--ward-muted`  |
| `--rule` / `--rule-2` / `--rule-3`       | `--ward-divider` / `--ward-border` / `--ward-border-strong` |
| `--tap`                                  | `--ward-tap`                                                |
| `--sp-*`                                 | `--ward-space-*` (the pixel scale)                          |
| z-indexes                                | `--ward-z-*`                                                |

**Drop the teal entirely.** In v4 it marks "a count of the network, never a judgement"; a neutral chip
says the same thing with one less colour to learn. That is a simplification, not a loss.
Record any genuine gap (an elevation/shadow token, tone-coloured borders) in one line each and add the
minimum; do not import a second palette.

_Catcher:_ the repository's existing `no-hardcoded-hex` lint rule, plus a test asserting
`intake.module.css` contains no hex literal. Prove it by putting one hex back.

---

**Task 3 — Split the component. Pure move, no behaviour change.**
Extract the pieces named in §2.2. `referral-intake.tsx` re-exports `answeredProgress`,
`referralSummaryRows`, `REQUIRED_FIELD_NAMES`, `UNANSWERED_VALUE`, `UNANSWERED_OPTION_LABEL` and
`wardAndCommunityBothChosen` from their new homes, so every existing import keeps working.

_Catcher:_ the existing suite green, plus a size guard — `referral-intake.tsx` under 400 lines and no
file in `intake/` over 300. A split that leaves a 1,200-line file has not happened.

---

**Task 4 — Field state as a system.**
One function in `intake-state.ts` maps `(field, draft)` to exactly one of `answered | outstanding |
notApplicable | refused`. Every field renders through one `Field` component driven by that value.

_Catcher:_ a property test over every required field crossed with every draft shape, asserting
(a) exactly one state comes back, never two and never none; (b) `outstanding` holds **if and only if**
the field is applicable and its value is `UNANSWERED_VALUE`. Floor it on the number of fields so it
cannot pass by walking an empty list. Do not write the assertion as a filter over the same predicate
it is testing — that is a tautology, and it will look like a passing guard.

---

**Task 5 — The patient anchor.**
`intake-anchor.tsx`, three states, driven by data that already exists:

- **Attached** — `patients.find(p => p.id === patientIdFromUrl)`. Heading from `patientDisplayName`,
  age from `patientAgeYears`. Shows record number, date of birth and age, sex or gender, suburb,
  catchment team, GP, legal status. Every absent optional field reads **"Not recorded"** — the house
  wording already used on the profile screen — never a blank and never a dash.
- **None attached** — the URL carried no id. Says so, says the referral will carry no pointer, says it
  can still be sent. Offers a person search.
- **Unknown id** — already implemented as a whole-screen refusal. Keep that behaviour exactly; only
  restyle it to match. Do not soften a refusal into a warning.

Profile link: `/mockups/ward-flow/people/<patientId>`. That URL is built inline as a template string
in more than one place today; **add a single helper and use it here**, matching the
`WARD_REFERRAL_INTAKE_HREF` constant that already exists for the other direction.

_Catcher:_ five DOM assertions, each proved by its own mutation —
(a) the name renders on screen **and** the dispatched referral payload contains no name, no record
number and no date of birth, only the id;
(b) a patient with every optional field absent renders "Not recorded" once per field, with no empty
`<dd>`;
(c) neither sensitive field appears anywhere in the anchor's output, asserted by field name, not by
the label text somebody might reword;
(d) the profile href is exactly the person route for that id;
(e) all three states render, selected by the id, not by a prop somebody can set wrongly.

---

**Task 6 — Layout: the step spine, the two columns, the sticky anchor.**

_Catcher:_ Playwright, at 1440×900 and at 375×812 — no horizontal document overflow; the destination
list has a width greater than zero; the Send button is inside the viewport and clickable. **That
middle assertion is not padding:** the live screen shipped with that list at exactly zero width, its
cards pushed 93 px past the right edge and unreachable, and no unit test could see it because jsdom
performs no layout.

⚠️ **Expect `tests/ward-referral-destination-list-clears-legend.test.ts` to fail its PRECONDITION test
during this task, and read the message before acting.** That guard requires `clear: both` on the
destination list _only because_ the question-card legend floats. The new stylesheet will almost
certainly stop floating it, at which point the guard is protecting an invariant that no longer exists
and says so in its own failure text. **Delete the file, and replace it with the Playwright width
assertion above.** Do not re-add a float to make it pass.

---

**Task 7 — The destination card.**
One component, four states (available, chosen, out of catchment, refused combination), a strict
information order that never varies: name → catchment verdict → one sentence of reason → capacity →
figures.

_Catcher:_ a test asserting every rendered card exposes its parts in the same order, over a fixture
containing at least one card in each of the four states. Assert the order over the elements, not over
a hand-typed list of what you expect to be there.

---

**Task 7a — The written history. New in v5, and the only task that changes what is recorded.**
Three bounded fields in `intake/intake-history.tsx`: `whyNow` (required), `background`, `riskAndSafety`.
They join `REQUIRED_FIELDS` so the progress count, the outstanding-questions sentence and the rail all
move together from the one source — never a second list. Limits are 1500 / 2000 / 1000 characters.

**This task carries the model change with it.** The three fields are new on `Referral` and on
`RECEIVE_REFERRAL`, and their doc comments must say what every other field's says: that this one, alone
on the event, is unvalidated text supplied by a person. Nothing normalises it, nothing parses it, and
nothing may ever be derived from it — not urgency, not risk, not a destination.

⚠️ **Do it in this order, and the order is the point.** The two committed no-free-text tests go red the
moment the first `<textarea>` lands. **Rewrite them to the new boundary in the same commit as the field**,
never in a commit of their own — a commit that turns a safety test green on its own is indistinguishable,
six months later, from somebody quietly deleting an obstacle.

⚠️ **Every sentence listed in constraint 13a is inside this task's diff**, not a follow-up: the governance
banner, the anchor footer, the rail consequences panel. v5 has already written all three; copy them.

_Catcher:_ five assertions, each proved by its own mutation —
(a) the boundary guard: free text appears in exactly the three named fields and nowhere else, floored on
the fields walked so deleting the history goes red rather than green;
(b) `answeredProgress` moves from 12 to 15 applicable and the rail, the progress tile and the outstanding
sentence all change together — mutate one to disagree and watch exactly one assertion catch it;
(c) an over-limit value blocks the send and is never truncated on the way to the dispatch — assert the
dispatched string equals the typed string byte for byte;
(d) the rail renders the character count and **does not render any substring of the history text**;
(e) with two destinations chosen the fan-out sentence renders, and with one it does not.

---

**Task 8 — The record rail.**
The rail's rows come from `referralSummaryRows(draft)` and from nothing else.

⚠️ **The rail is currently the only untested part of the screen.** Its four test ids — `-aside`,
`-progress`, `-summary`, `-what-happens` — and both functions behind them are referenced by no test
anywhere in the repository. That reads as "safe to change freely", and it is the opposite: nothing
today proves the progress count or the summary rows render _correctly_, only that nobody checks. A
wrong count here would ship silently. **This task's catcher is therefore new coverage, not a
regression net.**

_Catcher:_ a test asserting the rendered rows equal that function's output exactly — same labels, same
order, same count — and a second asserting the progress card's numbers equal `answeredProgress(draft)`
for a draft with at least one answered and one outstanding field, so neither number can be right by
coincidence. This is also the guard that stops the rail becoming a retyped list that goes stale the
first time a field is added. Retyped enumerations have produced stale copy on this system three times.

---

**Task 9 — The send bar.**
Sticky at the bottom. The reason sits **beside** the button, never above it.

_Catcher:_ the two document-order pins that already exist, kept green —
(a) the outstanding-questions note must come **after** the Send button; and
(b) after a successful send, the confirmation must come **before** the freshly-blank form's note, so
the confirmation reads as belonging to the referral just sent rather than to the empty form beneath it.
Neither is cosmetic: reasons appear and disappear as questions are answered, and a reason above the
button moves the button out from under a thumb mid-tap.

⚠️ **The button's label must stay exactly `Send referral`.** It is the one visible string on this
screen that a test pins verbatim.

---

**Task 10 — Accessibility, phone, dark mode, print.**
Every `id`/`htmlFor` pairing and every `aria-describedby` preserved. Note that
`UNAVAILABLE_REASON_ID` and the test id `ward-referral-intake-unavailable` are **different strings and
both load-bearing** — changing either breaks something different. Tap targets stay at 48 px.
`:focus-visible` on every control. Reduced motion honoured. Dark mode defined for every token, in the
`:root` / `prefers-color-scheme` / `[data-theme]` triple so the toggle wins in both directions.

_Catcher:_ `npm run verify:phone-chrome`, plus the existing accessibility gates.

### 2.4 The constraint register

⚠️ **This line used to say "Eighteen rows", and v5 made it nineteen, then twenty-two.** The count is
gone rather than corrected — a hand-typed total in a document that grows is the same defect as the
governance banner that went on saying "five permitted facts" after a sixth was added. Derive it:

```bash
sed -n '/### 2.4 The constraint register/,/### 2.5/p' \
  docs/ward-flow/design/referral-intake-implementation-plan.md | grep -cE '^\| [0-9]+[a-z]? \|'
```

Everything here is either verified in the current code or is a rule that already caused a defect
somewhere on this system. Nothing in it is a preference.

| #   | Constraint                                                                                                                                                                                                                      | Why                                                                                                                                                                                                                                                                                           |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Never edit a `referrals.module.css` rule used by `referral-board.tsx` or `referral-match.tsx`                                                                                                                                   | Restyles a frozen screen with nobody touching it. Task 1 removes the hazard; until it lands, this is live                                                                                                                                                                                     |
| 2   | Every test id currently under test must survive                                                                                                                                                                                 | **41 concrete ids exist** (35 written out, plus two templates that each resolve over the three destination kinds). **34 are referenced by a test; 7 are not.** Inventory reconciled against the component — no id in a list is missing from the file, none in the file is missing from a list |
| 3   | `UNAVAILABLE_REASON_ID` ≠ the `-unavailable` test id                                                                                                                                                                            | Two different strings, both load-bearing, easy to conflate                                                                                                                                                                                                                                    |
| 4   | Tap targets stay at 48 px (`min-h-12`)                                                                                                                                                                                          | Reducing them to 44 for a generic WCAG rule reintroduces a known `ui-smoke` flake                                                                                                                                                                                                             |
| 5   | The Send reason sits beside the button, never above                                                                                                                                                                             | Otherwise the button moves out from under a thumb as reasons change                                                                                                                                                                                                                           |
| 6   | A destination's figures stay beside their checkbox                                                                                                                                                                              | `aria-describedby` points at them; moving them into a rail unhooks the description silently                                                                                                                                                                                                   |
| 7   | Absence is a sentence — "Not recorded"                                                                                                                                                                                          | A blank reads as a rendering bug or, worse, as a value                                                                                                                                                                                                                                        |
| 8   | Nothing ranks, scores or suggests a destination                                                                                                                                                                                 | Ordering is the network's own fixed order, and the copy says so                                                                                                                                                                                                                               |
| 9   | The person's name is shown, never stored                                                                                                                                                                                        | The referral carries the id and nothing else                                                                                                                                                                                                                                                  |
| 10  | The two sensitive identity fields do not appear on this screen                                                                                                                                                                  | Their display is open with the Aboriginal health review — see Part 1                                                                                                                                                                                                                          |
| 11  | Lists of options are generated from one source, never retyped into a sentence                                                                                                                                                   | Retyped enumerations produced stale copy three times                                                                                                                                                                                                                                          |
| 12  | The unknown-id refusal stays a refusal                                                                                                                                                                                          | It is the behaviour that stops the form opening on a guess                                                                                                                                                                                                                                    |
| 13  | ⚠️ **REVERSED IN v5.** Free text exists in **exactly three** named history fields and nowhere else. Every other `<input>` is still `type="radio"` or `type="checkbox"`; no other `<textarea>` or `[contenteditable]` may appear | Was "no free-text control, ever". The owner asked for a written history on 2026-09-05. The constraint is now a **boundary** rather than a prohibition, and the two tests that pinned the prohibition are rewritten to the boundary, not deleted                                               |
| 13a | **No sentence anywhere may say the form cannot hold a name or free text** without saying which half is enforced                                                                                                                 | The structured fields still cannot; the history plainly can. A promise that outlived the change that falsified it is the defect this project finds most often                                                                                                                                 |
| 13b | **The rail reports the history; it never previews it.** Section count and character count only                                                                                                                                  | A truncated preview implies something read it. Nothing reads it                                                                                                                                                                                                                               |
| 13c | **Free text is never given the answered/green treatment, and is never truncated silently.** Over the limit is a visible, counted, blocking state                                                                                | Green means checked on this screen. A form that quietly drops the last paragraph of a risk note is worse than one that refuses to send                                                                                                                                                        |
| 13d | **When more than one destination is chosen, the screen says the history goes to all of them, before the send**                                                                                                                  | Nothing else on the form fans out identifiable content to several teams at once                                                                                                                                                                                                               |
| 14  | Exactly one `<h1>` and one `<main id="main-content">` on the route; every test id on the page unique                                                                                                                            | Pinned by tests; a redesign that adds a second heading or duplicates an id breaks them                                                                                                                                                                                                        |
| 15  | The Send button's label stays exactly `Send referral`                                                                                                                                                                           | The one visible string on this screen pinned verbatim                                                                                                                                                                                                                                         |
| 16  | The 12-name required-field list, the "Not yet answered: …" sentence, the suburb note's exact sentence, seven accessible label names, and every picker's option set are all pinned against their live source                     | Change any of them deliberately and update the pin in the same commit, or not at all                                                                                                                                                                                                          |
| 17  | `tests/ward-referrals-print.test.ts` must be repointed at the new stylesheet in Task 1                                                                                                                                          | It reads CSS text and never renders, so after a class move it passes while describing dead CSS                                                                                                                                                                                                |
| 18  | `.screen > aside` is pinned as a **direct child** relationship                                                                                                                                                                  | The v4 layout nests the rail inside a workspace wrapper; one of the two must give, deliberately                                                                                                                                                                                               |

### 2.5 How it is verified

**Sixteen test files** touch this screen today. Fourteen impose real constraints; two match only
through prose in comments. The most exhaustive by far is `tests/ward-referral-screens.dom.test.tsx`,
which alone pins the required-field list, the outstanding-questions sentence, every picker's options,
seven accessible names, the yes/no wording direction, and both document-order relationships.

All local, all offline. Nothing here reaches a provider, a database or CI, so nothing needs approval
to run.

```bash
npm run test -- tests/ward-referral-intake-anchor.dom.test.tsx tests/ward-referral-intake-field-states.test.ts
```

```bash
npm run verify:phone-chrome
```

```bash
npm run verify:cheap
```

Run the narrowest gate that covers the task, then widen. `verify:cheap` before handoff, once.

**Two rules about the catchers themselves, because both have been broken here before.**
A guard is worth exactly its ability to be **false** on the unfixed code: restore the defect, watch
_which_ assertion goes red, and confirm the mutant actually ran. A green mutation that never executed
looks identical to one the assertions cannot detect — and it invents a defect rather than missing one.
And two reds for one edit is not a stronger signal; it hides which site moved.

### 2.6 Out of scope

- `referral-board.tsx` and `referral-match.tsx` — frozen, untouched, and the reason Task 1 exists.
- The referral data model, the reducer, and eligibility. This is a presentation change over behaviour
  that already works.
- Any new field on `Patient`. Widening that model needs its own ruling.
- The two sensitive identity fields, until the review reports.
- Person profile and person search, beyond linking to them.
