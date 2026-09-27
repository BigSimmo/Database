# CPD Mode Elevation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make CPD mode look and read like the new modes (light type, plain status words, Australian dates, a proper hero summary, honest states) without moving any page, then in later releases reshape it into five pages with a working Today dashboard, open it to any doctor, and connect it to Teaching and First Nations.

**Architecture:** Release 1 is a presentation and wording pass over the existing CPD code (`src/components/cme/**`, `src/lib/cme/**`, `src/app/(search-app)/cme/**`), plus a few small pure helpers (dates, pace, preset label, state choice) that later releases build on. Two new source-scanning tests (type weight and copy) stop bold type and verdict words coming back. The one shared file it touches, the calendar view, gets an opt-in prop so On Call is unchanged.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript 6 strict, Tailwind 4 tokens, Vitest (unit and `*.dom.test.tsx`), Playwright (`tests/ui-cme-phone.spec.ts`).

**Spec:** `docs/superpowers/specs/2026-09-26-cpd-elevation-design.md` (approved by Josh, 26 Sep 2026 18:43Z). Mockups: https://claude.ai/artifact/Ph4XmeMzciwkVRSY4Z5LJk (private design page).

**Plan status:** written 26 Sep 2026 against `origin/main` 67d961107 and reviewed once. **Release 1 is built and merged (PR #3119, 27 Sep 2026).** Releases 2 and 3 below are what remains; each is written out step by step when it starts. Release 3 combines the former any-doctor and connected-mode releases in one staged build and one final PR. Release 1's per-task step files stayed in the project folder and are not copied here.

## Global Constraints

- The mode is called **CPD** everywhere a user can see it. The code id stays `cme` in routes, tables, file names and API paths.
- The repo is public. No patient data and no real people's names anywhere, including tests, fixtures and screenshots. Test titles are made up ("Demo journal club").
- No database change in any release: nothing under `supabase/`, no new table, column or migration, no new stored data. No AI. Nothing new is kept on the device for offline use.
- Type: headings 600, labels and row titles 500, body and numbers 400. Never `font-bold`, `font-extrabold` or `font-black` in CPD. The one display figure is 40 px at weight 300.
- Four text sizes at most per screen: 15 px body, 13 px second lines and labels, 11 px eyebrows, one heading or display size. Body never below 13 px.
- No verdict words a user can read: Met, ready, on track, Required, complete, compliant. Status is plain: "Reached", "3 h to go", "4 of 11 done".
- A non-breaking space joins every number to its unit in user-facing text (` ` in TS strings): "0.5 h", "0.8 FTE".
- Colour: CPD indigo only on the pill, the current tab, module header icons, one featured module per screen, the first data series and the hero's graphic. Never on buttons, links, chips, text or numbers. Selection is product blue. Every coloured thing also has a word or a shape. Green `--success` only for live freshness, as a 6 px dot with its word, one 600 ms pulse on a change to fresh, never on load, never looping, none with reduced motion.
- Elevation: `--e1` for raised modules, `--e4` for sheets, the floating "+ Log" and the Undo bar. Nothing else.
- One dark (primary) button per screen. On list pages it is the floating "+ Log"; on a form it is Save.
- Tap targets: 48 px (`min-h-12`) in production. Never lower them to `min-h-11`. Small visual controls (34 px row buttons, 36 px chips) carry a 48 px hit area.
- Dates read "Sat 26 Sep", with the year only when it is not the current one. Times are 24-hour. Everything is Perth time (Australia/Perth). No US-format browser date box.
- Unknown counts show "Not checked", never a reassuring sentence.
- Part-time work never lowers a target. Nothing computes a reduced target.
- Design tokens only, no hex in components (the `no-hardcoded-hex` lint rule).
- Never `git add -A`. Commit each task when its tests pass, after `npx prettier --write` on exactly the files that task stages (the pre-push hook checks formatting on every pushed commit). Push after each commit. Task 17 runs the whole-tree `npm run format` once more before the PR.
- GitHub through the GitHub MCP only, never `gh api`. Josh merges nothing here that touches the database, because nothing does; the PR goes to the "Line up PR merges" thread when green.
- The hero's dark panel uses On Call's shared tokens `--surface-summary`, `--surface-summary-ink`, `--surface-summary-muted` and `--surface-summary-line` (On Call's kit, PR #3115, standard v13.3). CPD never defines them; if they are not on main when Task 12 starts, ask On Call through the coordinator to split them into their own small PR first.
- Mode colours are checked by colour difference (standard v13.2: at least 8 ΔE2000 from each other mode and product blue). CPD indigo passes against Roster at 8.3 and does not change.
- `docs/privacy-impact-assessment.md` keeps its `Revised:** 2026-09-01` and `Status:** Draft for governance approval` lines; a test pins both.

## Review Focus

1. **A year closed before this change.** Its stored summaries say "Met" or "5 hours short". The screen must read "Reached" / "5 h to go" without rewriting stored data. Pinned in Task 2 (`closedRequirementSummaryText`, plus a year-close DOM fixture with an old-style row).
2. **Evidence never counted** (demo data, or a loader that skips counts). Year check must say "Not checked", and the Log's "Missing evidence" filter must not list those activities. Pinned in Task 4 and Task 11 step 3c.
3. **No target, a zero target, or a past or future year.** The hero shows no pace line and never divides by zero; another year's line reads "Year ended 31 Dec 2025" or "Year starts 1 Jan 2027". Pinned in Task 12's `pace.ts` tests.
4. **Typing a date on a phone keypad, or in US order.** "26092026" is accepted (the iPhone number pad has no "/"); "9/26/2026" and "31/2/2026" are refused and never silently swapped or saved. Pinned in Task 8's `parseCmeDayInput` tests.
5. **A save that fails offline mid-form.** The form keeps every field and says the doctor is offline, never the browser's "Failed to fetch". Pinned in Task 15 step 3f.

## Release 1 tasks

| #   | Task (one file each; an implementer reads only its own task file plus this page)            |
| --- | ------------------------------------------------------------------------------------------- |
| 1   | CPD, not CME, in three files outside CPD; regenerate the site map                           |
| 2   | Plain status words in the CPD library; old closed years reworded on display                 |
| 3   | Plain words on the CPD screens, plus the copy-contract test                                 |
| 4   | Year check says "Not checked" when evidence was never counted                               |
| 5   | Show the CPD home by name, not the preset id                                                |
| 6   | /cme/summary with no year opens the current year                                            |
| 7   | Type weights test; nothing bold; numbers at 400; "9.5 h"                                    |
| 8   | Australian dates: row date helper, day parser, CmeDateField replaces every browser date box |
| 9   | Entry form: hours chips with Other, nothing pre-chosen, Save grey until ready, privacy line |
| 10  | Routines: one dark button per screen                                                        |
| 11  | Log: hairline list per month, 52 px rows, honest "No certificate", one checkbox             |
| 12  | Today hero summary with season, hours, plain bar and weekly pace                            |
| 13  | Calendar: opt-in grey shape marks (On Call unchanged)                                       |
| 14  | Training timeline (module 7)                                                                |
| 15  | Six states: offline and error with Try again, static skeleton, honest offline save          |
| 16  | Privacy assessment entry                                                                    |
| 17  | Browser spec, fast checks, format, one push, PR                                             |

**New files (Release 1):** `src/lib/cme/pace.ts`, `src/lib/cme/load-state.ts`, `src/lib/cme/hours-input.ts`, `src/components/cme/cme-date-field.tsx`, `src/components/cme/cme-choice-chip.tsx`, `src/components/cme/cme-hero-summary.tsx`, `src/components/cme/cme-training-timeline.tsx`, `src/components/cme/cme-loading-skeleton.tsx`, `src/app/(search-app)/cme/error.tsx`, and tests `cme-copy-contract`, `cme-type-weight`, `cme-checkbox-consistency`, `cme-pace`, `cme-load-state` and the DOM tests each task names. **Shared files touched:** `src/components/calendar/calendar-view.tsx` (opt-in prop only), `src/app/globals.css` (CPD's own `--cme-hero-fill` and one 40 px size; never On Call's tokens), `tests/mode-home-loading-contract.test.ts` (one CPD exception), `docs/design-system/adoption-manifest.json` and `COMPONENTS.md` (regenerated by `npm run design-system:adoption:update`), `docs/site-map.md` (regenerated), `docs/privacy-impact-assessment.md`.

## On Call's mode kit, merged to main in PR #3115 (read before Tasks 10, 11, 12 and 15)

Those tasks were drafted before the kit existed, against assumed names. The real kit (PR #3115, merged to main 26 Sep) differs in these ways; use the real API and do **not** stop for these differences:

- **No index file.** Import each piece from its own file: `@/components/mode-kit/grouped-list` (`ModeGroupedList`, `ModeRow`), `/action-button` (`ModeActionButton`), `/notice` (`ModeNotice`), `/module-skeleton` (`ModeModuleSkeleton`), `/fact-tile`, `/state-label`, `/updated-line`, `/hero-link`, `/type` (`modeNumberText`, `modeNameText`, `modeHeadingText`, `modeDisplayNumberText`, `modeSecondaryText`), `/recipes` (`modeSummarySurface`, `modeSummaryMutedText`, `modeSummaryHairline`, `modeRowHeight`, `modeInsetHairline`, `modePressable`, `modeTapArea`, `modeDot`, `modeIconTile`, `modeFeaturedSurface`, `modeRaisedCard`), `/dates`. Never import from `on-call/kit`.
- **`ModeGroupedList`** takes `eyebrow` (string, not `label`), optional `headerIcon` and `mode="cme"` (which paints only the header icon tile), `id`, `testId`, `className`, `children`. There is no `action` slot. The month total sits beside a plain heading, never inside the uppercase eyebrow (that would bring back "9.5 H").
- **`ModeRow`** takes `title`, `subtitle`, `meta`, `trailing`, `href`, `testId`, `className`. It has no `onClick`; a row that acts rather than links wraps its own button.
- **`ModeActionButton`** is icon-only: `label` becomes its accessible name and no words show. Worded actions ("Log 1.0 h", "Log now", "New routine", "Try again") keep the app's `Button`.
- **`ModeNotice`** takes `children` and `tone` ("neutral" or "warning"), with no title or action slots. The CPD state notice puts its line and a secondary `Button` "Try again" inside `children`.
- **`ModeModuleSkeleton`** takes `rows`, `twoLine` and `eyebrow`. Build Today's skeleton from it for the lists, and from plain static blocks with the hero's 16 px radius for the hero and tiles.
- **Hero (Task 12):** use `modeSummarySurface`, `modeSummaryMutedText` and `modeSummaryHairline`, and `modeDisplayNumberText` for the 40 px figure. The four `--surface-summary` tokens are in the kit PR, so Task 12 adds only CPD's own `--cme-hero-fill`.
- **Dates:** the kit's `formatModeDate` writes "20 Sep 2026". CPD rows need "Sat 26 Sep", so Task 8's `formatCmeRowDate` stays.

## How to build it (efficiency, Josh 18:57Z, 19:07Z, 19:11Z, 19:20Z, 19:28Z)

- **Where:** a fresh build thread, started from a short build brief, because this design thread's long history would be re-read on every step. This design thread stays for design questions.
- **Who:** Native execution: one implementer works the 17 tasks in order on a mid-tier model, because the tasks share files (the dashboard, entry form and set-up page are each edited by three or four tasks) and every step already carries its exact code, checked against main. No parallel lane: the repository's pre-commit hook refuses a commit while another agent has unstaged files under `src/components/` or `tests/`, so two lanes in one worktree block each other.
- **Checks:** only the fast local ones: the task's own tests after each task (plus `npm run design-system:adoption:update` before a commit that changes component imports, because the pre-commit hook checks it), then once at the end `npm run test:focused` over the changed files, `npm run lint`, `npm run typecheck` and `npm run format` (committed). CI runs the browser suite and everything heavy.
- **Pushes:** push the branch after every task commit, so a recycled cloud container never loses work (a branch push without a PR runs no CI). Open the PR once, in Task 17. Fixes after review go into the same PR.
- **Review:** one adversarial review of this plan (done, see "What the review changed") and one review of the final diff by a fresh reviewer on the most capable model (the `personal-practice-reviewer` agent covers this area). No other review rounds.
- **Stop points:** Step 0 of Tasks 10, 11, 12 and 15 checks the kit. Differences listed in the kit section above are expected and never a reason to stop. The kit and tokens are on main, so no stacking is needed.
- **Efficiency:** what the plan cut or merged. It reuses On Call's `mode-kit` (grouped list, rows, action button, notice, skeleton) and its hero tokens instead of CPD copies; it adds no new visual test harness (the two source-scanning tests replace a screenshot suite); the Release 1 browser work is edits to the one existing CPD spec; Releases 2 and 3 are written out step by step only when each starts, against that day's main, so no detail goes stale; plan-writing ran as four parallel drafting lanes and one review.

## Decisions made while planning (defaults; change any by saying so)

- **Seasons:** "Last quarter" starts 1 Oct. "Last fortnight" reuses the existing year-close window from 17 Dec (the spec said 18 Dec; the app already uses 17 Dec, so one rule). The drawings are dated 26 Sep, so on that day the live line reads "Year ends 31 Dec 2026, in 14 weeks".
- **Chips:** a small CPD choice chip (36 px in a 48 px tap area, weight 400) instead of the shared `ChoiceChip`, which is 40 px at weight 600–700 and cannot be restyled without changing every mode. If On Call's kit ships a chip, the builder uses it instead.
- **Privacy line size:** 14 px, because the form already uses 14 px and the design-system check forbids mixing 13 and 14 in one file.
- **Save stays focusable** when not ready (grey, `aria-disabled`), so screen readers still find "Save entry".
- **Privacy entry number:** the next free PIA number when Task 16 runs (Teaching also plans PIA-10).
- **Log rows:** the routine pill, source link and copied tick leave the row (the activity page still shows them); "Show all 14 in September" waits for Release 2 so the browser spec's 47-row check holds.
- **Privacy line under the reflection:** "Keep it free of patient names, initials, dates of birth, record numbers and other identifiers." (the spec's wording, keeping today's "other identifiers").
- **Dates in Release 1:** "Sat 26 Sep" is used for date inputs and log rows. Other screens (provenance, annual summary, training, Year check) change in Release 2.
- **Pace in the last week:** from 25 Dec the line reads "3 h to go by 31 Dec" instead of an hours-a-week figure.
- **A closed year** shows no pace line.
- **Undo after saving** (Release 2) archives the new activity, because the existing delete route archives; it is hidden unless "Also show archived" is on. Undo after "Copy next" needs the copy route to accept "not copied" again, an app change with owner-scope tests, no database change.
- **Known Release 1 gaps, deferred to Release 2 and listed in the PR's pass/fail table:** grouped lists on Year check, Plan and Training (Log and Routines get them now); page-shaped loading for Plan, Calendar, Training and Set up (Today and Log get them now); the missed-session form's Save showing beside "+ Log"; more than four text sizes on Today until its heading goes; the layout-shift browser test.

## What the review changed

One adversarial pass, two reviewers, each applying every Replace snippet in order to a scratch copy of main and running the tests (tasks 1–9: 204 of 205 anchors matched, 802 tests passing after the fix).

- Rewrote Tasks 10, 11, 12 and 15 against On Call's real kit (merged as #3115), not an assumed one. The kit's action button shows only an icon, so worded actions ("Log 1.0 h", "Log now", "Try again") keep the app's own button.
- Fixed the month total so it can never become "9.5 H" again, one broken anchor in Task 8, the hero's CSS anchor after the kit landed, and two tap-size tests that 52 px rows would have failed.
- A typed date now counts the moment it is complete, not only when the box loses focus, so Save never stores the wrong day. The iPhone keypad gains a "." key.
- Added what the spec needed and no task delivered: the empty state, room under "+ Log", grouped routines, an honest offline save message with a form test, and error logging for support.
- Dropped the parallel lane (the commit hook blocks it), pushed after every task, and cut per-task whole-project checks.
- Releases 2 and 3: "Your year in weeks" uses 53 seven-day bars from 1 Jan (not ISO weeks); Close the gap tests the real cadences (weekly, monthly, quarterly); Close the year and goal carry-forward stay offered until the year is closed, not only to 31 Dec; spec items with no release (listed in Release 2 item 15) are now placed.

## Releases 2 and 3: task lists

These are concrete task lists, not yet step-by-step. Each release is written out in the Release 1 format (test first, exact code, commit per task) **on the day it starts**, against the `origin/main` of that day, because Release 1 and other modes' work will have moved the lines. Each release is its own PR on a fresh branch from `origin/main`, touches no `supabase/` path, and reverts as one commit. The written-out version goes to Josh only if it changes what the spec promised.

### Release 2: pages and feel

**Starts when:** Release 1 has merged, and On Call's pill and pages-sheet change is on main (both touch `src/lib/mode-secondary-navigation.ts` and `src/components/mode-nav/**`). Check with the coordinator before starting.

1. **Five-page registry.** `src/lib/mode-secondary-navigation.ts`: CPD's list becomes `year` Today `/cme`, `log` Log `/cme/log`, `plan` Plan `/cme/plan`, `learning` Learning `/cme/learning`, `setup` Set up `/cme/setup` (ids kept, so `iconByItemId` in `mode-nav-icons.ts` and On Call's `calendar` are untouched). Active matching: `/cme/check` → `year`; `/cme/routines` → `log`; `/cme/calendar`, `/cme/training` → `plan`; `/cme/programme` → `setup`. Update `src/components/mode-nav/header-addon-slot.ts` (its `/cme/programme` and `/cme/setup` lines) in the same commit. Tests: registry entries and every active-page mapping.
2. **Tab rows.** A `CmeTabRow` on the standard's compact tab spec, attached through `PhoneHeaderCollapsePortal`, with each tab a link to its address (spec §4.2 table, including the new `/cme/log?tab=finish`). No count badges. Tabs scroll with an edge fade at 200% text. Test: a route test that renders every old address and finds its tab selected.
3. **Programme merges into Set up.** `/cme/programme` renders the Set up read view; the setup steps and the requirement anchors Today links to move into it. Reminders move to the "…" menu. Test: every anchor Today links to exists on the Set up read view.
4. **Today dashboard.** Two fact tiles (module 2, "X of Y h"), **Next to log** (spec §8.2 rows 1–3 and 8, top two, "Log" in the header) and **To finish** (rows 4–7, top two, "All N"). A shared `buildCmeTodo(...)` in `src/lib/cme/todo.ts` returns the fixed-order rows with counts; both modules slice it. The pace chart moves under "…". Tests: row order for each season, zero-count rows hidden, "Copy next" shown all year.
5. **Detail sheet.** Tapping any figure on Today or a Year check row opens a sheet: the figure at 40 px/300, what adds up to it, the source and counted time with the live "Up to date" dot (one 600 ms pulse only on a change to fresh; none on load or with reduced motion), Copy, Share and "See the activities". Test: the dot does not animate on first render and does under a data refresh; reduced motion disables it.
6. **"+ Log" sheet.** Log again rows (due routines, then last distinct titles, up to five), the title field with "Same as last time" matches, day and hours chips from Release 1, Save at the foot. It never saves by itself. Tests: Log again fills and does not save; de-duplication by title; own entries only.
7. **Same-day repeat check.** "You logged this today already. Log it again?" with Log again and Cancel. Test: case-insensitive, trimmed match on the same Perth day only.
8. **Save now, reflect later; Undo.** One Save; "Reflection to add" on the row. Undo for 6 seconds on save (archives the new entry through the existing `DELETE /api/cme/entries/[id]`, which archives rather than deletes), archive and mark-as-copied. Test: Undo after save leaves the entry archived, not visible, and the list does not reorder.
9. **Filter sheet and To finish tab.** Year (this, last, the one before, All years), Counts toward, Needs something (with counts), Also show archived, "Show N activities". To finish: drafts, waiting, missed teaching, moved out from under the Log list with unchanged data. Tests: each filter; the button label count.
10. **Copy next.** One button copies the oldest not-yet-copied activity with the existing `formatEntryForCpdHome` and marks it copied (`PATCH {transcribed:true}`), with Undo. Test: order, and Undo flips the flag back.
    10b. **Undo for Copy next** needs `PATCH /api/cme/entries/[id]` to accept `{transcribed:false}` and clear the copied time: an app route change with owner-scope tests, no database change.
11. **Summary with certificate links.** Each activity row links to the existing owner-checked 60-second signed URL route. No bundled download. Test: the link uses the route and nothing else.
12. **Desktop.** Two-column Today from 1024 px; Log opens an activity or the form in a side panel with previous, next and close; Ctrl/Cmd+Enter saves, Escape closes. Tests: keyboard handlers; panel navigation.
13. **Your year in weeks** (Josh added it, 19:05Z): the hero's bar becomes 53 seven-day bars counted from 1 Jan in Perth time (days 1–7, 8–14, …; the last bar holds 1 or 2 days), not ISO weeks (`buildCmeWeekBars(entries, year, today)` in `src/lib/cme/pace.ts`; this week marked "now", future weeks as stubs), with the aria label and the month-by-month words in the hours detail sheet. Tests: the bars sum to the year's total; 31 Dec lands in bar 53; 29 Feb in a leap year.
14. **Close the gap** (Josh added it, 19:05Z): tapping an open target in Next to log opens a sheet. `cmeRoutineProjection(routines, today, year)` in `src/lib/cme/pace.ts` returns hours per category the routines will add by 31 Dec (cadence × usual hours × occurrences left, Perth time), and the sheet shows "about 12 of 15 h, if your routines continue", what is left, and the count of Learning events before 31 Dec. Nothing is scheduled or saved. Tests: weekly, monthly and quarterly cadences across the year end; a routine with no category hours adds nothing; archived routines ignored; no routines gives "0 of 15 h".
15. **Spec items still to place, all in this release:** "Keep as draft?" when leaving a half-filled form; dates that say how far away they are ("Tue 29 Sep · in 3 days") on every screen; "Saving…" then "Saved"; text at 200% with rows stacking from 135% and the tablet's centred sheet; the Year check restyle (Targets, College extras, Your records, inline Copy next); the full form as a "New activity" sheet with a fixed footer, "split the hours" link and labelled Reflection; Plan goal rows with the Self-evaluation row and "Not linked to a goal"; Calendar's "Coming up" list and new feed wording; Training's four key facts; the Set up read-view wording; hours and category remembered per title (§8.10); grouped lists on Year check, Plan and Training; loading shapes for Plan, Calendar, Training and Set up; the missed-session form's Save no longer beside "+ Log"; four sizes on Today; a layout-shift browser test; the offline save message ("You're offline, so nothing was saved", every field kept, via `cmeSaveErrorText`) on every other CPD save: routines, training periods and milestones, set up, plan goals, drafts, missed sessions, archive and year close (Release 1 did the activity form only).
16. **Browser spec, gates, PR**, as Release 1 Task 17.

### Release 3: any doctor and connected modes

**Starts when:** Release 2 has merged. Build the independent any-doctor work while counterpart modes finish, then add the Teaching row once its count endpoint is on `main` and the First Nations pointer once that mode has landed. Keep all items in one staged build, with one browser/gate pass and one final PR decision. Do not mark the release complete by omitting a blocked connected-mode item.

1. **CPD home choice.** Set up's Edit view starts with "Your CPD home for 2026": National baseline only, RANZCP (existing preset), Other (name and targets), and future presets hidden until each exists. Stored in the existing year record (`confirmedSource` and preset fields), no schema change. Test: each choice saves and reloads; a hidden preset is not rendered.
2. **Wording by home.** "MyCPD" only when the year's home is RANZCP; otherwise "your CPD home". The 1 March reporting reminder shows only for RANZCP (as now). Test: both homes, every screen string that changes.
3. **Training line on Today.** "Stage 2 · rotation 3 of 4", only with a current training period, linking to Plan › Training. Test: hidden without a current period.
4. **Learning.** Optional `specialties` array per item in `src/data/cme/wa-learning-directory.json` (missing means all); the Specialty filter starts from the CPD home (RANZCP → psychiatry, otherwise All), one tap to All; Format filter; month groups; "Dates to confirm"; Past with "Log as CPD" through `cmeLearningFromSourceHref`; the "Your hospital's teaching" row. Tests: filter defaults per home; missing `specialties` shows everywhere.
5. **Add to calendar.** A 48 px icon button ("Add to calendar" for screen readers) builds a single-event `.ics` in the browser: `UID` is the directory item id plus a fixed domain suffix, all-day or timed per the item, `VALARM` one day before, title, dates and place only. Test: exact `.ics` text for a fixture item, including the UID staying the same across two builds.
6. **Carry goals forward.** From 17 Dec, each unfinished goal offers "Carry into 2027", one tap each, through the existing plan-goal save path. Offered from 17 Dec until the year is closed (`canCloseCmeYear(set.year, now) && !set.closedAt`), so it is still there in January while the college window is open. Test: not before 17 Dec; still offered on 10 Jan for an open year; gone once closed; never automatic.
7. **Close the year** (Josh added it, 19:05Z): from 17 Dec Today offers one sheet: Copy next, Self-evaluation, Carry goals into next year, Confirm next year's targets, Annual summary. Rows end in a plain status and every action is a tap. Built from the existing year-close panel's data. Offered from 17 Dec until the year is closed (same rule as item 6). Test: not before 17 Dec; still offered on 10 Jan for an open year; gone once closed; each row's status from fixture data.
8. **Teaching row.** In Next to log: "Teaching sessions to log (N)", opening Teaching's weekly review. Hidden when the endpoint is missing, fails or returns 0. No CPD content goes to Teaching. Test: hidden on 404, on a network error and on `{count:0}`. Requires Teaching's `GET /api/teaching?view=unlogged-count` on `main`.
9. **First Nations pointer.** When the practice domain "Culturally safe practice" has nothing logged, the season's next step may point to `/first-nations/talking`. Test: shown only in that case. Requires the First Nations build to have landed.
10. **Browser spec, gates, PR**, as Release 1 Task 17, covering both the any-doctor and connected-mode work together.
