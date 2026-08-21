# Care Plan — Claude start here

**Handover date:** 21 August 2026 (Australia/Perth)  
**Implementation status:** Not started  
**Design status:** Approved  
**Planning status:** Complete  
**Working directory:** `D:\Repos\Database\.claude\worktrees\ed-care-plans-impl-7f44cd` (superseded 21 Aug 2026; the original `D:\Worktrees\Database\ed-care-plans` is now planning-only and must not be written to)  
**Branch:** `claude/ed-care-plans-impl-7f44cd` (based on `main` at `97f614223`)

## One-minute start

**Superseded 21 August 2026.** Do all Care Plan work in `D:\Repos\Database\.claude\worktrees\ed-care-plans-impl-7f44cd` on branch `claude/ed-care-plans-impl-7f44cd`, which is based on current `main`. The four planning documents were copied there and are now tracked with the code. The original planning worktree `D:\Worktrees\Database\ed-care-plans` is read-only reference; do not edit it. Do not edit the dirty shared checkout at `D:\Repos\Database`.

Four user decisions were recorded on 21 August 2026 and are binding: build the synthetic prototype now but keep the domain shaped for later real storage; keep the full multi-service workflow including named senior-clinician approval; deliver Tasks 1–5 first and stop for user review; local task commits are authorised (nothing pushed). See the Revision history and Delivery Stages sections of the implementation plan.

Read these files in order before writing code:

1. [`AGENTS.md`](../../AGENTS.md) — binding repository rules.
2. [`CLAUDE.md`](../../CLAUDE.md) — Claude orientation and repository map.
3. [`claude-build-handover-2026-08-21.md`](./claude-build-handover-2026-08-21.md) — current state, approvals, boundaries, precedents, and exact next action.
4. [`2026-08-20-care-plan-design.md`](../superpowers/specs/2026-08-20-care-plan-design.md) — approved product and visual specification; this is the product authority.
5. [`care-plan-context.md`](../care-plan-context.md) — binding domain language.
6. [`2026-08-20-care-plan-implementation.md`](../superpowers/plans/2026-08-20-care-plan-implementation.md) — executable nine-task, file-by-file, test-first build plan.
7. [`conversation-transcript-2026-08-21.md`](./conversation-transcript-2026-08-21.md) — portable transcript of the complete visible Codex conversation through the handover request.
8. [`verification-log-2026-08-21.md`](./verification-log-2026-08-21.md) — exact planning and handover evidence, plus what has not run.

The visual-direction source files are outside Git and remain available at:

`C:\Users\joshs\.codex\visualizations\2026\08\20\01a01fb2-575f-7c11-a245-332db7a85a25\care-plan\.superpowers\brainstorm\17559-1787239654\content\care-plan-directions.html`

The previous localhost visual server is no longer running. Open the HTML file directly or start a new task-owned visual server if comparison is needed.

## Copy/paste prompt for Claude

```text
Resume the Care Plan build in D:\Repos\Database\.claude\worktrees\ed-care-plans-impl-7f44cd
on branch claude/ed-care-plans-impl-7f44cd.

Read, in order: docs/superpowers/specs/2026-08-20-care-plan-design.md (binding),
docs/care-plan-context.md (binding glossary), and the Global Constraints and
Delivery Stages sections of
docs/superpowers/plans/2026-08-20-care-plan-implementation.md.

Then read .superpowers/sdd/2026-08-20-care-plan-implementation/progress.md — the SDD
ledger. Tasks with a "Task N: complete" line are done; resume at the first without
one. The ledger also carries every controller ruling. If the ledger is missing, the
worktree was deleted again: recover from git log, because every task commits at its
end.

Execute with superpowers:subagent-driven-development. Eleven tasks. Stop at the Stage
A checkpoint after Task 5 and report to the user; do not start Task 6 on your own
judgment.

Synthetic, memory-only, provider-free throughout. Local commits are authorised;
nothing else is — no push, PR, merge, rebase, deployment, or provider access.
```

## Current Git checkpoint

Captured on 21 August 2026:

- `HEAD`: `eeea74a160c19553f94347dda5102b2dff2ed591`
- Upstream: `origin/main`
- `origin/main` at the final 00:51 AWST snapshot: `1cc0d298774e4dc2ec8dd04d03ecf4fe789d5564`
- State at that snapshot: branch is four commits behind `origin/main`; no branch movement was performed.
- Working tree: the planning and handover documents are untracked; product code is untouched.
- Commits/pushes/PRs/deployments: none for Care Plan.

## Exact first action

After the read order and Git preflight, begin implementation-plan **Task 1: domain types, deterministic fixtures, selectors, and privacy invariants**. Do not start with page scaffolding.
