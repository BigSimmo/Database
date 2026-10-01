# Roster team calendar and calendar-first swaps — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Roster a team Month / Week board / Day calendar with a manager layer, a calendar-first swap flow and a Swaps page, with no database change.

**Architecture:** Pure logic modules under `src/lib/roster/team/` turn the existing team reads into calendar cells, cover counts, rule flags, swap options and swap progress. Thin React components under `src/components/roster/` render them. The server stays the authority: every action goes through the existing team routes and SQL.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Tailwind 4 tokens, mode-kit parts, Vitest (node and jsdom), Playwright.

**Spec:** `docs/superpowers/specs/2026-09-30-roster-team-calendar-and-swaps-design.md`

## Global Constraints

- No database migration and no new server read. Reads used: `overview`, `assignments` (window at most `ROSTER_MAX_WINDOW_DAYS` = 62), `requests`, `manage`, `people`, `maker`.
- Nothing about a roster is written to the device. View, date and filter live in the URL: `/roster/team?view=month|week|day&date=YYYY-MM-DD&show=everyone|me|grade:<grade>|person:<uuid>|compare:<uuid>`. `tests/roster-team-device-storage.dom.test.tsx` must stay green.
- Default view is `week`; default date is today in Perth (`perthDateOf`); default show is `everyone`.
- Times are Perth (`src/lib/roster/shifts/perth-time.ts`). Weeks start Monday (`monthGridRange`).
- Shift letters and labels come from `SHIFT_LETTER` and `SHIFT_KIND_LABEL`; public holidays from `WA_PUBLIC_HOLIDAYS`.
- Design tokens only (no hex), tap targets `min-h-12`, lucide icons `aria-hidden`, reduced-motion and forced-colours respected. No calendar library.
- Delayed send: 10 seconds (`UNDO_MS` = 10_000) with Undo, sent with `keepalive`.
- Pending swaps are shown only to the two people involved (from `requests`) and the manager (from `manage`).
- Copy in plain Australian English, no verdict words, sentence case.
- Everything works in example mode (release held) and offline demo mode.

## Review Focus

1. An overnight shift that starts on the last day of a month or week must appear on its start day only, with "+1" shown for the end, never counted twice in cover. Owner: Task 1 and Task 2 tests.
2. A team with no targets (`maker.needs` empty) or a member reader (no `maker` access) must show no cover counts and no error. Owner: Task 2 and Task 8.
3. A colleague with a missing grade or name must still appear on the board and in "Can't swap" with a reason, never vanish. Owner: Task 1 and Task 3.
4. A swap whose `expiresAt` has passed while still `requested` must read "Expired" and offer no Accept. Owner: Task 4.
5. Leaving the page during the 10 second hold must cancel the swap, not send it (matching Teaching). Owner: Task 9.

---

### Task 1: Calendar model and URL state

**Files:**

- Create: `src/lib/roster/team/calendar-model.ts`
- Test: `tests/roster-calendar-model.test.ts`

**Interfaces:**

- Produces:
  - `type CalendarView = "month" | "week" | "day"`
  - `type CalendarShow = { kind: "everyone" } | { kind: "me" } | { kind: "grade"; grade: RosterGrade } | { kind: "person"; userId: string } | { kind: "compare"; userId: string }`
  - `type CalendarState = { view: CalendarView; date: string; show: CalendarShow }`
  - `readCalendarState(params: URLSearchParams, today: string): CalendarState` (invalid values fall back to defaults)
  - `calendarStateQuery(state: CalendarState): string` (omits defaults)
  - `calendarWindow(state: CalendarState): { from: string; to: string }` (month: `monthGridRange`; week: Monday to Sunday; day: day-1 to day+1, all within 62 days)
  - `stepCalendar(state: CalendarState, direction: -1 | 1): CalendarState`
  - `filterAssignments(rows: readonly RosterAssignment[], show: CalendarShow, me: string | null): RosterAssignment[]`
  - `type MonthCell = { date: string; inMonth: boolean; holiday: boolean; shifts: RosterAssignment[]; mine: RosterAssignment[] }`
  - `monthCells(monthKey: string, rows: readonly RosterAssignment[], me: string | null): MonthCell[][]`
  - `type BoardRow = { userId: string | null; name: string; grade: RosterGrade | null; isMe: boolean; days: (RosterAssignment[])[] }`
  - `weekBoard(monday: string, rows: readonly RosterAssignment[], me: string | null): BoardRow[]` (me first, then by grade rank, then name; unnamed rows labelled "Unnamed")

- [ ] **Step 1: Write the failing tests** — `readCalendarState` defaults and round-trip with `calendarStateQuery`; `calendarWindow` for each view never exceeds 62 days; `stepCalendar` moves by month, 7 days and 1 day; `monthCells` puts a night starting `2026-10-31T21:30+08:00` only on 31 Oct and flags `holiday` on a `WA_PUBLIC_HOLIDAYS` date; `weekBoard` orders me first and keeps a row whose `name` and `grade` are null (Review Focus 1 and 3).
- [ ] **Step 2: Run** `npx vitest run tests/roster-calendar-model.test.ts` — expect FAIL (module missing).
- [ ] **Step 3: Implement** the functions above. Use `assignmentStartDate` from `team-view.ts` for day placement and `gradeRank` for ordering.
- [ ] **Step 4: Run** the test — expect PASS.
- [ ] **Step 5: Commit** `feat(roster): calendar model and URL state for the team calendar`.

### Task 2: Cover counts and rule flags

**Files:**

- Create: `src/lib/roster/team/cover.ts`, `src/lib/roster/team/rule-flags.ts`
- Modify: `src/components/roster/manage/roster-cover-tab.tsx:200-215` (use `coverForDay`)
- Test: `tests/roster-cover.test.ts`, `tests/roster-rule-flags.test.ts`

**Interfaces:**

- Consumes: `RosterMaker["needs"]`, `RosterRules`, `RosterAssignment`.
- Produces:
  - `type CoverCount = { kind: RosterAssignmentKind; rostered: number; needed: number; state: "short" | "met" | "over" }`
  - `coverForDay(date: string, rows: readonly RosterAssignment[], needs: RosterMaker["needs"]): CoverCount[]` (dated needs override weekday needs; `weekday` is 1 = Monday to 7 = Sunday, matching the database check `weekday between 1 and 7`; kinds with no need are omitted; leave never counts)
  - `type RuleFlag = { assignmentId: string; rule: "minBreakHours" | "maxNightsInRow" | "maxDaysInRow" | "maxHours7d" | "maxHours14d"; words: string }`
  - `ruleFlags(rows: readonly RosterAssignment[], rules: RosterRules): RuleFlag[]`

- [ ] **Step 1: Write the failing tests** — `coverForDay` returns `[]` for empty needs (Review Focus 2); a dated need beats a weekday need; a `weekday: 7` need counts on a Sunday and `weekday: 1` on a Monday; an overnight shift counts on its start day only; `ruleFlags` flags a second shift starting 8 hours after the first when `minBreakHours: 10` with words `"Less than 10 hours' rest before this shift"`, and a fourth night in a row when `maxNightsInRow: 3` with `"4th night in a row (team limit 3)"`.
- [ ] **Step 2: Run** `npx vitest run tests/roster-cover.test.ts tests/roster-rule-flags.test.ts` — expect FAIL.
- [ ] **Step 3: Implement** both modules. Reuse `hoursSinceLastShift` from `eligibility.ts` for the break rule. Point `roster-cover-tab.tsx` at `coverForDay` too: it compares `weekday` with `getUTCDay()` (Sunday is 0), so Sunday targets never match today.
- [ ] **Step 4: Run** — expect PASS.
- [ ] **Step 5: Commit** `feat(roster): cover counts and rule flags for the manager calendar`.

### Task 3: Swap options with reasons

**Files:**

- Create: `src/lib/roster/team/swap-options.ts`
- Test: `tests/roster-swap-options.test.ts`

**Interfaces:**

- Consumes: `swapCandidates`, `placementProblem`, `gradeRank`, `swapNeedsManager` from `eligibility.ts`.
- Produces:
  - `type CannotReason = "lower_grade" | "no_grade" | "already_working" | "rest_rule"`
  - `type SwapChoice = { userId: string; name: string | null; grade: RosterGrade | null; sameGrade: boolean; takeBack: RosterAssignment[] }`
  - `type SwapBlocked = { userId: string; name: string | null; reason: CannotReason; words: string }`
  - `swapOptions(input: { rows: readonly RosterAssignment[]; give: RosterAssignment; me: { userId: string; grade: RosterGrade | null }; settings: Pick<RosterSettings, "rules" | "swapApproval">; now: Date }): { can: SwapChoice[]; cannot: SwapBlocked[] }`
  - `swapPreview(rows: readonly RosterAssignment[], give: RosterAssignment, take: RosterAssignment | null, meId: string, otherId: string): { mine: { before: RosterAssignment[]; after: RosterAssignment[] }; theirs: { before: RosterAssignment[]; after: RosterAssignment[] } }` (the seven days from the Monday of `give`)
  - `approvalWords(reason: SwapNeedsManagerReason | null): string` (null: "Goes through straight away once they accept."; otherwise "Needs your manager's approval because " + the existing `reasonWords` text)
- Words: lower_grade "Lower grade than this shift needs", no_grade "No grade on the roster", already_working "Already working then", rest_rule "Would break the team's rest rule".

- [ ] **Step 1: Write the failing tests** — `can` matches `swapCandidates` order; a lower-grade colleague and a colleague with `grade: null` both appear in `cannot` with the right reason (Review Focus 3); `takeBack` excludes the colleague's shifts that would clash with the reader; `swapPreview` swaps the two shifts in `after`; `approvalWords("within_7_days")` contains "it's within 7 days".
- [ ] **Step 2: Run** `npx vitest run tests/roster-swap-options.test.ts` — expect FAIL.
- [ ] **Step 3: Implement.** Move `reasonWords` from `roster-swap-sheet.tsx` into this module and export it.
- [ ] **Step 4: Run** — expect PASS.
- [ ] **Step 5: Commit** `feat(roster): swap options with plain reasons and a before-and-after preview`.

### Task 4: Swap progress

**Files:**

- Create: `src/lib/roster/team/swap-progress.ts`
- Test: `tests/roster-swap-progress.test.ts`

**Interfaces:**

- Consumes: `RosterSwap` or `RosterManageSwap`, the reader's id, `now`.
- Produces:
  - `type SwapStep = { label: "Requested" | "Accepted" | "Manager approved" | "Done"; state: "done" | "current" | "todo" }`
  - `swapProgress(swap: RosterSwap | RosterManageSwap, meId: string, now: Date): { steps: SwapStep[]; waitingOn: string | null; ended: null | "Declined" | "Cancelled" | "Expired" | "Undone"; tab: "needs_you" | "sent" | "history" }`
  - "Manager approved" appears only when `needsManagerBecause` is not null. `waitingOn` is "You", the colleague's name, or "Your manager".

- [ ] **Step 1: Write the failing tests** — requested and I am the counterparty gives `tab: "needs_you"`, `waitingOn: "You"`; requested with `expiresAt` in the past gives `ended: "Expired"` and `tab: "history"` (Review Focus 4); accepted with `needsManagerBecause: "within_7_days"` shows four steps with Manager approved current; approved auto shows three steps all done.
- [ ] **Step 2: Run** `npx vitest run tests/roster-swap-progress.test.ts` — expect FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — expect PASS.
- [ ] **Step 5: Commit** `feat(roster): swap progress steps and who it is waiting on`.

### Task 5: Team calendar shell, filters and Day view

**Files:**

- Create: `src/components/roster/team/calendar/team-calendar.tsx`, `calendar-filters.tsx`, `day-view.tsx`, `shift-sheet.tsx`
- Modify: `src/components/roster/team/roster-team-page.tsx` (render `TeamCalendar` in place of `TeamDay`; move `TeamDay` body into `day-view.tsx`)
- Test: `tests/roster-team-calendar.dom.test.tsx`

**Interfaces:**

- Consumes: Task 1 (`readCalendarState`, `calendarStateQuery`, `calendarWindow`, `stepCalendar`, `filterAssignments`), `useRosterRead`, `useRosterTeams`.
- Produces:
  - `TeamCalendar({ team, actorId, now }: { team: RosterTeam; actorId: string | null; now: Date })` — reads URL via `useSearchParams`, writes with `router.replace` (no history spam), one `assignments` read for `calendarWindow(state)`.
  - `ShiftSheet({ shift, team, actorId, onClose, onSwap, onGiveAway }: …)` — shift detail; Swap and Give away only when `shift.userId === actorId` and the shift has not started.

- [ ] **Step 1: Write the failing tests** — default renders the Week view with the segmented control "Month / Week / Day"; choosing Day calls `router.replace` with `?view=day`; the Day view date picker jumps to a chosen date; the filter "Just me" hides other people; a failed read shows Try again, not an empty calendar; tapping my own future shift opens the sheet with Swap and Give away; nothing written to `localStorage` or `sessionStorage`.
- [ ] **Step 2: Run** `npx vitest run tests/roster-team-calendar.dom.test.tsx tests/roster-team.dom.test.tsx` — expect FAIL on the new file.
- [ ] **Step 3: Implement.** Keep `RosterSampleNotice` and `RosterAskBox` on the page.
- [ ] **Step 4: Run** both files — expect PASS (update `tests/roster-team.dom.test.tsx` only where the page structure moved, keeping every behaviour it asserts).
- [ ] **Step 5: Commit** `feat(roster): team calendar shell with URL state, filters and a date-pickable day view`.

### Task 6: Month view and day sheet

**Files:**

- Create: `src/components/roster/team/calendar/month-view.tsx`, `day-sheet.tsx`
- Test: add cases to `tests/roster-team-calendar.dom.test.tsx`

**Interfaces:**

- Consumes: `monthCells` (Task 1), `ShiftSheet` (Task 5).
- Produces: `MonthView({ cells, onPickDay }: { cells: MonthCell[][]; onPickDay: (date: string) => void })`, `DaySheet({ date, rows, actorId, onPickShift, onClose })` grouped with `groupByGrade`.

- [ ] **Step 1: Write the failing tests** — a day with four shifts shows three letters and "+1"; my shift's cell has `data-mine="true"`; a public holiday cell carries the text "Public holiday" for screen readers; tapping a day opens the sheet listing names by grade.
- [ ] **Step 2: Run** — expect FAIL.
- [ ] **Step 3: Implement.** Phone: letters. `lg:` shows names (CSS only, same markup). Grid is a `role="grid"` with row and column headers from `WEEKDAY_SHORT_LABELS`.
- [ ] **Step 4: Run** — expect PASS.
- [ ] **Step 5: Commit** `feat(roster): team month view with a day sheet`.

### Task 7: Week board and Compare

**Files:**

- Create: `src/components/roster/team/calendar/week-board.tsx`
- Test: add cases to `tests/roster-team-calendar.dom.test.tsx`

**Interfaces:**

- Consumes: `weekBoard` (Task 1), `ShiftSheet`.
- Produces: `WeekBoard({ rows, days, onPickShift, cover?, flags? }: { rows: BoardRow[]; days: string[]; onPickShift: (row: RosterAssignment) => void; cover?: Map<string, CoverCount[]>; flags?: Map<string, RuleFlag[]> })`

- [ ] **Step 1: Write the failing tests** — my row is first; the names column is sticky (`sticky left-0` class present); Compare shows exactly two rows; a pending swap of mine renders its cell with `data-pending-swap="true"`; an open shift row appears in amber with "Open shift".
- [ ] **Step 2: Run** — expect FAIL.
- [ ] **Step 3: Implement.** Horizontal scroll container with `overflow-x-auto`; cells `min-h-12`.
- [ ] **Step 4: Run** — expect PASS.
- [ ] **Step 5: Commit** `feat(roster): team week board with compare`.

### Task 8: Manager layer on the calendar

**Files:**

- Create: `src/components/roster/team/calendar/needs-you-strip.tsx`, `use-manager-calendar.ts`
- Modify: `team-calendar.tsx`, `week-board.tsx`, `month-view.tsx`, `shift-sheet.tsx`; `src/lib/roster/team/demo-team.ts` (demo `maker.needs` for day, evening and night on weekdays, and one `manage` swap awaiting approval with `needsManagerBecause: "within_7_days"`)
- Test: `tests/roster-team-calendar-manager.dom.test.tsx`

**Interfaces:**

- Consumes: Task 2 (`coverForDay`, `ruleFlags`), `useRosterRead(serviceId, "manage" | "maker")`, `postRosterAction`.
- Produces: `useManagerCalendar(team: RosterTeam, window: { from: string; to: string }, rows: RosterAssignment[]): { enabled: boolean; cover: Map<string, CoverCount[]>; flags: Map<string, RuleFlag[]>; pending: RosterManageSwap[]; claimed: RosterManageOpenShift[]; shortDays: string[] }` — `enabled` is false when `team.role !== "manager"` or when the `manage` or `maker` read fails.
- `approveAllWithoutWarnings(pending, flags, post): Promise<{ approved: number; refused: { id: string; message: string }[] }>` exported from `needs-you-strip.tsx`, sending `swap.approve` one at a time.

- [ ] **Step 1: Write the failing tests** — a member sees no strip and no counts; a manager sees "Nights 1 of 2" on a short day in red (`data-cover="short"`); the strip lists the pending swap with Approve and Decline; "Approve all without warnings" skips a swap whose shifts carry a rule flag and reports a server refusal; a failing `maker` read hides counts and leaves the staff calendar working (Review Focus 2).
- [ ] **Step 2: Run** — expect FAIL.
- [ ] **Step 3: Implement.** Cover text: `${SHIFT_KIND_LABEL[kind]}s ${rostered} of ${needed}`.
- [ ] **Step 4: Run** — expect PASS, and `npx vitest run tests/roster-team-api.test.ts tests/roster-team.dom.test.tsx` still passes.
- [ ] **Step 5: Commit** `feat(roster): manager cover counts, rule flags and a Needs you strip on the calendar`.

### Task 9: Calendar-first swap flow with delayed send

**Files:**

- Create: `src/components/roster/swaps/swap-flow-sheet.tsx`, `src/components/roster/swaps/use-delayed-roster-action.ts`
- Modify: `src/components/roster/use-roster-team.ts` (`postRosterAction(serviceId, action, options?: { keepalive?: boolean })`), `team-calendar.tsx` (open the flow from `ShiftSheet`)
- Delete after migration: `src/components/roster/requests/roster-swap-sheet.tsx` (its accept, decline and undo handling moves into the flow; keep its tests' behaviours in the new test)
- Test: `tests/roster-swap-flow.dom.test.tsx`

**Interfaces:**

- Consumes: Task 3 (`swapOptions`, `swapPreview`, `approvalWords`), `fetchRosterRead` for fresh `assignments`, `requests`, `overview`.
- Produces:
  - `useDelayedRosterAction(): { pending: string | null; schedule: (job: { label: string; serviceId: string; action: RosterAction; onDone: (result: RosterCommandResult) => void; onFailed: (message: string) => void }) => void; undo: () => void }` — same contract as Teaching's `useDelayedPost`: one job at a time, `UNDO_MS` 10_000, `pagehide` cancels, account change cancels.
  - `SwapFlowSheet({ open, onClose, serviceId, actorId, give, mode, onSent }: { …; give: RosterAssignment; mode: "swap" | "give_away"; onSent: (label: string) => void })` — steps: Who, Take back, Check, Send. Give away sends `open.post` with `assignmentId`.
  - `SwapAnswerCard({ swap, serviceId, actorId, onDone })` — what they give, what they get, preview, Accept and Decline.

- [ ] **Step 1: Write the failing tests** — "Can't swap" lists a lower-grade colleague with "Lower grade than this shift needs"; choosing a colleague shows only their compatible shifts plus "Nothing, just take my shift"; Check shows `approvalWords`; Send shows "Sending in 10 seconds" with Undo; Undo within 10 s sends nothing (fake timers); after 10 s `postRosterAction` is called with `{ keepalive: true }`; `pagehide` during the hold sends nothing (Review Focus 5); a server refusal shows its message and re-reads.
- [ ] **Step 2: Run** `npx vitest run tests/roster-swap-flow.dom.test.tsx` — expect FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** it plus `npx vitest run tests/roster-requests.dom.test.tsx` — expect PASS.
- [ ] **Step 5: Commit** `feat(roster): calendar-first swap flow with a 10 second undo`.

### Task 10: Swaps page and Roster navigation

**Files:**

- Create: `src/app/(search-app)/roster/swaps/page.tsx`, `src/components/roster/swaps/roster-swaps-page.tsx`, `src/components/roster/swaps/swap-progress-line.tsx`
- Modify: `src/lib/mode-secondary-navigation.ts` (add `{ id: "swaps", label: "Swaps", href: "/roster/swaps" }` after Team; add `/roster/swaps` to the Roster sub-page list and the active-id mapping), `src/components/mode-nav/mode-nav-icons.ts` (`swaps: ArrowLeftRight`, and Requests becomes `CalendarX2`), `src/components/roster/requests/roster-requests-page.tsx` (remove swap and open-shift sections, add a "Swaps and open shifts" row linking to `/roster/swaps`), `tests/roster-mode-registration.test.ts` (six pages: Today, Shifts, Team, Swaps, Requests, Settings)
- Test: `tests/roster-swaps-page.dom.test.tsx`

**Interfaces:**

- Consumes: Task 4 (`swapProgress`), Task 9 (`SwapAnswerCard`, `SwapFlowSheet`), `useRosterRead(serviceId, "requests" | "manage")`.
- Produces: `RosterSwapsPage()`; `SwapProgressLine({ steps, waitingOn, ended })`.

- [ ] **Step 1: Write the failing tests** — tabs Needs you, Sent, Open shifts, History for a member, plus All team swaps for a manager; a swap waiting on me appears in Needs you with Accept; an expired swap appears in History as "Expired"; the progress line has `role="list"` with the current step marked `aria-current="step"`; Requests no longer shows swaps and links to Swaps.
- [ ] **Step 2: Run** `npx vitest run tests/roster-swaps-page.dom.test.tsx tests/roster-mode-registration.test.ts` — expect FAIL.
- [ ] **Step 3: Implement,** then `npm run sitemap:update`.
- [ ] **Step 4: Run** both files and `npx vitest run tests/roster-requests.dom.test.tsx tests/production-dynamic-route-reachability.test.ts` — expect PASS.
- [ ] **Step 5: Commit** `feat(roster): Swaps page with progress lines, and Requests keeps dates and leave`.

### Task 11: Manage page on a laptop, and print

**Files:**

- Modify: `src/components/roster/manage/roster-manage-page.tsx` (two columns at `lg`: `TeamCalendar` on the left, the existing tab content on the right), `src/app/globals.css` (a `@media print` block scoped to `[data-roster-print]` that hides chrome and fits the month grid to one A4 landscape page)
- Create: `src/components/roster/team/calendar/print-button.tsx` (`window.print()`, shown in Month view only)
- Test: `tests/roster-manage.dom.test.tsx` (add cases)

- [ ] **Step 1: Write the failing tests** — Manage renders the calendar region (`data-testid="roster-manage-calendar"`) alongside the tabs; Month view shows a Print button that calls `window.print`.
- [ ] **Step 2: Run** `npx vitest run tests/roster-manage.dom.test.tsx` — expect FAIL.
- [ ] **Step 3: Implement.** Layout classes only; no change to tab logic.
- [ ] **Step 4: Run** — expect PASS.
- [ ] **Step 5: Commit** `feat(roster): laptop two-column Manage and a printable month`.

### Task 12: Verification and browser proof

- [ ] **Step 1:** `npx vitest run tests/roster-* tests/on-call-*` — expect all pass, including `tests/roster-team-device-storage.dom.test.tsx`.
- [ ] **Step 2:** `npx tsc --noEmit -p tsconfig.json` and `npx eslint src/components/roster src/lib/roster tests/roster-*` — expect exit 0.
- [ ] **Step 3:** `npm run format` and commit any formatting.
- [ ] **Step 4:** `npm run ensure`, then screenshots at iPhone 13 and 1440 px of `/roster/team?view=month`, `?view=week`, `?view=day`, the swap flow and `/roster/swaps`, in demo mode. Check no page errors and no horizontal page scroll.
- [ ] **Step 5:** `npm run plan:browser` and run what it selects with `-- --run`; report it as focused browser proof at its level, full suite left to CI.
- [ ] **Step 6:** Commit and hand off for PR.
