# Roster Release 1 (Roster for one doctor) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A new Roster mode where one doctor keeps their own shifts (imported from PDF, Excel, CSV, calendar file or calendar link, or added by hand) and sees Today, Shifts (week, month, hours) and Settings. My shifts moves here from On call.

**Architecture:** Roster is one more app mode. Own shifts keep living in `on_call_shifts` (widened by Plan A), with code moved from `src/lib/on-call/shifts/` to `src/lib/roster/shifts/`. Excel and PDF files are read on the server into one grid shape, then everything else runs on the phone. Screens reuse existing primitives and `src/components/mode-kit/`; nothing new is stored on the device.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 6, Zod 4, Tailwind 4 tokens, exceljs (server), pdfjs-dist 6 legacy build (server), Vitest, Playwright.

**Spec:** `/mnt/project-files/roster-mode/plan-v8.html` (approved 18:44Z), card answers in `/mnt/project-files/roster-mode/answers.txt`, design standard `/mnt/project-files/design/mode-design-standard.md` v13.2, DB contract `/mnt/project-files/roster-mode/shared-db-contract.md` v6.

**Efficiency (Josh, 19:06Z and 19:20Z):** the logic that is hardest to get right is already written and tested: `build-plan/code/` holds 8 source files and 3 test files (34 tests, type-checked and linted against `origin/main` 67d961107 with the Task 1 move applied). Tasks copy them instead of re-deriving them. Four lanes run in parallel with no shared files; each lane gets one review, then one whole-branch review. Only fast local checks run (focused tests, lint, typecheck, format); CI runs the rest. One PR, pushed once at the end. Cut: a separate Hours page (it sits inside Shifts), a client-side Excel/PDF reader (server only, so no new client bundle), a new calendar grid (reuses `CalendarView`), a new reminder system (one more reminder type).

## Global Constraints

- The repo is PUBLIC. Test data is invented: "Example Hospital", made-up names. No patient data anywhere.
- Nothing about shifts is stored on the device (no localStorage, IndexedDB or service-worker cache of shift data). Josh's offline rule.
- No AI and no OpenAI client anywhere in Roster code. Roster files never go to a provider.
- Uploaded files are read in memory and thrown away: never written to Storage, disk or logs. Only the file name is stored (on the import row).
- A calendar link is never logged and never appears in an error.
- Colour: Roster violet `#634f8f` light, `#b0a0d8` dark, solid only on the mode pill and current tab; elsewhere `-soft`/`-border` tokens, about 10% of the screen at most. Tokens only, no hex in components.
- Type: numbers and headings weight 400, never bold. Body >= 13px, labels >= 11px, at most 4 sizes per screen. 24-hour time. Tap targets `min-h-12` (48px).
- Green `--success` = 6px dot + word, one 600ms pulse only on change to fresh, Today only. Amber = `--warning`. Red only for an emergency number (Roster has none).
- Mode name "Roster". Pages in the pill sheet: Today, Shifts, Settings (Team and Requests arrive in Release 2).
- Old URLs keep working: `/on-call/shifts` and `/on-call/calendar` redirect to `/roster/shifts` and `/roster/calendar`; old APIs re-export the new ones.
- Release 1 must merge after Plan A (it calls `roster_own_shifts_replace` and reads `kind`, `workplace`, `source`). Until then the branch carries only Plan A's `database.types.ts` commit (Task 0), never its migrations.
- Roster's remembered settings (which row is you, what codes mean, calendar switch) live on the server in `user_preferences.preferences.roster`, read and written only through `/api/roster/settings`. They never enter `AppPreferences`, because `useAppPreferences` copies that whole object into localStorage.
- Stage by path. Shared files have one owning lane (table below); another lane that needs a change there asks the owner.

## Review Focus

1. **A roster that spans New Year** (Dec to Jan columns, or a January roster imported in December) must land in the right year. Pinned by `parseHeaderDates` tests (copied in Task 2).
2. **Importing a second workplace's roster must not delete the first workplace's shifts or any hand-added shift.** Pinned in Task 1 (repository passes `p_workplace`, diff reads only `source='import'` rows of that workplace) and Plan A behaviour check 1.
3. **A night that crosses midnight** counts on the day it starts for hours, letters and "next nights", and shows "+1". Pinned by grid and hours tests (Task 2) and the Shifts render test (Task 4).
4. **A calendar link pointing at a private address, plain http, or a redirect to one** is refused, and the token in the link never shows in an error. Pinned by `roster-calendar-link.test.ts` (Task 3).
5. **Delete all my data, then Undo within 30 seconds** leaves everything as it was, past shifts and calendar links included, and nothing is deleted until the 30 seconds end or the page closes. Pinned in Task 4 (Settings) with a DOM test.

---

## Lanes and order

| Task | Lane | Runs | Owns these files only |
|---|---|---|---|
| 0 | Base | First | Branch set-up; one cherry-picked types commit |
| 1 | Groundwork | After 0, alone | `src/lib/roster/shifts/**`, `src/lib/roster/shift-kind.ts`, `src/app/api/roster/shifts/**`, old `src/app/api/on-call/shifts/**` (re-exports), `src/lib/api-rate-limit.ts` (the `roster` bucket and its limit), `tests/roster-shifts.test.ts` |
| 2 | Registration | After 1, parallel | The mode registries, `globals.css` identity block, `src/app/(search-app)/roster/layout.tsx` and `loading.tsx`, deleting `src/app/(search-app)/on-call/shifts/page.tsx`, moving `on-call/calendar/page.tsx`, `src/proxy.ts`, organisation JSON, sitemap, `tests/design-system-adoption.test.ts`, the mode-count tests |
| 3 | Readers and links | After 1, parallel | `src/lib/roster/import/**`, `src/lib/roster/calendar-link*.ts`, `src/lib/roster/shifts/parse-ics.ts` (window filter only), `src/app/api/roster/read-file/**`, `src/app/api/roster/links/**` |
| 4 | Screens | After 1, parallel | `src/components/roster/**`, the Roster page files `src/app/(search-app)/roster/{page,shifts/page,settings/page}.tsx`, their DOM tests |
| 5 | Numbers, settings, reminders | After 1, parallel | `src/lib/roster/hours.ts`, `today.ts`, `settings.ts`, `src/app/api/roster/settings/**`, `src/app/api/roster/extra-time/**`, `src/lib/reminders/**`, the reminders settings component, `src/lib/calendar/feed-repository.ts`, `src/app/api/account/preferences/route.ts` |
| 6 | Wire-up and ship | Last, alone | `src/components/my-work/**`, `src/components/on-call/on-call-next-shift.tsx`, `scripts/lib/tenancy-scan.mjs`, docs, PR |

Lane 4 imports from lanes 3 and 5 by the exact names in each task's **Produces** block, so it can build against them before they land; it runs its DOM tests after both merge into the branch. `src/components/on-call/on-call-page-menu.tsx` is On Call's file: Roster does not edit it (the redirects keep its My shifts and Calendar items working; On Call points them at `/roster/*` in its own PR).

---

### Task 0: Branch set-up

- [ ] **Step 1:** Branch from the latest `origin/main`. If mode-kit PR #3115 has merged it is already there; if not, `git merge origin/<#3115 head branch>` (the Roster PR then waits for #3115).
- [ ] **Step 2:** Cherry-pick only Plan A's types commit (`src/lib/supabase/database.types.ts`): `git cherry-pick <Plan A Task 5 Step 4 commit>`. If Plan A has already merged, skip this. Never bring Plan A's `supabase/` files onto this branch: a PR that touches `supabase/migrations/` deploys to the live database when merged.
- [ ] **Step 3:** `npx tsc --noEmit -p tsconfig.json` exits 0.

---

### Task 1: Move My shifts into Roster and widen the shift model

**Files:**
- Move: `src/lib/on-call/shifts/*` to `src/lib/roster/shifts/*` (`git mv`, keep every export name)
- Create: `src/lib/roster/shift-kind.ts` (copy from `build-plan/code/src/lib/roster/shift-kind.ts`)
- Modify: `src/lib/roster/shifts/model.ts`, `repository.ts`, `diff.ts`
- Move: `src/app/api/on-call/shifts/route.ts` and `imports/[id]/route.ts` to `src/app/api/roster/shifts/...`; the old paths become one-line re-exports
- Modify: every importer of `@/lib/on-call/shifts` (5 components, 2 routes, 3 tests; `grep -rl "@/lib/on-call/shifts" src tests`)
- Test: `tests/on-call-shifts.test.ts` (rename to `tests/roster-shifts.test.ts`), `tests/on-call-shifts.dom.test.tsx` stays until Task 4 replaces the page

**Interfaces:**
- Produces: `OnCallShiftInput` gains `kind?: ShiftKind | null` (optional in the type and the schema; no per-shift workplace, since the workplace belongs to the import). `OnCallShift` gains `source: "import" | "manual"`, `seriesId: string | null`, `workplace: string | null` (read from the row). `OnCallShiftFormat = "ics" | "csv" | "xlsx" | "pdf" | "link"`. Import request gains `workplace: string | null`, `fileName: string | null` (<= 120). `replaceOwnerShifts(supabase, ownerId, request)` unchanged signature. New `addManualShifts(supabase, ownerId, shifts: OnCallShiftInput[], repeatWeeks: number)` and `deleteManualSeries(supabase, ownerId, seriesId)`. `SHIFT_KINDS`, `ShiftKind`, `SHIFT_LETTER`, `SHIFT_KIND_LABEL`, `isWorkedKind`, `inferShiftKind` from `@/lib/roster/shift-kind`.

- [ ] **Step 1: Move and re-point imports**

```bash
mkdir -p src/lib/roster
git mv src/lib/on-call/shifts src/lib/roster/shifts
grep -rl "@/lib/on-call/shifts" src tests | xargs sed -i 's#@/lib/on-call/shifts#@/lib/roster/shifts#g'
cp /mnt/project-files/roster-mode/build-plan/code/src/lib/roster/shift-kind.ts src/lib/roster/shift-kind.ts
npx tsc --noEmit -p tsconfig.json
```
Expected: exit 0 (proven on 67d961107).

- [ ] **Step 2: Write the failing tests** in `tests/roster-shifts.test.ts` (git mv from `tests/on-call-shifts.test.ts`, keep its mocks):

```ts
it("saves an import for one workplace through roster_own_shifts_replace", async () => {
  // existing replace test set-up, then:
  await POST(jsonRequest({ format: "xlsx", workplace: "Example Hospital", fileName: "oct.xlsx", windowStart: "2026-10-01", windowEnd: "2026-10-31",
    shifts: [{ startsAt: "2026-10-01T00:00:00.000Z", endsAt: "2026-10-01T08:30:00.000Z", title: "Day", location: null, sourceUid: null, kind: "day" }] }));
  expect(mocks.rpc).toHaveBeenCalledWith("roster_own_shifts_replace", expect.objectContaining({ p_format: "xlsx", p_workplace: "Example Hospital", p_file_name: "oct.xlsx" }));
});

it("compares a new import only with imported shifts from the same workplace", async () => {
  // the in-window select must carry .eq("source","import") and the workplace filter
  await POST(jsonRequest({ ...validImport, workplace: "Example Hospital" }));
  expect(selectFilters()).toEqual(expect.arrayContaining([["eq", "source", "import"], ["eq", "workplace", "Example Hospital"]]));
});

it("keeps accepting a shift without a kind (old clients)", () => {
  expect(onCallShiftImportRequestSchema.safeParse({ ...validImportBody, shifts: [{ ...validShift }] }).success).toBe(true);
});
```
`selectFilters()` is a small helper over the existing `mocks.from` chain spy that records `eq`/`is` calls; add it beside the existing chain mock.

- [ ] **Step 3: Run to see them fail**: `npx vitest run tests/roster-shifts.test.ts` - FAIL (rpc name, missing filters, `kind` rejected by `.strict()`).

- [ ] **Step 4: Implement**
  - `model.ts`: add `kind: z.enum(SHIFT_KINDS).nullable().optional()` to `onCallShiftInputSchema`, widen `format`, add `workplace: z.string().trim().min(1).max(80).nullable()` and `fileName` to the request schema, `ON_CALL_SHIFT_FILE_NAME_MAX = 120`. `rowToImport` keeps unknown formats as `"ics"` only for legacy rows; map the five formats.
  - `repository.ts`: `SHIFT_COLUMNS` adds `kind,workplace,source,series_id`; `fetchOwnerShiftsInWindow` adds `.eq("source","import")` and `workplace` (`.is("workplace", null)` when null, else `.eq`); `replaceOwnerShifts` calls `roster_own_shifts_replace` with `p_workplace` and `p_file_name` plus the existing arguments (names as Plan A Task 3 defines). Add `addManualShifts` (insert rows with `source:'manual'`, `series_id` = one `crypto.randomUUID()` when `repeatWeeks > 0`, repeating weekly up to 26 weeks, owner from the session) and `deleteManualSeries`.
  - `diff.ts`: no logic change (it already compares only what it is given).
  - Routes: move to `src/app/api/roster/shifts/`; `src/app/api/on-call/shifts/route.ts` becomes `export { GET, POST, DELETE, runtime } from "@/app/api/roster/shifts/route";` (same for `imports/[id]`). Switch the routes' rate-limit bucket to a new `"roster"` bucket: add it to the bucket union (`src/lib/api-rate-limit.ts:48-64`) and to the limits map below it (about l.103), with the same numbers as `on_call`. `DELETE /api/roster/shifts` deletes everything Roster holds for the owner: all shifts past and future, imports, calendar links and `preferences.roster`. Add `POST /api/roster/shifts/manual` (body `{ shift, repeatWeeks }`, zod-strict) and `DELETE /api/roster/shifts/manual/[seriesId]`, same `authorise` and bucket.

- [ ] **Step 5: Run**: `npx vitest run tests/roster-shifts.test.ts tests/on-call-shifts.dom.test.tsx tests/my-work-home.dom.test.tsx` - PASS; `npx tsc --noEmit -p tsconfig.json` - exit 0.

- [ ] **Step 6: Commit**: `git add src/lib/roster src/app/api/roster src/app/api/on-call/shifts tests/roster-shifts.test.ts src/components tests && git commit -m "feat(roster): move My shifts into Roster and widen the shift model"` (stage by path; never `git add -A`).

---

### Task 2: Register the Roster mode

**Files:** (all Modify unless stated)
- `src/lib/app-modes.ts`, `src/lib/category-identity.ts`, `src/lib/phone-mode-groups.ts`, `src/lib/mode-secondary-navigation.ts`, `src/lib/mode-nav-icons.ts`, `src/lib/ui-copy.ts`, `src/lib/search-command-surface.ts`, `src/lib/universal-search-mode-context.ts`, `src/lib/search-route-ownership.ts`, `src/lib/search-shell-props.ts`, `src/lib/information-pages.ts`, `src/components/clinical-sidebar*` (pins), `src/lib/use-sidebar-pins*`, `src/lib/site-content-registry*`
- `src/app/globals.css`: one `[data-mode="roster"]` identity block beside the others (about l.1053-1165), tokens `--mode-roster`, `-soft`, `-border`, dark values
- Create: `src/app/(search-app)/roster/layout.tsx`, `loading.tsx`; move `on-call/calendar/page.tsx` to `roster/calendar/page.tsx` (`git mv`). The Today, Shifts and Settings page files belong to Task 4.
- Delete: `src/app/(search-app)/on-call/shifts/page.tsx` (the redirect covers the URL); in `tests/design-system-adoption.test.ts` (about l.1470) keep the page-count ratchet right with a dated comment line like the ones above it
- `src/proxy.ts`: permanent redirects `/on-call/shifts` to `/roster/shifts`, `/on-call/calendar` to `/roster/calendar`
- `docs/organisation/systems/personal-practice.json`: add `src/lib/roster/**`, `src/components/roster/**`, `src/app/(search-app)/roster/**`, `src/app/api/roster/**`
- Tests that hardcode the mode count or list: `grep -rln "appModeIds" tests` and check each for a count or list; raise the count by one from whatever main has (other modes are landing too) and add `"roster"`
- Test: `tests/roster-mode-registration.test.ts` (Create)

**Interfaces:**
- Consumes: nothing from lanes 3-5.
- Produces: mode id `"roster"`, label `"Roster"`, routes `/roster`, `/roster/shifts`, `/roster/settings`, `/roster/calendar`.

- [ ] **Step 1: Failing test**

```ts
import { describe, expect, it } from "vitest";
import { appModeIds } from "@/lib/app-modes";
import { modeSecondaryNavigationEntries } from "@/lib/mode-secondary-navigation";

describe("Roster mode registration", () => {
  it("is a mode with three pages in Release 1", () => {
    expect(appModeIds).toContain("roster");
    expect(modeSecondaryNavigationEntries("roster").map((entry) => entry.label)).toEqual(["Today", "Shifts", "Settings"]);
  });
});
```

- [ ] **Step 2: Run, see FAIL.** Step 3: add `roster` to every registry by copying the CPD mode's entry shape (`grep -rn '"cme"' src/lib src/components/clinical-sidebar* | head -40` lists every place), with the violet tokens and a lucide `CalendarRange` icon (with `aria-hidden`). Step 4: move `on-call/calendar/page.tsx` with `git mv`, add the redirects and the organisation globs.

- [ ] **Step 5: Run**: `npx vitest run tests/roster-mode-registration.test.ts` plus every test the 20-to-21 grep found; `npm run check:organisation -- --files src/lib/roster/shift-kind.ts` (expect personal-practice); `npm run sitemap:update`. All PASS.

- [ ] **Step 6: Commit** by path: `git commit -m "feat(roster): register Roster as a mode with Today, Shifts and Settings"`.

---

### Task 3: File readers, the read endpoint and calendar links

**Files:**
- Create (copy from `build-plan/code/`): `src/lib/roster/import/grid.ts`, `table.ts`, `read-xlsx.ts`, `read-pdf.ts`, `src/lib/roster/calendar-link-fetch.ts`, `tests/helpers/roster-fixtures.ts`, `tests/roster-import.test.ts`, `tests/roster-calendar-link.test.ts`
- Create: `src/app/api/roster/read-file/route.ts`, `src/app/api/roster/links/route.ts`, `src/lib/roster/calendar-links.ts` (repository for `roster_calendar_links`)
- Modify: `src/lib/roster/shifts/parse-ics.ts`: `parseRosterIcs(text, window?: { from: string; to: string })` drops events outside the window before the 400 cap (a long feed lists years of history first)
- Test: `tests/roster-read-file-route.test.ts`, `tests/roster-links-route.test.ts` (Create)

**Interfaces:**
- Produces: `RosterGrid`, `CodeMap`, `CodeMeaning`, `RosterShiftDraft`, `gridRowToShifts(grid, rowIndex, codes)`, `findRememberedRow(grid, name)`, `parseHeaderDates(headers, today)`, `normaliseCode(cell)` from `@/lib/roster/import/grid`; `tableToGrid`, `RosterReadError` (`reason: "no_dates" | "no_names" | "scanned" | "too_big" | "unreadable"`) from `table`. `POST /api/roster/read-file` (multipart, one file <= 2 MB, `.xlsx` or `.pdf` by signature) returns `{ grid: RosterGrid }` or `{ error: { code: RosterReadError["reason"] } }` with 422. `GET/POST/DELETE /api/roster/links` (list, add `{ url, workplace }`, remove `{ id }`) and `POST /api/roster/links/refresh` (`{ id }` or all older than 6 h) which fetches with `fetchCalendarLink`, parses with `parseRosterIcs(text, { from: today - 14 days, to: today + 12 months })`, and saves with `replaceOwnerShifts` (`format: "link"`, the link's workplace).

- [ ] **Step 1: Copy the tested files and run them**

```bash
C=/mnt/project-files/roster-mode/build-plan/code
mkdir -p src/lib/roster/import tests/helpers
cp $C/src/lib/roster/import/*.ts src/lib/roster/import/
cp $C/src/lib/roster/calendar-link-fetch.ts src/lib/roster/
cp $C/tests/helpers/roster-fixtures.ts tests/helpers/
cp $C/tests/roster-import.test.ts $C/tests/roster-calendar-link.test.ts tests/
npx vitest run tests/roster-import.test.ts tests/roster-calendar-link.test.ts
```
Expected: 23 passed.

- [ ] **Step 2: Failing route tests** (mock `server-only`, `@/lib/supabase/admin`, `@/lib/supabase/auth` and the rate limiter exactly as `tests/roster-shifts.test.ts` does):

```ts
it("reads an Excel roster and returns only the grid", async () => {
  const form = new FormData();
  form.set("file", new File([await sampleRosterXlsx()], "oct.xlsx"));
  const response = await POST(new Request("http://x/api/roster/read-file", { method: "POST", body: form }));
  expect(response.status).toBe(200);
  expect((await response.json()).grid.rows[0].name).toBe("Dr Alex Example");
});
it("says a scanned PDF can't be read", async () => {
  const form = new FormData();
  form.set("file", new File([sampleRosterPdf({ scanned: true })], "scan.pdf"));
  const response = await POST(new Request("http://x", { method: "POST", body: form }));
  expect(response.status).toBe(422);
  expect((await response.json()).error.code).toBe("scanned");
});
it("refuses a file over 2 MB before reading it", async () => {
  const form = new FormData();
  form.set("file", new File([new Uint8Array(2 * 1024 * 1024 + 1)], "big.xlsx"));
  expect((await POST(new Request("http://x", { method: "POST", body: form }))).status).toBe(413);
});
it("never logs or stores the file", async () => {
  const log = vi.spyOn(console, "error");
  // run the scanned case again
  expect(log).not.toHaveBeenCalled();
  expect(mocks.storage).not.toHaveBeenCalled(); // storage.from spy on the admin client mock
});
```
and for links: a feed with 500 past events then 3 future ones keeps the 3 future ones; adding `http://` or a private address returns 400 with the reason code; a link over 2000 characters returns 400 before any insert; a fourth link returns 409 (`roster_calendar_links` cap is 3); refresh saves through `replaceOwnerShifts` with `format: "link"`; the response and any error body never contain the URL's query string.

- [ ] **Step 3: Run, see FAIL.** Step 4: implement. `read-file` rejects a `Content-Length` over 2 MB + 64 KB before reading the body (413), then uses `request.formData()`, checks the file size (413), then the signature (`PK\x03\x04` or `%PDF-`, else 415), passes `perthDateOf(new Date())` as today, maps `RosterReadError` to 422. Both routes: `runtime = "nodejs"`, `authorise` with bucket `"roster"`, demo mode refuses writes like the shifts route. `calendar-links.ts` filters every query by `owner_id` and returns links without their full URL to the client (host plus "..." only); the full URL is read server-side at refresh. A failed refresh stores the table's own reason codes: `private_address` to `blocked_address`, `too_big` to `too_large`, `timeout` and `http_error` to `unreachable`, `not_calendar` stays, over 400 shifts is `too_many_shifts` (`not_https` never reaches storage: it is refused when the link is added).

- [ ] **Step 5: Run** the four test files - PASS. `npx tsc --noEmit -p tsconfig.json` - exit 0.

- [ ] **Step 6: Commit** by path: `git commit -m "feat(roster): read Excel and PDF rosters on the server and refresh calendar links"`.

---

### Task 4: Roster screens

**Files:**
- Create: `src/app/(search-app)/roster/page.tsx` (Today), `shifts/page.tsx`, `settings/page.tsx`, each rendering the component below
- Create in `src/components/roster/`: `roster-today-page.tsx`, `roster-shifts-page.tsx`, `roster-settings-page.tsx`, `roster-add-sheet.tsx`, `roster-import-flow.tsx`, `roster-hours-panel.tsx`, `roster-week-strip.tsx`, `roster-night-dial.tsx`, `use-roster-shifts.ts` (from `src/components/on-call/use-on-call-shifts.ts`, `git mv`)
- Delete (by `git mv` into the above): `src/components/on-call/on-call-shifts-page.tsx`
- Test: `tests/roster-today.dom.test.tsx`, `tests/roster-shifts.dom.test.tsx`, `tests/roster-import-flow.dom.test.tsx`, `tests/roster-settings.dom.test.tsx` (Create; the last replaces `tests/on-call-shifts.dom.test.tsx` via `git mv`)

**Interfaces:**
- Consumes: Task 1 model and routes, Task 3 `gridRowToShifts` / `findRememberedRow` / `/api/roster/read-file` / links API, Task 5 `summariseToday`, `summariseHours`, `fortnightFor`, `GET/PUT /api/roster/settings` (Task 5), `POST /api/roster/extra-time`.
- Reuses (do not rebuild): `InformationPageShell`; `InPageNavHeader` (DocumentViewer-template in-page header per AGENTS "Default in-page navigation"); `Sheet` with `mobilePlacement="bottom"`; `SegmentedControl`; `ToggleSwitch`; `EmptyState`; `Skeleton`; `InlineNotice`; `useToast`; the `CmeQuickLog` floating "+ Add" button pattern; `CalendarView` (`src/components/calendar/calendar-view.tsx:145`) for Month; `CalendarSubscribe`; mode-kit from PR #3115 (import only from `@/components/mode-kit/*`, never `on-call/kit`): `ModeGroupedList`/`ModeRow`, `ModeFactTile(s)`, `ModeNotice`, `ModeStateLabel` (green dot), `ModeUpdatedLine`, `ModeActionButton`, `ModeModuleSkeleton`, `ModeHeroLink`, `ModeDialRow`/`ModeDialSheet`, type recipes (`modeNumberText`, `modeNameText`, `modeHeadingText`, `modeDisplayNumberText`, `modeSecondaryText`), surface recipes (`modeModuleSurface`, `modeSummarySurface`, `modeDot`, `modeTapArea` and the rest), dates (`formatModeDate`, `formatModeTime`, `modeAgo`), CSS `--surface-summary` tokens. Mode colour comes from the `mode` prop. Until #3115 merges the branch may stack on it, but the PR must not merge before it.

Screen contracts (copy exactly as in plan-v8.html; no explanatory text on screen):

- **Today**: hero with the lead state from `summariseToday` (on now / before / day off leads with the next shift / empty shows "Get your shifts in" with Import a file and Add a shift, and under it "In a hospital team? Your roster manager will invite you."). Between 00:00 and 06:00 during a night, the hero becomes `roster-night-dial` (time left on a 24-hour ring, never a score). Then: next night and next weekend off tiles, This week as seven letter squares (`SHIFT_LETTER`), next leave and next nights tiles. Green "Up to date" dot shows only when a calendar link refreshed within 6 h; one 600ms pulse only on change to fresh (`prefers-reduced-motion` = no pulse).
- **Shifts**: `SegmentedControl` Week / Month / Hours. Week: 24-hour bar chart for 7 days plus an agenda list; a night shows "+1". Month: `CalendarView` with letter cells. Hours: `roster-hours-panel` (14 bars with an extra-time cap, total "rostered, not pay", shortest break, most in any 7 days, most days in a row, extra time with "Stayed late" one tap, "Claim in Admin" link). The floating "+ Add" opens `roster-add-sheet`: Add a shift (can repeat weekly), Import a file, Add a calendar link. ("Dates I can't work" is Release 2.)
- **Import flow** (step screens keep the header and add a close bar): Step 1 pick file (`.pdf,.xlsx,.csv,.ics`; CSV and ICS parse on the phone with the existing parsers; a grid-shaped CSV goes through `tableToGrid`). Step 2 "Which row is you?" (skipped when `findRememberedRow` finds one; the choice is saved through `/api/roster/settings` as `rowName`). Step 3 what changes: only changed shifts, old value struck through, "24 unchanged"; each unknown code has its own Choose button (kind + times, or Day off), saved through `/api/roster/settings` as `codes[workplace]`; Save stays disabled until every code is chosen. Scanned PDF: "Can't read this PDF. Try the Excel version."
- **Settings**: "Shifts on my calendar link" `ToggleSwitch` (off by default; `calendarShifts` in `/api/roster/settings`); "Remind me the evening before" (20:00, disabled with a line pointing at the switch when calendar shifts are off); workplaces list (remove; renaming is Release 2); calendar links (refresh, remove); Delete my data: no "Are you sure?" (the design uses undo instead). The screen hides everything at once and shows Undo for 30 seconds; `DELETE /api/roster/shifts` is sent only when the 30 seconds end, or on `pagehide` with `fetch(..., { keepalive: true })`. Undo cancels the timer, so nothing was ever deleted. The copy says uploaded files are never kept.

- [ ] **Step 1: Failing DOM tests** (render with the existing test providers from `tests/on-call-shifts.dom.test.tsx`; mock `fetch`; fixed clock via `tests/helpers/fixed-clock.ts`):

```tsx
it("leads a day off with the next shift", async () => {
  mockShifts([night("2026-10-15")]);
  render(<RosterTodayPage />, { now: "2026-10-13T02:00:00Z" });
  expect(await screen.findByText(/Thu 15 Oct/)).toBeInTheDocument();
  expect(screen.getByText("21:30")).toBeInTheDocument();
});
it("shows the empty state with both ways in", async () => {
  mockShifts([]);
  render(<RosterTodayPage />);
  expect(await screen.findByRole("button", { name: "Import a file" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Add a shift" })).toBeInTheDocument();
});
it("keeps Save disabled until every unknown code is chosen", async () => {
  mockReadFile(gridWithCodes(["D", "ADO"]));
  await importFile("oct.xlsx");
  await chooseRow("Dr Alex Example");
  expect(screen.getByRole("button", { name: /Save/ })).toBeDisabled();
  await chooseCode("ADO", "Day off");
  expect(screen.getByRole("button", { name: /Save/ })).toBeEnabled();
});
it("shows a night as +1 in the week", async () => {
  mockShifts([night("2026-10-15")]);
  render(<RosterShiftsPage />, { now: "2026-10-13T02:00:00Z" });
  expect(await screen.findByText(/08:00\s*\+1/)).toBeInTheDocument();
});
it("deletes nothing if Undo is pressed within 30 seconds, and everything after", async () => {
  vi.useFakeTimers();
  mockShifts([day("2026-10-12"), manualWeekly("2026-10-14", "series-1")]);
  render(<RosterSettingsPage />);
  await deleteMyData();
  await userEvent.click(screen.getByRole("button", { name: "Undo" }));
  vi.advanceTimersByTime(31_000);
  expect(fetchCalls("/api/roster/shifts", "DELETE")).toHaveLength(0);
  await deleteMyData();
  vi.advanceTimersByTime(31_000);
  expect(fetchCalls("/api/roster/shifts", "DELETE")).toHaveLength(1);
});
it("stores nothing about the doctor's roster on the device", async () => {
  const setItem = vi.spyOn(Storage.prototype, "setItem");
  mockSettings({ rowName: "Dr Alex Example", codes: { "Example Hospital": { ADO: { kind: "off" } } }, calendarShifts: true });
  render(<RosterShiftsPage />);
  await screen.findByRole("tab", { name: "Week" });
  const written = setItem.mock.calls.map(([key, value]) => `${key}=${value}`).join("\n");
  expect(written).not.toMatch(/Alex Example|Example Hospital|ADO|21:30|2026-10/);
});
```
The helpers (`mockShifts`, `night`, `day`, `manualWeekly`, `mockReadFile`, `mockSettings`, `importFile`, `chooseRow`, `chooseCode`, `deleteMyData`, `fetchCalls`) live at the top of each test file; each is under 10 lines over `vi.fn` fetch and `userEvent`.

- [ ] **Step 2: Run, see FAIL.** Step 3: build the components to the contracts above, reusing the listed primitives; `git mv` the old page and hook. Step 4: run the four DOM files plus `tests/design-system-adoption.test.ts` - PASS; `npx eslint src/components/roster` - clean (hex, type-scale, icon-aria rules).

- [ ] **Step 5: Commit** by path: `git commit -m "feat(roster): Today, Shifts, import flow and Settings screens"`.

---

### Task 5: Hours, Today, reminders, calendar feed, preferences and extra time

**Files:**
- Create (copy from `build-plan/code/`): `src/lib/roster/hours.ts`, `src/lib/roster/today.ts`, `tests/roster-hours-today.test.ts`
- Modify: `src/lib/reminders/settings-model.ts` (type `"shifts"`, lead time `"evening-before"`), `src/lib/reminders/settings.ts` (`applyReminderAlarms`), the reminders settings component (`grep -rl REMINDER_LEAD_TIMES src/components`: offer "The evening before (20:00)" only on the Shifts row), `src/lib/calendar/feed-repository.ts:96-115`, `src/app/api/account/preferences/route.ts` (PUT keeps the stored `roster` key; neither GET nor PUT returns it)
- Create: `src/lib/roster/settings.ts` (zod schema, read, optimistic write on `updated_at` like the preferences PUT), `src/app/api/roster/settings/route.ts` (GET, PUT), `src/app/api/roster/extra-time/route.ts`
- Test: `tests/roster-feed-reminders.test.ts`, `tests/roster-extra-time-route.test.ts` (Create)

**Interfaces:**
- Produces: `summariseToday(shifts, now): TodaySummary`, `summariseHours(shifts, extras, window): HoursSummary`, `fortnightFor(today, anchor)`. `RosterSettings = { calendarShifts: boolean; rowName: string | null; codes: Record<string, Record<string, CodeMeaning>> }` (workplace `""` = none; at most 10 workplaces, 60 codes each, code keys <= 12 chars, row name <= 80), stored at `user_preferences.preferences.roster`, served only by `GET/PUT /api/roster/settings`; `fetchRosterSettings(supabase, ownerId)` for the feed. Reminder type `"shifts"` with `calendarAlert` allowing `"evening-before"` only for this type. `POST /api/roster/extra-time` body `{ kind: "stayed_late", startedAt, endedAt }` upserts `extra_time_records` on `(owner_id, kind, started_at)`, writing only `kind, started_at, ended_at`.

- [ ] **Step 1: Copy and run the tested logic**

```bash
C=/mnt/project-files/roster-mode/build-plan/code
cp $C/src/lib/roster/hours.ts $C/src/lib/roster/today.ts src/lib/roster/
cp $C/tests/roster-hours-today.test.ts tests/
npx vitest run tests/roster-hours-today.test.ts
```
Expected: 11 passed.

- [ ] **Step 2: Failing tests**

```ts
it("puts shifts in the calendar feed only when the doctor turned it on", async () => {
  mockOwnerShifts([night("2026-10-15")]);
  mockRosterSettings({ calendarShifts: false });
  expect((await calendarFeedEvents(admin, "owner-1", NOW)).filter((event) => event.title.startsWith("Roster"))).toEqual([]);
  mockRosterSettings({ calendarShifts: true });
  const events = (await calendarFeedEvents(admin, "owner-1", NOW)).filter((event) => event.title.startsWith("Roster"));
  expect(events.map((event) => event.title)).toEqual(["Roster: Night"]);
  expect(JSON.stringify(events)).not.toMatch(/workplace|Example Hospital|location/i);
});
it("sets the shift alarm at 20:00 Perth the evening before", () => {
  const [event] = applyReminderAlarms([shiftEvent("2026-10-15", "21:30")], withShiftReminder("evening-before"), NOW);
  expect(event.alarms?.[0]?.at).toBe(perthWallToIso("2026-10-14", "20:00"));
});
it("refuses evening-before for any other reminder type", async () => {
  const response = await PUT(jsonRequest({ reminders: { types: { teaching: { calendarAlert: "evening-before" } } } }));
  expect(response.status).toBe(400);
});
it("rejects unknown Roster setting keys and oversized code maps", async () => {
  expect((await putRosterSettings({ colour: "red" })).status).toBe(400);
  expect((await putRosterSettings({ codes: { "": manyCodes(61) } })).status).toBe(400);
});
it("keeps Roster settings out of account preferences, which the phone caches", async () => {
  mockStoredPreferences({ density: "compact", roster: { rowName: "Dr Alex Example" } });
  expect(JSON.stringify(await (await getAccountPreferences()).json())).not.toContain("Alex");
  await putAccountPreferences({ density: "spacious" });
  expect(lastWrittenPreferences().roster).toEqual({ rowName: "Dr Alex Example" });
});
it("logs a late finish once, even if Admin logged it too", async () => {
  await POST(jsonRequest({ kind: "stayed_late", startedAt: "2026-10-05T08:30:00.000Z", endedAt: "2026-10-05T09:45:00.000Z" }));
  expect(mocks.upsert).toHaveBeenCalledWith(
    { owner_id: "owner-1", kind: "stayed_late", started_at: "2026-10-05T08:30:00.000Z", ended_at: "2026-10-05T09:45:00.000Z" },
    { onConflict: "owner_id,kind,started_at", ignoreDuplicates: true },
  );
});
```
(Match `event.alarms` to the existing `CalendarEvent` alarm field name; check with `grep -n "alarm" src/lib/calendar/calendar-event.ts`.)

- [ ] **Step 3: Run, see FAIL.** Step 4: implement. Feed: fetch the owner's shifts for the next 60 days only when `fetchRosterSettings(...).calendarShifts` is true, emit `{ title: "Roster: <kind label>", start, end }` with no location or workplace, `REMINDER_CALENDAR_REACH.shifts = "link-and-file"`, default `calendarAlert: "off"`. `"evening-before"` = 20:00 Perth on the day before the start date, still subject to quiet hours and the daily cap. The extra-time route follows the shifts route's `authorise`, bucket `"roster"`, zod-strict body, `endedAt > startedAt`, at most 24 h, and `ignoreDuplicates: true` so a record Admin already holds (maybe already claimed) is never overwritten.

- [ ] **Step 5: Run** the three test files plus `tests/reminder*.test.ts`, `tests/calendar*.test.ts` and `tests/account-preferences*.test.ts` - PASS. Typecheck exit 0.

- [ ] **Step 6: Commit** by path: `git commit -m "feat(roster): hours, Today summary, shift reminders and calendar feed"`.

---

### Task 6: Wire up, document and open the PR

**Files:**
- Modify: `src/components/my-work/my-work-home.tsx` (My shifts card links to `/roster`), `src/components/on-call/on-call-next-shift.tsx` (links to `/roster`; keeps showing the next shift)
- Modify: `scripts/lib/tenancy-scan.mjs:62-96` add `src/lib/roster/shifts/repository.ts`, `src/lib/roster/calendar-links.ts`, `src/lib/roster/settings.ts` to `SCANNED_LIB_MODULES`, then run the tenancy check that reads it (`grep -n tenancy package.json`)
- Modify: `docs/codebase-index.md` (one Roster line), `docs/site-map.md` (regenerated), `docs/privacy-assessment` inventory row for the new preference keys and calendar links (file name from Plan A Task 6)
- Test: `tests/my-work-home.dom.test.tsx` link assertion

- [ ] **Step 1:** Update the two links, the tenancy list and the My Work test; run `npx vitest run tests/my-work-home.dom.test.tsx tests/on-call-*.dom.test.tsx` - PASS.
- [ ] **Step 2:** Whole-branch fast checks: `npm run lint`, `npm run typecheck`, `npx vitest run` on the branch's changed test files (`test:focused` refuses a change set with test helpers; the full suite is left to CI and the PR says so), `npm run format` then commit the formatting. `npm run plan:browser` and run only what it selects (`-- --run`); report it as "focused browser proof, full suite left to CI".
- [ ] **Step 3:** One whole-branch adversarial review (fresh reviewer; the personal-practice-reviewer and frontend-ui-reviewer checklists). Fix findings in one commit.
- [ ] **Step 4:** Push once: `git push -u origin <branch>`. Open a draft PR (repo template; Before/After; "Merges only after the Roster database PR"; no deferred-deploy wording). Subscribe to its activity. Send the PR to the merge lineup thread once CI is green and Plan A is merged.

---

## Self-review

- Spec coverage: Today (all four lead states and the 3 am dial), Shifts (Week, Month, Hours), + Add (shift, file, link), import (PDF, Excel, CSV, ICS, link; which row; unknown codes; changes only), Settings (calendar switch, reminder, workplaces, links, delete with undo), My shifts moved with redirects, extra time into Admin's record, nothing offline, no AI. Team, Requests, Manage, phone alerts and Ask Roster are Release 2 by design.
- Placeholders: none; the only "confirm the export name" notes point at a grep, not a guess.
- Type names match `build-plan/code/` exactly (after the review fixes below) (`gridRowToShifts`, `findRememberedRow`, `summariseToday`, `summariseHours`, `fortnightFor`, `fetchCalendarLink`, `RosterReadError.reason`).

## What the independent review changed (26 Sep 19:40Z)

One adversarial review, 12 findings, all taken:
1. Roster's remembered settings moved out of account preferences (they would have been copied to the phone's storage) into `/api/roster/settings`; the device test now checks stored values, not only key names.
2. Task 0 added: the branch carries Plan A's types commit only, so typecheck passes before Plan A merges, and mode-kit PR #3115 comes first.
3. The old `/on-call/shifts` page is deleted in Task 2 with the page-count ratchet updated; On Call's menu file is left to On Call.
4. Lanes now own disjoint files (page files in Task 4, rate-limit bucket in Task 1, reminders screen in Task 5, tenancy list in Task 6).
5. Delete my data now waits 30 seconds before deleting anything, deletes links and settings too, and drops the confirm dialog, as the design said. Simpler, and nothing can be half-restored.
6. Calendar-link failures map to the database's own reason codes; long links are refused before insert; feeds are cut to the useful date window before the 400-shift cap.
7. Extra time never overwrites a record Admin already holds.
8. Real export names in the registration test; mode counts taken from main plus one.
Plan A: contract tests now ignore SQL comments and plpgsql variables (they would have failed on correct SQL); a re-date step keeps the five migration stamps newest while the PR waits for Josh; the drift image is pinned by digest.
