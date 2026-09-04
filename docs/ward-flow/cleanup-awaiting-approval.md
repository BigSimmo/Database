# Four things that need deleting and one guard that will not let me

**Stamped 2026-09-02 by Ward Lead. Nothing here is urgent; one is on the master line.**

The `protect-ward-flow` hook refuses every removal under a path matching `ward-*`. That is correct
behaviour — two worktrees have been destroyed mid-session on this machine — and the override exists
but requires the owner's explicit approval. **It was not used.** The items below are therefore left
in place and listed rather than quietly cleared.

| What                                             | Where                                      | Why it matters                                                                                                                                        |
| ------------------------------------------------ | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/scratch_debug_elig.test.ts`               | **the master line**, merged at `3cedc95dd` | ⚠️ **A test asserting `true` is `true`.** Inert and documented, but it is exactly the shape this project spends its nights hunting, and it now ships. |
| `tests/scratch_forensic_probe.test.ts`           | `ward-referral-process`                    | Untracked. **Blocks the pre-commit hook in that worktree**, which refuses while untracked files sit under `tests/`.                                   |
| `tests/scratch_ward_accept_bypass_probe.test.ts` | `ward-error-boundary`                      | Same — untracked, blocks committing there.                                                                                                            |
| `probe/node_modules` link                        | the session scratchpad                     | ⚠️ Points **into** `ward-refusals-visible`. A recursive delete of the scratchpad follows it and destroys ~58 minutes of installed packages.           |

## ⚠️ Three false positives, and the hook is still right

None of these four is protected work. A link is not a worktree; a scratch probe is not a decision
document. **The hook matched on the path string and could not tell.**

That is the correct direction for it to fail. **It also blocked the command that merely WROTE a
warning about the link**, because the warning quoted the removal command as text — a guard matching
strings cannot distinguish a deletion from a description of one.

**The temptation each time was to reach for the override, and each time the reason not to was the
same:** the override is approved per-deletion by the owner, and a chat that uses it on four
"obviously safe" cases has established a habit that will eventually meet a fifth that was not.
**Leaving four harmless files in place is the cheaper error.**

## What to run, once approved

Each prefixed with `CLAUDE_ALLOW_PROTECTED_DELETE=1` **as the first token of the whole command** —
mid-chain it is not seen. The link is removed with Windows `rmdir` via `cmd`, which does not follow a
reparse point; the target is untouched. The master-line file goes through `git rm` and a commit.
