# Care Plan — accessibility and responsive acceptance

What was checked, how, at what size, in what mode — and, just as importantly, what was
**not** checked and therefore remains an open acceptance gap.

All browser evidence in this document is **Chromium**, driven by Playwright through
`npm run test:e2e:care-plan-mockup` against a production build of this branch. It is not
acceptance on physical iPhone Safari, on an installed PWA, on a screen reader, or with a
switch device or magnifier. Those remain untested.

Exact commands, counts and result lines are in `verification-report.md`.

---

## Why this document only exists now

Tasks 1–10 verified this route family entirely with Vitest under `css: false` in jsdom,
plus static parsing of `care-plan.module.css` as text. That combination can see structure
— roles, names, document order, attribute values — and can see nothing else. It cannot see
a viewport, a computed colour, a focus ring, a page break, or whether an element is
painted at all.

Every claim below is therefore new evidence, and where a claim could only be made
structurally it says so.

## Viewports

| Width  | Height | What it stands for                          |
| ------ | ------ | ------------------------------------------- |
| 320 px | 844    | The narrowest supported phone               |
| 390 px | 844    | The common phone                            |
| 768 px | 1000   | The rail/dock boundary                      |
| 1024px | 1000   | Small desktop and landscape tablet          |
| 1440px | 1000   | Desktop                                     |
| 640 px | 512    | 1280×1024 at 200% zoom — the WCAG 1.4.10 measurement |

At every width the assertion is the same and is measured, not declared:
`max(documentElement.scrollWidth, body.scrollWidth) - innerWidth <= 2`. Two pixels of
tolerance covers sub-pixel rounding and nothing else.

Below 768 px the phone dock is visible, the desktop rail is hidden, and every dock
destination is measured at or above the 48 px tap convention. At and above 768 px the
inverse. **`min-h-12` / `var(--spacing-tap)` is 48 px and is the production convention
here; it must not be "corrected" down to 44 px** to satisfy generic WCAG 2.5.5 guidance —
that reintroduces a known `ui-smoke` sub-pixel flake, and 48 exceeds both the AA minimum
(24 px, 2.5.8) and the AAA enhanced criterion (44 px, 2.5.5) anyway.

## The pinned safety boundary

The specification requires that `What would make this presentation different` is visible
above all plan content at 320 px, 390 px, desktop, dark mode, forced colours, and in
print, and is never collapsed, truncated, or clipped.

Structural proof already existed for document order. What the browser adds:

- **Geometry, not order.** The boundary's painted box is measured and asserted to end at
  or above the top of the first-minute sections. A `grid-row` or `order` rule could
  reverse the visual order with every jsdom assertion still green; this catches it.
- **Not collapsed.** The painted height is asserted to be greater than zero.
- **Not clipped.** `scrollHeight - clientHeight <= 1` — the box that paints it is at least
  as tall as the text inside it — plus explicit checks that `display` is not `none`,
  `visibility` is not `hidden`, and `-webkit-line-clamp` is unset.
- **Forced colours.** The tinted background is flattened by the platform, so the border is
  what still carries the box. Its computed width and its resolved ink are both asserted,
  because a border painted in transparent ink is not a border.
- **Print.** Asserted inside the printed subtree, above the plan, on the same terms.

The full fifth section is asserted to be present and visible alongside the pinned line:
the pinned form links to the full section and never replaces it, and there is no
disclosure element anywhere on the plan.

## Links that look like links

Ruling 57 froze the static link-affordance guard as a tripwire after it was beaten four
times across five rounds by nine different spellings of "paints nothing", and named Task
11 as the owner of the replacement.

The replacement is `expectLooksLikeALink` in `tests/ui-care-plan-mockup.spec.ts`. It
reads **computed style in a real browser**, which is the value the pixel is painted from:
`transparent`, `rgb(0 0 0 / 0.0%)`, a `var()` fallback, a colour behind one level of
indirection, `all: unset`, `:is(.x)` and every other spelling have already collapsed into
one resolved answer by the time it reads them. A tenth spelling cannot beat it, because it
never reads a spelling.

For each named affordance it asserts:

1. The text colour is painted at all — alpha ≥ 0.5 — and is not the same colour as the
   effective background behind it.
2. The colour differs from the prose it sits in. The reference is not a hard-coded token
   but a throwaway span inserted at the control's own position in the tree, so it measures
   the colour this text would have had as ordinary body copy.
3. The affordance the class is contracted to carry is actually drawn: a real underline
   with opaque decoration ink and non-zero thickness, or a border with non-zero width and
   opaque ink, or both.

| Class                 | Route            | Contracted affordance  |
| --------------------- | ---------------- | ---------------------- |
| `pinnedBoundaryLink`  | Patient overview | underline              |
| `patientNavSecondary` | Patient overview | border (a pill control) |
| `inlineLink`          | History          | underline              |
| `timelineLink`        | ED Presentations | underline              |
| `queueAction`         | Reviews          | underline **and** border |
| `specimenLink`        | System states    | underline              |

The class is resolved to the exact token the build emitted, matched on `_`/`-`
boundaries, so `queueActions` (a wrapper) can never answer for `queueAction` (a control) —
and both the dev and production CSS-module naming shapes are handled, because this suite
runs against the production build where the shape differs.

## Keyboard

- Tab order is walked on the patient overview and every control that takes focus is
  checked for a visible ring: a non-zero outline width with a non-`none` style and opaque
  ink, or a non-`none` box shadow. A ring that resolves to nothing is invisible to a
  keyboard reader and to `css: false` alike.
- The plan's own jump link is activated by keyboard and asserted to move the reader to the
  full fifth section.
- **Sheet.** The phone `More` sheet is opened, Tab is pressed twelve times and focus is
  asserted to remain inside the dialog on every press, `Escape` closes it, and focus
  returns to the trigger.
- **ConfirmDialog.** The formal-review confirmation is opened, `Escape` closes it, and
  focus returns to the trigger.
- **The in-tree amendment sheet.** Task 7 deferred `portal={false}` to Task 11 because it
  changes where focus containment lives and no `css: false` test can see its overlay. It
  is now asserted to render inside the Care Plan subtree — which is why it exists, so its
  multi-line fields keep the prototype stylesheet rather than collapsing to the shared
  one-line field height — with that height measured, and `Escape`/focus restoration
  asserted.

Route changes move focus to the new page heading. That is the **only** route
announcement: a hand-rolled `aria-live` region repeating the heading would make every
navigation announce twice.

## Media preferences

| Preference       | What is asserted                                                                                      |
| ---------------- | ----------------------------------------------------------------------------------------------------- |
| `prefers-color-scheme: dark` | `.dark` is applied, the pinned boundary still sits above the plan, and heading text differs in luminance from the page behind it by more than 60 — a half-themed page fails |
| `forced-colors: active`      | The pinned boundary keeps a painted outline; Current and Awaiting Approval remain distinguishable by a word rather than a tint; the withdrawal line still renders |
| `prefers-reduced-motion: reduce` | The sheet's computed animation duration is ≤ 50 ms. The state change itself still happens — reduced motion removes decoration, never a state change |
| `prefers-reduced-motion: no-preference` | The same journey is exercised again, so a reduced-motion fallback cannot be the only path that works |
| `print`          | See below                                                                                             |

## Print

Three print surfaces, none of which had ever been printed before this task.

- **The synthetic-prototype marker reaches the paper.** Asserted inside the printed
  subtree on all three, because the shared rule hides everything outside
  `[data-print-output]` and the shell's own marker therefore does not travel. This exact
  line has been removed by accident twice on this project.
- **Monochrome is resolved, not declared.** Up to forty elements inside the paper are
  sampled and their computed `color` asserted to be pure black and their computed
  `background-color`, where painted, asserted to be pure white. That is the test of
  whether the monochrome rule actually wins the cascade against every Tailwind utility and
  CSS-module rule in the subtree.
- **Page-break control is asked for per block.** Every `PrintSection` in the paper is
  asserted to compute `break-inside: avoid`, so half of somebody's reasons for living do
  not land on the previous sheet, and a crisis number is never separated from the sentence
  saying it is not an emergency service.
- **Screen chrome does not print.** The rail, the phone dock and the print button itself
  are asserted hidden under print emulation.
- **The person's own document is complete.** Every one of the seven Personal Safety Plan
  headings is asserted present on the paper, and the paper is asserted **not** to contain
  `Not recorded`. A printed sheet handed to a patient reading `My reasons for living — Not
  recorded` is the worst defect this project has produced, and it broke no rule and failed
  no gate at the time.
- **The patient copy carries nothing clinical.** The printed Patient Plan is asserted not
  to contain internal record vocabulary.

## Degraded states

All eleven named specimens are opened at 390 px. Each is asserted to render its stated
reason — a substantive amount of text, never a blank screen — with the synthetic boundary
intact and no sideways scrolling. `identity-uncertain` is additionally asserted to
withhold plan content outright and send the reader back to search.

## Open acceptance gaps

These are **not** covered by anything in this repository and must not be described as
passing:

1. **Physical iPhone Safari**, including safe-area behaviour on a device with a home
   indicator.
2. **The installed PWA** in standalone display mode.
3. **Screen readers** — VoiceOver, NVDA, JAWS. Roles and accessible names are asserted;
   how any of it is announced in practice is not.
4. **Real printers.** Print-media emulation is Chromium's model of a page. Actual
   pagination on A4, on a specific driver, at a specific scale, has not been observed. The
   number of sheets each document takes is unknown.
5. **Colour contrast ratios.** Distinctness from surrounding text and from the background
   is asserted; no WCAG contrast ratio is computed anywhere.
6. **Zoom above 200%**, and browser text-size-only zoom.
7. **Firefox and WebKit.** The prototype runs in the advisory `chromium-mockups` project
   only, deliberately, so a red prototype cannot block a production release.
8. **Voice control, switch access, and magnifier use.**
