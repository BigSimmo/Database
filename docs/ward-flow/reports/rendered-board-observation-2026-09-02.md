# THE RENDERED BOARD — first observation by anyone

**Assigned by Ward Lead. Measured at `e8ad10290` (my branch, master merged in, 0 behind).**
**Route `/mockups/ward-flow/board/rph-adult-secure`, dev server on the port `npm run ensure` printed —
not assumed.** **Nothing was changed. This is a report of what is there.**

---

## ✅ THE ANSWER: ALL THREE CONTROLS RENDER CORRECTLY, IN BOTH THEMES

**The undeclared-token defect is genuinely gone on screen, not merely absent from a grep.**

| control          | element    | light background   | light border                 | dark background    | dark border        | height |
| ---------------- | ---------- | ------------------ | ---------------------------- | ------------------ | ------------------ | ------ |
| `.leavingSelect` | `<select>` | `rgb(255,255,255)` | `1px solid rgb(211,219,229)` | `rgb(18,22,26)`    | `rgb(71,80,90)`    | 48px   |
| `.leavingButton` | `<button>` | `rgb(29,111,184)`  | `rgb(29,111,184)`            | `rgb(116,189,240)` | `rgb(116,189,240)` | 48px   |
| `.awayButton`    | `<button>` | `rgb(255,255,255)` | `1px solid rgb(211,219,229)` | `rgb(18,22,26)`    | `rgb(71,80,90)`    | 48px   |

**Every value resolves. Nothing computes to `unset` or falls back to nothing.** All three are 48px tall —
**the production tap-target minimum, not the 44px that generic checklists ask for.**

**Text contrast, computed:**

- **Neutral controls: 15.45:1 in light, 16.78:1 in dark.** Far above any threshold.
- **Accent button: 5.23:1 in light, 6.82:1 in dark.** Above the 4.5:1 required for body text.

**Do they read as controls? Yes.** Each has a filled background distinct from the page, a visible
boundary, a 48px target and readable text. **The "Away" control is deliberately quieter than the
"Record that they have left" control — which is the documented intent, since a discharge frees a bed
and an ED trip changes no figure on that ward.**

---

## ⚠️ ONE THING I FOUND THAT NOBODY ASKED ABOUT — the boundary is faint

**Border against its own background:**

- **Light: 1.40:1.**
- **Dark: 2.22:1.**

**WCAG 1.4.11 asks 3:1 for the visual boundary of a user-interface component. Both are below it.**

⚠️ **This is NOT the original defect returning.** The original defect was that the border did not
exist at all. **These controls are identifiable by their fill and their text regardless of the
boundary, so the control is not lost** — but a reader relying on the outline alone, on a poor
monitor or in bright ward lighting, has less edge than the guideline intends.

**Reported, not fixed. It is a design-token decision — `--border` is the shared token, so changing it
reaches far beyond this board — and I was told to change nothing.**

---

## ⚠️ HOW I ESTABLISHED THIS, AND WHAT I DID NOT DO

**Honest framing matters here, because the whole point of the assignment was that three static
readings had already been mistaken for an observation.**

- ✅ **What I did:** loaded the real page in a real browser, selected a bed, and read the **computed**
  styles from the live DOM in both themes — not the stylesheet, not the JSX.
- ✅ **I confirmed nothing hides the controls:** `document.elementFromPoint` at the button's centre
  returns **the button itself**, no ancestor has `display:none`, `visibility:hidden` or `opacity:0`,
  and the element occupies a 1291×48 box inside the viewport.
- ⚠️ **What I could NOT do: photograph them.** The browser pane returned a blank frame for every
  screenshot of the scrolled region, while screenshots at the top of the page rendered perfectly.
  **I treated that as a capture artifact rather than a rendering fault ONLY because the obstruction
  check above says the button is painted, unobstructed and in the viewport.** **So this is a
  measurement of the live rendered page, not a picture of it. That distinction is real and I am not
  going to blur it after today.**
- **Dark mode needed a reload.** Switching the colour scheme without reloading left the page fully
  light while `matchMedia('(prefers-color-scheme: dark)')` already reported dark. ⚠️ **Had I measured
  at that moment I would have reported "dark mode does not apply" — a true reading of a stale state.**

---

## ✅ A FINDING I NEARLY FILED AND CHECKED FIRST

**The accessibility tree showed twenty bed-tile buttons with no label — `button [ref_93] type="button"`
and so on.** **On a clinical board that would be a real defect.**

**It is not true.** Queried directly: **30 buttons, 0 without an accessible name.** The tree rendering
simply did not surface their text.

⚠️ **The tool's output was accurate and my reading of it was not — the same shape as counting nine
mentions of a branch name and reporting a test as red.** **A view of a thing is not the thing.**

---

## WHAT REMAINS UNOBSERVED

- **Forced-colors mode.** ⚠️ I raised it as a residual, withdrew it when Ward Builder Three showed the
  block sets `--border: ButtonBorder`, and **still nobody has rendered the board in that mode.** The
  reasoning that it is correct is sound and remains reasoning.
- **Any viewport but 1440×900**, and any route but this one ward's board.
- **Whether a coordinator can read the board in real ward lighting** — outside anything I can measure.
