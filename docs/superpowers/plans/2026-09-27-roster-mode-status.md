# Roster mode: where the build stands and the plan to complete it

Roster is a phone-first mode where hospital doctors across WA Health keep their own shifts (Release 1), share a team roster with swaps and requests (Release 2), and roster managers build rosters (Release 3). The design (v8, approved 26 Sep 2026) is summarised in `2026-09-27-roster-mode-screens.png`. All test data is invented ("Example Hospital", made-up names).

## Files here

| File | What it is |
|---|---|
| `2026-09-27-roster-mode-overview.md` | Steps, default decisions, what only the owner can do, risks, Release 2 and 3 outlines |
| `2026-09-27-roster-mode-db-agreement.md` | The agreement between the Roster, On Call, Admin and Teaching threads on the one combined database change |
| `2026-09-27-roster-mode-plan-a-database.md` | Build plan for the combined database PR |
| `2026-09-27-roster-mode-plan-b-release-1.md` | Build plan for Release 1 (Roster for one doctor), with what the review changed |
| `2026-09-27-roster-mode-plan-c-release-2.md` | Build plan for Release 2 (Roster for a health service) |
| `2026-09-27-roster-mode-build-brief.md` | The short brief the build threads work from |
| `2026-09-27-roster-mode-screens.png` | The approved screens |

Paths under `/mnt/project-files/` in these files are the project's shared working folder, not part of the repository.

## Where it stands (27 Sep 2026, 02:45Z)

| Step | State | Next |
|---|---|---|
| A. Database change | PR #3117 open, CI was green on 1ff5de84f; now has a merge conflict with main | The build thread resolves the conflict and re-runs CI. **The owner merges it himself**: merging applies the migrations to the live database within seconds |
| B. Release 1 app | PR #3118 open, behind main | Merges only after #3117; then the merge lineup lands it once CI is green |
| C. Release 2 | Plan written and reviewed once (`2026-09-27-roster-mode-plan-c-release-2.md`); building on `claude/project-thread-yrumov-release-2` | Its database gaps go in a separate follow-up database PR after #3117 merges, merged by the owner |
| D. Release 3 (roster maker) | Outline in `2026-09-27-roster-mode-overview.md` | Full plan written while Release 2 is in review |

## Plan to complete

1. Resolve #3117's conflict with main, re-run its CI, and re-date its migrations if main has a newer one (`2026-09-27-roster-mode-plan-a-database.md`, Task 5 Step 0).
2. The owner merges #3117 in his window. After merge, the `live-drift` workflow must show `check:drift` and `check:migration-history` green.
3. Bring #3118 up to date with main and let CI finish; the merge lineup merges it.
4. Finish Release 2 per `2026-09-27-roster-mode-plan-c-release-2.md`; open its follow-up database PR only after #3117 has merged.
5. Write and build Release 3 from the outline.

Before real staff data is used: the health service's privacy approval, the two-user isolation proof (P1 #F9HZEG) and a decision on the Singapore app servers. Phone alerts in Release 2 need the owner to set the alert key pair in Railway.
