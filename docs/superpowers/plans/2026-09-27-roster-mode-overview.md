# Roster mode build plan: overview

Written 26 Sep 2026 against `origin/main` 67d961107, after Josh approved design v8 (18:44Z). This is the original planning snapshot. PRs #3115, #3117 and #3118 have since merged, and Release 2 is in draft PR #3126. Use the [status file](2026-09-27-roster-mode-status.md) for current work and the full [Release 2 plan](2026-09-27-roster-mode-plan-c-release-2.md) for its remaining steps.

## What gets built, in order

| Step | What                                                                                                  | Who merges                                                            | Plan                                                          |
| ---- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------- |
| A    | One database change: shared team-system hardening, On Call's items, Roster, Admin and Teaching tables | **Josh, himself** (it changes the live database the moment it merges) | `plan-a-database.md` (full, SQL written and replayed)         |
| B    | Release 1: Roster for one doctor                                                                      | The merge lineup                                                      | `plan-b-release-1.md` (full)                                  |
| C    | Release 2: Roster for a health service                                                                | The merge lineup                                                      | `2026-09-27-roster-mode-plan-c-release-2.md`                  |
| D    | Release 3: the roster maker                                                                           | The merge lineup                                                      | Outline below; full plan written while Release 2 is in review |

Release 1 merged after the database change. Release 2 has its own full plan; Release 3 still has the outline below.

## Efficiency

Josh asked (19:06Z, 19:11Z, 19:20Z) for a faster, cheaper build with no loss of quality. What changed: the hardest logic for both steps is already written and tested (Plan A's SQL replayed with 14 behaviour checks; Release 1's readers, hours, Today and calendar-link code in `code/`, 34 tests), so the build copies it instead of re-deriving it. Release 1 runs as four parallel lanes with no shared files, one review per lane and one whole-branch review, fast local checks only, one push. The build runs in a fresh thread from `../build-brief.md`, so it doesn't re-read this thread's long history. Cut: a separate Hours page, a phone-side Excel/PDF reader, a new calendar grid and a new reminder system (all reuse what exists).

## Decisions this plan makes (defaults, each reversible)

1. **Swap approval default.** Clean swaps between doctors of the same grade, more than 7 days away and inside the team's rules, approve themselves and the manager is told (Josh, round 6). The design's onboarding line "Default: manager approves" is older and is superseded.
2. **Managers are named by Josh's confirm button**, never by another manager, as the design says ("You confirm each team and its managers"). A second manager (co-manager) is named the same way.
3. **Managers can remove an ordinary member** who leaves the team. Because a Roster team is the shared service, this also removes them from that service in On Call and Teaching. Editors and admins are removed in On Call only.
4. **Calendar links refresh when the doctor opens Roster** and the link is older than 6 hours, plus a Refresh button. No background job.
5. **Retention.** Team rosters, swaps, open shifts and the change history: 12 months. Printed names of people not on the app: cleared 90 days after the shift. Dates people can't work: 30 days after the date. Planned leave: 12 months after it ends. Membership history: 12 months.
6. **Release 3's database functions are included now** (drafts with undo, shift codes, staffing needs, agreements). If building Release 2 or 3 shows a function needs changing, that is a small second database change, which Josh would merge the same way.
7. **PDF import reads text PDFs only.** A scanned PDF says "can't read this, try the Excel version". Reading scans with AI stays off until a health service consents, as decided.
8. **Nothing is stored on the phone.** No offline copy of shifts, per Josh's offline rule.

## What only Josh can do, and when

- Plan approval and the Plan A merge are historical steps already completed.
- Merge the follow-up Release 2 database change in an approved window, after reviewing its guarded publishing and privacy scope.
- For Release 2: set the phone-alert key pair in Railway (two values; the thread will give exact steps, never the values themselves), and press "verify" for the first team and "make manager" for its roster manager in the owner panel.
- Before real staff use it: the health service's privacy approval, P1 #F9HZEG (two-user isolation proof, run against staging with his OK), and a decision on Singapore app servers.

## Release 2 outline: Roster for a health service

Built on `roster_read` / `roster_command` from Plan A. Tasks, each with its own tests:

1. **Team client and API.** `src/lib/roster/team/` (zod models for every read and action, error-code mapping) and `src/app/api/roster/team/[serviceId]/route.ts` (GET reads, POST actions; session actor only; rate-limit bucket `roster`). DOM-free unit tests with a mocked `rpc`.
2. **Owner panel buttons.** Verify a team, name or remove a manager (`on_call_service_set_verified`, `roster_set_manager`), Josh-only.
3. **Invites by email.** Manager invites as member through On Call's command with `issuedViaMode: 'roster'`; join page shows "You're in General Medicine".
4. **Team page.** Everyone / With me, grouped by grade, 24-hour timeline, now line, day picker; links to On call for phone numbers.
5. **Requests page.** Swap preview tickets with fresh recheck time, Accept / Decline, 10-minute undo, give-away (open shift), "I can't make my shift", dates I can't work, planned leave with "2 of the team are already off".
6. **Manage: Approve and Cover.** Waiting / Auto-approved / Seen tiles, one list with the reason each item needs the manager, two-week cover strip, Post a gap, Remind those who haven't seen.
7. **Manage: Roster (publish).** Upload PDF/Excel/link, match rows to people (remembered via `roster_name`), settle swaps the file would undo, preview per person, publish all-or-nothing, personal change alerts.
8. **Phone alerts.** Web push (service worker, `web_push_subscriptions`), generic lock-screen text only, no swap alerts during a night shift except "your shift was changed". Needs Josh's key pair in Railway.
9. **Ask Roster (doctors).** Roster's own box, no microphone, fixed question and change types parsed by the app itself; changes become requests, never edits; typed text never stored.
10. **Rotations, fairness view, export with swaps, public holidays, cut-off reminder.**
11. **Privacy and isolation tests.** A second-user leak test for every team read and action (extends the cross-tenant probes), and a test that no Roster code path can reach the OpenAI client.

## Release 3 outline: the roster maker

1. Laptop grid (people by days) over `draft.open` / `draft.change`, with Recent changes and per-change Undo (`draft.undo`).
2. Manager's change box: typed changes read by the app into `draft.change` ops, stops and asks on "except", "not", two people with one name, relative dates; tested under other time zones.
3. "Upload to update": a new file compared with the live roster including swaps and typed changes.
4. Team shift codes and staffing needs; gaps show themselves.
5. Optional starter rules (AMA WA checklist 2025, shown as "the team's rules" with source and date); suggested cover ranked by who is free and fits.
6. Single-change publishing; agreement record for changes after publishing; co-managers; payroll and noticeboard export.
7. AI helper for sentences the app can't read: off until a health service consents; names replaced by stand-ins, unknown words blanked; output limited to the fixed change types; spend flagged to Josh.

## Risks worth knowing

- **One large database change.** It touches the shared team tables that On Call already uses live. It was replayed locally with 14 behaviour checks, and is replayed again from scratch before the PR opens; CI replays it a third time.
- **Two other threads' files ride in it.** On Call must first make its invite step accept Roster and Teaching managers (asked 19:10Z), and Teaching must hand over its final file.
- **Real staff data.** Not before the privacy approval, the isolation proof and the Singapore decision.
