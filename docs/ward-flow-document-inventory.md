# Every Ward Flow document, and which branch carries it

**Generated mechanically from git, 2026-08-30 — regenerated after the Verifier branch was folded
and the safety checklist was written. ⚠️ The previous version said 125 documents across FIVE
branches and named a session by a name the owner had already changed. There are SIX branches.**

**137 distinct ward documents across 6 branches.** ⚠️ **Re-measured 2026-08-31 before the fold; was 130 on 08-30.**

```
git show <BRANCH>:<path>
git ls-tree -r --name-only <BRANCH> -- docs/ | grep -i ward
```

| Key | Branch | Tip | Docs | Held by |
| --- | --- | --- | --- | --- |
| `ORCH` | `claude/Wardquestions` | `dc4793ce4` | 102 | **Ward Orchestrator** — process, plan, rules, safety |
| `DEC` | `claude/Ward-design` | `b78a1fa0d` | 90 | **Ward Decisions** — the register of record + every spec |
| `MAIN` | `claude/ward-flow-phases-6-7-design` | `9daa1e419` | 113 | **Ward Core** — the working line |
| `BOARD` | `claude/ward-flow-print-fixes` | `51f53c26c` | 113 | **Ward Board** — the board and the printed sheet |
| `WAVE1` | `claude/ward-flow-wave1-referral-corrections` | `3d0f99a74` | 113 | **Ward Referrals** — the referral surface |
| `VER` | `claude/ward-flow-setup-967aa0-wf` | `0db2ea527` | 113 | **Ward Verifier** — audit + the test wrapper |

---

## ⚠️ The 24 documents on ONE branch only — re-measured 2026-08-31 (was 16)

⚠️ **11 on `Ward-design`, 13 on `Wardquestions`. ALL 24 are in the fold manifest's copy list**
(`docs/ward-flow-fold-manifest-2026-08-31.md`), which is itself one of the 24.
✅ **Nine of Ward-design's eleven are DESIGN SPECS that exist nowhere else, including the community
hub — which has a written specification and no code.**

### The list as it stood on 08-30

**These cannot be read from the working line. They go with their branch, and if that worktree is
lost they are recoverable only from the backup.** ⚠️ **A worktree on this machine has been deleted
mid-session twice.**

| Branch | Document |
| --- | --- |
| `DEC` | `docs/superpowers/specs/2026-08-30-ward-flow-community-hub-design.md` |
| `DEC` | `docs/superpowers/specs/2026-08-30-ward-flow-coordinator-hub-design.md` |
| `DEC` | `docs/superpowers/specs/2026-08-30-ward-flow-ed-psychiatry-hub-design.md` |
| `DEC` | `docs/superpowers/specs/2026-08-30-ward-flow-transport-design.md` |
| `DEC` | `docs/ward-flow-clinician-check-method.md` |
| `DEC` | `docs/ward-flow-fold-conflict-2026-08-29.md` |
| `ORCH` | `docs/ward-flow-custody.md` |
| `ORCH` | `docs/ward-flow-document-inventory.md` |
| `ORCH` | `docs/ward-flow-hubs-and-patient-plan.md` |
| `ORCH` | `docs/ward-flow-orchestrator.md` |
| `ORCH` | `docs/ward-flow-process-review-prompt.md` |
| `ORCH` | `docs/ward-flow-provisional-values.md` |
| `ORCH` | `docs/ward-flow-remaining-work.md` |
| `ORCH` | `docs/ward-flow-reporting-rule.md` |
| `ORCH` | `docs/ward-flow-safety-checklist.md` |
| `ORCH` | `docs/ward-flow-task-ledger.md` |

> ⚠️ **The four design specs three sessions are building FROM are all in this table, all on
> `DEC` — the branch that is 200+ commits ahead of the working line and NEVER FOLDS.** The backup
> copies every such file out by name and **fails rather than skipping** if one cannot be read;
> **that is a recovery route, not a second working copy.**

## The 82 documents present on ALL 6 branches

**These are the shared inheritance — anything here can be cited from any session and will resolve.**

- `docs/forward-codify-retrieval-rpcs-workorder.md`
- `docs/superpowers/plans/2026-08-14-ward-management-mockups.md`
- `docs/superpowers/plans/2026-08-18-ward-flow-model-and-modes.md`
- `docs/superpowers/plans/2026-08-18-ward-flow-phase-1-model.md`
- `docs/superpowers/plans/2026-08-18-ward-flow-phase-2-coordinator-screen.md`
- `docs/superpowers/plans/2026-08-19-ward-flow-phase-3-role-screens.md`
- `docs/superpowers/plans/2026-08-25-ward-flow-phase-4-specialist-boards.md`
- `docs/superpowers/plans/2026-08-25-ward-flow-sandbox-and-design-repair.md`
- `docs/superpowers/plans/2026-08-25-ward-flow-standalone-and-nav-repair.md`
- `docs/superpowers/plans/2026-08-26-ward-flow-phase-5-bed-availability.md`
- `docs/superpowers/plans/2026-08-26-ward-flow-sidebar-house-pattern.md`
- `docs/superpowers/specs/2026-08-14-ward-management-design.md`
- `docs/superpowers/specs/2026-08-18-ward-flow-metro-patient-flow-design.md`
- `docs/superpowers/specs/2026-08-19-ward-flow-phase-3-role-screens-design.md`
- `docs/superpowers/specs/2026-08-25-ward-flow-phase-4-specialist-boards-design.md`
- `docs/superpowers/specs/2026-08-26-ward-flow-phase-5-bed-availability-design.md`
- `docs/ward-flow-clinician-check.md`
- `docs/ward-flow-complete-ledger.md`
- `docs/ward-flow-context.md`
- `docs/ward-flow-phase-2-kickoff.md`
- `docs/ward-flow-phase-3-handover.md`
- `docs/ward-flow-phase-3-ledger.md`
- `docs/ward-flow-phase-3-rulings.md`
- `docs/ward-flow-phase-3-workspace/README.md`
- `docs/ward-flow-phase-3-workspace/clinical-changes-report.md`
- `docs/ward-flow-phase-3-workspace/concurrent-session-inventory.md`
- `docs/ward-flow-phase-3-workspace/flow-diagram-fix-brief.md`
- `docs/ward-flow-phase-3-workspace/flow-diagram-fix-report.md`
- `docs/ward-flow-phase-3-workspace/handover-stage-coherence-report.md`
- `docs/ward-flow-phase-3-workspace/preflight-tasks-9-to-12.md`
- `docs/ward-flow-phase-3-workspace/progress.md`
- `docs/ward-flow-phase-3-workspace/task-1-brief.md`
- `docs/ward-flow-phase-3-workspace/task-1-report.md`
- `docs/ward-flow-phase-3-workspace/task-1-review.md`
- `docs/ward-flow-phase-3-workspace/task-10-brief.md`
- `docs/ward-flow-phase-3-workspace/task-10-report.md`
- `docs/ward-flow-phase-3-workspace/task-11-brief.md`
- `docs/ward-flow-phase-3-workspace/task-11-report.md`
- `docs/ward-flow-phase-3-workspace/task-12-addendum.md`
- `docs/ward-flow-phase-3-workspace/task-12-brief.md`
- `docs/ward-flow-phase-3-workspace/task-12-journey-design.md`
- `docs/ward-flow-phase-3-workspace/task-2-brief.md`
- `docs/ward-flow-phase-3-workspace/task-2-report.md`
- `docs/ward-flow-phase-3-workspace/task-2-review.md`
- `docs/ward-flow-phase-3-workspace/task-3-brief.md`
- `docs/ward-flow-phase-3-workspace/task-3-report.md`
- `docs/ward-flow-phase-3-workspace/task-3-review.md`
- `docs/ward-flow-phase-3-workspace/task-4-brief.md`
- `docs/ward-flow-phase-3-workspace/task-4-report.md`
- `docs/ward-flow-phase-3-workspace/task-4-review.md`
- `docs/ward-flow-phase-3-workspace/task-5-brief.md`
- `docs/ward-flow-phase-3-workspace/task-5-report.md`
- `docs/ward-flow-phase-3-workspace/task-5-review.md`
- `docs/ward-flow-phase-3-workspace/task-6-brief.md`
- `docs/ward-flow-phase-3-workspace/task-6-fix-round-3-findings.md`
- `docs/ward-flow-phase-3-workspace/task-6-re-review-rounds-3-4.md`
- `docs/ward-flow-phase-3-workspace/task-6-report.md`
- `docs/ward-flow-phase-3-workspace/task-6-review.md`
- `docs/ward-flow-phase-3-workspace/task-6a-brief.md`
- `docs/ward-flow-phase-3-workspace/task-6a-re-review.md`
- `docs/ward-flow-phase-3-workspace/task-6a-report.md`
- `docs/ward-flow-phase-3-workspace/task-6a-review.md`
- `docs/ward-flow-phase-3-workspace/task-7-addendum.md`
- `docs/ward-flow-phase-3-workspace/task-7-brief.md`
- `docs/ward-flow-phase-3-workspace/task-7-report.md`
- `docs/ward-flow-phase-3-workspace/task-8-addendum.md`
- `docs/ward-flow-phase-3-workspace/task-8-brief.md`
- `docs/ward-flow-phase-3-workspace/task-8-report.md`
- `docs/ward-flow-phase-3-workspace/task-9-brief.md`
- `docs/ward-flow-phase-3-workspace/task-9-report.md`
- `docs/ward-flow-phase-3-workspace/transport-leg-helper-report.md`
- `docs/ward-flow-phase-3-workspace/transport-stage-coherence-report.md`
- `docs/ward-flow-phase-3-workspace/whole-branch-review.md`
- `docs/ward-flow-phase-5-handover.md`
- `docs/ward-flow-phase-5-kickoff-prompt.md`
- `docs/ward-flow-phase-6-7-decisions.md`
- `docs/ward-flow-phase-6-7-kickoff-prompt.md`
- `docs/ward-flow-phase-handoff.md`
- `docs/ward-flow-roadmap.md`
- `docs/ward-management-context.md`
- `docs/ward-management-decisions.md`
- `docs/ward-management-mode-map.md`

## Everything else, by document

| Document | On |
| --- | --- |
| `docs/superpowers/plans/2026-08-27-ward-flow-phase-6-morning-page.md` | `MAIN` `BOARD` `WAVE1` `VER` |
| `docs/superpowers/plans/2026-08-27-ward-flow-phase-7-front-door.md` | `MAIN` `BOARD` `WAVE1` `VER` |
| `docs/superpowers/plans/2026-08-28-ward-flow-phase-8-distance.md` | `MAIN` `BOARD` `WAVE1` `VER` |
| `docs/superpowers/plans/2026-08-28-ward-flow-ward-board.md` | `MAIN` `BOARD` `WAVE1` `VER` |
| `docs/superpowers/plans/2026-08-29-ward-flow-referral-front-door.md` | `ORCH` `MAIN` `BOARD` `WAVE1` `VER` |
| `docs/superpowers/plans/2026-08-29-ward-flow-truthfulness-and-demo-fixes.md` | `ORCH` `MAIN` `BOARD` `WAVE1` `VER` |
| `docs/superpowers/specs/2026-08-27-ward-flow-phase-6-morning-page-design.md` | `MAIN` `BOARD` `WAVE1` `VER` |
| `docs/superpowers/specs/2026-08-27-ward-flow-phase-7-front-door-design.md` | `MAIN` `BOARD` `WAVE1` `VER` |
| `docs/superpowers/specs/2026-08-28-ward-flow-phase-8-distance-design.md` | `MAIN` `BOARD` `WAVE1` `VER` |
| `docs/superpowers/specs/2026-08-28-ward-flow-ward-board-design.md` | `MAIN` `BOARD` `WAVE1` `VER` |
| `docs/ward-flow-autonomous-session-2026-08-28.md` | `MAIN` `BOARD` `WAVE1` `VER` |
| `docs/ward-flow-catchment-data.md` | `MAIN` `BOARD` `WAVE1` `VER` |
| `docs/ward-flow-changeable-data-rule.md` | `ORCH` `MAIN` `BOARD` `WAVE1` `VER` |
| `docs/ward-flow-coordination-rules.md` | `ORCH` `MAIN` `BOARD` `WAVE1` `VER` |
| `docs/ward-flow-decisions-2026-08-29.md` | `ORCH` `MAIN` `BOARD` `WAVE1` `VER` |
| `docs/ward-flow-editing-guide.md` | `MAIN` `BOARD` `WAVE1` `VER` |
| `docs/ward-flow-fold-procedure.md` | `MAIN` `BOARD` `WAVE1` `VER` |
| `docs/ward-flow-handover-2026-08-28.md` | `MAIN` `BOARD` `WAVE1` `VER` |
| `docs/ward-flow-handover-2026-08-29.md` | `MAIN` `BOARD` `WAVE1` `VER` |
| `docs/ward-flow-handover-after-phase-7.md` | `MAIN` `BOARD` `WAVE1` `VER` |
| `docs/ward-flow-ledger.md` | `DEC` `MAIN` `BOARD` `WAVE1` `VER` |
| `docs/ward-flow-master-sequence-2026-08-29.md` | `ORCH` `MAIN` `BOARD` `WAVE1` `VER` |
| `docs/ward-flow-mission-and-refusals.md` | `ORCH` `MAIN` `BOARD` `WAVE1` `VER` |
| `docs/ward-flow-phase-8-9-questions.md` | `MAIN` `BOARD` `WAVE1` `VER` |
| `docs/ward-flow-phase-8-decisions.md` | `MAIN` `BOARD` `WAVE1` `VER` |
| `docs/ward-flow-phase-8-mutation-coverage-limits.md` | `MAIN` `BOARD` `WAVE1` `VER` |
| `docs/ward-flow-phase-9-decisions.md` | `MAIN` `BOARD` `WAVE1` `VER` |
| `docs/ward-flow-pinned-clock-handover.md` | `ORCH` `DEC` |
| `docs/ward-flow-questions-rule.md` | `ORCH` `MAIN` `BOARD` `WAVE1` `VER` |
| `docs/ward-flow-referral-destination-spec.md` | `MAIN` `BOARD` `WAVE1` `VER` |
| `docs/ward-flow-universal-referral-plan.md` | `MAIN` `BOARD` `WAVE1` `VER` |
| `docs/ward-flow-ward-board-plan-corrections-2026-08-29.md` | `ORCH` `MAIN` `BOARD` `WAVE1` `VER` |

