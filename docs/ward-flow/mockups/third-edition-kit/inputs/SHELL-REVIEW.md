# Shell review: the owner's universal header and rail against the third edition

Reviewed: `inputs/rail.html` (the owner's artifact, "Ward Flow Rail"), in both themes at 1920 by
1080, and the header at 1440, 1280 and 1100. Crops are under
`docs/ward-flow/mockups/third-edition-shots/shell-review/` and were taken by
`third-edition-kit/shell/cap-rail.mjs` with the font css name `premium`. There is no `premium`
fixture beside the harness, and the network did not serve the fonts, so every crop of the artifact
shows the fallback faces (DejaVu for the sans and the mono). Measurements that depend on glyph
width are marked as such and were re-measured on the preview with the third edition fonts.

Rules cited as B.n are the merge brief's material rules, T the brief's type rules, S.n the build
sheet rule numbers in SHELL-SPEC.md, and C.n the conflicts listed at the end of SHELL-SPEC.md.

## Part 1. Keep

What the header and rail do better than the current masthead and rail. Each is kept in the
restyled fragments.

1. **One row, and every figure still reachable.** The bar holds the title, the mark, search, the
   Service selector, three drawers and one primary action, and nothing else. The masthead's five
   figures and clock have not been lost: they are the four tiles and the "Now" facts of the
   Activity drawer's live tally, counted from the same data. Reason: the figures that crowded the
   masthead are read a few times a shift, and the queue is read all shift, so the queue gets the
   height. Crops: `light-header-rest.png`, `light-drawer-activity-tally.png`.
2. **Search that filters the list it sits over and refuses three things by name.** Typing narrows
   the queue as well as offering results, and "risk", "score" and "best match" return a sentence,
   not a list. The footer of the pop repeats the refusal. Reason: the masthead has no search, and a
   search that could be read as a ranking is the one thing this product must never offer. Crop:
   `light-search-results.png`, `dark-search-results.png`.
3. **The Service selector scopes the page and says so.** A dot in the service hue, the short name
   and the waiting count on the control, the full names and "none waiting" in the panel, and a
   stripe in the hue under the brand while one service is chosen. Reason: the masthead cannot
   narrow to a service at all, and a chosen scope that is easy to forget is dangerous. Crop:
   `light-service-open.png`, `dark-service-open.png`.
4. **State lines and tone dots on the rail.** Under Command "2 breached, 3 due soon", under
   Capacity "16 free, none at SJGM", under Referrals "oldest 2h 30m", with the tone on a 7 px dot
   beside the glyph and never on the count. Reason: the current rail carries two bare counts, and a
   red count can be misread as a count of breaches. Crop: `light-rail-open-top.png`.
5. **The shift block.** A ring filled to the shift's progress, the eyebrow with the clock, the
   time to handover in mono and a meter. Reason: the masthead's clock said only the time. The rail
   says how much shift is left, which is what the coordinator is actually planning against. Crop:
   `light-rail-open-top.png`.
6. **The closed strip with a hover card.** Seventy six pixels, a glyph and a word per screen, the
   counts as tags, the same tone dots, and a card on hover or keyboard focus that names the screen,
   its purpose and its state line. Reason: the current rail cannot close, and a strip without a
   card would lose the state lines. Crops: `light-closed-hover.png`,
   `light-closed-hover-referrals.png`, `dark-closed-hover.png`.
7. **Pinned movements with their tone bars and mono waits.** Pressing one selects it in the queue
   and scrolls to it. Reason: three movements a coordinator is watching are otherwise found by
   scrolling the queue. Crop: `light-rail-pinned.png`, `light-closed-pinned.png`.
8. **The reconciliation sentence in the foot, with the dot, in both states.** Reason: the current
   rail has it too, and the shell keeps it where the eye already looks for it. Crop:
   `light-rail-foot.png`.
9. **Drawers that behave.** One open at a time, a click outside closes, Escape closes and returns
   focus to the summary, the first focusable inside gets focus, and each opening is announced as a
   sentence. Reason: none of this exists in the masthead, and a drawer that traps focus is worse
   than no drawer. Crops: `light-drawer-activity.png`, `light-drawer-tasks.png`,
   `light-drawer-tools.png`.
10. **Tasks as filters, worst first, with notices first.** Each work row is a filter on the queue
    with `aria-pressed`, a row with a count of none is not shown, and a notice stays until marked
    seen. Reason: the current screen has no list of work, only registers. Crop:
    `light-drawer-tasks.png`.
11. **The live tally's tables read "none" in italics and carry a totals row of a different kind.**
    Reason: rule S.14.3, a nought is a measurement and none is a state. Crop:
    `light-drawer-activity-tally.png`.
12. **Placeholders that say so twice.** The contact tables show "ext 01" and addresses ending in
    `example.invalid`, with a note above and a foot below. Reason: S.14.7, and a prototype that
    shows a real looking number is the one that gets copied into a record. Crop:
    `light-drawer-tools.png`, `light-drawer-tools-bottom.png`.
13. **The bracket key and the remembered state.** The rail flips from anywhere that is not a field
    and the choice survives a reload. Reason: a control that lives only at the foot of the rail is
    off screen half the time.
14. **The skip link, the live region and the zero width space rule.** All present. Reason: the
    same rigour the branch build had, kept.

## Part 2. Change

Every place the shell breaks a third edition rule or the premium bar. Each item names the crop or
the selector and the exact change. All of these are applied in `shell/shell.css`,
`shell/shell-markup.html` and `shell/shell-script.js`.

### Type

1. **Page title at a weight the third edition does not load.** `.hdr1 h1 { font-weight: 500 }` on
   the display serif. Crop: `light-header-rest.png`. Change: `font-weight: 600`. (B type rules,
   only serif 600 and 700 are loaded.)
2. **Wordmark at 22 px and weight 500** (`.brand b` in the artifact's base block, and `.rail.open`
   inherits it). Crop: `light-rail-open-top.png`. Change: the third edition's base already sets
   `.brand b { font-size: var(--t-5); font-weight: 600; color: var(--accent-ink) }`, so the shell
   adds nothing and must not restate 22 px. (C.2.)
3. **"WF" at 19 px in the closed strip.** `.rail.closed .brand b { font-size: 19px }`. Crop:
   `light-closed-hover.png`. Change: `font-size: var(--t-5)`. (C.3.)
4. **The word under each strip glyph at 9.5 px.** `.rail.closed .railLabel .word { font-size:
9.5px }`. Crop: `light-closed-hover.png`. Change: `font-size: var(--t-0)`, and the strip widens
   if a word does not fit. Under the fallback fonts Governance measured 61 px at 9.5 px inside a
   60 px usable width, so it already touches. With Source Sans 3 at 10.5 px it was re-measured on
   the preview and the closed width set from that measurement (see SHELL-NOTES). Words never
   shrink. (C.4, owner decision.)
5. **Tags at 9 px in the closed strip and on the pinned fly out.** `.rail.closed .railLink .tag`
   and `.rail.closed .flyMenu > summary .tag`, both `font-size: 9px`. Crop:
   `light-closed-hover.png`, `light-closed-pinned.png`. Change: `font-size: var(--t-0)`. (T floor.)
6. **The percentage inside the small ring at 9 px.** `.ring.small b { font-size: 9px }`. This is
   the element the harness names in its typefloor failure. Crop: `light-rail-open-top.png`.
   Change: `font-size: var(--t-0); letter-spacing: 0`. (T floor.)
7. **Chart labels at a raw 10.5 px.** `.chart text { font-size: 10.5px }`. Change: `var(--t-0)`,
   so the floor is stated once. (T scale.)
8. **Drawer headings in the sans.** `.popHead h2` is body sans 600 in ink. Crop:
   `light-drawer-activity.png`. Change: `font-family: var(--display); font-size: var(--t-3);
font-weight: 600; letter-spacing: -0.012em; color: var(--accent-ink)`. A drawer head is a
   strip with a panel title. (B.11, C.6.)

### Colour and line

9. **Solid grey hairlines.** The artifact's base block sets `--line: #e1e7ee` and
   `--line-strong: #c7d1dd` (dark `#243040`, `#364554`). Every hairline in the shell reads them.
   Change: none in the shell's own rules, which name the tokens only. The graft must never carry the
   artifact's base block (RAIL-MAP d.5), so the alpha tokens arrive with the third edition block.
   (B.5, C.8.)
10. **A raw colour on the primary control.** `.menu > summary.primary { box-shadow: inset 0 1px 0
rgba(255, 255, 255, 0.14) }`. Change: `inset 0 1px 0 var(--hl-on-accent)`. (B.8.)
11. **Brass fills.** None found: gilt is used only as the bar on the chosen service row, the
    pressed task row, the current rail item, the chosen segment's underline, and the two letters
    beside the wordmark. `--gilt-soft` is never used. Recorded so the next builder does not add
    one. (B.6, C.10.)

### Controls: rest, hover, pressed, focus

12. **The primary control has no hover and no press.** Measured: background `rgb(27, 79, 130)` at
    rest and on hover. `.menu > summary:hover` sets the sunk fill, but `.menu > summary.primary`
    has the same specificity and is written later, so the primary never changes. Crops:
    `light-primary-rest.png` against `light-primary-hover.png` (identical). Change:
    `.menu > summary.primary:hover, .menu > summary.primary:active, .menu[open] >
summary.primary { background: var(--accent-ink); border-color: var(--accent-ink); color:
var(--on-accent) }`. (B.8, hover and press to accent-ink, never brighter.)
13. **The open summary takes the accent-soft fill without the slate ring.** `.menu[open] >
summary`. Crop: `light-service-open.png`. Change: add `box-shadow: inset 0 0 0 1px
var(--accent)`. (B.7, B.9, C.11.)
14. **The chosen service row, the pressed task row and the pressed pinned row take the fill
    without the ring.** `.menuItem[aria-pressed="true"]`, `.taskRow[aria-pressed="true"]`,
    `.pinRow[aria-pressed="true"]`. Crops: `light-service-open.png`, `light-drawer-tasks.png`.
    Change: `box-shadow: inset 0 0 0 1px var(--accent), inset 3px 0 0 var(--gilt)` on the first
    two (the brass bar stays), `inset 0 0 0 1px var(--accent)` on the pinned row (its tone bar is
    a pseudo element and stays). (C.11.)
15. **The current rail item takes the fill without the ring.** `.railLink[aria-current="page"]`.
    Crop: `light-rail-item-active-and-hover.png`. Change: `box-shadow: inset 0 0 0 1px
var(--accent)`, with the brass bar kept on the left. (C.11.)
16. **The open Tasks badge loses its ring.** `.menu[open] > summary .badge { background:
var(--surface) }` with no ring. Change: `background: var(--accent-soft); color:
var(--accent-ink); box-shadow: inset 0 0 0 1px var(--accent)`. (B.9, a selected pill.)
17. **A count of none drawn as a pill.** `screenTag` returns the word "none" and `.tag` draws it on
    the sunk pill (Capacity would show it when no site has a free bed, and the pinned fly out shows
    "0" when the service has no pinned movement). Change: the script sets `data-zero="true"` on the
    tag and the CSS draws that as the italic word in the body sans with no fill and no ring.
    (B.9, C.12.)
18. **Secondary buttons on a plain hairline.** `.railBtn { border: 1px solid var(--line) }` and its
    hover changes the fill but not the border. Crop: `light-rail-foot.png`. Change: `border-color:
var(--line-strong)`, hover and active `background: var(--sunk); border-color:
var(--ink-soft)`. The same for `.popHead .closeBtn`, whose hover left the border alone. (B.8.)
19. **A second elevation inside a drawer.** `.seg button[aria-pressed="true"] { box-shadow: inset
0 -2px 0 var(--gilt), var(--lift) }` lifts the chosen segment inside a drawer that is already
    the one lifted thing. Crop: `light-drawer-activity.png`. Change: `box-shadow: inset 0 0 0 1px
var(--line), inset 0 -2px 0 var(--gilt)`, no lift. (B.3, C.14.)
20. **Tap targets under 3 rem at a coarse pointer.** The artifact's tap floor list covers
    `.menu > summary`, `.menuItem` and `.search` but not `.qHit`, `.taskRow`, `.toolItem`,
    `.pinRow`, `.seg button`, `.closeBtn`, `.railBtn`, `.clearBtn` or `.seen`. Change: add them to
    the `(pointer: coarse), (max-width: 640px)` rule. (S.15.18.)
21. **Focus rings.** The global `:focus-visible` rule in the base block reaches every button and
    summary, and `.search:focus-within` draws the ring around the field, so no control was found
    without one. The closed strip's card also opens on `:focus-visible`. Recorded as checked; the
    preview's keyboard walk confirms it. (B.10.)

### Names, announcements and copy

22. **The Service control hides its own value from a screen reader.** `<summary
aria-label="Service. Filters this page.">` replaces the visible "All services 23" with a fixed
    label, so a reader never hears which service is chosen. Change: drop the `aria-label` and put
    `<span class="srOnly">Service: </span>` before the visible label, so the name reads "Service:
    All services 23". (B.10, every change of subject is spoken.)
23. **Dots without words.** `#actDot` (green, breathing while the last event is within five
    minutes) and `#tasksDot` (accent while a notice is new, red while a new notice is a breach)
    carry no text. Change: `aria-hidden="true"` on both dots and a `span.srOnly` beside each,
    written by the script: "live" or "quiet" for Activity, "3 new notices, one a breach" or "no new
    notice" for Tasks. (S.4.6, S.4.7, B.10.)
24. **Words removed from the accessible name by `display: none`.** `.rail.closed .railBtn span`
    ("Open the rail") and `.rail.closed .railCheck span` (the reconciliation sentence) are hidden
    with `display: none`, which removes them from the accessible name. The button falls back to its
    `title`, and the `p` has no name at all. Crop: `light-closed-hover.png` (the foot). Change: hide
    both with the `.srOnly` clip pattern instead, so the strip's button and the check line keep
    their words for a reader. (B.10.)
25. **The rail's `aria-label` names its state, twice.** Two navs, "Ward Flow sections, open" and
    "Ward Flow sections, closed", and the hidden one is still in the tree. Change: one nav,
    `aria-label="Ward Flow sections"`, and the state is announced when it changes. (RAIL-MAP d.6.)
26. **The Design system link points at the second edition artifact.** The Tools drawer links to
    `https://claude.ai/code/artifact/352faeba...`, labelled "second edition". Change: link to the
    sibling `design-system-third-edition.html` and label it "third edition".
27. **The brand stripe is painted over.** `body::before` sits at `z-index: 20`, the bar at 31 and
    the drawers at 40, all in the root stacking context, so the 3 px stripe is covered by the bar
    and by any open drawer. Change: `body::before { z-index: 45 }`, pointer events already off,
    and the skip link to 50 so it is not under the rail or the bar when focused. This adds one row
    to the sheet's layer table. (B.2, C.9, owner decision.)
28. **The drawer backdrop is nearly invisible.** `.drawerMenu[open]::before { background:
var(--edge-shade); opacity: 0.6 }` measured as `rgba(14, 24, 38, 0.16)` at 0.6, about a tenth
    of a shade. Under the third edition's light token, `rgba(30, 48, 66, 0.16)`, 0.6 of it would
    be fainter still. Crop: `light-drawer-activity.png` (the page behind is barely dimmed). Change:
    drop the opacity and use the token at full strength (light 0.16, dark 0.55). Measured on the
    preview and recorded in SHELL-NOTES. (C.13.)

### Layout and the ladder

29. **The bar overflows at 1280.** Measured under the fallback fonts: the end group's right edge
    at 1318 px on a 1280 px window, and the document scrolls sideways by 39 px, because
    `.hdr1 .title` and `.hdr1 .end` are both `flex: none` and the search is already at its 10 rem
    floor. Crop: `light-header-1280.png` (the primary is cut at the right edge). With Source Sans
    3 the group is narrower, so this was re-measured on the preview. Change: the drawer words and
    the chip go at 1300 rather than 1240 in the merged ladder, and `.hdr1 .end` takes `min-width:
0`, so the row can never push the document sideways whatever face is loaded. (S.4.12,
    S.15.8.)
30. **Two rails and a demo switcher.** `#railHost` holds two empty `nav.rail` elements, both
    rendered on every pass, with `data-view` on `#hApp`, the `.oBar` switcher, the number keys and
    the `both` value. Change: one `nav.rail`, `data-rail="open|closed"` on the root set before first
    paint, the rail's own button and the bracket key, remembered under `ward-flow-rail`, no
    switcher, no number keys, no `railCap`. (RAIL-MAP d.6, owner decision.)
31. **The shell's own data.** `MOVES`, `REFERRALS`, `BEDS`, `WARDS`, `EXTRA`, `OVERRIDES` and
    `window.__headerCheck`. Change: the script reads the engine's `MOVEMENTS`, `UNITS`, `EDS`,
    `REFERRALS` and `OVERRIDES` through a facade, appends its sum checks to the engine's
    `window.__commandCheck`, and the beds by site are summed from `UNITS`. (RAIL-MAP d.8, owner
    decision.)
32. **The stand in Command body and its ids.** `#qList`, `#qCount`, `#qFilter`, `#exBody`,
    `#exCount`, `#refBody`, `#refCount` collide with the engine's. Change: the body is the engine's,
    the skip link targets `#qpane-patients`, and the shell's queue handlers look for
    `.qRow[data-mv]` in `#qpane-patients`. (RAIL-MAP d.4.)

## Part 3. Improve

What to add or simplify, each tied to a rule or a defect, with its cost in words on the screen.

1. **The date beside the time in the shift block.** The masthead's clock said "Sat 15 Aug, 10:42
   AWST" and the one row bar has no home for it (C.15, owner decision). Put the date in the shift
   eyebrow: "Day shift, Sat 15 Aug" with 10:42 at the right. Cost: three words.
2. **The diagram foot says the map is the whole network.** When a service is chosen the queue and
   the pressure strip narrow and the Statewide flow does not (RAIL-MAP d.4 item 9, owner
   decision). The shell exposes the sentence "Showing the whole network. The queue is scoped to
   South Metropolitan." for the graft to place in `.diagFoot` while a service is chosen. Cost:
   eleven words, only while a service is chosen.
3. **Search finds wards and departments from the engine's own names.** The artifact's search
   matched a typed list of ward strings. The rewritten `hits()` reads `UNITS` and `EDS`, so a ward
   hit filters the queue to movements whose route names that ward. Cost: none.
4. **The first search result reads as the Enter target.** `.qHit[data-active="true"]` is drawn the
   same as a hovered hit. Give it the slate ring over the sunk fill, so a keyboard user can see
   what Enter will pick. Cost: none. (B.7, selection is a ring.)
5. **The tone dot names its tone.** In the open rail the dot is `aria-hidden` and the button has
   no text for it. The closed strip already folds "a legal deadline has passed" or "look here" into
   its `aria-label`. Do the same in the open rail with a `span.srOnly` after the state line. Cost:
   none visible.
6. **Drop the switcher, the cards, the drawn layout, the four prose columns and the page footer
   from Command.** They are review and design system content (RAIL-MAP d.2). The "layout drawn"
   and "every screen cards" rules go to `shell/shell-docs.css` restyled, for the standard's screens
   index. Cost: the Command page loses nothing a coordinator reads, and gains the height.
7. **One Escape order across shell and engine.** The artifact and the engine each listen for
   Escape, so a press could clear a ward selection and close a drawer at once. The shell's handler
   owns the order (pop out, search results, search text, ward selection, referral subject,
   department filter, task filter, service) and the engine's own handler steps aside when the shell
   is present. Cost: none. (S.3.18, S.4.24.)
8. **Notices derived from the engine's register.** The artifact's notices came from a typed
   `EXTRA` list. The rewrite derives them from `OVERRIDES` (an override recorded) and from breaches
   within the last hour, which are the two of the three kinds in S.16.6 the engine's data can
   support. A bed pulled has no time in the engine's data, so it is not invented. Cost: none.
9. **Owners.** The engine's movements carry no owner field, so the "with no owner" task, the
   owners group in search and the "Owner" words in exceptions cannot be derived. The script treats
   an explicit `owner: null` as no owner and an absent field as not tracked, so the row appears
   only once the engine records owners. Cost: none, and nothing is invented. (S.14.1, derived and
   never typed.)
10. **The Tasks badge weight.** `.badge` is mono 600 while the rail's `.tag` is mono 500. Set both
    to 500 so the two pills read as one kind. Cost: none.
