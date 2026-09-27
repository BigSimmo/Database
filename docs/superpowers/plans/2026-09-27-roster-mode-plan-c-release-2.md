# Roster Release 2 (Roster for a health service) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A doctor who belongs to a confirmed hospital team sees who is on (Team), asks for swaps, gives shifts away, says "I can't make my shift", marks dates they can't work and plans leave (Requests), and can ask Roster plain questions. A roster manager approves what needs them, finds and fills gaps, publishes the team roster from a file, and manages the people list (Manage). Josh confirms each team and names its managers in the owner panel. Phone alerts say only that something changed.

**Architecture:** Every team read and write goes through the two database functions from PR #3117, `roster_read(p_actor_id, p_service_id, p_what, p_payload)` and `roster_command(p_actor_id, p_service_id, p_action, p_payload)`, which check membership, verification and role in SQL on every call. One thin server layer (`src/lib/roster/team/`) validates each request with strict zod schemas, passes the **session** user as the actor, maps the SQL error codes to plain messages, and parses the answers. Screens read through one client hook and hold nothing on the device. The only owner tables Release 2 writes directly (planned leave, phone-alert subscriptions) are filtered by `owner_id` from the session. The one other direct read is the alerts module's recipient lookup (Task 8), which reads people ids only, by row id and team id. Invites reuse On Call's command (`invitation.create` with `issuedViaMode: "roster"`) and On Call's join route. Phone alerts use the existing service worker with two new handlers and the `web-push` library on the server.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 6, Zod 4, Tailwind 4 tokens, exceljs (server, already installed), `web-push` (new, server only), Vitest, Playwright.

**Spec:** `/mnt/project-files/roster-mode/plan-v8.html` (approved 26 Sep 18:44Z; Team, Requests, Settings, Manage, Ask Roster and alert boards), decisions in `build-plan/00-overview.md`, card answers in `answers.txt`, reviews `review-design.md`, `review-nl-edit.md`, `review-rostermaker.md`, design standard `/mnt/project-files/design/mode-design-standard.md` v13.2, DB contract `shared-db-contract.md` v6.

**Written:** 27 Sep 2026, against Release 1 branch `claude/project-thread-yrumov-release-1` (PR #3118, head 1f2711a36) and the database PR #3117 (branch `claude/project-thread-yrumov`, head cddd8aad7). Every read name, action name, payload key and error code below was read from `supabase/migrations/20260926225409_roster_mode.sql`, `20260926225209_roster_shared_services_hardening.sql` and `20260926225309_on_call_service_items.sql` on that branch. Where the SQL cannot serve a screen, the gap is listed in "Needs a small follow-up database change" and the screen says what it does until that change is live.

**Efficiency:** One task runs alone first (the shared team client, the pure eligibility rules and the navigation), then seven lanes run in parallel with no shared files, then one wire-up task. One review per lane, one whole-branch review, fast local checks only (focused tests, lint, typecheck, format), one push. Reused, not rebuilt: On Call's invite command and join route, the developer hub's panel shell and administrator check, Release 1's file reader and code chooser, R1's hours, Today and Perth-time helpers, the WA public-holiday list, the existing service worker and install prompt, and the cross-tenant probe harness.

## Global Constraints

- The repo is PUBLIC. Test and demo data is invented: "Example Health Service", "General Medicine", "Example Hospital", "Dr Alex Example", "Dr Sam Example", "Dr Mei Example". No patient data anywhere. No real staff data until the health service's privacy approval and P1 #F9HZEG (two-user isolation proof) are done.
- Every server route takes the actor from `requireAuthenticatedUser` only. No request body, query or header ever names the actor. Every zod body is `.strict()`, so a body carrying `actorId`, `ownerId` or `p_actor_id` is refused with 400.
- Every Roster route uses rate-limit bucket `"roster"` (added in Release 1). The one exception is the join step, which reuses On Call's own route and bucket unchanged.
- Nothing about shifts, teams, requests or colleagues is stored on the device: no localStorage, sessionStorage, IndexedDB or Cache Storage of any Roster data. The service worker keeps treating every `/api/*` request as network-only. Page state lives in React memory and is gone when the page closes.
- No OpenAI and no AI of any kind in Roster. No Roster file imports `@/lib/openai`, the `openai` package, `@/lib/rag` or the speech route. Ask Roster is read by app code on the phone, and the typed text never leaves the phone: it is never sent to the server, never put in a URL, never logged and never stored.
- Phone alerts carry a type code only (`{"t":"changed"}` and the like). The lock-screen text is one of four fixed generic sentences, with no name, place, shift type, date or count. The mockup's "Show the place on the lock screen" switch is not built.
- Colour and type follow Release 1: Roster violet only in the five places the design names, tokens not hex, numbers and headings weight 400, 24-hour time with "+1" for a shift ending the next day, tap targets `min-h-12`. Amber appears only beside the same warning in words. Red never appears (Roster has no emergency number).
- Shared UI comes only from `@/components/mode-kit/*` (the export list is in plan-b Task 4) and the existing primitives Release 1 used (`InformationPageShell`, `InPageNavHeader`, `Sheet` with `mobilePlacement="bottom"`, `SegmentedControl`, `ToggleSwitch`, `EmptyState`, `Skeleton`, `InlineNotice`, `useToast`, `TextField`). Never copy a component from `src/components/on-call/`.
- Roster pages are information pages (Release 1 registered `/roster/*` single-segment children), so the shared search bar never shows on them. Ask Roster is an in-flow box inside the page, per the "one owner" rule in `docs/search-chrome-behaviour.md`; it is never a fixed bottom bar.
- Health-service features switch on only for teams whose `enabled` flag is true (`verified_at is not null or is_demo`). A team that is not confirmed shows "This team hasn't been confirmed yet." and nothing else.
- Leave has no reason field and no sick or carer's kind. "I can't make my shift" asks no reason. Unavailability stores no reason.
- Stage by path, never `git add -A`. Shared files have one owning lane (table below); a lane that needs a change in another lane's file asks that lane's owner.
- Release 2 merges after PR #3117 (database, Josh merges), PR #3118 (Release 1) and mode-kit PR #3115. Publishing a roster also needs follow-up gap G1 to be live (see the gaps section).

## Review Focus

1. **The session is the only actor.** No route reads an actor from the request; zod strict schemas refuse extra keys; the RPC is always called with `p_actor_id = user.id`. Pinned by `tests/roster-session-actor.test.ts` (Task 11), table-driven over every Roster route.
2. **A swap is only as good as the server's recheck.** The preview on the phone is advice; `swap.create`, `swap.accept`, `swap.approve`, `open.claim` and `open.approve` recheck in SQL. The "Rechecked 18:21" line is the time of the fresh read made when the sheet opened, never a cached value. Pinned in Task 5 and Task 6 DOM tests.
3. **Nothing personal reaches a lock screen.** Push payloads are a type code only; the service worker maps the code to a fixed sentence. Pinned by `tests/roster-alerts.test.ts` and the service-worker test (Task 8), which assert every sent payload is exactly `{"t":<type>}` and every shown body is one of the four sentences.
4. **Publishing never quietly undoes an agreed swap or drops a row.** A file row that would move a shift back from an approved swap is shown and needs a choice; a row that matches nobody is shown and needs a choice; publish is all-or-nothing in SQL. New Year periods and nights over midnight land on the right Perth date. Pinned by `tests/roster-publish-compare.test.ts` (Task 7).
5. **Typed text never leaves the phone, and dates are right in any phone time zone.** Pinned by `tests/roster-ask-box.dom.test.tsx` (no fetch, URL or storage carries the text) and the date tests run under three `TZ` values (Task 9).
6. **A member without a grade is invisible to swaps and open shifts** (SQL: `roster_grade_rank(null)` never matches). Manage › People marks "Grade not set" in words, and Today tells a doctor with no grade "Ask your manager to set your grade so you can swap." Pinned in Task 6.

---

## Lanes and order

| Task   | Lane                                                            | Model                           | Runs                                                                                      | Owns these files only                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------ | --------------------------------------------------------------- | ------------------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0      | Base                                                            | lighter                         | First                                                                                     | New branch and worktree; Task G's types commit once it exists                                                                                                                                                                                                                                                                                                                                                                                                         |
| 1      | Groundwork                                                      | strongest                       | After 0, alone                                                                            | `src/lib/roster/team/{model,errors,repository,api,eligibility,demo-team}.ts`, `src/lib/roster/alerts/dispatch.ts` (stub only; Lane D owns it afterwards), `src/components/roster/use-roster-team.ts`, `src/app/api/roster/team/route.ts`, `src/app/api/roster/team/[serviceId]/route.ts`, `src/lib/mode-secondary-navigation.ts` (Roster entries only), `tests/roster-team-api.test.ts`, `tests/roster-eligibility.test.ts`, `tests/roster-mode-registration.test.ts` |
| G      | Follow-up database PR (gaps G1–G5)                              | strongest                       | Alongside Task 1, on its own branch; its PR opens only after #3117 merges; Josh merges it | Its own branch only: one new migration file and the companion files listed in "Needs a small follow-up database change". No app file, and nothing lands on the Release 2 branch except its types commit                                                                                                                                                                                                                                                               |
| 2, 3   | A: Owner panel, invites, join                                   | lighter                         | After 1, parallel                                                                         | `src/lib/roster/owner/**`, `src/app/api/roster/owner/**`, `src/components/developer-area/hub/roster-teams-panel.tsx`, `src/app/mockups/development/roster-teams/page.tsx`, `src/app/mockups/development/page.tsx` (one link), `src/app/api/roster/team/[serviceId]/invite/route.ts`, `src/components/roster/invite/**`, `src/app/(search-app)/roster/join/page.tsx`, their tests                                                                                      |
| 4, 10a | B1: Team and Today                                              | lighter                         | After 1, parallel                                                                         | `src/app/(search-app)/roster/team/page.tsx`, `src/components/roster/team/**`, `src/lib/roster/team/team-view.ts`, `src/components/roster/roster-today-page.tsx`, `src/components/roster/use-roster-shifts.ts`, `src/components/roster/roster-night-dial.tsx`, their tests                                                                                                                                                                                             |
| 5, 10b | B2: Requests, leave, Shifts, calendar feed                      | lighter                         | After 1, parallel                                                                         | `src/app/(search-app)/roster/requests/page.tsx`, `src/components/roster/requests/**`, `src/lib/roster/team/request-status.ts`, `src/lib/roster/leave.ts`, `src/app/api/roster/leave/**`, `src/components/roster/roster-shifts-page.tsx`, `src/components/roster/roster-add-sheet.tsx`, `src/lib/calendar/feed-repository.ts`, their tests                                                                                                                             |
| 6, 10c | C1: Manage (Approve, Cover, People, settings, fairness, export) | lighter                         | After 1, parallel                                                                         | `src/app/(search-app)/roster/manage/page.tsx`, `src/components/roster/manage/*.tsx` (not `publish/`), `src/lib/roster/team/fairness.ts`, `src/lib/roster/export.ts`, `src/app/api/roster/team/[serviceId]/export/route.ts`, `src/app/api/roster/team/[serviceId]/cutoff/route.ts`, their tests                                                                                                                                                                        |
| 7      | C2: Publish                                                     | strongest                       | After 1, parallel                                                                         | `src/lib/roster/publish/**`, `src/components/roster/manage/publish/**`, `src/components/roster/roster-code-chooser.tsx` (extracted), `src/components/roster/roster-import-flow.tsx` (import the extracted chooser only), `src/app/api/roster/team/[serviceId]/publish/route.ts`, their tests                                                                                                                                                                          |
| 8      | D: Phone alerts                                                 | strongest                       | After 1, parallel                                                                         | `public/sw.js` (push handlers only), `src/lib/roster/alerts/**`, `src/app/api/roster/alerts/**`, `src/app/api/roster/team/[serviceId]/remind/route.ts`, `src/components/roster/alerts/**`, `src/components/roster/roster-settings-page.tsx`, `src/lib/roster/settings.ts`, `src/lib/env.ts` (three optional keys), `.env.example`, `package.json`, `package-lock.json`, their tests, `tests/pwa-service-worker.test.ts` (new cases)                                   |
| 9      | E: Ask Roster                                                   | strongest                       | After 1, parallel                                                                         | `src/lib/roster/ask/**`, `src/components/roster/ask/**`, their tests                                                                                                                                                                                                                                                                                                                                                                                                  |
| 11     | F: Privacy and isolation                                        | lighter (reviewed by strongest) | After 1, parallel                                                                         | `scripts/lib/cross-tenant-roster-probe.ts`, `scripts/test-cross-tenant-staging.ts` (wire-in only), `tests/cross-tenant-roster-probe.test.ts`, `tests/roster-no-ai.test.ts`, `tests/roster-session-actor.test.ts`, `tests/roster-team-device-storage.dom.test.tsx`                                                                                                                                                                                                     |
| 12     | Wire-up and ship                                                | strongest for the review        | Last, alone                                                                               | `src/app/api/roster/shifts/route.ts` (DELETE only), `scripts/lib/tenancy-scan.mjs`, `tests/design-system-adoption.test.ts`, `tests/route-reachability.test.ts` (only if needed), `docs/codebase-index.md`, `docs/site-map.md`, `docs/privacy-impact-assessment.md`, PR                                                                                                                                                                                                |

Lanes import each other only by the exact names in each task's **Produces** block, so they can build before the other lane lands. Each lane runs only its own test files; Task 12 runs them together. "Lighter" means a faster, cheaper model with this plan as its brief; "strongest" is for the four places where a wrong answer is costly or subtle (the shared client, publishing, alerts, the sentence reader).

### Names that cross lanes

| Name                                                                                         | Made by                 | Used by                                 |
| -------------------------------------------------------------------------------------------- | ----------------------- | --------------------------------------- |
| `rosterRead`, `rosterCommand`, `withRosterApi`, `rosterActionSchema`, the response types     | Task 1                  | every lane                              |
| `useRosterTeams`, `useRosterRead`, `postRosterAction`                                        | Task 1                  | A, B1, B2, C1, C2, D, E                 |
| `swapCandidates`, `openShiftCandidates`, `swapNeedsManager`, `placementProblem`, `gradeRank` | Task 1                  | B2, C1, C2, D, E                        |
| `dispatchRosterAlerts`, `RosterAlertEvent`                                                   | Task 1 (stub), D (body) | Task 1 route, C2 route                  |
| `RosterInviteSheet`                                                                          | A                       | C1, C2                                  |
| `MyShift`, `useRosterShifts`                                                                 | B1                      | B2, E                                   |
| `/roster/requests?start=…`                                                                   | B2                      | B1, E, Shifts                           |
| `GET /api/roster/leave`                                                                      | B2                      | E, Task 12                              |
| `RosterPublishTab`                                                                           | C2                      | C1                                      |
| `RosterAlertsSwitch`, `RosterAlertsSection`, `/api/roster/team/[serviceId]/remind`           | D                       | A (join page), C1 (Remind)              |
| `RosterAskBox`                                                                               | E                       | B1 (Today, Team), B2 (Shifts, Requests) |

### How the build runs

1. Task 0, then Task 1 on the strongest model, reviewed once, committed. Task G starts at the same time on its own branch; its types commit is cherry-picked (Task 0 Step 2) before the seven lanes start.
2. Seven lanes start together, each in its own worktree branched from the Task 1 commit (`git worktree add /home/claude/wt/roster-r2-<lane> -b roster-r2-lane-<lane> <task-1 sha>`), each briefed with this plan's global constraints, its own task text and the names table above, and nothing else.
3. When a lane's own tests pass, one reviewer (a lighter model for the lighter lanes, the strongest for C2, D and E) reads that lane's diff against its task and the fixed rules. The lane fixes the findings in one commit.
4. Merge the lanes into the Release 2 branch in this order: A, D, C2, B1, E, B2, C1, F. B1 and E import each other (`RosterAskBox` one way, `useRosterShifts` the other), so the branch typechecks only once both are in; run `npx tsc --noEmit -p tsconfig.json` after the last merge, not between merges. Each lane re-runs its own DOM tests after that final merge.
5. Task 12, the whole-branch review, one push, the draft PR.

The build thread messages Josh only when he must act (the keys, the follow-up database change, the isolation proof) or when the PR is ready.

---

### Task 0: Branch set-up

- [ ] **Step 1:** `git -C /home/claude/Database fetch origin` then `git worktree add /home/claude/wt/roster-r2 -b claude/project-thread-yrumov-release-2 origin/claude/project-thread-yrumov-release-1`. If #3118 has merged, branch from `origin/main` instead. If mode-kit #3115 has not merged, it is already under Release 1; do nothing more.
- [ ] **Step 2:** Release 1 already carries PR #3117's `database.types.ts` commit (b20bf15a2), which has `roster_read`, `roster_command`, `roster_set_manager`, `on_call_service_set_verified` and `web_push_subscriptions`. When Task G has committed its types change (G5 adds a column and a function), cherry-pick only that one types commit, exactly as plan-b Task 0 did, before the lanes start. Never bring any `supabase/` file onto this branch.
- [ ] **Step 3:** `cd /home/claude/wt/roster-r2 && npm ci --include=dev && npx tsc --noEmit -p tsconfig.json` exits 0.

---

### Task 1: Team client, API, eligibility rules and navigation

**Files:**

- Create: `src/lib/roster/team/model.ts`, `errors.ts`, `repository.ts`, `api.ts`, `eligibility.ts`, `demo-team.ts`
- Create: `src/lib/roster/alerts/dispatch.ts` (a stub: `export async function dispatchRosterAlerts(_client: AdminClient, _event: RosterAlertEvent): Promise<void> {}` plus the `RosterAlertEvent` type below; Lane D fills it)
- Create: `src/app/api/roster/team/route.ts` (GET teams), `src/app/api/roster/team/[serviceId]/route.ts` (GET reads, POST actions)
- Create: `src/components/roster/use-roster-team.ts`
- Modify: `src/lib/mode-secondary-navigation.ts` (Roster block about l.187: add Team and Requests; the active-id mapping about l.354; the page predicate about l.421)
- Test: `tests/roster-team-api.test.ts`, `tests/roster-eligibility.test.ts` (Create); `tests/roster-mode-registration.test.ts` (Modify)

**Interfaces:**

- Consumes: `roster_read` / `roster_command` exactly as in `20260926225409_roster_mode.sql` l.601-1436.
- Produces:
  - `ROSTER_GRADES = ["intern","resident","registrar","fellow","consultant","other"]`, `RosterGrade`, `ROSTER_READS = ["overview","assignments","requests","unavailability","leave_overlap","manage","people","publications","maker"]` (the SQL also has `teams`, used only by the list route, and `draft`, which is Release 3), plus `ROSTER_FOLLOW_UP_READS = ["changes","team_leave","my_changes"]` (G1, G4, G2), which the route also accepts and the hook reports as `unavailable` until Task G is live, `RosterReadWhat`, and zod response schemas with inferred types: `RosterTeam { serviceId, name, enabled, role: "member"|"manager", grade }`, `RosterOverview { service{id,name}, me{role,grade,rotationEndsOn}, latestPublication{id,version,publishedAt,periodStart,periodEnd}|null, seenLatest, settings{swapApproval,rules,rulesSource,payFortnightAnchor}, sites[{id,name}], managers?, nextCutoffOn? }` (the last two optional until G3/G5 are live), `RosterAssignment { id, userId|null, name|null, grade|null, siteId|null, siteName|null, startsAt, endsAt, shiftCode, kind }`, `RosterSwap`, `RosterOpenShift`, `RosterRequests`, `RosterManage`, `RosterPerson`, `RosterPublication`, `RosterMaker`, each with exactly the keys the SQL's `jsonb_build_object` builds for that read (l.650-783; every assignment is `roster_assignment_json`, l.587), and for the follow-up reads the shapes in the gaps section.
  - `rosterActionSchema`: a strict discriminated union on `action`, one entry per R2 action with the SQL's payload keys: `role.set {userId, grade?, rosterName?, rotationEndsOn?}` (each optional key may be `null`; the SQL only changes keys that are present), `member.remove {userId}`, `settings.set {swapApproval: "auto_same_grade"|"manager", rules, rulesSource, payFortnightAnchor}` (all required, because the SQL overwrites all four; `rules` strict with only `minBreakHours`, `maxNightsInRow`, `maxDaysInRow`, `maxHours7d`, `maxHours14d`), `unavailability.set {set: {date, kind: "cant"|"prefer_off"}[] <= 120, clear: date[] <= 120}`, `swap.create {giveAssignmentId, counterpartyId, takeAssignmentId?: uuid|null}`, `swap.accept|swap.approve|swap.decline|swap.cancel|swap.undo {swapId}`, `open.post {assignmentId}` or `open.post {startsAt, endsAt, shiftCode, kind, siteId?, minGrade?, urgent?}` (gap `kind` is day|evening|night|on_call|other, never leave, and `minGrade` never `other`: the open-shift table's checks; one schema with a refine: `assignmentId` xor the gap fields), `open.report {assignmentId}`, `open.claim|open.approve|open.decline|open.cancel {openShiftId}`, `open.release {openShiftId, urgent?}`, `seen.mark {publicationId}`. `publish` and `codes.set` are **not** in this union (only the publish route sends them); `needs.set`, `draft.*` and `agreement.record` are Release 3.
  - `rosterRead(client, actorId, serviceId, what, payload?)` returns the parsed type for `what`; `rosterReadTeams(client, actorId)`; `rosterCommand(client, actorId, serviceId, action)` returns the SQL's jsonb (`{ok}`, `{swapId,status,...}`, `{openShiftId,status,...}`).
  - `RosterApiError` codes from `errors.ts`, mapped from the SQL: `roster_auth_required` 401; `roster_invalid_request` 400; `roster_access_denied` 403 "You're not in this team."; `roster_team_not_verified` 403 "This team hasn't been confirmed yet."; `roster_role_denied` 403 "Only the team's roster manager can do that."; `roster_not_found` 404 "That shift or request has changed. Refresh and try again."; `roster_limit` 409 "That's more than Roster allows for one team."; `roster_conflict` 409 "The roster changed while you were looking. Refresh and try again."; `roster_request_exists` 409 "There's already a request for this shift."; `roster_swap_not_eligible` 409 "That no longer fits the team roster or grades."; `roster_open_shift_taken` 409 "Someone else took this shift first."; Postgres `23505` 409 `roster_duplicate` "Another person already uses that roster name."; `22P02`, `22007`, `22008`, `23503`, `23514` 400 `roster_invalid_request`; anything else 503 `roster_unavailable`. The database message is never echoed.
  - `withRosterApi(request, operation)`: the shape of On Call's `withServiceApi` (`src/lib/on-call/service-api.ts`) with bucket `"roster"`, `Cache-Control: private, no-store, max-age=0`, `Vary: Cookie, Authorization`. In demo mode (`isDemoMode()`), reads are served from `demo-team.ts` and writes return 400 `demo_mode_unavailable`.
  - Routes: `GET /api/roster/team` → `{ teams: RosterTeam[] }`. `GET /api/roster/team/[serviceId]?what=<RosterReadWhat>&from=YYYY-MM-DD&to=YYYY-MM-DD` → the parsed read (`from`/`to` required for `assignments`, `unavailability`, `leave_overlap`, `changes` and `team_leave`, span <= 62 days, as the SQL checks). `POST /api/roster/team/[serviceId]` body `RosterAction` → `{ result }`, then `after(() => dispatchRosterAlerts(client, { serviceId, actorId, action, result }))`. Confirm `after` in `node_modules/next/dist/docs/` before use (AGENTS.md: this Next.js differs from training data).
  - `RosterAlertEvent = { serviceId: string; actorId: string; action: RosterAction; result: unknown; before?: { claimedBy: string | null } }`. The SQL clears `claimed_by` on `open.decline`, so for that one action the POST route first reads `manage` (the actor must be a manager anyway) and passes the claimer as `before`; if that read fails, `before` is left out and the command still runs.
  - Eligibility (pure, mirrors SQL l.526-572 and l.1064-1116): `gradeRank(grade)` (intern 1 … consultant 5, `other`/null → null), `placementProblem(assignments, userId, startsAt, endsAt, excludeIds, minBreakHours) → null|"clash"|"short_break"` (leave counts as a clash; on-call and leave are ignored for breaks), `swapNeedsManager({give, take, giverGrade, takerGrade, settings, assignments, now}) → null|"team_setting"|"within_7_days"|"different_grade"|"team_rule"` (checked in the SQL's order), `swapCandidates(assignments, give, me, settings)` (active members seen in the window, grade >= giver's, free, sorted same grade first then longest break before), `openShiftCandidates(assignments, open, settings, excludeUserId)`, `hoursSinceLastShift(assignments, userId, at)`, `hoursUntilNextShift(...)`.
  - Client hook `use-roster-team.ts`: `useRosterTeams()`, `useRosterRead(serviceId, what, range?)` → `{ status: "loading"|"ready"|"signed-out"|"not-confirmed"|"unavailable"|"error", data, message, reload, readAt }` (`readAt` is the time the answer arrived, used for "Rechecked 18:21"), `postRosterAction(serviceId, action)` → `{ ok: true, result } | { ok: false, code, message }`. `unavailable` means the read name is not live yet (`roster_invalid_request` on a read the follow-up adds); screens hide that module. In memory only.
  - Navigation: Roster pages become Today, Shifts, Team, Requests, Settings. Manage is **not** in the registry (the registry is the same for everyone and non-managers must not see Manage); managers reach `/roster/manage` from a row on Today and on Settings.

- [ ] **Step 1: Failing tests** (`tests/roster-team-api.test.ts`; mock `server-only`, `@/lib/supabase/admin`, `@/lib/supabase/auth` and the rate limiter exactly as `tests/roster-shifts.test.ts` does):

```ts
it("reads a team as the signed-in user, never as anyone named in the request", async () => {
  mocks.user = { id: "user-alex" };
  mocks.rpc.mockResolvedValue({ data: overviewFixture, error: null });
  await GET(new Request("http://x/api/roster/team/svc-1?what=overview&actorId=user-sam"), ctx("svc-1"));
  expect(mocks.rpc).toHaveBeenCalledWith("roster_read", {
    p_actor_id: "user-alex",
    p_service_id: "svc-1",
    p_what: "overview",
    p_payload: {},
  });
});
it("refuses a body that tries to name the actor", async () => {
  const response = await POST(jsonRequest({ action: "swap.cancel", swapId: SWAP, actorId: "user-sam" }), ctx("svc-1"));
  expect(response.status).toBe(400);
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("refuses publish and Release 3 actions through the general route", async () => {
  for (const action of ["publish", "codes.set", "needs.set", "draft.open", "agreement.record"]) {
    expect((await POST(jsonRequest({ action }), ctx("svc-1"))).status).toBe(400);
  }
});
it("maps every SQL error code to a plain message and never echoes the database text", async () => {
  mocks.rpc.mockResolvedValue({ data: null, error: { message: "roster_open_shift_taken", code: "P0001" } });
  const response = await POST(jsonRequest({ action: "open.claim", openShiftId: OPEN }), ctx("svc-1"));
  expect(response.status).toBe(409);
  expect(await response.json()).toMatchObject({ error: { code: "roster_open_shift_taken" } });
  mocks.rpc.mockResolvedValue({
    data: null,
    error: {
      message: 'duplicate key value violates unique constraint "roster_member_roles_roster_name_idx"',
      code: "23505",
    },
  });
  const body = JSON.stringify(
    await (await POST(jsonRequest({ action: "role.set", userId: USER, rosterName: "A Example" }), ctx("svc-1"))).json(),
  );
  expect(body).toContain("roster_duplicate");
  expect(body).not.toContain("roster_member_roles");
});
it("refuses an assignments window longer than 62 days before calling the database", async () => {
  expect((await GET(new Request("http://x?what=assignments&from=2026-10-01&to=2026-12-15"), ctx("svc-1"))).status).toBe(
    400,
  );
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("uses the roster rate-limit bucket", async () => {
  await GET(new Request("http://x?what=overview"), ctx("svc-1"));
  expect(mocks.consumeSubjectApiRateLimit).toHaveBeenCalledWith(expect.objectContaining({ bucket: "roster" }));
});
```

and `tests/roster-eligibility.test.ts`:

```ts
it("lets a registrar take a resident's shift but never the reverse", () => {
  expect(gradeRank("registrar")! >= gradeRank("resident")!).toBe(true);
  expect(swapCandidates(team, giveResidentNight, meResident, rules).map((c) => c.userId)).not.toContain("intern-1");
});
it("gives the reasons in the SQL's order", () => {
  expect(swapNeedsManager({ ...clean, settings: { ...s, swapApproval: "manager" } })).toBe("team_setting");
  expect(swapNeedsManager({ ...clean, now: sixDaysBefore })).toBe("within_7_days");
  expect(swapNeedsManager({ ...clean, takerGrade: "registrar" })).toBe("different_grade");
  expect(
    swapNeedsManager({
      ...clean,
      settings: { ...s, rules: { minBreakHours: 10 } },
      assignments: dayEndingNineHoursBefore,
    }),
  ).toBe("team_rule");
  expect(swapNeedsManager(clean)).toBeNull();
});
it("counts planned leave on the roster as a clash and ignores on-call for breaks", () => {
  expect(placementProblem(withLeave, "mei", nightStart, nightEnd, [], null)).toBe("clash");
  expect(placementProblem(withOnCallEndingAtStart, "mei", dayStart, dayEnd, [], 10)).toBeNull();
});
it("treats a member with no grade as not eligible", () => {
  expect(openShiftCandidates(teamWithUngraded, residentGap, rules, null).map((c) => c.userId)).not.toContain(
    "no-grade",
  );
});
```

and change the registration test to `["Today", "Shifts", "Team", "Requests", "Settings"]`.

- [ ] **Step 2: Run to see them fail**: `npx vitest run tests/roster-team-api.test.ts tests/roster-eligibility.test.ts tests/roster-mode-registration.test.ts` - FAIL (modules missing, three pages listed).

- [ ] **Step 3: Implement** the files above. `repository.ts` copies the shape of `src/lib/on-call/service-repository.ts` (`serviceCommand`): throw `PublicApiError(message, status, { code })` from the map; parse every read with its zod schema and fail closed (503 `roster_unavailable`) on a shape mismatch rather than returning a half-parsed object. `demo-team.ts` builds one synthetic team ("Example Health Service · General Medicine", seven people with grades, a published v1 for the current and next fortnight relative to `new Date()`, one requested swap, one open shift) so offline browser checks have something to draw. Navigation: add `{ id: "team", label: "Team", href: "/roster/team" }` and `{ id: "requests", label: "Requests", href: "/roster/requests" }` between Shifts and Settings, and the two pathnames to both mapping functions.

- [ ] **Step 4: Run**: the three test files - PASS; `npx tsc --noEmit -p tsconfig.json` - exit 0; `npx eslint src/lib/roster/team src/app/api/roster/team src/components/roster/use-roster-team.ts` - clean.

- [ ] **Step 5: Commit** by path: `git add src/lib/roster/team src/lib/roster/alerts/dispatch.ts src/app/api/roster/team src/components/roster/use-roster-team.ts src/lib/mode-secondary-navigation.ts tests/roster-team-api.test.ts tests/roster-eligibility.test.ts tests/roster-mode-registration.test.ts && git commit -m "feat(roster): team client, API and eligibility rules over roster_read and roster_command"`.

---

### Task 2: Owner panel: confirm a team, name or remove a manager (Lane A)

**Files:**

- Create: `src/lib/roster/owner/teams.ts`, `src/app/api/roster/owner/teams/route.ts`, `src/app/api/roster/owner/teams/[serviceId]/route.ts`
- Create: `src/components/developer-area/hub/roster-teams-panel.tsx`, `src/app/mockups/development/roster-teams/page.tsx`
- Modify: `src/app/mockups/development/page.tsx` (one card linking to the new panel, in the same shape as the On Call freshness card)
- Test: `tests/roster-owner-teams.test.ts`, `tests/roster-owner-panel.dom.test.tsx` (Create)

**Interfaces:**

- Consumes: `on_call_service_set_verified(p_service_id, p_actor_id, p_verified, p_is_demo)` (errors `service_invalid_request`, `service_not_found`) and `roster_set_manager(p_service_id, p_user_id, p_actor_id, p_manager)` (errors `roster_invalid_request`, `roster_not_found` when the person is not an active member). `requireAuthenticatedUser(request, client, { administrator: true })` from `src/lib/supabase/auth.ts` (403 `administrator_required`). `PanelPageShell` and `panel-primitives` from `src/components/developer-area/hub/`.
- Produces: `GET /api/roster/owner/teams` → `{ teams: [{ serviceId, name, createdAt, verifiedAt, isDemo, activeMembers, managers: number }] }` (newest 200). `GET /api/roster/owner/teams/[serviceId]` → `{ members: [{ userId, displayName, rosterName, serviceRole, rosterRole, grade, joinedAt }] }` (active only, first 200 by join date). `GET /api/roster/owner/teams/[serviceId]?member=<uuid>` → `{ email }` for that one active member (read with `client.auth.admin.getUserById`, so Josh can tell two people apart; never listed in bulk). `POST /api/roster/owner/teams/[serviceId]` body `{ action: "verify", verified: boolean, isDemo: boolean }` or `{ action: "manager", userId, manager: boolean }` (strict). The actor passed to both SQL functions is the signed-in administrator's id.

- [ ] **Step 1: Failing tests** (`tests/roster-owner-teams.test.ts`, mocks as in Task 1 plus `requireAuthenticatedUser` honouring `{ administrator: true }`):

```ts
it("refuses anyone who isn't an administrator, before any database call", async () => {
  mocks.requireAuthenticatedUser.mockRejectedValue(
    new PublicApiError("Administrator access required.", 403, { code: "administrator_required" }),
  );
  expect((await GET_LIST(new Request("http://x/api/roster/owner/teams"))).status).toBe(403);
  expect((await POST(jsonRequest({ action: "verify", verified: true, isDemo: false }), ctx("svc-1"))).status).toBe(403);
  expect(mocks.rpc).not.toHaveBeenCalled();
  expect(mocks.from).not.toHaveBeenCalled();
});
it("confirms a team as the signed-in administrator", async () => {
  mocks.user = { id: "josh-admin" };
  await POST(jsonRequest({ action: "verify", verified: true, isDemo: false }), ctx("svc-1"));
  expect(mocks.rpc).toHaveBeenCalledWith("on_call_service_set_verified", {
    p_service_id: "svc-1",
    p_actor_id: "josh-admin",
    p_verified: true,
    p_is_demo: false,
  });
});
it("names a roster manager, and says plainly when the person has left", async () => {
  mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: "roster_not_found", code: "P0001" } });
  const response = await POST(jsonRequest({ action: "manager", userId: DANA, manager: true }), ctx("svc-1"));
  expect(mocks.rpc).toHaveBeenCalledWith("roster_set_manager", {
    p_service_id: "svc-1",
    p_user_id: DANA,
    p_actor_id: "josh-admin",
    p_manager: true,
  });
  expect(response.status).toBe(404);
  expect((await response.json()).error.message).toBe("That person isn't an active member of this team.");
});
```

Also: the member list never contains an email; the email lookup refuses a user who is not an active member of that team (404) before calling Auth. DOM: the panel lists teams with "Confirmed" or "Not confirmed" in words; pressing "Confirm team" opens a sheet that names the team ("Confirm General Medicine? Its members can then share a roster.") and only the sheet's button sends; "Make roster manager" is shown only on a confirmed team; a 401 shows "Sign in as an administrator to change teams." (the passwordless developer link opens the page but does not sign Josh in).

- [ ] **Step 2: Run, see FAIL.** `npx vitest run tests/roster-owner-teams.test.ts tests/roster-owner-panel.dom.test.tsx`.
- [ ] **Step 3: Implement.** `teams.ts` reads `on_call_services` (id, name, created_at, verified_at, is_demo), counts active `on_call_service_members`, and joins active `roster_member_roles` for the manager count, all with the admin client. These are platform reads with no owner filter by design; say so in the file's header comment and keep them out of `SCANNED_LIB_MODULES`, and keep every query inside this module (the routes never call `.from(`). Demo mode: the routes return 400 `demo_mode_unavailable`.
- [ ] **Step 4: Run** the two files - PASS; `npm run check:organisation -- --files src/components/developer-area/hub/roster-teams-panel.tsx src/lib/roster/owner/teams.ts` - both files resolve to an owning area (if the panel resolves to the developer area rather than personal-practice, that is correct; do not move it).
- [ ] **Step 5: Commit** by path: `git commit -m "feat(roster): owner panel to confirm teams and name roster managers"`.

---

### Task 3: Invites by email and the join page (Lane A)

**Files:**

- Create: `src/app/api/roster/team/[serviceId]/invite/route.ts`
- Create: `src/components/roster/invite/roster-invite-sheet.tsx`, `src/components/roster/invite/roster-join-page.tsx`, `src/app/(search-app)/roster/join/page.tsx`
- Test: `tests/roster-invite-route.test.ts`, `tests/roster-join.dom.test.tsx` (Create)

**Interfaces:**

- Consumes: `serviceCommand` and `hashServiceInvitation` from `src/lib/on-call/service-repository.ts` (On Call's file, imported, not edited). `invitation.create` payload per `20260926225309_on_call_service_items.sql` l.295-347: `{ role: "member", expiresInDays: 1..7, invitedEmail, issuedViaMode: "roster", tokenHash }`; errors `service_role_denied` (actor is not an active Roster manager: `roster_can_invite` false), `service_invalid_request` (bad email or days), `service_limit` (1,000 open invites). Join: `POST /api/on-call/services/join { code }` (On Call's route, which already sends the session's confirmed email as `actorEmail`), errors `service_invitation_invalid`, `service_invite_email_mismatch`, `service_already_member`, `service_limit`.
- Produces: `POST /api/roster/team/[serviceId]/invite` body `{ invitedEmail, expiresInDays?: 1..7 }` (default 7) → `{ path: "/roster/join#code=<64 hex>", expiresAt }`. `RosterInviteSheet({ serviceId, teamName, defaultEmail?, onClose })` from `@/components/roster/invite/roster-invite-sheet` (Lanes C1 and C2 import it). Route `/roster/join`.

- [ ] **Step 1: Failing tests.** Route: the route first calls `rosterRead(..., "overview")`, so an unconfirmed team gets 403 `roster_team_not_verified` and a non-manager gets 403 before any invite is written (the SQL would refuse too; this gives the plain message); a manager's call reaches `on_call_service_command` with exactly `{ role: "member", expiresInDays: 7, invitedEmail: "sam@example.org", issuedViaMode: "roster", tokenHash: <sha256 of the code> }` and the session actor; the response carries the code only inside `path`, after `#`; the code never appears in any `console` call. DOM (join): with `location.hash = "#code=<64 hex>"` the page removes the hash with `history.replaceState` (keeping `history.state`, which the App Router uses) before the request, posts `{ code }` to `/api/on-call/services/join`, then shows "You're in General Medicine" and "Example Health Service · to Sun 29 Nov" (rotation end from the team overview when set); `service_invite_email_mismatch` shows "This invite was sent to a different email. Sign in with that email, or ask your manager for a new invite."; On Call's error map (`src/lib/on-call/service-repository.ts`, not ours to edit) does not list that code yet, so today it arrives as 503 `service_unavailable`, and a 503 from join shows "This invite didn't work. Check you're signed in with the email it was sent to, or ask your manager for a new invite." (the build thread asks On Call, through the coordinator, for the one map entry #3117's SQL header already calls for); `service_already_member` shows the same "You're in" screen; signed out shows "Sign in, then open the invite link again." and stores nothing; a pasted link or code in the page's one field works the same way.
- [ ] **Step 2: Run, see FAIL.** `npx vitest run tests/roster-invite-route.test.ts tests/roster-join.dom.test.tsx`.
- [ ] **Step 3: Implement.** The route generates the code with `randomBytes(32).toString("hex")`, exactly like `serviceMutation`. The invite sheet: one email field, Send, then the full link (`new URL(path, location.origin)`) with three actions: Copy, Share (`navigator.share` when present) and "Email it" (a `mailto:` link with subject "Join General Medicine in Roster" and the link in the body, so the manager's own email app sends it and PsychSift sends no email). The join screen also offers the two optional switches from the design ("Alerts for swaps and changes" = Lane D's `RosterAlertsSwitch`; "Shifts in my calendar" = Release 1's `calendarShifts` setting through `/api/roster/settings`) and "See my shifts" to `/roster`. Today's empty state links to the join page ("Have an invite link? Open it here"), which gives it an inbound link for the reachability gate; Today is Lane B1's file, so B1 adds that row (Task 4), not this lane.
- [ ] **Step 4: Run** the two files - PASS. `npx eslint src/components/roster/invite src/app/api/roster/team` - clean.
- [ ] **Step 5: Commit** by path: `git commit -m "feat(roster): managers invite by email through On Call's invite command; join page"`.

---

### Task 4: Team page, and Today with a team (Lane B1; includes the doctor half of Task 10)

**Files:**

- Create: `src/app/(search-app)/roster/team/page.tsx`, `src/components/roster/team/roster-team-page.tsx`, `roster-team-timeline.tsx`, `roster-day-picker.tsx`, `src/lib/roster/team/team-view.ts`
- Modify: `src/components/roster/use-roster-shifts.ts` (merge my team shifts), `src/components/roster/roster-today-page.tsx`, `src/components/roster/roster-night-dial.tsx` (handover names)
- Test: `tests/roster-team-view.test.ts`, `tests/roster-team.dom.test.tsx`, `tests/roster-today-team.dom.test.tsx` (Create)

**Interfaces:**

- Consumes: Task 1 (`useRosterTeams`, `useRosterRead` for `overview` and `assignments`, `postRosterAction` for `seen.mark`); `WA_PUBLIC_HOLIDAYS` from `src/lib/on-call/wa-public-holidays.ts` (look up with R1's `perthDateOf`, never with `isWaPublicHoliday`, which follows the phone's time zone); Lane E's `RosterAskBox`; Lane A's join route (link only).
- Produces: `MyShift = { id; startsAt; endsAt; kind; title; workplace; source: "import" | "manual" | "team"; serviceId?; teamName?; assignmentId? }` and `useRosterShifts()` returning `shifts: MyShift[]` (Release 1's fields unchanged for own shifts). Team shifts come from each enabled team's `assignments` read for `[today - 21, today + 40]` (61 days), filtered to `userId === me`. A team shift and an own shift with the same start and end show once, as the team shift. `groupByGrade(assignments)` (consultant, fellow, registrar, resident, intern, other, then no grade), `withMe(assignments, me, now)` (people whose shifts overlap any of my next seven shifts), `timelineSpan(assignment, day)` (a night shows "to 08:00" on its second day and "from 21:30" on its first), `handover(assignments, mine)` → `{ from: name|null, to: name|null }`.

Screen contracts (copy exactly as in plan-v8.html; no explanatory text on screen):

- **Team**: `SegmentedControl` Everyone / With me. A day picker (today to +31 days, and back 7). A 24-hour timeline with the day's people grouped under grade headings ("Consultants", "Registrars", "Residents"), each row an initial, the name, and the times in a right-hand column on one line; my own row uses the violet first series; "now" is one blue line through every row, only when the day is today. More than one team: a team switch at the top. Footer row: "Phone numbers are in On call" linking to `/on-call/service?service=<serviceId>`. Empty: "Appears once your manager adds you." Reads: `overview` once, then `assignments` for a 15-day window around the chosen day, refetched only when the day leaves the window.
- **Today** (adds to Release 1's Today, nothing removed): the Ask box at the top; "Needs you" (one row per swap where I am the counterparty and it is `requested`, linking to Requests; for managers, one row "N waiting in Manage" linking to `/roster/manage`); "On with you" (people whose team shifts overlap mine today); in the night dial, "hand over to Jordan" from `handover`; the rotation line "General Medicine until Sun 6 Dec" from `overview.me.rotationEndsOn`, plus ", then ED" when another enabled team has my shifts starting after that date; a public-holiday line "Mon 5 Oct is a public holiday" when I'm rostered on one in the next 7 days; the cut-off line "Next roster closes Fri 30 Oct. Add dates you can't work." (from G5, when it is within 14 days) linking to `/roster/requests?start=dates`; for a member with no grade, "Ask your manager to set your grade so you can swap."; for managers only, a "Manage" row; with no team yet, the empty state adds "Have an invite link? Open it here" linking to `/roster/join`. When `my_changes` (G2) is live, "Your roster changed" lists what moved ("Wed 14: Day to Evening", old value struck through); until then it shows the new shifts only. The first time Today or Team loads a team whose `latestPublication` is not `seenLatest`, send `seen.mark` once.

- [ ] **Step 1: Failing tests.** `team-view`: a night on Thu 15 Oct 21:30 to Fri 08:00 appears on both days with the right label; grouping order; With me picks Sam who shares my 19-21 Oct nights and not Tom. DOM (fixed clock, mocked fetch):

```tsx
it("draws today's team as a timeline grouped by grade, with me in my own colour", async () => {
  mockTeam(generalMedicine);
  mockAssignments(monday12Oct);
  render(<RosterTeamPage />, { now: "2026-10-11T23:05:00Z" }); // 07:05 Perth, Mon 12 Oct
  expect(await screen.findByRole("heading", { name: "Registrars" })).toBeInTheDocument();
  expect(screen.getByText("to 08:00, from 21:30")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /Phone numbers are in On call/ })).toHaveAttribute(
    "href",
    "/on-call/service?service=svc-1",
  );
});
it("shows my team shifts on Today and marks the roster seen once", async () => {
  mockTeam(generalMedicine, { seenLatest: false });
  mockAssignments(myNightThu15);
  render(<RosterTodayPage />, { now: "2026-10-13T02:00:00Z" });
  expect(await screen.findByText(/Thu 15 Oct/)).toBeInTheDocument();
  expect(fetchCalls("/api/roster/team/svc-1", "POST").map((c) => c.body.action)).toEqual(["seen.mark"]);
});
it("hides every team module for a team that isn't confirmed", async () => {
  mockTeam(generalMedicine, { enabled: false });
  render(<RosterTodayPage />);
  expect(await screen.findByText("Get your shifts in")).toBeInTheDocument();
  expect(screen.queryByText("On with you")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run, see FAIL.** `npx vitest run tests/roster-team-view.test.ts tests/roster-team.dom.test.tsx tests/roster-today-team.dom.test.tsx`.
- [ ] **Step 3: Build** to the contracts, reusing Release 1's week strip and night dial, mode-kit `ModeGroupedList`/`ModeRow`, `ModeFactTile`, `ModeStateLabel`, `ModeUpdatedLine`, and `modeNumberText` for times. Run the Release 1 Today and Shifts DOM tests too, because the hook changed: `npx vitest run tests/roster-today.dom.test.tsx tests/roster-shifts.dom.test.tsx`.
- [ ] **Step 4: Run** all five files - PASS; `npx eslint src/components/roster src/lib/roster/team/team-view.ts` - clean.
- [ ] **Step 5: Commit** by path: `git commit -m "feat(roster): Team page and team shifts on Today"`.

---

### Task 5: Requests, leave, Shifts additions and team shifts in the calendar feed (Lane B2; includes the doctor half of Task 10)

**Files:**

- Create: `src/app/(search-app)/roster/requests/page.tsx`; in `src/components/roster/requests/`: `roster-requests-page.tsx`, `roster-swap-ticket.tsx`, `roster-swap-sheet.tsx`, `roster-give-away-sheet.tsx`, `roster-dates-sheet.tsx`, `roster-leave-sheet.tsx`, `roster-sent-bar.tsx`
- Create: `src/lib/roster/team/request-status.ts`, `src/lib/roster/leave.ts`, `src/app/api/roster/leave/route.ts`
- Modify: `src/components/roster/roster-shifts-page.tsx` (tap a team shift; holidays on Month; team pay fortnight on Hours), `src/components/roster/roster-add-sheet.tsx` ("Dates I can't work"), `src/lib/calendar/feed-repository.ts` (my team shifts)
- Test: `tests/roster-requests.dom.test.tsx`, `tests/roster-request-status.test.ts`, `tests/roster-leave-route.test.ts`, `tests/roster-feed-team-shifts.test.ts` (Create)

**Interfaces:**

- Consumes: Task 1 (reads `overview`, `requests`, `assignments`, `unavailability`, `leave_overlap`; actions `swap.create`, `swap.accept`, `swap.decline`, `swap.cancel`, `swap.undo`, `open.post`, `open.report`, `open.cancel`, `open.claim`, `unavailability.set`; `swapCandidates`, `openShiftCandidates`, `swapNeedsManager`, `hoursSinceLastShift`); B1's `MyShift`; Release 1's `fortnightFor(today, anchor)`.
- Produces: the Requests page reads `?start=swap|give_away|cant_make|dates|leave` with ids only (`assignment=<uuid>`, `with=<userId>`, `date=YYYY-MM-DD`, `to=YYYY-MM-DD`) and opens that sheet filled in (Lane E and Shifts link here; no text ever travels in the URL). `requestStatusWords(item, me) → string`. `GET/POST/PATCH/DELETE /api/roster/leave`: list my leave from 30 days ago; create `{ kind: "annual"|"pd_leave", startsOn, endsOn, status: "planned"|"applied"|"approved", serviceId: uuid|null }`; update `{ id, status?, startsOn?, endsOn? }`; delete `{ id }`. All filtered by `owner_id` from the session; at most 50 rows per owner; `endsOn >= startsOn`, at most 366 days (the table's check). A `serviceId` is accepted only after `rosterRead(..., serviceId, "overview")` succeeds for the session user, so the SQL decides membership and confirmation.

Screen contracts:

- **Requests list**: "Open N" then "Earlier". Each row: a letter square, what it is ("Mei asks to swap", "Your Tue 20 Oct night", "Open shift you took", "Leave 22 Dec – 2 Jan"), a detail line, and its status in words from `requestStatusWords`: requested and I asked → "Waiting for Mei" (the counterparty's name from the assignment, else "Waiting for your colleague"); requested and I'm asked → "Needs you" (the only blue status); accepted → "Waiting for your manager"; approved → "Approved", or "Approved itself" with "Undo" while within 10 minutes; declined → "Declined"; cancelled → "Withdrawn" / "Cancelled: the roster changed" / "Cancelled: they left the team" / "Cancelled: it no longer fits" from `cancelReason`; expired → "Expired"; undone → "Undone". Open shifts: reported → "Your manager has been told"; open → "Offered to N people"; claimed → "Waiting for your manager"; approved → "Taken". Leave: "Planned · also lodge in HR", "Applied in HR", "Approved in HR". Open shifts I can take (the `requests` read lists open shifts at or below my grade; the page drops any that clash with my shifts using `placementProblem`) sit in their own group with "Take it" (`open.claim`); `roster_open_shift_taken` shows "Someone else took this shift first." and removes the row. A "New" button opens: Swap a shift, Give a shift away, I can't make my shift, Dates I can't work, Plan leave. Empty: "Nothing yet. To swap, tap one of your shifts."
- **Swap sheet** (both sides): the two shifts as tickets; one sentence first ("You'll be off Sat 31 Oct and on call Sat 7 Nov."); then plain fact rows: "No clashes found" or the clash, "Breaks before: you 62 h, Mei 38 h", "Rule 10 h" (only when the team has the rule), and "Both residents, so it approves itself" or "Needs your manager because it's within 7 days" from `swapNeedsManager`; "Rechecked 18:21" from the read made when the sheet opened. Asker side: pick my shift, then a colleague from `swapCandidates` (with "Offers Sat 7 Nov in return" when they have a shift to give back), then Send. Asked side: Decline, and "Accept swap" as the one dark button. After an auto-approval the sheet shows "Undo for 10 min" (`swap.undo`).
- **Give away sheet**: the shift ticket, "Who can take it: 2 people" from `openShiftCandidates` with the best fit first ("Noor · Resident · free · 29 h since last shift"), and "Offer to both" (`open.post {assignmentId}`). When the shift starts within 24 hours the sheet leads with "I can't make it" (`open.report`), which alerts the manager; no reason is asked, and the line "You still ring in as usual." is kept.
- **Dates sheet**: the next 8 weeks as a month grid; each tap cycles none → "Can't work" → "Prefer off"; Save sends one `unavailability.set` with the `set` and `clear` lists. Only future dates (the SQL ignores others).
- **Leave sheet**: kind, dates, status; "2 of the team are already off these dates" from `leave_overlap` (a number only; shown only for leave of 62 days or less, the read's limit); the team shifts it covers, each with "Offer as open shift" (`open.post`). Saved through `/api/roster/leave` with the team's id when the doctor is in one confirmed team (so it counts in colleagues' overlap and, with G4, shows to the manager), and with no team id otherwise; a doctor in two teams picks one.
- **Sent bar**: after every send, one line ("Offered to Noor and Kai") with Undo for 5 seconds: the Undo sends `swap.cancel`, `open.cancel`, the reverse `unavailability.set`, or `DELETE /api/roster/leave`.
- **Shifts**: tapping a team shift opens a small sheet (Swap, Give away, I can't make it) that links to Requests with `start=`; Month marks WA public holidays with a footnote "WA public holidays, wa.gov.au, read 25 Sep 2026"; Hours uses the team's `payFortnightAnchor` when the doctor is in one enabled team (else Release 1's own anchor). The "+ Add" sheet gains "Dates I can't work · For the next roster" when the doctor is in an enabled team.
- **Calendar feed**: when the doctor turned calendar shifts on, the feed adds their team shifts for the next 60 days (`rosterReadTeams`, then `assignments` per enabled team with the owner as actor, filtered to `userId === owner`), titled "Roster: <kind label>" with no place, colleague or team name, and without duplicating an own shift with the same times.

- [ ] **Step 1: Failing tests** (examples; each helper under 10 lines at the top of the file):

```tsx
it("accepts a clean same-grade swap and offers undo for 10 minutes", async () => {
  mockRequests([swapFromMei({ status: "requested" })]);
  mockAssignments(twoResidentsFree);
  mockAction("swap.accept", { swapId: SWAP, status: "approved", autoApproved: true });
  render(<RosterRequestsPage />, { now: "2026-10-20T10:21:00Z" });
  await userEvent.click(await screen.findByRole("button", { name: /Review/ }));
  expect(screen.getByText("Both residents, so it approves itself")).toBeInTheDocument();
  expect(screen.getByText("Rechecked 18:21")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Accept swap" }));
  expect(await screen.findByRole("button", { name: /Undo/ })).toBeInTheDocument();
});
it("says why a swap needs the manager", async () => {
  mockRequests([swapFromMei({ give: inFiveDays })]);
  render(<RosterRequestsPage />);
  await openReview();
  expect(screen.getByText("Needs your manager because it's within 7 days")).toBeInTheDocument();
});
it("shows leave overlap as a number and never a name", async () => {
  mockRead("leave_overlap", { alreadyOff: 2 });
  await planLeave("2026-12-22", "2027-01-02");
  expect(screen.getByText("2 of the team are already off these dates")).toBeInTheDocument();
  expect(fetchCalls("/api/roster/team/svc-1").some((c) => /name/i.test(c.url))).toBe(false);
});
```

Also in the DOM file: "Take it" sends `open.claim` with the open shift id only, and a `roster_open_shift_taken` answer shows "Someone else took this shift first."; an open shift that clashes with one of my shifts is not listed. `request-status`: one case per status and cancel reason above. Leave route: owner filter on every query (`.eq("owner_id", user.id)`); a body `ownerId` is refused (400); a `serviceId` for a team the SQL refuses gives 403 and nothing is written; the 51st row gives 409. Feed: with calendar shifts on, a team night appears as exactly `{ title: "Roster: Night", start, end }` and `JSON.stringify(events)` does not match `/General Medicine|Example|Ward|Mei/`.

- [ ] **Step 2: Run, see FAIL.** `npx vitest run tests/roster-requests.dom.test.tsx tests/roster-request-status.test.ts tests/roster-leave-route.test.ts tests/roster-feed-team-shifts.test.ts`.
- [ ] **Step 3: Build** to the contracts. The leave route follows the Release 1 shifts route's `authorise` and bucket, `runtime = "nodejs"`, zod-strict bodies, demo refusal for writes.
- [ ] **Step 4: Run** the four files plus Release 1's `tests/roster-shifts.dom.test.tsx` and `tests/roster-feed-reminders.test.ts` - PASS; `npx eslint src/components/roster src/lib/roster src/app/api/roster/leave src/lib/calendar` - clean.
- [ ] **Step 5: Commit** by path: `git commit -m "feat(roster): Requests (swaps, give away, can't make it, dates, leave) and team shifts in Shifts and the calendar feed"`.

---

### Task 6: Manage: Approve, Cover, People, team settings, fairness and export (Lane C1; includes the manager half of Task 10)

**Files:**

- Create: `src/app/(search-app)/roster/manage/page.tsx`; in `src/components/roster/manage/`: `roster-manage-page.tsx`, `roster-approve-tab.tsx`, `roster-decision-sheet.tsx`, `roster-cover-tab.tsx`, `roster-cover-strip.tsx`, `roster-people-list.tsx`, `roster-team-settings.tsx`, `roster-fairness-panel.tsx`
- Create: `src/lib/roster/team/fairness.ts`, `src/lib/roster/export.ts`, `src/app/api/roster/team/[serviceId]/export/route.ts`, `src/app/api/roster/team/[serviceId]/cutoff/route.ts`
- Test: `tests/roster-manage.dom.test.tsx`, `tests/roster-fairness.test.ts`, `tests/roster-export-route.test.ts` (Create)

**Interfaces:**

- Consumes: Task 1 (reads `overview`, `manage`, `people`, `assignments`, `unavailability`, `maker` (only its `needs`, if a manager has set any); actions `swap.approve`, `swap.decline`, `open.approve`, `open.decline`, `open.release`, `open.cancel`, `open.post` (gap form), `role.set`, `member.remove`, `settings.set`); `swapNeedsManager`, `openShiftCandidates`; Lane A's `RosterInviteSheet`; Lane C2's `RosterPublishTab`; Lane D's `POST /api/roster/team/[serviceId]/remind`; G4 `team_leave` and G5 cut-off when live.
- Produces: `/roster/manage` with three sections in the DocumentViewer-template in-page header (`InPageNavHeader` segment track, left-aligned, active in violet; not a `SegmentedControl`, per review-design #6): Approve, Cover, Roster. `fairnessCounts(assignments, window) → [{ userId, name, nights, weekendShifts, publicHolidayShifts, hours }]` (weekend and holiday by Perth date of the start). `GET /api/roster/team/[serviceId]/export?from&to` (span <= 62 days) → an `.xlsx` of the live roster (people down, days across, shift codes in cells, a second sheet listing each person's shifts with times), landscape A4 fit-to-page so it prints; manager only.

Screen contracts:

- **Page guard**: a non-manager who opens `/roster/manage` sees "Only your team's roster manager can see this page." (from the SQL's `roster_role_denied` on the `manage` read) and nothing else.
- **Approve**: three figures at weight 400: "Waiting 3" (accepted swaps plus reported and claimed open shifts), "Auto-approved 4" (the `manage` read's auto-approved swaps, last 14 days), "Seen roster v4: 8 of 10". Then one list, each row with the reason in words: swap, accepted → "Needs you because your team approves every swap" / "…because it's within 7 days" / "…because they're different grades" / "…because it breaks a team rule"; open shift, reported → "Mei can't make Tue 20 night"; claimed → "Taken by Lee · needs you because …" (same reasons, from `swapNeedsManager` on the phone, as the SQL does not store one for open shifts); planned leave (G4) → "Leave · Priya 29 Dec – 9 Jan · 2 of 10 already off", information only with the line "Leave is approved in HR". Tapping a row opens `roster-decision-sheet`: the same tickets the doctor saw, the reason, "Rechecked 08:41" from a fresh `assignments` read, Decline, and Approve as the only dark button. A reported shift offers "Post to N who can take it" (`open.release`, urgent) and "Cancel". Names for ids come from the `people` read.
- **Cover**: the next two weeks as days × Day / Eve / Night counts from `assignments`, showing "rostered/needed" when `maker.needs` has figures; a gap cell has an amber outline only when the gap is also written below it. Each gap: "Gap: Sun 18 Oct evening · Nobody rostered · Noor and Kai can take it" with Post (`open.post` gap form, `minGrade` from the need). Then "2 haven't seen their changes · Published Fri 2 Oct 16:10" with Remind (calls Lane D's remind route; the button then reads "Reminded" until the page reloads). Then the fairness panel: "Nights, weekends and public holidays, <period>" per person as rows of plain counts (managers only; the period is the latest publication's, read in 62-day windows, at most two). Then "Export to Excel".
- **Roster** tab: Lane C2's `<RosterPublishTab serviceId overview />` first, then People and Team settings below it.
- **People**: every active member (`people` read): name, grade (a select; "Grade not set" in words when null), the name the roster file uses, rotation end date (all through `role.set`, only the changed key sent), "Roster manager" in words for managers (named by Josh; there is no control to change it here), "Invite by email" (opens `RosterInviteSheet`), and Remove for ordinary members only (`serviceRole === "member"`), behind a sheet that says what happens: "Remove Sam from General Medicine? Sam leaves this team in On call, Teaching and Roster, and their open requests are cancelled." Editors and admins show "Remove in On call" instead.
- **Team settings**: swap approval ("Clean same-grade swaps approve themselves" default, or "I approve every swap"), the five optional rules as number fields with units, where the rules come from (free text, optional), pay fortnight start date, and (G5) the next roster's cut-off date, shown only when `overview` carries a `nextCutoffOn` key. One Save sends the whole `settings.set` object (the SQL overwrites all four fields), then, only if the cut-off changed, `POST /api/roster/team/[serviceId]/cutoff` `{ cutoffOn: YYYY-MM-DD | null }` (strict body, `withRosterApi`, calls `roster_set_cutoff` with the session user as `p_actor_id`, errors through the Task 1 map). Test: a body carrying `actorId` is 400 and the RPC is never called.

- [ ] **Step 1: Failing tests** (`tests/roster-manage.dom.test.tsx`; helpers under 10 lines each):

```tsx
it("says in words why each item needs the manager", async () => {
  mockManage({
    swaps: [acceptedSwap({ needsManagerBecause: "within_7_days" })],
    openShifts: [reported("mei", "2026-10-20", "night")],
  });
  mockPeople(generalMedicinePeople);
  render(<RosterManagePage />);
  expect(await screen.findByText("Needs you because it's within 7 days")).toBeInTheDocument();
  expect(screen.getByText("Mei can't make Tue 20 night")).toBeInTheDocument();
});
it("approves from a sheet whose only dark button is Approve, and sends no user id", async () => {
  mockManage({ swaps: [acceptedSwap({ id: SWAP })] });
  render(<RosterManagePage />);
  await userEvent.click(await screen.findByRole("button", { name: /Swap · Alex and Sam/ }));
  expect(
    screen
      .getAllByRole("button")
      .filter(isPrimary)
      .map((b) => b.textContent),
  ).toEqual(["Approve"]);
  await userEvent.click(screen.getByRole("button", { name: "Approve" }));
  expect(lastPost("/api/roster/team/svc-1")).toEqual({ action: "swap.approve", swapId: SWAP });
});
it("offers Remove only for ordinary members and says what it does", async () => {
  mockPeople([person("sam", { serviceRole: "member" }), person("dana", { serviceRole: "editor" })]);
  await openRosterTab();
  expect(within(row("Dana")).queryByRole("button", { name: "Remove" })).toBeNull();
  await userEvent.click(within(row("Sam")).getByRole("button", { name: "Remove" }));
  expect(screen.getByText(/leaves this team in On call, Teaching and Roster/)).toBeInTheDocument();
});
it("marks a missing grade in words", async () => {
  mockPeople([person("noor", { grade: null })]);
  await openRosterTab();
  expect(within(row("Noor")).getByText("Grade not set")).toBeInTheDocument();
});
```

Also: a `roster_swap_not_eligible` answer shows the message and refreshes the list; Save in team settings sends all four keys even when one changed; a non-manager sees the guard line only. `fairness`: a night starting Sat 23:00 Perth counts as a weekend shift even when the phone is in `TZ=UTC`; a shift on Mon 5 Oct 2026 (a WA holiday in the list) counts once as a public-holiday shift. Export route: a member (overview role `member`) gets 403 and no workbook is built; a manager gets `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` with `Cache-Control: private, no-store`; a window over 62 days gets 400.

- [ ] **Step 2: Run, see FAIL.** `npx vitest run tests/roster-manage.dom.test.tsx tests/roster-fairness.test.ts tests/roster-export-route.test.ts`.
- [ ] **Step 3: Build** to the contracts with mode-kit tiles, grouped lists and notices. The export route uses exceljs the way Release 1's reader imports it (server only), `runtime = "nodejs"`, the `withRosterApi` wrapper, and never logs cell values.
- [ ] **Step 4: Run** the three files - PASS; `npx eslint src/components/roster/manage src/lib/roster src/app/api/roster/team` - clean.
- [ ] **Step 5: Commit** by path: `git commit -m "feat(roster): Manage approve, cover, people, team settings, fairness and export"`.

---

### Task 7: Manage › Roster: publish the team roster from a file (Lane C2)

**Files:**

- Create: `src/lib/roster/publish/match.ts`, `compare.ts`, `build.ts`
- Create: `src/app/api/roster/team/[serviceId]/publish/route.ts`
- Create: `src/components/roster/manage/publish/roster-publish-tab.tsx`, `roster-row-sorter.tsx`, `roster-publish-preview.tsx`
- Create by extraction: `src/components/roster/roster-code-chooser.tsx` (move `CodeChooser` out of `roster-import-flow.tsx` l.183 unchanged, export it, import it back)
- Test: `tests/roster-publish-match.test.ts`, `tests/roster-publish-compare.test.ts`, `tests/roster-publish-route.test.ts`, `tests/roster-publish-flow.dom.test.tsx` (Create)

**Interfaces:**

- Consumes: Release 1's `POST /api/roster/read-file` (Excel, text PDF) and `tableToGrid` for a grid-shaped CSV; `RosterGrid`, `gridRowToShifts`, `CodeMeaning`, `parseHeaderDates` from `@/lib/roster/import/grid`; Task 1 reads `overview`, `people`, `assignments`, `maker` (its `codes`) and actions `role.set`, plus the two actions only this route sends: `codes.set { codes: [{ code, kind, starts: "HH:MM"|null, ends: "HH:MM"|null, label|null }] }` (replaces the team's whole list, at most 100) and `publish { kind: "full", periodStart, periodEnd, sourceName, assignments: [{ userId|null, rosterName|null, siteId|null, startsAt, endsAt, shiftCode, kind, grade|null }] }` (SQL l.934-1011: at most 5,000 rows, every start's Perth date inside the period, a row without `userId` needs `rosterName`, every `userId` an active member, period at most 186 days; returns `{ publicationId, version, swapsCancelled: [{ id, requesterId, counterpartyId }] }`). **G1** (`changes` read) is required: without it the tab says "Publishing needs a small database update first." and Publish stays disabled.
- Produces: `matchRowsToPeople(rows, people) → [{ rowName, match: { userId, how: "roster_name"|"display_name" } | { suggestion: userId } | null }]` (exact, case- and space-insensitive match on the remembered roster name, then on the display name; a surname-plus-initial likeness such as "R Sample" → Ravi Sample is only ever a suggestion); `compareWithLive({ fileRows, live, approvedChanges, period }) → { unchanged, added, changed: [{ before, after }], removed, byPerson, undoesSwaps: [{ swapId, names, date, keepLive: RosterPublishRow[], useFile: RosterPublishRow[] }] }` keyed by person + Perth start date + kind; `buildPublishPayload({ period, sourceName, rows, choices })` (throws before any request when a rule above is broken). `POST /api/roster/team/[serviceId]/publish` body `{ matches: [{ userId, rosterName }], codes: [...], publish: <payload> }` → `{ publicationId, version, changedPeople, swapsCancelled }`. `RosterPublishTab({ serviceId, overview })`.

Screen contract (plan-v8 "Upload a new version" board):

- Step 1: "Upload the roster" (PDF, Excel or CSV; the file is read and thrown away exactly as in Release 1); the period defaults to the grid's first and last dates, editable. Status line: "Compared with the live roster, including 2 swaps".
- Step 2: "Rows matched 38 of 41", "People with changes 7", then "Sort 3 rows": each unmatched row with "Use Ravi" (a suggestion), "Pick a person", "Keep as named" (published with the printed name and no account; cleared 90 days after the shift by the SQL), "Open shift" (for "TBA" or an empty row: after publishing it is posted with `open.post`), and "Invite by email" (`RosterInviteSheet`). Each unknown code gets its own Choose button (`RosterCodeChooser`), and chosen meanings are saved to the team's codes so next month is one tap. Each approved swap the file would undo: "Would undo 1 approved swap · Jordan and Kai swap, Wed 14 Oct · Approved Mon 5 Oct" with "Keep the swap" (default) and "Use file, undo swap".
- Step 3: per-person preview (tap a person: their changes, old value struck through, "Wed 14: Day to Evening"), then Publish. Publish stays disabled until every row and every code is sorted. Success: "Published v5. 7 people alerted."

- [ ] **Step 1: Failing tests:**

```ts
it("never drops a row that matches nobody", () => {
  const result = matchRowsToPeople(["Dr Alex Example", "Locum 1"], people);
  expect(result.find((r) => r.rowName === "Locum 1")?.match).toBeNull();
});
it("only suggests, never auto-matches, a look-alike name", () => {
  expect(matchRowsToPeople(["R Sample"], [ravi])[0].match).toEqual({ suggestion: ravi.userId });
});
it("keeps an approved swap unless the manager says otherwise", () => {
  const out = compareWithLive({
    fileRows: fileWithJordanBackOnWed14,
    live: liveAfterSwap,
    approvedChanges: [jordanKaiSwap],
    period,
  });
  expect(out.undoesSwaps).toHaveLength(1);
  expect(
    buildPublishPayload({ period, sourceName: "oct.xlsx", rows: out.rows, choices: {} }).assignments,
  ).toContainEqual(expect.objectContaining({ userId: KAI, startsAt: "2026-10-14T00:00:00.000Z" }));
});
it("puts a night over New Year on 31 Dec and in the period", () => {
  const payload = buildPublishPayload({
    period: { start: "2026-12-28", end: "2027-01-10" },
    rows: [nightFrom31Dec2130],
    sourceName: null,
    choices: {},
  });
  expect(payload.assignments[0].startsAt).toBe("2026-12-31T13:30:00.000Z");
});
it("refuses a period over 186 days before any request", () => {
  expect(() =>
    buildPublishPayload({
      period: { start: "2026-10-01", end: "2027-05-01" },
      rows: [],
      sourceName: null,
      choices: {},
    }),
  ).toThrow(/186/);
});
```

Route: a member (not manager) gets 403 before any write; the calls run in this order: `overview`, `role.set` only for changed matches, `codes.set` with the merged list, `assignments` reads in 62-day windows over the period, then `publish`; the alert event lists exactly the people whose shifts changed plus both parties of each cancelled swap (computed on the server from the live read and the payload, never from the client's list); the file name is the only file detail sent or stored. DOM: Publish is disabled while one row is unsorted; with G1 unavailable the tab shows the update line and no Publish button is enabled.

- [ ] **Step 2: Run, see FAIL.** `npx vitest run tests/roster-publish-match.test.ts tests/roster-publish-compare.test.ts tests/roster-publish-route.test.ts tests/roster-publish-flow.dom.test.tsx`.
- [ ] **Step 3: Implement.** Extract `CodeChooser` first and rerun `npx vitest run tests/roster-import-flow.dom.test.tsx` (must stay green). `compare.ts` reuses `rosterWindow` ideas from `src/lib/roster/shifts/diff.ts` but not `diffRoster`, which compares one doctor's shifts by day and title and cannot show "Kai → Priya". The route is the only caller of `publish` and `codes.set`; it calls `dispatchRosterAlerts` through `after()` with `{ action: { action: "publish" }, result: { changedUserIds, swapsCancelled } }`.
- [ ] **Step 4: Run** the four files plus `tests/roster-import-flow.dom.test.tsx` - PASS. Typecheck exit 0.
- [ ] **Step 5: Commit** by path: `git commit -m "feat(roster): publish a team roster from a file, keeping approved swaps"`.

---

### Task 8: Phone alerts (Lane D)

**Files:**

- Dependency: `npm install web-push` and `npm install -D @types/web-push` (deliberate dependency change, so `npm install`, not `npm ci`; commit `package.json` and `package-lock.json`)
- Modify: `public/sw.js` (add `push` and `notificationclick` listeners only; no cache change), `src/lib/env.ts` (optional `WEB_PUSH_PUBLIC_KEY`, `WEB_PUSH_PRIVATE_KEY`, `WEB_PUSH_SUBJECT`, all three or none), `.env.example` (three commented lines, no values), `src/lib/roster/settings.ts` (`alerts: { changes: boolean; requests: boolean }`, both default true), `src/components/roster/roster-settings-page.tsx`
- Create: `src/lib/roster/alerts/messages.ts`, `subscriptions.ts`, `send.ts`, `night.ts`; fill `dispatch.ts`
- Create: `src/app/api/roster/alerts/route.ts`, `src/app/api/roster/team/[serviceId]/remind/route.ts`, `src/components/roster/alerts/roster-alerts-section.tsx`
- Test: `tests/roster-alerts.test.ts`, `tests/roster-alerts-route.test.ts`, `tests/roster-alerts-section.dom.test.tsx` (Create); `tests/pwa-service-worker.test.ts` (new cases)

**Interfaces:**

- Consumes: `web_push_subscriptions (owner_id, endpoint unique, p256dh, auth, last_used_at)`, capped at 10 per owner by trigger (`roster_limit`); Task 1 reads; G3 `overview.managers` for manager recipients (without it, manager alerts are skipped and Manage still shows the items); the existing install prompt in `src/components/pwa-lifecycle.tsx` for the iPhone "add to home screen" hint.
- Produces: `ROSTER_ALERT_TYPES = ["changed", "request", "offer", "manage"]`. The only lock-screen texts, title "Roster": changed → "Your roster changed. Open Roster to see what moved."; request → "Something in Roster is waiting for you."; offer → "A shift is open in your team. Open Roster to see it."; manage → "Something in Manage is waiting for you." Click targets: `/roster`, `/roster/requests`, `/roster/requests`, `/roster/manage`. `GET /api/roster/alerts` → `{ configured: boolean, publicKey: string | null }`; `POST /api/roster/alerts` `{ endpoint, keys: { p256dh, auth } }`; `DELETE /api/roster/alerts` `{ endpoint }`. `POST /api/roster/team/[serviceId]/remind` `{}` → `{ reminded: number }` (manager only: reads `manage`, alerts `seen.notSeen` minus the actor with "changed"). `RosterAlertsSection` and `RosterAlertsSwitch` from `@/components/roster/alerts/roster-alerts-section`.

Who is alerted (the dispatch table; recipients are always ids the SQL returned or validated, and only active members; the actor is never alerted about their own action):

| Action and SQL result                     | Who                                                                           | Type    |
| ----------------------------------------- | ----------------------------------------------------------------------------- | ------- |
| `swap.create`                             | counterparty                                                                  | request |
| `swap.accept` → `accepted`                | the team's managers (G3)                                                      | manage  |
| `swap.accept` → `approved`                | requester                                                                     | changed |
| `swap.approve`                            | requester and counterparty                                                    | changed |
| `swap.decline`, `open.decline`            | requester / claimer                                                           | request |
| `swap.undo`                               | the other doctor                                                              | changed |
| `open.post` → `open`, `open.release`      | `openShiftCandidates` over a 15-day window around the shift, minus the poster | offer   |
| `open.report`                             | the team's managers (G3)                                                      | manage  |
| `open.claim` → `claimed`                  | managers (G3)                                                                 | manage  |
| `open.claim` → `approved`, `open.approve` | claimer and the shift's previous holder                                       | changed |
| `publish` (from Task 7)                   | people whose shifts changed, both parties of each cancelled swap              | changed |
| remind                                    | members who have not seen the latest roster                                   | changed |

- Recipients the SQL result does not name: `recipients.ts` looks them up with the service-role client by the action's row id **and** the event's `serviceId`, ids only: `roster_swaps.requester_id, counterparty_id` for swap actions; `roster_open_shifts.posted_by, claimed_by` for open-shift actions; for an open shift that became `approved`, the previous holder from its `roster_changes` row (`source = 'open_shift'`, `change->>'openShiftId'` = the id), `undo->'assignments'->0->>'userId'`, absent for a gap; for `open.decline`, the event's `before.claimedBy`. A result with status `cancelled` or `expired` alerts nobody.
- Rules: at most 500 recipients per event; each recipient's preferences, read with Release 1's `fetchRosterSettings(client, recipientId)`: `changes` gates "changed", `requests` gates the other three; **no request, offer or manage alert while the recipient is on a night shift now** (`isOnNightNow`: a live `night` assignment covering now in the event's team, from one `assignments` read per event with the event's actor, or an own `night` shift in `on_call_shifts` filtered by `owner_id`), while "changed" always goes; a 404 or 410 from the push service deletes that subscription; nothing about the recipient, endpoint or payload is logged, only counts. TTL 6 hours.
- If the three keys are not set, `configured` is false, the Settings section is hidden, and dispatch does nothing.

- [ ] **Step 1: Failing tests:**

```ts
it("sends only a type code, whatever the action", async () => {
  await dispatchRosterAlerts(admin, swapCreateEvent({ counterpartyId: "user-mei" }));
  expect(webpush.sendNotification).toHaveBeenCalledTimes(1);
  expect(webpush.sendNotification.mock.calls[0][1]).toBe(JSON.stringify({ t: "request" }));
});
it("holds a swap request during the counterparty's night shift but still says the roster changed", async () => {
  mockNightNow("user-mei");
  await dispatchRosterAlerts(admin, swapCreateEvent({ counterpartyId: "user-mei" }));
  expect(webpush.sendNotification).not.toHaveBeenCalled();
  await dispatchRosterAlerts(admin, swapApproveEvent({ requesterId: "user-mei", counterpartyId: "user-sam" }));
  expect(sentTo("user-mei")).toEqual([{ t: "changed" }]);
});
it("drops a subscription the push service says is gone, and logs nothing identifying", async () => {
  webpush.sendNotification.mockRejectedValueOnce(Object.assign(new Error("Gone"), { statusCode: 410 }));
  const log = vi.spyOn(console, "error");
  await dispatchRosterAlerts(admin, swapCreateEvent({ counterpartyId: "user-mei" }));
  expect(mocks.deleteSubscription).toHaveBeenCalledWith(expect.anything(), MEI_ENDPOINT);
  expect(JSON.stringify(log.mock.calls)).not.toMatch(/user-mei|push\.example/);
});
it("never alerts the person who acted", async () => {
  await dispatchRosterAlerts(admin, { ...swapApproveEvent({ requesterId: "user-alex" }), actorId: "user-alex" });
  expect(sentTo("user-alex")).toEqual([]);
});
```

Service worker (extend `tests/pwa-service-worker.test.ts` in its existing harness): a push with `{"t":"offer"}` shows exactly title "Roster" and the offer sentence; a push with no data or bad JSON shows the "changed" sentence (a push must always show a notification); `notificationclick` opens only a same-origin path from the fixed list, never a URL from the payload; `/api/roster/*` fetches are still not cached. Route: POST refuses an `http:` endpoint, an endpoint over 1,000 characters, and any endpoint whose host is not a browser push service (`fcm.googleapis.com`, `web.push.apple.com`, `updates.push.services.mozilla.com`, `*.notify.windows.com`), because the server posts to that address; `roster_limit` (the 10-per-owner trigger) is 409; a body `ownerId` is refused; DELETE deletes only the session owner's row. DOM: turning the switch on calls `Notification.requestPermission`, then `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })`, then POSTs; "denied" shows "Alerts are blocked on this phone. Turn them on in the phone's settings."; an iPhone not installed shows "On iPhone, add Roster to your home screen first."; no "Show the place on the lock screen" control exists.

- [ ] **Step 2: Run, see FAIL.** `npx vitest run tests/roster-alerts.test.ts tests/roster-alerts-route.test.ts tests/roster-alerts-section.dom.test.tsx tests/pwa-service-worker.test.ts`.
- [ ] **Step 3: Implement.** Settings gains, in order: "Alerts on this phone" (the switch; then "Roster changes" and "Swap and open-shift requests" switches), "Your team" (each team's name, "manager Dana" when G3 is live, "to Sun 29 Nov" when a rotation end is set, and a "Manage" row for managers). The shift reminder stays Release 1's calendar alarm; there is no push reminder and no background job. Subscribing when the endpoint already belongs to another account on a shared phone deletes that row first, so a phone alerts only whoever turned alerts on last. The `sw.js` release stamp changes automatically at build (`tests/service-worker-release-stamp.test.ts`), so no manual version bump.
- [ ] **Step 4: Run** the four files plus `tests/pwa-kill-switch.test.ts`, `tests/service-worker-release-stamp.test.ts`, `tests/roster-settings.dom.test.tsx` - PASS. `npm run check:installed-lock-parity` - PASS. Typecheck exit 0.
- [ ] **Step 5: Commit** by path, the dependency in its own commit first: `git add package.json package-lock.json && git commit -m "deps: add web-push for Roster phone alerts (server only)"`, then the rest: `git commit -m "feat(roster): phone alerts with generic lock-screen text and night-shift quiet"`.

---

### Task 9: Ask Roster, for doctors (Lane E)

**Files:**

- Create: `src/lib/roster/ask/dates.ts`, `parse.ts`, `answer.ts`, `handoff.ts`, `vocabulary.ts`
- Create: `src/components/roster/ask/roster-ask-box.tsx`, `roster-ask-answer.tsx`, `use-roster-ask-context.ts`
- Test: `tests/roster-ask-dates.test.ts`, `tests/roster-ask-parse.test.ts`, `tests/roster-ask-answer.test.ts`, `tests/roster-ask-box.dom.test.tsx` (Create)

**Interfaces:**

- Consumes: B1's `useRosterShifts` (`MyShift[]`); Task 1 reads `teams`, `overview`, `assignments` (window today − 7 to today + 54, 61 days), `requests`; `GET /api/roster/leave` (Lane B2); Release 1's `summariseHours`, `fortnightFor`, `perthDateOf`, `addDaysToDate`, `SHIFT_KIND_LABEL`; `WA_PUBLIC_HOLIDAYS`.
- Produces: `readDates(text, today) → { dates: DateSpan[] } | { ask: string; options: DateSpan[] } | { blocked: "past" | "weekday_mismatch" }`. `parseAsk(text, ctx) → AskResult` where `AskResult` is `{ kind: "question", q }` (`next_nights`, `next_weekend_off`, `next_day_off`, `on_date`, `who_on {grade?, date}`, `with_me {span}`, `hours_fortnight`, `next_leave`, `rotation_end`), `{ kind: "change", intent }` (`give_away {assignmentId}`, `cant_make {assignmentId}`, `swap {assignmentId, withUserId?}`, `dates {from, to, kind: "cant"|"prefer_off"}`, `leave {from, to}`), `{ kind: "clarify", ask, options }`, or `{ kind: "not_understood" }`. `answerQuestion(q, data) → { lines: string[], rows?: AskRow[], source: "From the roster published Fri 2 Oct 16:10" | "From your own shifts" }`. `askIntentHref(intent)` → `/roster/requests?start=…` with ids and dates only. `RosterAskBox()` from `@/components/roster/ask/roster-ask-box` (no props; hosts render it; B1 and B2 place it on Today, Team, Shifts and Requests).

Reading rules (from review-nl-edit §2 and §4):

- Dates are Perth dates, whatever the phone's time zone. No year → the nearest date on or after today. "3/4" is 3 April. A past date is refused ("That date has passed."). A weekday that doesn't match the date ("Tue 15 Oct") asks. "next Friday" offers both Fridays as buttons. A night belongs to the date it starts.
- Every word must be understood: known words are the fixed vocabulary in `vocabulary.ts` (question words, shift words from `SHIFT_KIND_LABEL` and the team's codes, grades and "reg", date words), names of people in the team window (first name or full name, exact, case-insensitive), and filler words. Any other word → `not_understood`, and the box says "Roster couldn't read that. Try 'When am I next on nights?' or tap a shift."
- "except", "not", "but", "only", "unless" and "instead" stop and ask: "Roster can't read 'except' yet. Tap the shifts instead."
- "because" ends the sentence: everything after it is dropped before reading, and the box shows "Reasons aren't saved."
- Two people with the same name → a chooser with initial and grade. Nothing is sent until the doctor taps the filled-in sheet on Requests.
- A doctor's sentence can only become one of the five requests above, about their own shifts. There is no manager wording in Release 2.

Screen contract: an in-flow box at the top of the page (`aria-label="Ask or change your roster"`, placeholder "Ask or change your roster", `autoComplete="off"`, `enterKeyHint="search"`, no microphone button), three suggestions under it when empty ("When am I next on nights?", "Am I on 14 Dec?", "Who's the reg Saturday?"), the answer as a grouped list with the source line, and for "next weekend off" the next four weekends underneath (design board "Ask Roster: questions"). A change shows a one-line reading ("Give away Tue 20 Oct night") and "Open" which navigates with `askIntentHref`; the input is cleared on navigation.

- [ ] **Step 1: Failing tests** (dates and parse files are run three times, see Step 4):

```ts
it("reads a date without a year as the next one, in Perth", () => {
  expect(readDates("14 Dec", "2026-12-20")).toEqual({ dates: [{ from: "2027-12-14", to: "2027-12-14" }] });
});
it("asks when the weekday and date disagree", () => {
  expect(readDates("Tue 15 Oct", "2026-10-01")).toMatchObject({ blocked: "weekday_mismatch" });
});
it("offers both Fridays for 'next Friday'", () => {
  expect(readDates("next Friday", "2026-10-15")).toMatchObject({
    options: [{ from: "2026-10-16" }, { from: "2026-10-23" }],
  });
});
it("stops on 'except' instead of dropping it", () => {
  expect(parseAsk("I can't work 12-16 Oct except the 14th", ctx)).toMatchObject({ kind: "clarify" });
});
it("turns 'I can't do Tue 20 night' into a give-away of that shift", () => {
  expect(parseAsk("I can't do Tue 20 night", ctx)).toEqual({
    kind: "change",
    intent: { kind: "give_away", assignmentId: NIGHT_20_OCT },
  });
});
it("asks which Sam", () => {
  expect(parseAsk("swap my Sat 31 Oct with Sam", ctxWithTwoSams)).toMatchObject({
    kind: "clarify",
    options: [{ label: "S. Example, registrar" }, { label: "S. Sample, resident" }],
  });
});
```

and the DOM test:

```tsx
it("keeps typed text on the phone", async () => {
  const setItem = vi.spyOn(Storage.prototype, "setItem");
  render(<RosterAskBox />);
  await userEvent.type(
    screen.getByRole("textbox", { name: "Ask or change your roster" }),
    "I can't do Tue 20 night because my partner is unwell{Enter}",
  );
  const sent = fetchCalls()
    .map((c) => `${c.url} ${c.body ?? ""}`)
    .join("\n");
  expect(sent).not.toMatch(/partner|unwell|can't do/i);
  expect(setItem).not.toHaveBeenCalled();
  expect(screen.getByText("Reasons aren't saved.")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Open" }));
  expect(mocks.routerPush).toHaveBeenCalledWith(`/roster/requests?start=give_away&assignment=${NIGHT_20_OCT}`);
});
it("has no microphone", () => {
  render(<RosterAskBox />);
  expect(screen.queryByRole("button", { name: /voice|microphone|dictate/i })).toBeNull();
});
```

- [ ] **Step 2: Run, see FAIL.** `npx vitest run tests/roster-ask-dates.test.ts tests/roster-ask-parse.test.ts tests/roster-ask-answer.test.ts tests/roster-ask-box.dom.test.tsx`.
- [ ] **Step 3: Implement.** Hand-written date reader (there is no date library in the project, and none is added). Answers reuse Release 1's summaries: next nights and next weekend off from `summariseToday`'s logic over `MyShift[]`, hours from `summariseHours` with the team's fortnight anchor.
- [ ] **Step 4: Run** under three time zones:

```bash
for tz in Australia/Perth UTC America/New_York; do
  TZ=$tz npx vitest run tests/roster-ask-dates.test.ts tests/roster-ask-parse.test.ts tests/roster-ask-answer.test.ts || exit 1
done
npx vitest run tests/roster-ask-box.dom.test.tsx
```

All PASS. `npx eslint src/lib/roster/ask src/components/roster/ask` - clean.

- [ ] **Step 5: Commit** by path: `git commit -m "feat(roster): Ask Roster answers questions and fills in requests, read on the phone"`.

---

### Task 11: Privacy and isolation tests (Lane F)

**Files:**

- Create: `scripts/lib/cross-tenant-roster-probe.ts`, `tests/cross-tenant-roster-probe.test.ts`, `tests/roster-no-ai.test.ts`, `tests/roster-session-actor.test.ts`, `tests/roster-team-device-storage.dom.test.tsx`
- Modify: `scripts/test-cross-tenant-staging.ts` (import and call the new probe after `probeOnCallContentIsolation`, register its disposable records for clean-up)

**Interfaces:**

- Consumes: the route paths from Tasks 1, 3, 5, 6, 7, 8 exactly as listed in their Produces blocks; the probe harness's `WriteProbeRequest` type and `register` pattern from `scripts/lib/cross-tenant-write-probe.ts`.
- Produces: `probeRosterIsolation({ request, tokenA, tokenB, serviceIdA, assignmentIdA, userIdB, inviteCodeForB, register })` returning `{ checkpoints: string[], skipped: string[] }`.

What the probe proves (staging only, synthetic "tenancyprobe" team, run only with Josh's OK):

1. User B, not a member: `GET /api/roster/team` does not list A's team; every `what` on A's team is 403 `roster_access_denied`; every action in `rosterActionSchema`, the invite, publish, export and remind routes, and a leave row naming A's team are 403, and nothing is written.
2. B joins through A's roster invite (the harness makes A a manager with `roster_set_manager` and marks the team `is_demo` with `on_call_service_set_verified`, both through the service-role client, both undone at clean-up): member reads work; `manage`, `people`, `publications`, export and remind are 403 `roster_role_denied`; B cannot `swap.approve` their own swap.
3. A removes B (`member.remove`): B's reads are 403 again, and B's pending swap is `cancelled` with `member_left`.

- [ ] **Step 1: Write the tests.** The probe test drives `probeRosterIsolation` with a fake `request` that answers like the real routes (copy the style of `tests/cross-tenant-write-probe.test.ts`) and checks that a 200 where a 403 is expected fails the probe with the route named. `roster-no-ai.test.ts` walks the import graph from every file under `src/lib/roster/`, `src/components/roster/`, `src/app/api/roster/` and `src/app/(search-app)/roster/`, resolving `@/` and relative imports (reuse an existing walker if `grep -rln "import graph\|collectImports" tests scripts/lib` finds one; else a resolver of about 40 lines), and fails if it reaches `src/lib/openai.ts`, the `openai` package, anything under `src/lib/rag/`, or `src/app/api/speech/`. `roster-session-actor.test.ts` is table-driven over every Roster route handler: a body or query with `actorId`, `ownerId`, `userId` (where not a target field) or `p_actor_id` is refused or ignored, and every `rpc` call's `p_actor_id` (or `owner_id` filter) equals the mocked session user. `roster-team-device-storage.dom.test.tsx` renders Team, Requests and Manage with fixtures and asserts `Storage.prototype.setItem` never receives a value matching `/Example|Mei|Sam|2026-1[01]|General Medicine/` and `caches.open` is never called.
- [ ] **Step 2: Run**: `npx vitest run tests/cross-tenant-roster-probe.test.ts tests/roster-no-ai.test.ts tests/roster-session-actor.test.ts tests/roster-team-device-storage.dom.test.tsx`. The last two fail until the lanes they cover have landed on the branch; that is expected, and Task 12 runs them again. `roster-no-ai` and the probe test must pass on their own.
- [ ] **Step 3: Commit** by path: `git commit -m "test(roster): cross-tenant probe, no-AI import check, session-actor and device-storage tests"`. The live probe (`npm run test:cross-tenant:staging`) is **not** run: it calls Supabase staging and needs Josh's typed OK.

---

### Task 12: Wire up, document and open the PR (last, alone)

**Files:**

- Modify: `src/app/api/roster/shifts/route.ts` (DELETE only). Delete my data now also: deletes my `web_push_subscriptions` and `roster_leave` rows (owner filter), and for each enabled team I'm in (a refusal from one team is skipped, never fatal to the delete), withdraws my pending swaps (`swap.cancel` on each `requests` swap where I'm the requester and it is `requested` or `accepted`; `swap.decline` where I'm the counterparty and it is `requested`), cancels open shifts I posted that are still `reported` or `open` (`open.cancel`), and clears my future dates-can't-work (`unavailability.set` with `clear`). My rostered shifts stay on the team roster, which belongs to the team and is kept 12 months. The Settings line becomes "Your shifts, requests, leave, alerts and settings. Your team's roster keeps your rostered shifts." (Lane D's file already merged; this one line is the only Settings edit here.)
- Modify: `scripts/lib/tenancy-scan.mjs` (`SCANNED_LIB_MODULES` += `src/lib/roster/leave.ts`, `src/lib/roster/alerts/subscriptions.ts`, `src/lib/roster/alerts/night.ts`, with one comment line each; one `SCOPE_EXEMPTIONS` entry, naming its test, for the shared-phone delete by `endpoint` in `subscriptions.ts`; `src/lib/roster/owner/teams.ts` (administrator-only platform read) and `src/lib/roster/alerts/recipients.ts` (ids by row id and team id) stay out, each with a comment saying why)
- Modify: `tests/design-system-adoption.test.ts` (page-count ratchet for `/roster/team`, `/roster/requests`, `/roster/manage`, `/roster/join` and the developer panel, with a dated comment like the ones above it), `tests/route-reachability.test.ts` only if it flags a route (Manage is linked from Today and Settings, Join from Today's empty state)
- Modify: `docs/codebase-index.md` (one Roster Release 2 line), `docs/site-map.md` (`npm run sitemap:update`), `docs/privacy-impact-assessment.md` (rows: team roster, swaps, open shifts, dates-can't-work, planned leave, seen receipts, web push subscriptions, alert texts, Ask Roster typed text never leaving the phone, owner panel reading one member's email on request, members' names visible to their own team)
- Test: `tests/roster-shifts.test.ts` (the DELETE cases)

- [ ] **Step 1:** Add the DELETE cases (subscriptions and leave deleted with the owner filter; one `swap.cancel` per pending swap I asked for; nothing deleted from `roster_assignments`; still nothing until the 30 seconds end, which Release 1's DOM test already pins). Run `npx vitest run tests/roster-shifts.test.ts tests/roster-settings.dom.test.tsx` - PASS.
- [ ] **Step 2:** `npm run check:owner-scope` and `npx vitest run tests/api-tenancy-predicates.test.ts` - PASS. `npm run check:organisation -- --files src/lib/roster/team/model.ts src/components/roster/manage/roster-manage-page.tsx` - personal-practice.
- [ ] **Step 3:** Whole-branch fast checks: `npm run lint`; `npm run typecheck`; `npx vitest run` on every test file this branch created or changed (list them with `git diff --name-only origin/claude/project-thread-yrumov-release-1...HEAD -- tests`), plus the three-zone Ask loop from Task 9; `npm run sitemap:update`; `npm run format`, then commit the formatting. `npm run plan:browser -- --files "$(git diff --name-only origin/claude/project-thread-yrumov-release-1...HEAD | paste -sd, -)"` (the planner takes one comma-separated list), then the same command with `--run` added, which runs only what it selected; report it as "focused browser proof, full suite left to CI". `npm run verify:phone-chrome` only if the planner selects a phone-chrome owner. `verify:cheap`, `verify:full` and `verify:ui` are left to CI and the PR says so.
- [ ] **Step 4:** One whole-branch adversarial review by a fresh reviewer on the strongest model, with the `personal-practice-reviewer`, `frontend-ui-reviewer` and `clinical-governance-reviewer` checklists and the six Review Focus items above. Fix findings in one commit.
- [ ] **Step 5:** Push once: `git push -u origin claude/project-thread-yrumov-release-2`. Open a **draft** PR with the repo template: title "Roster Release 2: Roster for a health service"; Before/After; "Merges only after #3117 (database), #3118 (Release 1) and #3115 (mode kit). Publishing a roster also needs the follow-up database change (G1) to be merged by Josh first."; "Phone alerts stay off until Josh sets the web push keys in Railway."; the checks run and the ones left to CI; no deferred-deploy wording. Subscribe to its activity. Send it to the merge lineup once CI is green and its dependencies have merged.

---

## One PR or two

**Recommendation: one PR.** Every team feature is dormant in production until Josh confirms a team in the owner panel, and no real staff data goes in before the privacy approval, so the team code carries little live risk. The only change that reaches every user of the app is about 40 lines of push handlers in `public/sw.js`, which leave caching untouched and are covered by the existing service-worker tests. Splitting would add a second review, a second CI run and a second merge without halving the risk. Fallback: if the whole-branch review finds the alerts work needs rework, Task 8's files are disjoint from everything else, so it can be cut into a second PR by moving its commits, without touching the rest.

## Needs a small follow-up database change

Found by reading the SQL against the screens. **Decided by the thread owner: none of this goes into PR #3117**, which is green, waiting on Josh, and stays exactly as it is. G1–G5 ship as **one new follow-up migration PR**, opened only after #3117 has merged, and **Josh merges it himself**: merging it changes the live database within seconds. Never arm auto-merge on it and never write deferred-deploy wording in it; its body says "Merge only inside Josh's approved window."

**Task G (strongest model; starts alongside Task 1; touches no app file):**

1. `git worktree add /home/claude/wt/roster-db-followup -b claude/project-thread-yrumov-db-followup origin/claude/project-thread-yrumov` (stacked on #3117 so it replays; never pushed to #3117's branch).
2. One new migration file, stamped at the current UTC time when the PR opens (step 4): `create or replace function public.roster_read` with the same signature (so grants stay), adding the `changes` (G1), `my_changes` (G2) and `team_leave` (G4) branches, `overview.managers` and the swap names (G3) and `overview.nextCutoffOn` (G5); `alter table public.roster_team_settings add column next_cutoff_on date`; `roster_set_cutoff` (G5) with execute revoked from public, anon and authenticated and granted to service_role. `team_leave` checks its own `from`/`to` (the l.639 check names only the four existing reads). No applied migration is edited, and `roster_command` is not replaced.
3. Update the companion files #3117 changed: `supabase/schema.sql`, `src/lib/supabase/database.types.ts` (its own commit, for Task 0 Step 2), `supabase/drift-manifest.json`, `supabase/applied-migration-hashes.json`, `tests/roster-db-contract.test.ts`, and one behaviour check per gap in `tests/sql/roster-behaviour.sql` (at least: a member gets `roster_role_denied` from `changes`, `team_leave` and `roster_set_cutoff`; `my_changes` returns only the actor's rows; a cut-off over 180 days ahead is refused). Run the local migration replay #3117 used and those tests. No provider call.
4. Commit by path. Once #3117 has merged: rebase onto `origin/main`, stamp the file, re-run step 3's checks, push, open the PR against `main`, and tell Josh it is his to merge.

- **G1. The `changes` read is reserved but not written (required for publishing).** `roster_read` validates dates for `p_what = 'changes'` (l.639) but has no branch for it, so it raises `roster_invalid_request`. Publishing needs it to protect approved swaps. Wanted: manager only; `{ swaps: [{ swapId, giveAssignmentId, takeAssignmentId, requesterId, counterpartyId, decidedAt, autoApproved }], openShifts: [{ openShiftId, assignmentId, claimedBy, decidedAt }] }` for swaps and open shifts with status `approved` whose live assignment starts (Perth date) between `from` and `to`. Without it: Publish stays disabled with "Publishing needs a small database update first."
- **G2. A doctor can't see what moved in a new roster.** `assignments` returns live rows only, so "Wed 14: Day to Evening" can't be shown. Wanted: `roster_read 'my_changes'` returning the actor's rows superseded by the latest publication (`superseded_at = latest.published_at`, which is exact because both use the publish transaction's `now()`) and their live rows from that publication. Without it: Today says "Your roster changed" and shows the new shifts, without the before-and-after list.
- **G3. Doctors can't see who their managers are.** `people` is manager-only, so "manager Dana" (Settings), "Waiting for Dana", and the server's list of whom to alert for `open.report`, a claimed open shift and a swap needing approval are all missing. Wanted: `overview.managers: [{ userId, name }]`, and `requesterName` and `counterpartyName` on each swap in `requests`. Without it: "Waiting for your manager", and managers see waiting items in Manage but get no phone alert.
- **G4. Managers can't see the team's planned leave.** `roster_leave` is an owner table and `roster_read` exposes only the anonymous `leave_overlap` count. Wanted: `roster_read 'team_leave'` (manager only, dates up to 62 days): `[{ userId, name, kind, startsOn, endsOn, status }]` for active members' leave on that team. Without it: Approve and Cover show no leave rows.
- **G5. No cut-off date for the next roster.** `roster_team_settings` has no field for it, and `rules` only accepts five fixed keys. Wanted: `roster_team_settings.next_cutoff_on date`, returned in `overview` as `nextCutoffOn`, set by a new function `roster_set_cutoff(p_actor_id, p_service_id, p_cutoff date)` (manager of a confirmed team; per-service lock 74817; null or a date from today to 180 days ahead; service_role only). A new function, so `roster_command` is not replaced. Without it: no cut-off line on Today and no cut-off field in team settings.
- **Not Roster's to change (noted for On Call):** a roster manager can create invites but cannot list or withdraw them (`invitation.revoke` and the invite list in `read` are admin-only in `on_call_service_command`, which only On Call's file may replace). Unused invites expire within 7 days, so Release 2 does not need this.

## Decisions this plan makes (defaults, each reversible)

1. **One PR** (above).
2. **Manage is not in the page menu.** The menu registry is the same for everyone, and non-managers must not see Manage. Managers reach it from a row on Today and on Settings.
3. **Invites are sent from the manager's own email app** (Copy, Share, or a pre-filled email). PsychSift sends no email, so there is no new email provider or sender to approve.
4. **The invite link carries its code after `#`**, which browsers never send to a server, and the join page removes it at once. A signed-out doctor is told to sign in and open the link again; the code is never stored.
5. **Lock-screen text is four fixed generic sentences.** The v8 mockup's examples ("Sam asked to swap a shift", "Tomorrow: Evening 14:00", "2 shifts") and its "Show the place on the lock screen" switch break the fixed rule and are not built.
6. **No push reminders and no background jobs.** The evening-before shift reminder stays Release 1's calendar alarm. Auto-approved swaps reach the manager through the Auto-approved figure on Manage, not a phone alert.
7. **Ask Roster reads sentences on the phone**, so typed text never reaches the server at all. It is on Today, Shifts, Team and Requests. Nothing counts "didn't understand" events in Release 2.
8. **Export is Excel only**, set to print on one landscape A4 page. No PDF generator is added.
9. **The rotation line's "then ED"** is worked out from the doctor's other confirmed team, not stored.
10. **Team shifts join a doctor's own shifts on screen and in the calendar feed** without being copied into their own shifts table.
11. **Delete my data** removes the doctor's own records and withdraws their pending requests, but not their shifts on the team roster, which is the team's record (12 months).
12. **Leave overlap is shown only for leave of 62 days or less** (the read's limit).
13. **Publishing uses full publications only.** Single-change publishing is Release 3.

## Self-review

- **Outline coverage:** 1 team client and API (Task 1); 2 owner panel (Task 2); 3 invites and join (Task 3); 4 Team page (Task 4); 5 Requests with swap tickets, recheck time, Accept/Decline, 10-minute undo, give-away, can't make it, dates, leave with overlap (Task 5); 6 Approve and Cover with the three figures, reasons in words, two-week strip, Post a gap, Remind (Task 6); 7 publish with upload, remembered matches, swaps the file would undo, per-person preview, all-or-nothing, personal alerts (Task 7); 8 phone alerts (Task 8); 9 Ask Roster (Task 9); 10 rotations, holidays, cut-off and pay fortnight (Tasks 4 and 5), fairness and export (Task 6); 11 privacy and isolation (Task 11).
- **Names checked against the SQL:** reads `teams`, `overview`, `assignments`, `requests`, `unavailability`, `leave_overlap`, `manage`, `people`, `publications`, `maker`; actions `role.set`, `member.remove`, `settings.set`, `unavailability.set`, `publish`, `swap.create|accept|approve|decline|cancel|undo`, `open.post|report|claim|approve|decline|cancel|release`, `seen.mark`, `codes.set`; platform `roster_set_manager`, `on_call_service_set_verified`; On Call `invitation.create` with `issuedViaMode`, `join` with `actorEmail`; every error code in the Task 1 map. Release 3 reads and actions are refused by the general route.
- **Fixed rules:** mode-kit only; tokens; 48 px; weight 400; 24-hour; nothing on the device (Task 11 test); no AI (Task 11 import walk); typed text never stored (Task 9 test); generic lock screen (Task 8 tests); synthetic data only; session actor only (Task 11 table test); bucket `roster`; keys set by Josh, steps below, no values anywhere.
- **Placeholders:** none. The two "if one exists" notes point at a grep, not a guess.
- **Not checked:** how On Call's `withServiceApi` behaves with `after()` in this Next.js version (the lane reads `node_modules/next/dist/docs/` first); the exact `web-push` version (the lane installs the current stable one); whether `tests/route-reachability.test.ts` counts a link inside a component as an inbound link (Task 12 checks).

## What only Josh can do

1. **Merge the database PR #3117** in his window (already on his list). Release 2 cannot merge before it.
2. **Merge the follow-up database PR (G1 to G5)** in his window. It is a separate PR, opened only after #3117 has merged, and only Josh merges it; it should land before Release 2 goes to the merge lineup. Without G1 managers cannot publish; the others degrade as listed.
3. **Set the phone-alert keys in Railway.** Phone alerts stay off until this is done; nothing else depends on it.
   1. On your own computer, open a terminal (not the chat) and run exactly:
      ```bash
      npx web-push generate-vapid-keys
      ```
      It prints a "Public Key" and a "Private Key". It runs on your computer and contacts nothing except the npm registry to download the tool.
   2. Open railway.com, project **Database**, the **production** environment, service **Database** (the app, not `worker`), then **Variables**.
   3. Add three variables: `WEB_PUSH_PUBLIC_KEY` = the Public Key; `WEB_PUSH_PRIVATE_KEY` = the Private Key; `WEB_PUSH_SUBJECT` = `mailto:` followed by your email address.
   4. Press **Deploy** when Railway offers to apply the changes. The app restarts with alerts available.
   5. Never paste the private key into the chat, a file in the repo, or a PR. If it ever leaks, make a new pair and replace both variables; phones that had alerts on then need to turn them on again.
   6. Optional: the same in the **staging** environment (service `app`) with a separate pair, if you want to try alerts there first.
4. **Confirm the first team and name its roster manager** in the developer hub: sign in as the administrator (the passwordless link opens the page but cannot press the buttons), open Roster teams, press Confirm team, then Make roster manager on the right person. Only do this for a real team after step 6.
5. **Say yes to the staging isolation proof** (P1 #F9HZEG): `npm run test:cross-tenant:staging`, run in a terminal with staging credentials. It touches Supabase staging, so it needs your typed OK.
6. **Before real staff use it:** the health service's privacy approval, the isolation proof above, and a decision on the app servers being in Singapore while the database is in Sydney.
