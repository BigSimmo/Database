# Coding workflow

Read this when the perfected task depends on local repository evidence or will write to a Git repository. Apply the **freshness** rules to any review or diagnosis. Apply the **branch, environment, implementation, and validation** rules only when the task will actually write to the repository. Skip all of it for prompt-only or answer-only work that does not touch repository state.

Higher-priority instructions and the repository's own `AGENTS.md` / `CLAUDE.md` always win over anything here.

## Freshness (review and diagnosis)

- Base every finding on the current tree, not on memory or earlier context. Re-read a file before relying on its contents, paths, or line numbers.
- Confirm branch, `git status`, and whether the diff has moved before citing specific lines. Stale line numbers and since-deleted symbols are the most common false findings.
- Distinguish what you observed from what you inferred. If you cannot verify a claim against the current tree, label it as an assumption or a limitation rather than stating it as fact.
- Do not report a defect you have not traced to concrete, current file/line evidence.

## Branch and worktree (repository writes)

- Start every task in its own fresh worktree on its own new branch. Fetch first, then branch off the latest remote default branch (`git fetch origin && git worktree add <path> -b <branch> origin/<default>`), using absolute paths for the worktree. Do not edit in the main checkout, and do not reuse another task's worktree or branch for unrelated work.
- A stale base is the most common multi-worktree trap: confirm the new branch actually starts from the current remote default branch, not a days-old local copy.
- Name the branch with a short kebab-case phrase that identifies the task, following the repository's existing prefix convention when one exists.
- Inspect first: current branch, upstream, other worktrees, and `git status`. Never assume the branch or remote.
- Do not commit directly to a protected or base branch (`main`, `master`, `develop`, `release/*`). If you find yourself on one, create the worktree/branch above before editing.
- If the environment already placed you in a dedicated per-task worktree on a fresh branch, use it as-is; do not nest another one.
- Preserve unrelated staged, unstaged, and untracked work. Do not stash, reset, clean, or discard changes you did not create.
- Commit or push only when the task explicitly asks for it. Never force-push, rebase shared history, delete branches, or merge into a base branch without explicit confirmation.

## Environment (repository writes)

- Use the repository's documented scripts and the package manager already in use. Do not switch tooling or add a lockfile type.
- Do not assume a dev-server port or URL; use the project's own launch helper and confirm the server belongs to this project before attaching. Do not kill or modify other projects' servers.
- Treat provider-backed actions (hosted APIs, live databases, CI, deploys, paid services) as confirmation-required. Prefer local, mocked, or offline checks; report the command and ask before running anything that touches a provider.
- Never commit secrets, credentials, `.env*`, tokens, build artifacts, or machine-local config.

## Implementation (repository writes)

- Make the smallest change that satisfies the goal. Keep the diff proportionate to the problem; no opportunistic refactors, renames, or drive-by cleanups the task did not ask for.
- Match surrounding patterns, naming, and idioms rather than importing a new style or abstraction. Read neighbouring code first.
- Handle the error and empty paths, not just the happy path. Cover the edge cases a naive implementation gets wrong.
- Do not add a dependency without saying so and justifying it. Do not leave commented-out code or reviewer-directed explanatory comments.

## Validation (repository writes)

- Identify the verification path up front: which test, command, or flow proves the change. A change with no way to check the result is incomplete.
- Run the smallest relevant check first, then widen only if needed. Prefer a focused test over a full suite for a narrow change.
- Report what you actually ran and its result. Never claim a check passed unless it was executed. If a check could not be run, say so and give the command that would normally be used.
- For user-facing or behavioural changes, exercise the affected flow and observe the outcome, not only types or unit tests.
- Finish clean: leave the worktree with work committed or explicitly reported as uncommitted, and state the worktree path and branch so the user can push, hand off, or remove it.
