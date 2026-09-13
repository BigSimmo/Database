# Ward Flow Rail: map of the owner's artifact and the plan to build the third edition Command over it

Source: `inputs/rail.html`, 6600 lines, title "Ward Flow Rail". Fonts Newsreader, IBM Plex Sans, IBM Plex Mono.
Compared against `merged/source-L-command.html` (the Live edition Command, 6664 lines) and
`merged/command-third-edition.html` (the third edition Command, 6760 lines).
Working files for this map are under `inputs/s2/`. Nothing under `merged/` was changed.

Every line number below is a line of `inputs/rail.html` unless it says otherwise.

## Part a. The page's structure

### a.1 The file at a glance

| Lines        | What                                                                                                                          |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| 1            | The artifact wrapper's own head: a minimal reset, `color-scheme: light`, system font, a hidden rule.                          |
| 2 to 8       | `<title>`, font preconnects and the Google Fonts link for Newsreader, IBM Plex Sans and IBM Plex Mono.                        |
| 9 to 4913    | One stylesheet. 9 to 2200 is the design system second edition block. 2201 to 4913 is everything the rail page adds (see a.8). |
| 4914 to 4927 | The "Rail views" switcher bar (`.oBar`).                                                                                      |
| 4929 to 5078 | The app shell (`#hApp`): skip link, rail host, header, body and the sections below the page.                                  |
| 5079 to 6559 | The main script: the quiet bar engine plus the rail.                                                                          |
| 6560 to 6599 | The appearance script (Light, Dark, Auto).                                                                                    |

### a.2 The switcher, lines 4914 to 4927

`div.oBar[role=region][aria-label="Rail views"]`, sticky at the top of the window (43 px, exposed as `--obar`). It holds:

- `span.oLabel` "Rail views".
- `div.oSeg[role=group]` with three `button.oBtn[data-view]` for `open`, `closed` and `both`. Each carries a `kbd` showing its number key (1, 2, 3) and `aria-pressed`.
- `p.oNote#oNote`, one sentence describing the chosen view, filled by the script from `NOTES`.
- `div.appearance[role=group]` with three `button.apBtn[data-set-theme]` for light, dark and auto, pushed to the right.

This bar is a demo control. It does not belong on the product's Command screen.

### a.3 How many copies of the app shell exist

One. There is a single `#hApp` (line 4929) carrying `data-view="open"`, and it contains one header and one body. What is doubled is the rail: `#railHost` (4931 to 4934) holds two empty `nav.rail` elements, `nav.rail.open[data-rail=open]` and `nav.rail.closed[data-rail=closed]`. The script renders both on every `renderAll`, and CSS decides which is displayed:

- `.hApp[data-view="open"] .rail.open` and `.hApp[data-view="closed"] .rail.closed` are `display: flex`, the other is `display: none` (lines 4013 to 4016).
- `.hApp[data-view="both"]` shows both, side by side, with a three column grid `236px 76px minmax(0, 1fr)` (4020 to 4028), hides both `.railBtn` toggles, shows the `.railCap` labels ("Open 236 pixels", "Closed"), and also hides the header's chip and the drawer labels and narrows search (4056 to 4062).

The grid column for the rail is `--railw` (236 px, 76 px when closed) and animates over 0.18 s, disabled under reduced motion (4862).

### a.4 The header, lines 4939 to 4987

`header.hdr1[aria-label=Header]`, a single 56 px row, `z-index: 31`, on `--surface` with a hairline below. Left to right:

1. `div.title`: `h1#pageTitle` "Command" (rewritten by `renderPage`) and `span.chip.mark` "Synthetic prototype" with the word "Synthetic" wrapped in `span.long` so it can drop first. The chip carries the disclaimer as a `title`. There is no `.sub` disclaimer line, no `dl.kpis` and no clock, all of which the Live edition header has.
2. `div.searchWrap#searchWrap` (4944 to 4952): `label.search` with a magnifier svg, `input[type=search]#q` (placeholder "Search patients, movements, wards, owners", a long `aria-label` that states the refusals, no autocomplete), `kbd#qHint` "/", `button.clearBtn#qClear[hidden]`, then `div.qPop#qPop[role=group]` the results pop. `data-open` on `#searchWrap` is set by `renderSearch`.
3. `details.menu.svcMenu#svcMenu` (4953 to 4960): the Service selector. Summary carries `span.dot#svcDot[hidden]`, `span.lbl#svcLabel` "All services", `span.count#svcCount`. Its `div.menuPanel` has `p.menuHead` "Service, filters this page", `div#svcList` (rendered buttons), `p.menuNote`.
4. `div.end` (4961 to 4986), pushed right, holding four `details.menu`:
   - `#activityMenu.drawerMenu.wide[data-menu=activity]`: summary with a line glyph, `span.lbl.optional` "Activity", `span.dot#actDot[data-tone=good]`. Panel `#activityPanel`.
   - `#tasksMenu.drawerMenu[data-menu=tasks]`: summary with a checklist glyph, `span.lbl.optional` "Tasks", `span.badge#tasksCount`, `span.dot#tasksDot[hidden]`. Panel `#tasksPanel`.
   - `#toolsMenu.drawerMenu.wide[data-menu=tools]`: summary with a spanner glyph, `span.lbl.optional` "Tools". Panel `#toolsPanel`.
   - `#newMenu`: `summary.primary` "New referral" (the one primary action) and a static panel with three `button.menuItem[data-new]` (emergency department, community team, GP or private practice) and a note that it is not wired.

The drawers are `details` elements whose `.menuPanel` is positioned as a full height panel on the right edge (`.drawerMenu`, measured at 576 px wide for `.wide` and 448 px for Tasks, top 0 to the bottom of the window). The Service and New referral panels are ordinary dropdowns under their summaries.

### a.5 The rail markup

Nothing of the rail is in the static markup. `renderRail(nav, closed, f)` (script 6393 to 6415) writes `nav.innerHTML` for each of the two navs on every render. What it writes:

Open rail (236 px):

- `p.railCap` ("Open", "236 pixels"), shown only in the Both view.
- `div.brand` with `b` "Ward Flow" and `span` "WA".
- `i.svcStripe[data-svc]`, a hairline in the service hue under the brand, only when a service is chosen.
- `div.railScroll` (the scrolling middle):
  - `div.railBlock[aria-label=Shift]`: `div.shiftRow` with `div.ring.small[role=img]` (an svg ring, arc length from `(NOW - 07:00) / (14:00 - 07:00)`, `b` "53%"), `p.eyebrow` "Day shift" with `span.count` "10:42", `p.big` "3h 18m" with `small` "to handover at 14:00", then `div.meter` with an `i` sized to the same percentage.
  - The three groups from `railGroups(f, false)`: `div.railGroup[role=group][aria-label]` with `p.railEyebrow` (Operations, Network, Records) and one `button.railLink[type=button][data-page][data-state][title=purpose]` per screen, `aria-current="page"` on the current one. Inside: `span.railLabel` holding `svg.railGlyph` and `span.railText` (a `span` with the title and an `em` with the state line when there is one), then `span.tag` (count or "none" or "14:00") and `span.toneDot[data-tone=danger|warn][aria-hidden]`.
  - `div.railGroup.pinGroup` "Pinned" with `button.pinRow[data-pin][aria-pressed][data-tone][title]` rows: `span.id`, `b` name, `span.wait`.
- `div.railFoot`: `p.railUser` ("Signed in as", `b` "Bed coordinator"), `p.railCheck[data-ok]` with a `span` carrying `checkText(f)`, `p.railNote` "Every figure and name here is invented."
- `button.railBtn[data-rail-toggle=closed]` "Close the rail" with `kbd` "[".

Closed strip (76 px):

- `p.railCap`, `div.brand` with `b` "WF" and `span` "WA" (the span is hidden by CSS), `i.svcStripe`.
- The same three groups from `railGroups(f, true)`, each link a `button.railLink[data-page][aria-label]` where the aria label carries title, count and "a legal deadline has passed" or "look here". Inside: `span.railLabel` with the glyph and `span.word` (the short name: Command, Movement, Capacity, Wards, EDs, Teams, Search, Referrals, Handover, Statistics, Governance), `span.tag` absolutely positioned top right, `span.toneDot`, and `span.flyCard[aria-hidden]` (`b` title plus tag, `em` purpose, `span.stateLine`). The card shows on `:hover` and `:focus-visible` (4532).
- `div.railFoot`: `details.menu.flyMenu#pinMenu` (summary with the pin glyph and `span.tag` count, panel with the pinned rows), `div.ringRow[title]` with `div.ring` and `b` "BC", `p.railCheck[data-ok][title]` with the check sentence in a hidden span (only the dot shows).
- `button.railBtn[data-rail-toggle=open]` "Open the rail".

Group membership is fixed in `SCREENS` (script 6206 to 6269): Operations holds command, movement, capacity. Network holds wards, eds, teams. Records holds search, referrals, handover, statistics, governance. `raise` is a flow with no rail entry.

### a.6 The Command body, lines 4989 to 5011

`div.hScroll` is the scrolling region under the header. Its first child `div.hGrid#bodyCommand` is the Command page:

- `section.panel.qPanel[aria-label="Priority queue"]`: `div.ph` with `h2`, `p.note` ("Worst first: deadlines passed, then the nearest deadline, then the longest wait."), `span.count#qCount`. Then `div#qFilter` (the filter bar) and `ul.qList#qList[tabindex=0][aria-label="Open movements"]`.
- `div.hCol`: `section.panel#exPanel` (Exceptions, `#exCount`, `div.pb#exBody`) and `section.panel#refPanel` (Referrals awaiting triage, `#refCount`, `div.pb#refBody`).

This is not the Live edition Command body. It is the quiet bar prototype's stand-in body: one queue list, an exceptions list and a referrals list. It has no emergency department pressure strip, no queue tabs, no statewide flow diagram, no register tabs (Exceptions, Declines, Overrides, Refused) and no explainable shortlist.

### a.7 The sections below the page

- `section.panel.pageBody#bodyScreen[hidden]` (5013 to 5017): shown instead of `#bodyCommand` when another screen is chosen from the rail or a card. `h2#screenTitle`, `p.note#screenGroup`, `div.sFacts#screenFacts`, `div.schema#schema` (the drawn layout: a mini rail, a "Quiet bar", columns of `button.sBlock[data-block]`).
- `section.panel#mapPanel` "Every screen" (5019 to 5022): `div.map#map` filled with twelve `button.card[data-screen]` (thumbnail, title, group and count, purpose, panel count and primary action). `#mapCount` says "12 screens".
- `section.panel[aria-label="The rail, open and closed"]` (5024 to 5069): `div.hFeatures` with four `h3` columns of prose: "Open, 236 pixels" (5028), "Closed, 76 pixels" (5039), "What was added, and why" (5048), "Considered, not built" (5058). The last two are columns of this section, not sections of their own.
- `footer.panel.hFoot` (5071 to 5075): what is invented and what is real.

### a.8 The stylesheet, 2201 to 4913, block by block

| Lines        | Block                                                      | Notes                                                                                                                                                                                                                                                                                                                                                                                |
| ------------ | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2201 to 2423 | "extension: what Command does not have and other pages do" | Zero as a state, totals row, figure band, look here, delta, charts, disclosures, the 3rem tap floor, print. Most of it is unused by this page (see the unused list in d.3).                                                                                                                                                                                                          |
| 2424 to 3074 | "universal header"                                         | The older three row header: title row, statistics strip (2721) and outstanding tasks bar (2896). The classes `.hdr`, `.hdrBar`, `.hdrClock`, `.hdrTools`, `.stats`, `.kpi`, `.tasks`, `.task` and their kin are defined here and never used by rail.html. The menu, `.menuPanel`, `.menuItem`, `.menuHead`, `.menuNote`, `.glyph`, `.badge` and `.dot` rules in this block are used. |
| 3075 to 3750 | "The quiet bar: page-specific rules"                       | `.hApp`, `.hFrame`, `.hdr1`, universal search (3207), the Service selector (3284), the drawers (3294), drawer parts (3384), the live tally (3594), the tools drawer (3668).                                                                                                                                                                                                          |
| 3751 to 3824 | "the body"                                                 | `.hScroll`, `.hGrid`, `.hCol`, `.hGrid .qList` max height, `.hFeatures`, `.hFoot`.                                                                                                                                                                                                                                                                                                   |
| 3825 to 3906 | "collapse ladder"                                          | 1500: drop "Synthetic". 1240: drop the chip and the drawer labels, search basis 10rem. 1000: one column, rail static, header wraps, search full width. 640: menu panel 94vw, tally one column. Print. Forced colours.                                                                                                                                                                |
| 3907 to 4063 | "The rail, open and closed" (the views)                    | `.oBar` and its parts, `--obar`, `--railw`, `.railHost`, the `data-view` rules, `.railCap`, the Both view header tweaks.                                                                                                                                                                                                                                                             |
| 4064 to 4360 | "shared pieces"                                            | `.railScroll`, `.svcStripe`, `.railBlock`, `.shiftRow`, `.meter`, `.ring`, `.railText`, `.toneDot`, `.pinRow`, `.railBtn`.                                                                                                                                                                                                                                                           |
| 4361 to 4395 | "open"                                                     | `.rail.open` overrides: brand, link padding, `data-state` links, tag placement, pin group, foot.                                                                                                                                                                                                                                                                                     |
| 4396 to 4601 | "closed: the strip"                                        | `.rail.closed` brand, groups, links, `.word`, glyph, tag (9 px), `.flyCard` and its arrow, foot, `.flyMenu`, `.ringRow`, `.railBtn`.                                                                                                                                                                                                                                                 |
| 4602 to 4748 | "the screen's layout, drawn"                               | `.schema` and its parts.                                                                                                                                                                                                                                                                                                                                                             |
| 4749 to 4913 | "every screen, as cards" and the tail                      | `.map`, `.card`, reduced motion, the 1000 px rules for the views, print (hides `.oBar`, `.railBtn`, `.railCap`, `.flyCard`), forced colours.                                                                                                                                                                                                                                         |

### a.9 Every id the scripts read

Main script, by `$(id)`:
`live`, `hApp`, `oNote`, `pageTitle`, `q`, `qHint`, `qClear`, `qPop`, `searchWrap`, `svcMenu`, `svcList`, `svcLabel`, `svcCount`, `svcDot`, `activityPanel`, `actDot`, `tasksPanel`, `tasksCount`, `tasksDot`, `toolsPanel`, `newMenu`, `qList`, `qCount`, `qFilter`, `exBody`, `exCount`, `refBody`, `refCount`, `bodyCommand`, `bodyScreen`, `screenTitle`, `screenGroup`, `screenFacts`, `schema`, `map`, `mapCount`.

By selector: `.rail.open`, `.rail.closed`, `details.menu` (collected into `menus` after every rail render), `#activityPanel .part`, `#activityPanel .seg button`, `.menuPanel button, .menuPanel input, .menuPanel a` (first focusable in an opened menu), `summary` (focus return), `.qHit`, `.qRow[data-id]`.

By id in the appearance script: `live`. By selector: `[data-set-theme]` anywhere in the document, which is why the appearance group rendered inside the Tools drawer works.

Ids the script creates in rendered html: `pinMenu` (closed strip). Every other rendered element is addressed by class and data attribute.

### a.10 Every data attribute the scripts read or set

| Attribute                                                     | Where                                                 | Meaning                                                              |
| ------------------------------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------- |
| `data-view`                                                   | `.oBtn` and `#hApp`                                   | open, closed, both. Set by `setView`.                                |
| `data-rail-toggle`                                            | `.railBtn`                                            | closed or open, the target view.                                     |
| `data-page`                                                   | `.railLink`                                           | screen key, `setPage`.                                               |
| `data-screen`                                                 | `.card`                                               | screen key, `setPage` then scroll.                                   |
| `data-block`                                                  | `.sBlock`                                             | column-block key inside the drawn layout, toggles `state.section`.   |
| `data-section`, `data-target`                                 | none in the current render                            | Dead handler left from the removed "current screen's sections" rows. |
| `data-pin`                                                    | `.pinRow`                                             | movement id, selects it in the queue.                                |
| `data-svc`                                                    | `.menuItem` in the Service list, `.dot`, `.svcStripe` | service key or empty for all.                                        |
| `data-part`                                                   | `.seg button` and `.part` panels in Activity          | activity or tally.                                                   |
| `data-hit`, `data-id`, `data-text`, `data-key`, `data-active` | `.qHit`                                               | patient, text or action hits.                                        |
| `data-new`                                                    | New referral items                                    | source name for the announcement.                                    |
| `data-act`                                                    | `.toolItem`                                           | print, export, new, signout.                                         |
| `data-close`                                                  | `.closeBtn` in drawers                                | close the enclosing details.                                         |
| `data-notice`                                                 | `.seen` buttons                                       | notice key marked seen.                                              |
| `data-go`                                                     | "Show in queue"                                       | queue.                                                               |
| `data-task`, `data-kind`                                      | `.taskRow`                                            | task key, filter or go.                                              |
| `data-clear`                                                  | filter bar buttons                                    | q or all.                                                            |
| `data-tone`                                                   | dots, rows, tiles, `b` in sentences                   | danger, warn, good.                                                  |
| `data-ok`                                                     | `.railCheck`                                          | true or false.                                                       |
| `data-open`                                                   | `#searchWrap`                                         | pop visible.                                                         |
| `data-fade-top`, `data-fade-bottom`                           | `#qList`                                              | measured scroll fades.                                               |
| `data-state`                                                  | open rail links                                       | has a state line.                                                    |
| `data-t`                                                      | `.tier`                                               | tier number.                                                         |
| `data-fresh`                                                  | notices                                               | new or seen.                                                         |
| `data-on`, `data-primary`                                     | schema decoration                                     | current screen marker, primary action bar.                           |
| `data-set-theme`                                              | `.apBtn`                                              | light, dark, auto.                                                   |
| `data-menu`                                                   | drawer details                                        | present in markup, never read.                                       |

Storage keys: `ward-flow-rail-view` (open, closed, both) and `ward-flow-header-appearance` (light or dark, removed for auto). The Live edition uses `ward-flow-command-appearance`.

Globals: `window.__headerCheck` (the reconcile problem array, empty when figures reconcile), `window.__probe()` (returns total, breached, soon, free, refs, outstanding, check, svc, page, part, view), `window.__reflectAppearance()`. There is no `window.__commandCheck`.

Keys: `/` focuses search, Escape unwinds one layer at a time (open menu, then the results pop, then the search text, then the selection, then the task filter, then the service), `1` `2` `3` choose a view, `[` flips open and closed, Enter in search takes the first hit, ArrowDown moves into the hits.

## Part b. The engine diff

### b.1 Stylesheet base block: rail 9 to 2200 against source-L-command 8 to 2188

Not identical, but nearly. `diff inputs/s2/L-style.css inputs/s2/rail-style-a.css` is 51 lines in ten hunks:

1. The header comment. Source L says "WARD FLOW COMMAND. Live edition". The rail says "WARD FLOW DESIGN SYSTEM, second edition. The stylesheet every mockup copies. Copy this block verbatim." So the rail carries the design standard's copy of the block rather than the Command file's copy.
2. Three `--lift` declarations reformatted over three lines. Same values.
3. Five font sizes turned into tokens: `13px` to `var(--t-3)` at rail lines 261, 506 and 1541 (a real change, 13 to 13.5 px), `14px` to `var(--t-3)` at 967 (14 to 13.5 px), `10px` to `var(--t-0)` at 1604 (10 to 10.5 px). The third edition made four of these same substitutions (E3 lines 563, 1029, 1615, 1678) and not the one at source L line 250.

Everything else in the 2181 lines is byte identical, including all of the Command page's own rules (`.grid3`, `.qPanel`, `.diagPanel`, `.tabsPanel`, `.slPanel`, the widths table). The rail file therefore already carries the Live edition Command's CSS, unused.

### b.2 The scripts: rail 5079 to 6559 against source-L-command 2530 to 6622

Extracted to `inputs/s2/rail-script.js` (1481 lines) and `inputs/s2/L-script.js` (4093 lines). They are two different programs. Only eight function names are shared (`announce`, `esc`, `figures`, `reconcile`, `renderAll`, `renderExceptions`, `updateFades` and the anonymous wrapper) and only three non-trivial lines are identical (the `getElementById` return inside the `$` helper, the `scrollHeight` minus `clientHeight` measurement inside `updateFades`, and the `renderExceptions` function header). Nothing of the Command engine is inside rail.html.

What is identical: nothing beyond those three lines.

What changed inside "the Command engine", taking the rail's stand-in as the comparison:

- Data. Source L: `UNITS` (wards with beds, ready, held, blocked, occupied, sex mix, locks, stale windows), `EDS`, fourteen `MOVEMENTS` (WF-002, 004, 006, 009, 011, 013, 014, 017, 019, 021, 023, 026, 028, 031) with diagnoses, legal status, referrals, declines and escalations, `REFERRALS`, overrides, refused actions and the events register. The rail: `EDS` (eight departments with a service), twenty three `MOVES` built by `M(id, tier, ed, wait, deadline, owner, dest, kind, bed, declined, referredAt, given, family)` (WF-007 to WF-034, nine ids in common with source L but different people and different facts), four `REFERRALS`, six `BEDS` sites, eight `WARDS` contacts, `OVERRIDES = 4`, `HANDOVER`, `NOW`, `NOW_MIN`, and four `EXTRA` events. Everything in the rail is derived from these on every render and scoped to the chosen service.
- Reconcile. Source L's `reconcile()` (L 6200 onward) checks ward bed arithmetic, sex mix, duplicate ids, unknown departments, the three parallel referral limit, contention counts and pointed-at eligibility, and stores the problem list in `window.__commandCheck`, which `#railCheck` reads. The rail's `reconcile(f)` (5305) checks three sums (departments, services, tiers equal the total) into `CHECK`, exposed as `window.__headerCheck`, and `checkText(f)` writes the sentence into the rail foot.
- Render functions. Source L: `renderFigures` (the `#kpis` strip), `renderEds`, `renderQueueTabs`, `renderQueues`, `renderPatientQueue`, `renderReferralQueue`, `renderDiagram`, `renderLegend`, `renderShortlist`, `renderReferralPlacement`, `renderTabs`, `renderDeclines`, `renderOverrides`, `renderExceptions`, `renderRefusals`, `renderAll`, `selectMovement`, `selectReferral`. The rail: `renderRails`, `renderService`, `renderActivity`, `renderTasks`, `renderTools`, `renderSearch`, `renderQueue`, `renderExceptions`, `renderReferrals`, `renderPage`, `renderScreen`, `renderMap`, then `setView`.
- Ids. Source L reads `slPanel`, `legend`, `edList`, `edCount`, `diagWrap`, `tabBody`, `refBody`, `railOpen`, `railGov`, `railCheck`, `qpane-referrals`, `qpane-patients`, `qRefCount`, `qPatCount`, `qHeading`, `qFilter`, `qCount`, `ovBody`, `live`, `legendToggle`, `kpis`, `exBody`, `diagStatus`, `diagScrollNote`, `decScope`, `decBody`. Seven ids exist in both markups: `exBody`, `exCount`, `live`, `qCount`, `qFilter`, `refBody`, `refCount`. Six of them mean different things in each file. In source L `#refBody` and `#refCount` are the Refused actions register, in the rail they are Referrals awaiting triage. `#qCount` in source L is the count beside "Priority queue" over two tabbed panes, in the rail it is the count of one list. `#exBody` in source L is a tab pane body, in the rail a panel body.

What is purely new shell code, none of which exists in source L:

- 5085 to 5171 data, 5173 to 5231 helpers, 5232 to 5248 service scope, 5249 to 5264 tasks as tests, 5265 to 5316 derived figures and reconcile, 5317 to 5463 the pages' tallies (`PAGES` for command, capacity, referrals), 5464 to 5495 sort and filter with refusals, 5496 to 5592 universal search, 5593 to 5664 activity (events, notices, summary sentence, tally), 5665 to 5706 tasks, 5707 to 5745 tools, 5746 to 5763 the Service selector, 5764 to 5872 the body renderers, 5873 to 5918 state changes, 5919 to 5963 menus (one open at a time, click outside closes, Escape returns focus to the summary), 5964 to 6176 events.
- 6177 to 6318 every screen (`ICON`, `GROUPS`, `SCREENS`, `SCREEN_ORDER`, `PINNED`, `pageOf`, `exceptionsCount`, `screenTag`, `sectionsOf`, `glyph`), 6319 to 6422 the rail (`stateLine`, `tagTone`, `railLink`, `railGroups`, `ringHtml`, `pinnedRows`, `pinnedCount`, `checkText`, `renderRail`, `renderRails`), 6423 to 6473 the drawn layout and the map, 6474 to 6553 the views (`VIEW_KEY`, `NOTES`, `setView`, the view click and key handlers, `restoreView`), 6554 to 6558 `window.__probe`.

### b.3 The Command body markup

Source L 2189 to 2529 (341 lines, extracted to `inputs/s2/L-markup.html`): `div.app` with `a.skip[href=#qpane-patients]`, a static `nav.rail` (brand, three groups of `button.railLink` with `#railOpen` "14" on Command and `#railGov` "4" on Governance, a `div.railFoot` with `#railCheck`, the `div.apRow` appearance control `#appearance` and the `.railNote`), then `div.frame` with `#live`, `header.topbar` (`h1`, `.chip.mark`, `.sub` disclaimer, `.state` with `dl.kpis#kpis` and `.clock`), and `div.scroll` holding the Emergency department pressure section (`#edList`), `div.grid3` (the tabbed queue panel with `qtab-patients` and `qtab-referrals`, `#qFilter`, `ul#qpane-patients` and `ul#qpane-referrals`), `div.midCol` (Statewide flow with `#diagWrap`, `#legend`, `#legendToggle`, and the registers tab panel with `pane-exceptions`, `pane-declines`, `pane-overrides`, `pane-refused`) and `section#slPanel`.

The rail's Command portion is 4990 to 5011 (22 lines, described in a.6). The two share the classes `panel`, `ph`, `note`, `count`, `qPanel`, `qList` and nothing structural. Neither is a rewrite of the other.

### b.4 Source L against the third edition

`diff` of the three parts between `merged/source-L-command.html` and `merged/command-third-edition.html`:

- Script (L 2530 to 6622 against E3 2626 to 6718): zero differing lines.
- Appearance script: zero differing lines.
- Markup (L 2189 to 2529 against E3 2285 to 2625): zero differing lines.
- Stylesheet (L 8 to 2188 against E3 8 to 2284): 486 differing lines in 41 hunks, saved as `inputs/s2/L-vs-E3-style.diff`. They are the token block for both themes (the platinum neutrals, brass, teal and plum, alpha hairlines, `--ground-hi`, `--ground-2`, `--stripe`, `--hl-on-accent`, `--r1i`), the fonts (Source Serif 4, Source Sans 3, JetBrains Mono), the canvas gradient and the 3 px brand stripe, panel titles in `--accent-ink` on the display serif at 600, strip corners on `--r1i`, the pressed pressure card and showing candidate keeping their status bar with a three sided ring, `#diagWrap svg text.t-ed` on the serif, the count pill on the well, forced colour and print rules for the stripe, and the rewritten header comment with the recomputed contrast pairs.

So every one of the "forty review fixes" in the third edition is a stylesheet change. The engine and the markup are the Live edition's, untouched.

### b.5 `window.__commandCheck`

It does not exist in rail.html. In source L and the third edition it is set at script line L 6592 (E3 6688) to the array `reconcile()` returns, and the rail foot reads it. The rail file exposes `window.__headerCheck` instead, the shell's own three sum checks, which was empty in every run, and `window.__probe()`, which returned `{"total":23,"breached":2,"soon":3,"free":16,"refs":4,"outstanding":19,"check":[],"svc":null,"page":"command","part":"activity","view":"open"}` at every viewport in both themes.

## Part c. What the runs and the screenshots show

### c.1 `node merged/check.mjs inputs/rail.html premium`

Output is in `inputs/s2/check-rail.txt` and in the structured return. Summary:

- Passes: fonts (IBM Plex Mono, IBM Plex Sans, Newsreader all loaded), page errors (none at any of the five viewports in either theme), sideways overflow (0 px at 1920, 1440, 1280, 1200 and 390), contrast (0 low of 422, 354, 317 and 338 sampled elements at the four wide viewports, both themes), the appearance control's first click from a dark machine (background went from rgb(12, 17, 25) to rgb(243, 245, 248) with `data-theme=light`), and the keyboard focus ring (the skip link).
- Fails, and why:
  - `reconcile` at every viewport: "absent". The check reads `window.__commandCheck` and the file exposes `window.__headerCheck`. This is the switcher-era shell, not the Command engine.
  - `typefloor` at the four wide viewports: "min 9px html, small: [["B",9]]". The element is `.ring.small b` (rail line 4208), the "53%" inside the shift ring in the open rail. In the closed strip, which the check never opens, `.rail.closed .railLink .tag` (4460) and `.rail.closed .flyMenu > summary .tag` (4572) are also 9 px and `.rail.closed .railLabel .word` (4444) is 9.5 px. All four sit under the 10.5 px floor.
  - `diagram` at 1440 by 900: "nullpx tall". There is no `#diagWrap` because the stand-in body has no Statewide flow diagram.
- The `weights` check passes trivially: its pattern looks for unloaded Source Serif, Source Sans and JetBrains weights, none of which this file asks for.

### c.2 `node merged/shots.mjs inputs/rail.html inputs/s2/rail premium`

Wrote `inputs/s2/rail-light@1x.png`, `rail-light@2x.png`, `rail-dark@1x.png`, `rail-dark@2x.png` and `rail-pair.png` at 1920 by 1080 in the default Open view. The pair shows the same page in both themes: the switcher bar, the open rail, the single row header, the queue with seven visible rows, Exceptions with three rows, four referrals, and the first six cards of "Every screen" along the bottom.

### c.3 My own captures: `inputs/s2/cap.mjs`, log in `inputs/s2/cap-log.txt`

Forty four images named `cap-<theme>-<width>-<state>.png`. Measured facts from the log: in the Open view the open rail is 236 px and the closed nav is `display: none`, in Closed the strip is 76 px and the open nav is hidden, in Both they are 236 px and 76 px side by side. The hover card over the Command strip item is opaque and visible at x 79, y 96, 248 by 97 px, reading "Command 23. Every open movement across the network, worst first, with what is wrong beside it. 2 breached, 3 due soon". The Activity panel is 576 px wide and the full window height, Tasks is 448 px, Tools is 576 px and scrolls (content 1457 px tall). Searching "Larkspur" opens the pop with one Patients hit. Searching "Adult Secure" opens it with two Wards hits and no patient hits. At 1280 wide the header is 1044 by 56 px with the search field squeezed to 160 px, the Service control 123 px, the drawer labels still present, the "Synthetic" word gone. At 1100 wide the chip and all three drawer labels are gone, search is 202 px. The rail stays open at 236 px at both widths because the ladder only changes the rail at 1000.

What each image shows, light then dark being the same layout on the two palettes unless noted:

- `*-1920-open`: the switcher bar across the top with Open pressed, then the open rail: Ward Flow WA, the shift block (ring 53%, Day shift 10:42, 3h 18m to handover at 14:00, a meter), Operations (Command current with a red dot, tag 23 and the line "2 breached, 3 due soon", Movement, Capacity with 16 and "16 free, none at SJGM"), Network (Wards, Emergency departments with "longest 25h 10m at RPH", Community teams), Records (Patient search, Referrals with an amber dot, 4 and "oldest 2h 30m", Handover with 14:00 and "in 3h 18m", Statistics, Governance 4), Pinned (three rows with red, red and amber bars and mono waits), the foot (Signed in as Bed coordinator, a green dot with "Figures reconcile at 10:42: 23 movements, 4 referrals", the invented note) and "Close the rail [". The header: Command, SYNTHETIC PROTOTYPE, the search field with "/", All services 23, Activity with a green dot, Tasks 19 with a red dot, Tools, New referral in the accent. The body: Priority queue 23 open with seven rows visible (WF-021 Larkspur, Oona first, Tier 1, 25h 10m, "Legal deadline passed" in red, route "Royal Perth Hospital ED to No destination yet", meta line), Exceptions 3 open (two Legal deadline passed rows with red bars, one Accepted, no bed pulled with an amber bar), Referrals awaiting triage 4 waiting, and the top of Every screen with six cards, Command's card current with a brass bar and blue tint. The queue list fades at its bottom edge because it continues.
- `*-1920-closed-hover`: the strip: WF, then glyph and word for each screen with tags top right (23 on Command, 16 on Capacity, 4 on Referrals, 4 on Governance), a red dot beside the Command glyph and an amber dot beside Referrals, hairlines between groups. The hover card floats right of the Command item with the title, the 23 tag, the purpose and "2 breached, 3 due soon" with the 2 breached in red. The foot: a pin glyph with a 3 tag, the BC ring, a green reconcile dot, and the ">" open control. The body has grown to fill the width.
- `*-1920-both`: both rails, the open one captioned "Open 236 pixels" and the strip captioned "Closed". The header has lost its chip and the drawer labels, leaving glyphs with their dots and the 19 badge. The `railBtn` is gone from both rails.
- `*-1920-activity`: a full height panel on the right covering the switcher bar: "Activity, all services, Close", a live line "Live, reconciled 10:42, last event 10:40, 2 minutes ago", a two part segment (Activity 29 pressed, Live tally Command), "What is going on" as one paragraph with the figures in bold, then "Last events, 14 of 29 today" as a timed list with tone dots, and the foot note about invented events.
- `*-1920-tasks`: a narrower panel: "Tasks, 19 outstanding, 8 kinds", Notices 3 new (three timed rows with a "Seen" link each, on a tinted strip), the explanatory note, "Work open, worst first" with eight rows (2 legal deadlines passed with a red dot, 3 due within 2 hours amber, 1 with no owner amber, 3 declines to answer, 1 accepted no bed pulled, 4 referrals to triage, 4 overrides to review, Handover sheet due 14:00) each with a right hand hint, "Show in queue", and the foot note.
- `*-1920-tools`: "Tools, all services", the signed in block, "Do" with Print handover sheet, Export the queue (not wired), Raise a referral (primary), "Ward contacts, 8 wards" with the placeholder note and a Name, Extension, Email table, then "Emergency department contacts, 8 departments". The Appearance group and the design system link are below the fold of the panel.
- `*-1920-service`: the Service dropdown under All services: "Service, filters this page", All services 23 waiting (current, with a brass bar), North Metropolitan 6, East Metropolitan 10, South Metropolitan 7, WA Country none waiting, each with its service hue dot, and the note that the choice follows you.
- `*-1920-search-patient`: "Larkspur" in the field, the Clear button shown, the pop under it: "Patients, 1 open", one hit "Larkspur, Oona, WF-021, Tier 1, 25h 10m, Royal Perth Hospital ED. Legal deadline passed 1h 10m ago." in red, the foot "Names are invented. Search never returns a risk score, an acuity score or a best match." Behind it the queue has already filtered to one row with the bar "Showing 1 of 23, matching Larkspur. Show all". The pop overlaps the Exceptions header.
- `*-1920-search-ward`: "Adult Secure": the pop shows "Wards" with FSH Adult Secure and RPH Adult Secure, each "filter the queue". The queue shows 4 of 23 (WF-007, WF-009, WF-014, WF-020, whose routes mention those wards).
- `*-1920-railfoot` (clipped): the three pinned rows, the hairline, SIGNED IN AS, Bed coordinator, the green dot with the reconcile sentence over two lines, the invented note, and the "Close the rail" button with the bracket key cap.
- `*-1440-open`: the same page in less height. The open rail's scrolling middle now ends part way through Governance (its row is clipped by the foot) and Pinned is below the fold of the rail. The queue shows seven rows, the fourth column of cards is cut at the bottom. The chip reads PROTOTYPE because 1440 is under 1500.
- `*-1440-closed-hover`, `*-1440-both`: as at 1920, with the same clipping in the open rail in the Both view.
- `*-1440-activity`, `-tasks`, `-tools`, `-service`, `-search-patient`, `-search-ward`: the same panels at the smaller width. Tools shows the ward table to RGH and the first row of the department table.
- `*-1440-railfoot` (clipped): Referrals (partly), Handover, Statistics and Governance (its tag half hidden under the foot), then the foot as before. This confirms the Pinned group is scrolled out of view at 900 px tall.
- `*-1280-header`: rail open at 236, search squeezed so its placeholder truncates to "Search patients:", chip PROTOTYPE, labels present, the Exceptions panel already narrow.
- `*-1100-header`: the chip gone, the three drawers reduced to glyph plus dot or badge plus chevron, search a little wider, New referral unchanged. Priority queue's note has wrapped to two lines.

Dark theme differences: none in layout. The strip's tags, the ring and the pinned bars keep their tones. The queue's red "Legal deadline passed" and the amber tier 2 chips read clearly.

## Part d. Integration plan: the third edition Command over this shell

### d.1 What to lift from rail.html

Stylesheet blocks to lift (all under `merged/command-third-edition.html`'s own base block, never the rail's base block, see d.5):

- 3078 to 3135, the shell layout (`.hApp`, `.hFrame`, `.hdr1`, `.hdr1 .title`, `.hdr1 h1`, `.hdr1 .end`, `.glyph`).
- 3136 to 3750, the quiet bar rules: the chip `.long`, `.searchWrap`, `.search`, `.qPop`, `.qHit`, `.qNone`, `.popFoot`, the Service selector, `.drawerMenu` and `.menuPanel` as a side drawer, `.popHead`, `.popBody`, `.seg`, `.part`, `.feed`, `.feedItem`, `.notices`, `.notice`, `.taskRows`, `.taskRow`, `.tally`, `.tile`, `.figGrid`, `.statsFacts`, `.statsFoot`, `.toolList`, `.toolItem`, `.contacts`, `.who`, `.holder`.
- From 2424 to 3074, only the menu family the drawers depend on: `.menu`, `.menu > summary`, `.menuPanel`, `.menuHead`, `.menuList`, `.menuItem`, `.menuNote`, `.badge`, `.dot`, `.lead`, `.closeBtn`, `.linkBtn`, `.zero`, `.tableWrap`, `.dataTable`, `.total`. Leave the rest (see d.3).
- 3825 to 3906, the collapse ladder, merged with the third edition's own width rules (see d.7).
- 4064 to 4360, shared rail pieces. 4361 to 4395, open. 4396 to 4601, closed. From 3907 to 4063 only `--railw`, `.railHost`, `.railHost > .rail`, `.rail.closed:hover` and `:focus-within` z-index, and the two `display: flex` rules, rewritten for one nav and a `data-rail` attribute (d.6).
- 4862 to 4866 reduced motion, 4867 to 4875 the 1000 px rail rules, 4889 to 4896 print (drop `.oBar` and `.railCap` from the selector), 4897 to 4912 forced colours (drop `.card` and `.schema .sBlock`).

Markup fragments to lift:

- 4930 the skip link's shape (but not its target, see d.4).
- 4931 to 4934 the rail host, reduced to one `nav.rail`.
- 4939 to 4987 the header, whole.
- The `#live` paragraph, which the third edition already has.

Script sections to lift (from `inputs/s2/rail-script.js`, script lines in rail.html):

- 5173 to 5231 helpers, 5232 to 5248 service scope, 5249 to 5264 tasks, 5265 to 5316 figures and reconcile, 5317 to 5463 pages, 5464 to 5495 sort, filter and refusals, 5496 to 5592 search, 5593 to 5664 activity, 5665 to 5706 tasks, 5707 to 5745 tools, 5746 to 5763 the Service selector, 5873 to 5918 state changes, 5919 to 5963 menus, 5964 to 6176 events, 6177 to 6318 every screen (data only, minus `sectionsOf`), 6319 to 6422 the rail. All of these need the data re-pointing described in d.8.
- The appearance script 6560 to 6599, in place of the third edition's, because it reflects the group inside Tools and observes `data-theme`. Rename its key once (d.9).

### d.2 What to drop from the Command screen, and where each piece belongs

| Drop                                                                                                                                                        | Lines                                                  | Where it belongs instead                                                                                                                                                                                                                    |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The Rail views switcher `.oBar`, its CSS 3912 to 3992, `NOTES`, `setView`'s view logic, the 1 2 3 keys, `data-view="both"` rules 4020 to 4062, `.railCap`   | 4914 to 4927, 3907 to 4063, 6474 to 6553               | The design system, as a "rail, open and closed" demonstration page or component section, where showing both states side by side is the point.                                                                                               |
| "Every screen" cards `#mapPanel`, `.map`, `.card`, `thumb`, `renderMap`                                                                                     | 5019 to 5022, 4749 to 4861, 6424 to 6431, 6453 to 6463 | The design system, as a screens index (a section listing the twelve screens, their groups, purposes, primary actions and drawn layouts).                                                                                                    |
| The drawn layout `#bodyScreen`, `.schema`, `renderScreen`, `SCREENS[*].cols`, `col`, `blk`                                                                  | 5013 to 5017, 4602 to 4748, 6432 to 6452               | The design system's screens index, beside the cards. Command itself never shows another screen's layout.                                                                                                                                    |
| "The rail, open and closed" prose panel with its four columns                                                                                               | 5024 to 5069                                           | "Open" and "Closed" go to the design system's shell section (5.6) and the rail component (6.1). "What was added, and why" goes to Departures (12). "Considered, not built" goes to Decisions for the owner (14) or a Departures subsection. |
| `footer.hFoot`                                                                                                                                              | 5071 to 5075                                           | The third edition Command already states what is invented in its rail foot and disclaimer chip. Keep one statement, the third edition's. If the longer footer text is wanted, it belongs in the design system's honesty section (8).        |
| The stand-in Command body `#bodyCommand` and its renderers `renderQueue`, `renderExceptions`, `referralRows`, `renderReferrals`, `routeText`, `updateFades` | 4990 to 5011, 5764 to 5856                             | Nowhere. The third edition's engine renders the real Command body.                                                                                                                                                                          |
| `sectionsOf` and the `[data-section]` click handler                                                                                                         | 6297 to 6312, 6438 to 6446                             | Nowhere, dead code from the removed sections rows.                                                                                                                                                                                          |
| The stand-in data `MOVES`, `REFERRALS`, `BEDS`, `WARDS`, `EXTRA`, `OVERRIDES`                                                                               | 5085 to 5169                                           | Nowhere, once the shell reads the engine's data (d.8). `WARDS` contacts and `EXTRA` events have no counterpart in the engine and would need a home in the engine's data if the Tools tables and the four extra events are kept.             |
| `window.__probe`, `window.__headerCheck`                                                                                                                    | 6554 to 6558, 5171                                     | Replace with `window.__commandCheck`, which `check.mjs` reads. Keep a probe if the builder wants one, under a new name.                                                                                                                     |

### d.3 Shell CSS defined but never used by rail.html, do not lift

`axis`, `band`, `chart`, `delta`, `grid`, `hdr`, `hdrBar`, `hdrClock`, `hdrTools`, `kpi`, `left`, `menuDiv`, `pageNote`, `quiet`, `reveal`, `revealBody`, `series`, `small` (as a bare class), `stat`, `stats`, `statsEnd`, `statsGrid`, `statsList`, `statsMenu`, `sub`, `task`, `taskList`, `tasks`, `tasksClear`, `tasksEnd`, `tasksLabel`. These are the older three row header (statistics strip and outstanding tasks bar) and chart pieces that the quiet bar replaced. The third edition design system's 5.6 and 6.2 still describe that three row header, so the standard needs updating to the quiet bar at the same time, otherwise the Command and the standard will disagree.

### d.4 Every conflict with the third edition Command body

1. Two headers. The third edition has `header.topbar` (title, chip, `.sub` disclaimer, `dl#kpis`, `.clock`). The shell has `header.hdr1`. Keep `hdr1`. Decide with the owner where the masthead figures go: the merge brief says keep the Live edition's masthead figures, the shell moved them into the Activity drawer's Live tally. The clock ("Sat 15 Aug, 10:42 AWST") has no home in `hdr1` at all, only inside the rail shift block and the Tools drawer. Recommendation: keep the figures strip out of the row (the quiet bar is the owner's later decision) but put the date and time back somewhere always visible, for example as the `count` in the rail's shift eyebrow, which already shows 10:42.
2. Two rails. The third edition's `nav.rail` is static markup with `#railOpen`, `#railGov`, `#railCheck`, `#appearance` and `.railNote`. The shell renders its own rail into an empty nav. Keep the shell's nav and drop the static one. The engine's three writes into the old rail must move: `#railOpen` (the engine's open count) becomes the Command tag the shell derives, `#railGov` becomes the Governance tag, and the rail foot's `#railCheck` sentence must read `window.__commandCheck` (see d.8). The appearance control leaves the rail foot for Tools, which is where the shell put it.
3. The old rail foot. `div.railFoot` with `.apRow` and `#appearance` goes. The third edition's appearance script is scoped to `#appearance` and would silently do nothing, which is why the shell's document level script replaces it.
4. The skip link. Third edition: `#qpane-patients`. Shell: `#qList`. Keep `#qpane-patients`, the real queue's patients pane.
5. Duplicate ids between the shell and the third edition body: `exBody`, `exCount`, `qCount`, `qFilter`, `refBody`, `refCount`. Drop the stand-in body and these vanish, but any shell code that touched them must go too. `renderQueue` writes `#qList`, `#qCount` and `#qFilter`. `renderExceptions` writes `#exBody` and `#exCount`. `renderReferrals` writes `#refBody` and `#refCount`. `selectPatient` and the `[data-pin]` and `[data-go="queue"]` handlers look for `#qList` and `.qRow[data-id]`, and must be re-pointed at `#qpane-patients` and the engine's queue rows, which are `button.qRow[data-mv]` for movements and `button.qRow[data-rf]` for referrals (engine script lines 1815 and 1856 of `inputs/s2/L-script.js`), not `data-id`.
6. The `#live` region exists in both. Keep one. The shell's `announce` and the engine's `announce` both write it, which is fine, but both use a zero width space trick, so the two must not fight over the same sentence in one tick. Prefer routing the shell's `announce` through the engine's.
7. `#refBody` and `#refCount` mean Refused actions in the engine. Any lifted shell CSS keyed on those ids does not exist (the shell styles by class), so the only risk is a builder assuming they are referrals.
8. Search filtering the queue. The shell's `setQ` filters its own list. In the final Command, typing in the universal search must filter the engine's patient queue. That is a new hook into `renderPatientQueue` or a `visible(m)` predicate the engine exposes. Without it the search pop will find people the queue does not filter to.
9. The Service selector. The engine has no notion of service scope. Either the selector scopes the engine's queue, departments strip and diagram (real work, and the diagram's node set changes with it), or it scopes only what the shell renders (drawers, rail state lines), and the note "filters this page" becomes untrue. Ask the owner. The honest minimum is to filter the queue and the pressure strip and say the diagram shows the whole network.
10. Grid and height arithmetic. The third edition's locked layout (1600 and wider: three columns with flush bottoms, the laptop rule at 960 tall) subtracts the old `topbar` height. `hdr1` is 56 px, the old topbar was taller, and the switcher's 43 px must not be counted. Re-derive the `.scroll` height from `100vh` minus 56 px, and re-verify the diagram is at least 260 px tall at 1440 by 900.
11. Width rules. Third edition: 1600 lock, 1400 to 1599, 1001 to 1399 two columns, 1000 one column with the rail as a wrapping row, 640. Shell: 1500 (drop "Synthetic"), 1240 (drop chip and drawer labels), 1000 (one column, rail static), 640. Merge them so the 1000 rule is one rule and the rail becomes a wrapping row in the open state only.
12. The queue list height. `.hGrid .qList` (3771) sets a max height for the stand-in list. Drop it. The third edition's `.qPanel` rules govern the real queue.
13. `.tag` in the closed strip is 9 px, `.word` 9.5 px, `.ring.small b` 9 px, the closed brand `b` 19 px (4407). The third edition's floor is 10.5 px on a seven step scale. Set them to `var(--t-0)` and the brand to `var(--t-5)`, then check the strip still fits in 76 px.
14. Serif weights. `.hdr1 h1` is weight 500 (line 3117). The closed brand `b` (4406) sets only a 19 px size and inherits `.brand`'s weight from the base block, which the third edition already corrected. The third edition loads the serif at 600 and 700 only. Every `font-weight: 500` on a `--display` element in the lifted blocks becomes 600. There are 18 uses of 500 in the shell CSS, most on the sans, so check each.
15. Z order. `hdr1` is 31, the rail 20, the strip on hover 32 so the fly card clears the header. The third edition's diagram and shortlist have their own stacking. Verify a hovered strip card is not cut by the queue panel.
16. Print. The shell hides the header's end, search and menus in print and forces `.hApp` to block. Keep, and add the third edition's print rules for the diagram and the brand stripe.
17. Fonts. The shell asks for Newsreader, IBM Plex Sans and IBM Plex Mono through `--display`, `--body` and `--mono`. It never names a face outside the tokens, so under the third edition tokens it takes Source Serif 4, Source Sans 3 and JetBrains Mono for free. Check the mono figures in the strip tags, the ring and the pinned waits still fit at JetBrains Mono's width.
18. Colour. The shell uses no hex and one `rgba` (a shadow at 2599). It uses `--line-strong` as a solid line in several places, which the third edition redefined as alpha, so nothing to change, but the `.svcStripe` and the tone dots must be checked against the third edition's teal and plum service hues.

### d.5 Which base block to keep

Keep the third edition's stylesheet (E3 8 to 2284) as the base. Do not carry the rail's base block (9 to 2200) at all. The rail's base is the design standard's second edition copy of the Live edition block, and every one of the 41 third edition hunks would otherwise be lost. The only things in the rail's base block that the shell needs are the tokens and the `.rail*`, `.brand`, `.tag`, `.chip`, `.panel`, `.ph`, `.count` rules, and the third edition has all of them.

### d.6 How the rail's open and closed state should be driven in the final Command

- One `nav.rail`, not two. `renderRail(nav, closed, f)` already renders either shape into a given nav. Call it with `state.railClosed`.
- The state lives on the app root as `data-rail="open"` or `data-rail="closed"` (or on `html`, so a head script can set it before first paint, the same way the theme is restored, which avoids a width jump on load). CSS: a `[data-rail="closed"]` rule that sets `--railw` to 76px, a transition on `grid-template-columns` over 0.18 s, and none under reduced motion.
- The control is the `railBtn` at the foot of the rail in both states ("Close the rail" with the bracket cap, "Open the rail"), plus the `[` key when focus is not in a field. Both call one `setRail(closed)` that sets the attribute, re-renders the nav, moves focus to the new `railBtn` (innerHTML replacement drops focus), announces "Rail closed" or "Rail open", and stores the choice.
- Storage: one key, `ward-flow-rail`, values `open` or `closed`, in `localStorage`, wrapped in try and catch, default open. Remove `ward-flow-rail-view` and the `both` value.
- No demo switcher, no number keys, no `railCap`.
- The closed strip's hover card stays, with its `:focus-visible` twin so keyboard users get it.
- At 1000 px and narrower the rail is a wrapping row in the open shape regardless of the stored state, as the third edition already does, and the toggle is hidden.

### d.7 Merged width ladder

| Width          | Rule                                                                                                                                   |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 1600 and wider | Third edition lock, rail open 236 or closed 76 (the body gains 160 px when closed, which the lock must absorb into the middle column). |
| 1500           | Drop "Synthetic" from the chip.                                                                                                        |
| 1400 to 1599   | Third edition's outer columns give a rem each.                                                                                         |
| 1240           | Drop the chip and the drawer labels, search basis 10rem.                                                                               |
| 1001 to 1399   | Third edition two columns.                                                                                                             |
| 1000           | One column, rail as a wrapping row, header wraps, search full width, toggle hidden.                                                    |
| 640            | Tap floor, tally one column, menu panel 94vw.                                                                                          |

### d.8 Data: one source of truth

The shell derives every rail line, tag, dot, drawer, tally and search hit from its own `MOVES`, `REFERRALS`, `BEDS` and `WARDS`. The engine derives the queue, the strip, the diagram and the registers from `MOVEMENTS`, `UNITS`, `EDS` and its `REFERRALS`. On one screen they would disagree in public: the rail would say 23 open and the queue would show 14, the search would find Larkspur, Oona and the queue would not have her, and the reconcile line would say the figures reconcile while they plainly do not.

The engine's data must win. Concretely:

- Put the shell's code inside the engine's IIFE after its data and helpers, or have the engine export a read only facade (`open()`, `breached(m)`, `dueSoon(m)`, `owner(m)`, `referrals()`, `units()`, `eds()`, `overrides()`, `refused()`, `figures()`, `reconcile()`) and pass it to the shell.
- Rewrite `figures()` (5266), `hits()` (5505), `events()` (5594), `notices()` (5611), `summary()` (5624), `renderTasks` (5666), `renderTools` contact tables (5711), `renderService` counts (5747), `stateLine` (6320), `tagTone` (6339), `screenTag` (6288), `pinnedRows` (6377) and `checkText` (6390) over the engine's shapes. The engine has `isBreached(m)`, `isOpen(m)`, `figures()` and `reconcile()` already.
- The rail foot sentence reads `window.__commandCheck` (the engine's) and, if kept, the shell's sum checks appended to it. Expose exactly one `window.__commandCheck` so `check.mjs` passes.
- Service scope: add a `service` field to the engine's `EDS` and `UNITS` (the third edition already tokens the four services), and let `inSvc` use it.
- `PINNED` must name movements that exist in the engine's data.
- The `TASKS` tests (breached, due within two hours, no owner, declines to answer, accepted with no bed pulled) map onto the engine's fields (`legal`, `escalation`, `referred`, `declines`, bed pulled) and onto its registers (overrides, refused). Verify each count against the engine's own tab counts, since Tasks and the registers must agree.

### d.9 Ids, classes and keys the shell script depends on, in one list

Ids in markup the shell must find: `live`, `pageTitle`, `q`, `qHint`, `qClear`, `qPop`, `searchWrap`, `svcMenu`, `svcList`, `svcLabel`, `svcCount`, `svcDot`, `activityMenu`, `activityPanel`, `actDot`, `tasksMenu`, `tasksPanel`, `tasksCount`, `tasksDot`, `toolsMenu`, `toolsPanel`, `newMenu`. After the drop list: no longer `hApp`, `oNote`, `bodyCommand`, `bodyScreen`, `screenTitle`, `screenGroup`, `screenFacts`, `schema`, `map`, `mapCount`, `qList`, `qCount`, `qFilter`, `exBody`, `exCount`, `refBody`, `refCount`.

Classes the script queries: `rail` (with `open` or `closed`), `menu` on every `details` it manages, `menuPanel`, `searchWrap`, `qHit`, `qRow`, `taskRow`, `seg`, `part`, `railLink`, `oBtn` (drop), `sBlock` (drop).

Data attributes: everything in a.10 except `data-view`, `data-screen`, `data-block`, `data-section`, `data-target`.

Storage keys: `ward-flow-rail` (new, see d.6) and one appearance key. The third edition uses `ward-flow-command-appearance`, the shell `ward-flow-header-appearance`. Keep the third edition's name so a browser that already stored a choice on the third edition keeps it.

Globals: `window.__commandCheck` (must exist, an array), `window.__reflectAppearance` (the Tools drawer re-renders its appearance group on every render and needs it).

Keyboard: `/`, Escape (the shell's unwinding order plus the engine's own Escape for the legend and selection, merge into one handler with one order), `[`, Enter and ArrowDown in search.

## Part e. Two build paths, and the recommendation

### Path A. Graft the shell into `merged/command-third-edition.html`

Start from the file that already has the third edition stylesheet, the full Command engine and markup, and the forty stylesheet fixes, all gated by `merged/check.mjs` and `check3e.txt`. Add the shell: its CSS blocks (d.1) appended after the third edition's own rules, the header markup in place of `topbar`, one `nav.rail` in place of the static rail, the shell's script sections re-pointed at the engine's data (d.8), and the shell's appearance script in place of the third edition's. Delete the old rail foot, the kpis and clock, and the old appearance group.

### Path B. Start from `inputs/rail.html`

Replace the rail's base block (9 to 2200) with the third edition stylesheet, or apply `inputs/s2/L-vs-E3-style.diff` to it. Then bring across the engine (4093 lines of script) and the Command markup (341 lines) from the third edition, delete the stand-in body and its renderers, drop the switcher, cards, schema and prose, and re-point the shell's data.

### Which loses less behaviour, and why

Path A. Four reasons.

1. The forty fixes are all stylesheet hunks against a base block the rail file does not carry verbatim. Applying the diff to the rail's base would hit the ten hunks where the rail already differs (the header comment, three `--lift` layouts, five font size tokens), so the patch cannot apply clean and every rejected hunk is a fix silently lost. Replacing the rail's base wholesale with the third edition's is the same act as Path A, only starting from the wrong file.
2. The engine and the Command markup are byte identical between the Live edition and the third edition, and none of it exists in rail.html. Path B has to import everything Path A already has, and it has to import it into a file whose stand-in body shares six ids with the real body. A missed renderer (any of `renderQueue`, `renderExceptions`, `renderReferrals`) would keep writing into the real body's ids and the failure would be quiet.
3. Path A's diff is additive and reviewable: new CSS at the end of the stylesheet, a header swapped for a header, a rail swapped for a rail, a script block added. Path B's diff is the whole engine plus the whole body against a file that then throws most of itself away.
4. The verification harness (`check.mjs`, `shots.mjs`, the review probes under `merged/review/`) was written against the third edition's ids (`diagWrap`, `apBtn`, `__commandCheck`). Path A keeps them working from the first build. Path B starts with three of the checks red and has to earn them back.

What Path B is better at: nothing the graft cannot get by lifting the same lines. The rail file's only unique material is the shell CSS, markup and script sections listed in d.1, all of which lift cleanly because the shell never reaches into the engine.

### What the builder must verify either way

1. `node merged/check.mjs <file> platinum` is all green, including `reconcile` (so `window.__commandCheck` exists and is empty), `typefloor` (no 9 px or 9.5 px in the strip or the ring), `diagram` at 1440 by 900 (at least 260 px tall with the 56 px header), overflow at 390.
2. The rail's tags and state lines agree with the engine: the Command tag equals the queue's patient count, the Governance tag equals the overrides tab count, the Referrals tag equals the referrals tab count, the reconcile line reports the engine's `reconcile()`.
3. Search: a name in the pop is a row in the queue, and choosing it selects that row in `#qpane-patients`, scrolls it into view and focuses it. A ward hit filters the queue to movements whose route names that ward. The refusal sentences appear for "risk", "score", "best match", "closed", "arrived", "discharged".
4. Drawers: one open at a time, click outside closes, Escape returns focus to the summary, the first focusable inside gets focus on open, the Tasks counts equal the register counts, marking a notice seen clears the dot when none is new.
5. The rail: `[` toggles from anywhere outside a field, the choice survives reload in the same browser, no width jump on load, focus lands on the toggle after the re-render, the fly card shows on hover and on keyboard focus, the closed strip is exactly 76 px and the open rail 236 px, the Pinned group is reachable at 900 px tall (scroll or a tighter shift block).
6. The locked layout at 1920 by 1080 and 1440 by 900 in both rail states: flush column bottoms, the queue and registers scrolling inside their panels, no page scroll at 1600 and wider.
7. Both themes, forced colours, print (header tools and drawers hidden, the queue unclipped, the brand stripe hidden), reduced motion (no rail width animation).
8. The design system: 5.6 and 6.2 rewritten for the quiet bar and the drawers, 6.1 extended with the closed strip, the hover card, the tone dot rule, the service stripe and the bracket key, the screens index added, and the Departures and Decisions sections carrying "What was added, and why" and "Considered, not built".
