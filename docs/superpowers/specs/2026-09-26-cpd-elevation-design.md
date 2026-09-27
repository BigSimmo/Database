# CPD mode elevation — design spec

- **Status:** approved by Josh 2026-09-26 18:43Z; three features added 19:05Z. Release 1 merged in PR #3119. Build plan: `docs/superpowers/plans/2026-09-26-cpd-elevation.md`.
- **Thread:** "Elevate CPD mode". Plan page with mockups: https://claude.ai/artifact/Ph4XmeMzciwkVRSY4Z5LJk.
- **Read from:** `origin/main` at 65f684ad5.
- **Naming:** the mode is called **CPD** everywhere a user can see it. The code id stays `cme`, including routes, tables and file names, and is never shown to users.
- **Repo is public:** every example name, event and hour figure in this spec is made up.

## 1. Purpose and success

CPD already does a lot. This work makes it feel as refined as the new modes, faster to use every day, and open to any doctor in WA Health. Josh's words (16:24Z, 16:51Z, and his design brief at 18:03Z) ask for a full polish and elevation. It should be easy and intuitive, polished, mature and premium, adaptive, never cheap, with nicely designed smart features.

The work succeeds when all of these hold:

1. A routine that is due is logged in **one tap** from Today's To do ("Log 1 h", with Undo). Any other routine or recent activity takes **three taps**: "+ Log", then a "Log again" row, then Save. A new activity takes a title and three chip taps.
2. The menu has **five pages**, and every current CPD web address still opens the right screen.
3. **No text on any CPD page is heavier than weight 600**, and no number is heavier than 400. A test enforces both.
4. **No verdict words** appear: Met, ready, on track, Required, complete, compliant. A test enforces this.
5. A doctor with **any CPD home** can set up, log and check their year. The words never assume RANZCP unless they chose it.
6. Every page is drawn in **six states, in light and dark**, and works on a phone, a tablet and a desktop.
7. **No database change** is needed in any release. No CPD content reaches another mode, the health service or an AI provider.

## 2. Decisions this spec is built on

**Josh's answers, 26 Sep 2026, 16:48–16:50Z** (all on tap cards, all the recommended option):

| #   | Question                                   | Answer                                                                     |
| --- | ------------------------------------------ | -------------------------------------------------------------------------- |
| 1   | Who is CPD for?                            | Any doctor, any CPD home                                                   |
| 2   | How many pages?                            | Five, with Year check as a tab of Today                                    |
| 3   | Category picture                           | Two fact tiles                                                             |
| 4   | Can the health service see a doctor's CPD? | Never; the doctor shares their own annual summary (page or CSV) themselves |
| 5   | Weekly teaching review                     | Teaching owns it; CPD links to it                                          |
| 6   | Admin's registration row                   | A link only                                                                |
| 7   | Learning list                              | All specialties, one checked source at a time                              |
| 8   | Other CPD homes                            | Each one added only after its own page is read                             |
| 9   | Release order                              | Design pass first                                                          |

**Josh's 16:51Z message:** smart features, intuitive UX, a polished and premium feel, and an adaptive design that is good to use. This is answered in §6 (feel and polish) and §8 (smart features).

**Earlier owner decisions that stand:**

- 20 Sep: no guided reflection prompts.
- 23 Sep: explicit capture only, with no reading history.
- Part-time work never lowers RANZCP targets.
- Offline rule (docs/pwa.md, 25 Sep): nothing personal is kept on the device for offline use.
- Claude never signs off clinical content.
- The shared design standard (`/mnt/project-files/design/mode-design-standard.md`, v12.1) applies. It is owned by On Call, and this spec never edits it.

## 3. Out of scope

These are not part of this work. Each one needs Josh to reopen it.

- Reading suggestions from what was searched or read.
- Guided reflection prompts.
- A patient-detail detector. The fixed reminder line stays, and the question sits in open privacy item 8.
- Logging from the main search bar or by voice.
- Automatic category suggestions.
- CPD's own weekly teaching review (Teaching owns it).
- A ZIP of every certificate.
- A "claim from your allowance" button.
- Any AI over reflections or certificates, including reading a certificate photo.
- Anything the health service can see.
- Any new table, column or migration.
- Changes to the pill or the pages sheet. On Call's rebuild owns that shared chrome.

## 4. Pages and navigation

### 4.1 Five pages in the pill's pages sheet

| Page (menu label) | Second line in the sheet       | Tabs (compact top tab row, standard §5) |
| ----------------- | ------------------------------ | --------------------------------------- |
| Today             | Hours, what's next, year check | Overview · Year check                   |
| Log               | Activities, drafts, routines   | Activities · To finish · Routines       |
| Plan              | Goals, calendar, training      | Goals · Calendar · Training             |
| Learning          | Courses and events             | Upcoming · Past                         |
| Set up            | Your requirements and CPD home | none (read view, then an Edit view)     |

The "…" menu on CPD pages holds **Annual summary**, **Customise Today** and **Download CSV**.

### 4.2 Addresses (no redirects)

Every existing route stays a real page and becomes the address of a tab. Links already live in phone calendars through the calendar feed, so any redirect would have to last forever. The redirect table also cannot select a tab.

| Address                                                   | Opens                                                                                 |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `/cme`                                                    | Today › Overview                                                                      |
| `/cme/check`                                              | Today › Year check                                                                    |
| `/cme/log`                                                | Log › Activities (existing query parameters such as `year`, `copy=todo` keep working) |
| `/cme/log?tab=finish`                                     | Log › To finish (new query value; the tab row links here)                             |
| `/cme/routines`                                           | Log › Routines                                                                        |
| `/cme/plan`                                               | Plan › Goals                                                                          |
| `/cme/calendar`                                           | Plan › Calendar                                                                       |
| `/cme/training`                                           | Plan › Training                                                                       |
| `/cme/learning`                                           | Learning › Upcoming (`?view=past` for Past)                                           |
| `/cme/setup`                                              | Set up                                                                                |
| `/cme/programme`                                          | Set up (the same read view; the Programme page's content merges into it)              |
| `/cme/summary`, `/cme/customise`, `/cme/new`, `/cme/[id]` | unchanged, reached from "…", "+ Log" or a row                                         |

- `/cme/summary` without `?year=` opens the current year, instead of the dead end it shows today.
- Each tab is a link to its address, so back and forward, bookmarks and sharing behave normally.
- The tab row follows the standard's compact tab spec. It attaches under the universal header through `PhoneHeaderCollapsePortal` and adds no scroll-hide of its own.

### 4.3 Registry changes

In `src/lib/mode-secondary-navigation.ts`, CPD's list becomes five entries. Keep the existing ids so the shared icon map (`iconByItemId` in `mode-nav-icons.ts`) and On Call's reuse of `calendar` are untouched:

| id         | label    | href            |
| ---------- | -------- | --------------- |
| `year`     | Today    | `/cme`          |
| `log`      | Log      | `/cme/log`      |
| `plan`     | Plan     | `/cme/plan`     |
| `learning` | Learning | `/cme/learning` |
| `setup`    | Set up   | `/cme/setup`    |

- Active-page matching maps each tab address to its page: `/cme/check` to `year`; `/cme/routines` to `log`; `/cme/calendar` and `/cme/training` to `plan`; `/cme/programme` to `setup`.
- The pill therefore always names the page, never a removed entry.
- `src/components/mode-nav/header-addon-slot.ts:81` hard-codes `/cme/programme` and `/cme/setup`. It is updated in the same change.
- The `CmeNavHeader` in-page section anchors stay for long pages (Set up, Year check). They are not a second navigation bar.

## 5. Design rules

The shared standard v12.1 applies in full, including module 2 (fact tiles: 12 px radius, content height, at least about 88 px), module 7 (timeline and chart) and module 8 (hero summary, which is optional; CPD uses it once, on Today): type, numbers, colour, surfaces, the 12/12/20 rhythm, 48/52 px rows, modules, motion, words, the six states, dark mode and accessibility. The CPD-only rules on top of it:

- **Type.** Headings 600, names and row titles 500, body and numbers 400. The one display figure is inside Today's hero summary (module 8): 40 px at 300, with "of 50 h" at 15 px, 400.
- **Colour.** CPD's identity colour follows standard v12's dash-of-colour rule (see §6.4 for exactly where). Everything the user selects (chips, filters, the current day) uses product blue. Charts and calendar marks follow module 7: the four-step grey ramp, hairline axes, today marked in product blue, and the same facts in words. Calendar marks are grey shapes (a dot for Logged, a ring for Due, a diamond for Deadline), each with a word beside it.
- **One dark button per screen.** On list pages that is the floating "+ Log", with 48 px of space kept under the last row so it never covers text. On a form it is Save.
- **Words, not verdicts.** "22.5 of 12.5 h", not "Met". "4 of 11 done", not "ready". "About 1.3 h a week reaches 50 h by 31 Dec", not "on track" (Josh, card 18:43Z). Rows end in a plain status ("3 h to go", "Reached"); a tick appears only where tapping it toggles something (addendum C). Year check says it records what the doctor checked and is not certification.
- **Dates and times.** Dates read "Sat 26 Sep", adding the year only when it is not the current one. Times are 24-hour. Everything is in Perth time (Australia/Perth). The US-style browser date box is replaced everywhere by day chips, plus an Australian-format picker for other days.
- **Unknown means "not checked".** Where the app cannot tell a count (for example certificates in demo data), it shows "not checked", never a reassuring sentence. This fixes `year-check.ts:104–115`.

## 6. Feel and polish (Josh, 16:51Z)

These rules make it feel premium, easy and adaptive. Each is checkable in review.

### 6.1 Easy and intuitive

- **Nothing is chosen for you.** Only "Log again" fills a form. Otherwise hours and category start empty, the day starts at Today, and Save stays grey until there is a title and hours.
- **One obvious next thing.** Every page opens with what the doctor most likely wants: Today shows the year and the To do list, Log shows the newest activity, and the form puts the cursor in the title.
- **Thumb reach.** The main action sits at the bottom on phones: "+ Log" floats, Save sits at the foot of the sheet, and filters open in a bottom sheet.
- **Nothing hides behind jargon.** "Reviewing + outcomes", "your CPD home" and "Year check" each get one plain muted line the first time they appear on a page.
- **Undo instead of "Are you sure?"** Saving, archiving and marking as copied each show a one-line message with **Undo** for 6 seconds. The message is a dark panel in both themes. The only confirmation dialogs left are for removing a certificate (it deletes a file) and the same-day repeat check.
- **Forgiving forms.** The unsaved form survives an accidental close within the tab, as today. Hours accept "1.5", "1,5" and "90 min". Leaving a half-filled form asks "Keep as draft?" instead of discarding it.
- **Lists stay still.** Nothing reorders or jumps while the doctor is looking. A saved or undone item changes in place, and new items appear on the next visit or pull to refresh.
- **Dates say both.** The date comes first, then how far away it is: "Tue 29 Sep · in 3 days", "Year ends 31 Dec 2026, in 14 weeks". Past dates keep the plain date.
- **Tap a value for its detail.** Every figure on Today and each Year check row opens a detail sheet: the figure in large light digits (40 px at 300), what adds up to it, the source ("your own log", "the targets you confirmed on 8 Jan 2026") and when it was counted, with Copy, Share and "See the activities" (Log with the matching filter). Copy and Share send plain text only.
- **Search your own log.** Log's own search box filters titles and reflections locally, with no microphone, and never sends anything to the main search bar (standard §13).

### 6.2 Polished and premium

- Numbers sit in one right-hand column with tabular figures. Icons sit on one axis. Text shares one left edge.
- Hairline-grouped lists instead of a card for every item. Fact tiles only for the two national rules.
- **No layout shift.** Loading placeholders have the final shapes, so nothing jumps when data arrives. There is no white flash in dark mode.
- **Calm feedback.** A pressed row darkens one surface step. Saved messages are one line with no ticks or animation beyond a 150 ms fade.
- **Motion.** Opacity plus at most 4 px of movement, 150–240 ms, with the standard ease-out curve. Everything stops with reduced motion.
- **Copy is edited.** Every string is sentence case, has no exclamation marks, and is under about 70 characters where it sits on one line. Month totals read "9.5 h", never "9.5 H".
- **Detail pass (Josh 18:32Z, standard v13).**
  - _Live status green:_ only where a state is live and current. In CPD that is the detail sheet's "Up to date" (the figure was counted from the loaded log): a 6 px `--success` dot with the word beside it in muted text, one 600 ms pulse when it turns fresh, none on first load or with reduced motion, never looping. "Reached" and every other status word stays grey.
  - _No explanatory text:_ helper sentences, intros and instructions are cut. What stays is safety, privacy, source and freshness: the patient-details reminder, the signed-out and offline lines, "Confirmed 8 Jan 2026 against your recorded source", "Curated, not endorsed · checked 26 Sep 2026", "Part-time work never lowers your CPD targets".
  - _Type:_ headings −0.01em tracking and 1.2 line height with balanced wrapping; eyebrows open tracking; body 1.4; tabular figures; real apostrophes; en dash for ranges; a non-breaking space between a number and its unit ("0.5 h", "0.8 FTE"). Hierarchy from size and tone, never bold.
  - _Surfaces:_ two elevations only, `--e1` for raised modules and `--e4` for sheets, the floating button and the Undo bar. 1 px low-contrast hairlines, inset to the text (past the leading icon on icon rows). Concentric corners: the segmented control's 10 px track with 3 px padding holds 7 px segments.
  - _Micro-detail:_ every control darkens one surface step when pressed (no scale) and keeps the app's focus border. Icons share one stroke at 16 or 20 px. Skeletons are static, with no shimmer (standard v13). Sheets and the floating button respect the safe areas and home bar.
- **Screenshot check before approval** (standard §12): each rebuilt page beside live On Call and CPD at 390 × 844 in both themes. Anything heavier, busier or more colourful is fixed first.

### 6.3 Adaptive

| Width                    | Layout                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Phone (under 768 px)     | One column; the form opens as a full-height sheet; filters open in a bottom sheet.                                                                                                                                                                                                                                                                                             |
| Tablet (768–1023 px)     | One column up to the live `max-w-3xl` reading width; the form opens as a centred sheet.                                                                                                                                                                                                                                                                                        |
| Desktop (1024 px and up) | Today shows the year figure and To do side by side. Log opens an activity or the form in a side panel, so the list stays in view. The panel has previous and next arrows and a close button. The keyboard works throughout: Tab order follows the reading order, Ctrl or Cmd + Enter saves a form (plain Enter stays a new line in the reflection), and Escape closes a sheet. |

- Text scales to **200%** with nothing clipped. From **135%**, rows stack: the hours move from the right-hand column into the second line under the title. Chips and toolbars wrap onto a second line, the month total stays, tabs scroll with an edge fade, and pages keep room under "+ Log".
- Landscape phones get the same layout as portrait, with sheets capped at 90% of the height.
- Dark mode follows the phone. Forced colours keep the system colours (standard §11).
- Every screen is tested at 360, 390 and 430 px wide, and at 1280 px.

### 6.4 Josh's design brief (18:03Z), applied to CPD

Josh sent one stress-tested brief to every mode thread. This is how CPD meets each point. Standard v12.1 (18:13Z) now sets the colour rule and the text floors for every mode, and this section follows it.

**Each page's single job and top three tasks** (design for the first five seconds):

| Page     | Its one job                                   | Top three tasks                                             | First five seconds show                           |
| -------- | --------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------- |
| Today    | Know where my year stands and what to do next | See my hours; act on the next To do; log something          | Hours figure, pace line, first To do row, "+ Log" |
| Log      | Record and find my activities                 | Log; find one; finish a draft                               | The newest activities and "+ Log"                 |
| Plan     | Shape my year                                 | Check goals; see what falls due; see where I am in training | Goals with hours, or the month                    |
| Learning | Find something worth attending                | Browse upcoming; add one to my calendar; log one I went to  | The next events this month                        |
| Set up   | Say what my CPD home asks                     | Read my targets; edit them; set reminders                   | The CPD home and its targets                      |

**Layout.** Today is the one dashboard. It is modular, every module answers one real question or leads to one action, and nothing is decorative (Josh, 18:21Z). It is built only for CPD, around pace against this year's target, what to log next and what is left to finish, not a shared template with different labels (Josh, 18:21Z, "unique for each mode and tailored to that mode"):

| Module                                              | The question it answers               | What a tap does                                                                              |
| --------------------------------------------------- | ------------------------------------- | -------------------------------------------------------------------------------------------- |
| Hours panel (hero)                                  | Am I on pace for this year's target?  | Opens the hours detail sheet                                                                 |
| Two fact tiles                                      | Have I met the two national minimums? | Opens that category's detail sheet                                                           |
| Next to log (top two, then "Log")                   | What should I log next?               | A due routine logs in one tap ("Log 1 h", with Undo); the next step opens the place to do it |
| To finish (top two, then "All N")                   | What is left to finish?               | "Finish" opens the draft; "Copy next" copies to the CPD home in one tap, with Undo           |
| Training line (only with a current training period) | Where am I in training?               | Opens Plan › Training                                                                        |

The home **adapts and says why**: the panel's first line names the season ("Last quarter", "Last fortnight · closing the year", "Early in the year · write your plan"), and Next to log's order follows it. Dates that fall due soon live on Plan › Calendar, not on Today. Log, Plan, Learning and Set up stay clean lists. Detail goes into sheets.

**Type floors (standard v12 §1).** Four type sizes at most per screen, from the token scale only:

- 15 px for body, row titles, inputs and buttons;
- 13 px for second lines, hints, tabs, chips, form labels, calendar weekday letters, chart labels and the legend;
- 11 px for eyebrows only;
- one heading or display size: 20 px for sheet titles and Set up's heading, or on Today the 40 px hero figure.

Nothing is below 11 px, and body text is never below 13 px. Weights are 400 for body and numbers, 500 for labels, and 600 at most for headings and buttons. Tap targets are 48 px. The phone's status bar and the shared pill are not counted.

**Safety.** Times, dates, hours and any phone number or link wrap and are never cut off with "…". An activity title wraps onto a second line rather than truncating. The crisis banner is untouched and never lazy-loaded. No patient data anywhere, including mockups.

**Colour (standard v12 §3, the dash of colour).** Beyond the pill and the current tab, CPD indigo appears only in these places, and on about a tenth of a screen at most:

- **Module header icons.** A 16 px icon on a 28 px `--mode-identity-soft` tile with a `--mode-identity-border` hairline, one per module header, and only on Today's dashboard modules: To do on Overview, and Targets, College extras and Your records on Year check. List pages (Log, Plan, Learning, Set up) have none, so the rule is the same everywhere.
- **One featured module per screen**, on the soft tint with the border edge:
  - "Your next step" in To finish;
  - none in the Log sheet, where a tinted three-row group took about a fifth of the screen in dark mode;
  - none on Learning, where a tint on external events could read as promotion;
  - none on Today, because the hero already leads.
- **First data series.** The current rotation on the training timeline. Calendar marks are status, so they stay grey.
- **The hero's graphic.** The progress bar fill on Today. Its text stays neutral, and the even-pace mark for today is product blue.

Buttons, links, chips, selection, status, text and numbers are never indigo. Every coloured thing also has a word or a shape, so the page works without colour.

**Functional UX.** Undo, kept forms, smart defaults and one-handed use are covered in §6.1. After every tap there is a visible state: a pressed row darkens, Save shows "Saving…" and then "Saved", and a failed save keeps the form and says what to do.

**CPD's three unique features** (only CPD can offer these, each with a daily or weekly reason to open it; none overlaps another mode):

1. **Three-tap Log again** (§8.1). The daily reason is the regular sessions a doctor goes to every week. Teaching's weekly review logs _hospital teaching sessions_; Log again covers everything else, so they don't repeat each other.
2. **The pace line and one To do list** (§8.2–8.3). The daily reason is a 5-second answer to "am I behind, and what's next?" No other mode tracks a doctor's own requirement.
3. **Copy next, for your CPD home** (§8.6). The weekly reason is that college portals still need each activity typed in. CPD holds the only record to copy from.

No AI, no new stored data and nothing offline is added. Anything like that would need Josh first.

**Works everywhere.** Dark mode, reduced motion, and phone, tablet and desktop layouts, with the side panel on desktop (§6.3). Charts are plain SVG or CSS. Fonts are the app's own local fonts. The work stays within the repository's bundle budget (`bundle-budget.json`), which CI enforces.

**Pass/fail checks, reported with each release PR and on the plan page:**

| Check                            | Pass means                                                                                                                                  |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Contrast                         | Every text and control pair meets WCAG AA (4.5:1 for body, 3:1 for large text and icons), in light and in dark                              |
| One primary action               | At most one dark command button visible per screen                                                                                          |
| Main task in three taps or fewer | A routine that is due: one tap ("Log 1 h" in To do). Any routine or recent activity: three ("+ Log", a Log again row, Save)                 |
| One state module                 | Loading, empty, signed out, offline and error use one shared component with the page's header and tabs kept                                 |
| One demo dataset                 | Every drawing and every demo screen uses the same demo doctor, the same numbers and one time of day (09:41, Sat 26 Sep 2026)                |
| Tap areas                        | Every control has a tap area of at least 48 px; small row buttons (34 px) and chips (36 px) carry an invisible 48 px hit area               |
| No tab badges                    | Tabs carry no count badges; counts appear only in words inside a module ("15 to copy") (addendum C)                                         |
| Stress frames                    | One frame at 200% text (rows stack, tabs scroll with an edge fade) and one real-length title that wraps and is never truncated (addendum H) |
| Nothing bold                     | No weight above 600 anywhere, and none above 400 on numbers                                                                                 |
| Four sizes at most               | The type floors above hold on every screen                                                                                                  |
| Nothing truncated                | No time, date, hours figure, number or title ends in "…"                                                                                    |
| Nothing jumps                    | The loading shapes match the loaded layout (layout shift under 0.1 in the browser tests)                                                    |
| Side by side                     | Before and after screenshots next to live CPD and On Call, in both themes                                                                   |

**Addendum A–I (coordinator, 18:23Z)** is met: honest forms and "Log again" never saves by itself (A, §6.1); recents first in "+ Log" (B, §8.1); status in words, no tab badges (C); no unsaved ticks anywhere in CPD (D); states keep the frame and exact privacy wording (E, §7); presets not yet available are hidden, not greyed (F, §9.1); every screen measured with Geist by script (G); stress frames (H); desktop panel arrows (I, §6.3). CPD shows no crisis numbers of its own; the app-wide crisis banner is untouched. **J–L (18:24Z)** are met too. J, home order: the hours panel is the answer card, readable in two seconds; the two tiles are part of that answer (the minimums); CPD has no ask box on Today (Log's own search stays on Log, with no mic); "Next to log" and "To finish" are CPD's tailored form of "Needs you", with no featured row on Today because the panel leads. K, shared data: nothing in CPD is seen by other people, so no preview-and-commit sheet applies; if that ever changes, K applies. L, safe thumbs: row actions ("Log 1 h", "Copy next", "Finish") are 34 px outlined shapes in 48 px tap areas at the row's right edge, and nothing destructive sits in thumb reach; archive and "Remove certificate" live in the activity's "…" menu, and removing a certificate still asks first.

**Independent critic.** Before each approval, a separate reviewer that did not draw the screens attacks every screen for anything cheap, bulky, dull, illogical or unsafe. Its findings are fixed and the review is repeated until nothing material is left. The plan page reports what it found.

## 7. Page by page

Each page lists its content and data sources. All six states apply to every page:

- **Loading:** static shapes.
- **Empty:** one factual line.
- **Signed out:** "It is linked to your account only, and it is not shared with your health service."
- **Offline:** "Your CPD record isn't kept on this phone. It opens again as soon as you're back online." with Try again.
- **Error:** "Nothing was changed. Try again, or come back in a few minutes." with Try again.
- **Empty:** one line, plus where to start ("Choose your CPD home in Set up, then tap + Log").

Every state keeps the page's header and tab row, and the loading shapes match the loaded layout, so nothing jumps.

### 7.1 Today › Overview

1–2. **Hero summary** (module 8, the only one in CPD; it replaces the plain first card). Command fill #111827 in light mode, `--surface-lux` with a hairline in dark mode. It holds:

- the season and the year's end, date first: "Last quarter · year ends 31 Dec 2026, in 14 weeks" (13 px);
- "32.5 of 50 h" (40 px/300);
- a thin module 7 progress bar of hours logged, with **no pace tick**: a mark ahead of the fill read as "you are behind", which grades the doctor;
- the **pace line** (§8.3).
  The same facts are in the words, so the bar is never the only signal. The panel uses the 16 px panel radius.
  **Never a score.** The hero shows a count of hours the doctor logged against targets they entered. It has no percentage, no ring, no ahead or behind colour, and no word that rates the doctor. CPD does not use the progress-ring variant for hours, because a ring around a doctor's own hours would read as a score (standard v10, module 7).

3. **Two fact tiles** (module 2), both in the "X of Y h" pattern: "Educational · 22.5 of 12.5 h · Minimum reached" and "Reviewing + outcomes · 10 of 25 h · Reviewing 8 h / Outcomes 2 h". Each opens its detail sheet. They carry the national baseline figures, or the doctor's own targets for another CPD home.
4. **Training line** (only when a current training period exists): "Stage 2 · rotation 3 of 4". It links to Plan › Training.
5. **Next to log** (§8.2, rows 1–3 and 8): the top two rows, then "Log" in the module header.
6. **To finish** (§8.2, rows 4–7): the top two rows, then "All N" in the module header.

Removed from the live page:

- the "CPD" heading;
- the requirement list (it lives in Year check);
- "Logged today";
- the coloured category bar.

The seasons stay: early year (plan), mid year, the last quarter (from 1 Oct), and the last fortnight (close the year, from 17 Dec, the existing year-close window). Build-plan decision 26 Sep: the drawings are dated 26 Sep, which is before the last quarter, so the live line on that date reads "Year ends 31 Dec 2026, in 14 weeks". The pace chart moves under "…". Module order stays customisable through Customise Today, using the existing `localStorage` key, which holds order only.

### 7.2 Today › Year check

- One line: "What an audit of 2026 would ask for, against the targets you confirmed on 8 Jan 2026."
- The intro line says it records what the doctor checked and is not certification.
- **Targets:** every target on its own row, with the figure as the second line and a plain status on the right ("17.5 h to go", "Reached", "1 to go"). The rows are total, educational, reviewing + outcomes, reviewing (5 h minimum), outcomes (5 h minimum), practice domains, and plan and self-evaluation.
- **College extras:** each extra from the doctor's CPD home, such as formal peer review, in the same form.
- **Your records:** certificates, reflections, and copied to your CPD home, each with "N missing" or "N to go" and a chevron to the filtered Log.
- **Copied** has an inline "Copy next" button (§8.6).
- **No count on the tab**, no ticks and no circles: nothing reads as a score.

### 7.3 Log › Activities

- One search box plus a "Filter" button.
- The Filter sheet holds:
  - Year: this year, last year, the one before, All years;
  - Counts toward: segmented;
  - Needs something: No certificate, No reflection, Not copied, Archived, each with a count;
  - "Also show archived" as its own row;
  - one "Show N activities" button.
  - The sheet is titled "Filter activities", rows show an empty circle or a blue check, and groups are 20 px apart. When a filter is on, the Log's filter button says so.
- Activities are grouped by month under a month header with a light total ("9.5 h"). A month shows its newest eight, then "Show all 14 in September". Hours show one decimal ("1.0 h") so the column lines up.
- Each row is 52 px: the title (500), a second line with the day, category and a note shown only when something is missing (a small grey dot and "No certificate"), and the hours in the right-hand column (400).
- The "0 evidence files" text disappears.

### 7.4 Log › To finish

One grouped list with three eyebrows:

- **Your next step:** drafts, with "Finish".
- **Waiting for someone:** a waiting note and a follow-up day.
- **Missed teaching:** "Tue 22 Sep · 1.5 h · not attended", with "Log catch-up". Footnote: "Missed sessions don't add hours. Link what you did instead."

The count shows on the tab. This moves the existing drafts and missed-sessions sections out from under the Log list. Their data and behaviour are unchanged.

### 7.5 Log › Routines

The existing routines page, restyled. The two dark buttons become one outlined "New routine", and each routine gets "Log now".

### 7.6 The Log sheet and the full form

**"+ Log" sheet**

1. **Log again** (§8.1): up to five rows on the featured tint. Tapping a row fills in the form; it never saves on its own.
2. **"Or something new"**, a title field. Typing offers matches from the doctor's own past titles (§8.1).
3. **Day chips:** Today, Yesterday, and "Other date" with an inline calendar icon; the chosen date replaces the label once picked.
4. **Hours chips:** 0.5, 1, 1.5, 2, 3 and Other. None is pre-selected.
5. **Counts toward:** Educational, Reviewing, Outcomes. None is pre-selected.
6. **"Add reflection and details"**, a row that opens the full form.
7. **Save**, at the foot of the sheet, grey until there is a title and hours.

**Full form (`/cme/new`, and "Add reflection and details" in the sheet).** It is a full-height sheet titled "New activity" over Log, with a close button, so the header and pill never change. In this order:

1. What it was.
2. When.
3. Hours.
4. Counts toward, with a "split the hours" link that opens hours per category.
5. **Reflection**, with a visible label ("Reflection · what an audit reads"). Under it: "Keep it free of patient names, initials, dates of birth and record numbers. You can leave it empty and add it later."
6. "More details": source, domains, cost, certificate, goal.
7. **One Save**, in a fixed footer with a hairline, and room under the content so nothing is covered.

### 7.7 Plan › Goals, Calendar, Training

- **Goals.** One line naming the plan and the day it was written. Each goal is a row with "5 activities · last Thu 10 Sep" as its second line and "6.5 h" on the right, or "Nothing linked yet" with no zeros. A "Self-evaluation" row shows its state ("Not started · for your 2026 year") and opens it, so Year check's pointer lands somewhere. A last row shows "Not linked to a goal". Under the list sits one action, "Edit goals". Planning time is logged like any activity. "Carry forward" is offered from 17 Dec (§8.8).
- **Calendar.** "Coming up" comes first, then the month. The calendar uses module 7 styling (hairline grid, today in product blue), 48 px day cells, and grey shape marks of 7–8 px and a legend, and a "Coming up" grouped list. "Put these in your phone's calendar", with the second line "Due dates and deadlines only, no activity details", keeps the existing private feed link. The feed is unchanged.
- **Training.** Four key facts in one grouped card (stage, rotation, training time, this rotation), then the existing timeline restyled as a module 7 timeline (grey ramp, the current rotation in CPD indigo, now in product blue, facts in words). One "Add a period or milestone" button. Milestone dates are calculated from FTE: for example 5.5 FTE months at 0.8 FTE is about 6.9 calendar months. It shows only what the doctor entered: "Your own record of your training, as you entered it. It is not your college's record." Part-time never changes a target, and the page says so.

### 7.8 Learning › Upcoming, Past

- Two filters: "Specialty" and "Format: Any" (online or in person). Specialty starts at the doctor's own, derived from the chosen CPD home (RANZCP means psychiatry; national baseline or another home starts at All), so nothing new is stored. One tap changes it to All. (Josh, card 18:43Z.)
- Items are grouped by month. Each shows its date range, place and mode, and a cost note if known.
- **Before an event:** a 48 px calendar button labelled "Add to calendar" for screen readers. It builds a single-event `.ics` in the browser with a **stable event id** (the directory item's id, so adding it twice updates the same event rather than duplicating it) and a **real alert** one day before. Nothing is sent to a server. Dates read "Wed 14 – Fri 16 Oct · in 18 days".
- **After an event (Past):** "Log as CPD", using the existing `cmeLearningFromSourceHref`.
- Items without confirmed dates sit under "Dates to confirm".
- A "Your hospital's teaching" row opens Teaching.
- Footer: "A curated list, not an endorsement. Checked 26 Sep 2026. Confirm dates, cost and CPD eligibility with the organiser."
- The directory JSON (`src/data/cme/wa-learning-directory.json`) gains an optional `specialties` array per item (a string list; missing means "all"). This is a data-file field, not a database change. New items are added only with a `sourceUrl` and a `lastCheckedOn`.

### 7.9 Set up

- **Read view:**
  - "Your 2026 requirements";
  - the CPD home by name, never the internal preset id;
  - national baseline figures, in plain words ("One activity in each of the 4" practice domains, "One plan and one self-evaluation");
  - "Your college's extras";
  - "You confirmed these on 8 Jan 2026 against the source you recorded."
  - "Edit" as a link beside the National baseline heading. Reminders move to the "…" menu.
- **Edit:** the existing form, starting with the **CPD home choice** (§9.1).
- `/cme/programme` renders this same read view, and its unique content merges in: the setup steps, and the requirement anchors that Today links to.

## 8. Smart features

All of these run on simple rules inside the app, over the doctor's own records that are already loaded. None uses AI. None sends anything anywhere new. Nothing is ever logged without the doctor's Save tap.

1. **Log again.**
   - Tapping a row fills in the form; Save is still the doctor's tap.
   - The sheet lists the doctor's routines that are due, then their last distinct activity titles (most recent first, de-duplicated by title, up to five in total).
   - A row fills title, hours and category; the day defaults to Today.
   - Typing in the title offers "Same as last time: 1 h · Educational" when it matches a past title (case-insensitive prefix, own entries only).
2. **One To do list.** Rows appear in this fixed order, and each shows only when its count is above zero:
   1. the season's Next step (always first). In the last quarter it is the largest open target, so it and the category gap are one row: "Reviewing + outcomes: 15 h to go · at least 3 h of it on outcomes";
   2. category gap, when it isn't already the Next step;
   3. routines due, with "Log 1 h" (one tap, with Undo);
   4. not copied to your CPD home, with "Copy next" (one tap, with Undo), whenever any are waiting, all year (Josh, card 18:43Z);
   5. drafts to finish, with the waiting count as a second line;
   6. reflections to add;
   7. certificates to add;
   8. Teaching sessions attended but not yet logged (§10).

   Today splits the list in two. **Next to log** holds rows 1–3 and 8 (what to log next). **To finish** holds rows 4–7 (what is already started or owed). Each shows its top two, and "All N" opens the full list. The one-tap rows come early on purpose, so the dashboard does things rather than only reporting.

   Counts are grey. There is no dismissing, so nothing needs storing.

3. **Pace in plain words.**
   - Formula: `weekly = (target − logged) ÷ max(1, weeks left)`, where weeks left counts from today to 31 Dec in Perth time, rounded to one decimal.
   - Wording: "About 1.3 h a week reaches 50 h by 31 Dec."
   - The line is hidden for the first four weeks of the year, and after the target is reached. After the target, it becomes "50 h reached on 12 Nov", a date, not a verdict.
4. **Save now, reflect later.**
   - Saving with the reflection empty is allowed; there is one Save button.
   - The row then shows "Reflection to add". It appears in To do and in the Filter's "No reflection".
   - This is derived from the empty field, so no new column is needed.
5. **Certificates never forgotten.** An activity without one says "No certificate" on its row, To do counts them, and "Add certificate" on the activity (and in the desktop panel) opens the existing evidence upload, with the file or camera picker and the existing de-identification tick. The Saved message carries Undo instead, so it has one action.
6. **Copy next, for your CPD home.**
   - One button copies the next not-yet-copied activity (oldest first), using the existing `formatEntryForCpdHome`.
   - It then marks the activity copied through the existing `transcribed` flag, with Undo.
7. **Same-day repeat check.** Saving an activity whose title matches one already logged on the same day (case-insensitive, trimmed) first asks "You logged this today already. Log it again?" with **Log again** and **Cancel**.
8. **Carry goals forward.** From 17 Dec, Plan › Goals offers each unfinished goal with a "Carry into 2027" button, one tap per goal. It is never automatic. It uses the existing plan-goal save path.
9. **Summary with certificate links.**
   - The annual summary lists each activity with its hours, category and a "Certificate" link.
   - The link goes to the existing owner-checked, 60-second signed-URL route.
   - There is no bundled download.
10. **Smart defaults in the form.** Hours and category chips remember the doctor's last choice **for that title only**, derived from their own entries. The day chip always starts at Today.
11. **Undo** (§6.1) on save, archive and mark-as-copied. Undoing a save removes the new activity through the existing `DELETE /api/cme/entries/[id]` route; undoing archive or copied flips the existing flag back.

### 8.1 Striking features (Josh, 18:44Z; all three added on cards, 19:05Z)

Josh asked for unique, high-yield, striking features. Each is rules-based over the doctor's own records, adds no stored data and no AI, and is drawn on the plan page.

12. **Your year in weeks** (Josh added it, card 19:05Z). The hours panel's thin progress bar becomes 53 thin seven-day bars counted from 1 Jan in Perth time (not ISO weeks; the last bar holds 1 or 2 days): each elapsed bar's height is the hours logged that week, in the hero's indigo fill (the allowed hero graphic); this week is product blue ("now"); weeks still to come are faint 3 px stubs. It answers "when did I actually do my CPD?" and never grades. Screen readers get "Hours logged in each week of 2026, this week last; 13 weeks to go", and the hours detail sheet lists the same data by month in words.
13. **Close the gap** (Josh added it, card 19:05Z). Tapping an open target in Next to log opens a sheet: the gap in words ("Reviewing + outcomes · 15 h to go by 31 Dec"), how much the doctor's own routines will add if they continue (cadence × hours × occurrences left before 31 Dec in Perth time, per category, shown as "about 12 of 15 h, if your routines continue"), and what is left to plan, with the number of Learning events before 31 Dec. A freshness line with the live dot, and "a plan, not a promise". Nothing is scheduled or saved.
14. **Close the year** (Josh added it, card 19:05Z). From 17 Dec (the season rule), one sheet gathers December's jobs: Copy next for the CPD home, the self-evaluation, carrying goals forward (§8.8), confirming next year's targets, and the annual summary with certificate links (§8.9). Rows end in plain status; nothing moves or is sent without a tap. It reuses the existing year-close panel's data.

## 9. Any doctor

### 9.1 CPD home

The Set up Edit view starts with "Your CPD home for 2026". The choice is stored per year in the existing year record (`cme_years.confirmed_source` / preset fields), so no schema change is needed.

- **National baseline only.** The Medical Board's categories and totals. The doctor can add their own extras.
- **RANZCP.** The existing preset, unchanged.
- **Other CPD home.** The doctor types its name and enters targets.
- **Another college (Soon).** Shown only as a disabled row until a preset exists. Each preset is added in its own small change, and only after that college's page is read from Josh's PC (the cloud cannot open college sites). Each carries a source link and a checked date.

The line under the choice reads: "A preset is a starting draft, not a claim that it matches your CPD home's whole programme."

### 9.2 Wording

- "MyCPD" becomes "your CPD home" unless the year's home is RANZCP.
- The 1 March reporting reminder shows only for RANZCP, as now.
- "For psychiatrists" disappears from Learning.
- Nothing says a training programme "covers" CPD.

### 9.3 Part-time

No screen offers to lower a target for part-time work. A doctor whose CPD home grants a change enters it in Edit, with the letter recorded as the source.

## 10. Links with other modes

CPD never writes another mode's data. No other mode reads CPD content. Every link is one-way into CPD, or a plain link out.

| Mode             | Link                                                                                                                                                                                                                                                                                                                                                                                                               | Who builds it                                                                                                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Teaching         | A To do row, "Teaching sessions to log (3)", opening Teaching's weekly review. The count comes from `GET /api/teaching?view=unlogged-count` (`{count}`). The row is hidden when the endpoint is missing, fails or returns 0. Teaching saves through its own `POST /api/teaching/cpd` (idempotent, `source_ref` `teaching:<uuid>`), so a session can't be logged twice. No CPD content enters Teaching's audit log. | CPD adds the row in the combined Release 3, once Teaching's endpoint is on main. Teaching's PR A repoints the old "Teaching sessions" link from On Call to `/teaching`. |
| Admin            | "Open CPD year check" on the registration row in Renewals. No figures; never in "Copy for workforce".                                                                                                                                                                                                                                                                                                              | Admin (already agreed). CPD changes nothing.                                                                                                                            |
| First Nations    | When the practice domain "culturally safe practice" has nothing logged, the season's Next step may point to `/first-nations/talking`. First Nations' "…" menu carries "Log as CPD" through `cmeLearningFromSourceHref`.                                                                                                                                                                                            | CPD adds the pointer in the combined Release 3 after First Nations lands; First Nations adds its button.                                                                |
| Roster           | "Plan leave for this" on a Learning event.                                                                                                                                                                                                                                                                                                                                                                         | Parked until Roster's leave feature exists.                                                                                                                             |
| Clinical answers | "Log as CPD" on an answer's sources stays as it is and carries the source, never the question.                                                                                                                                                                                                                                                                                                                     | No change.                                                                                                                                                              |

## 11. Privacy

- No new kind of data in any release.
- CPD content never enters the main search bar, voice input, OpenAI, the retrieval corpus, the health service, or another mode.
- Nothing personal is kept on the device for offline use. The offline state says so.
- The unsaved form in the tab's `sessionStorage` stays; the privacy assessment accepts that shape.
- "Add to calendar" builds the `.ics` in the browser, holding only the public event's title, dates and place.
- The CPD section for the privacy assessment (entry PIA-11, since Teaching took PIA-10) goes into `docs/privacy-impact-assessment.md` with Release 1.

## 12. Releases

Each release is one PR that merges on its own, touches no `supabase/` path, and can be undone with a single revert. Non-DB PRs go to the "Line up PR merges" thread once green.

**Release 1 — design pass.** No page moves.

- Light type everywhere, and the verdict wording.
- Today's hero summary (module 8), and module 7 styling for the progress bar, calendar and training timeline.
- Grouped lists and 48/52 px rows.
- One dark button per screen, with room under "+ Log".
- Grey chart and calendar shapes.
- Australian dates, day and hours chips, and reflection before Save.
- Fixes: the summary without a year, the internal preset id, the Routines buttons, checkbox consistency, the "9.5 H" capitals, and "not checked".
- Six states in both themes.
- Adds the privacy entry.
- Replaces the user-facing "CME" wording still live elsewhere (organisation health check, relayed 17:53Z):
  - `src/components/calendar/calendar-subscribe.tsx:119`: "your CME deadlines" becomes "your CPD deadlines";
  - `src/components/clinical-dashboard/settings-reminders.tsx:90`: "which CME and On Call reminders" becomes "which CPD and On Call reminders";
  - `scripts/generate-site-map.ts:185`: "CME dashboard" becomes "CPD", and "whether the pace is on track" becomes plain wording; then `docs/site-map.md` is regenerated with `npm run sitemap:update`.
    The code id `cme` in routes, file names and API paths stays.
- Tests:
  - a CPD **type-weight test** (no `font-bold`, `font-extrabold`, `font-black` or `--font-weight-value` in `src/components/cme/**`, and no weight above 400 on number classes);
  - a **verdict-words test** over CPD user-facing strings, which also fails on a user-facing "CME" in the three files above and in `src/components/cme/**`;
  - updated DOM tests for the changed wording;
  - `ui-cme-phone.spec.ts` updated.
- Waits for: nothing.

**Release 2 — pages and feel.**

- The five-page registry and tab rows (§4).
- The Today dashboard: hours panel, two tiles, Next to log and To finish, and the tap-a-figure detail sheet.
- The "+ Log" sheet with Log again, smart defaults, the repeat check and Save-reflect-later.
- The Filter sheet with All years; To finish; Copy next; Undo.
- The summary with certificate links.
- Desktop side panel and two-column Today (§6.3).
- Tests:
  - DOM tests for To do order, pace, the repeat check and Log again;
  - registry and active-page tests;
  - a route test that every old address still renders its tab.
- Waits for On Call's pill and pages-sheet change to land first, because both touch shared menu files.

**Release 3 — any doctor and connected modes, one staged build.**

- The CPD home choice, and "your CPD home" wording.
- The training line on Today.
- The Learning `specialties` field, filters, Add to calendar, and Past.
- Carry goals forward.
- Close the year sheet.
- The Teaching To do row.
- The First Nations pointer.
- Tests: presets, wording by home, `.ics` content, the goal carry-forward path, the year-close sheet, and connected-mode missing/zero and conditional-pointer cases.
- Starts after Release 2 merges. Independent items can be built while counterpart modes finish; the Teaching row waits for Teaching's count endpoint on main, and the First Nations pointer waits for that mode's build. All items share one final browser/gate pass and one PR decision; an unavailable dependency does not remove an item from this release.

**Gates for every release:**

- `npm run test:focused -- --files <changed>`;
- `npm run format`, committed;
- `npm run plan:browser` for the browser level (CPD component changes escalate to the full Chromium run, left to CI);
- the owner-scope and cross-tenant CPD tests stay green.

**Rollback:** revert the release's one squash commit. No data needs repair, because no data shape changes.

## 13. Coordination

- **Shared files:** `mode-secondary-navigation.ts`, `header-addon-slot.ts` and `mode-nav-icons.ts` (read only). Release 2 goes after On Call's pill change.
- **Pill and pages sheet:** On Call's rebuild owns them, and CPD edits neither.
- **Design standard:** CPD-only additions stay in this spec. A general addition goes to the coordinator.
- **Teaching PR A** repoints the old teaching link. CPD's combined Release 3 Teaching row depends on Teaching's count endpoint.
- **Database:** none. If a later idea ever needs one, it goes into Roster's combined DB PR under `/mnt/project-files/roster-mode/shared-db-contract.md`, and Josh merges it.

## 14. Later ideas (not in this work)

- Reading a certificate photo to fill the form. This needs a provider and privacy decision from Josh first.
- The Roster leave link.
- A monthly automated check of the Learning sources. The existing monthly routine already covers the WA directory.
- More college presets, each read from its own page.
