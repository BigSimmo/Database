# Roster build brief (for the build thread)

Written 26 Sep 2026 by the "Plan Roster mode" thread. That thread stays for design questions only; the build runs from this brief.

## Start only when

Josh said at 19:24Z to start the build automatically once the plan is written and reviewed, with no approval step. Execution: parallel subagent lanes (lighter models for routine lanes), one review per lane and one whole-branch review.

## Read, in order

1. `build-plan/00-overview.md`: steps, default decisions, Josh-only actions, risks.
2. `build-plan/plan-a-database.md`: the one combined database PR (Roster owns it). SQL is in `build-plan/sql/`, replayed with 14 behaviour checks.
3. `build-plan/plan-b-release-1.md`: Release 1 app work. Tested code in `build-plan/code/` (copy, don't rewrite).
4. Only when a screen detail is unclear: `plan-v8.html` (approved design) and `answers.txt`.

## Binding rules

- Repo is PUBLIC: invented data only ("Example Hospital"); no patient data; nothing private pushed without Josh's OK.
- Plan A touches `supabase/migrations/`: merging deploys to the live database within seconds. **Josh merges it himself.** Never merge it, never arm auto-merge, never write "awaiting deploy" style wording. Release 1 merges only after Plan A.
- No provider calls (Supabase, OpenAI, Railway) without Josh's typed OK. GitHub through the MCP tools only.
- Nothing about shifts stored on the device. No AI in Roster. Uploaded files never stored or logged; calendar links never logged.
- Shared UI kit is PR #3115: import only from `@/components/mode-kit/*` (export list in plan-b Task 4). Stacking on #3115 is fine; Roster's PR waits for it to land.
- Design standard v13.2 (`/mnt/project-files/design/mode-design-standard.md`); shared UI from `src/components/mode-kit/` (On Call's PR), never copied.
- Efficiency (Josh 19:11Z, standing): lighter models for routine steps, tight briefs, one review per lane plus one whole-branch review, fast local checks only, one push per milestone, replies only when Josh must act or it is done.
- Stage by path, never `git add -A`; `npm run format` and commit it before each push.

## Current state (26 Sep 19:45Z)

- Plan written and independently reviewed once; all 12 findings fixed (listed at the end of plan-b). No further review rounds before building.

- No app code written; branch `claude/project-thread-lm3749` equals origin/main 67d961107.
- Plan A depends on two other threads: On Call's file 2 must let Roster and Teaching managers create invites (`issuedViaMode`, asked via the coordinator 19:10Z), and Teaching must hand over `teaching_mode.sql`. Plan A Task 0 checks both and stops if either is missing.
- Teaching's `teaching_mode.sql` is ready (`/mnt/project-files/teaching-mode/`, replayed by Teaching with files 1-4 and Roster's behaviour checks), but Teaching asked (19:15Z) that it stays out of anything Josh is asked to merge until he approves Teaching's build plan. Plan A ships files 1-4 without it if that approval hasn't come; Teaching's file then goes in its own later DB PR.
- On Call's file 2 (19:15Z version) replayed clean with files 1, 3, 4 and the 14 behaviour checks (19:35Z).
- Admin's `admin_mode.sql` is ready (`/mnt/project-files/admin-mode/`).

## Next steps

1. Plan A (one thread, alone): Tasks 0-7, draft PR, tell Josh it is ready for him to merge in his window.
2. Plan B in parallel with Plan A: Task 1 alone, then Tasks 2-5 as parallel lanes, then Task 6. Draft PR; send it to the merge lineup thread once CI is green and Plan A is merged.
3. Write Release 2's full plan while Release 1 is in review (outline in the overview).

## Release 2 build (added 27 Sep 2026 01:30Z by the Roster build thread)

- Plan: `build-plan/plan-c-release-2.md`, written and reviewed once (26 fixes applied). No more review rounds before building; start at its Task 0.
- State at hand-off: DB PR #3117 green and waiting for Josh to merge. Release 1 app PR #3118 (branch `claude/project-thread-yrumov-release-1`, head 9fe3f586d) had its review fixes pushed and CI running. The Roster build thread keeps driving #3117 and #3118 to merge; the Release 2 thread does not touch either branch.
- Branch per plan-c Task 0: `claude/project-thread-yrumov-release-2`, stacked on Release 1 (or from main once #3118 merges). Open it as a draft PR.
- DB gaps G1-G5 go in a separate follow-up migration PR (Task G), which opens only after #3117 merges. Josh merges it himself. Nothing is added to #3117.
- All the binding rules above still apply. Josh-only: VAPID/phone-alert keys in Railway, confirming the first team, the staging isolation proof, and privacy approval before any real staff data.
