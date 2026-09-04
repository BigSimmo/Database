# Ward Flow Screens — Referral Form and Search

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the referral intake and the patient search onto the Board language and the shell's ground, remove one token that renders at the opposite of what its name says, and close an FD-18 gap on the one screen where destinations are actually chosen.

**Tech Stack:** Next.js 16, React 19, TypeScript 6 strict, CSS Modules with `composes`, Vitest, Playwright.

---

## The two decisions this plan was asked to settle

### Decision 1 — the eligibility panel states PURPOSE on every destination row, and says nothing about who may decline

**Verified at source before writing any wording.** `src/components/ward-management/ward-referrals.ts:144-149`:

> _"⚠️ **EVERY ROW SHOWING AN ED REFERRAL MUST SHOW THIS, and it is a safety rule rather than a presentational preference.** The spec's `FD-18` correction (2026-08-30) is explicit: the three ED flows are no longer told apart by what they forbid — **every referral is declinable, the ward's medical notification included** — so the only thing distinguishing them is **what the row is FOR.** A declinable row with no stated purpose is indistinguishable from a bed request."_

The canonical wording is `referralPurposeLabel` (`ward-referrals.ts:178`): **"Asking for a bed"**, **"For psychiatric review"**, **"For medical assessment"**. It is exhaustive by `switch` over `REFERRAL_PURPOSES`, so a fourth purpose cannot reach a screen without a human naming it.

🔴 **AND THE GAP IS ON THIS SCREEN.** `referralPurposeLabel` is called in exactly two places, both in `ed/ed-screen.tsx` (`:1080`, `:1306`). **The referral intake and the destination panel never call it.** So the safety rule is met on the screen that _receives_ referrals and unmet on the screen that _raises_ them.

**The rule for every row this plan adds:** state the purpose; never state declinability. No row may say a destination cannot decline, will not decline, or is "only a notification" — all three are false of every destination including a ward's medical notification.

⚠️ **A second, structural half of this decision.** `referrals/referral-match.tsx:221` groups candidates by **travel band** (`groupCandidatesByTravelBand`), with per-group counts whose stated purpose (`:50-51`) is that _"there is nothing available within an hour" is answerable_. The approved prototype groups by **eligibility** instead. That is a change of axis, not a restyle.

**Ruling: eligibility becomes the group axis, and the travel band survives as a per-row fact.** The owner asked for "every option the patient meets criteria for". But the band grouping answers a real clinical question with committed guards behind it, and deleting the axis deletes the answer. Task 4 keeps both: eligibility groups the rows, each row carries its band, and the "nothing within an hour" question is answered by a stated count rather than by the grouping.

### Decision 2 — search keeps the scope it already has, and the zero-result state already says the right thing. The job is to guard them through a restyle.

**Read before deciding.** `search/patient-search.tsx` already runs two searches — `findPatients(patients, text)` for people and `searchPatients(movements, referrals, units, query)` for movements and referrals — and the component says why (`:78-85`):

> _"`searchMovements` applies `isOpen` first and unconditionally, so it can only ever find somebody mid-journey. A patient who has been referred but not moved, one who has arrived on a ward, and one who has just been added and has nothing attached at all are all invisible to it — and the last of those is the case the owner's flow turns on: 'search a patient, and if nobody comes up, ADD them.' You cannot know nobody came up if the search can only see people already in transit."_

**Searchable, stated rather than invented:** people by **name or record number**; open movements by **id, department, destination, stage and owner**. Placeholder today: `"Name, record number, or movement id…"` (`:123`).

**The zero-result state is already correct and must not be lost.** `:281` reads **"No matches — no open movement or waiting referral fits the current search."** That says _nothing matched_, not _nothing exists_. `:285` goes further and states the positive thing: _"No open movement fits the current search. The waiting referrals above have not been accepted anywhere yet."_ The component's own comment (`:50-51`) calls this _"conservative failure … never a bare empty table with no explanation"_, and `:198` gives the people-empty state an **Add** link so the owner's flow continues from the dead end.

🔴 **BUT THE APPROVED PROTOTYPE GOES FURTHER THAN THE IMPLEMENTATION, AND THAT PART IS A BUILD, NOT A RESTYLE.** `mockup-search.html:416` names the query and the active filter:

> _"**Nobody matches "Zhivkova" with the Community filter applied.** No name or record number in Ward Flow contains what you typed, among people currently marked as community."_

and follows it with four concrete ways out (`:417-422`), including _"Remove the **Community** filter. The person may currently be in hospital or recently discharged rather than in the community"_ and _"If the person genuinely is not in Ward Flow yet, start a new referral for them instead."_

**That is materially better than today's "No matches — no open movement or waiting referral fits the current search."** It says which filter is suppressing the result, which is the single most useful thing a dead end can say. So Decision 2 is **two things, not one**: _pin_ the property the implementation already has, and _build_ the specificity the prototype adds.

⚠️ **A capability the placeholder hides.** The prototype's input reads `placeholder="Search by name or record number…"` (`:324`), and its own results carry a **Movements** panel (`:383`, row `MV-118`). The implementation's placeholder is wider — `"Name, record number, or movement id…"` — and it does search movement ids. **The prototype's placeholder understates what the box can do.** Task 5 keeps the wider wording; a search box that can find a movement id and does not say so is a feature nobody discovers.

⚠️ **A fourth state the implementation may not have.** `mockup-search.html:427-455` specifies **"Too many matches"**: 42 people match, the first 8 shown most-recently-active first, and referral and movement matches **hidden with the reason stated** (`:453`). Whether the implementation has this is unverified — see Left Open.

⚠️ **And one thing is NOT settled:** the governance banner's wording is marked in the source as **`PLACEHOLDER WORDING — owner has not chosen this`**. Task 5 pins the _scope claim_ against the code that implements it, never the sentence, so the owner can reword without reddening a test.

---

## Global Constraints

The foundation plan's Global Constraints apply unchanged. These are additional, and each was measured on `codex/task-ward-flow-live-state-20260831` on 2026-09-04.

- **Ward Flow only.** Nothing outside `src/components/ward-management/`, `src/app/mockups/ward-flow/`, `tests/ward-*`.
- ⚠️ **`--ward-space-N` is N PIXELS.** `--ward-space-16` is `1rem`, `--ward-space-8` is `0.5rem` (`ward-tokens.module.css:45-52`). It is not a step index.
- ⚠️ **Four surfaces exist and no others:** `--ward-ground`, `--ward-canvas`, `--ward-chrome`, `--ward-subtle` (`ward-tokens.module.css:22-25`). There is no `--ward-panel` and no `--ward-sunken`. A `var()` naming one resolves to nothing and falls to its fallback, silently.
- ⚠️ **DOM tests are `*.dom.test.tsx`.** A `*.test.tsx` file matches no vitest include glob and **never runs**. A plan step that reports "PASS, 0 tests" has found this, not passed.
- ⚠️ **Never assert `toHaveClass(styles.x)`.** Under CSS Modules in test the identifier and the rendered class are the same string, so the assertion compares a value with itself and cannot fail.
- **Every guard ships with a mutation step naming its expected message, and reports the collection count.** A red reading `Tests no tests` is a parse error, not a catch.
- **No stylesheet in this plan may paint `--ward-ground`.** The shell owns it and `tests/ward-shell-ground.test.ts` pins a single painter.

---

## What removing the root white actually does — measured, not assumed

Both screens paint white over the shell's ground at their root: `referrals/referrals.module.css:35` (in `.screen`, opened `:15`) and `search/search.module.css:28` (in `.screen`, opened `:6`).

⚠️ **They are not the only `background: var(--surface)` in those files, and the others must not be deleted.** Attributed by selector:

| File      | Line                    | Selector                                                                                         | Disposition                                                                                                                          |
| --------- | ----------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| referrals | 35                      | `.screen`                                                                                        | 🔴 **remove** — this is the white over the ground                                                                                    |
| referrals | 158, 230, 264, 963, 981 | `.select`, `.choiceOption`, `.destinationOption`, `.matchOverrideSelect`, `.matchOverrideButton` | **convert to `var(--ward-canvas)`** — real controls that should be light, routed through the token layer instead of reaching past it |
| search    | 28                      | `.screen`                                                                                        | 🔴 **remove**                                                                                                                        |
| search    | 132, 276                | `.field select`, `.referralRow`                                                                  | **convert to `var(--ward-canvas)`**                                                                                                  |

**How each screen reads on grey, computed per pair:**

```
panel fill on ground   canvas #fcfdfe on ground #eaeef4 = 1.14:1  light
                       canvas #101315 on ground #08090b = 1.07:1  dark
panel BORDER on ground --ward-border #667085 on #eaeef4 = 4.27:1  light
                       --ward-border #7c858f on #08090b = 5.32:1  dark
```

🔴 **A panel does not read as floating because of its fill — 1.14:1 is nothing. It reads as floating because of its border, at 4.27:1.** The consequence is the risk of these two tasks: **anything on either screen that currently sits on the root white with no border of its own will, after this change, sit on grey with no edge.** Bare paragraphs, unbordered rows and naked form fields are the cases to look for.

⚠️ **And every text colour outside a panel must be recomputed.** Contrast is a property of a pair; the foundation plan already measured the quiet text value passing 4.63:1 on white and **failing at 4.04:1 on the ground**. Text that moves from white to grey does not keep its ratio.

---

## Task 1: The referral screen leaves the white and joins the ground

**Files:**

- Modify: `src/components/ward-management/referrals/referrals.module.css`
- Test: `tests/ward-referral-ground.test.ts`

- [ ] **Step 1: Write the failing test.** Assert statically that `referrals.module.css` contains no `background: var(--surface)` in its root `.screen` rule, that it paints `--ward-ground` nowhere, and that the five control selectors named above each use `var(--ward-canvas)`. Pin the control list as a **sorted array of selector names**, not a count — a count survives a paint moving between selectors.

- [ ] **Step 2: Run test to verify it fails.** Expected: FAIL naming `.screen`.

- [ ] **Step 3: Make the change** — delete `:35`, convert the five.

- [ ] **Step 4: Run test to verify it passes.** Report the collection count.

- [ ] **Step 5: 🔴 Recompute every text pair that now sits on the ground.** For each text colour used outside a panel on this screen, compute its ratio against `--ward-ground` in both themes and record it in the commit. **Do not carry a ratio across surfaces.** Anything under 4.5:1 is a finding to report, not a value to nudge.

- [ ] **Step 6: Watch the guard fail for the right reason.** Restore `background: var(--surface)` to `.screen`.
      Expected: **"the referral screen must not paint over the shell's ground — .screen still declares background: var(--surface)"**. Restore, confirm green, report both collection counts.

- [ ] **Step 7: Commit.**

---

## Task 2: The search screen leaves the white, and loses a token that never existed

**Files:**

- Modify: `src/components/ward-management/search/search.module.css`
- Test: `tests/ward-search-ground.test.ts`

🔴 **`--ward-border-subtle` DOES NOT EXIST IN `src/`.** One usage, `search.module.css:323`:

```css
.peopleList li {
  padding: var(--space-3);
  border: 1px solid var(--ward-border-subtle, currentColor);
}
```

The token is declared nowhere, so **every person result is outlined in `currentColor` — the row's own text colour, at full text contrast — under a name promising the opposite.** The real tokens are `--ward-border` (`--neutral-500`), `--ward-border-strong` (`--text-muted`) and `--ward-divider` (`ward-tokens.module.css:30-32`).

- [ ] **Step 1: Write the failing test.** Assert: no Ward Flow stylesheet references `--ward-border-subtle`; the root `.screen` paints no `--surface`; the two control selectors use `--ward-canvas`; and — the general form — **every `var(--ward-*)` used anywhere under `src/components/ward-management/` resolves to a token declared in `ward-tokens.module.css`.** That last assertion is what stops the next phantom token, and it is the one worth writing carefully.

- [ ] **Step 2: Run it and watch the phantom name itself.** Expected: FAIL — **"--ward-border-subtle is used at search/search.module.css:323 and declared nowhere"**.

- [ ] **Step 3: Choose the replacement and say why in the diff.** `--ward-border` is the panel edge. A list item inside a panel is a lighter thing than the panel itself, so `--ward-divider` is the候 candidate — ⚠️ **but see the finding below before choosing it.**

- [ ] **Step 4: Run test to verify it passes.** Report the collection count.

- [ ] **Step 5: Mutation — introduce a second phantom.** Add `var(--ward-elevated)` to any rule.
      Expected: the same assertion fires naming `--ward-elevated`. This proves the guard catches the _class_ of defect and not just the one instance.

- [ ] **Step 6: Commit.**

⚠️ **A FINDING THIS TASK MUST NOT SILENTLY ABSORB.** `--ward-divider` maps to `var(--border)` (`ward-tokens.module.css:32`). Measured against `--ward-canvas`, which is the surface a divider inside a panel is drawn on: **1.21:1 light and 1.42:1 dark** — the same value that was replaced across 27 Ward Flow stylesheets on 2026-09-03 for being invisible. Against `--ward-ground` it is **1.06:1**. **A rule drawn with `--ward-divider` is a rule nobody sees.** This is a foundation-layer token and out of scope here: **report it, do not change it, and do not pick it as the replacement in Step 3 without saying that you know.**

---

## Task 3: The destination panel states purpose on every row

**Files:**

- Modify: `src/components/ward-management/referrals/referral-match.tsx`
- Test: `tests/ward-referral-destination-purpose.dom.test.tsx`

- [ ] **Step 1: Read the approved prototype first.** `docs/ward-flow/design/prototypes/mockup-referral.html` — the destination panel, its group headings and its row copy. **Take the wording from there, not from this plan.**

- [ ] **Step 2: Write the failing test.** Assert every rendered emergency-department destination row contains the output of `referralPurposeLabel` for its own purpose — **called, not respelled**, so the test fails if the screen hardcodes "For psychiatric review" and the label later changes. And assert the negative, by name: no row contains "declines", "cannot decline", "will not decline" or "not a bed request".

- [ ] **Step 3: Run test to verify it fails.** Expected: FAIL — no row states a purpose today.

- [ ] **Step 4: Implement.**

- [ ] **Step 5: Run test to verify it passes.** Report the collection count.

- [ ] **Step 6: 🔴 Mutation — add a false promise.** Put "A notification, not a bed request — nobody declines it" on an ED row.
      Expected: **"no destination row may state who can decline — FD-18: every referral is declinable, the ward's medical notification included"**. ⚠️ This exact sentence was found on a prototype ED card on 2026-09-03 and corrected against source; the mutation is the real defect, not an invented one.

- [ ] **Step 7: Commit.**

---

## Task 4: Eligibility becomes the grouping axis, and the travel band survives as a fact

**Files:**

- Modify: `src/components/ward-management/referrals/referral-match.tsx`
- Test: `tests/ward-referral-eligibility-groups.dom.test.tsx`

⚠️ **This is the behaviour change in this plan.** `groupCandidatesByTravelBand` currently supplies the group axis and its counts answer _"is there anything within an hour"_ (`referral-match.tsx:50-51`). Regrouping by eligibility removes that answer unless it is deliberately kept.

- [ ] **Step 1: Write the failing test.** Assert: rows are grouped by eligibility; **a group whose own copy says an option is unavailable is not filed under a heading a reader skims as available**; each row still states its travel band; and the "nothing within an hour" question is answerable from rendered text.

- [ ] **Step 2: Run test to verify it fails.**

- [ ] **Step 3: Implement**, keeping `groupCandidatesByTravelBand` as the source of each row's band.

- [ ] **Step 4: Run test to verify it passes**, and **run the existing referral suites** — `ward-referral-destinations.dom.test.tsx`, `ward-referral-matching.test.ts`, `ward-referral-match-suburb.dom.test.tsx`, `ward-referral-match-hooks-order.dom.test.tsx`, `ward-referral-screens.dom.test.tsx`. Report each file's count. 🔴 **A regrouping that reddens one of these has changed behaviour somebody pinned.**

- [ ] **Step 5: Mutation — file an unavailable option under the available heading.**
      Expected: **"an option whose own text says it is unavailable must not sit under a heading a clinician skims as available"**. ⚠️ Also a real defect: found on the referral prototype on 2026-09-03, where "Inner City team — but not on this referral" sat under "Also possible".

- [ ] **Step 6: Commit.**

---

## Task 5: Pin the search scope and the words a dead end uses

**Files:**

- Test: `tests/ward-search-zero-result-copy.dom.test.tsx`

🔴 **This task changes no behaviour. It exists because the restyle is when this gets rewritten.**

- [ ] **Step 1: Run the existing suites first and record them green** — `ward-patient-search.dom.test.tsx`, `ward-patient-search.test.ts`. A guard written against an already-red baseline certifies the breakage.

- [ ] **Step 2: Write the PIN half.** Assert, with a query matching nothing:
  - the movements/referrals empty state says **nothing matched**, not that nothing exists — it must contain "fits the current search" and must **not** be a bare empty table;
  - the people empty state offers the **Add** route out (`ward-patient-search-people-empty-add`);
  - ⚠️ the **positive** statement survives: when there are waiting referrals but no open movement, the copy still says the referrals **have not been accepted anywhere yet** rather than only naming the absence.
  - Pin the searchable scope against the **code**: `findPatients` is called with `patients`, and `searchPatients` with `movements, referrals, units`. Do **not** pin the governance banner's sentence.

- [ ] **Step 3: Run it. It should PASS immediately** — that half of the behaviour is already correct. Report the collection count. ⚠️ **A test that passes on first write has proved nothing yet.** Step 6 is not optional; it is what makes this half real.

- [ ] **Step 4: 🔴 Write the BUILD half — the specificity the prototype adds, and it is currently failing.** Assert the zero-result copy:
  - **names the query the reader typed**, and
  - **names any filter that is currently narrowing the search**, in the shape of `mockup-search.html:416` — _"Nobody matches «query» with the «filter» filter applied"_;
  - offers the prototype's ways out (`:417-422`), including **removing the filter that may be suppressing the match** and **starting a referral if the person genuinely is not in Ward Flow yet**.

  ⚠️ **This is the useful half.** "No matches" tells a clinician nothing they did not already know; "no match _with the Community filter applied_" tells them the one thing that will fix it. Take the wording from the prototype, not from this plan.

- [ ] **Step 5: Implement, then run. Report the count.**

- [ ] **Step 6: 🔴 Four mutations, run and read separately.**
  1. Replace the empty state with "No results." → Expected: **"a zero-result state must say nothing matched, not that nothing exists"**.
  2. Delete the Add link → Expected: **"the people empty state must offer the add route — 'if nobody comes up, add them' is the flow this screen exists for"**.
  3. Drop `referrals` from the `searchPatients` call → Expected: the scope assertion names the missing argument.
  4. Remove the filter name from the zero-result sentence, leaving the query → Expected: **"a dead end must name the filter that may be suppressing the match, not only the query"**. ⚠️ This mutation exists because the message still _looks_ specific with the filter gone, and that is the version somebody shortens it to.

- [ ] **Step 7: Keep the wider placeholder.** The implementation's `"Name, record number, or movement id…"` states a capability the prototype's `"Search by name or record number…"` omits, and the prototype itself renders a **Movements** panel. Assert the placeholder names movement id, with a comment saying the prototype understates the box rather than the box exceeding the design.

- [ ] **Step 8: Commit.**

---

## Task 6: Both screens adopt the primitives, and the adoption is counted

**Files:**

- Modify: both screens' components and stylesheets
- Test: `tests/ward-screen-adoption-referral-search.test.ts`

- [ ] **Step 1: Write the failing test.** Assert both stylesheets `composes` from the committed primitives rather than redeclaring; that neither redeclares a class the shared layer provides (`.field`, `.hint`, `.pending`, `.step`, `.wardName`, `.hero`, `.heroFigures`); and that each screen still renders exactly one `<h1>` and one `<main id="main-content">`.
      ⚠️ Use a real selector regex for the redeclaration check — `css.includes(".field {")` misses selector lists, pseudo-classes and a newline before the brace, which is four ways to redeclare and pass.

- [ ] **Step 2-4: fail, implement, pass**, reporting counts.

- [ ] **Step 5: Mutation — redeclare `.field` in `search.module.css`** as `.field,\n.other {`.
      Expected: the redeclaration assertion names `.field` **and the selector-list form**, proving the regex and not just the substring.

- [ ] **Step 6: Commit.**

---

## Left open, deliberately

1. **Which token replaces `--ward-border-subtle` on `.peopleList li`.** `--ward-divider` is the obvious pick and measures **1.21:1 / 1.42:1** — invisible. `--ward-border` is 4.88:1 and may be heavier than a list row wants. **This is a design call and the measurements are above; I am not choosing it in a plan.**
2. 🔴 **`--ward-divider` is a foundation-layer token resolving to the value removed from 27 stylesheets for being invisible.** Out of scope here. It needs its own decision, and if it gets one, Task 2 Step 3 changes.
3. **Whether the eligibility axis replaces the travel-band groups or nests inside them.** Task 4 keeps the band as a per-row fact; whether a clinician wants bands as a second grouping is a design question the prototype does not answer.
4. **The governance banner wording on both screens is marked placeholder and the owner has not chosen it.** Nothing here pins it.
5. **The search screen's fourth state — "Too many matches" — is specified and unbuilt as far as I know.** `mockup-search.html:427-455`: 42 people match, the first 8 shown most-recently-active first, and referral and movement matches **hidden with the reason stated** (`:453`, _"Referral and movement matches are hidden while a search matches this many people. Add a filter above to bring them back."_). ⚠️ **I did not check whether the implementation has an overflow state at all**, so this is unverified rather than missing. If it is absent it is a task this plan does not contain, and it should not be folded into Task 5 — hiding two result lists is a behaviour with its own failure mode.

6. **The referral prototype already carries the 2026-09-03 corrections**, confirmed on the committed ref: the count reads `5 of 10` (`:443`), both ED rows state _"For psychiatric review — a doctor sees her in the department"_ (`:466`, `:467`), the refused community team sits under its own heading _"Not on this referral — arranged at step 4"_ (`:469`), and the order control defaults to name (`:453`). **Task 3's mutation restores a defect that was removed from that file, which is why the expected message is worth trusting.**

## What is real

Every number in this plan was computed or read on `codex/task-ward-flow-live-state-20260831` on 2026-09-04: the four surface tokens; the `--ward-space-N` pixel scale; `--ward-border-subtle` used once at `search.module.css:323` and declared nowhere; the six and three `background: var(--surface)` sites with their owning selectors; `referralPurposeLabel` called only at `ed-screen.tsx:1080` and `:1306`; the search empty-state strings at `patient-search.tsx:281` and `:285`; and every contrast ratio, computed per pair.

**No figure here is invented.**
