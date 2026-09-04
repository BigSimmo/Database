# Ward Flow — build plan: transport and statistics

**Written by Ward Builder Two, 2026-09-04. Read against `codex/task-ward-flow-live-state-20260831`.**
Nothing measured in a working tree; every fact came from `git show <ref>:<path>`.

Same shape as `plan-screens-community-and-ed.md`. **Statistics is the screen I repaired tonight, so
its defects below are ones I found and had to correct once already — which is exactly why they are
guards here and not notes.**

---

## ⚠️ Three facts that will otherwise cost an hour each

- 🔴 **A `*.test.tsx` file matches NO vitest project and silently never runs.** Verified in
  `vitest.config.mts`: the node project includes `tests/**/*.test.ts` (a `.ts` glob — it does not match
  `.tsx`), and the jsdom project includes `tests/**/*.dom.test.tsx` (it requires the literal `.dom.`
  segment). **A file called `tests/ward-transport.test.tsx` is collected by neither and runs nowhere.**
  Every DOM test in this plan is `*.dom.test.tsx`.
- ⚠️ **Never assert `toHaveClass(styles.x)`.** CSS-module class names are hashed in the test
  environment; the assertion passes on whatever it is given and cannot fail. Assert rendered text,
  roles and attributes.
- ⚠️ **`--ward-space-N` is N pixels. The surfaces are `--ward-ground`, `--ward-canvas`, `--ward-chrome`,
  `--ward-subtle`** — there is no `--ward-panel`, no `--ward-sunken`, and **no `--ward-border-subtle`.**
  An undeclared `--ward-*` is not an error; it renders invisible.

**Both screen roots currently paint `background: var(--surface)` over the shell's ground.** Task 1 of
each screen removes it. **How each reads on grey, stated rather than discovered:** every panel already
paints its own `--ward-canvas`, so removing the root fill exposes ground **only in the gaps between
panels** — which is the intended Board look. ⚠️ **The two places it will actually show are the figure
strip (tiles are panels, the strip is not) and the footnote block (no panel at all).** Those two need a
surface of their own or they will read as text floating on grey. **Check them specifically; the rest
will look right by construction.**

---

## Decision 1 — transport is three sections, and the empty case is a positive statement

### What belongs where

The prototype is **already not one bare table** — it has no `<table>` at all, and its rail carries four
panels. **The owner's ask is satisfied by keeping that structure and filling one gap.**

| Section                                                       | Contains                                                     | Status                                                |
| ------------------------------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------- |
| **Main — "Waiting for pickup or moving now"**                 | Jobs with no `arrivedAt`/`cancelledAt`, longest wait first   | In the prototype                                      |
| **Main — "Finished today"**                                   | Jobs that ended today                                        | In the prototype ⚠️ see the "cancelled" finding below |
| **Side — "How to book transport"**                            | The four numbered steps                                      | In the prototype                                      |
| **Side — "Providers on this list"**                           | The three model providers, and the no-phone-number statement | In the prototype                                      |
| 🔴 **Side — "Waiting on transport that has not been booked"** | **Movements that need to move and hold no `TransportJob`**   | **NOT in the prototype. This is the gap.**            |

⚠️ **The prototype lists only jobs that already exist.** I searched it for "no transport", "not
booked", "unallocated", "no provider", "self-transport" and read it end to end: **there is no text
anywhere describing a leg with no transport.** So a patient nobody has booked transport for is
**invisible on the transport screen** — which is the one screen whose job is to notice that.

### 🔴 What a leg with no allocated transport shows — and the sentence it must NOT say

**It must say: "No transport recorded."**

**It must NOT say "no transport needed", and this is not a wording preference.** The model cannot
support that claim:

- `Movement.transport?: TransportJob` — **absence is simply no job.**
- Whether transport was _needed_ is `transportNeeded: boolean` on the **`Referral`**, a different record.
- The only join is `Movement.referralId`, **written solely by `RAISE_REFERRAL` and only for referrals
  carrying an emergency-department destination.** For the ordinary ward-addressed referral there is no
  link at all.

⚠️ **So for most legs, "nobody needs to book anything" and "nobody has booked it yet" are
indistinguishable in the data.** A screen saying "none needed" would be asserting something the system
does not know. **"No transport recorded" is true in both cases, and says what is actually held.**

**This is a real model gap and it goes to the owner rather than being papered over.** The fix, if he
wants one, is a field recording that transport was considered and declined — the same three-state
shape as medical clearance: _not considered_ / _considered, not needed_ / _booked_.

### 🔴 A second finding: "cancelled" already means two different things

**The prototype's "Finished today" sub reads "11 arrived, 2 cancelled". There are two unrelated events
that could produce a cancelled job, and they mean opposite things:**

| Source                                                  | What actually happened                                                                                                                                                                        |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `movement.unwinds` entry, `kind: "transport_cancelled"` | ⚠️ **The job was cancelled and REPLACED for rebooking.** `CANCEL_TRANSPORT` never sets `cancelledAt` — it swaps in a fresh job, id suffixed `-replacement-N`. **The patient is still going.** |
| `TransportJob.cancelledAt` set                          | 🔴 **The PATIENT did not proceed.** Only `RECORD_EXAMINATION` sets this, on a `community_order` or `revoked` outcome that closes the movement. **Nobody is travelling.**                      |

**Counting these together, or labelling either of them "cancelled" alone, tells a coordinator that a
patient still on their way has stopped — or that a patient who is staying put is still coming.**
**Task 4 separates them by name: "rebooked" and "did not proceed".**

---

## Decision 2 — statistics interactivity: every chart states its unit and its population

**The screen already has two pickers**, verified:

- `#wait-picker` — "All units" / "Wards" / "Community teams" / "Emergency departments"
- `#decline-picker` — "Count" / "Share of declines", **which switches the axis caption too**

**Charts 2 and 3 carry an explicit on-chart unit caption** — `Unit: count of declines, last 30 days`,
`Unit: share of all declines (%)`, `Unit: patients currently blocked`. ⚠️ **Chart 1 — the wait chart —
does not.** Its unit appears only as an `h` suffix on the final axis tick.

🔴 **That is the same defect as the median, one level down: a chart whose unit is implied rather than
stated is a figure with no scope.** And chart 1 is the one chart where the unit is _not_ enough on its
own — **all three groups are "median hours", and the hours mean three different things.** Task 7 gives
chart 1 a per-group unit line naming the quantity, not just "hours".

⚠️ **And "All units" is the cross-quantity view.** Three groups on one shared axis is legitimate _only_
while nothing compares across them. That is what the guard below enforces.

**Colour:** every bar already carries a full-sentence `title` and every chart a prose text equivalent.
**Keep both, and keep the emphasis marker worded** — `data-flag` reinforces a word, never replaces it.

---

## 🔴 The wait-definition guard — how it makes the defect unbuildable

**The defect, established tonight:** "wait" named three quantities, and a single median across them
averaged unlike things. **Correcting the words is not enough — the words can be rewritten.** So the
quantity becomes a typed property and the words are _derived from it_.

### 1. One vocabulary, in code, with the sentence attached

```ts
export const WAIT_QUANTITIES = {
  ward_bed_ready: "time from accepting a referral to the bed being ready",
  community_first_contact: "time from referral to first face-to-face contact",
  ed_held_awaiting_bed: "time held in the department awaiting an inpatient bed",
} as const;
export type WaitQuantity = keyof typeof WAIT_QUANTITIES;
```

**Every wait figure carries a `quantity: WaitQuantity`.** ⚠️ **The label, the axis caption AND the
hover text are all derived from the same entry** — so a tooltip cannot disagree with its tile, because
there is only one place the words come from. **That is what covers hover text without anyone having to
remember to check it.**

### 2. A comparison across quantities THROWS

`WaitSuperlative({ figures })` and `WaitMedian({ figures })` each compute the set of distinct
`quantity` values and **throw when it is larger than one** — the same house pattern as
`WardFigureStrip`'s at-most-two-flagged rule, which already ships and is already proven.

```
A wait comparison must be within one quantity; this one spans 2:
"time from accepting a referral to the bed being ready" and
"time from referral to first face-to-face contact". A median across
these averages unlike things — the defect corrected on 2026-09-03.
```

### 3. Superlatives may exist in exactly one place

⚠️ **A throw only protects figures that go through the component.** The two superlatives found tonight
were in **hover text and a headline tile**, written by hand. So a static test asserts that the words
`longest`, `shortest`, `highest`, `lowest`, `most` and `fewest` **appear nowhere in the statistics
module except inside `wait-superlative.tsx`** — and that file derives its wording from
`WAIT_QUANTITIES`.

**A page-wide superlative therefore cannot be written by hand without failing a test that names it.**

---

## Task 1: Remove the root surface fill and check the two places grey shows

**Files:** Modify `…/statistics/statistics-screen.module.css`, `…/transport/transport-screen.module.css`
· Test: `tests/ward-screen-ground.dom.test.tsx`

- [ ] **Step 1: Write the failing test** — assert neither screen root sets a background, and that the
      figure strip and the footnote block each declare their own surface.
- [ ] **Step 2: Run to verify it fails** — `npx vitest run tests/ward-screen-ground.dom.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Remove `background: var(--surface)` from both roots; give the strip and footnote `--ward-canvas`.**
- [ ] **Step 4: Run to verify it passes.** Expected: PASS, 3 tests.
- [ ] **Step 5: Mutation** — restore the root fill. Expected: **"the screen root does not paint over the shell's ground"** reddens by name. Restore.
- [ ] **Step 6: Commit.**

---

## Task 2: The wait vocabulary and the throwing comparison

**Files:** Create `…/statistics/wait-quantity.ts`, `…/statistics/wait-superlative.tsx`
· Test: `tests/ward-wait-quantity.dom.test.tsx`

**Interfaces:** Produces `WAIT_QUANTITIES`, `WaitQuantity`, `WaitSuperlative({ figures })`, `WaitMedian({ figures })`.

- [ ] **Step 1: Write the failing test** — a single-quantity set renders; **a mixed set throws**; the
      rendered wording is the `WAIT_QUANTITIES` sentence, **compared against the constant, not retyped**.
- [ ] **Step 2: Run to verify it fails.** Expected: FAIL — module not found.
- [ ] **Step 3: Write the vocabulary and both components.**
- [ ] **Step 4: Run to verify it passes.** Expected: PASS, 5 tests.
- [ ] **Step 5: Mutation — change `distinct.size > 1` to `> 99`.** Expected: **"refuses a comparison spanning two quantities"** reddens by name, and **"allows a comparison within one quantity" stays green.** ⚠️ Both halves — a mutation that reddens everything proves nothing about which rule fired. Restore.
- [ ] **Step 6: Commit.**

---

## Task 3: 🔴 Superlatives exist in exactly one file

**Files:** Create `tests/ward-wait-superlative-containment.test.ts` (**`.ts` — a static source scan, not a DOM test**)

- [ ] **Step 1: Write the failing test** — read every `.tsx`/`.ts` under `…/statistics/`, and assert
      none contains a superlative word **except `wait-superlative.tsx`**. ⚠️ **Scan the rendered strings
      and the `title` attributes, not only visible JSX** — hover text is where two of them were hiding.
- [ ] **Step 2: Run to verify it fails** — the screen currently writes superlatives by hand. Expected: FAIL, naming the files.
- [ ] **Step 3: Route every superlative through `WaitSuperlative`.**
- [ ] **Step 4: Run to verify it passes.** Expected: PASS.
- [ ] **Step 5: Mutation — put the word "longest" in a `title` attribute on a chart bar.** Expected:
      **"no superlative is written outside wait-superlative.tsx"** reddens **and names the file and the attribute**. ⚠️ **A failure message that does not name where it found the word is unusable on a 600-line screen.** Restore.
- [ ] **Step 6: Anti-vacuity** — confirm the scan reads `title` attributes by asserting it finds a
      deliberately planted one, then removing it. **A scan that only reads JSX text passes this whole task while missing the exact case it exists for.**
- [ ] **Step 7: Commit.**

---

## Task 4: 🔴 Transport — "rebooked" and "did not proceed" are different words

**Files:** Create `…/transport/transport-outcome.ts` · Test: `tests/ward-transport-outcome.dom.test.tsx`

- [ ] **Step 1: Write the failing test** — a movement with an `unwinds` entry of kind
      `transport_cancelled` renders **"rebooked"**; a job with `cancelledAt` renders **"did not proceed"**;
      **neither renders the bare word "cancelled"**, and the two are never summed into one count.
- [ ] **Step 2: Run to verify it fails.** Expected: FAIL — module not found.
- [ ] **Step 3: Write the outcome mapping.**
- [ ] **Step 4: Run to verify it passes.** Expected: PASS, 4 tests.
- [ ] **Step 5: Mutation — map both to "cancelled".** Expected: **"a rebooked job and a patient who did not proceed are worded differently"** reddens by name. Restore.
- [ ] **Step 6: Commit.**

---

## Task 5: 🔴 Transport — the legs nobody has booked

**Files:** Create `…/transport/unbooked-legs.tsx` · Test: `tests/ward-transport-unbooked.dom.test.tsx`

- [ ] **Step 1: Write the failing test** — a movement awaiting transfer with no `TransportJob` appears
      in this panel and reads **"No transport recorded"**. ⚠️ **Assert the panel does NOT contain "not
      needed", "none required" or "no transport needed"** — the model cannot support those.
- [ ] **Step 2: Run to verify it fails.** Expected: FAIL — module not found.
- [ ] **Step 3: Write the panel.**
- [ ] **Step 4: Run to verify it passes.** Expected: PASS, 3 tests.
- [ ] **Step 5: Anti-vacuity** — ⚠️ **the "does not say not-needed" assertion passes trivially on an
      empty panel.** So assert in the same test that the panel **does** list the movement by name. **An
      absence assertion over an empty render is not evidence.**
- [ ] **Step 6: Mutation — word it "No transport needed".** Expected: **"says what is recorded, never that transport was not needed"** reddens by name. Restore.
- [ ] **Step 7: Commit.**

---

## Task 6: Transport figure strip and provider names

**Files:** Create `…/transport/transport-figures.tsx` · Test: `tests/ward-transport-figures.dom.test.tsx`

⚠️ **The prototype invents four provider names — "Metro Patient Transport", "Regional Ambulance",
"Community Transport Service", "Secure Transfer Service". The model holds THREE: `"Ambulance service"`,
`"Patient transport service"`, `"Ward escort"`.** **Use the model's three.** The prototype's are
invented and the model's own comment calls its three _"obviously generic placeholders, and the owner's
to replace"_.

- [ ] **Step 1: Write the failing test** — five tiles, **exactly two flagged**; provider names
      **imported from `TRANSPORT_PROVIDERS` and compared**, never retyped.
- [ ] **Step 2: Run to verify it fails.** Expected: FAIL — module not found.
- [ ] **Step 3: Write the component.**
- [ ] **Step 4: Run to verify it passes.** Expected: PASS, 3 tests.
- [ ] **Step 5: Mutation — flag a third tile.** Expected: the render throws with `WardFigureStrip`'s own message, and **the test asserting two flagged reddens by name.** Restore.
- [ ] **Step 6: Commit.**

---

## Task 7: Every chart states its unit and its population

**Files:** Modify the three chart panels · Test: `tests/ward-statistics-chart-units.dom.test.tsx`

- [ ] **Step 1: Write the failing test** — every chart panel carries a unit line; **the wait chart
      carries one PER GROUP**, naming the quantity from `WAIT_QUANTITIES` rather than saying "hours".
- [ ] **Step 2: Run to verify it fails** — chart 1 has no unit caption today. Expected: FAIL naming it.
- [ ] **Step 3: Add the unit lines, deriving the wait chart's from the vocabulary.**
- [ ] **Step 4: Run to verify it passes.** Expected: PASS, 4 tests.
- [ ] **Step 5: Mutation — replace a per-group unit with the bare word "hours".** Expected: **"each wait group names the quantity it measures, not just its unit"** reddens by name. Restore.
- [ ] **Step 6: Commit.**

---

## Left open

1. 🔴 **The model cannot distinguish "transport not needed" from "not booked yet"** for any movement
   without a referral link — which is most of them. **For the owner.** The shape of a fix is the
   three-state one already used for medical clearance.
2. ⚠️ **`TransportJob.formRequired` is a bare string**, and the model's own comment says it should draw
   from `SELECTABLE_LEGAL_FORMS` but does not, because that file is pinned by the Mental Health Act
   figure guard. **Not this plan's to change** — but a transport screen displaying a form code is
   displaying an unvalidated string, and should not imply it was checked.
3. **Provider names are placeholders the owner is to replace.** The screen must not present them as
   organisations that exist.
4. ⚠️ **Every figure on both screens is invented** and must come from state. The prototypes' numbers
   appear here only as fixture values.
5. **Whether "All units" should remain the wait chart's default.** It is the cross-quantity view; it is
   safe under the guard, but it is also the view that invites the comparison the guard forbids. **A
   design call, named not resolved.**
