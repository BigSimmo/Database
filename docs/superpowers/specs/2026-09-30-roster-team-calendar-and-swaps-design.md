# Roster: team calendar and calendar-first swaps — design

Date: 2026-09-30. Status: approved in conversation with the owner (parts 1 to 3), awaiting spec review.

## Why

Doctors cannot easily see the team's roster beyond one day at a time, and swapping a shift is a
multi-step form on the Requests page that does not show what changes or where a swap is up to.
The roster manager has no single place to see gaps, pending approvals and rule problems.

Success means:

- A doctor on a phone can see the whole team's month, week or day, find who is on, and start a swap
  from the shift itself in a few taps.
- Both doctors in a swap see exactly what each gives and gets before anything is sent, and can see
  where the swap is up to afterwards.
- The manager, on a laptop, sees cover against target, pending approvals and rule warnings on the
  same calendar, and can act on them without leaving it.

## Owner decisions (from the brainstorm)

- Design phone-first for staff, with a manager layer that is laptop-friendly. Both are in scope.
- Pending swaps are visible only to the two doctors involved and the team's manager. Approved
  changes simply update the roster for everyone.
- First build is the calendar plus the new swap flow. No database changes.
- Deferred: swap-wanted posts, a fairness summary, and a team-wide "swapped" tag on other people's
  shifts. Each needs new database tables and gets its own spec.

## Constraints

- No database change, no new server read. Everything is built from the existing team reads:
  `overview`, `assignments` (at most 62 days, so one month grid fits), `requests`, `manage`,
  `people` and `maker` (the last three manager-only), plus existing team actions.
- Nothing about a roster is stored on the device (the existing Roster rule, pinned by
  `tests/roster-team-device-storage.dom.test.tsx`). The chosen view, date and filter live in the
  page address (`/roster/team?view=month&date=2026-10-01&show=registrar`), so links and bookmarks
  reopen the same view.
- The server remains the authority. Every rule shown in the browser is advisory; the existing SQL
  checks run again when an action is sent, and a refusal is shown in plain words.
- Everything works in the example mode (release held) with the invented team, and in offline demo
  mode, so it can be tried before real staff are switched on.
- Existing design tokens, mode-kit parts, 48 px tap targets, reduced-motion and forced-colours
  support. No calendar library.

## Part 1: the team calendar (Team page)

### For everyone

- **View switch:** Month, Week, Day at the top of `/roster/team`. Default is Week.
- **Month:** a Monday-first grid from `monthGridRange`. Phone: each day shows up to three coloured
  shift letters (D, E, N and the others from `SHIFT_KIND_LABEL`), then "+n". Laptop (`lg` and up):
  names inside each day, grouped by shift. The reader's own shift is outlined. Tapping a day opens
  a day sheet: everyone on that day grouped by grade, with the reader's own shifts carrying Swap and
  Give away.
- **Week board:** people down the left, seven days across, one coloured cell per shift with its
  code. The reader's row is pinned first. On a phone the grid scrolls sideways with the names
  column fixed. Tapping a cell opens the same shift sheet.
- **Day:** the existing day view, plus a date picker. The seven-day backward limit is lifted to the
  reads' 62-day window.
- **Filters (shared):** Everyone, Just me, one grade, one person, and Compare with (the reader's
  row plus one colleague's).
- **Overlays:** WA public holidays (existing `WA_PUBLIC_HOLIDAYS`), the reader's own leave, open
  shifts needing cover (amber), and the reader's own pending swaps (dashed outline).
- **Navigation:** previous and next by month, week or day, and Today.

### For the team's manager (role from the team list)

- **Cover counts:** each day in Month and Week shows rostered against target per shift kind from
  `maker.needs` (weekday or dated needs). Short is red, over is blue, met is plain. No target means
  no count.
- **Needs you strip:** swaps awaiting approval and claimed open shifts from `manage`, plus days below
  target. Each item has Approve and Decline in place.
- **Cell management:** a manager's shift sheet also shows swap requests touching that shift and
  offers Approve, Decline and Post as open shift.
- **Rule warnings:** a small flag on a shift that breaks the team's rules (`minBreakHours`,
  `maxNightsInRow`, `maxDaysInRow`, `maxHours7d`, `maxHours14d`), with the reason on tap.
- **Manage page on a laptop:** the existing tabs (Approve, Cover, Publish, People, Settings) in a
  two-column layout at `lg`, calendar left and selected item right. Phones keep one column.
- **Print:** a print stylesheet so the month view prints as a one-page roster. The existing export
  stays.

## Part 2: the swap flow

Opened from any of the reader's own shifts in any view (and from the Swaps page).

1. **Choose:** Swap or Give away.
2. **Who:** colleagues split into "Can swap" (same grade first, then longest rest before) and
   "Can't swap" with one plain reason each: lower grade, already working then, breaks the rest rule,
   or would break another team rule. Built on `swapCandidates` and `placementProblem`, extended so
   exclusions keep their reason instead of being dropped silently.
3. **What you take back:** only the colleague's shifts that suit both people, or "Nothing, just
   take my shift".
4. **Check:** before-and-after of both people's week, and a plain line saying whether it goes
   through by itself or waits for the manager and why (`swapNeedsManager`).
5. **Send:** the request is held for 10 seconds with Undo, then sent (the delayed-send pattern
   Teaching already uses, sent with `keepalive` if the page closes).

- The colleague asked sees a card with what they give and what they get, the same preview, and
  Accept or Decline.
- Give away posts an open shift (`open.post`) for anyone eligible to claim.
- The manager sees swaps needing approval in the Needs you strip and in Manage, with both doctors,
  both shifts, the reason and any rule warnings. "Approve all without warnings" approves each such
  swap in turn with `swap.approve` and reports any the server refuses.

## Part 3: the Swaps page

- New route `/roster/swaps`, added to the Roster pages sheet. The swap and open-shift sections move
  here from Requests. Requests keeps unavailable dates and leave, and links to Swaps.
- Tabs: Needs you, Sent, Open shifts, History. Managers also get All team swaps (from `manage`).
- Each swap shows a progress line: Requested, Accepted, Manager approved (only when needed), Done.
  It names who it is waiting on and when it expires. A request whose `expiresAt` has passed shows as
  Expired. Declined and cancelled show their reason.

## Units

Pure logic (no React), each with its own tests:

- `src/lib/roster/team/calendar-model.ts` — month cells, week board rows, day groups, filters and
  overlays from assignments.
- `src/lib/roster/team/cover.ts` — rostered against target per day and kind from `maker.needs`.
- `src/lib/roster/team/rule-flags.ts` — per-shift rule breaches from team rules.
- `src/lib/roster/team/swap-options.ts` — can and can't swap with reasons, take-back options and
  the before-and-after, on top of `eligibility.ts`.
- `src/lib/roster/team/swap-progress.ts` — steps, waiting-on and expiry wording from a swap.

Components under `src/components/roster/`:

- `team/calendar/`: team calendar shell (view switch, URL state, navigation), month view, week board,
  day view, filters, day and shift sheets, manager Needs you strip.
- `swaps/`: Swaps page, swap flow sheet (replacing `requests/roster-swap-sheet.tsx`), swap card,
  progress line.
- Manage page: responsive two-column layout.

## Error handling

- A failed read shows an error with Try again, never an empty calendar (existing Roster rule).
- A refused action shows the server's plain message and re-reads the affected data.
- Manager-only reads failing leave the staff view working and hide the manager layer with a note.
- In example mode every action returns the example receipt; the example notice stays visible.

## Testing

- Unit tests for every pure unit above, including edge cases: overnight shifts across month ends,
  Perth time boundaries, empty teams, no targets, conflicting rules.
- DOM tests for each view, filters, the swap flow steps (including Undo within 10 seconds and the
  can't-swap reasons), the Swaps tabs and the manager strip.
- The device-storage test must still pass: nothing written to the device.
- A phone-width and laptop-width browser check of Month, Week, Day, the swap flow and the Swaps page,
  using the browser-gate planner to pick the specs.
- Route wiring gates for the new `/roster/swaps` route (site map, reachability, mode registration).

## Out of scope

Swap-wanted posts, fairness summary, team-wide swapped tags, three-way swaps, any database change,
and any change to the swap rules the server enforces.
