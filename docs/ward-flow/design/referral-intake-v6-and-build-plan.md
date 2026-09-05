# Referral intake — v6 design pass, then the build

**Ordered by the owner, 2026-09-05.** Two things in one instruction: finish the design, then build it.

---

## Part 1 — What the owner asked for, and what each thing means

| Asked                           | What it means in the file                                                                 |
| ------------------------------- | ----------------------------------------------------------------------------------------- |
| Remove the header warning       | The amber `.notice` slab above the fold goes. Its substance relocates — it is not dropped |
| The top strip is disliked       | The app bar is rebuilt: thinner, quieter, one row, no loud pill                           |
| The patient box                 | The anchor is rebuilt on an aligned grid instead of a wrapping flex row                   |
| Overall style, polish, maturity | One pass with a single governing idea, below                                              |
| Fix any design issues           | Measured at two widths, not eyeballed                                                     |
| Build it                        | Part 3                                                                                    |

### The safety consequence of removing the banner, handled rather than argued

That banner is the only place the screen says **"not a medical device"**, and — since v5 — the only
place above the history that says free text is sent verbatim. **Deleting it silently would remove a
clinical statement to make a page prettier**, which is not a trade this project makes.

**So it moves rather than goes:**

- **"Synthetic prototype"** becomes a small, permanent tag in the top strip. Always visible, never a slab.
- **The free-text warning stays exactly where it bites** — on the history step, where v5 already put it,
  immediately above the boxes it describes.
- **"Not a medical device", and what sending does** move into the right-hand panel, which is the
  screen's existing home for consequences, plus one quiet line in the page footer.

**Nothing that was asserted is now unasserted.** That is the test this change had to pass.

---

## Part 2 — The single idea behind the maturity pass

**v5 says everything with a device.** Chips, badges, pills, uppercase micro-labels, dashed borders,
coloured washes, left-edge accent bars, shadows, progress bars, boxed figures — and most of them
appear within one screen of each other. Each was defensible on its own. Together they read as a
dashboard demo rather than as a clinical form.

**Maturity here is subtraction, not addition.** The pass has four rules:

1. **Uppercase is for data labels only.** v5 shouted in small caps from chips, field states, eyebrows,
   stat keys and every `dt`. It now survives only on the `dt` labels in the patient box and the rail,
   where it genuinely helps a value be scanned. Everything else is sentence case.
2. **Space before borders.** A box inside a box inside a card is how v5 separated things. Related
   things are grouped by proximity first; a border only where two things would otherwise touch.
3. **One elevation.** Cards sit on the ground at one height. v5 had three shadow tokens doing
   overlapping jobs.
4. **Colour is rarer, so it is louder when used.** Unchanged in meaning — green in catchment, amber
   outstanding or leaving the screen, red refused — but the neutral state now carries no colour at all.

⚠️ **Nothing in this pass may change a claim.** Every sentence, state and rule from v5 survives. This
is presentation only, and the appendix is the check: if a state stops being drawable, the pass went
too far.

---

## Part 3 — The build, in order, each with its catcher

Each step names **the thing that goes red** if it is done wrong. A step without one is not ready.

**B1 · The intake gets its own stylesheet.** `intake/intake.module.css`. `referrals.module.css` is
shared with two frozen screens and editing one of its rules restyles a screen nobody opened.
⚠️ `tests/ward-referrals-print.test.ts` reads stylesheet _text_ and never renders — repoint it in the
same commit or it keeps certifying print rules for a file the screen no longer uses.
_Catcher:_ a guard that `referral-intake.tsx` imports no stylesheet but its own, plus the existing
referral suite green. Break it by pointing one class back at the shared module.

**B2 · The history reaches the model.** Three fields on `Referral` and on `RECEIVE_REFERRAL`:
`whyNow`, `background`, `riskAndSafety`. Their doc comments must say the thing no other field on this
event needs to say: **this is unvalidated text supplied by a person; nothing parses it and nothing may
ever be derived from it** — not urgency, not risk, not a destination.
_Catcher:_ a reducer test that the stored string equals the submitted string byte for byte, including
newlines and trailing space. Mutate with a `.trim()` and watch it go red.

**B3 · The two no-free-text guards become boundary guards.**
`tests/ward-referral-screens.dom.test.tsx:453` and `tests/ward-referral-destinations.dom.test.tsx:513`
both assert zero free-text controls. They are correct today and will be wrong the moment B2 ships.
⛔ **Neither is deleted.** Both are rewritten to assert free text appears in **exactly the three named
fields and nowhere else**, floored on the fields walked so that _deleting_ the history goes red too.
⚠️ **Same commit as B2.** A commit that turns a safety test green on its own is indistinguishable, a
year later, from somebody removing an obstacle.

**B4 · The screen.** The v6 chrome, the anchor, the history step, the destination cards that ask their
own question, the rail. `referral-intake.tsx` keeps every export.
_Catcher:_ the existing suite green, plus the progress count, the outstanding sentence and the rail all
derived from `REQUIRED_FIELDS` — mutate one to disagree and exactly one assertion should catch it.

**B5 · Layout, measured not eyeballed.** At 1440 and at 375: no horizontal overflow, the destination
list wider than zero, every tap target at 48px.
⚠️ **jsdom performs no layout**, so no unit test can see any of this. The live screen has already
shipped once with the destination list at exactly zero width and its cards 93px off the right edge.

---

## Part 4 — What is deliberately not in this

- The reducer's placement, eligibility and matching behaviour. Presentation change over working logic.
- `referral-board.tsx` and `referral-match.tsx` — frozen, and the reason B1 exists.
- Any new field on `Patient`.
- The two sensitive identity fields, until the Aboriginal health review reports.
- The five open questions in the v5 appendix — recorded there, not promised on screen.
