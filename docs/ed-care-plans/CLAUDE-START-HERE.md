# ED Care Plans — Claude start here

**Handover date:** 21 August 2026 (Australia/Perth)  
**Implementation status:** Not started  
**Design status:** Approved  
**Planning status:** Complete  
**Working directory:** `D:\Repos\Database\.claude\worktrees\ed-care-plans-impl-7f44cd` (superseded 21 Aug 2026; the original `D:\Worktrees\Database\ed-care-plans` is now planning-only and must not be written to)  
**Branch:** `claude/ed-care-plans-impl-7f44cd` (based on `main` at `97f614223`)

## One-minute start

**Superseded 21 August 2026.** Do all ED Care Plans work in `D:\Repos\Database\.claude\worktrees\ed-care-plans-impl-7f44cd` on branch `claude/ed-care-plans-impl-7f44cd`, which is based on current `main`. The four planning documents were copied there and are now tracked with the code. The original planning worktree `D:\Worktrees\Database\ed-care-plans` is read-only reference; do not edit it. Do not edit the dirty shared checkout at `D:\Repos\Database`.

Four user decisions were recorded on 21 August 2026 and are binding: build the synthetic prototype now but keep the domain shaped for later real storage; keep the full multi-service workflow including named senior-clinician approval; deliver Tasks 1–5 first and stop for user review; local task commits are authorised (nothing pushed). See the Revision history and Delivery Stages sections of the implementation plan.

Read these files in order before writing code:

1. [`AGENTS.md`](../../AGENTS.md) — binding repository rules.
2. [`CLAUDE.md`](../../CLAUDE.md) — Claude orientation and repository map.
3. [`claude-build-handover-2026-08-21.md`](./claude-build-handover-2026-08-21.md) — current state, approvals, boundaries, precedents, and exact next action.
4. [`2026-08-20-ed-care-plans-design.md`](../superpowers/specs/2026-08-20-ed-care-plans-design.md) — approved product and visual specification; this is the product authority.
5. [`ed-care-plans-context.md`](../ed-care-plans-context.md) — binding domain language.
6. [`2026-08-20-ed-care-plans-implementation.md`](../superpowers/plans/2026-08-20-ed-care-plans-implementation.md) — executable nine-task, file-by-file, test-first build plan.
7. [`conversation-transcript-2026-08-21.md`](./conversation-transcript-2026-08-21.md) — portable transcript of the complete visible Codex conversation through the handover request.
8. [`verification-log-2026-08-21.md`](./verification-log-2026-08-21.md) — exact planning and handover evidence, plus what has not run.

The visual-direction source files are outside Git and remain available at:

`C:\Users\joshs\.codex\visualizations\2026\08\20\01a01fb2-575f-7c11-a245-332db7a85a25\ed-care-plans\.superpowers\brainstorm\17559-1787239654\content\ed-care-plans-directions.html`

The previous localhost visual server is no longer running. Open the HTML file directly or start a new task-owned visual server if comparison is needed.

## Copy/paste prompt for Claude

```text
Continue the approved ED Care Plans build from the handover in
D:\Worktrees\Database\ed-care-plans on branch codex/ed-care-plans.

Work only in that isolated worktree. Do not touch D:\Repos\Database, which contains
unrelated dirty work. Read AGENTS.md and CLAUDE.md, then read these files in order:

1. docs/ed-care-plans/CLAUDE-START-HERE.md
2. docs/ed-care-plans/claude-build-handover-2026-08-21.md
3. docs/superpowers/specs/2026-08-20-ed-care-plans-design.md
4. docs/ed-care-plans-context.md
5. docs/superpowers/plans/2026-08-20-ed-care-plans-implementation.md
6. docs/ed-care-plans/conversation-transcript-2026-08-21.md
7. docs/ed-care-plans/verification-log-2026-08-21.md

The design and implementation plan are approved. Do not re-brainstorm or encode a
numeric presentation threshold. Execute the nine tasks in order using the named
Superpowers subagent-driven-development and test-driven-development workflow. Keep
the app completely synthetic, reset-on-refresh, and provider-free. Use repository
test and browser wrappers only.

Before editing, verify the branch, HEAD, upstream, status, and the current gap to
origin/main. Preserve every existing untracked handover/specification file. Do not
merge, rebase, pull, or move the base without my explicit authorization.

Routine local implementation and offline verification are intended. No commit,
push, pull, merge, rebase, PR, deployment, provider/API access, migration, or live
data access is authorized by this handover. Ask separately before creating local
commits because the requested SDD workflow normally uses them as checkpoints.

Begin with Task 1 in the implementation plan. Use a failing focused test first,
record the decisive red and green lines, obtain the task reviews required by the
plan, and continue task by task. Stop only for a material authorization boundary or
a conflict that cannot be resolved safely from the repository.
```

## Current Git checkpoint

Captured on 21 August 2026:

- `HEAD`: `eeea74a160c19553f94347dda5102b2dff2ed591`
- Upstream: `origin/main`
- `origin/main` at the final 00:51 AWST snapshot: `1cc0d298774e4dc2ec8dd04d03ecf4fe789d5564`
- State at that snapshot: branch is four commits behind `origin/main`; no branch movement was performed.
- Working tree: the planning and handover documents are untracked; product code is untouched.
- Commits/pushes/PRs/deployments: none for ED Care Plans.

## Exact first action

After the read order and Git preflight, begin implementation-plan **Task 1: domain types, deterministic fixtures, selectors, and privacy invariants**. Do not start with page scaffolding.
