# Ward Flow design system, third edition

Frozen 8 September 2026, version 3.0. The one standard every Ward Flow mockup is built to: the rules,
the tokens for both themes, the type, the material, the components with their class names and
states, the behaviours, the wording, the accessibility floor, the definition of done, the recipe for a
new mockup, and the plan for the eighteen mockups. This document stands alone. The page version of it,
`design-system-third-edition.html`, renders every component from the reference build's stylesheet and
recomputes every contrast figure from its live tokens on each load.

Every figure and every name in the examples is invented. The hospital sites, health services and ward
names are real WA names from the repository's own tables.

## 1. Purpose, scope and precedence

This is the third edition. The first edition was Platinum Raised Cool, and the second was the Live
edition standard. This edition takes the second's content, behaviour and rigour, and the first's
identity and material. Everything a coordinator reads or does comes from the second edition, and
everything the eye sees as colour, type, light and surface comes from the first. Where the two
disagreed on a rule, the stricter rule won and is written down here. Section 12 lists what moved from
each earlier edition.

It replaces the visual layer of the Board language (Archivo, JetBrains Mono, the mid blue) and keeps
the Board language's five rules and every rule it made about real data and honesty, restated in
section 8.

The Command third edition is the reference build. Every component in section 6 of the page version is
rendered from the same stylesheet Command uses, so a component there looks the way it looks here.

Precedence, highest first:

1. The owner's words in the chat. A ruling made in conversation outranks this document until the
   document is updated to carry it.
2. This standard.
3. The Board language's clinical and data rules. They are carried here in full, so a conflict between
   the two is a defect in this document, to be fixed here.
4. The artifact host's own rules. Fragment HTML, a title tag first, Google Fonts by link only, three
   theme states, no host ground showing through.
5. Generic defaults. Never a reason to depart from any of the above.

A mockup that needs a value the standard does not have reports the gap. It does not invent a hex, a
font size or a spacing step. The gap is closed here first and the mockup is re-cut afterwards.

The mockups are design intent, not app colour. The application resolves colour by role through its own
token layer, so a hex from this document must never be pasted into app code.

What premium means here: restraint. One serif, used only on the names of things. One accent and one
brass, each with a job it never shares. One shadow, and one fall of light. Alpha hairlines. Figures
that line up. Words before colours. Nothing decorative that is not also information, and nothing that
would look out of place printed on a handover sheet.

## 2. The ten rules

Everything else in this document is a consequence of one of these. A page that breaks one is not done,
whatever it looks like.

1. **State is a word first, and a colour second.** A colour, a bar or a tint only ever repeats a word
   already on the screen, so a reader with no colour perception loses nothing, and neither does a
   greyscale printout. Status colours are reserved and solid: red, amber and green mean breach, look
   here and clear, they are never used for anything else, and the brand slate and the brass never
   carry a status.
2. **Figures are JetBrains Mono and tabular.** Every identifier, wait, count, time and code is set in
   the mono face with tabular numerals, so anything a reader compares down a column lines up. Zero
   reads "none": a nought is a measurement and "none" is a state.
3. **Absence is stated, never blank.** "Not tracked here" and "No destination yet" are the models. An
   empty panel says why it is empty and what the emptiness means. A count of zero is shown in italic
   without a pill rather than hidden.
4. **Nothing is set below 10.5px, and the scale has seven steps.** Uppercase labels carry 0.08 to
   0.12em of tracking, headings a touch of negative tracking, and every size is one of the seven t
   steps. Only loaded weights are asked for, and there are no small capitals. The wordmark is the one
   value outside the scale.
5. **One elevation step, and only one.** Light falls from the top. The ground is a shade lighter at
   the top of the window than at the bottom, a panel is lifted off it by a hairline that is heavier
   along its bottom edge, one low shadow tinted with the brand, and a one pixel highlight along its
   top edge, and its header and foot strips sit a tone cooler than its body, so a panel reads as a
   made object with a top and a bottom. Nothing inside a panel is lifted again. Radii step inward:
   10px panels, 9px strips inside them, 6px controls, a pill for chips. Hairlines carry alpha, are
   solid, and are never dashed. A region that overflows sideways shows a soft shade at its edge and a
   sentence, never a frame. A list that continues past its window fades into that edge, and the fade
   is measured on every render, scroll and resize, never declared. A legend is a disclosure, open
   where the diagram has room to spare and closed where it does not, and the reader's own choice wins
   from then on.
6. **Colour has four jobs and they never share a hue.** The accent, deep slate, means brand and
   interactive. Gilt is brass and means you are here, and brass is a bar and never a fill: beside the
   active nav item, under the live tab, beside the selected row, on the current stage, and the two
   letters beside the wordmark, and nothing else, which is why the prototype chip in the masthead is
   neutral and why the brass wash is never painted behind text. Green, amber and red mean status
   only. The four health services have hues of their own. On a map only an eligible or a recorded
   ward carries a fill, and every other verdict is an outline and a word.
7. **Every text pairing is measured, in both themes, at a floor of 4.5:1.** The figures in section 3
   were printed by the script that derived them, not typed, and the page recomputes them from its own
   tokens on every load. A pair that falls short is printed, marked and reported, never hidden.
8. **Both themes are tokens only.** The bare root is the complete light palette. The dark palette is
   redefined under the machine's preference, guarded so an explicit light choice beats a dark machine,
   and again under the page's own control so it wins the other way. For print every token takes its
   light value, on all three roots. Never a colour whose only definition sits inside one of those
   blocks, never a hex in a component, and never pure black or pure white as a colour.
9. **Every figure is invented and the page says so twice.** Once in the masthead and once in the rail
   foot, beside the reconciliation line the page derives on every load. Every count on the rail and in
   the masthead is derived from the data on the page, never typed.
10. **Optical, not arithmetic.** A tracked uppercase label that ends a line carries its own trailing
    tracking as a negative margin, so it sits flush with whatever is under it. An inner corner is one
    pixel tighter than the panel it sits in. Every control draws rest, hover, pressed and focus, a
    disabled control says why and does not light on hover, and nothing brightens on hover. Selection
    never hides status: a pressed pressure card or a showing candidate keeps its status bar and gains
    the slate ring on the other three sides. Every change of subject is spoken to a screen reader as a
    sentence. The appearance choice is remembered for this browser only.

## 3. Colour

### 3.1 The four jobs

| Job                   | Tokens                                                                    | Used for                                                                                                                                                                                                                                                                                                                        | Never for                                                                                                                                        |
| --------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Brand and interactive | `--accent --accent-ink --accent-soft --on-accent --stripe --hl-on-accent` | The primary control, links, the focus ring, done steps, the ring of a selected row or card, the pressed appearance button, panel titles and the brand name as text, the 3px stripe along the top of the window                                                                                                                  | Status of any kind. A hover, which is always the sunk well                                                                                       |
| You are here          | `--gilt --gilt-soft`                                                      | Brass, as a bar and never a fill: beside the active rail link, under the live tab, beside the selected queue row, on the current stage of the stepper, beside the coordinator's own register rows, and the two letters beside the wordmark                                                                                      | Anything else. Not a heading, a number, an ornament or a chip, and never a wash behind text. The prototype chip is neutral for this reason       |
| Status                | `--good --warn --danger`, their soft fills, `--danger-ink`                | Always solid for a bar, a mark, a word or a swatch. Green is clear, eligible, accepted, available, reconciled. Amber is look here: at risk, declined, overridden, held. Red is a breach, a failed gate, a refused action, a blocked bed, a tier 1 mark. The soft fill sits only behind a row whose whole meaning is that status | Direction, emphasis, a brand mark, a title, a border, a tab or a button that is not itself a status action. Red on anything that is not a breach |
| Service               | `--svc-east --svc-north --svc-south --svc-wachs`                          | Slate for East Metro, plum for North Metro, teal for South Metro, rust for WACHS. The name of a service beside a ward, the outline of a node, a legend swatch                                                                                                                                                                   | Fills, backgrounds, status or anything a reader would take for a verdict                                                                         |

### 3.2 The identity and the light model

The identity is cool platinum with a faint blue cast, a deep slate brand and a brass secondary. The
material is Raised: one lifted panel under a fall of light. The two are separate, and this document
freezes both.

The ground is a gradient, not a flat colour, because a flat canvas is what makes white panels look like
boxes cut out of paper. A fall of light from ground-hi at the top through ground at 55 percent to
ground-2 at the bottom gives the page a top and a bottom, and a panel lifted from it reads as an object
standing on a surface. The gradient is fixed to the window. The hl token is a one pixel highlight along
a panel's top edge, drawn as an inset shadow: light catching the top of the panel, which is what makes
the lift read as a lift rather than a border. The edge-shade token is the soft inset shade at the edge
a region continues past. The two hairlines carry alpha so one value is the right darkness over a white
row, a toned strip and a sunk well alike.

### 3.3 The tokens, light theme, on the bare root

```css
:root {
  color-scheme: light;

  --ground-hi: #ecf0f4;
  --ground: #e6eaef;
  --ground-2: #e1e6ec;
  --surface: #fdfdfe;
  --surface-2: #f4f7fa;
  --sunk: #eef2f6;

  --ink: #161a20;
  --ink-soft: #414953;
  --muted: #5f6873;

  --line: rgba(22, 30, 40, 0.11);
  --line-strong: rgba(22, 30, 40, 0.26);

  --accent: #2f4c66;
  --accent-ink: #27405a;
  --accent-soft: #dfe7f0;
  --on-accent: #ffffff;
  --stripe: #2f4c66;

  --gilt: #7d612a;
  --gilt-soft: #f1ebdf;

  --good: #227550;
  --good-soft: #e2f0e8;
  --warn: #886211;
  --warn-soft: #f6eeda;
  --danger: #b03b2e;
  --danger-soft: #f8e6e2;
  --danger-ink: #973121;

  --svc-east: #2f4c66;
  --svc-north: #6f5f9e;
  --svc-south: #3f7a80;
  --svc-wachs: #8c5a3c;

  --ward: var(--svc-east);
  --ward-soft: var(--accent-soft);
  --ed: var(--danger);
  --comm: var(--svc-south);
  --coord: var(--svc-north);

  --lift: 0 1px 1px rgba(30, 48, 66, 0.05), 0 14px 30px -22px rgba(30, 48, 66, 0.45);
  --hl: rgba(255, 255, 255, 0.9);
  --hl-on-accent: rgba(255, 255, 255, 0.14);
  --edge-shade: rgba(30, 48, 66, 0.16);

  --r1: 10px;
  --r1i: 9px;
  --r2: 6px;
  --gap: 14px;

  --t-0: 10.5px;
  --t-1: 11.5px;
  --t-2: 12.5px;
  --t-3: 13.5px;
  --t-4: 16px;
  --t-5: 20px;
  --t-6: 26px;

  --display: "Source Serif 4", Georgia, "Times New Roman", serif;
  --body: "Source Sans 3", "Segoe UI", system-ui, sans-serif;
  --mono: "JetBrains Mono", ui-monospace, Consolas, monospace;
}
```

### 3.4 The tokens, dark theme

Redefined twice on purpose: once under `@media (prefers-color-scheme: dark)` as
`:root:not([data-theme="light"])`, and once as `:root[data-theme="dark"]`, with the same block under
each. Never a colour whose only definition sits inside one of these blocks.

```css
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    color-scheme: dark;
    --ground-hi: #14181d;
    --ground: #0f1216;
    --ground-2: #0c0f12;
    --surface: #171b21;
    --surface-2: #1b2026;
    --sunk: #13171c;
    --ink: #e8ecf1;
    --ink-soft: #b2bac5;
    --muted: #8a929d;
    --line: rgba(255, 255, 255, 0.09);
    --line-strong: rgba(255, 255, 255, 0.21);
    --accent: #a7bcd2;
    --accent-ink: #bfd0e2;
    --accent-soft: #1f2a36;
    --on-accent: #0f1216;
    --stripe: #3a5a78;
    --gilt: #d3b77e;
    --gilt-soft: #2a251b;
    --good: #6fd39b;
    --good-soft: #15291f;
    --warn: #e3bc5e;
    --warn-soft: #2b2415;
    --danger: #ff8b76;
    --danger-soft: #33201b;
    --danger-ink: #ffa08e;
    --svc-east: #a7bcd2;
    --svc-north: #b1a2d6;
    --svc-south: #7fb2b8;
    --svc-wachs: #d89a78;
    --lift: 0 1px 1px rgba(0, 0, 0, 0.4), 0 16px 34px -22px rgba(0, 0, 0, 0.95);
    --hl: rgba(255, 255, 255, 0.06);
    --hl-on-accent: rgba(255, 255, 255, 0.28);
    --edge-shade: rgba(0, 0, 0, 0.55);
  }
}
:root[data-theme="dark"] {
  /* the same block again */
}
```

For print, every token takes its light value on all three roots, the ground and every surface become
white, the shadow, the highlight and the stripe go, and the four status colours print exact.

### 3.5 Non-colour tokens

| Token              | Value          | Job                                                                                                                                                      |
| ------------------ | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--lift`           | above          | The one shadow: a 1px contact shadow and a long, low 30px shadow at low alpha, tinted with the brand slate in light and plain black in dark. Panels only |
| `--hl`             | above          | The one pixel highlight along a panel's top edge                                                                                                         |
| `--hl-on-accent`   | above          | The same highlight on the primary control                                                                                                                |
| `--edge-shade`     | above          | The soft inset shade at the edge a region continues past                                                                                                 |
| `--r1 --r1i --r2`  | 10px, 9px, 6px | Panels, strips inside a panel, cards rows and controls. Pills are 999px. A radius never repeats at the depth of its parent                               |
| `--gap`            | 14px           | Between panels and between columns                                                                                                                       |
| `--t-0` to `--t-6` | 10.5 to 26px   | The seven step type scale                                                                                                                                |

### 3.6 Contrast, computed rather than judged

Every pairing of text on a fill that the components use, in both themes. Printed by
`merged/contrast.mjs` from the token values, never computed by hand. The floor is 4.5:1.

69 pairs, every one above the floor in both themes. The lowest light pairing is 4.5:1 and the lowest dark pairing is 4.6:1. The rows marked not used are pairings no page sets today, kept so a page that ever does has the figure, and the pairs a showing, hovered, chosen or blocked candidate reaches are listed because the round one review found three of them below the floor before the tokens were darkened.

| Pair                      |  Light |   Dark | Where it occurs                                                                           |
| ------------------------- | -----: | -----: | ----------------------------------------------------------------------------------------- |
| ink on surface            | 17.2:1 | 14.6:1 | Headings and row titles on a panel                                                        |
| ink on ground             | 14.5:1 | 15.8:1 | Not used: nothing is written on the ground. Kept so a page that ever does has the figure  |
| ink-soft on surface       |  9.0:1 |  8.8:1 | Secondary text on a panel                                                                 |
| ink-soft on ground        |  7.6:1 |  9.6:1 | Not used: kept for the same reason                                                        |
| muted on surface          |  5.6:1 |  5.5:1 | Labels and counts on a panel                                                              |
| muted on ground           |  4.7:1 |  6.0:1 | Not used: the rail and the masthead are surface, so the rail note sits on surface         |
| muted on ground-hi        |  4.9:1 |  5.7:1 | Not used: the lightest band of the ground, at the top of the window                       |
| muted on ground-2         |  4.5:1 |  6.1:1 | Not used: the darkest band of the ground, at the foot of the window                       |
| muted on sunk             |  5.0:1 |  5.7:1 | Labels on a hover row or a gate                                                           |
| muted on surface-2        |  5.3:1 |  5.2:1 | The count in a panel header                                                               |
| muted on accent-soft      |  4.5:1 |  4.6:1 | Meta text on a selected row                                                               |
| accent on surface         |  8.8:1 |  8.9:1 | Link text and the focus ring                                                              |
| accent-ink on surface     | 10.5:1 | 11.0:1 | The brand name in the rail, a link                                                        |
| accent-ink on surface-2   |  9.9:1 | 10.4:1 | A panel title on its header strip                                                         |
| accent-ink on accent-soft |  8.6:1 |  9.2:1 | Text on a selected row or pressed control                                                 |
| on-accent on accent       |  9.0:1 |  9.6:1 | The primary control's label                                                               |
| gilt on surface           |  5.7:1 |  8.9:1 | The letters beside the wordmark, the current stage word                                   |
| gilt on gilt-soft         |  4.9:1 |  7.9:1 | Brass text on its own wash, should a page ever need it                                    |
| gilt on accent-soft       |  4.7:1 |  7.5:1 | The current stage word on a selected panel                                                |
| good on good-soft         |  4.8:1 |  8.4:1 | An accepted destination badge                                                             |
| good on surface           |  5.5:1 |  9.4:1 | An eligible verdict, a pass mark                                                          |
| warn on warn-soft         |  5.2:1 |  8.5:1 | An overridden gate's verdict                                                              |
| warn on surface           |  5.9:1 |  9.6:1 | A declined verdict                                                                        |
| warn on sunk              |  5.3:1 | 10.0:1 | A held bed chip, and the verdict word on a hovered candidate that needs a recorded reason |
| danger on danger-soft     |  5.0:1 |  6.8:1 | A failed gate's verdict                                                                   |
| danger on surface         |  5.9:1 |  7.6:1 | A breach word, a refused row's title                                                      |
| danger-ink on danger-soft |  6.3:1 |  7.8:1 | A tier 1 pill                                                                             |
| svc-east on surface       |  8.8:1 |  8.9:1 | East Metro's name on a candidate                                                          |
| svc-north on surface      |  5.9:1 |  7.4:1 | North Metro's name on a candidate                                                         |
| svc-south on surface      |  6.0:1 |  7.4:1 | South Metro's name on a candidate                                                         |
| svc-wachs on surface      |  5.7:1 |  7.3:1 | WACHS's name on a candidate                                                               |
| svc-east on ground        |  7.4:1 |  9.6:1 | Not used: no service name is set on the ground                                            |
| svc-north on ground       |  5.0:1 |  8.1:1 | Not used: no service name is set on the ground                                            |
| svc-south on ground       |  5.0:1 |  8.0:1 | Not used: no service name is set on the ground                                            |
| svc-wachs on ground       |  4.8:1 |  7.9:1 | Not used: no service name is set on the ground                                            |
| svc-south on surface-2    |  5.7:1 |  7.0:1 | A service name in the legend band, and on a blocked candidate                             |
| svc-north on surface-2    |  5.6:1 |  7.0:1 | A service name in the legend band, and on a blocked candidate                             |
| svc-east on surface-2     |  8.3:1 |  8.4:1 | A service name in the legend band, and on a blocked candidate                             |
| svc-wachs on surface-2    |  5.4:1 |  6.9:1 | A service name in the legend band, and on a blocked candidate                             |
| ink on surface-2          | 16.2:1 | 13.8:1 | A blocked candidate's name, and a title on a header strip                                 |
| ink-soft on surface-2     |  8.5:1 |  8.4:1 | A blocked candidate's bed line                                                            |
| gilt on surface-2         |  5.4:1 |  8.5:1 | Brass text on a strip                                                                     |
| ink on sunk               | 15.5:1 | 15.2:1 | A hovered candidate's name, a gate label                                                  |
| ink-soft on sunk          |  8.1:1 |  9.2:1 | A hovered candidate's bed line, a gate detail                                             |
| accent-ink on sunk        |  9.5:1 | 11.4:1 | A hovered link button, the count on a hovered tab                                         |
| good on sunk              |  5.0:1 |  9.8:1 | A ready bed chip, and the verdict word on a hovered eligible candidate                    |
| danger on sunk            |  5.3:1 |  7.9:1 | A blocked bed chip                                                                        |
| svc-east on sunk          |  8.0:1 |  9.2:1 | East Metro's name on a hovered candidate                                                  |
| svc-north on sunk         |  5.4:1 |  7.7:1 | North Metro's name on a hovered candidate                                                 |
| svc-south on sunk         |  5.4:1 |  7.7:1 | South Metro's name on a hovered candidate                                                 |
| svc-wachs on sunk         |  5.1:1 |  7.6:1 | WACHS's name on a hovered candidate                                                       |
| svc-east on accent-soft   |  7.2:1 |  7.5:1 | East Metro's name on the showing candidate                                                |
| svc-north on accent-soft  |  4.8:1 |  6.2:1 | North Metro's name on the showing candidate                                               |
| svc-south on accent-soft  |  4.9:1 |  6.2:1 | South Metro's name on the showing candidate                                               |
| svc-wachs on accent-soft  |  4.6:1 |  6.1:1 | WACHS's name on the showing candidate                                                     |
| good on accent-soft       |  4.5:1 |  8.0:1 | The verdict word on a showing eligible candidate                                          |
| warn on accent-soft       |  4.8:1 |  8.1:1 | The verdict word on a showing candidate that needs a recorded reason, or has declined     |
| svc-east on good-soft     |  7.6:1 |  7.9:1 | East Metro's name on a chosen candidate                                                   |
| svc-north on good-soft    |  5.1:1 |  6.6:1 | North Metro's name on a chosen candidate                                                  |
| svc-south on good-soft    |  5.2:1 |  6.6:1 | South Metro's name on a chosen candidate                                                  |
| svc-wachs on good-soft    |  4.9:1 |  6.4:1 | WACHS's name on a chosen candidate                                                        |
| warn on good-soft         |  5.1:1 |  8.5:1 | The verdict word on a chosen candidate that needs a recorded reason                       |
| ink-soft on accent-soft   |  7.3:1 |  7.4:1 | A selected row's secondary text                                                           |
| ink on danger-soft        | 14.5:1 | 13.0:1 | The label of a failed gate                                                                |
| ink-soft on danger-soft   |  7.6:1 |  7.9:1 | The detail of a failed gate                                                               |
| ink-soft on warn-soft     |  7.9:1 |  7.9:1 | The detail of an overridden gate                                                          |
| ink on good-soft          | 14.9:1 | 12.9:1 | The label on an accepted badge's ground                                                   |
| ink-soft on good-soft     |  7.8:1 |  7.8:1 | Detail on a chosen candidate                                                              |
| muted on good-soft        |  4.8:1 |  4.9:1 | Meta on a chosen candidate                                                                |

Non-text marks are held to 3:1 against their ground where they carry meaning: status bars, meter
fills, the focus ring and the step marks all use the full strength token. Hairlines are not meaning
and are not held to a ratio.

## 4. Type

### 4.1 The three faces

| Role    | Family                               | Weights loaded     | Fallback                          | Used for                                                                                                                        |
| ------- | ------------------------------------ | ------------------ | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Display | Source Serif 4, optical size 8 to 60 | 600, 700           | Georgia, Times New Roman, serif   | The names of things: the wordmark, the page title, panel titles, site codes and the headings on the diagram. Never running text |
| Body    | Source Sans 3                        | 400, 500, 600, 700 | Segoe UI, system-ui, sans-serif   | Everything read. Headings within a panel body are 600                                                                           |
| Mono    | JetBrains Mono                       | 400, 500, 600      | ui-monospace, Consolas, monospace | Every figure, identifier, time, count and code, always with tabular numerals                                                    |

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  rel="stylesheet"
  href="https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,600;8..60,700&family=Source+Sans+3:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
/>
```

Only weights that are loaded are asked for: serif 600 and 700, sans 400 to 700, mono 400 to 600. A
request for a weight that is not loaded is served as a synthetic bold in some browsers and as the
nearest weight in others, so it is never made. No small capitals: the served fonts carry none, and a
synthesised small capital is a shrunk capital that only reads smaller. Tabular numerals are set once
on the body and on every button, so a proportional figure cannot appear by accident.

### 4.2 The scale

| Step     |   Size | Roles                                                                                                                          |
| -------- | -----: | ------------------------------------------------------------------------------------------------------------------------------ |
| `--t-0`  | 10.5px | Uppercase labels, tags, counts, chips, legend items, tier pills, the eyebrow in the rail. The floor: nothing is set smaller    |
| `--t-1`  | 11.5px | Meta lines, notes, disclaimers, secondary text, verdict detail, table body in dense registers                                  |
| `--t-2`  | 12.5px | Row titles, identifiers, control labels, fact values, table body, the destination badge                                        |
| `--t-3`  | 13.5px | Body text, panel titles in the display serif at 600, rail links, candidate names, department codes. The base size              |
| `--t-4`  |   16px | Section headings in a document like this one. Rare on a screen                                                                 |
| `--t-5`  |   20px | Figures in the masthead in mono at 600, the clock, the shortlist identifier, a rule number                                     |
| `--t-6`  |   26px | The page title in the display serif at 600, and the figure in a band tile                                                      |
| Wordmark |   22px | The one value outside the scale. At 20px it sits under the rail links' optical weight, at 26px it competes with the page title |

### 4.3 Setting rules

- Uppercase only at t-0 and t-1, always tracked: 0.08em for labels beside figures, 0.10em for verdict
  words and the schematic note, 0.12em for eyebrows, legend titles and fact labels. Never title case,
  never synthesised small capitals.
- Trailing tracking is compensated. A tracked label that ends a line or a flex row carries its own
  tracking as a negative right margin, so the label sits flush with what is under it.
- Headings carry negative tracking of 0.01em in Source Sans 3 and 0.012em in Source Serif 4. Figures
  at t-5 and t-6 carry 0.02em negative.
- Italic means absence or quietness: a stated none, an untracked value, a quoted reason. Never
  emphasis.
- Line lengths: prose no wider than 78 characters, notes and scopes no wider than 72, the masthead
  disclaimer no wider than 60.
- A word is never broken. Where a value cannot wrap it is clipped with an ellipsis and the full text
  sits in the element's title.
- Quotes are typographic in prose and straight only in code. Times are 10:42 with AWST beside the
  date. Dates are Sat 15 Aug in a tile and Saturday 15 August 2026 in a label read aloud.

## 5. Material and layout

### 5.1 Ground, surface, well

The ground sits behind everything, as the gradient described in 3.2. Panels are surface, lifted once.
Panel headers, tab strips, the diagram foot and the legend are surface-2, the slightly cooler band a
panel wears at its edges. The well, sunk, is hover, meter tracks, gates, count pills and quiet chips,
and a well is a tone, not a box, so it carries no border. A selected thing is accent-soft and a hovered
thing is sunk, so the two states never look alike. The rail and the header are chrome: surface with a
single hairline where they meet the ground, not panels, and they cast no shadow.

### 5.2 The brand stripe

A fixed 3px stripe in the stripe token along the top edge of the window, above everything, drawn by
`body::before` so no page has to carry it. The single brand mark. Hidden in print, CanvasText under
forced colours. In the dark theme it is a mid slate rather than the accent, so it reads on a dark
ground without glowing.

```css
body {
  background:
    linear-gradient(180deg, var(--ground-hi) 0%, var(--ground) 55%, var(--ground-2) 100%) fixed,
    var(--ground);
  text-rendering: optimizeLegibility;
  font-optical-sizing: auto;
  font-variant-numeric: tabular-nums;
}
body::before {
  content: "";
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: var(--stripe);
  z-index: 20;
  pointer-events: none;
}
```

### 5.3 One elevation step

A panel is a hairline all round, a heavier hairline along its bottom, the lift shadow and a one pixel
highlight along its top edge. That is the only lift on the page. Cards, rows, gates and chips inside a
panel are hairlines and fills only, and nothing inside a panel carries a shadow. Hover lifts nothing:
it changes the fill to the well, or on the map adds a one pixel drop shadow to the node so its fill
keeps saying what it says.

```css
.panel {
  background: var(--surface);
  border: 1px solid var(--line);
  border-bottom-color: var(--line-strong);
  border-radius: var(--r1);
  box-shadow:
    var(--lift),
    inset 0 1px 0 var(--hl);
}
```

### 5.4 Strips and the inner radius

The panel header strip, the diagram foot with its legend, and the tab bar sit on surface-2. A strip
that touches a panel corner takes the inner radius, r1i, on those corners. A header strip is a label,
not a toolbar: the title in the display serif in accent-ink, an optional note, a derived count in mono,
and at most one small disclosure control.

### 5.5 Radii and lines

| Value      | Where                                                                                                                                                                                                  |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 10px       | Panels                                                                                                                                                                                                 |
| 9px        | The inner corners of a panel header, tab strip or foot                                                                                                                                                 |
| 6px        | Cards, rows, gates, controls, code blocks, the destination badge                                                                                                                                       |
| 4px        | The focus ring's corner and the small panel-header control                                                                                                                                             |
| Pill       | Chips, tags, counts, tier pills, peers, bed chips, the appearance control                                                                                                                              |
| Hairline   | 1px, solid, line or line-strong, both with alpha. Never dashed and never dotted. A dashed outline exists only on the map, as the word Declined repeated in a stroke. Never a solid grey used as a line |
| Status bar | 3px along the left of a row or candidate, along the top of a pressure card. 4px for meters and steps. The bar is the only place a card or row carries colour                                           |
| Stripe     | 3px along the top of the window                                                                                                                                                                        |

### 5.6 The shell

A rail of 236px on the left carrying the wordmark, grouped links with eyebrows, and a foot with who is
signed in, the reconciliation line and the invented-figures note. The universal header across the top
in three rows: the title row (title, prototype chip, disclaimer, search, the scope switcher, the one
primary action, who is signed in, More), the statistics strip with its All figures dropdown and the
clock, and the outstanding tasks bar. A scrolling region below with 14px top padding, 24px sides and a
14px gap between panels and between columns. Every scrolling region declares a minimum height of zero
on its grid or flex path, because without it a column grows instead of scrolling.

### 5.7 The widths

| Width                                | Layout                                                                                                                                                                                                  | What gives                                                                  |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 1600px and wider                     | Locked to the viewport. Three columns of 15rem, the remainder, and 25rem, with flush bottoms. Only the scrolling body of a column may give up height                                                    | Nothing. The legend opens by default from 1600 by 960                       |
| 1400 to 1599px                       | The same lock. The outer columns give a rem each so the diagram keeps more                                                                                                                              | The legend closes by default. The masthead disclaimer drops under the title |
| 1400px and wider, 960px tall or less | The laptop rule. The lower register panel shrinks to 11.5rem, strip and card padding tighten, the legend and header padding tighten. Verified at 1440 by 900: the diagram region is at least 260px tall | Registers, the strip and the legend give up height first                    |
| 1001 to 1399px                       | Two columns and a normally scrolling page. The queue stays in view, sticky. The shortlist sits under the diagram in two internal columns                                                                | The lock. The page scrolls                                                  |
| 1000px and narrower                  | One column. The rail becomes a wrapping row under the wordmark, the eyebrows and foot are hidden, the active link carries its brass bar along the bottom                                                | The rail foot, so the appearance follows the machine                        |
| 640px and narrower                   | Tab labels tighten, continuity lines stack, ward fact labels stack over their values, the masthead disclaimer is hidden. The tap floor of 3rem applies                                                  | The second disclaimer                                                       |

### 5.8 Overflow

- The page never scrolls sideways. Wide content scrolls inside its own container.
- The affordance is a soft shade in edge-shade and a sentence. Never a frame, never an arrow.
- Lists fade at the continuing edge, 22px at the top and 26px at the bottom, switched by a
  measurement, so a list that does not scroll shows no fade at all.
- Scrollbars are thin in every scrolling region: a line-strong thumb on a transparent track.

### 5.9 Density and rhythm

| Where                         | Value                                                |
| ----------------------------- | ---------------------------------------------------- |
| Panels and columns            | 14px apart. Working area 14px top, 24px sides        |
| Rail                          | 18px above the wordmark, 14px below, links 2px apart |
| Panel header                  | 11px by 16px                                         |
| Rows                          | 10px by 16px. Register rows 7px apart                |
| Cards                         | 10px by 12px, 9px apart in the pressure strip        |
| Sections inside the shortlist | 12px by 16px. Candidates 8px apart                   |
| Gates                         | 8px by 11px, 4px apart                               |
| Controls                      | 7px by 13px, 6px apart                               |
| Chips                         | 3px by 10px                                          |
| Legend                        | 7px by 12px, groups 16px apart, items 8px apart      |
| Status bars and meters        | 3px bars, 4px meters and steps                       |

## 6. Components

Each entry gives the shape with the class names the stylesheet expects, then the states and rules.
Reuse the class names exactly, so the stylesheet applies unchanged.

### 6.1 Wordmark and rail link

`.brand` with the wordmark in a `b` and the two letters in a `span`. `.railGroup` with a
`.railEyebrow` and `.railLink` buttons or links, each a `.railLabel` holding a 15px stroked
`svg.railGlyph` and the words, and an optional `.tag` count. Rest in ink-soft with a muted glyph.
Hover and pressed on the well. Current (`aria-current="page"`): accent-soft fill, accent-ink text at
600, accent glyph, and the brass bar at the group's left edge. Focus: the accent ring inset. The tag
is a derived count with a title saying what it counts, mono on the well with a hairline ring. The two
letters are the only brass in the rail besides the bar.

### 6.2 Header: title row, statistics strip and the outstanding tasks bar

`header.hdr` holds `.hdrBar` (the `.title` group with the `h1`, the neutral `.chip.mark`, the `.sub`
disclaimer, and `.hdrTools`: the `.search` with its slash hint, the scope `details.menu`, the primary
New referral menu whose summary carries `.primary`, `.who`, and More), then `.stats` (a `dl.statsList`
of `.stat` tiles divided by hairlines, `.statsEnd` with the `.hdrClock` and the All figures
`details.menu.statsMenu` holding a `.statsGrid` of `.statsFacts` and `.dataTable` tables and a
`.statsFoot`), then `.tasks` (a `.tasksLabel` with its derived count, a `.taskList` of `.task` chips
with `data-tone`, and `.tasksEnd`).

Six figures at most in the strip, derived on every render. Red on a breach above zero only. Amber on
at most two. A zero reads none. Tasks are worst first, a chip is a figure in mono and a word with a dot
and a border that repeat the tone, a task with a count of zero is not shown, and when nothing is
outstanding the bar says so in a sentence. Every dropdown is a `details.menu` with a `.menuPanel`,
`.menuList`, `.menuItem`, `.menuHead`, `.menuDiv` and `.menuNote`. One menu open at a time, a click
outside closes it, Escape closes it and returns focus to the summary. The chosen item carries the
brass bar. Search refuses a risk or acuity score, a best match, and closed or arrived movements, and
says so in the filter bar.

### 6.3 Panel, header, note and stated absence

`section.panel` with an aria-label, a `.ph` header holding the heading (display serif, accent-ink),
an optional `.note`, a `.count` pushed right in mono, and where the panel has a disclosure a
`.phBtn[aria-expanded][aria-controls]`. Bodies use `.pb`, and an empty state is a `.none` sentence
that says why it is empty and what the emptiness means. The header is surface-2 with inner corners one
pixel tighter than the panel.

### 6.4 Chips, tags, pills and bed chips

`.chip` for a fact (surface, line-strong ring, pill). `.chip.mark` for the prototype mark, neutral.
`.tag` for a rail count. `.tier[data-t="1|2|3"]` for a tier: mono, 1px ring in currentColor, tier 1
danger-ink on danger-soft, tier 2 warn on warn-soft, tier 3 ward on ward-soft. `.peer` for another
patient on the same ward, on the well with a 6px dot in the peer's tier colour. `.bedChip[data-state]`
with the figure in `b`: the ring and text take the state colour, available good, confirmed accent,
held warn, blocked danger, expected muted. Every chip carries a word.

### 6.5 Tabs with counts

`.tabbar[role=tablist]` of `.tabBtn[role=tab]`, each with `aria-selected`, `aria-controls` and a
roving `tabindex`, and a `.tabNum` count. Rest in muted on surface-2. Hover in ink on surface.
Selected in ink on surface with the brass bar beneath, and the count on accent-soft with a slate ring.
A count at rest is mono on the well with a hairline ring. A zero count reads none in italic with no
ring. Arrow keys move between tabs, Home and End go to the ends. Every tab carries its count, so
nothing hides behind an unopened tab.

### 6.6 Pressure card

`ul.edList` of `li` each holding a `button.edCard[data-p="high|med|low"][aria-pressed]`: `.edCode`
with the site code and the service in an `em`, two `.edStat` lines, an `.edBar` meter with an `i`
fill, and a last line that is `.edBreach` or a quiet stat. Status is a 3px bar along the top, never a
fill: ed for high, warn for medium, line-strong for low. The meter track is the well. A pressed card
keeps its top bar and gains the accent ring on the other three sides over accent-soft. Ordered worst
first. The strip scrolls sideways with the shade and the sentence when it overflows.

### 6.7 Queue row and filter bar

`ul.qList` of `button.qRow[aria-pressed]`: a `.qTop` line with the mono `.qId`, the `.tier`, the
`.qWait` pushed right and, when there is one, a `.qFlag` that takes its own line beneath. Then a
`.qRoute` in words, with `b` for the places and `.how` for the words from and to and the state, and a
`.noneYet` for a missing destination. Then a `.qMeta` line. A `.filterBar` above the list states the
filter and offers Show all as a `.linkBtn`. Rest on surface, hover and pressed on the well, selected
on accent-soft with the brass bar at the left, focus ring inset. Identifiers are WF-0xx on Command,
WF-1xx on Movement, WF-2xx on Capacity, RF-0xx for referrals.

### 6.8 Candidate row and verdict

`ul.candList` of `button.cand[data-av]` with `data-showing` for the one whose checks are open and
`aria-pressed` for the one chosen: a `.candTop` with `.candName` and `.candSvc` in the service hue, a
mono `.candBeds` line, a `.verdict[data-av]` whose `b` is the verdict word and whose `span` is the
reason, an optional `.restrict` line, and optional `.cont` continuity lines (`.contLine` with `.lbl`
and `.val`, `.contPeers` of `.peer`). The left bar repeats the verdict: good for eligible, warn for
declined or overridable, line-strong and faded for no bed or no specialling, never hidden. Showing is
the accent ring on three sides over accent-soft with the bar kept. Chosen is good-soft. A verdict
about a ward is fine. A verdict about a person is never drawn.

### 6.9 Eligibility gates

`ul.gates` of `li.gate[data-pass][data-overridden]`: a `.gMark` holding a stroked tick or cross, the
`.gLabel`, the uppercase `.gVerdict` pushed right, and the `.gDetail` sentence across the full width.
A well row with no border. The fill repeats the verdict: well for pass, danger-soft for fail,
warn-soft for overridden. The detail says whether the check is a fact about the world or a judgement
about the patient, because only the second is overridable, and the split fails closed.

### 6.10 Register rows

`ul.rows` of `li.row[data-tone="danger|warn|coord"]`: a `.rowTop` with the bold title and the mono
`.when` pushed right, a `.rowSub` sentence, an optional italic `.reasonQ` quote, and a `.rowWho` line.
The left bar repeats the title's tone. The coordinator's own records carry the brass bar because they
are the reader's own actions. Every row says who did it, and a refusal by the system says so.

### 6.11 Destination, stepper and facts

`.destBadge[data-k="accepted|referred|suggested|none"]` as one sentence: soft fill with a solid
outline in the same colour, accepted and referred good, suggested accent, none muted on the well.
`.stepper` of five `.step` bars with `data-s` done or now and an aria-label, then a `.stageLine`
naming the stage in words with `b` for the stage and spans for the position and the list of stages.
The current step is brass and the done steps accent, and the stage is named beside the bars so the
bars are never the only carrier. `dl.slFacts` with uppercase labels and plain values, and
`.legalHot` for a legal status that constrains the movement, in danger because it is a breach risk.

### 6.12 Shortlist head and section heading

`.slHead` holding a `.slTop` line with the t-5 mono `.slId` in accent-ink, the `.tier`, and the
`.qWait` pushed right, then the stepper and its stage line. Below it, each `.sec` has a top hairline
and an uppercase `h4.secH` with an optional mono `.count`, then a `.ctlRow`, a `.candList`, a
`.gates` list or notes. The first section under the head has no top hairline. A section heading is a
label with a derived count, never a control.

### 6.13 Controls, including one that says why

`.ctlRow` of `button.ctl`, with `.primary` for the one action the screen is for, `.danger` for a
recorded refusal or decline, and `aria-disabled` with `aria-describedby` rather than the disabled
attribute so the reason stays reachable. Rest: surface with a line-strong border, radius r2. Hover and
pressed: the well with an ink-soft border. Focus: the accent ring, two pixels out. Primary: accent
fill, on-accent text, the one pixel inner highlight in hl-on-accent, accent-ink on hover and press.
Nothing brightens on hover. Danger is the secondary shape with danger text, never a red fill. Disabled:
half opacity, a not-allowed cursor, no change on hover or press, and the reason in the title and in a
line beside it. One primary per panel at most.

### 6.14 Diagram foot, legend and node conventions

A node is a 6px body with a name, the service in its hue, a mono figure and the verdict word. Only an
eligible or a recorded ward carries a fill. Declined is a dashed outline and the word. Not routed is a
plain outline and the word. Hover adds a one pixel drop shadow and changes no colour. Focus is a 2.5px
accent stroke. A literal white in an SVG is never used. `.diagFoot` holds the `.diagScrollNote`
(hidden when the diagram fits) and the `.schematic` note, which stays on the page whether or not the
legend is open. `.legend` continues the same surface-2 band below it as a disclosure, with `.lgGroup`,
`.lgTitle`, `.lgItem` and `i.sw` swatches flowing as one wrapping line.

### 6.15 Table

`.tableWrap` scrolling sideways on its own, holding a `.dataTable`. Numeric cells and their headers
take `.n`, right aligned in mono. A zero is the word none in `.zero`. The totals row is `tr.total`, a
different kind of row with a heavier rule above and the header's band behind it. No zebra striping.
Hover shows the well on body rows only.

### 6.16 Figure band and delta

`dl.band` of `.kpi` tiles, each a label, a t-6 mono figure and an optional `.delta` line. One strip
divided by hairlines. No cards, no coloured caps, no icons. Red on a breach above zero only. Amber on at
most two tiles per screen. A delta is the word up, down or no change with a figure, never an arrow
alone and never a verdict such as better or worse.

### 6.17 Chart

`figure.chart` holding an SVG with `role="img"` and an aria-label that states the numbers, and a
`figcaption` that states them again. Lines and arcs only, on a hairline grid with one axis rule, one
emphasised endpoint and labels in mono muted. No area fills, gradients, pies or three dimensions. At
most three charts on a page.

### 6.18 Disclosure and the ward switcher

`details.reveal` with a `summary` carrying the words and an optional mono `.count`, and a
`.revealBody`. The ward switcher is the same element with a search, groups by health service with a
count each, and one row per ward. Every disclosure is opened before print and closed again after. A
disclosure hides detail, never the answer.

### 6.19 Skip link, live region, reconciliation line and appearance

```html
<a class="skip" href="#qpane-patients">Skip to the priority queue</a>
<p class="srOnly" id="live" aria-live="polite" aria-atomic="true"></p>
<p class="railCheck" id="railCheck" data-ok="true">Figures reconcile: 0 discrepancies</p>
<div class="appearance" id="appearance" role="group" aria-labelledby="apLabel">
  <button type="button" class="apBtn" data-set-theme="light" aria-pressed="false">Light</button>
  <button type="button" class="apBtn" data-set-theme="dark" aria-pressed="false">Dark</button>
  <button type="button" class="apBtn" data-set-theme="auto" aria-pressed="true">Auto</button>
</div>
```

The skip link is the first focusable thing on the page. The live region is one polite, atomic region
before the masthead, and a repeated sentence gets a zero width space so it is read again. The
reconciliation line counts the page's own figures on every load: a green dot and a sentence when they
reconcile, a red dot and a count when they do not. The appearance control has three states, Auto
stamps nothing and follows the machine, and the choice is remembered for this browser only under a key
named for the page.

## 7. Behaviour

### 7.1 States

| State    | Looks like                                                                                                               | Rule                                                                                                      |
| -------- | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| Rest     | Surface, hairline, ink-soft text                                                                                         | Every control draws it explicitly                                                                         |
| Hover    | The well, and an ink-soft border on a control. On the map a one pixel drop shadow                                        | Never recolours a status, never lifts, never brightens, never appears on a disabled control               |
| Pressed  | The same as hover on a control, so a click has a felt end point. The well on a row or card while the pointer is down     | Distinct from selected                                                                                    |
| Focus    | A 2px accent outline, 2px out on controls and 2px in on rows, tabs, cards and lists. A 2.5px accent stroke on a map node | Only on focus-visible. Every focusable thing has a scroll margin of 12px                                  |
| Selected | Accent-soft fill, accent-ink text, and the brass bar on rows and tabs, or the accent ring on cards                       | Selection never hides status: a card keeps its bar and gains the ring on the other three sides. Announced |
| Chosen   | Good-soft fill on the candidate that is now the destination                                                              | Distinct from showing, which is the slate ring. The status bar survives both                              |
| Disabled | Half opacity, not-allowed cursor, no shadow, nothing changes on hover or press                                           | aria-disabled, so it stays focusable and the reason stays reachable                                       |

### 7.2 Measured affordances

List fades are set from scrollHeight, clientHeight and scrollTop on every render, scroll and resize.
Sideways overflow is set from scrollWidth against clientWidth, and the shade and the sentence appear
together and disappear together. The legend's default comes from one media query stated once in the
script, min-width 1600 and min-height 960, and once the reader has toggled it their choice holds for
the session. Counts in the rail, the masthead, the tab strip and every panel header are derived from
the data, and the reconciliation line compares them.

### 7.3 Keyboard

Tab reaches the skip link first, then the rail, then the masthead, then each panel in reading order.
In a tab list the arrow keys move between tabs with a roving tabindex. Enter and Space activate rows,
cards and map nodes, which are buttons. Escape clears the innermost thing first: a ward selection, then
a queue selection, then a filter, each announced. A scrolling region is itself focusable.

### 7.4 Announcements

Every change of subject is one sentence to the live region: a row selected, a filter applied or
cleared, a ward chosen on the map, the legend opened or closed, the appearance changed. Never a
fragment and never a colour name.

### 7.5 Appearance, the two themes, motion, print, forced colours

- Appearance has three states, remembered under a key named for the page and forgotten when Auto is
  chosen. The first click from a dark machine switches the page.
- Light and dark are both complete palettes, and dark is designed, not inverted: the well is darker
  than the panel, the highlight is faint, the shadow is black and heavier, the hairlines are white at
  low alpha, and the stripe is a mid slate.
- Motion is a 120ms transition on colour, background, border and the chevron's turn, and nothing
  else. Reduced motion removes every transition and animation.
- Print is a record: the rail, the stripe, controls and link buttons go, every scrolling region opens
  out, every tab pane and disclosure opens, panels lose their shadow, highlight and radius, every
  token takes its light value, and status colours print exact.
- Forced colours keep every boundary as a CanvasText border on Canvas, and every meter, swatch, peer
  dot, step and the stripe become CanvasText.

## 8. Wording and honesty about data

- State is a word first. Direction is a word: from and to, up and down. Never an arrow. A delta carries
  a word and a figure, never a verdict such as better or worse.
- Red means a breach and nothing else. Amber means look here and appears on at most two tiles per
  screen. Green means clear, eligible, accepted or reconciled. A quiet thing carries no colour.
- Absence is stated, never blank. "Not tracked here", "No destination yet", "No deadline recorded",
  "No phone number is held" are the models. Zero reads none, in italic, in the body face.
- Every figure is invented and the page says so twice, in the masthead disclaimer and in the rail foot.
  Every count is derived from the page's own data on every load, and the page says whether its figures
  reconcile.
- Hospital sites, health services and community team names are real WA names from the repository's
  own tables. Their phone numbers, addresses and contact details are never invented. Never invent a
  record number, a UMRN, a person's name that could be mistaken for real, a phone number or an address.
  Do not invent a ward or a hospital.
- There are eight emergency departments, and Joondalup Health Campus and Peel Health Campus have no
  inpatient ward in the data. There are twenty-three wards across seventeen sites. A page reads the
  collection and never carries a hard-coded nine.
- No verdict about a person is ever drawn. A referral's written history is never given a green state.
  Search refuses a risk or acuity score, a best match, and closed or arrived movements, and says so as
  a sentence. A judgement about the patient is overridable by a named coordinator with a recorded
  reason. A fact about the world is not.
- Sentence case everywhere. Australian spelling. Plain clinical language. A control says what will
  happen. An error says what went wrong and what to do. No semicolons, no dashes as punctuation, no
  arrows, no symbols a digital record would not carry.
- The masthead disclaimer is fixed: "Every ward state, movement, referral and figure on this screen is
  invented. Not a medical device and not clinical decision support." The map's caveat is fixed:
  "Schematic, not geographic".

## 9. Accessibility floor

- Text contrast 4.5:1 for every pairing in both themes, computed per pair and printed, never eyeballed.
  Meaningful non-text marks at 3:1.
- No colour is the only carrier of any state. Every state has a word on the screen.
- Every interactive thing is a button or a link with an accessible name. Icons are aria-hidden with
  their word beside them.
- Tab lists use tablist, tab and tabpanel roles, aria-selected, aria-controls and a roving tabindex.
  Toggles use aria-pressed. Disclosures use aria-expanded and aria-controls. Groups are labelled with
  aria-labelledby.
- Focus is visible on every control, inset inside scrolling regions, and every focusable thing has a
  scroll margin.
- A skip link is the first focusable element, and one polite live region receives every change of
  subject as a sentence.
- A disabled control says why, in its title and in a described-by line, and remains focusable.
- Every chart has role img, an aria-label stating the numbers and a written caption stating them again.
- Tap targets are 3rem where the pointer is coarse or the width is a phone's. Never reduced to 44px.
- Nothing below 10.5px. The page holds at 200 percent zoom and never scrolls sideways.
- Reduced motion removes all transitions. Forced colours keep every boundary. Print opens everything.
- Both themes read as well as each other, and every token is defined on the bare root before any theme
  block redefines it.

## 10. Definition of done

A mockup is done when every line below is true and has been looked at, once, in a real browser in
both themes. The proof is the look, the page's own checks and the harness output, not a claim.

- The stylesheet of the reference build is copied verbatim. Screen-specific rules sit below it under a
  comment naming the screen. No raw hex below the block.
- The three fonts load by link with real fallbacks, only loaded weights are asked for, and the display
  serif appears only on the names of things.
- Every size is one of the seven steps, or the wordmark's 22px. Nothing below 10.5px.
- Every colour has one of the four jobs, brass is a bar and never a fill and marks only where the
  reader is, red appears only on a breach, and at most two tiles are flagged amber.
- Every state has a word, every absence is stated, every zero reads none, every direction is a word.
- The header carries the fixed disclaimer, the statistics strip and the outstanding tasks bar, the
  rail foot carries the invented-figures note and the reconciliation line, and every count is derived.
- Every contrast pair the page uses appears in the table in section 3, or has been computed and added
  there first.
- The shell is the rail, the header, and the panels, at the widths in section 5, and the page never
  scrolls sideways.
- Lists fade and strips shade by measurement. Every legend is a disclosure with the stated default.
- Every control draws rest, hover, pressed and focus. Every disabled control says why. Selection never
  hides status. Nothing brightens on hover.
- Every change of subject is announced. Escape clears the innermost thing. The skip link is first. Tab
  lists take arrow keys.
- The appearance control has three states and is remembered under a key named for the page.
- Tables use the table contract, bands use the band contract, charts number at most three.
- Identifiers use the page's namespace. No phone number, address, record number or real-seeming name
  is invented. No verdict about a person.
- The harness has been run and its output pasted into the report. `merged/check.mjs` proves in one
  run, in both themes: the three fonts load, no weight is asked for that is not loaded, the console is
  clean, the page's own reconcile check is empty, no sideways overflow at 1920, 1440, 1280, 1200 and
  390 wide, nothing below 10.5px in HTML or SVG, every visible text element reaches 4.5:1 against the
  fill it sits on (3:1 for large text), the diagram region is at least 260px tall at 1440 by 900, the
  appearance control's first click from a dark machine switches the page to light, and the third Tab
  stop shows a focus ring.
- A claim without its output is not a pass.
- A copy of the page is committed to the repository's mockup folder, formatted, and the artifact is
  republished at its existing URL with a version label.

## 11. Applying it to a new mockup

1. **The head.** Copy the head of the Command third edition: the title tag first, the two preconnect
   links and the one font link in section 4.1, and nothing else.
2. **The tokens.** Copy the three roots in sections 3.3 and 3.4 verbatim, with the print rule. Do not
   add a token, and do not give a colour its only definition inside a theme block.
3. **The stylesheet.** Copy the whole stylesheet from the reference build, unchanged, and below it add
   only the rules the screen needs, under a comment naming the screen. A rule the stylesheet lacks is
   added to the stylesheet here first, token only, and every carrier is re-cut. A copy is never
   hand-patched.
4. **The theme script.** Copy the appearance script below, replace the page name in the storage key,
   and place it after the markup. Then the measurement helpers the page uses: announcements, list
   fades, the strip's sideways affordance, the legend default, Escape and disclosures for print.
5. **The page skeleton.** A skip link, the rail with the wordmark and grouped links and its foot, the
   universal header with the fixed disclaimer, the statistics strip and the outstanding tasks bar, one
   polite live region, and a scrolling region of panels. Mark the current rail link with aria-current.
   Every region is a panel with a header strip, and its body is a list of rows, a strip of cards, a
   diagram with a foot and a legend, tabs, or sections with headings.
6. **Map data to primitives.** A thing with a status gets a card or a row with a bar. A thing with a
   count gets a pill. A category gets a tier pill. A sequence gets the stepper with its stage
   sentence. A label and value pair gets the facts list. An action gets a control, one primary per
   panel at most. Before adding a colour, name its meaning in one word. If the word is not breach,
   look here, clear, a health service, the brand or you are here, the colour is wrong.
7. **State absences and derive counts.** Every empty list gets a sentence that says why. Every zero
   reads none. Every count is derived from the page's data, and the reconciliation line compares them.
8. **Write the copy as a coordinator reads it.** Plain sentences, the site code first, the figure in
   mono, the words from and to, the rules in section 8.
9. **Prove it.** Run the harness in both themes, paste its output, then work through section 10 line
   by line.

```js
(function () {
  var root = document.documentElement;
  var group = document.getElementById("appearance");
  var KEY = "ward-flow-<page>-appearance";
  function remember(v) {
    try {
      if (v === "auto") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, v);
    } catch (e) {}
  }
  function restore() {
    try {
      var v = localStorage.getItem(KEY);
      if (v === "light" || v === "dark") root.setAttribute("data-theme", v);
    } catch (e) {}
  }
  function reflect() {
    var cur = root.getAttribute("data-theme") || "auto";
    var btns = group.querySelectorAll("[data-set-theme]");
    for (var i = 0; i < btns.length; i++) {
      btns[i].setAttribute("aria-pressed", btns[i].getAttribute("data-set-theme") === cur ? "true" : "false");
    }
  }
  group.addEventListener("click", function (e) {
    var b = e.target.closest ? e.target.closest("[data-set-theme]") : null;
    if (!b) return;
    var v = b.getAttribute("data-set-theme");
    if (v === "auto") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", v);
    remember(v);
    reflect();
  });
  restore();
  reflect();
})();
```

Never:

- A second shadow inside a panel. A shadow on a button, a chip, a card or a row.
- A brass fill. A status colour on a title, a border, a tab or a button that is not itself a status
  action.
- A hex value in a component. A new grey. A solid grey used as a line.
- Small capitals. A weight that is not loaded. A size that is not on the scale.
- A panel without a header strip. A header strip with controls in it beyond one small disclosure.
- A layout that hides a count behind an unopened tab.
- A fixed second navigation bar. One rail, one header, one stripe.
- A selected state that covers a status bar. A hover that brightens.
- An arrow, a dash as punctuation, a symbol a digital record would not carry.
- A verdict about a person. An invented phone number, address, record number or real-seeming name.

Decide with one question. Does this element tell a coordinator something they would otherwise have
to work out? If yes, it earns its place and takes the primitive that already exists for that kind of
fact. If no, it comes off the page.

## 12. Departures

### 12.1 From the Board language

| Board language                               | This standard                                                             | Why                                                                                                                                                   |
| -------------------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Archivo for everything structural            | Source Sans 3 for everything read, Source Serif 4 for the names of things | Source Sans 3 holds its shape at the 10.5px floor. A serif on the names of things, and never in running text, names the page without decorating it    |
| JetBrains Mono for figures                   | JetBrains Mono, kept                                                      | The second edition moved to Plex Mono to share a family with its text face. The third returns to JetBrains Mono, whose figures stay open at the floor |
| Inter on the fourth-edition statistics pages | Source Sans 3                                                             | One text face across the project                                                                                                                      |
| Accent mid blue                              | Deep slate, 8.8:1 on surface                                              | Deep enough to carry text as well as fills, institutional rather than a link colour, and it belongs to the cool platinum neutrals around it           |
| Active state marked with the accent          | Brass for you are here, as a bar and never a fill, accent for interactive | Selected and interactive never share a hue                                                                                                            |
| Arrows in the path column                    | The words from and to                                                     | A word survives a screen reader, a printout and a copy into a note                                                                                    |
| Amber on a flagged totals tile               | Amber for look here, at most two tiles, red only on a breach above zero   | The Board's limit of two is kept. Red is reserved so it can only ever mean one thing                                                                  |
| Flat panels with borders, one radius         | One elevation step under a fall of light, radii stepping inward           | A single lift separates panels from the ground. Everything inside stays flat                                                                          |
| Tap target token 3rem                        | 3rem at coarse pointers and phone widths, stated in the stylesheet        | Kept, and made explicit so nobody lowers it to 44px                                                                                                   |
| Design language block copied by edition      | One block, copied verbatim                                                | Two editions drifted apart within days. One block, one source, every carrier re-cut from it                                                           |

Kept without change: tokens only and no raw hex below the block, state worded as well as coloured,
contrast computed at 4.5:1, figures tabular and mono, absence stated, zero reads none, the invented and
real foot, real WA names allowed and contact details never invented, eight departments and twenty-three
wards read from the collection, no zebra, the wrapper scrolls, the totals row is a different kind of
row, charts captioned and at most three, disclosures open in print, the ward switcher's shape, and the
three-state theme pattern.

### 12.2 From the first and second editions

| Edition | Before                                                                                        | This edition                                                           | Why                                                                                                                                                                           |
| ------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| First   | Labels down to 8px                                                                            | The 10.5px floor and the seven step scale                              | An 8px label fails the accessibility floor. Every size is one of seven steps, so nothing drifts below it                                                                      |
| First   | A seven label stepper                                                                         | One bar of steps with a stage sentence                                 | Seven labels forced 8px type and broke words. One bar and a sentence say the stage in words                                                                                   |
| First   | A pink fill on every ward that needs a reason                                                 | Only an eligible or a recorded ward carries a fill                     | A map covered in fills reads as a map covered in alarms. A fill means a place the movement can go or has gone                                                                 |
| First   | A plain light and dark toggle                                                                 | Light, Dark and Auto, remembered for this browser                      | A toggle cannot say follow the machine. Three states can                                                                                                                      |
| First   | The copper token                                                                              | The gilt token, and the colour is called brass                         | The second edition's stylesheet and scripts read gilt, and a rename would touch every carrier for no gain                                                                     |
| First   | No figures in the masthead                                                                    | A statistics strip counted from the data on every load                 | The state of the network is the first thing a coordinator wants, and a derived figure can be reconciled                                                                       |
| First   | No route words on a queue row                                                                 | Where the person is and where they are pointed, with from and to       | A row that names origin and destination is readable without the shortlist open                                                                                                |
| Second  | Newsreader, IBM Plex Sans and IBM Plex Mono                                                   | Source Serif 4, Source Sans 3 and JetBrains Mono                       | The first edition's pairing is the identity. Source Sans 3 holds at the floor and JetBrains Mono keeps its figures open                                                       |
| Second  | Prussian blue accent                                                                          | Deep slate, 8.8:1 on surface                                           | Slate carries text and fills as well as the blue did and belongs to the cool platinum neutrals                                                                                |
| Second  | A near white ground                                                                           | The platinum gradient with a fall of light                             | A near white ground under white panels gave faint separation and no tonal structure                                                                                           |
| Second  | Solid grey hairlines                                                                          | Alpha hairlines                                                        | One alpha value is right over every fill, where a solid grey is right on one and wrong on the others                                                                          |
| Second  | Flat white panels                                                                             | One lifted panel with an inset highlight and a heavier bottom hairline | The single step is kept, and the highlight and the heavier bottom line make it read as a lift                                                                                 |
| Second  | Gilt fills behind text                                                                        | Gilt bars, and an outline plus text in gilt where a fill was used      | Brass is a bar and never a fill. A wash of brass reads as a highlight and competes with the status washes                                                                     |
| Second  | Header strips on the surface                                                                  | Surface-2 strips with an inner radius                                  | A strip a tone cooler than the body gives a panel a top and a bottom                                                                                                          |
| Second  | Panel radius 10px                                                                             | 10px, kept, with 9px inside                                            | The first edition's 9 and 8 were a shade tighter. The second edition's stylesheet is built on 10                                                                              |
| Second  | Gap 14px                                                                                      | 14px, kept                                                             | The second edition's layout is the layout kept, so its gap is kept with it                                                                                                    |
| Second  | WACHS in a rust mixed for the Prussian blue palette, and in the first edition the brand slate | WACHS given rust, re-mixed for the platinum neutrals                   | The first edition gave WACHS the slate East Metro already owns. The second edition's rust is kept in kind and re-mixed for the cool neutrals, so the four services stay apart |

## 13. Adoption plan for the mockups

Eighteen mockups exist in six visual languages today. The plan moves them onto this standard in five
waves, grouped by the shell they share. Every page keeps its URL and is republished in place with a
version label, and a copy of each is committed to the repository's mockup folder.

| Page                       | Wave | Artifact | Language today                                                                        | What it needs                                                                                                                                                                                                                                                          |
| -------------------------- | ---- | -------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Command                    | 0    | 60c8bd59 | The second edition's live build                                                       | The reference build. Re-cut with the third edition's identity and material on the second edition's engine. Nothing in its content, data or behaviour changes. Supersedes the three earlier Command artifacts, including the first edition's Platinum Raised Cool build |
| Movements                  | 1    | eeb90f22 | Teal family: Schibsted Grotesk, Source Sans 3, JetBrains Mono, accent #0e7c86         | Rebuild on the Command shell. Queue rows and candidate rows from section 6. Identifiers WF-1xx. Every arrow becomes a word                                                                                                                                             |
| Capacity                   | 1    | bcaf3c68 | Teal family                                                                           | Same rebuild. Bed chips carry the four bed states. On the map only an eligible or a recorded ward carries a fill. Identifiers WF-2xx. The legend becomes a disclosure                                                                                                  |
| Delays                     | 1    | 24f6ef55 | Teal family                                                                           | Same rebuild. Delay figures move into a band. Every delta carries a word. Red only where a deadline has passed. Owner to confirm this is the working Delays                                                                                                            |
| Ward                       | 2    | 1927f79b | Board second edition: Archivo, JetBrains Mono, accent #1d6fb8                         | Fonts and tokens swap by role. The totals strip becomes the band with its limit of two flagged tiles. Rows lose their arrows                                                                                                                                           |
| Ward board                 | 2    | 1edc9909 | Board second edition                                                                  | As above. Bed states use the bed chip contract. The ward switcher stays a details and summary. No zebra striping                                                                                                                                                       |
| Patient search             | 2    | 651148e2 | Board second edition                                                                  | As above. The refusals stay as refused-action rows. Results are queue rows                                                                                                                                                                                             |
| Community index            | 2    | b7bd9b0b | Board second edition                                                                  | As above. Team names and suburb counts are the real data and are said to be. Contact details never invented                                                                                                                                                            |
| Statistics, main           | 3    | b0fa8f7f | Board second edition                                                                  | Tables move to the table contract. At most three charts, lines and arcs only, each with a label and a caption                                                                                                                                                          |
| Statistics, ward           | 3    | 21855e1e | Board second edition                                                                  | As for the main statistics page                                                                                                                                                                                                                                        |
| Statistics, ED             | 3    | e5167731 | Board second edition                                                                  | As for the main statistics page. The eight departments are listed, Joondalup and Peel included                                                                                                                                                                         |
| Statistics, community team | 3    | 3eb6e55b | Board second edition                                                                  | As for the main statistics page                                                                                                                                                                                                                                        |
| ED waits                   | 3    | f23843f8 | Statistics fourth edition: Inter, accent #1d6fb8, lines and arcs, disclosures, a band | Swap fonts and tokens and keep its chart discipline, its disclosures and its band                                                                                                                                                                                      |
| Emergency department       | 4    | bf480324 | App ckb-v2 tokens inlined, Archivo                                                    | Rebuild on the shell with the pressure cards. The department list is the real eight                                                                                                                                                                                    |
| Search hub                 | 4    | 499827aa | App ckb-v2 tokens inlined, Archivo                                                    | Rebuild. The app's one-composer rule still governs where a search box may sit. The same refusals as Patient search                                                                                                                                                     |
| Patient record             | 4    | b4a939ea | App ckb-v2 tokens inlined, Archivo, vertical tab rail                                 | Rebuild. The vertical tab rail becomes a rail group with the brass mark. No verdict about a person                                                                                                                                                                     |
| Community team             | 4    | b1eadb0f | PsychSift resolved values, Archivo, no data-theme block                               | Rebuild. The missing data-theme block is the first fix. Real team names, everything else invented and declared                                                                                                                                                         |
| New referral               | 4    | ee958fc4 | Its own tokens, Archivo, accent #1a6ab5, locked design v6                             | Visual migration only, once the owner unlocks it. Flow, field order and wording stay locked. Identifiers RF-0xx. A disabled submit says why                                                                                                                            |

How each page is moved: read the page as it is and list what it says that this standard does not, and
keep those. Copy the tokens and the stylesheet from the reference build, remove the page's own tokens
and fonts, and rebuild the shell. Rebuild each region from the components in section 6, and where a
page has a component this standard lacks, build it once in the standard and re-cut. Apply sections 7,
8 and 9. Run the harness in both themes. Republish at the same URL with a label, commit the copy, and
work through section 10 line by line.

## 14. Decisions for the owner

The merge decisions the owner may reverse, and the decisions carried over from the second edition.

- **Identity from the first edition.** The cool platinum neutrals, the deep slate brand, the brass
  secondary, the three faces and the fall of light come from Platinum Raised Cool. Reverse this and the
  second edition's Prussian blue, near white ground and Newsreader pairing return.
- **Behaviour from the second edition.** The masthead figures, route words, the one bar stepper, the
  diagram fill rule, the legend disclosure, the three state appearance control, the 10.5px floor, the
  contrast table and the definition of done come from the Live edition standard.
- **WACHS rust.** WA Country Health Service takes a rust of its own rather than sharing the brand slate
  with East Metro.
- **The prototype chip kept neutral.** The first edition drew the Synthetic prototype chip in brass. It
  stays neutral because brass means you are here and nothing else.
- **The gilt token name kept.** The colour is called brass in every sentence and the token is called
  gilt, because the second edition's stylesheet and scripts read that name.
- **South Metro teal on the ground.** The one text pairing below the floor is svc-south on the bare
  ground in the light theme, at 4.04:1. Until the owner darkens the teal, no page sets a service name
  directly on the ground, and the pair stays printed and marked in section 3.6.
- **Delays.** Confirm which of the three Delays artifacts is the working one. The plan assumes 24f6ef55.
- **Legend default.** Open only at 1600 by 960 and wider, closed elsewhere, reader's choice thereafter.
- **New referral.** Unlock it for the visual migration only, keeping its flow, field order and wording
  locked.
- **Ward Home, Daily Return.** Say whether it is a mockup to migrate or a closed study.
- **The repository's Board language document.** Whether it is updated to point at this standard for
  mockups.

Closed and superseded: the three earlier Command artifacts (including the first edition's Platinum
Raised Cool build), the two earlier Delays artifacts (assumed, owner to confirm), the chrome and
navigation studies (closed by the shell in section 5), every direction study (Platinum Raised and Tonal
in Warm, Cool and Quiet, Platinum Satin, Brushed and Engraved, Consulate Tonal, Raised and Rules, Tide,
Sea Glass, Signature, Folio, Atelier, Theatre, Chart, Liquid Glass, Signal, Ledger), and the first and
second editions of this document, which stay in the version picker for the record.
