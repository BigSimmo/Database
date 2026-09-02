# Commit as you go — the thing that loses work here is interruption, not carelessness

Work sitting uncommitted is the only work this repository can lose. Commit when a change becomes
coherent, **not when the task ends** — a task in this project routinely spans hours, several agents,
a blocked gate and four other conversations.

**The trigger to watch is being interrupted, and it does not feel like risk at the time.** The
observed failure, 2026-08-29: seven files were formatted, the verifying test run was refused because
another worktree held the machine-wide lock, and attention moved to answering other sessions. The
files sat uncommitted for an hour, through a dozen unrelated commits, and were found only because an
unrelated status check happened to list them. Nothing about that hour felt like carrying risk. **The
work was finished and the mind had moved on — that combination is the hazard.**

## The rule

**Before you turn from your own work to anything else — answering another session, waiting on a lock,
investigating a tangent, reporting to the user — either commit what you have, or state in your next
message exactly what is uncommitted and why.** Saying it out loud is what makes it recoverable; a
silent working tree is not a memory.

- **Commit each coherent unit** — a module and its test, a fix and its proof, a document. Not the
  whole task.
- **A formatting pass is a commit**, not a loose end to tidy later. It is the change most often
  orphaned, because it feels finished the moment it is written.
- **Waiting is not a reason to hold a commit.** If a gate is blocked, commit the work and record the
  gate as unrun. An unverified commit is recoverable; an unwritten one is not.
- **Never `git add -A`** — another agent may share this worktree, and the wildcard commits their
  in-flight edits under your message.
- **Mutation testing requires committing first.** Restoring a tracked file with `git checkout --`
  also discards any uncommitted fix inside it, and `git checkout --` has no effect at all on an
  untracked file — it leaves the mutation in place and reports an error most drivers never read.

## Why this matters more here than in an ordinary repository

**A worktree under `.claude/worktrees` has twice been removed mid-session on this machine** by
unrelated cleanup sessions. A commit is what makes that survivable: the branch ref and the objects
live in the shared repository at the top level, not in the worktree folder, so losing the folder
costs nothing but a fresh checkout. **An uncommitted file is the only thing that does not survive it.**

## When you genuinely cannot commit

The pre-commit hook refuses whenever other unstaged or untracked files exist under `src/components/`
or `tests/` — so while a concurrent agent is mid-write, you cannot commit even work of your own that
is entirely disjoint. That is correct behaviour and must not be worked around.

**When it blocks you, say so in your next message and name the files.** Then commit the moment the
tree is yours again. The failure mode is not the block; it is forgetting that the block happened.
