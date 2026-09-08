# Rebuilding a Ward Flow page in the third edition

This is the brief a builder follows to lift an existing Ward Flow mockup onto the third edition:
the Command screen's identity, material, type, shell (bar and rail) and rules. One builder, one
page, one file. Read it in full before touching anything.

## What you are making

One self-contained HTML file at `docs/ward-flow/mockups/<slug>-third-edition.html` that shows the
same page as the source mockup, saying and doing everything the source says and does, dressed and
built exactly as the Command third edition is. The reader should not be able to tell that the page
and Command were built on different days.

## Inputs, in the order to read them

1. **The standard.** `docs/ward-flow/mockups/WARD-FLOW-DESIGN-SYSTEM.md`, all of it. Sections 1 to
   8 are the rules, tokens, type, material, layout and components (5.6, 6.1 and 6.2 are the bar,
   the drawers and the rail). Section 9 is behaviour, 12 the definition of done, 14 the screens
   index. Where this brief and the standard disagree, the standard wins.
2. **The template.** `docs/ward-flow/mockups/command-third-edition.html`. This is the canonical
   built page: the head (title, two preconnect links, one font link), the whole stylesheet
   including the shell block (look for the comment saying the block is the kit's shell.css,
   appended), the brand stripe, the `header.hdr1` bar, the `nav#rail` that the shell script
   renders, the `data-rail` attribute set on the root before first paint, the engine facade on
   `window.WardFlow`, and the shell script inlined after the engine. Copy from here, not from the
   kit's pre-graft fragments.
3. **The shell notes.** `docs/ward-flow/mockups/third-edition-kit/shell/SHELL-NOTES.md` explains
   how the shell is wired, and `shell/preview-stub.js` is the smallest facade the shell script
   accepts on a page that is not Command. Use it as the model for your page's facade.
4. **The source page.** The path is given in your task. It is the single source of truth for
   content and behaviour. Read every line, including its foot notes, its disclosure and its
   scripts.

## Rules that are not negotiable

- **Keep everything.** Every panel, list, control, state, example, disclosure, foot note and
  behaviour in the source survives. Example switches (such as a "stuck" and a "moving well"
  example, or a coordinator and a ward view) stay and still work. If two source pages are being
  merged, the merged page carries both in full and says where each came from in its foot.
- **One day, one network.** The page shows the same day as Command: Saturday 15 August, 10:42,
  day shift, handover at 14:00. The same eight emergency departments, the same units, the same
  health services and the same figures the rail shows on Command (Command 14 open, 1 breached,
  1 due soon; Capacity 21 free of 249; Referrals 5, oldest 2h 42m; Handover in 3h 18m). Where
  the source used different figures, names or a different day, reconcile them to Command's and
  say so in the foot. Where the source has figures Command does not, keep them.
- **The shell is the shell.** The bar, the drawers, the Service selector, the search, the rail
  and its closed strip are copied from Command and not redrawn. The rail marks this page as
  current. The bar's page title is this page's name. Search results and the Service selector
  work against your facade's data. The rail's open and closed state, the `[` key and the
  localStorage key `ward-flow-rail` behave exactly as on Command.
- **Type and tokens.** Source Serif 4 for the names of things, Source Sans 3 for everything read,
  JetBrains Mono for every figure, identifier, time and code. The seven step scale from 10.5px,
  nothing under it, in HTML or in SVG. Only the loaded weights. No new colours: every colour is a
  token from the template. Brass is a bar, never a fill.
- **Words before colour.** Every state carries a word. Arrows become words ("to", "from",
  "then"). No emoji, no arrows, no symbols that a clinical record cannot hold. Australian
  spelling.
- **Honesty at the foot.** The page ends with the same foot as Command: "Every figure here is
  invented" and "What is real", listing what is invented and what is real about this page.
- **Both themes, all widths.** Light and dark through the same three-state token pattern as the
  template. No horizontal page scroll at 1920, 1440, 1280, 1200 or 390. Wide things scroll inside
  their own container.
- **Accessibility carried over.** Skip link, live region, focus rings, Escape order, tap targets of
  3rem at a coarse pointer, reduced motion, forced colours and print, as the template does them.
- **Self-contained.** One file. Fonts through the one Google Fonts link with real fallbacks. No
  other external resource. Under 400 KB.

## Improvements you are expected to make

You are not only restyling. Apply the standard's rules to the source as a reviewer would and fix
what the source got wrong: labels under the floor, colour carrying meaning alone, fills where a
bar should be, a missing legend, a missing reconciliation line, controls with no keyboard path,
a state with no word, a panel that overflows, a figure that is not tabular. List every
improvement in your report so the owner can see what changed beyond the dressing.

## Checks: the core set only

Run the kit harness once, from the repository root:

```
node docs/ward-flow/mockups/third-edition-kit/check.mjs docs/ward-flow/mockups/<slug>-third-edition.html platinum
```

Fix every real FAIL and run it again until the only lines are PASS. The harness's reconcile
and diagram checks apply to Command pages only and are skipped by the title, which is expected.
Do not run the screenshot script, do not run a second reviewer, do not write new checks.

Then format the file:

```
npx prettier --write docs/ward-flow/mockups/<slug>-third-edition.html
```

## What you must not do

- Do not run any git command. The owner commits.
- Do not publish, read or touch any artifact.
- Do not edit `command-third-edition.html`, `design-system-third-edition.html`,
  `WARD-FLOW-DESIGN-SYSTEM.md`, `check.mjs` or anything in the kit.
- Do not invent a notice, an alert or a figure the source or Command does not have.
- Do not stop early. If the harness cannot be made green, say exactly which line and why.

## Your report, as the final message

Ten to twenty lines, plain English:

1. The file path and its size.
2. The harness result: the count of PASS lines and any FAIL that remains, quoted.
3. What was kept from the source, in one line.
4. What was merged or reconciled, and what figures changed to match Command.
5. Every improvement made beyond the dressing.
6. Any decision the owner should make, with your recommendation.
