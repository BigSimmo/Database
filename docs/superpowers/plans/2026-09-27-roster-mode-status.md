# Roster mode: where the build stands and the plan to complete it

Roster is a phone-first mode where hospital doctors across WA Health keep their own shifts (Release 1), share a team roster with swaps and requests (Release 2), and roster managers build rosters (Release 3). The design (v8, approved 26 Sep 2026) is summarised in `2026-09-27-roster-mode-screens.png`. All test data is invented ("Example Hospital", made-up names).

## Files here

| File                                         | What it is                                                                                                |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `2026-09-27-roster-mode-overview.md`         | Steps, default decisions, what only the owner can do, risks, Release 2 and 3 outlines                     |
| `2026-09-27-roster-mode-db-agreement.md`     | The agreement between the Roster, On Call, Admin and Teaching threads on the one combined database change |
| `2026-09-27-roster-mode-plan-a-database.md`  | Build plan for the combined database PR                                                                   |
| `2026-09-27-roster-mode-plan-b-release-1.md` | Build plan for Release 1 (Roster for one doctor), with what the review changed                            |
| `2026-09-27-roster-mode-plan-c-release-2.md` | Build plan for Release 2 (Roster for a health service)                                                    |
| `2026-09-27-roster-mode-build-brief.md`      | The short brief the build threads work from                                                               |
| `2026-09-27-roster-mode-screens.png`         | The approved screens                                                                                      |

Paths under `/mnt/project-files/` in these files are the project's shared working folder, not part of the repository.

## Where it stands (27 Sep 2026, 05:14Z)

| Step                        | State                                                                                   | Next                                                                                                                                                   |
| --------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A. Database change          | PR #3117 merged                                                                         | Confirm the post-merge `live-drift` result includes green `check:drift` and `check:migration-history`; this status file does not establish that result |
| B. Release 1 app            | PR #3118 merged after #3117                                                             | Its finished code is the base for Release 2                                                                                                            |
| C. Release 2                | Draft PR #3126 is in progress. The plan is `2026-09-27-roster-mode-plan-c-release-2.md` | Finish the app and its checks. A separate database follow-up is needed for the missing reads and guarded publishing; Josh merges that migration PR     |
| D. Release 3 (roster maker) | Outline in `2026-09-27-roster-mode-overview.md`                                         | Full plan written while Release 2 is in review                                                                                                         |

## Plan to complete

1. Confirm #3117's post-merge `live-drift` workflow shows both `check:drift` and `check:migration-history` green. This is a separate production check, not proved by #3117's merge or local replay.
2. Continue the existing #3126 Release 2 build and the separate follow-up database work. Do not recreate either from the old branch-setup steps in Plan C.
3. Before enabling Publish, the follow-up migration must provide G1's approved-change read **and** G6's guarded, atomic publish operation. A swap approved after the manager's preview must cause a conflict with no publication or partial name/code changes. The merged #3117 function does not enforce that condition.
4. Josh approved named planned leave for roster managers on 27 Sep 2026. Record its exact fields, purpose and audience in the privacy assessment; keep ordinary members on the anonymous count and prove the boundary in staging before real staff use.
5. Have Josh merge the follow-up migration inside an approved window, then verify its post-merge drift checks. Finish #3126's local, hosted and privacy checks before considering its merge. Write and build Release 3 from the outline.

Before real staff data is used: the health service's privacy approval, the two-user isolation proof (P1 #F9HZEG) and a decision on the Singapore app servers. Phone alerts in Release 2 need the owner to set the alert key pair in Railway.
