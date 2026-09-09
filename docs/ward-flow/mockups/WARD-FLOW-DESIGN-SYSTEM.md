# Ward Flow design system, third edition

The one standard every Ward Flow mockup is built to. Rules first, then the tokens, the components rendered from the same stylesheet, the shell in both its states, the behaviours, the wording, the recipe, the plan for the eighteen mockups, and the index of the twelve screens.

_Frozen on Tuesday 8 September 2026, version 3.0._

Every row, figure and person inside the component demonstrations is invented. The hospital sites and health services are real WA names.

## 1. Purpose, scope and precedence

_Read first._

**This is the third edition of the single standard every Ward Flow mockup is built to, and from here the standard for the project's mockups generally.** The first edition was Platinum Raised Cool, and the second was the Live edition standard. This edition takes the second's content, behaviour and rigour, and the first's identity and material. In plain words, everything a coordinator reads or does comes from the second edition, and everything the eye sees as colour, type, light and surface comes from the first. Where the two disagreed on a rule, the stricter rule won and is written down here. Section 12 lists what moved from each. The earlier editions are kept beside this one as files, the first as WARD-FLOW-STYLE-GUIDE.md with guide-body.html and the second as source-L-standard.html, and in the version history of the artifact that carried them.

It also replaces the visual layer of the Board language (Archivo, JetBrains Mono, the mid blue). It keeps the Board language's five rules and every rule it made about real data and about honesty, restated in section 8, so a page that meets this standard meets those rules too.

It covers colour, type, material, layout, the components, behaviour, wording, the accessibility floor, the definition of done, the recipe for a new mockup, and the plan for moving all eighteen mockups onto it. The Command third edition is the reference build, and every component in section 6 is rendered on this page by the stylesheet Command uses, so a component here looks the way it looks there. Four components Command does not yet carry, the table, the band, the chart and the disclosure, are drawn by the extension block printed in section 15.7, and the shell every screen sits in is drawn by the shell rules in 15.8. Section 14 indexes the twelve screens.

### Precedence

1. **The owner's words in this chat.** A ruling made in conversation outranks this document until the document is updated to carry it.
2. **This standard.**
3. **The Board language's clinical and data rules.** They are carried here in full, so a conflict between the two is a defect in this document, to be fixed here.
4. **The artifact host's own rules.** Fragment HTML, a title tag first, Google Fonts by link only, three theme states, no host ground showing through.
5. **Generic defaults.** Never a reason to depart from any of the above.

A mockup that needs a value the standard does not have reports the gap. It does not invent a hex, a font size or a spacing step. The gap is closed here first and the mockup is re-cut afterwards.

### Design intent, not app colour

The mockups are design intent. The application resolves colour by role through its own token layer, so a value match against these numbers finds nothing and a hex from this page must never be pasted into app code. The role map between the two lives in the repository beside the Board language.

### How to use it

1. Copy the stylesheet in section 15 verbatim into the page. Do not edit the copy.
2. Below it, add only the rules the screen needs, under a comment naming the screen.
3. Build from the components in section 6, with the wording rules in section 8.
4. Prove the page against sections 9 and 10 before it is called done.
5. To change anything in the block, change it here and re-cut every carrier. Never hand-patch a copy.

### What premium means here

Restraint. One serif, used only on the names of things. One accent and one brass, each with a job it never shares. One shadow, and one fall of light. Alpha hairlines. Figures that line up. Words before colours. Nothing decorative that is not also information, and nothing that would look out of place printed on a handover sheet.

## 2. The ten rules

_In the order they matter._

These are the rules the stylesheet keeps, in the order they matter. Everything else in this document is a consequence of one of them. A page that breaks one is not done, whatever it looks like.

1. **State is a word first, and a colour second.** A colour, a bar or a tint only ever repeats a word that is already on the screen, so a reader with no colour perception loses nothing, and neither does a greyscale printout. Status colours are reserved and solid: red, amber and green mean breach, look here and clear, they are never used for anything else, and the brand slate and the brass never carry a status.
2. **Figures are JetBrains Mono and tabular.** Every identifier, wait, count, time and code is set in the mono face with tabular numerals, so anything a reader compares down a column lines up and a digit never jitters. Zero reads “none”: a nought is a measurement and “none” is a state.
3. **Absence is stated, never blank.** “Not tracked here” and “No destination yet” are the models. An empty panel says why it is empty and what the emptiness means. A count of zero is shown in italic without a pill rather than hidden. A panel that is merely empty reads as a bug.
4. **Nothing is set below 10.5px, and the scale has seven steps.** Uppercase labels carry 0.08 to 0.12em of tracking, headings a touch of negative tracking, and every size is one of the seven t steps in section 4. Only weights that are loaded are asked for, and there are no small capitals. The wordmark is t-5 in the display serif, not a size of its own.
5. **One elevation step, and only one.** Light falls from the top. The ground is a shade lighter at the top of the window than at the bottom, a panel is lifted off it by a hairline that is heavier along its bottom edge, one low shadow tinted with the brand, and a one pixel highlight along its top edge, and its header and foot strips sit a tone cooler than its body, so a panel reads as a made object with a top and a bottom. Nothing inside a panel is lifted again. Radii step inward: 10px panels, 9px strips inside them, 6px controls, a pill for chips. Hairlines carry alpha, are solid, and are never dashed. A region that overflows sideways shows a soft shade at its edge and a sentence, never a frame. A list that continues past its window fades into the edge it continues past, and the fade is measured on every render, scroll and resize, never declared. A legend is a disclosure, open where the diagram has room to spare and closed where it does not, and the reader's own choice wins from then on.
6. **Colour has four jobs and they never share a hue.** The accent, deep slate, means brand and interactive. Gilt is brass and means “you are here”, and brass is a bar and never a fill: the bar beside the active nav item, under the live tab, beside the selected row, on the current stage, the name of the current stage beside the stepper, and the two letters beside the wordmark, and nothing else, which is why the prototype chip in the bar is neutral and why the brass wash is never painted behind text. Green, amber and red mean status only. The four health services have hues of their own. On a map only an eligible or a recorded ward carries a fill, and every other verdict is an outline and a word.
7. **Every text pairing is measured, in both themes, at a floor of 4.5:1.** The figures in section 3 were printed by the script that derived them, not typed, and the page recomputes them from its own tokens on every load. A pair that falls short is printed, marked and reported, never hidden.
8. **Both themes are tokens only.** The bare root is the complete light palette. The dark palette is redefined under the machine's preference, guarded so an explicit light choice beats a dark machine, and again under the page's own control so it wins the other way. For print every token takes its light value, on all three roots. Never a colour whose only definition sits inside one of those blocks, never a hex in a component, and never pure black or pure white as a surface or an ink. The one white is on-accent, the text on the slate control.
9. **Every figure is invented and the page says so twice.** Once in the bar, where the prototype mark carries the disclaimer as its tooltip, and once in the rail foot, beside the reconciliation line the page derives on every load. Every count on the rail, on the bar and in the drawers is derived from the data on the page, never typed.
10. **Optical, not arithmetic.** A tracked uppercase label that ends a line carries its own trailing tracking as a negative margin, so it sits flush with whatever is under it. An inner corner is one pixel tighter than the panel it sits in. Every control draws rest, hover, pressed and focus, a disabled control says why and does not light on hover, and nothing brightens on hover. Selection never hides status: a pressed pressure card or a showing candidate keeps its status bar and gains the slate ring on the other three sides. Every change of subject is spoken to a screen reader as a sentence. The appearance choice is remembered for this browser only.

## 3. Colour

_30 tokens, both themes._

### 3.1 The four jobs

| Job                   | Tokens                                                                  | Used for                                                                                                                                                                                                                                                                                                                                                                 | Never for                                                                                                                                                                           |
| --------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Brand and interactive | --accent --accent-ink --accent-soft --on-accent --stripe --hl-on-accent | The primary control, links, the focus ring, done steps, the ring of a selected row or card, the pressed appearance button, panel titles and the brand name as text, and the 3px stripe along the top of the window.                                                                                                                                                      | Status of any kind. A hover, which is always the sunk well.                                                                                                                         |
| You are here          | --gilt --gilt-soft                                                      | Brass, as a bar and never a fill: beside the active rail link, under the live tab, beside the selected queue row, on the current stage of the stepper, beside the coordinator's own register rows, and the two letters beside the wordmark.                                                                                                                              | Anything else. Not a heading, not a number, not an ornament, not a chip, and never a wash behind text. The prototype chip in the bar is neutral for this reason.                    |
| Status                | --good --warn --danger and their soft fills, --danger-ink               | Always solid for a bar, a mark, a word or a swatch. Green is clear, eligible, accepted, available, reconciled. Amber is look here: at risk, declined, overridden, held. Red is a breach, a failed gate, a refused action, a blocked bed, a tier 1 mark. The soft fill sits only behind a row whose whole meaning is that status, such as a failed gate or a tier 1 pill. | Direction (up is not good, down is not bad). Emphasis. A brand mark. A title, a border, a tab or a button that is not itself a status action. Red on anything that is not a breach. |
| Service               | --svc-east --svc-north --svc-south --svc-wachs                          | Slate for East Metro, plum for North Metro, teal for South Metro and rust for WACHS. The name of a health service beside a ward, the outline of a node on the map, a legend swatch. Identity colours, so a plum node is not a warning.                                                                                                                                   | Fills, backgrounds, status or anything a reader would take for a verdict.                                                                                                           |

### 3.2 The tokens

The identity is cool platinum with a faint blue cast, a deep slate brand and a brass secondary, and it is separate from the material, which is how surfaces are told apart. Every swatch below is painted from the live token, so it flips with the appearance control on the left. The two values printed under it are the light and dark definitions in the stylesheet, and the two hairlines are printed as the alpha values they are.

| Token           | Light                | Dark                    | Job                                                                                                                                                                                 |
| --------------- | -------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--ground-hi`   | `#ecf0f4`            | `#14181d`               | The top of the ground, where the fall of light begins. Nothing is written on it.                                                                                                    |
| `--ground`      | `#e6eaef`            | `#0f1216`               | The ground at 55 percent of the window. The bar and the rail are surface, so nothing is written on it.                                                                              |
| `--ground-2`    | `#e1e6ec`            | `#0c0f12`               | The foot of the ground, the end of the fall of light.                                                                                                                               |
| `--surface`     | `#fdfdfe`            | `#171b21`               | Panels, cards, rows and controls at rest, and the chrome. Never pure white.                                                                                                         |
| `--surface-2`   | `#f4f7fa`            | `#1b2026`               | Panel headers, tab strips, the diagram foot and the legend: the cooler band a panel wears at its edges.                                                                             |
| `--sunk`        | `#eef2f6`            | `#13171c`               | Hover, wells, meter tracks, gates, count pills and quiet chips. Never a selected state.                                                                                             |
| `--ink`         | `#161a20`            | `#e8ecf1`               | Headings, figures, row titles and any text that must be read.                                                                                                                       |
| `--ink-soft`    | `#414953`            | `#b2bac5`               | Secondary text, verdict detail, rail links at rest.                                                                                                                                 |
| `--muted`       | `#5f6873`            | `#8a929d`               | Labels, notes, counts and stated absence. The lightest text allowed.                                                                                                                |
| `--scrim`       | `rgba(30,48,66,.32)` | `rgba(0,0,0,.6)`        | The drawer backdrop over the whole window, rail included. A job of its own, because the edge shade at any opacity is too faint in light.                                            |
| `--line`        | `rgba(22,30,40,.11)` | `rgba(255,255,255,.09)` | The hairline, with alpha: dividers, row bottoms, panel edges.                                                                                                                       |
| `--line-strong` | `rgba(22,30,40,.26)` | `rgba(255,255,255,.21)` | The heavier hairline, with alpha: a panel's bottom edge, control borders, bars and steps at rest, scrollbar thumbs.                                                                 |
| `--accent`      | `#2f4c66`            | `#a7bcd2`               | Deep slate. Brand and interactive: the primary control, the focus ring, done steps, the selected ring, the glyph on the active rail link.                                           |
| `--accent-ink`  | `#27405a`            | `#bfd0e2`               | Slate as text: panel titles, the brand name, links, the shortlist identifier, text on accent-soft, the pressed appearance button.                                                   |
| `--accent-soft` | `#dfe7f0`            | `#1f2a36`               | The wash of a selected row, card, tab count or pressed control. Never a hover.                                                                                                      |
| `--on-accent`   | `#ffffff`            | `#0f1216`               | Text on accent.                                                                                                                                                                     |
| `--stripe`      | `#2f4c66`            | `#3a5a78`               | The 3px stripe along the top of the window. The accent in light and a mid slate in dark.                                                                                            |
| `--gilt`        | `#7d612a`            | `#d3b77e`               | Brass. You are here, as a bar and never a fill: beside the active rail link, under the live tab, beside the selected row, on the current step, and the two letters by the wordmark. |
| `--gilt-soft`   | `#f1ebdf`            | `#2a251b`               | Reserved. Never painted behind text in this edition, and unused on Command by design.                                                                                               |
| `--good`        | `#227550`            | `#6fd39b`               | Clear, eligible, accepted, available, reconciled.                                                                                                                                   |
| `--good-soft`   | `#e2f0e8`            | `#15291f`               | The wash behind an accepted destination or a chosen candidate.                                                                                                                      |
| `--warn`        | `#825D10`            | `#e3bc5e`               | Look here: at risk, declined by a ward, overridden, held. At most two flagged tiles per screen.                                                                                     |
| `--warn-soft`   | `#f6eeda`            | `#2b2415`               | The wash behind an overridden gate.                                                                                                                                                 |
| `--danger`      | `#b03b2e`            | `#ff8b76`               | A breach, a failed gate, a refused action, a blocked bed, a tier 1 mark. Never anything else.                                                                                       |
| `--danger-soft` | `#f8e6e2`            | `#33201b`               | The wash behind a failed gate or a tier 1 pill.                                                                                                                                     |
| `--danger-ink`  | `#973121`            | `#ffa08e`               | Text on danger-soft, where danger itself would sit lower.                                                                                                                           |
| `--svc-east`    | `#2f4c66`            | `#a7bcd2`               | Slate. East Metropolitan Health Service, and the ward alias.                                                                                                                        |
| `--svc-north`   | `#685a94`            | `#b1a2d6`               | Plum. North Metropolitan Health Service, and the coordinator alias.                                                                                                                 |
| `--svc-south`   | `#356a70`            | `#7fb2b8`               | Teal. South Metropolitan Health Service, and the community alias.                                                                                                                   |
| `--svc-wachs`   | `#8c5a3c`            | `#d89a78`               | Rust. WA Country Health Service.                                                                                                                                                    |

### 3.3 Aliases, the light model and the non-colour tokens

- **`--ward --ward-soft --ed --comm --coord`** Names kept for the rendering scripts, so the data layer never carries a hex of its own. Command reads ward, for the tier 3 mark on the map. The others are reserved aliases kept for name stability: ward-soft is accent-soft, ed is danger, comm is the south hue, coord is the north hue.
- **`--lift`** The one shadow: a 1px contact shadow and a long, low, 30px shadow at low alpha, tinted with the brand slate rather than black in the light theme and plain black in the dark. Panels only.
- **`--hl`** The one pixel highlight along a panel's top edge, drawn as an inset shadow. White at 0.9 in light, 0.06 in dark. It is the light catching the top of the panel, and it is what makes the lift read as a lift rather than a border.
- **`--hl-on-accent`** The same highlight on the primary control. White at 0.14 in light and 0.28 in dark.
- **`--edge-shade`** The soft inset shade at the edge a region continues past. Slate at 0.16 in light, black at 0.55 in dark.
- **`--scrim`** The backdrop behind an open drawer. Slate at 0.32 in light, black at 0.6 in dark. It is the one shade that covers the rail as well as the body, and it never carries text.
- **`--line --line-strong`** The two hairlines, and they carry alpha on purpose. One value is then the right darkness over a white row, a toned header strip and a sunk well alike, so a line never has to be re-mixed for the fill it sits on. Never replace them with a solid grey.
- **`--r1 --r1i --r2`** 10px for panels, 9px for a strip inside a panel, 6px for cards, rows and controls. Chips, tags, counts and pills are 999px. A radius never repeats at the depth of its parent.
- **`--gap`** 14px between panels and between columns.
- **`--t-0` to `--t-6`** The seven-step type scale, section 4.
- **`--display --body --mono`** The three faces with their fallback stacks, section 4.

### 3.4 Contrast, computed rather than judged

Every pairing of text on a fill that the components use, in both themes. The pairs were printed by `third-edition-kit/recompute-contrast.mjs` from the token values, never computed by hand, and the page recomputes them from its own live tokens on every load and every change of appearance. The floor is 4.5:1.

71 pairs, every one above the floor in both themes. The lowest light pairing is 4.5:1 and the lowest dark pairing is 4.6:1. The rows marked not used are pairings no page sets today, kept so a page that ever does has the figure, and the pairs a showing, hovered, chosen or blocked candidate reaches are listed because the round one review found three of them below the floor before the tokens were darkened.

Recomputed for the light theme on load: 71 pairs, all match the printed figures, none below 4.5:1, the lowest 4.50:1.

| Pair                      | Light  | Dark   | Where it occurs                                                                           |
| ------------------------- | ------ | ------ | ----------------------------------------------------------------------------------------- |
| ink on surface            | 17.2:1 | 14.6:1 | Headings and row titles on a panel                                                        |
| ink on ground             | 14.5:1 | 15.8:1 | Not used: nothing is written on the ground. Kept so a page that ever does has the figure  |
| ink-soft on surface       | 9.0:1  | 8.8:1  | Secondary text on a panel                                                                 |
| ink-soft on ground        | 7.6:1  | 9.6:1  | Not used: kept for the same reason                                                        |
| muted on surface          | 5.6:1  | 5.5:1  | Labels and counts on a panel                                                              |
| muted on ground           | 4.7:1  | 6.0:1  | Not used: the rail and the bar are surface, so the rail note sits on surface              |
| muted on ground-hi        | 4.9:1  | 5.7:1  | Not used: the lightest band of the ground, at the top of the window                       |
| muted on ground-2         | 4.5:1  | 6.1:1  | Not used: the darkest band of the ground, at the foot of the window                       |
| muted on sunk             | 5.0:1  | 5.7:1  | Labels on a hover row or a gate                                                           |
| muted on surface-2        | 5.3:1  | 5.2:1  | The count in a panel header                                                               |
| muted on accent-soft      | 4.5:1  | 4.6:1  | Meta text on a selected row                                                               |
| accent on surface         | 8.8:1  | 8.9:1  | Link text and the focus ring                                                              |
| accent-ink on surface     | 10.5:1 | 11.0:1 | The brand name in the rail, a link                                                        |
| accent-ink on surface-2   | 9.9:1  | 10.4:1 | A panel title on its header strip                                                         |
| accent-ink on accent-soft | 8.6:1  | 9.2:1  | Text on a selected row or pressed control                                                 |
| on-accent on accent       | 9.0:1  | 9.6:1  | The primary control's label                                                               |
| gilt on surface           | 5.7:1  | 8.9:1  | The letters beside the wordmark, the current stage word                                   |
| gilt on gilt-soft         | 4.9:1  | 7.9:1  | Brass text on its own wash, should a page ever need it                                    |
| gilt on accent-soft       | 4.7:1  | 7.5:1  | The current stage word on a selected panel                                                |
| good on good-soft         | 4.8:1  | 8.4:1  | An accepted destination badge                                                             |
| good on surface           | 5.5:1  | 9.4:1  | An eligible verdict, a pass mark                                                          |
| warn on warn-soft         | 5.2:1  | 8.5:1  | An overridden gate's verdict                                                              |
| warn on surface           | 5.9:1  | 9.6:1  | A declined verdict                                                                        |
| warn on sunk              | 5.3:1  | 10.0:1 | A held bed chip, and the verdict word on a hovered candidate that needs a recorded reason |
| danger on danger-soft     | 5.0:1  | 6.8:1  | A failed gate's verdict                                                                   |
| danger on surface         | 5.9:1  | 7.6:1  | A breach word, a refused row's title                                                      |
| danger-ink on danger-soft | 6.3:1  | 7.8:1  | A tier 1 pill                                                                             |
| svc-east on surface       | 8.8:1  | 8.9:1  | East Metro's name on a candidate                                                          |
| svc-north on surface      | 5.9:1  | 7.4:1  | North Metro's name on a candidate                                                         |
| svc-south on surface      | 6.0:1  | 7.4:1  | South Metro's name on a candidate                                                         |
| svc-wachs on surface      | 5.7:1  | 7.3:1  | WACHS's name on a candidate                                                               |
| svc-east on ground        | 7.4:1  | 9.6:1  | Not used: no service name is set on the ground                                            |
| svc-north on ground       | 5.0:1  | 8.1:1  | Not used: no service name is set on the ground                                            |
| svc-south on ground       | 5.0:1  | 8.0:1  | Not used: no service name is set on the ground                                            |
| svc-wachs on ground       | 4.8:1  | 7.9:1  | Not used: no service name is set on the ground                                            |
| svc-south on surface-2    | 5.7:1  | 7.0:1  | A service name in the legend band, and on a blocked candidate                             |
| svc-north on surface-2    | 5.6:1  | 7.0:1  | A service name in the legend band, and on a blocked candidate                             |
| svc-east on surface-2     | 8.3:1  | 8.4:1  | A service name in the legend band, and on a blocked candidate                             |
| svc-wachs on surface-2    | 5.4:1  | 6.9:1  | A service name in the legend band, and on a blocked candidate                             |
| ink on surface-2          | 16.2:1 | 13.8:1 | A blocked candidate's name, and a title on a header strip                                 |
| ink-soft on surface-2     | 8.5:1  | 8.4:1  | A blocked candidate's bed line                                                            |
| gilt on surface-2         | 5.4:1  | 8.5:1  | Brass text on a strip                                                                     |
| ink on sunk               | 15.5:1 | 15.2:1 | A hovered candidate's name, a gate label                                                  |
| ink-soft on sunk          | 8.1:1  | 9.2:1  | A hovered candidate's bed line, a gate detail                                             |
| accent-ink on sunk        | 9.5:1  | 11.4:1 | A hovered link button, the count on a hovered tab                                         |
| good on sunk              | 5.0:1  | 9.8:1  | A ready bed chip, and the verdict word on a hovered eligible candidate                    |
| danger on sunk            | 5.3:1  | 7.9:1  | A blocked bed chip                                                                        |
| svc-east on sunk          | 8.0:1  | 9.2:1  | East Metro's name on a hovered candidate                                                  |
| svc-north on sunk         | 5.4:1  | 7.7:1  | North Metro's name on a hovered candidate                                                 |
| svc-south on sunk         | 5.4:1  | 7.7:1  | South Metro's name on a hovered candidate                                                 |
| svc-wachs on sunk         | 5.1:1  | 7.6:1  | WACHS's name on a hovered candidate                                                       |
| svc-east on accent-soft   | 7.2:1  | 7.5:1  | East Metro's name on the showing candidate                                                |
| svc-north on accent-soft  | 4.8:1  | 6.2:1  | North Metro's name on the showing candidate                                               |
| svc-south on accent-soft  | 4.9:1  | 6.2:1  | South Metro's name on the showing candidate                                               |
| svc-wachs on accent-soft  | 4.6:1  | 6.1:1  | WACHS's name on the showing candidate                                                     |
| good on accent-soft       | 4.5:1  | 8.0:1  | The verdict word on a showing eligible candidate                                          |
| warn on accent-soft       | 4.8:1  | 8.1:1  | The verdict word on a showing candidate that needs a recorded reason, or has declined     |
| ink on accent-soft        | 14.0:1 | 12.3:1 | A figure on a selected directory row                                                      |
| danger on accent-soft     | 4.8:1  | 6.4:1  | The status word on a selected row whose status is a breach                                |
| svc-east on good-soft     | 7.6:1  | 7.9:1  | East Metro's name on a chosen candidate                                                   |
| svc-north on good-soft    | 5.1:1  | 6.6:1  | North Metro's name on a chosen candidate                                                  |
| svc-south on good-soft    | 5.2:1  | 6.6:1  | South Metro's name on a chosen candidate                                                  |
| svc-wachs on good-soft    | 4.9:1  | 6.4:1  | WACHS's name on a chosen candidate                                                        |
| warn on good-soft         | 5.1:1  | 8.5:1  | The verdict word on a chosen candidate that needs a recorded reason                       |
| ink-soft on accent-soft   | 7.3:1  | 7.4:1  | A selected row's secondary text                                                           |
| ink on danger-soft        | 14.5:1 | 13.0:1 | The label of a failed gate                                                                |
| ink-soft on danger-soft   | 7.6:1  | 7.9:1  | The detail of a failed gate                                                               |
| ink-soft on warn-soft     | 7.9:1  | 7.9:1  | The detail of an overridden gate                                                          |
| ink on good-soft          | 14.9:1 | 12.9:1 | The label on an accepted badge's ground                                                   |
| ink-soft on good-soft     | 7.8:1  | 7.8:1  | Detail on a chosen candidate                                                              |
| muted on good-soft        | 4.8:1  | 4.9:1  | Meta on a chosen candidate                                                                |

Non-text marks are held to 3:1 against their ground where they carry meaning: status bars, meter fills, the focus ring and the step marks all use the full-strength token. Hairlines are not meaning and are not held to a ratio.

### 3.5 Print and forced colours

For print every token takes its light value on all three roots, the canvas is white with no fall of light, the shadow, the highlight and the stripe go, and the four status colours keep their exact values with print colour adjust set to exact. Under forced colours every panel, card, row, control and chip takes a CanvasText border on a Canvas fill, every meter, done or current step, peer dot, the rail's brass bar and the stripe become CanvasText, a todo step is an empty CanvasText box, a legend swatch is a bordered box, and the pressed appearance button is the system highlight. Both blocks are in the stylesheet already.

## 4. Type

_Three faces, seven steps._

### 4.1 The three faces

**Source Serif 4, 600 and 700, optical size 8 to 60.** The names of things: the wordmark, the page title, panel titles, site codes and the headings on the diagram. Never running text. Headings and site codes are 600. Negative tracking of 0.012em on the title and on the wordmark.

**Source Sans 3, 400, 500, 600 and 700.** Everything read. Headings within a panel's body are Source Sans 3 600. Bold is 600 for emphasis and 700 only where a label must carry over a tone, such as a verdict word.

**JetBrains Mono, 400, 500 and 600.** Every figure, identifier, time, count and code, always with tabular numerals. Its figures stay open and distinct at the 10.5px floor, which is why it returns from the Board language.

Fallback stacks are declared for all three: Georgia and then Times for the serif, Segoe UI and the system sans for the text face, and the system monospace for the figures. Fonts load from Google Fonts by one link with display swap, because the artifact host admits no other font source. Only weights that are loaded are asked for: serif 600 and 700, sans 400 to 700, mono 400 to 600. A request for a weight that is not loaded is served as a synthetic bold in some browsers and as the nearest weight in others, so it is never made. No small capitals: the served fonts carry none, and a synthesised small capital is a shrunk capital that only reads smaller. Uppercase labels keep their tracking instead.

### 4.2 The scale

| Step  | Size   | Roles                                                                                                                                                                                                        | Sample                                        |
| ----- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------- |
| --t-0 | 10.5px | Uppercase labels, tags, counts, chips, legend items, tier pills, the eyebrow in the rail. The floor: nothing is set smaller.                                                                                 | Longest wait                                  |
| --t-1 | 11.5px | Meta lines, notes, disclaimers, secondary text, verdict detail, table body in dense registers.                                                                                                               | Referred 04:32, coordinator on call           |
| --t-2 | 12.5px | Row titles, identifiers, control labels, fact values, table body, the destination badge.                                                                                                                     | Accepted by FSH Adult Secure, bed 4 confirmed |
| --t-3 | 13.5px | Body text, panel titles in the display serif, rail links, candidate names, department codes. The page's base size.                                                                                           | Emergency department pressure                 |
| --t-4 | 16px   | Section headings in a document like this one. Rare on a screen.                                                                                                                                              | Material and layout                           |
| --t-5 | 20px   | Figures in the live tally's tiles, the clock in the shift block and the wordmark. Mono at 500 for the figures, the display serif at 600 for the wordmark. The shortlist identifier and a rule number at 600. | 10:42                                         |
| --t-6 | 26px   | The page title in the display serif at 600, and the figure in a band tile.                                                                                                                                   | Command                                       |

### 4.3 Setting rules

- **Uppercase only at t-0 and t-1, always tracked** 0.08em for labels beside figures, 0.10em for verdict words and the schematic note, 0.12em for eyebrows, legend titles and fact labels. Never title case, never synthesised small capitals. The two letters beside the wordmark carry 0.16em, the one label tracked wider, because they sit in brass at t-0 beside a t-5 wordmark and need the room.
- **Trailing tracking is compensated.** A tracked label that ends a line or a flex row carries its own tracking as a negative right margin (the chip, the service name, the verdict word, the schematic note, the appearance button, the tab strip's gap all do this), so the label sits flush with what is under it.
- **Headings carry negative tracking** of 0.01em in Source Sans 3 and 0.012em in Source Serif 4. Figures at t-5 and t-6 carry 0.02em negative.
- **Tabular numerals everywhere**, set once on the body and on every button, so a proportional figure cannot appear by accident.
- **Italic means absence or quietness**: a stated none, an untracked value, a quoted reason. Never emphasis.
- **Line lengths.** Prose no wider than 78 characters, notes and scopes no wider than 72, the rail note no wider than 60. Headings balance and notes wrap pretty.
- **A word is never broken.** Where a value cannot wrap it is clipped with an ellipsis and the full text sits in the element's title, as the department name on a pressure card does.
- **Quotes are typographic** in prose and straight only in code. Times are 10:42 with AWST beside the date. Dates are Sat 15 Aug in a tile and Saturday 15 August 2026 in a label read aloud.

## 5. Material and layout

_One light model, one shell._

### 5.1 Ground, surface, well, and the fall of light

The ground sits behind everything, and it is a gradient rather than a flat colour: ground-hi at the top of the window, ground at 55 percent, ground-2 at the bottom, fixed to the window so it does not scroll with the page. The reason is that a flat canvas is what makes white panels look like boxes cut out of paper. A fall of light from the top gives the page a top and a bottom, and a panel lifted from it reads as an object standing on a surface rather than a rectangle drawn on one. The gradient is faint by design, and nothing is written directly on the ground: the rail and the bar are surface, so every word sits on a panel or on chrome.

Panels are surface, lifted once. Panel headers, tab strips, the diagram foot and the legend are surface-2, the slightly cooler band a panel wears at its edges. The well, sunk, is hover, meter tracks, gates, count pills and quiet chips, and a well is a tone, not a box, so it carries no border. A selected thing is accent-soft and a hovered thing is sunk, so the two states never look alike. The rail and the header are chrome: surface with a single hairline where they meet the ground, not panels, and they cast no shadow.

### 5.2 The brand stripe

A fixed 3px stripe in the stripe token runs along the top edge of the window, above everything, drawn by the body's own before pseudo element so no page has to carry it. It is the single brand mark, in the place institutional sites put theirs, and it is the only thing on the page that is fixed to the window rather than to the layout. It is hidden in print and drawn in CanvasText under forced colours. In the dark theme it is a mid slate rather than the accent, so it reads on a dark ground without glowing.

### 5.3 One elevation step

A panel is a hairline all round, a heavier hairline along its bottom, the lift shadow and a one pixel highlight along its top edge. The highlight is the hl token drawn as an inset shadow, and it is what makes the lift read as a lift rather than a border: light catches the top of the panel and the heavier line at the bottom is the edge in shade. The lift shadow is long, low and tinted with the brand slate rather than black in the light theme, so the ground under a panel looks shaded rather than dirtied. That is the only lift on the page. Cards, rows, gates and chips inside a panel are hairlines and fills only, and nothing inside a panel carries a shadow. Hover lifts nothing: it changes the fill to the well, or on the map thickens the node's outline by half a pixel so its fill keeps saying what it says.

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

The panel header strip, the diagram foot with its legend, and the tab bar sit on surface-2. A strip that touches a panel corner takes the inner radius, r1i, on those corners, one pixel tighter than the panel, so the strip sits inside the panel's edge rather than fighting it. A header strip is a label, not a toolbar: it holds the title in the display serif in accent-ink, an optional note, a derived count in mono, and at most one small disclosure control. The legend and the diagram foot use the same tone at the bottom of a panel, so a panel has a top and a bottom in the same material.

### 5.5 Radii and lines

- **10px** Panels.
- **9px** The inner corners of a panel header, tab strip or foot, one pixel tighter than the panel.
- **6px** Cards, rows, gates, controls, code blocks, the destination badge.
- **4px** The focus ring's corner and the small panel-header control.
- **Pill** Chips, tags, counts, tier pills, peers, bed chips, the appearance control.
- **Hairline** 1px, solid, line or line-strong, both carrying alpha so one value reads right over every fill. Never dashed and never dotted. A broken outline exists only on the map, where a declined ward is dotted (2 3) and a ward that needs a recorded reason is dashed (5 4), both in amber, each repeating the word beneath it. Never a solid grey used as a line.
- **Status bar** 3px along the left of a row or candidate, along the top of a pressure card. 4px for meters and steps. The bar is the only place a card or row carries colour.
- **Stripe** 3px along the top of the window.

### 5.6 The shell

A screen is a two column grid: the rail on the left, and a frame on the right that holds the live region, the bar and the screen's own panels. The rail is one `nav.rail`, sticky and as tall as the window, open at 236px or closed to a 76px strip, and the column animates over 0.18s, or not at all when motion is reduced. The bar is one row, 56px tall, on every screen: the title and the neutral prototype chip with the disclaimer as its tooltip, universal search, the Service selector, Activity, Tasks and Tools as three matching side drawers, and New referral as the one primary action. Nothing else sits on the row. The figures the masthead used to carry are the four tiles and the facts of the Activity drawer's live tally, counted from the same data, the outstanding tasks are the Tasks drawer, and the date and the time sit in the rail's shift block. Sections 6.1 and 6.2 draw every piece. The body scrolls below the bar with 14px top padding, 24px sides and a 14px gap between panels and between columns. Every scrolling region declares a minimum height of zero on its grid or flex path, because without it a column grows instead of scrolling and the layout looks right and behaves wrong. The skip link is the first focusable thing on the page and points at the screen's main list, and the live region is first in the frame.

The layers, from the page up. Nothing in a panel is raised again, and nothing is raised above the brand stripe.

| Layer               | z-index | Rule                                                                                                                               |
| ------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Body and panels     | 0       | Nothing in a panel is raised again.                                                                                                |
| The rail            | 20      | Rises to 32 only while the closed strip is hovered or holds focus, so a hover card can pass over the bar.                          |
| The bar             | 31      | Its dropdowns sit at 20 and the search results at 22, inside the bar's own stacking context.                                       |
| The hover card      | 35      | Inside the rail. Pointer events are off, so it never traps the cursor.                                                             |
| The drawer backdrop | 39      | The scrim over the whole window, rail included.                                                                                    |
| The drawer          | 40      | Fixed to the right edge, with the head sticky inside it.                                                                           |
| The brand stripe    | 45      | Above the bar and every drawer, so nothing ever paints over it. Pointer events are off. An owner decision, recorded in section 13. |
| The skip link       | 50      | So it is never under the rail or the bar when it holds focus.                                                                      |

The collapse ladder, gathered in one place. At or below 1500px the mark reads Prototype. At or below 1300px the mark is hidden and the words on Activity, Tasks and Tools go, leaving the glyph, the badge and the dot, and the search falls back to a 10rem basis. Between 1400 and 1599px the outer columns give up a rem each, as section 5.7 says. Below 1000px the grid is one column, the rail renders in the open shape as a wrapping row whatever is stored, its flip control is hidden, the bar wraps and the search takes its own row. At 640px the tap floor of 3rem applies, the tally is one column and a pop out is at most 94vw wide. The search grows from 14rem to 30rem with the room and never below 10rem, and the row can never push the document sideways whatever face is loaded. The chip and the drawer words go at 1300px rather than the build sheet's 1240px, because with them shown at 1280px the bar overflows by 1px with the search at 213px.

### 5.7 The widths

| Width                                 | Layout                                                                                                                                                                                                                                      | What gives                                                                                                          |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| 1600px and wider                      | The page is locked to the viewport. Three columns of 15rem, the remainder, and 25rem, with flush bottoms. Only the scrolling body of a column may give up height. Headers, tab strips, feet and legends keep theirs.                        | Nothing. The legend opens by default from 1600 by 1100, where the diagram is not already cut off.                   |
| 1400 to 1599px                        | The same lock. The outer columns give up a rem and two rem (14rem and 23rem) so the diagram keeps more. Register tabs sit closer and the bar's search gives up width first.                                                                 | The legend closes by default. The bar's mark reads Prototype from 1500px and goes at 1300px, with the drawer words. |
| 1400px and wider, 1024px tall or less | The laptop rule. The lower register panel shrinks to 11.5rem, strip and card padding tighten, the legend and header padding tighten, so the diagram keeps what is left. Verified at 1440 by 900: the diagram region is at least 260px tall. | Registers, the strip and the legend give up height first. The diagram keeps its room.                               |
| 1001 to 1399px                        | Two columns and a normally scrolling page. The queue stays in view, sticky, with its own list scrolling inside a viewport-high panel. The shortlist sits under the diagram in two internal columns.                                         | The lock. The page scrolls.                                                                                         |
| 1000px and narrower                   | One column. The rail becomes a wrapping row under the wordmark, the eyebrows and foot are hidden, and the active link carries its brass bar along the bottom.                                                                               | The rail foot, so the appearance follows the machine.                                                               |
| 640px and narrower                    | Tab labels tighten, continuity lines stack, ward fact labels stack over their values, the bar's mark is already hidden (the rail note still states the disclaimer). The tap floor of 3rem applies.                                          | The second disclaimer.                                                                                              |

### 5.8 Overflow

- **The page never scrolls sideways.** Wide content scrolls inside its own container: a table wrapper, the diagram window, the pressure strip.
- **The affordance is a soft shade and a sentence.** A region that continues sideways shows an inset shade in edge-shade at that edge and its header count says “scroll sideways for the rest”, or the diagram foot shows the sentence. Never a frame, never an arrow.
- **Lists fade at the continuing edge**, 22px at the top and 26px at the bottom, switched by a measurement so the last row is never softened once the end is reached and a list that does not scroll shows no fade at all.
- **Scrollbars are thin** in every scrolling region: a line-strong thumb on a transparent track, 9px in the engines that draw their own. The one exception is the header's statistics strip and tasks bar, which hide theirs because they scroll by a swipe under a row of chips.

### 5.9 Density and rhythm

Everything sits on a 1px grid and nearly everything on a 2px one. These are the values in the stylesheet and are not re-derived per page.

| Where                         | Value                                                                                    |
| ----------------------------- | ---------------------------------------------------------------------------------------- |
| Panels and columns            | 14px apart. The working area has 16px top padding, 24px sides and 28px below.            |
| Rail                          | 22px above the wordmark, 20px below it, links 1px apart, groups 14px apart.              |
| Panel header                  | 11px by 16px.                                                                            |
| Rows                          | 10px by 16px. Register rows 7px apart.                                                   |
| Cards                         | 10px by 12px, 10px apart in the pressure strip.                                          |
| Sections inside the shortlist | 12px by 16px. Candidates 8px apart.                                                      |
| Gates                         | 8px by 11px, 5px apart.                                                                  |
| Controls                      | 7px by 13px, 6px apart.                                                                  |
| Chips                         | 3px by 10px.                                                                             |
| Legend                        | 2px above, 16px at the sides and 10px below, items 5px by 14px apart, groups 14px apart. |
| Status bars and meters        | 3px bars, 4px meters and steps, steps 4px apart.                                         |

## 6. Components

_Rendered from the stylesheet._

Every demonstration below is real markup styled by the block in section 15, not a picture of one. Pressed states, tabs and the legend control respond so all four states can be seen. Copy the markup shape given beside each one.

### 6.1 Wordmark, rail link, and the rail in both states

The rail is one `nav.rail` that the shell script renders in one of two shapes: open at 236px, or closed to a 76px strip. Both are drawn on the page by the shell rules in section 15.8 with the shell's own class names, so a piece there looks the way it looks on Command. Every count, line, tag and dot in the product is derived from the page's data on every render. The figures in the demonstrations are invented and typed only because the standard's page has no engine.

#### The wordmark and a rail link

**Shape.** `.brand` with the wordmark in a `b` and the two letters in a `span`. `.railGroup` with a `.railEyebrow` and `.railLink` buttons, each a `.railLabel` holding a stroked glyph on an 18 by 18 grid and a `.railText` with the name and, where the screen has one, its state line, then an optional `.tag` count and an optional `.toneDot`. The purpose of the screen is the tooltip.

**States.** Rest in ink-soft with a muted glyph. Hover and pressed on the well. Current: the accent-soft fill, accent-ink text, the accent glyph, the slate ring, and the brass bar at the group's left edge. Focus: the accent ring inset.

**Rules.** The tag is a derived count with a title saying what it counts, and a count of none is the italic word with no pill. The two letters are the only brass in the rail besides the bar. Glyphs are aria-hidden because the word is beside them. The wordmark is t-5 at 600 in the display serif, never a size of its own.

#### The open rail item, anatomy

**Markup.** `button.railLink[data-page]` holding `.railLabel` with the glyph and `.railText`, then an optional `.tag` and an optional `.toneDot`. An item with a state line carries `data-state="true"` and sits 4px tighter so the group keeps its rhythm.

**The line.** One line at t-0 under the name, muted, never wrapping and never truncated at 236px. Its own figures may carry red for a breach or amber for look here, in a `b[data-tone]`. On the current item the line takes accent-ink.

**The count.** A mono tag at the right, always neutral. A count of none reads none, in italics, with no pill: `.tag[data-zero="true"]`.

**What each carries.** Command: the open movements, the breached and due soon line, a red dot on a breach. Capacity: beds free, and the free and none line. Emergency departments: the longest wait line. Referrals: the count waiting, the oldest line, an amber dot over two hours. Handover: the time as its count and the time left as its line. Governance: overrides to review. Movement, Wards, Community teams, Patient search and Statistics carry nothing.

#### The tone dot rule

**Rule.** A 7px dot at the glyph's top left with a 2px ring of the surface it sits on: red when a legal deadline has passed behind that screen, amber when something there wants looking at. The tone lives on the dot, never on the count, so a red 23 can never be read as 23 breaches.

**Words first.** The dot is aria-hidden and a hidden sentence follows the state line: a legal deadline has passed, or look here. The closed strip folds the same words into the item's name. A reader with no colour loses nothing, because the line already says 2 breached.

**Never.** A tone on the tag, the name, the glyph or the group. Amber on more than two things at once. Green anywhere in the rail but the reconciliation dot.

#### The shift block

**Shape.** `.railBlock` on the second surface tone with a hairline, never lifted. A `.shiftRow` holds the small ring filled to the shift's progress with the percent inside, then the eyebrow with the clock at its right, the time to handover in mono at t-4, and the line under it with the handover time and the date. The date never wraps inside itself, because its spaces are non-breaking, so the line breaks at the comma or not at all. A 4px meter closes the block.

**The date and the time.** The masthead's clock is gone with the masthead. The time sits at the right of the eyebrow and the date follows the handover time, so the coordinator reads how much shift is left, which is what they are planning against, and still reads the date. The Tools drawer repeats the date with AWST.

**Rules.** The ring's percentage is t-0, never smaller. The ring is a role of img with the sentence as its name. Under reduced motion nothing in the block moves.

#### The pinned rows

**Shape.** Up to three movements the coordinator is watching, each a `button.pinRow[data-pin]` with the identifier in mono, the family name first, the wait in mono, and the tone bar of its queue row at the left, drawn as a pseudo element so it survives every state.

**States.** Rest on the surface. Hover and pressed on the well. Pressed for real, `aria-pressed="true"`: the accent-soft fill and the slate ring, with the bar kept. Pressing one selects it in the queue and scrolls to it, and is announced: WF-014 selected in the queue.

**Rules.** Names are invented: an uncommon given name and a word for a plant, a bird or a stone. Waits read 4h 28m. A red wait repeats a deadline passed that the row's title also states. Pinning is wired from the shortlist header's Pin control, `button.pinBtn[data-pin-toggle]`, pressed while the subject is pinned and announced as WF-021 pinned to the rail. A queue row does not pin. A second press on a pinned row announces that the movement is already the subject, because Command always has one.

#### The rail foot and the flip control

**Shape.** `.railFoot` above a hairline: Signed in as and the role in `.railUser`, the reconciliation line in `.railCheck` with its dot and sentence, and the invented figures note in `.railNote`. Then `button.railBtn[data-rail-toggle]`, a secondary control with the glyph, the words and the bracket key drawn as a keycap.

**Rules.** A role, never a name. The reconciliation dot is green with the sentence when the sums agree and red with the count of disagreements when they do not, from one `window.__commandCheck` the shell appends to and never creates. The appearance control is not here on Command: it lives in the Tools drawer. The standard's page keeps its own in its rail foot because it has no bar.

#### The service stripe

**Rule.** A 3px bar in the service hue under the brand, `i.svcStripe[data-svc]`, only while one service is chosen, in both states. One service chosen is easy to forget and expensive to forget, so the rail carries it wherever the eye rests.

**Hues.** Slate for East Metropolitan, plum for North, teal for South, rust for WA Country, the same four the pressure cards and the selector's dot use. The stripe is not the brand stripe along the top of the window, which stays slate.

#### The closed strip

**Shape.** The same nav, closed: WF at t-5 with the service stripe beneath it, the three groups separated by hairlines with their eyebrows hidden, and for each screen the glyph at 17px, one word under it, a mono tag at the top right and the tone dot at the glyph's left. The words are Command, Movement, Capacity, Wards, EDs, Teams, Search, Referrals, Handover, Statistics, Governance. Handover's tag is hidden here because the time is in its card.

**The foot.** The pinned fly out, `details.menu.flyMenu`, with its count as a pill and a panel that opens to the right, bottom aligned, holding the same pinned rows and note as the open rail. The ring at 44px with the coordinator's initials, its role, handover and time left as its tooltip. The reconciliation dot with the sentence clipped beside it, so a reader still hears it. Then Open the rail.

**The floor.** The word under each glyph is set at t-0, the type floor, and never below it. If a word does not fit the strip widens through `--railw-closed`. Words never shrink. Measured with Source Sans 3, all eleven fit in 76px and Governance is the widest.

#### The hover card

**Shape.** `.flyCard` inside the item, hidden until the item is hovered or holds a visible focus. 15.5rem wide, beside the item with a small arrow, aligned to the item's top. It holds the screen's name with its count, the purpose in one sentence, and the same state line the open rail shows, with the same tones.

**Layering.** The card floats, so it takes the one elevation step. The closed rail rises above the bar only while it is hovered or holds focus, so a card can pass over the bar without the drawers ever sitting under the rail. Pointer events are off, so it never traps the cursor.

**Why.** Rest the pointer on any glyph and the card says what the screen is and how it stands, so the strip can be used all shift without opening it, and nothing is lost by closing.

#### The bracket key and the remembered state

**The key.** The left bracket flips the rail between open and closed from anywhere that is not a field, and not while a modifier is held. The control at the foot of each state does the same, and the open one shows the key as a keycap. Both call one function.

**Remembered.** The choice is stored under `ward-flow-rail` for this browser only and stamped on the root as `data-rail` by the head script before first paint, so there is no width jump on load. The grid column animates over 0.18s and not at all under reduced motion. Focus moves to the new control and the change is announced: The rail, closed.

**Not built.** No review switcher, no number keys, no side by side view. The mockup's Both view was a review aid and is not a product state. Below 1000px the rail renders in the open shape as a wrapping row whatever is stored, and the control is hidden.

### 6.2 Header: the one row bar and its pop outs

One clean row on every screen: the title and the mark, universal search, the Service selector, then Activity, Tasks and Tools as three matching side drawers, and New referral, the one primary action. Nothing else. The figures and the tasks live behind the controls, never on the row. On the standard's page the bar is the shell's own markup, so its menus and drawers open for real over the page, and the drawers that follow are the same panels standing still so they can be read.

#### The bar at rest

**The eight controls.** `h1` the screen's name, the display serif at t-6, never a sentence. `.chip.mark` Synthetic prototype in a neutral chip with the disclaimer as its tooltip. `.searchWrap` the field with its slash hint and Clear, and the results beneath. `details.menu.svcMenu` the Service selector with its dot, short name and waiting count. `details.menu.drawerMenu` three times for Activity, Tasks and Tools, the first and last `.wide`. `details.menu > summary.primary` New referral.

**Measures.** 56px tall, padding 8px 20px 8px 24px, a 10px gap. The right hand group has an 8px gap and takes the remaining room. Every summary is 34px tall, t-2 semibold, a secondary control with the hairline border and the 6px radius, its chevron drawn in CSS. Open takes the accent-soft fill, the accent border, accent-ink text and the slate ring. The tap floor is 3rem at a coarse pointer.

**The dots and the badge.** Activity carries a green dot that breathes while the last event is within five minutes. Tasks carries the outstanding count as a badge, and a dot that is accent while a notice is new and red while a new notice is a breach, gone when none is new. Every dot is aria-hidden with a hidden sentence beside it: live or quiet, 3 new notices, one a breach, or no new notice.

**The ladder.** At or below 1500px the mark reads Prototype. At or below 1300px the mark and the words on Activity, Tasks and Tools go, leaving the glyph, the badge and the dot, and the search falls back to a 10rem basis. Below 1000px the grid is one column, the rail stacks above the bar and the search takes its own row. The search grows from 14rem to 30rem with the room and never below 10rem, and the row can never push the document sideways. The chip and the drawer words go at 1300px rather than 1240px, because with them shown at 1280px the bar overflows by 1px. On the page the bar demonstration sits in a column 236px narrower than the window, so it takes the wrapping shape at or below 1240px. In print the controls go and the title stays as the heading of the record.

#### Universal search, with results open

**What it does.** The field filters the screen's list as the reader types and offers results beneath it. It finds patients by name in either order or by identifier, and emergency departments, wards, owners, and the tools and views of the bar. Wards and departments come from the engine's own names, so a ward hit narrows the queue to movements whose route names that ward.

**Results.** `.qPop`, 36rem wide under the field, one open at a time with the pop outs. Groups in order: Patients, up to six, Emergency departments, Wards, up to five, Owners, Tools and views. Each `.qHit` has the name in semibold, a mono detail at the right, and for a person an under line with the department and the deadline state, red when passed, and Outside South Metropolitan when the person is outside the chosen service. The first result carries `data-active`, the sunk fill and the slate ring, because it is what Enter picks.

**Picking.** A person selects their row, scrolls to it, clears the search and, if they are outside the chosen service, sets the service back to all, and says all of that in one sentence. A department, ward or owner becomes the search text. A tool or view opens it. Enter picks the first result. Down moves into the list.

**Refusals.** Risk, acuity, score, scores and best match, and closed, arrived and discharged, each return a sentence in the popover and in the filter bar, and nothing else. The sentences are fixed in section 8.6. The footer always says names are invented and search never returns a risk score, an acuity score or a best match.

#### The Service selector

**The choice.** All services by default, or North Metropolitan, East Metropolitan, South Metropolitan or WA Country. The summary carries a 7px dot in the service hue, hidden for all services, the short name, and the waiting count in mono. A hidden Service: prefix gives a reader the value in the control's name.

**Scopes.** The queue, the pressure strip, the exceptions, the referrals, the tasks and the notices, the activity feed and the sentence, the live tally, every count and line in the rail, the contact tables in Tools, and the reconciliation line. The filter bar says in South Metropolitan. The rail shows the service stripe under its brand. The Statewide flow is not scoped: it keeps the whole network and its foot says Showing the whole network. The queue is scoped to South Metropolitan.

**Panel.** The head Service, scopes the queue and the strip. Five `.menuItem` rows with the dot, the full name and n waiting or none waiting. The chosen row carries the accent-soft fill, the slate ring and the brass bar. A note that one service or all four, and that the choice follows the coordinator to every screen with a service in it.

**Absence and Escape.** WA Country has no department with a movement open and no site drawn, so every list says so in a sentence that says what the absence means. Escape clears the service last, after everything else. Narrowing to one department inside the same control is designed for and not built, and must not become a second control.

#### The Activity drawer, what is going on

**Shape.** A drawer from the right edge, `.drawerMenu.wide .menuPanel`: fixed, top to bottom, `min(94vw, 36rem)` wide, a heavier hairline on its left, the one lift, and the page shaded behind it with the scrim. The head is a strip on the second surface tone and sticky: the title in the display serif, the service name in mono, a Close control, and the freshness line on its own row with the breathing dot.

**Two parts.** A segment switches between Activity with the event count and Live tally with the screen's name. The chosen part sits on the surface with a hairline ring and the brass underline, and no second lift. The choice is kept while the page lives.

**What is going on.** One paragraph derived from the data, figures in mono, the breach count in red. Then Last events: up to fourteen of today's events, newest first, each with a mono time, a tone dot and a sentence. Red is a deadline passed, amber a decline, green a bed pulled or an acceptance, neutral everything else. Events are derived where they can be and recorded events are added.

**Empty and foot.** No event today in WA Country. The sentence for an empty service says nothing is open there, that no department there has a movement open and no site is drawn, and that absence here means none, not that nothing exists. The foot says events are invented, newest first, and that the live product would stream them and say when the stream last spoke.

#### The live tally

**Where the figures went.** The five figures and the clock that crowded the masthead are the four tiles and the facts of this part, counted from the same data. They are read a few times a shift and the queue is read all shift, so the queue gets the height.

**Tiles.** The screen's four core figures, mono at t-5 on the second surface tone with a hairline, never lifted. Red only on a breach above zero, amber on at most two. A zero reads none in italics with no pill.

**Groups.** Stacked in one column with a hairline between: for Command the facts now, by emergency department, by health service, by tier and beds by site, each a `.dataTable` whose cells read none in italics and whose totals row is a different kind of row. The foot carries the reconciliation line, Reconciled at 10:42, and Every figure is invented.

**Other screens.** Pressing another screen in the rail switches the tally to that screen's figures and announces it: Capacity. The live tally now carries its figures. Its table for an empty service reads none in WA Country as its one cell.

#### The Tasks drawer

**Shape.** A drawer 28rem wide. The head: Tasks, then 19 outstanding, 8 kinds in mono, and Close. The notices first, each with a Seen control, then every piece of open work worst first, each one a filter on the queue. The button's badge is the outstanding count.

**Notices.** Something that changed: a bed pulled, an override recorded, a legal deadline passed within the last hour. Each row: the time in mono, the sentence with the identifier in mono, and Seen while it is new. A new row carries the accent-soft fill without the ring, because it is not a selection. Marking one seen re-renders the drawer and the dot at once. The engine's data carries no time for a bed pulled, so that kind is shown in the standard and not derived on Command until the data records it.

**Work open.** Eight rows in this order and no other: legal deadlines passed, red. Due within 2 hours, amber. With no owner, amber. Declines to answer. Accepted, no bed pulled. Referrals to triage, which opens Referrals. Overrides to review, which names Governance. Handover sheet due 14:00, which names Tools. Each carries the count in mono with a tone dot, the words, and a hint. A row whose count is none is not shown.

**A filter row.** Carries `aria-pressed`, filters the queue, closes the drawer, scrolls the queue to its top and announces Showing 3 due within 2 hours in the queue. Pressed, it takes the accent-soft fill, the slate ring and the brass bar, and keeps its dot. Pressing it again clears the filter. The filter bar above the queue states the filter in words. Show in queue closes the drawer and focuses the queue.

#### The Tools drawer

**What it holds.** Everything a coordinator reaches for that is not the queue, in a drawer 36rem wide. Who: Bed coordinator and the shift line, a role and never a name. Do: three `.toolItem` rows with a glyph, the action, a sentence under it and a mono hint. Print handover sheet prints. Export the queue is not wired and says so. Raise a referral opens the New referral menu.

**Contacts.** A table of the wards drawn in the chosen service, the ward with its site under it, the extension and the address, and the same for the departments from ext 11. A note above and the foot below both say the extensions and addresses are placeholders in the shape the live product would show, that none is real, and that the live product reads the site directory and says when it last did. The placeholders are ext 01 and addresses ending in example.invalid, never a real looking number.

**Appearance and the rest.** Light, dark, automatic, remembered for this browser only, the whole page following at once. The design system, a link to this standard. Sign out, disabled with the reason in its tooltip, and it does not light on hover. On Command the appearance control lives here and nowhere else, so the harness opens Tools before it probes the first click.

#### New referral

**What it is.** The one accent-filled control on every screen. It opens a small menu, not a drawer, because the first decision is the source: from an emergency department, ED. From a community team, CMHT. From a GP or private practice, GP. A note says the Raise a referral screen opens with the source prefilled.

**Rule.** One primary action per screen. When a screen's own primary action is not New referral, the screens index in section 14 says what it is, and New referral stays in the bar as a secondary control on that screen. The flow behind it is screen 12, reached only from this control and from Tools, and is not a rail item. Choosing a source announces: Raise a referral would open, prefilled from a community team. Not wired in this prototype.

#### The primary and secondary control states

**Primary.** The accent fill, on-accent text, and the highlight along its top edge, `inset 0 1px 0 var(--hl-on-accent)`. Hover, press and open all go to accent-ink. It never brightens, in either theme.

**Secondary.** The surface, a 1px line-strong border, the 6px radius, ink text. Hover and press sink the fill to the well with an ink-soft border. Open takes the accent-soft fill, the accent border, accent-ink text and the slate ring, because open is a selection, and the badge inside it takes the same fill and ring.

**Focus.** Every summary takes the page's focus-visible ring, 2px of the accent 2px out. The search field draws it on focus-within. No control on the bar was found without one.

### 6.3 Panel, header, note and stated absence

**Shape.** `section.panel` with an aria-label, a `.ph` header holding the heading, an optional `.note`, a `.count` pushed right and, where the panel has a disclosure, a `.phBtn`. Bodies use `.pb`, and an empty state is a `.none` sentence.

**Rules.** The header is surface-2 with inner corners one pixel tighter than the panel. The count is mono and derived. The disclosure control is uppercase like the count, with a chevron that turns, and it announces what it did. An empty body says why it is empty and what the emptiness means.

### 6.4 Chips, tags, pills and bed chips

**Shape.** `.chip` for a fact, `.chip.mark` for the prototype mark, `.tag` for a rail count, `.tier[data-t]` for a tier, `.peer` for another patient on the same ward, `.bedChip[data-state]` for a bed.

**Rules.** Every chip carries a word. The tier pill's colour repeats its number. A bed chip's ring repeats its state word, and the figure is the bed number in mono. The prototype chip is neutral because gilt is not decoration.

### 6.5 Tabs with counts

**Shape.** `.tabbar[role=tablist]` of `.tabBtn[role=tab]`, each with `aria-selected`, `aria-controls` and a roving `tabindex`, and a `.tabNum` count. A zero count reads none in italic with no ring.

**States.** Rest in muted on surface-2. Hover in ink on surface. Selected in ink on surface with the brass bar beneath, and the count on accent-soft with a slate ring. A count at rest is mono on the well with a hairline ring. Arrow keys move between tabs.

**Rules.** Two queues in one column are tabs, not stacked panels, so a locked column keeps one scroll region. The gap in the strip is reduced by the label's tracking.

### 6.6 Pressure card

**Shape.** `ul.edList` of buttons `.edCard[data-p=high|med|low][aria-pressed]`: the code with the service in an `em`, two `.edStat` lines, an `.edBar` meter and a last line that is either `.edBreach` or a quiet stat.

**Rules.** Status is a bar along the top, never a fill. The meter is the longest wait against the longest in the network and its colour repeats the card's pressure word, so a quiet department never carries a red bar. A pressed card keeps its top bar and gains the accent ring on the other three sides, so selection never hides status. Ordered worst first. The strip scrolls sideways with the shade and the sentence when it overflows.

### 6.7 Queue row and filter bar

**Shape.** `div.qList`, a tab panel, of buttons `.qRow[aria-pressed]` each in its own block: a `.qTop` line with the mono `.qId`, the `.tier`, the `.qWait` pushed right and, when there is one, a `.qFlag` that always takes its own line beneath. Then a `.qRoute` in words and a `.qMeta` line. A `.filterBar` above the list states the filter and offers Show all as a link button.

**States.** Rest on surface, hover and pressed on the well, selected on accent-soft with the gilt bar at the left, focus ring inset. Escape clears a ward selection, then a queue selection, then the filter.

**Rules.** Where this person is and where they are pointed is written with the words from and to, never an arrow. A missing destination is stated. The wait is mono. The identifier is WF-0xx on Command, WF-1xx on Movement, WF-2xx on Capacity, RF-0xx for referrals.

### 6.8 Candidate row and verdict

**Shape.** `ul.candList` of buttons `.cand[data-av]` with `data-showing` for the one whose checks are open and `aria-pressed` for the one chosen: a `.candTop` with the name and the service in its hue, a mono `.candBeds` line, a `.verdict` whose bold word is the verdict and whose span is the reason, and optional `.cont` continuity lines.

**Rules.** The left bar repeats the verdict word: green eligible, amber declined or overridable, grey on the second surface tone for no bed or no specialling. Showing is an accent ring with the bar kept. Chosen is good-soft. A verdict about a ward is fine. A verdict about a person is never drawn.

### 6.9 Eligibility gates

**Shape.** `ul.gates` of `.gate[data-pass][data-overridden]`: a `.gMark` holding a stroked tick or cross, the `.gLabel`, the uppercase `.gVerdict` pushed right, and the `.gDetail` sentence across the full width.

**Rules.** The fill repeats the verdict: well for pass, danger-soft for fail, warn-soft for overridden. The mark repeats it again. The detail says whether the check is a fact about the world or a judgement about the patient, because only the second is overridable, and the split fails closed.

### 6.10 Register rows

**Shape.** `ul.rows` of `.row[data-tone=danger|warn|coord]`: a `.rowTop` with the bold title and the mono `.when` pushed right, a `.rowSub` sentence, an optional italic `.reasonQ` quote, and a `.rowWho` line saying who.

**Rules.** The left bar repeats the title's tone. The coordinator's own records carry the gilt bar because they are the reader's own actions. A quoted reason is in typographic quotes. Every row says who did it, and a refusal by the system says so.

### 6.11 Destination, stepper and facts

**Shape.** `.destBadge[data-k=accepted|referred|suggested|none]` as one sentence. `.stepper` with role img of seven `.step` bars, one per stage (placement requested, destination review, accepted awaiting bed, bed pulled, handover ready, moving, arrived), with `data-s` done, now or todo and an aria-label, then a `.stageLine` naming the stage in words. `dl.slFacts` with uppercase labels and plain values.

**Rules.** The badge's colour repeats its first word: green accepted, accent suggested, well for none. The current step is gilt and the done steps accent, and the stage is named beside the bars so the bars are never the only carrier. A legal status that constrains the movement is red because it is a breach risk, and it is a word.

### 6.12 Shortlist head and section heading

**Shape.** `.slHead` holding a `.slTop` line with the t-5 mono `.slId` in accent-ink, the `.tier`, and the `.qWait` pushed right, then the `.stepper` and its `.stageLine` from 6.11. Below it, each `.sec` has a top hairline and an uppercase `h3.secH` with an optional mono `.count`, then a `.ctlRow`, a `.candList`, a `.gates` list or notes. Above the head, the panel's own `.ph` strip carries the title, the identifier as its count and the Pin control, `button.pinBtn[data-pin-toggle]`, a quiet uppercase pill like the legend's control that takes the accent-soft fill and the slate ring while the subject is pinned.

**Rules.** The identifier is the one figure on the page set at t-5 outside the live tally, because it is the subject of the whole column. A section heading is a label with a derived count, never a control. The first section under the head has no top hairline, so the head's own bottom hairline is the only line.

### 6.13 Controls, including one that says why

**Shape.** `.ctlRow` of `button.ctl`, with `.primary` for the one action the screen is for, `.danger` for a recorded refusal or decline, and `aria-disabled` rather than the disabled attribute so the reason stays reachable.

**States.** Rest: surface with a line-strong border. Hover: the well with an ink-soft border. Pressed: the same, so a click has a felt end point. Focus: the accent ring, two pixels out. Primary: accent with the one pixel inner highlight in hl-on-accent, and accent-ink on hover and press. Nothing brightens on hover. Disabled: half opacity, a not-allowed cursor, no change on hover or press, and a reason in the title and in a described-by line.

**Rules.** One primary per panel at most. A control names what will happen. The danger control is a colour on the text only, never a red fill, because a red fill is a breach.

### 6.14 Diagram foot, legend and node conventions

The nodes below are a schematic drawn by hand at the renderer's sizes, not the renderer's output: names in the renderer's t-wn class at 11.5px, captions in t-wc at 10.5px, service names in t-svc at 10.5px, and contention badges in t-cont at 10.5px mono. The reference build draws its map from the data with those classes, and nothing on it is set below 10.5px.

**Nodes.** A 6px body with a name, the service in its hue, a mono figure and the verdict word. Only an eligible or a recorded ward carries a fill. The origin department is an accent outline on accent-soft with an ORIGIN mark and a pressure bar along its left edge. Already declined is a dotted (2 3) amber outline and the word. Needs a recorded reason is a dashed (5 4) amber outline and the word, the same amber the candidate list gives that verdict, because red on the map means a breach and nothing else. Not routed is a plain hairline outline and the word. The route lines repeat the same colours, the origin's line is ink-soft, and a recorded destination's line is green. Hover thickens the outline and changes no colour. Focus is a 2.5px stroke in the ink, drawn solid. A literal white in an SVG is never used because it is unreadable on the dark accent.

**Foot and legend.** `.diagFoot` holds the sideways-scroll sentence (hidden when the diagram fits) and the schematic note. `.legend` continues the same band below it as a disclosure, its titles and swatches flowing as one wrapping line so it costs three lines of height, not six.

**Geometry.** The diagram's width is stated in its own constants and kept under the centre column at 1920px, so the scroll affordance is a measurement, never a default.

### 6.15 Table

**Shape.** `.tableWrap` scrolling sideways on its own, holding a `.dataTable`. Numeric cells and their headers take `.n`. A zero is the word none in `.zero`. The totals row is `tr.total`.

**Rules.** No zebra striping. The wrapper scrolls, never the page. Numeric cells are right aligned in mono so they line up. The totals row is a different kind of row, with a heavier rule above and the header's band behind it, not the last row of the same kind. Hover shows the well on the body rows only.

### 6.16 Figure band and delta

**Shape.** `dl.band` of `.kpi` tiles, each a label, a t-6 mono figure and an optional `.delta` line.

**Rules.** One strip divided by hairlines. No cards, no coloured caps, no icons. Red on a breach above zero only. Amber means look here and appears on at most two tiles per screen, and the tile's label already says why. A delta is the word up, down or no change with a figure. It is never an arrow alone and never a verdict such as better or worse, because more admissions are not good and fewer are not bad.

### 6.17 Chart

**Shape.** `figure.chart` holding an SVG with `role="img"` and an aria-label that states the numbers, and a `figcaption` that states them again in a sentence.

**Rules.** Lines and arcs only, on a hairline grid with one axis rule, one emphasised endpoint and labels in mono muted. No area fills, no gradients, no pies, no three dimensions. At most three charts on a page. Numbers come forward and charts step back: the figure is in the band and the chart shows its shape. Chart text takes its colour from the tokens so it reads in both themes.

### 6.18 Disclosure and the ward switcher

**Shape.** `details.reveal` with a `summary` carrying the words and an optional mono `.count`, and a `.revealBody`. The ward switcher is the same element with a search, groups and counts inside.

**Rules.** The summary uses the same chevron as the panel-header control. Every disclosure is opened before print and closed again after, by the page. A disclosure hides detail, never the answer: the count on the summary says what is inside.

### 6.19 Skip link, live region, reconciliation line and appearance

**Skip link.** The first focusable thing on the page, parked above the viewport and shown on focus, pointing at the region a keyboard reader wants first.

**Live region.** One polite, atomic region before the bar. Every change of subject is written to it as a sentence, and a repeated sentence gets a zero-width space so it is read again.

**Reconciliation.** The page counts its own figures on every load and says whether they reconcile: a green dot and a sentence when they do, a red dot and a count when they do not. This page does it for its contrast pairs, in the rail.

**Appearance.** Light, dark and auto. Auto stamps nothing and follows the machine. The choice is remembered for this browser only under a key named for the page, and a browser that refuses storage still gets the page. On Command the control lives in the Tools drawer, section 6.2, and the whole page follows at once. The standard's page keeps its own in the rail foot because it has no bar.

## 7. Behaviour

_Measured, spoken, remembered._

### 7.1 The four states, and the two others

| State    | Looks like                                                                                                                                              | Rule                                                                                                                                                |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rest     | Surface, hairline, ink-soft text.                                                                                                                       | Every control draws it explicitly.                                                                                                                  |
| Hover    | The well, and an ink-soft border on a control. On the map a thicker outline.                                                                            | Hover never recolours a status, never lifts, never brightens, and never appears on a disabled control.                                              |
| Pressed  | The well with an ink-soft border on a control, the same as hover, so a click has a felt end point. The well on a row or card while the pointer is down. | Distinct from selected.                                                                                                                             |
| Focus    | A 2px accent outline, 2px out on controls and 2px in on rows, tabs, cards and lists. A 2.5px stroke in the ink on a map node.                           | Only on focus-visible, so a pointer click does not draw it. Every focusable thing has a scroll margin of 12px so it is never hidden under a header. |
| Selected | Accent-soft fill, accent-ink text, and the gilt bar on rows and tabs, or the accent ring on cards.                                                      | Selection never hides status: a card keeps its top bar and gains the ring on the other three sides. Announced.                                      |
| Chosen   | Good-soft fill on the candidate that is now the destination.                                                                                            | Distinct from showing, which is the slate ring. A candidate can be showing without being chosen, and the status bar survives both.                  |
| Disabled | Half opacity, not-allowed cursor, no shadow, and nothing changes on hover or press.                                                                     | Uses aria-disabled so it stays focusable and the reason stays reachable, in the title and in a line beside it.                                      |

### 7.2 Measured affordances

- **List fades** are set from scrollHeight, clientHeight and scrollTop on every render, on scroll of the region and on resize. A fade is never declared in CSS alone.
- **Sideways overflow** is set from scrollWidth against clientWidth on every render and resize. The shade and the sentence appear together and disappear together.
- **The legend's default** comes from one media query stated once in the script, min-width 1600 and min-height 1100, evaluated on first render. Once the reader has toggled it, their choice holds for the session.
- **Counts** in the rail, on the bar's badge, in the drawers, the tab strip and every panel header are derived from the data, and the reconciliation line compares them. The shell appends its own sum checks to the same check array and never creates it.

### 7.3 Keyboard

- Tab reaches the skip link first, then the rail, then the bar, then each panel in reading order. A drawer gives focus to the first focusable thing inside it when it opens.
- In a tab list the arrow keys move between tabs with a roving tabindex, and Home and End go to the ends.
- Enter and Space activate rows, cards and map nodes, which are buttons.
- The slash key focuses the search and selects its text, from anywhere that is not a field. The left bracket flips the rail between open and closed and remembers the choice, not when a field has focus and not while a modifier is held. Neither key fires inside a field.
- Enter in the search picks the first result, the one drawn with the slate ring. With no result it speaks the refusal or what is shown. Down in the search moves focus into the results, and not when there are none.
- Escape clears one thing per press, from the top: an open pop out, then the search results, then the search text, then the ward selection, then the referral subject, then the department filter, then the task filter, then the service. Each step is announced. The shell owns the order and the engine's own Escape handler steps aside while the shell is present, so one press never clears two things. A search field clears itself on Escape and would fold two steps into one, so the field's own keydown takes the key and walks the order.
- A scrolling region is itself focusable with a tabindex of 0, so its contents can be scrolled from the keyboard.
- There are no number keys. The rail mockup's review views and their keys were a review aid and are not product keys.

### 7.4 Announcements

Every change of subject is one sentence to the live region: a row selected (“WF-014 selected. Shortlist shows three candidates.”), a filter applied (“Showing 4 of 23 waiting, from Joondalup Health Campus ED.”), a filter cleared, a ward chosen on the map, the legend opened or closed, the appearance changed. Never a fragment and never a colour name. A repeated sentence gets a zero width space so it is read again. The shell's own sentences keep this shape, with the figures derived on every render:

- On opening Activity: “Activity opened, in two parts: what is going on, and the live tally for the Command page.” On switching to the tally: “Live tally for the Command page.”
- On opening Tasks: “Tasks opened. 19 outstanding, notices first.” On opening Tools: “Tools opened. Every extension and address in the contact tables is a placeholder.” On closing anything: “Closed.”
- On choosing a service: “Service set to South Metropolitan. Showing 7 of 23.” On clearing it: “Service set to all. Showing 23 of 23.”
- On pressing a task row: “Showing 3 due within 2 hours in the queue.” On pressing it again: “Task filter cleared. Showing 23 of 23.” On marking a notice seen: “Notice marked seen.”
- On a refused search: the refusal sentence in section 8.6. On picking a person: “Kestrel, Wenna, WF-007, selected in the queue. Legal deadline passed 25m ago.” On clearing the search: “Search cleared. Showing 23 of 23.”
- On changing screen: “Capacity. The live tally now carries its figures.” On pressing a pinned row: “WF-007 selected in the queue.” On flipping the rail: “The rail, closed.” On changing appearance: “Appearance set to dark.”
- On Raise a referral, from the menu: “Raise a referral would open, prefilled from a community team. Not wired in this prototype.”

### 7.5 Appearance, the two themes, motion, print, forced colours

- **Appearance** has three states. Auto stamps nothing on the root and follows the machine, and the two explicit choices stamp data-theme. The choice is remembered in this browser under a key named for the page and forgotten when Auto is chosen. The first click from a dark machine switches the page, which is verified by the harness in section 10.
- **Light and dark** are both complete palettes, and dark is designed, not inverted: the well is darker than the panel, the highlight is faint, the shadow is black and heavier, the hairlines are white at low alpha, and the stripe is a mid slate that reads on a dark ground. Every colour is measured against the surface it sits on in both themes.
- **Motion** is a 120ms transition on colour, background, border, the chevron's turn and the outline weight of a map node, and nothing else. No element moves on load. Reduced motion removes every transition and animation.
- **Print** is a record: the rail, the stripe, controls and link buttons go, every scrolling region opens out with its fades removed, every tab pane and disclosure opens, panels lose their shadow, highlight and radius, take a solid rule and avoid breaking, every token takes its light value, and status colours print exact.
- **Forced colours** keep every boundary as a CanvasText border on Canvas with no shadow, every meter, peer dot, done or current step, the rail's brass bar and the stripe become CanvasText, a todo step is an empty box, a legend swatch is a bordered box, and the pressed appearance button is the system highlight, so the page survives a high contrast mode without a special design.

### 7.6 Pop outs and drawers

- **One open at a time.** Every pop out is a `details.menu`: the summary is the control and the panel floats beneath it, or, for a drawer, at the right edge of the window. Opening one closes the others and the search results. Only one thing on the page is ever lifted over it.
- **A click outside closes it**, and so does a click on a drawer's backdrop. The backdrop is the scrim over the whole window, rail included, so the drawer reads as over the page in both themes.
- **Escape closes it and returns focus to its summary.** The first focusable thing inside a drawer takes focus when it opens, so a keyboard reader is never left behind the backdrop. A drawer that traps focus is worse than no drawer.
- **Opening is announced** as a sentence, with the drawer's count in it, and closing is announced as Closed.
- **The pinned fly out** in the closed strip is the same shape, opening to the right and bottom aligned, and follows the same four rules.

### 7.7 The rail's state, remembered

- One nav, two shapes. The state lives on the root as `data-rail="open"` or `"closed"`, stamped by the head script before first paint from the key `ward-flow-rail`, so there is no width jump on load. A browser that refuses storage still gets the page, open.
- The rail's own control at its foot and the bracket key call one function, which re-renders the nav in the other shape, moves focus to the new control, announces The rail, closed or The rail, open, and stores the choice for this browser only.
- The grid column animates over 0.18s and the contents re-render at once. Under reduced motion there is no animation. Below 1000px the rail renders in the open shape as a wrapping row whatever is stored, and the control is hidden.
- No review switcher, no number keys, no side by side view, and no second nav in the tree. A screen reader hears one landmark, Ward Flow sections, and the state when it changes.

## 8. Wording and honesty about data

_The Board language's rules, kept._

### 8.1 Words before colour

- State is a word first. A colour, a bar, a ring or a tint repeats a word already on the screen.
- Direction is a word: from and to, up and down, in and out. Never an arrow, which reads as nothing to a screen reader and as a stray character when a row is copied into a note.
- A delta carries a word and a figure, never only a symbol, and never a verdict such as better or worse.
- Red means a breach and nothing else. Amber means look here and appears on at most two tiles per screen. Green means clear, eligible, accepted or reconciled. A quiet thing carries no colour.

### 8.2 Absence and zero

- Absence is stated, never blank. “Not tracked here”, “No destination yet”, “No deadline recorded”, “No phone number is held” are the models.
- An empty panel says why it is empty and what the emptiness means: “Absence here means every ward asked has answered, not that nobody was asked.”
- Zero reads none, in italic, in the body face. A nought is a measurement and none is a state. In a table the cell reads none. In a tab count the ring goes.

### 8.3 Invented and real

- Every figure is invented and the page says so twice: in the bar, where the prototype mark carries the disclaimer as its tooltip, and in the rail foot. A page with a foot lists them under “Every figure here is invented” and lists what came from the repository under “What is real”.
- Every count is derived from the page's own data on every load, and the page says whether its figures reconcile.
- Hospital sites, health services and community team names are real WA names from the repository's own tables and may be used. Their phone numbers, addresses and contact details are never invented.
- Never invent a record number, a UMRN, a person's name that could be mistaken for real, a phone number or an address. Patient identifiers are WF-0xx on Command, WF-1xx on Movement, WF-2xx on Capacity and RF-0xx for referrals, in mono.
- There are eight emergency departments and Joondalup Health Campus and Peel Health Campus have no inpatient ward in the data. There are twenty-three wards across seventeen sites. A page reads the collection and never carries a hard-coded nine.
- Do not invent a ward or a hospital. A plausible fake WA ward is worse than a repeated real one.

### 8.4 About persons

- No verdict about a person is ever drawn. Verdicts are about wards, beds, checks and movements.
- A referral's written history is never given a green state, because a history is not an outcome.
- Search refuses a risk or acuity score, a best match, and closed or arrived movements, and it says so as a sentence in a refused-action row rather than returning nothing.
- Nobody's move is not nobody's problem. A movement with no owner still carries its severity, and the register leads with what is wrong across the whole network.
- A judgement about the patient is overridable by a named coordinator with a recorded reason. A fact about the world is not. A check nobody has classified is not overridable.

### 8.5 Copy style

- Sentence case everywhere. Uppercase only as a tracked label at t-0 or t-1.
- Australian spelling. Plain clinical language. A control says what will happen. An error says what went wrong and what to do.
- No semicolons, no dashes as punctuation, no arrows, no symbols that a digital record would not carry. A middle dot separates facts on one line, such as a route word after a destination (“to FSH Adult Secure · accepted”) or the fields of a bed count, and never joins two sentences. Where the line is prose a comma serves.
- Times as 10:42 with AWST beside the date. Dates as Sat 15 Aug in a tile and in full in the label read aloud.
- The disclaimer is fixed and travels as the mark's tooltip: “Every figure and name on this screen is invented. Not a medical device and not clinical decision support.” The rail foot says it in words: “Every ward state, movement, referral, clock and figure on this screen is invented. The hospital sites and health services are real WA names.”
- The map's caveat is fixed: “Schematic, not geographic”, and it stays on the page whether or not the legend is open.

### 8.6 Search refusals and the shell's fixed sentences

- Risk, acuity, score, scores and best match are refused with one sentence: “Search does not return a risk or acuity score or a best match. Search by name, identifier, department, ward or owner.”
- Closed, arrived and discharged are refused with another: “Closed and arrived movements are not searchable here. They are in the Movement screen's register.”
- A refusal is shown in the popover and in the filter bar, is spoken to the live region, and nothing is returned. It is never an empty list.
- Nothing found reads: “Nothing matches ‘x’. Search finds patients by name or identifier, movements, departments, wards, owners and tools.”
- The footer of the results is always: “Names are invented. Search never returns a risk score, an acuity score or a best match.”
- While one service is chosen the diagram's foot reads: “Showing the whole network. The queue is scoped to South Metropolitan.” A screen never shows a figure from outside the chosen service without saying so.
- A control that is drawn and not wired says so in its own words: “Not wired in this prototype.” Export the queue, Sign out and the New referral flow all say it.

### 8.7 The data contract

- **Derived, never typed.** Every count, tile, line, tag, sentence and reconciliation line is computed from the page's data on every render. Changing one movement changes everything that mentions it. The engine's data is the single source of truth, and the shell reads it through one facade and owns no data of its own.
- **Reconciled, out loud.** The sums by department, by service and by tier are checked against the total on every render. The rail's dot is green with the sentence when they agree and red with the count of disagreements when they do not. The live tally prints the same line. There is one check array on the page, and the shell appends to it and never creates it.
- **Names.** An uncommon given name and a word for a plant, a bird or a stone, so that none matches a real person: Larkspur, Oona. Kestrel, Wenna. Tallow, Bram. Lists show the family name first and search matches either order.
- **Owners.** A movement's owner is a role, Bed coordinator or Coordinator on call, or null, which reads as no owner and feeds the no owner task, the owners group in search and the exceptions. An absent field is not tracked, and nothing is invented for it.
- **No real numbers.** Never a phone number, an address, a record number or a real seeming name. Contact tables show placeholders in the shape of the real thing, ext 01 onward for wards and ext 11 onward for departments, addresses ending in example.invalid, and say so twice, above the table and in the foot.
- **Identifiers and time.** Movements are WF-0xx, referrals RF-0xx. Times are 24 hour AWST. A wait reads 25h 10m, in the compact form, everywhere on a screen, from one formatter. A deadline reads Legal deadline passed 1h 10m ago, or Deadline in 1h 35m, or No deadline recorded.
- **The service scope applies to everything derived.** The queue, the strip, the drawers, the rail, the contact tables and the reconciliation line follow the choice. The diagram does not, and its foot says so.
- **Notices are derived, not invented.** The kinds shown are the kinds the data can support: an override recorded and a deadline passed within the hour. A bed pulled has no time in the engine's data, so it is recorded here as a kind and not drawn until the data carries it.

## 9. Accessibility floor

_Not negotiable._

- **Text contrast 4.5:1** for every pairing in both themes, computed per pair and printed, never eyeballed. Meaningful non-text marks at 3:1.
- **No colour is the only carrier** of any state. Every state has a word on the screen.
- **Every interactive thing is a button or a link** with an accessible name. Icons are aria-hidden with their word beside them.
- **Tab lists** use tablist, tab and tabpanel roles, aria-selected, aria-controls and a roving tabindex with arrow keys.
- **Toggles** use aria-pressed. Disclosures use aria-expanded and aria-controls. Groups are labelled with aria-labelledby.
- **Focus is visible** on every control, inset inside scrolling regions, and every focusable thing has a scroll margin.
- **A skip link** is the first focusable element, and one polite live region receives every change of subject as a sentence.
- **A disabled control says why**, in its title and in a described-by line, and remains focusable through aria-disabled.
- **Every chart** has role img, an aria-label stating the numbers and a written caption stating them again.
- **Tap targets are 3rem** where the pointer is coarse or the width is a phone's. Never reduced to 44px to satisfy a generic rule.
- **Nothing below 10.5px.** The page holds at 200% zoom without loss and never scrolls sideways.
- **Reduced motion** removes all transitions. **Forced colours** keep every boundary. **Print** opens everything and keeps status colours exact.
- **Both themes** read as well as each other. The dark palette is designed, not inverted, and every token is defined on the bare root before any theme block redefines it.

## 10. Definition of done

_Per mockup, before it is called done._

A mockup is done when every line below is true and has been looked at, once, in a real browser in both themes. The proof is the look and the page's own checks, not a claim.

- The stylesheet in section 15 is copied verbatim. Screen-specific rules sit below it under a comment naming the screen. No raw hex below the block.
- The three fonts load by link with real fallbacks, only loaded weights are asked for, and the display serif appears only on the names of things: the wordmark, the page title, panel titles, site codes and diagram headings.
- Every size is one of the seven steps, in HTML and in SVG. Nothing below 10.5px.
- Every colour has one of the four jobs, brass is a bar and never a fill and marks only where the reader is, red appears only on a breach, and at most two tiles are flagged amber.
- Every state has a word, every absence is stated, every zero reads none, and every direction is a word.
- The bar carries the prototype mark with the disclaimer as its tooltip, the rail foot carries the invented-figures note and the reconciliation line, and every count, tile, line, tag and sentence is derived.
- Every contrast pair the page uses appears in the table in section 3, or has been computed and added there first.
- The shell is the rail in both states, the one row bar with its pop outs, and the panels, at the widths in section 5, and the page never scrolls sideways.
- Lists fade and strips shade by measurement. Every legend is a disclosure with the stated default. Disclosures open for print.
- Every control draws rest, hover, pressed and focus. Every disabled control says why. Selection never hides status.
- Every change of subject is announced. Escape clears the innermost thing. The skip link is first. Tab lists take arrow keys.
- The appearance control has three states and is remembered under a key named for the page.
- Tables use the table contract, bands use the band contract, charts number at most three and each has a label and a caption.
- Identifiers use the page's namespace. No phone number, address, record number or real-seeming name is invented. Real WA names are the repository's.
- No verdict about a person. A referral's history is never green. Search refuses what section 8 says it refuses.
- The bar has no overflow at 1920, 1600, 1440, 1280 and 1100 wide, and the search never falls below 10rem. The rail has no sideways overflow in either state, no state line is truncated at 236px, and every word in the closed strip fits at the 10.5px floor.
- Every pop out opens one at a time, closes on a click outside, on its backdrop and on Escape, and returns focus to its summary. Escape clears in the stated order and each step is announced. The slash key reaches the search and the bracket key flips the rail, and neither fires inside a field. The rail's state survives a reload.
- Search refuses a score, a best match and a closed movement with the sentences in section 8.6. A notice marked seen updates the drawer and the dot at once. Choosing a service re-derives every count, line, tile, sentence, table and the reconciliation line, and WA Country states its absences.
- Every tap target is at least 3rem at a coarse pointer. Reduced motion removes every transition and the breathing dot. Forced colours give every panel, control, card and dot a CanvasText edge or fill. Print hides the bar's controls, the drawers and the rail's controls, and keeps the title, the lists and the figures as a record.
- The page has been rendered once at 1600 and at 1200 in light and in dark, the console is clean, and the reconciliation line reads green.
- A copy of the page is committed to the repository's mockup folder, formatted, and the artifact is republished at its existing URL with a version label.
- The harness has been run and its output pasted into the report. `third-edition-kit/check.mjs` proves in one run, in both themes: the three fonts load, no weight is asked for that is not loaded, the console is clean, the page's own reconcile check is empty, the page has no sideways overflow at 1920, 1440, 1280, 1200 and 390 wide, nothing is set below 10.5px in HTML or SVG, every visible text element reaches 4.5:1 against the fill it sits on (3:1 for large text), the diagram region is at least 260px tall at 1440 by 900, the appearance control's first click from a dark machine switches the page to light, opening the Tools drawer first on a page whose control lives there, and the third Tab stop shows a focus ring. On a page without a diagram or a reconcile hook the harness reports those lines as not applicable rather than failing. Three lines of this list the harness does not yet gate and are checked by a probe or by hand until it does: the rendered text carries no em dash, no semicolon as punctuation and no arrow, every control at a true 390px layout is at least 48px tall, and in print the ink and hairline tokens take their light values. The standard itself is also proved by `third-edition-kit/check-standard.mjs`, run from the kit directory because it resolves its font fixtures from the working directory, which adds the contrast table's own recomputation, the rail targets and the demonstrations' containment.
- A claim without its output is not a pass. A line that says green without the harness line that printed it is not done.

## 11. Applying it to a new mockup

_The recipe, then the never list._

A new mockup is built by copying, not by re-deriving. Every step below points at something that already exists in the reference build or in section 15, and a mockup that needs a value none of them has reports the gap rather than inventing one.

1. **The head.** Copy the head of the Command third edition: the title tag first, the two preconnect links and the one font link in section 15.1, which loads Source Serif 4 at 600 and 700, Source Sans 3 at 400 to 700 and JetBrains Mono at 400 to 600, and nothing else. Every face is declared with a real fallback stack.
2. **The tokens.** Copy the three roots in section 15.2 verbatim: the bare root with the complete light palette, the dark palette under the machine's preference guarded against an explicit light choice, and the dark palette again under the page's own control. Keep the print block that gives every token its light value on all three roots. Do not add a token, and do not give a colour its only definition inside a theme block.
3. **The stylesheet.** Copy the whole stylesheet from the reference build, unchanged, and below it add only the rules the screen needs, under a comment naming the screen. A rule the screen needs and the stylesheet lacks is added to the stylesheet here first, token only, and every carrier is re-cut. A copy is never hand-patched.
4. **The theme script.** Copy the appearance script in section 15.5, replace the page name in the storage key, and place it after the markup. Then copy the measurement helpers in section 15.6 that the page uses: announcements, list fades, the strip's sideways affordance, the legend default, Escape and disclosures for print.
5. **The page skeleton.** Keep the shell in section 5.6: a skip link, the one rail in its two states with the wordmark, the shift block, the grouped links with their state lines, the pinned rows and its foot, the one row bar of section 6.2 with its search, Service selector, three drawers and one primary action, one polite live region, and a scrolling region of panels. The page's language is en-AU, set on the root by the head script in section 15.1. Mark the current rail link with aria-current. Every region is a panel with a header strip, and its body is one of five things: a list of rows, a strip of cards, a diagram with a foot and a legend, tabs, or sections with headings. Those five bodies cover every screen so far.
6. **Map data to primitives.** A thing with a status gets a card or a row with a bar. A thing with a count gets a pill. A category gets a tier pill. A sequence gets the stepper with its stage sentence. A label and value pair gets the facts list. An action gets a control, and there is one primary per panel at most. Before adding a colour, name its meaning in one word. If the word is not breach, look here, clear, a health service, the brand or you are here, the colour is wrong.
7. **State absences and derive counts.** Every empty list gets a sentence that says why. Every zero reads none. Every count in the rail, on the bar, in the drawers, the tab strip and every panel header is derived from the page's data, and the reconciliation line compares them.
8. **Write the copy as a coordinator reads it.** Plain sentences, the site code first, the figure in mono, the words from and to, the rules in section 8.
9. **Prove it.** Run the harness in section 10 in both themes and paste its output into the report. Then work through the definition of done line by line.

### Never

- A second shadow inside a panel. A shadow on a button, a chip, a card or a row.
- A brass fill. A status colour on a title, a border, a tab or a button that is not itself a status action.
- A hex value in a component. A new grey. A solid grey used as a line.
- Small capitals. A weight that is not loaded. A size that is not on the scale.
- A panel without a header strip. A header strip with controls in it beyond one small disclosure.
- A layout that hides a count behind an unopened tab.
- A fixed second navigation bar, a second rail in the tree, or a second scope control. One rail, one bar, one stripe, one composer.
- A selected state that covers a status bar. A hover that brightens.
- An arrow, a dash as punctuation, a symbol a digital record would not carry.
- A verdict about a person. An invented phone number, address, record number or real-seeming name.

Decide with one question. Does this element tell a coordinator something they would otherwise have to work out? If yes, it earns its place and takes the primitive that already exists for that kind of fact. If no, it comes off the page.

## 12. Departures

_From the Board language, and from both earlier editions._

The Board language of 3 September governed every Ward Flow surface. This standard keeps its five rules and its data rules whole and changes the visual layer. Each change is listed with its reason so a reader of the older document can see what moved.

### Departures from the Board language

| Board language                               | This standard                                                             | Why                                                                                                                                                                         |
| -------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Archivo for everything structural            | Source Sans 3 for everything read, Source Serif 4 for the names of things | Source Sans 3 holds its shape at the 10.5px floor. A serif on the names of things, and never in running text, names the page without decorating it.                         |
| JetBrains Mono for figures                   | JetBrains Mono, kept                                                      | The second edition moved to Plex Mono to share a family with its text face. The third edition returns to JetBrains Mono, whose figures stay open and distinct at the floor. |
| Inter on the fourth-edition statistics pages | Source Sans 3                                                             | One text face across the project.                                                                                                                                           |
| Accent mid blue                              | Deep slate, 8.8:1 on surface                                              | Deep enough to carry text as well as fills, it reads as institutional rather than as a link colour, and it belongs to the cool platinum neutrals around it.                 |
| Active state marked with the accent          | Brass for you are here, as a bar and never a fill, accent for interactive | Selected and interactive never share a hue, so a reader can tell where they are from what they can press.                                                                   |
| Arrows in the path column                    | The words from and to                                                     | A word survives a screen reader, a printout and a copy into a note.                                                                                                         |
| Amber on a flagged totals tile               | Amber for look here, at most two tiles, red only on a breach above zero   | The Board's limit of two is kept. Red is reserved so that it can only ever mean one thing.                                                                                  |
| Flat panels with borders, one radius         | One elevation step under a fall of light, radii stepping inward           | A single lift separates panels from the ground. Everything inside stays flat so the hierarchy has two levels, not five.                                                     |
| Tap target token 3rem                        | 3rem at coarse pointers and phone widths, stated in the stylesheet        | Kept, and made explicit so nobody lowers it to 44px.                                                                                                                        |
| Design language block copied by edition      | One block, this one, copied verbatim                                      | Two editions drifted apart within days. One block, one source, every carrier re-cut from it.                                                                                |

Kept without change: tokens only and no raw hex below the block, state worded as well as coloured, contrast computed at 4.5:1, figures tabular and mono, absence stated, zero reads none, the invented and real foot, real WA names allowed and contact details never invented, eight departments and twenty-three wards read from the collection, no zebra, the wrapper scrolls, the totals row is a different kind of row, charts captioned and at most three, disclosures open in print, the ward switcher's shape, and the three-state theme pattern.

### Departures from the first and second editions

The third edition is a merge, so a reader of either earlier edition will find something moved. The first edition, Platinum Raised Cool, gave this edition its identity and material and lost the things the second edition had fixed. The second edition, the Live edition standard, gave this edition its content, behaviour and rigour and lost its identity.

| Edition          | Before                                                                                        | This edition                                                                                                  | Why                                                                                                                                                                                                                                                                                   |
| ---------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| First            | Labels down to 8px                                                                            | The 10.5px floor and the seven step scale                                                                     | An 8px label fails the accessibility floor and cannot be read on a ward laptop. Every size is now one of seven steps, so nothing drifts below the floor by accident.                                                                                                                  |
| First            | A seven label stepper                                                                         | One bar of steps with a stage sentence beside it                                                              | Seven labels under seven bars forced 8px type and broke words. One bar and a sentence say the stage in words, so the bars are never the only carrier.                                                                                                                                 |
| First            | A pink fill on every ward that needs a reason                                                 | Only an eligible or a recorded ward carries a fill, every other verdict is an outline and a word              | A map covered in fills reads as a map covered in alarms. A fill now means a place the movement can go or has gone, and the rest is a word.                                                                                                                                            |
| First            | A plain light and dark toggle                                                                 | Light, Dark and Auto, remembered for this browser                                                             | A toggle cannot say follow the machine. Three states can, and the choice is remembered under a key named for the page and forgotten when Auto is chosen.                                                                                                                              |
| First            | The copper token                                                                              | The gilt token, and the colour is called brass                                                                | The second edition's stylesheet and scripts read gilt, and a rename would touch every carrier for no gain. The value is the first edition's brass in both themes.                                                                                                                     |
| First            | No figures in the masthead                                                                    | A statistics strip of figures counted from the data on every load                                             | The state of the network is the first thing a coordinator wants, and a figure the page derives is a figure the page can reconcile.                                                                                                                                                    |
| First            | No route words on a queue row                                                                 | Where the person is and where they are pointed, written with from and to                                      | A row that names the origin and the destination is readable without the shortlist open, and a word survives a screen reader and a printout.                                                                                                                                           |
| Second           | Newsreader, IBM Plex Sans and IBM Plex Mono                                                   | Source Serif 4, Source Sans 3 and JetBrains Mono                                                              | The first edition's pairing is the identity. Source Sans 3 holds its shape at the floor, JetBrains Mono keeps its figures open at 10.5px, and Source Serif 4 names things without decorating them.                                                                                    |
| Second           | Prussian blue accent                                                                          | Deep slate, 8.8:1 on surface                                                                                  | Slate carries text and fills as well as the blue did and reads as institutional rather than as a link colour, and it belongs to the cool platinum neutrals around it.                                                                                                                 |
| Second           | A near white ground                                                                           | The platinum gradient with a fall of light                                                                    | A near white ground under white panels gave faint separation and no tonal structure. A ground that is lighter at the top than the bottom gives the page a top and a bottom.                                                                                                           |
| Second           | Solid grey hairlines                                                                          | Alpha hairlines                                                                                               | One alpha value is the right darkness over a white row, a toned strip and a sunk well alike, where a solid grey is right on one fill and wrong on the others.                                                                                                                         |
| Second           | Flat white panels                                                                             | One lifted panel with an inset highlight and a heavier bottom hairline                                        | The single elevation step is kept, and the highlight and the heavier bottom line make it read as a lift rather than a border.                                                                                                                                                         |
| Second           | Gilt fills behind text                                                                        | Gilt bars, and an outline plus text in gilt where a fill was used                                             | Brass is a bar and never a fill. A wash of brass behind text reads as a highlight and competes with the status washes.                                                                                                                                                                |
| Second           | Header strips on the surface                                                                  | Surface-2 strips with an inner radius                                                                         | A strip a tone cooler than the body gives a panel a top and a bottom, and the inner radius keeps the strip inside the panel's edge.                                                                                                                                                   |
| Second           | Panel radius 10px                                                                             | 10px, kept, with 9px inside                                                                                   | The first edition's 9px and 8px were a shade tighter. The second edition's 10px is kept because its whole stylesheet is built on it, and the inner radius follows one pixel behind.                                                                                                   |
| Second           | Gap 14px                                                                                      | 14px, kept                                                                                                    | The first edition's 12px gap was measured against a 214px rail. The second edition's layout, with its 236px rail and three locked columns, is the layout kept, so its gap is kept with it.                                                                                            |
| Second           | WACHS in a rust mixed for the Prussian blue palette, and in the first edition the brand slate | WACHS given rust, re-mixed for the platinum neutrals                                                          | The first edition gave WACHS the brand slate, which East Metro already owns, so two services shared a hue. The second edition's rust is kept in kind and re-mixed for the cool neutrals, so the four services stay apart at a glance.                                                 |
| Second           | One serif, used twice on a page and never a third time                                        | The serif on the names of things: the wordmark, the page title, panel titles, site codes and diagram headings | The first edition's serif carries the identity, and a name is where an identity face belongs. Two uses a page could not cover the panel titles, which the material rules put in the serif.                                                                                            |
| Second           | The candidate demonstration showed FSH Adult Secure, South Metro                              | BTY Adult Secure, East Metro                                                                                  | The demonstration now mirrors the reference build's showing candidate for WF-014.                                                                                                                                                                                                     |
| Third, first cut | warn #886211, svc-north #6F5F9E, svc-south #3F7A80 in the light theme                         | warn #825D10, svc-north #685A94, svc-south #356A70                                                            | The round one review measured the three below the floor on a showing candidate's accent-soft wash (3.9 to 4.4:1) and the teal on the hover well (4.3:1). Each is darkened the least that clears 4.5:1 on every fill it sits on. The dark values were already clear and are unchanged. |

### Departures from the Live edition shell

The Live edition's Command carried a three row header, a masthead with a figures strip and a clock, and a rail that could not close. The owner's universal header and rail replace them. Each change is listed with its reason, from the rail's own notes on what was added and why, and from the restyle that brought the shell onto this edition.

| Live edition shell                                                     | This edition                                                                                                          | Why                                                                                                                                                                                                              |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A three row header: title row, statistics strip, outstanding tasks bar | One row: the title and the mark, search, the Service selector, Activity, Tasks and Tools as drawers, and New referral | The figures are read a few times a shift and the queue is read all shift, so the queue gets the height. Nothing a coordinator reads is lost: the figures are the live tally and the tasks are the Tasks drawer.  |
| The masthead figures and the clock                                     | The four tiles and the facts of the Activity drawer's live tally, and the date and time in the rail's shift block     | The tally is counted from the same data and reconciled by the same line. The shift block says how much shift is left, which is what the coordinator is planning against, and still says the date.                |
| Two bare counts on the rail                                            | Text under the screens: a count says how many, a line says what kind                                                  | Together the rail reads as an instrument, not a list.                                                                                                                                                            |
| A count that could carry a colour                                      | Tone as a dot beside the glyph, never on the count                                                                    | Red is a breach and nothing else, amber is look here, and nothing else in the rail is coloured, so those two are seen. A red 23 can never be read as 23 breaches.                                                |
| Scope by department in the header, and no sign of it elsewhere         | The Service selector, and the service stripe under the rail's brand                                                   | One service chosen is easy to forget and expensive to forget, so the rail carries it. Narrowing to a department is designed for inside the same control and not built.                                           |
| A rail that cannot close                                               | The bracket key and the control at the foot flip it open and closed from anywhere, and the choice is remembered       | The width animates in a fifth of a second, and not at all when motion is reduced. A control that lives only at the foot of the rail is off screen half the time, so the key does the same.                       |
| Nothing, because the rail was always open                              | The hover card in the closed strip                                                                                    | So the strip can be used all shift without opening it, and nothing is lost by closing.                                                                                                                           |
| The appearance control in the rail foot                                | In the Tools drawer                                                                                                   | The foot's room goes to the pinned rows and the reconciliation line. The harness opens Tools before it probes the first click. The standard's page keeps its own control in its rail foot because it has no bar. |
| The edge shade at 0.6 as a drawer backdrop                             | A scrim token, slate at 0.32 in light and black at 0.6 in dark                                                        | The edge shade is a soft inset and at 0.6 of it a light drawer barely read as over the page. A backdrop is a different job, so it has a token of its own.                                                        |
| The brand stripe at z-index 20, under the bar                          | At 45, above the bar and every drawer, pointer events off                                                             | The bar sits at 31 and the drawers at 40, so the one brand mark would have been painted over.                                                                                                                    |
| Waits as 4 h 28 m                                                      | Waits as 4h 28m, from one formatter                                                                                   | The build sheet's compact form, so one screen writes a wait one way. The engine's formatter changed in one place.                                                                                                |
| Two rails in the tree and a review switcher with number keys           | One nav, its state on the root before first paint, remembered under one key                                           | A hidden second nav is still in the accessibility tree. The Both view and the keys were a review aid and are not product states.                                                                                 |

## 13. Adoption plan for the mockups

_Five waves._

Eighteen mockups exist in six visual languages today. The plan moves them onto this standard in five waves, grouped by the shell they share, so that each wave is one shape of work. Every page keeps its URL and is republished in place with a version label, and a copy of each is committed to the repository's mockup folder.

- **Wave 0** the reference build, done
- **Wave 1** the operations family, Command's shell and data
- **Wave 2** the working screens on the Board edition
- **Wave 3** the reporting family, tables, bands and charts
- **Wave 4** the app-token and one-off pages

| Page                            | Wave   | Artifact                                                                         | Language today                                                                           | What it needs                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------- | ------ | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Command (the coordinator home)  | Wave 0 | [60c8bd59](https://claude.ai/code/artifact/60c8bd59-7392-499d-bfe5-eee90131e1da) | The second edition's live build: Prussian blue, Newsreader and Plex, a near white ground | The reference build. Re-cut with the third edition's identity and material on the second edition's engine: the tokens in section 15.2, the material rules in 15.3 and the three faces. Nothing in its content or data changes, and its behaviour changed only where the round one review found a fault. Supersedes the three earlier Command artifacts, including the first edition's Platinum Raised Cool build. Re-cut once more with the one row bar and the rail in both states, as the first screen built to the build sheet.      |
| Header, the quiet bar           | Wave 1 | [1546fe15](https://claude.ai/code/artifact/1546fe15-1152-4c5f-b88a-dff692f0a650) | The second edition's tokens and faces over a live Command body                           | Carried into this standard as section 6.2 and into Command's shell, restyled to the third edition: the page title at a loaded weight, the drawer backdrop as the scrim, a hover and a press on the primary, the slate ring on every open or chosen thing, and the words kept in every accessible name. Not a page of its own any more.                                                                                                                                                                                                  |
| Rail, open and closed           | Wave 1 | [ac61a6dc](https://claude.ai/code/artifact/ac61a6dc-f85e-40ed-b62c-947fd097e114) | The second edition's tokens and faces, two rails and a review switcher                   | Carried into this standard as section 6.1 and section 14, and into Command's shell: one nav, the strip's words at the floor, the brand at t-5, no switcher and no number keys. Its cards and drawn layouts are the screens index. Not a page of its own any more.                                                                                                                                                                                                                                                                       |
| Movements                       | Wave 1 | [eeb90f22](https://claude.ai/code/artifact/eeb90f22-d155-4be5-a036-c507203faf88) | Teal family: Schibsted Grotesk, Source Sans 3, JetBrains Mono, accent #0e7c86            | Rebuild on the Command shell: the rail, the one row bar, panels. Queue rows and candidate rows are the components in section 6. Movement identifiers WF-1xx. Every arrow becomes a word. The review findings recorded in this chat are applied in the same pass.                                                                                                                                                                                                                                                                        |
| Capacity (includes the bed map) | Wave 1 | [bcaf3c68](https://claude.ai/code/artifact/bcaf3c68-e579-4e24-9447-311a3166c206) | Teal family                                                                              | Same rebuild. Bed chips carry the four bed states. On the map only an eligible or a recorded ward carries a fill. Ward identifiers WF-2xx. The map's legend becomes a disclosure with Command's default.                                                                                                                                                                                                                                                                                                                                |
| Delays                          | Wave 1 | [24f6ef55](https://claude.ai/code/artifact/24f6ef55-ce72-407e-b4bb-9e608ca06e3a) | Teal family                                                                              | Same rebuild. The delay figures move into a band, one strip divided by hairlines with no coloured caps. Every delta carries a word. Red only where a deadline has passed. Owner to confirm this is the working Delays, since two older Delays artifacts exist.                                                                                                                                                                                                                                                                          |
| Ward (one unit)                 | Wave 2 | [1927f79b](https://claude.ai/code/artifact/1927f79b-6cae-4b25-93cb-721065a0c199) | Board second edition: Archivo, JetBrains Mono, accent #1d6fb8                            | Fonts and tokens swap by role. The totals strip becomes the band and keeps its limit of two flagged tiles. The attention panel keeps its plain sentences. Rows lose their arrows for from and to. The foot keeps Every figure here is invented and What is real.                                                                                                                                                                                                                                                                        |
| Ward board (the beds)           | Wave 2 | [1edc9909](https://claude.ai/code/artifact/1edc9909-1088-412c-8f4a-46b50ab3d40f) | Board second edition                                                                     | As above. Bed states use the bed chip contract: available, confirmed, held, blocked. The ward switcher stays a details and summary with search, groups and counts. No zebra striping in the bed table. The table wrapper scrolls, never the page.                                                                                                                                                                                                                                                                                       |
| Patient search                  | Wave 2 | [651148e2](https://claude.ai/code/artifact/651148e2-7157-4229-9fd1-8e2e567f7f8e) | Board second edition                                                                     | As above. The refusals stay and are written as refused-action rows: no risk or acuity score, no best match, no closed or arrived movements. Results are queue rows. The reason for a refusal is a sentence, not a colour.                                                                                                                                                                                                                                                                                                               |
| Community index                 | Wave 2 | [b7bd9b0b](https://claude.ai/code/artifact/b7bd9b0b-ae56-43d8-9ce9-3cabc7a70ce7) | Board second edition                                                                     | As above. Team names and suburb counts from the catchment table are the real data and are said to be. Contact details are never invented. Counts are derived on load.                                                                                                                                                                                                                                                                                                                                                                   |
| Statistics (main)               | Wave 3 | [b0fa8f7f](https://claude.ai/code/artifact/b0fa8f7f-b292-460e-8fa5-20b879bc7224) | Board second edition                                                                     | Tables move to the table contract: numeric cells right aligned in mono, a zero reads none, the totals row is a different kind of row. At most three charts, lines and arcs only, each with a role of img, a label and a caption stating the numbers. Numbers come forward and charts step back.                                                                                                                                                                                                                                         |
| Statistics, ward                | Wave 3 | [21855e1e](https://claude.ai/code/artifact/21855e1e-eec4-47a3-b0b0-06dcd3813724) | Board second edition                                                                     | As for the main statistics page.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Statistics, ED                  | Wave 3 | [e5167731](https://claude.ai/code/artifact/e5167731-8a16-4610-b950-fc1fd4c94fcc) | Board second edition                                                                     | As for the main statistics page. The eight departments are listed, Joondalup and Peel included.                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Statistics, community team      | Wave 3 | [3eb6e55b](https://claude.ai/code/artifact/3eb6e55b-af23-49bc-8d05-d6efe779a76c) | Board second edition                                                                     | As for the main statistics page.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ED waits                        | Wave 3 | [f23843f8](https://claude.ai/code/artifact/f23843f8-bbe4-4365-a428-7ec4c06947cc) | Statistics fourth edition: Inter, accent #1d6fb8, lines and arcs, disclosures, a band    | The closest page to this standard already. Swap fonts and tokens and keep its chart discipline, its disclosures that open in print and its band. Its table, band, chart and disclosure rules are the ones the extension block in section 15.7 carries.                                                                                                                                                                                                                                                                                  |
| Emergency department            | Wave 4 | [bf480324](https://claude.ai/code/artifact/bf480324-ba86-48e4-b762-8c09658bb31b) | App ckb-v2 tokens inlined, Archivo                                                       | Rebuild on the shell with the pressure cards from section 6. The department list is the real eight. App tokens are not a source for a mockup, see section 1.                                                                                                                                                                                                                                                                                                                                                                            |
| Search hub                      | Wave 4 | [499827aa](https://claude.ai/code/artifact/499827aa-9ba4-4180-9001-325a1b094b4c) | **Done.** Third edition, `search-hub-third-edition.html`                                 | Rebuilt on this standard. The page owns its composer at the head of the directory and the bar carries none, so there is still exactly one, per the owner ruling above. Columns are two thirds to one third. The refusals of section 8.6 are kept word for word and are shown in the popover, in the filter bar and in the list, never as an empty result. Two contrast pairs it reaches, ink and danger on accent-soft, were measured and added to section 3 first. Two gaps are reported below and carried in the page's Tools drawer. |
| Patient record                  | Wave 4 | [b4a939ea](https://claude.ai/code/artifact/b4a939ea-c18e-44e9-9119-947121913d50) | App ckb-v2 tokens inlined, Archivo, vertical tab rail                                    | Rebuild. The vertical tab rail becomes a rail group with the gilt you-are-here mark. The referral's written history never carries a green state. No verdict about a person anywhere on the page.                                                                                                                                                                                                                                                                                                                                        |
| Community team                  | Wave 4 | [b1eadb0f](https://claude.ai/code/artifact/b1eadb0f-9c92-48f7-a383-39c71eaa3c15) | PsychSift resolved values, Archivo, no data-theme block                                  | Rebuild. The missing data-theme block is the first fix, since the page cannot follow its own appearance control today. Real team names, everything else invented and declared.                                                                                                                                                                                                                                                                                                                                                          |
| New referral                    | Wave 4 | [ee958fc4](https://claude.ai/code/artifact/ee958fc4-2ee1-48c2-b7df-9f014381e43a) | Its own tokens, Archivo, accent #1a6ab5, locked design v6                                | Visual migration only, once the owner unlocks it. Flow, field order and wording stay locked. Referral identifiers RF-0xx. A disabled submit says why.                                                                                                                                                                                                                                                                                                                                                                                   |

### How each page is moved

1. Read the page as it is and list what it says that this standard does not: a ruling, a refusal, a piece of wording. Those are kept, and if the standard lacks one it is added to section 8 first.
2. Copy the block from section 15 and the shell rules in 15.8, remove the page's own tokens and fonts, and rebuild the shell: the rail in both states, the one row bar with its drawers, panels.
3. Rebuild each region from the components in section 6. Where a page has a component this standard lacks, build it once in the standard and re-cut.
4. Apply the wording rules in section 8, the behaviours in section 7, and the floor in section 9.
5. Render once at 1600 and 1200 in both themes. Fix what the look shows. Republish at the same URL with a label, and commit the copy.
6. Work through section 10 line by line. A line that is not true is not done.

### Decisions taken

Settled by the owner while the universal header and the rail were carried into this edition. Each is recorded here so nobody builds an answer to a question that has been decided.

- **The one row bar replaces the masthead figures strip.** The figures live in the Activity drawer's live tally, and the date and time sit in the rail's shift block.
- **The Service selector scopes the patient queue and the pressure strip.** The Statewide flow shows the whole network and its foot says so while a service is chosen.
- **The brand stripe sits above the bar and every drawer**, at the highest z-index, with pointer events off.
- **The closed strip's words are at the 10.5px floor**, and the strip widens if a word does not fit. Words never shrink.
- **The engine's data is the single source of truth.** The shell owns no data. Beds by site are summed from the units, contacts come from the units and the departments, and the shell's sum checks join the engine's one check array.
- **The rail's state.** One nav. `data-rail` on the root, set before first paint. The rail's own control and the bracket key. Remembered under `ward-flow-rail`. No demo switcher and no number keys.
- **The appearance control stays inside the Tools drawer**, as the build sheet's 9.6 has it. The kit harness opens Tools before its appearance probe on a page whose control lives there, and that adaptation is part of the graft.
- **The engine's movements gain invented names and an owner.** Given and family names, family name first, the family name a plant, a bird or a stone, as the data contract says. An owner field of Bed coordinator, Coordinator on call, or null for no owner, so search by name, the owners group and the no owner task work from real rows.
- **One wait format across the whole page**, the build sheet's compact form, 25h 10m, by changing the engine's formatter in one place.
- **A drawer backdrop token, `--scrim`.** Slate at 0.32 in light and black at 0.6 in dark, recorded in the token tables and the light model in section 3, because the edge shade alone is too faint in light.
- **Pinning from the shortlist header is wired.** The engine draws a Pin control beside the subject's identifier in the shortlist header, pressed while the subject is pinned, and the fly out's note says to pin from there. A second press on a pinned row announces that the movement is already the subject, because Command always has a subject and cannot clear the selection.
- **Notices the data cannot derive are recorded, not invented.** A bed pulled has no time in the engine's data, so it is a kind the standard names and Command does not draw until the data carries it.
- **A screen whose work is finding may own its composer, and then the bar carries none.** Owner ruling, 9 September 2026, on the Search hub. The one-composer rule is about there being exactly one search box on a page, not about which row it sits in. On a screen whose whole job is finding a place, the field belongs at the head of the list it filters, where the eye already is, and the bar's universal search comes off that screen so the count stays one. Every other screen keeps the bar's search, because on those the search is a way out of the screen rather than the screen itself. The slash key still reaches whichever field the page owns.
- **Two thirds to one third, where a screen has a list and a glance beside it.** Owner ruling, 9 September 2026, on the Search hub, carried from the page it replaced. The list gets `minmax(0, 2fr)` and the panel beside it `minmax(0, 1fr)`, which holds at 67 to 33 from 1100px up and stacks below 1000px, list first. The narrower column is set tighter to match: a two column tally, a two column table, shorter sections, and no prose the Activity drawer could carry instead.

### Decisions for the owner

- **Identity from the first edition.** The cool platinum neutrals, the deep slate brand, the brass secondary, the three faces and the fall of light come from Platinum Raised Cool. Reverse this and the second edition's Prussian blue, near white ground and Newsreader pairing return.
- **Behaviour from the second edition.** The derived figures, route words, the one bar stepper, the diagram fill rule, the legend disclosure, the three state appearance control, the 10.5px floor, the contrast table and the definition of done come from the Live edition standard. Reverse this and the first edition's shorter, less rigorous behaviour returns.
- **WACHS rust.** WA Country Health Service takes a rust of its own rather than sharing the brand slate with East Metro. Reverse this and the two services share a hue again.
- **The prototype chip kept neutral.** The first edition drew the Synthetic prototype chip in brass with a brass outline. It stays neutral because brass means you are here and nothing else. Reverse this and brass gains a second job.
- **The gilt token name kept.** The colour is called brass in every sentence and the token is called gilt, because the second edition's stylesheet and scripts read that name. Reverse this and every carrier must be re-cut for a rename.
- **Three light tokens darkened.** The round one review measured South Metro's teal, North Metro's plum and the amber below the floor on a showing candidate's accent-soft wash, and the teal on the hover well. Each is darkened the least that clears 4.5:1 on every fill it sits on: svc-south to #356A70, svc-north to #685A94, warn to #825D10. Every pairing in section 3.4 now passes in both themes. Reverse this and those pairs fall to 3.9 to 4.4:1.
- **Delays.** Confirm which of the three Delays artifacts is the working one. The plan assumes 24f6ef55.
- **Legend default.** Open only at 1600 by 1100 and wider, where the diagram is not already cut off, closed elsewhere, reader's choice thereafter. Accept or change.
- **New referral.** It is a locked design. Unlock it for the visual migration only, keeping its flow, field order and wording locked.
- **Ward Home, Daily Return.** Say whether it is a mockup to migrate or a closed study.
- **The repository's Board language document.** Whether it is updated to point at this standard for mockups, leaving the app's own token layer to the app team.
- **Narrowing to a department.** Designed to live inside the Service selector and not built. Confirm it stays there, and never becomes a second control.
- **Pinning from a queue row.** Pinning is wired from the shortlist header. Say whether a queue row should also pin, and whether a second press on a pinned row should clear the selection, which the engine's always selected queue does not allow today.
- **Which events are notices.** A bed pulled, an override recorded, and a deadline passed within the hour are the three kinds named. The set is to be confirmed, and a bed pulled needs a time in the data before it can be derived.
- **Export the queue and sign out.** Shown in Tools, not wired, and each says so. Say whether either is wanted in the prototype.
- **Eleven screens are drawn, not built.** Command is the only body built. Each of the others has its panels drawn in section 14 and its tally figures named, and waits for its own data.
- **Considered for the rail and not built.** Two lines per screen with its purpose: good for a first week, noise by the second, so the hover card and the tooltip carry the purpose instead. The current screen's own sections listed beneath it: removed on review, because the page's own headings do that job and the rail stays a list of screens. Bed pressure meters by service in the rail: they belong in the live tally and on Capacity, where there is room to read them. The on call roster: roles only would be safe, but it changes by site and by hour, and a wrong roster in a rail is worse than none, so its place is Tools with the time it was read. A search box in the rail: the bar already has one, and one composer per page is the rule. Confirm each stays out, or name the one to bring back.

### Gaps the Search hub reported

Recorded rather than closed on the page, per section 1: a mockup that needs a value the standard does not have reports the gap.

- **No thirteenth screen, and no rail item for a network directory.** The Search hub is a Wave 4 one-off that searches wards, emergency departments and community teams together. It is none of the twelve screens in section 14, so no rail link carries `aria-current` on it. Either the standard gains a screen, or the page is folded into Wards, Emergency departments and Community teams as a shared entry point. Owner to decide.
- **No hue for a private hospital.** The standard names four health services and gives each one a colour. St John of God Subiaco is private and is not one of them, and the repository's own ward fixture groups its two wards under Private. The page lists Private in the Service selector and draws it in the label ink rather than inventing a fifth hue. Either the standard gains a private tone, or the Service selector is renamed for what it actually scopes. Owner to decide.

### Closed, superseded and to confirm

| Artifacts                        | Identifiers                                                                                                                                                                                                          | Standing                                                                                                                                        |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Command, three earlier artifacts | e7895c28-4664-4af6-8bf0-d0001489d1c6, 4da67918-0587-4d27-b478-daf112d5ce02, adadef1d-4668-490f-9e6d-e37b4468ea6e                                                                                                     | Superseded by the third edition build. The second of these was the first edition's reference build, Platinum Raised Cool. Not updated again.    |
| Delays, two earlier artifacts    | 5668a1b5-b341-4fc1-83f5-fbea13aa3e2a, e118f42c-5490-483e-9768-6e6eab1dd3dc                                                                                                                                           | Assumed superseded by 24f6ef55. Owner to confirm.                                                                                               |
| Ward Home, Daily Return          | d24de117-82ba-4643-8a9f-a476b5639385                                                                                                                                                                                 | Not yet classified. Owner to say whether it is a mockup to migrate or a closed study.                                                           |
| Chrome and navigation studies    | 07e64210, 7c4e5f0e, f45beb41, 23448725, 9acc4366                                                                                                                                                                     | Closed by the shell in section 5. Their questions are answered by the rail in its two states, the one row bar and the widths.                   |
| Direction studies                | Platinum Raised and Tonal in Warm, Cool and Quiet, Platinum Satin, Brushed and Engraved, Consulate Tonal, Raised and Rules, Tide, Sea Glass, Signature, Folio, Atelier, Theatre, Chart, Liquid Glass, Signal, Ledger | Superseded by the third edition. They were the comparisons that chose the identity, and no page is built on them.                               |
| First edition of this document   | This artifact, version 1.0, Platinum Raised Cool                                                                                                                                                                     | Superseded by the third edition, which carries its identity and material. Kept as WARD-FLOW-STYLE-GUIDE.md and guide-body.html beside this one. |
| Second edition of this document  | This artifact, version 2.0, the Live edition standard                                                                                                                                                                | Superseded by the third edition, which carries its content, behaviour and rigour. Kept as source-L-standard.html beside this one.               |

## 14. Screens index

_Twelve screens, three groups and one flow._

Every screen is the shell of section 5.6 with its own panels in the body and its own four core figures in the live tally. The table is the overview, from the build sheet. The cards under it on the standard's page draw each screen's layout to scale, and Command's is drawn in full because it is the only body built. In every entry the bar is the bar of section 6.2 and the rail is the rail of section 6.1. Each panel opens with its heading, one sentence and a count. An empty panel says why it is empty and what the emptiness means. The four core figures are the tiles in the live tally, and the groups under them are the screen's own tables where it has them, else the network's. Every figure named here is invented.

### 14.1 The twelve screens

| No. | Screen                | Group      | Purpose                                                                                    | Primary action        | Who                                              | Column weights | Panels |
| --- | --------------------- | ---------- | ------------------------------------------------------------------------------------------ | --------------------- | ------------------------------------------------ | -------------- | ------ |
| 1   | Command               | Operations | Every open movement across the network, worst first, with what is wrong beside it.         | New referral          | The bed coordinator and the coordinator on call  | 1.25 and 1     | 3      |
| 2   | Movement              | Operations | One person's movement from referral to bed, with every event, decline and decision on it.  | Record a decision     | The bed coordinator, the ED liaison and the ward | 1.4 and 1      | 6      |
| 3   | Capacity              | Operations | Beds by site and by ward, what is held, and where the pressure is.                         | Hold a bed            | The bed coordinator and the ward                 | 1 and 1        | 4      |
| 4   | Wards                 | Network    | Every ward in the network, what it takes, and how it has answered.                         | Ask a ward            | The bed coordinator and the ward                 | 1 and 1.2      | 3      |
| 5   | Emergency departments | Network    | Each department's waiting, longest and breached, and the liaison it works through.         | Open the department   | The bed coordinator and the ED liaison           | 1.2 and 1      | 3      |
| 6   | Community teams       | Network    | The community teams by service, their catchments, and the referrals they send.             | Contact a team        | The bed coordinator and triage                   | 1 and 1.2      | 3      |
| 7   | Patient search        | Records    | Find a person by name or identifier and open their movement, with the refusals stated.     | Open the movement     | Everyone signed in                               | 1 and 0.9      | 4      |
| 8   | Referrals             | Records    | Every referral awaiting triage, oldest first, and the decision on each.                    | Triage                | The duty consultant and triage                   | 1.2 and 1      | 3      |
| 9   | Handover              | Records    | The state of the network as a record for the incoming coordinator, and the sign off.       | Sign off the handover | The bed coordinator and the incoming coordinator | 1 and 0.8      | 4      |
| 10  | Statistics            | Records    | Waits, breaches and flows over a period, with stated scales and nothing extrapolated.      | Export                | Service leads and governance                     | 1 and 0.8      | 4      |
| 11  | Governance            | Records    | Every override recorded, oldest first, and the review of each.                             | Record a review       | The governance lead and the service lead         | 1.2 and 1      | 3      |
| 12  | Raise a referral      | Flow       | The flow behind the primary action: who, from where, what is asked, and what happens next. | Submit the referral   | The ED liaison, a community team and a GP        | 1 and 0.8      | 6      |

The column weights are the two columns of the body, left first, as `grid-template-columns: minmax(0, Afr) minmax(0, Bfr)`. The panels are listed left column first in each entry below. When a screen's own primary action is not New referral, that action takes the accent fill and New referral stays in the bar as a secondary control.

### 14.2 Every screen, drawn

Each entry is a card on the standard's page with the layout drawn to scale. Here it is the same entry in words: the panels left column first, the sentence each holds, the four tally figures and what the rail carries.

**1. Command** (Operations). Columns 1.25 and 1, 3 panels. Primary: New referral. Live tally: Waiting in ED, Breached, Due within 2 hours, Longest wait. Rail: Open movements, the breached and due soon line, the red dot on a breach.

- Left: Priority queue. Deadlines passed, then the nearest deadline, then the longest wait. Each row is a movement.
- Right: Exceptions. Breaches, acceptances with no bed, movements with no owner.
- Right: Referrals awaiting triage. Oldest first, with the source and the request.

**2. Movement** (Operations). Columns 1.4 and 1, 6 panels. Primary: Record a decision. Live tally: Open movements, Breached, Declines to answer, Accepted, no bed. Rail: Nothing.

- Left: Identity and clocks. Identifier, tier, the wait, the legal deadline, the owner.
- Left: Timeline. Every event with its time: referral, assessment, asks, declines, acceptance, bed pulled, arrival.
- Left: Referral and assessment record. What was asked, by whom, and what was found.
- Right: Destination and bed. Suggested, asked, accepted, pulled. One state at a time.
- Right: Declines and reasons. Each ward asked, and the reason it gave.
- Right: Escalation. Who owns it, who is next, and the override if one was recorded.

**3. Capacity** (Operations). Columns 1 and 1, 4 panels. Primary: Hold a bed. Live tally: Beds free of total, Sites with none, Held, Sites drawn. Rail: Beds free, and the free and none line.

- Left: Beds by site. Beds, free, held, for every site drawn.
- Left: Holds and pulls. Named holds with the movement they are for, and pulls in the last shift.
- Right: Pressure by service. Free beds against beds, per health service.
- Right: Beds by ward. Open, secure, older adult, and what each will take.

**4. Wards** (Network). Columns 1 and 1.2, 3 panels. Primary: Ask a ward. Live tally: Wards drawn, Beds free, Sites with none, Declines today. Rail: Nothing.

- Left: Wards by site. Grouped by site, with beds free and the last answer.
- Right: Ward detail. Beds, holds, restrictions, and what the ward will and will not take.
- Right: Recent answers. Acceptances and declines in the last week, with reasons.

**5. Emergency departments** (Network). Columns 1.2 and 1, 3 panels. Primary: Open the department. Live tally: Departments, Waiting, Breached, Longest wait. Rail: The longest wait line.

- Left: Departments. Waiting, longest wait, breached, per department, worst first.
- Right: Department detail. The movements there now, and the clocks on each.
- Right: Liaison and contacts. Roles and the placeholder contacts, never a person's number.

**6. Community teams** (Network). Columns 1 and 1.2, 3 panels. Primary: Contact a team. Live tally: Teams drawn, Referrals waiting, From community teams, From GPs. Rail: Nothing.

- Left: Teams by service. Every team, grouped by health service.
- Right: Team detail. Catchment, hours, and the referrals it has sent this month.
- Right: Contacts. Roles and placeholder contacts.

**7. Patient search** (Records). Columns 1 and 0.9, 4 panels. Primary: Open the movement. Live tally: Open movements, Searchable (open only), Refusals (three kinds), Searches recorded (every one). Rail: Nothing.

- Left: Search. Name or identifier. Refuses a risk score, a best match, and closed movements, and says so.
- Left: Results. Name, identifier, department, the open movement and its clock.
- Right: Selected person. The open movement, or a stated absence.
- Right: Access record. Who looked, and when. Every search is recorded.

**8. Referrals** (Records). Columns 1.2 and 1, 3 panels. Primary: Triage. Live tally: Awaiting triage, Oldest, Older adult, For admission. Rail: Waiting, the oldest line, the amber dot over two hours.

- Left: Triage list. Oldest first, with source, request and age group.
- Right: Referral detail. What was asked, by whom, and when.
- Right: Decision and reasons. Accept to the pathway, redirect, or decline, with the reason recorded.

**9. Handover** (Records). Columns 1 and 0.8, 4 panels. Primary: Sign off the handover. Live tally: Handover at, Time left, To hand over, Exceptions. Rail: The time as its tag, the time left line.

- Left: Handover sheet. The queue, the exceptions and the beds as they stand, as a record.
- Left: Notes for the incoming coordinator. What to watch, in the outgoing coordinator's words.
- Right: Shift and sign off. Who hands over to whom, and when.
- Right: Print. The same sheet on paper.

**10. Statistics** (Records). Columns 1 and 0.8, 4 panels. Primary: Export. Live tally: Waiting now, Breached now, Beds free, Period. Rail: Nothing.

- Left: Figures by period. Waits, breaches, flows, by week and by month.
- Left: Charts. Every scale stated, every zero drawn, every gap in the data said out loud.
- Right: Filters. Period, service, tier, department.
- Right: Export. The figures as a sheet, with the reconciliation line.

**11. Governance** (Records). Columns 1.2 and 1, 3 panels. Primary: Record a review. Live tally: Overrides to review, Reviewed this month, Oldest, Reviewers. Rail: Overrides to review.

- Left: Overrides for review. Oldest first, with who overrode, what, and the reason given.
- Right: Override detail. The movement, the rule set aside, and the reason.
- Right: Decision and record. Upheld, not upheld, or referred on, with the reviewer's reason.

**12. Raise a referral** (Flow). Columns 1 and 0.8, 6 panels. Primary: Submit the referral. Live tally: Referrals waiting, Sources, Duplicate checks (every time), Clocks started (on submit). Rail: Not a rail item. Reached from New referral and from Tools.

- Left: Source. Emergency department, community team, or GP, chosen first.
- Left: Person and identifiers. Name and identifier, with a duplicate check against open movements.
- Left: Request. Admission or assessment, adult or older adult, and the urgency stated.
- Left: Submit. One action, and what was submitted read back.
- Right: What happens next. Triage by the duty consultant, and the clocks that start.
- Right: Duplicate check. An open movement for the same person is shown before anything is created.

### 14.3 Command, drawn to scale

The layout of the one screen that is built is drawn on the standard's page with the rules in section 15.8: the rail with its current item as a brass bar, the bar with its primary at the right, and the two columns at their weights, 1.25 and 1, each panel a block with its heading and the sentence that says what it holds. The facts above it: primary action New referral, three panels, used by the bed coordinator and the coordinator on call, the live tally Waiting in ED, Breached, Due within 2 hours and Longest wait, and the rail carrying open movements, the breached and due soon line and the red dot on a breach.

### 14.4 Every empty state, in one place

Absence is a sentence that says why the list is empty and what the emptiness means. These are the sentences, with WA Country and South Metropolitan standing in for whichever service is chosen.

| Where                                         | What it says                                                                                                                                                           |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The queue, when no movement is in the service | No department in WA Country has a movement open. Absence here means none is waiting, not that none exists.                                                             |
| The queue, when a filter excludes everything  | No open movement matches this filter. Absence here means the filter excludes every movement, not that the queue is empty.                                              |
| Exceptions                                    | No exceptions in South Metropolitan. Every open movement has an owner, a deadline that has not passed, and a bed where it has been accepted.                           |
| Referrals                                     | No referral awaits triage in WA Country. Absence here means none is waiting.                                                                                           |
| Notices                                       | No notices since handover in WA Country.                                                                                                                               |
| Events                                        | No event today in WA Country.                                                                                                                                          |
| What is going on                              | Nothing is open in WA Country. No department there has a movement open and no site there is drawn in this prototype. Absence here means none, not that nothing exists. |
| A table in the tally                          | none in WA Country, as the one cell of the table.                                                                                                                      |
| Contacts                                      | No ward in WA Country is drawn in this prototype.                                                                                                                      |
| Pinned                                        | No pinned movement in WA Country.                                                                                                                                      |
| Search                                        | Nothing matches 'x'. Search finds patients by name or identifier, movements, departments, wards, owners and tools.                                                     |
| A count                                       | none, in italics where the figure would be.                                                                                                                            |

**Every figure here is invented**: the 23 movements, the four referrals, the bed counts, the four overrides, the clock, the shift, the notices and the events. They are the build sheet's figures. Command derives its own on every load, which today read 14 movements and 5 referrals, and no mockup types a figure.

**What is real**: the eight emergency departments, the hospital sites, the four health services and the ward names, from the repository's own tables.

## 15. Source

_Copy, never edit the copy._

### 15.1 The head of every page

The title first, the viewport meta, then a short script that names the language and stamps a remembered appearance and a remembered closed rail before the stylesheet, so the first paint is already in the reader's theme and at the rail's width, then the font links.

```html
<title>Ward Flow Command</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<script>
  (function () {
    document.documentElement.lang = "en-AU";
    try {
      var v = localStorage.getItem("ward-flow-<page>-appearance");
      if (v === "light" || v === "dark") document.documentElement.setAttribute("data-theme", v);
      if (localStorage.getItem("ward-flow-rail") === "closed")
        document.documentElement.setAttribute("data-rail", "closed");
    } catch (e) {}
  })();
</script>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  rel="stylesheet"
  href="https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,600;8..60,700&family=Source+Sans+3:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
/>
```

### 15.2 The tokens

The three roots, the print rule and the reduced-motion block, extracted from the reference build's stylesheet by script rather than typed, so they cannot differ from it. Every name the second edition's stylesheet and scripts read is kept, and five are added: ground-hi, ground-2, stripe, hl-on-accent and r1i.

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
  --warn: #825d10;
  --warn-soft: #f6eeda;

  --danger: #b03b2e;
  --danger-soft: #f8e6e2;
  --danger-ink: #973121;

  --svc-east: #2f4c66;
  --svc-north: #685a94;
  --svc-south: #356a70;
  --svc-wachs: #8c5a3c;

  /* Names the rendering script reads. Kept as aliases so the data layer never
     carries a hex of its own. */
  --ward: var(--svc-east);
  --ward-soft: var(--accent-soft);
  --ed: var(--danger);
  --comm: var(--svc-south);
  --coord: var(--svc-north);

  --lift: 0 1px 1px rgba(30, 48, 66, 0.05), 0 14px 30px -22px rgba(30, 48, 66, 0.45);
  --hl: rgba(255, 255, 255, 0.9);
  --hl-on-accent: rgba(255, 255, 255, 0.14);
  --edge-shade: rgba(30, 48, 66, 0.16);
  --scrim: rgba(30, 48, 66, 0.32);

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
    --scrim: rgba(0, 0, 0, 0.6);
  }
}

:root[data-theme="dark"] {
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
  --scrim: rgba(0, 0, 0, 0.6);
}

@media print {
  :root,
  :root[data-theme="dark"],
  :root:not([data-theme="light"]) {
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
    --warn: #825d10;
    --warn-soft: #f6eeda;
    --danger: #b03b2e;
    --danger-soft: #f8e6e2;
    --danger-ink: #973121;
    --svc-east: #2f4c66;
    --svc-north: #685a94;
    --svc-south: #356a70;
    --svc-wachs: #8c5a3c;
    --lift: none;
    --hl: transparent;
    --hl-on-accent: transparent;
    --edge-shade: transparent;
    --scrim: transparent;
  }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    transition: none !important;
    animation: none !important;
  }
}
```

### 15.3 The material rules

The rules that carry the first edition's material on top of the second edition's stylesheet. They change the rule, never the class name, so every script keeps working. Each is stated here once with its reason in section 5, and every rule below is extracted from the reference build's stylesheet by the same script that prints 15.2, so the whole stylesheet carries them by construction.

```css
/* Canvas: a fall of light from the top, fixed to the window. */
body {
  margin: 0;
  background:
    linear-gradient(180deg, var(--ground-hi) 0%, var(--ground) 55%, var(--ground-2) 100%) fixed,
    var(--ground);
  color: var(--ink);
  font-family: var(--body);
  font-size: var(--t-3);
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
  font-optical-sizing: auto;
  font-variant-numeric: tabular-nums;
  overflow-x: hidden;
}

/* The brand stripe. */
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

/* The one elevation step. */
.panel {
  min-width: 0;
  background: var(--surface);
  border: 1px solid var(--line);
  border-bottom-color: var(--line-strong);
  border-radius: var(--r1);
  box-shadow:
    var(--lift),
    inset 0 1px 0 var(--hl);
}

/* Strips on the second surface tone, with the inner radius where they touch a panel corner. */
.ph {
  display: flex;
  align-items: baseline;
  gap: 12px;
  flex-wrap: wrap;
  padding: 11px 16px;
  border-bottom: 1px solid var(--line);
  background: var(--surface-2);
  border-radius: var(--r1i) var(--r1i) 0 0;
}
.ph h2,
.ph h3 {
  font-family: var(--display);
  font-size: var(--t-3);
  font-weight: 600;
  letter-spacing: -0.012em;
  color: var(--accent-ink);
}
.tabbar {
  display: flex;
  border-bottom: 1px solid var(--line);
  background: var(--surface-2);
  overflow-x: auto;
}
.tabsPanel .tabbar {
  border-radius: var(--r1i) var(--r1i) 0 0;
}
.diagFoot {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 16px;
  border-top: 1px solid var(--line);
  background: var(--surface-2);
  border-radius: 0 0 var(--r1i) var(--r1i);
}
.legend {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 5px 14px;
  padding: 2px 16px 10px;
  background: var(--surface-2);
  border-radius: 0 0 var(--r1i) var(--r1i);
}

/* Hairlines are the alpha tokens; the scrollbars are thin in every scrolling region. */
.rail,
.qList,
.diagWrap,
.tabBody,
.slBody,
.edList {
  scrollbar-width: thin;
  scrollbar-color: var(--line-strong) transparent;
}
.rail::-webkit-scrollbar,
.qList::-webkit-scrollbar,
.diagWrap::-webkit-scrollbar,
.tabBody::-webkit-scrollbar,
.slBody::-webkit-scrollbar,
.edList::-webkit-scrollbar {
  width: 9px;
  height: 9px;
}
.rail::-webkit-scrollbar-thumb,
.qList::-webkit-scrollbar-thumb,
.diagWrap::-webkit-scrollbar-thumb,
.tabBody::-webkit-scrollbar-thumb,
.slBody::-webkit-scrollbar-thumb,
.edList::-webkit-scrollbar-thumb {
  background: var(--line-strong);
  border-radius: 9px;
  border: 2px solid transparent;
  background-clip: padding-box;
}

/* Selection never hides status: the bar side is left alone and the other three take the slate ring. */
.edCard[aria-pressed="true"] {
  background: var(--accent-soft);
  border-left-color: var(--accent);
  border-right-color: var(--accent);
  border-bottom-color: var(--accent);
  box-shadow:
    inset 1px 0 0 var(--accent),
    inset -1px 0 0 var(--accent),
    inset 0 -1px 0 var(--accent);
}
.cand[data-showing="true"] {
  border-top-color: var(--accent);
  border-right-color: var(--accent);
  border-bottom-color: var(--accent);
  background: var(--accent-soft);
  box-shadow:
    inset 0 1px 0 var(--accent),
    inset -1px 0 0 var(--accent),
    inset 0 -1px 0 var(--accent);
}

/* Buttons. */
.ctl {
  padding: 7px 13px;
  font-size: var(--t-2);
  font-weight: 600;
  color: var(--ink);
  border: 1px solid var(--line-strong);
  border-radius: var(--r2);
  background: var(--surface);
  transition:
    background 0.12s,
    border-color 0.12s;
}
.ctl:hover {
  background: var(--sunk);
  border-color: var(--ink-soft);
}
.ctl:active {
  background: var(--sunk);
  border-color: var(--ink-soft);
}
.ctl.primary {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--on-accent);
  box-shadow: inset 0 1px 0 var(--hl-on-accent);
}
.ctl.primary:hover,
.ctl.primary:active {
  background: var(--accent-ink);
  border-color: var(--accent-ink);
}

/* Count pills on the rail and the tabs. */
.tag {
  font-family: var(--mono);
  font-size: var(--t-0);
  font-weight: 500;
  color: var(--muted);
  background: var(--sunk);
  padding: 1px 7px;
  border-radius: 999px;
  box-shadow: inset 0 0 0 1px var(--line);
}
.railLink[aria-current="page"] .tag {
  color: var(--accent-ink);
  background: var(--accent-soft);
  box-shadow: inset 0 0 0 1px var(--accent);
}
.tabNum {
  font-family: var(--mono);
  font-size: var(--t-0);
  font-weight: 500;
  letter-spacing: 0;
  text-transform: none;
  padding: 0 7px;
  border-radius: 999px;
  background: var(--sunk);
  box-shadow: inset 0 0 0 1px var(--line);
  color: var(--ink-soft);
}
.tabBtn[aria-selected="true"] .tabNum {
  background: var(--accent-soft);
  box-shadow: inset 0 0 0 1px var(--accent);
  color: var(--accent-ink);
}
.tabNum[data-zero="true"] {
  font-family: var(--body);
  font-style: italic;
  font-weight: 400;
  color: var(--muted);
  box-shadow: none;
  background: transparent;
  padding: 0;
}

/* The brand name in accent-ink, in the display serif. */
.brand b {
  font-family: var(--display);
  font-size: var(--t-5);
  font-weight: 600;
  letter-spacing: -0.012em;
  line-height: 1;
  color: var(--accent-ink);
}

/* The laptop rule: the registers give up height first and the diagram keeps its room. */
@media (min-width: 1400px) and (max-height: 1024px) {
  .midCol {
    grid-template-rows: minmax(0, 1fr) minmax(0, 11.5rem);
  }
  .scroll {
    padding-bottom: 16px;
    gap: 12px;
  }
  .edList {
    padding: 10px 14px;
  }
  .edCard {
    padding: 9px 12px;
    gap: 4px;
  }
  .legend {
    gap: 4px 14px;
    padding: 7px 16px;
  }
  .ph {
    padding: 9px 16px;
  }
}

/* The tap floor. */
@media (pointer: coarse), (max-width: 640px) {
  .ctl,
  .tabBtn,
  .railLink,
  .qRow,
  .edCard,
  .cand,
  .apBtn,
  .phBtn,
  .pinBtn,
  .linkBtn,
  .skip {
    min-height: 3rem;
  }
  .phBtn,
  .pinBtn,
  .linkBtn,
  .apBtn,
  .ctl {
    display: inline-flex;
    align-items: center;
  }
}

/* The stripe in print and under forced colours. */
@media print {
  body::before {
    display: none;
  }
}
@media (forced-colors: active) {
  body::before {
    background: CanvasText;
  }
}
```

### 15.4 The whole stylesheet

The block a mockup copies is the stylesheet of the reference build, the Command third edition, from its first token to its last print rule. It is not reproduced here, because this page is styled by that same stylesheet and a second copy is exactly how the two earlier editions drifted from their carriers. Copy it from the reference build, do not edit the copy, and add only what the screen needs below it under a comment naming the screen. The tokens in 15.2 and the material rules in 15.3 are extracted from it so the values can be read without the build open, and the contrast table in section 3 is recomputed from the live tokens on every load so a drift between the two would show on this page first. The table, the band, the chart and the disclosure are not in the reference build yet, and their rules are printed in 15.7. The one row bar, the rail in both states, the drawers and the pop outs are the shell rules in 15.8.

### 15.5 The appearance script

Replace the page name in the storage key. Runs after the markup, before anything else.

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

### 15.6 The measurement helpers

Announcements, list fades, the strip's sideways affordance, the legend's default, Escape, and disclosures for print. From the Command live edition.

```js
// Spoken changes of subject. A repeated sentence gets a zero-width space so it is read again.
function announce(text) {
  var el = document.getElementById("live");
  if (!el) return;
  el.textContent = el.textContent === text ? text + "\u200b" : text;
}

// A list that continues past its window fades into that edge. Measured, never declared:
// run on render, on scroll of the region, and on resize.
var FADE_IDS = ["qpane-patients", "qpane-referrals", "tabBody"];
function fadeTargets() {
  var els = FADE_IDS.map(function (id) {
    return document.getElementById(id);
  });
  var sl = document.querySelector(".slBody");
  if (sl) els.push(sl);
  return els.filter(Boolean);
}
function updateFades() {
  fadeTargets().forEach(function (el) {
    var more = el.scrollHeight - el.clientHeight;
    var top = more > 1 && el.scrollTop > 1;
    var bottom = more > 1 && el.scrollTop < more - 1;
    el.setAttribute("data-fade-top", top ? "true" : "false");
    el.setAttribute("data-fade-bottom", bottom ? "true" : "false");
  });
}
document.addEventListener(
  "scroll",
  function (evt) {
    var t = evt.target;
    if (!t || t.nodeType !== 1) return;
    if (FADE_IDS.indexOf(t.id) !== -1 || (t.classList && t.classList.contains("slBody"))) updateFades();
  },
  true,
);

// A strip that overflows sideways: a soft shade at the edge it continues past, and the
// header count says so in words.
function updateStripAffordance() {
  var list = document.getElementById("edList");
  if (!list) return;
  var overflowing = list.scrollWidth > list.clientWidth + 1;
  list.dataset.overflowing = overflowing ? "true" : "false";
  var n = edPressure().length;
  document.getElementById("edCount").textContent =
    n + " departments" + (overflowing ? " \u00b7 scroll sideways for the rest" : "");
}

// The legend opens by default only where the diagram has room to spare. The reader's own
// choice wins from then on. The media query is stated once.
var LEGEND_OPEN_QUERY = "(min-width: 1600px) and (min-height: 1100px)";
function renderLegendState() {
  if (state.legendOpen === null) {
    state.legendOpen = !!(window.matchMedia && window.matchMedia(LEGEND_OPEN_QUERY).matches);
  }
  var lg = document.getElementById("legend"),
    b = document.getElementById("legendToggle");
  if (lg) lg.hidden = !state.legendOpen;
  if (b) b.setAttribute("aria-expanded", state.legendOpen ? "true" : "false");
}

// Escape clears the innermost thing first: a ward selection, then a referral standing as the
// shortlist's subject, then the filter.
document.addEventListener("keydown", function (e) {
  if (e.key !== "Escape") return;
  if (state.selectedWard) {
    clearWard();
    announce("Ward selection cleared.");
    return;
  }
  if (state.referralId) {
    clearReferral();
    announce("Shortlist back to " + state.movementId + ".");
    return;
  }
  if (state.edFilter) {
    clearFilter();
    announce("Filter cleared. Showing every patient.");
  }
});

// Disclosures are opened for print and closed again after.
var opened = [];
window.addEventListener("beforeprint", function () {
  opened = [];
  document.querySelectorAll("details:not([open])").forEach(function (d) {
    d.setAttribute("open", "");
    opened.push(d);
  });
});
window.addEventListener("afterprint", function () {
  opened.forEach(function (d) {
    d.removeAttribute("open");
  });
  opened = [];
});
```

### 15.7 The extension block

The rules this page adds below the reference build's stylesheet for the components Command does not yet carry: the figure band, the chart, the disclosure, the three row header, the statistics strip, the task chips, and the page's own masthead with its figures strip and clock. A rule the reference build's block already carries, for the menus, the search field, the data table and the tally facts, is not repeated here, so the reference build's rule always wins. Printed verbatim from the page's own style block. A page that adopts one of those components copies the rules it needs from here, under a comment naming the screen, until the reference build carries them.

```css
/* ─── Rules of Source L that the reference build's stylesheet does not carry: the header, the figures
   strip, the task chips, the data table, the disclosure and the chart, so the components
   section can draw them with the production class names. A rule the reference build's block
   above already carries, for the menus, the search field, the data table and the tally facts,
   is not repeated here, so the block above always wins for those. ─── */
.band {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
  border-top: 1px solid var(--line);
}
.band > .kpi {
  padding: 12px 16px;
  border-right: 1px solid var(--line);
  min-width: 0;
}
.band > .kpi:last-child {
  border-right: 0;
}
.band .kpi dd {
  flex-wrap: wrap;
}
.band .kpi dd .delta {
  flex: 1 1 100%;
}
.band .kpi dd {
  font-size: var(--t-6);
}
.kpi[data-tone="warn"] dd {
  color: var(--warn);
}
.delta {
  font-size: var(--t-1);
  color: var(--ink-soft);
  white-space: nowrap;
}
.delta b {
  font-family: var(--mono);
  font-weight: 500;
  color: var(--ink);
}
.chart {
  margin: 0;
  display: grid;
  gap: 8px;
  padding: 12px 16px;
}
.chart svg {
  display: block;
  width: 100%;
  height: auto;
}
.chart figcaption {
  font-size: var(--t-1);
  color: var(--muted);
  line-height: 1.5;
  max-width: 72ch;
  text-wrap: pretty;
}
.chart .grid {
  stroke: var(--line);
  stroke-width: 1;
}
.chart .axis {
  stroke: var(--line-strong);
  stroke-width: 1;
}
.chart .series {
  fill: none;
  stroke: var(--accent);
  stroke-width: 1.75;
  stroke-linejoin: round;
  stroke-linecap: round;
}
.chart .end {
  fill: var(--surface);
  stroke: var(--accent);
  stroke-width: 2;
}
.chart text {
  font-family: var(--mono);
  font-size: 10.5px;
  fill: var(--muted);
}
.reveal {
  border-top: 1px solid var(--line);
}
.reveal > summary {
  list-style: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  font-size: var(--t-1);
  font-weight: 600;
  color: var(--ink-soft);
  transition:
    color 0.12s,
    background 0.12s;
}
.reveal > summary::-webkit-details-marker {
  display: none;
}
.reveal > summary::after {
  content: "";
  width: 5px;
  height: 5px;
  border-right: 1.5px solid currentColor;
  border-bottom: 1.5px solid currentColor;
  transform: translateY(-1.5px) rotate(45deg);
  transition: transform 0.12s;
}
.reveal[open] > summary::after {
  transform: translateY(1.5px) rotate(-135deg);
}
.reveal > summary:hover {
  background: var(--sunk);
  color: var(--ink);
}
.reveal > summary .count {
  margin-left: auto;
  font-family: var(--mono);
  font-size: var(--t-0);
  font-weight: 400;
  color: var(--muted);
}
.revealBody {
  padding: 2px 16px 12px;
}
/* The tap floor for the components the mockup stylesheet does not carry; the rest is in it. */
@media (pointer: coarse), (max-width: 640px) {
  .reveal > summary,
  .task,
  .menu > summary,
  .menuItem,
  .search {
    min-height: 3rem;
  }
}
@media print {
  .kpi,
  .band {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
}
.hdr {
  position: relative;
  z-index: 5;
  display: grid;
  background: var(--surface);
  border-bottom: 1px solid var(--line);
}
.hdrBar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px 14px;
  padding: 13px 24px 11px;
}
.hdrBar .title {
  flex: 1 1 20rem;
}
.hdrBar h1,
.hdrBar .hdrTitle {
  font-family: var(--display);
  font-size: var(--t-6);
  font-weight: 600;
  line-height: 1;
  letter-spacing: -0.012em;
  color: var(--ink);
}
.hdrBar .sub {
  flex: 1 1 100%;
  min-width: 0;
  max-width: 72ch;
  font-size: var(--t-1);
  line-height: 1.45;
  color: var(--muted);
  text-wrap: pretty;
}
.hdrTools {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-left: auto;
  min-width: 0;
}
.search .clearBtn:hover {
  background: var(--sunk);
  color: var(--ink);
}
.menu > summary:hover {
  background: var(--sunk);
  border-color: var(--ink-soft);
}
.menu > summary.primary:hover,
.menu > summary.primary:active {
  background: var(--accent-ink);
  border-color: var(--accent-ink);
  color: var(--on-accent);
}
.menu > summary.quiet {
  border-color: transparent;
  background: transparent;
  color: var(--ink-soft);
}
.menu > summary.quiet:hover {
  background: var(--sunk);
  color: var(--ink);
}
.menuItem:hover {
  background: var(--sunk);
}
.menuDiv {
  height: 1px;
  background: var(--line);
  margin: 4px 0;
}
.menuPanel .search {
  margin: 8px 8px 2px;
  height: 32px;
}
.stats {
  display: flex;
  align-items: stretch;
  gap: 0;
  padding: 0 24px;
  border-top: 1px solid var(--line);
  background: var(--surface-2);
  min-width: 0;
}
.statsList {
  display: flex;
  flex: 1 1 auto;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;
  margin: 0;
}
.statsList::-webkit-scrollbar {
  display: none;
}
.statsList[data-overflowing="true"] {
  box-shadow: inset -22px 0 18px -18px var(--edge-shade);
}
.stat {
  display: grid;
  gap: 3px;
  align-content: center;
  padding: 9px 18px 9px 0;
  margin-right: 18px;
  border-right: 1px solid var(--line);
  white-space: nowrap;
}
.stat:last-child {
  border-right: 0;
  margin-right: 0;
}
.stat dt {
  font-size: var(--t-0);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
  font-weight: 600;
}
.stat dd {
  font-family: var(--mono);
  font-size: var(--t-4);
  font-weight: 500;
  letter-spacing: -0.02em;
  line-height: 1.1;
  color: var(--ink);
  display: flex;
  align-items: baseline;
  gap: 5px;
}
.stat dd small {
  font-family: var(--body);
  font-size: var(--t-1);
  font-weight: 400;
  color: var(--muted);
  letter-spacing: 0;
}
.stat dd i {
  font-family: var(--body);
  font-style: italic;
  font-weight: 400;
  color: var(--muted);
  letter-spacing: 0;
}
.stat[data-tone="danger"] dd {
  color: var(--danger);
}
.stat[data-tone="warn"] dd {
  color: var(--warn);
}
.statsEnd {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: none;
  margin-left: auto;
  padding: 6px 0 6px 16px;
  border-left: 1px solid var(--line);
}
.hdrClock {
  display: flex;
  align-items: baseline;
  gap: 8px;
  white-space: nowrap;
}
.hdrClock span {
  font-size: var(--t-0);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
  font-weight: 600;
}
.hdrClock b {
  font-family: var(--mono);
  font-size: var(--t-4);
  font-weight: 500;
  letter-spacing: -0.02em;
}
.statsMenu > summary {
  height: 30px;
  font-size: var(--t-1);
  background: var(--surface);
}
.statsMenu .menuPanel {
  max-width: none;
  width: min(94vw, 70rem);
}
.statsGrid {
  display: grid;
  grid-template-columns: 17rem 21rem repeat(2, minmax(0, 1fr));
}
.statsGrid > section {
  min-width: 0;
  border-right: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
  padding-bottom: 6px;
}
.statsGrid .dataTable th,
.statsGrid .dataTable td {
  padding: 4px 8px;
}
.statsGrid .dataTable th:first-child,
.statsGrid .dataTable td:first-child {
  padding-left: 12px;
}
.statsGrid .dataTable th {
  background: transparent;
  border-bottom-color: var(--line);
}
.statsGrid .dataTable tbody tr:last-child td {
  border-bottom: 0;
}
.tasks {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 7px 24px;
  border-top: 1px solid var(--line);
  background: var(--surface);
  min-width: 0;
}
.tasksLabel {
  display: flex;
  align-items: baseline;
  gap: 7px;
  flex: none;
  font-size: var(--t-0);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--ink-soft);
  font-weight: 600;
  white-space: nowrap;
}
.tasksLabel .count {
  font-family: var(--mono);
  font-size: var(--t-0);
  font-weight: 500;
  color: var(--muted);
  letter-spacing: 0;
  text-transform: none;
}
.taskList {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  flex: 1 1 auto;
  min-width: 0;
  padding: 2px 0;
  scrollbar-width: none;
}
.taskList::-webkit-scrollbar {
  display: none;
}
.taskList[data-overflowing="true"] {
  box-shadow: inset -22px 0 18px -18px var(--edge-shade);
}
.task {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  flex: none;
  height: 28px;
  padding: 0 11px 0 9px;
  border: 1px solid var(--line-strong);
  border-radius: 999px;
  background: var(--surface);
  font-size: var(--t-1);
  color: var(--ink-soft);
  white-space: nowrap;
  transition:
    background 0.12s,
    border-color 0.12s,
    color 0.12s;
}
.task::before {
  content: "";
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--line-strong);
  flex: none;
}
.task b {
  font-family: var(--mono);
  font-weight: 600;
  color: var(--ink);
}
.task[data-tone="danger"] {
  border-color: var(--danger);
}
.task[data-tone="danger"]::before {
  background: var(--danger);
}
.task[data-tone="danger"] b {
  color: var(--danger);
}
.task[data-tone="warn"] {
  border-color: var(--warn);
}
.task[data-tone="warn"]::before {
  background: var(--warn);
}
.task[data-tone="warn"] b {
  color: var(--warn);
}
.task:hover {
  background: var(--sunk);
  border-color: var(--ink-soft);
}
.task[aria-pressed="true"] {
  background: var(--accent-soft);
  border-color: var(--accent);
  color: var(--accent-ink);
  box-shadow: inset 0 0 0 1px var(--accent);
}
.task[aria-pressed="true"] b {
  color: var(--accent-ink);
}
.tasksClear {
  font-size: var(--t-1);
  color: var(--muted);
  font-style: italic;
  white-space: nowrap;
}
.tasksEnd {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: none;
  margin-left: auto;
}
@media (max-width: 1000px) {
  .hdrBar,
  .stats,
  .tasks {
    padding-left: 14px;
    padding-right: 14px;
  }
  .hdrTools {
    width: 100%;
  }
  .search {
    flex: 1 1 12rem;
  }
  .who {
    display: none;
  }
  .taskList {
    flex-wrap: nowrap;
    overflow-x: auto;
  }
  .statsGrid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 640px) {
  .hdrClock span,
  .tasksEnd,
  .statsMenu > summary .count {
    display: none;
  }
  .statsGrid {
    grid-template-columns: 1fr;
  }
}
@media print {
  .hdrTools,
  .statsMenu,
  .tasksEnd,
  .menuPanel {
    display: none !important;
  }
  .hdr {
    border-bottom: 1px solid var(--line-strong);
  }
}
@media (forced-colors: active) {
  .search,
  .menu > summary,
  .menuPanel,
  .task,
  .stat {
    border: 1px solid CanvasText;
    box-shadow: none;
  }
  .task::before {
    background: CanvasText;
  }
}

/* ─── This page's own masthead: the second edition's title row, figures strip and clock, which
   the reference build dropped when its one row bar replaced them. They stay here for the
   standard's head and for the figure band in section 6, and for no screen. ─── */
.apRow {
  display: grid;
  gap: 6px;
}
.apLabel {
  font-size: var(--t-0);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--muted);
  font-weight: 600;
}
.topbar {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  padding: 14px 24px 12px;
  background: var(--surface);
  border-bottom: 1px solid var(--line);
}
.topbar h1 {
  font-family: var(--display);
  font-size: var(--t-6);
  font-weight: 600;
  line-height: 1;
  letter-spacing: -0.012em;
  color: var(--ink);
}
/* Title, chip and disclaimer are one flex group, so on a laptop the disclaimer drops under
   the title while the figures keep their row, instead of the figures dropping under both. */
.title {
  flex: 1 1 24rem;
  min-width: 0;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px 16px;
}
.topbar .sub {
  flex: 1 1 22ch;
  font-size: var(--t-1);
  color: var(--muted);
  max-width: 60ch;
  line-height: 1.45;
  text-wrap: pretty;
}
/* The figures: mono figures, uppercase labels, and no colour except red on a breach above zero. */
.state {
  margin-left: auto;
  display: flex;
  align-items: flex-start;
  gap: 20px;
}
.kpis {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 18px;
  align-items: flex-start;
}
.kpi {
  display: grid;
  gap: 3px;
  min-width: 4.75rem;
}
.kpi dt {
  font-size: var(--t-0);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--muted);
  font-weight: 600;
  white-space: nowrap;
}
.kpi dd {
  font-family: var(--mono);
  font-size: var(--t-5);
  font-weight: 500;
  letter-spacing: -0.02em;
  line-height: 1;
  color: var(--ink);
  display: flex;
  align-items: baseline;
  gap: 5px;
}
.kpi dd small {
  font-family: var(--body);
  font-size: var(--t-1);
  font-weight: 400;
  color: var(--muted);
  letter-spacing: 0;
}
.kpi dd i {
  font-family: var(--body);
  font-style: italic;
  font-weight: 400;
  font-size: var(--t-2);
  color: var(--muted);
  line-height: 1.2;
}
.kpi[data-tone="danger"] dd {
  color: var(--danger);
}
/* The clock is a tile like the figures, with the date as its label, so the whole right side of
   the masthead reads as one instrument. */
.clock {
  display: grid;
  gap: 3px;
  padding-left: 20px;
  border-left: 1px solid var(--line);
}
.clock span {
  font-size: var(--t-0);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--muted);
  font-weight: 600;
  white-space: nowrap;
}
.clock b {
  font-family: var(--mono);
  font-size: var(--t-5);
  font-weight: 500;
  letter-spacing: -0.02em;
  color: var(--ink);
}
@media (min-width: 1400px) and (max-width: 1599px) {
  .topbar .sub {
    flex: 1 1 100%;
    max-width: 60ch;
  }
  .kpis {
    gap: 6px 14px;
  }
}
@media (max-width: 1000px) {
  .topbar {
    padding: 12px 14px;
  }
  .state {
    margin-left: 0;
    flex-wrap: wrap;
  }
  .clock {
    border-left: 0;
    padding-left: 0;
  }
}
@media (max-width: 640px) {
  .topbar .sub {
    display: none;
  }
}
@media (forced-colors: active) {
  .topbar {
    border: 1px solid CanvasText;
    box-shadow: none;
    background: Canvas;
  }
}
@media print {
  .topbar {
    border-bottom: 1px solid var(--line-strong);
  }
}
```

### 15.8 The shell rules

Two files in the kit beside the harness carry the shell. `third-edition-kit/shell/shell.css` is every rule for the one row bar, the rail in both states, the Service selector, the three drawers, the search results, the New referral menu and the pinned fly out, restyled to this edition: tokens only, no hex, no solid grey line, no size off the scale, no weight that is not loaded, one elevation step, brass as a bar, the slate ring for what is selected, thin scrollbars, a focus ring on every control, and no hover that brightens. It loads after the reference build's stylesheet, inside the same style element, on Command and on the standard's page, and that page's copy is re-synced by the same step that re-syncs the block. It is not printed here for the reason 15.4 gives. `third-edition-kit/shell/shell-docs.css` holds the drawn layout, the screen cards, the prose columns and the page foot that section 14 uses, and is for the standard's page only, never for Command. `third-edition-kit/shell/shell-markup.html` is the app shell a screen starts from, and `third-edition-kit/shell/shell-script.js` is the shell's script over the engine's data through the `window.WardFlow` facade, with its own appearance control on the same key as the page. Its header comment lists every id, class, data attribute, key and engine symbol it depends on. The reference build's inline copies of the shell rules and the shell script are the source of truth. The two kit files are the last extracted copies and lag them until the final assembly step copies the inline blocks back over them.
