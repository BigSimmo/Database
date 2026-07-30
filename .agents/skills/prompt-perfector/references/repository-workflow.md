# Repository workflow

Read this reference only when prompt work depends on repository evidence or when evaluation or execution may run project commands or change repository content. Higher-priority instructions and applicable `AGENTS.md` files always win.

## Classify the task

- Prompt-only and answer-only work needs no repository setup.
- Read-only review or diagnosis may inspect the repository after checking its current branch and status, but must not write.
- Treat edits, formatting, installs, code generation, tests that may emit artifacts, builds, migrations, and Git-tracked documentation changes as repository-writing work.

## Fail-closed repository-write gate

Before the first repository-content write or potentially mutating project command:

1. Read applicable repository instructions and inspect branch, `HEAD`, upstream, status, worktrees, relevant history, and active Git-operation markers.
2. Preserve every unrelated staged, unstaged, and untracked change. Never stash, reset, clean, discard, relocate, or absorb it.
3. Run the repository's required task bootstrap. For this Database workspace, resolve it portably:

   ```powershell
   $taskBootstrap = Join-Path $env:USERPROFILE '.codex\scripts\start-codex-task.ps1'
   if (-not (Test-Path -LiteralPath $taskBootstrap)) { throw 'Task bootstrap is unavailable.' }
   $expectedHead = (git rev-parse HEAD).Trim()
   $taskOutput = & $taskBootstrap -TaskSlug <short-generic-slug>
   if ($LASTEXITCODE -ne 0) { throw 'Task bootstrap failed.' }
   $taskOutput
   ```

4. Parse `repo` and `branch` from the bootstrap output, then run the dependency-free verifier from the repository root:

   ```powershell
   $taskState = @{}
   $taskOutput | ForEach-Object {
     if ($_ -match '^(TASK_START|repo|branch)=(.+)$') { $taskState[$matches[1]] = $matches[2] }
   }
   if ($taskState.TASK_START -ne 'git=true' -or -not $taskState.repo -or -not $taskState.branch) {
     throw 'Task bootstrap output is incomplete.'
   }
   node .agents/skills/prompt-perfector/scripts/verify-repository-isolation.mjs `
     --expected-repo $taskState.repo --expected-branch $taskState.branch --expected-head $expectedHead
   if ($LASTEXITCODE -ne 0) { throw 'Repository isolation verification failed.' }
   ```

5. Proceed only when the verifier emits `SAFE_TO_EDIT=true` and `PRECHECK_RESULT=SAFE`. It checks absolute paths, detached/protected branches, primary or unregistered worktrees, active Git operations, state drift, and dirt.
6. For a same-task dirty continuation, inventory every change first, then add `--allow-dirty`; this flag is rejected unless expected repo, branch, and `HEAD` are all supplied.
7. Re-run the verifier immediately before editing. If any condition is unproved or changes unexpectedly, stop and request direction.

The verifier is read-only and establishes workflow isolation; it does not provide an OS-level sandbox or protection from unrelated processes. State that limit honestly.

## Execution and verification

- Use the existing runtime, package manager, scripts, and architecture. Make the smallest scoped change.
- Treat provider calls, remote Git actions, hosted CI, live databases, deployments, commits, pushes, and destructive operations as separate authority.
- Run the narrowest local check first, widen only when warranted, and report exact results plus checks not run.
- Finish by inspecting the targeted diff, status, branch, and worktree. Do not claim an unrun check passed.
