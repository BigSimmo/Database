# Claude Code Hook Scripts

<!-- BEGIN:claude-hook-scripts -->

# Claude Code hook scripts

`.claude/hooks/*.sh` runs on Linux web containers as well as on the Windows workstation, and the
workstation cannot see the thing that breaks it.

- **Pin the executable bit in the index, not on disk.** The primary workstation is a Windows ReFS
  Dev Drive with `core.fileMode=false`, so git ignores filesystem permission bits entirely and a
  local `chmod +x` is a silent no-op. A hook added there commits as `100644`. Fix it with
  `git update-index --chmod=+x .claude/hooks/<name>.sh` and confirm with `git ls-files -s`.
  This is not hypothetical: `session-start.sh` shipped `100644` while both its siblings were
  `100755` (found 2026-08-18). That script's body only runs when `CLAUDE_CODE_REMOTE=true`, so the
  sole environment it does work in is the Linux container where a non-executable checkout cannot
  be run — and it is the script that provisions the Node 24 the engine floor needs, after
  `npm ci` EBADENGINE blocked PRs #1611, #1697, #1705 and #1740.
- **Register hooks as `bash "$CLAUDE_PROJECT_DIR/…"`, never as a bare path**, so the mode is never
  load-bearing. `session-start.sh` was the only bare-path registration and the only one missing the
  bit; that is not a coincidence worth repeating.
- **Line endings are LF.** `.gitattributes` sets `* text=auto eol=lf`; all hook blobs measure CR=0.
  A CR in a shell blob fails on Linux as the near-unreadable `/bin/bash^M: bad interpreter`.
- **Hooks must not be able to fail a session.** Every hook here exits 0 on any parse problem and
  makes no decision, so a malformed payload leaves the tool call exactly as it was.
- **Set an explicit `timeout`.** The default is 60s, which `session-start.sh` can exceed on a cold
  container (Node tarball download plus `npm ci`) — a killed hook leaves dependencies half
  installed.
- **SessionStart context comes from stdout, not stderr.** A hook that reports on stderr is invisible
  to the model even though it ran and exited 0; `check-base-freshness.mjs` spent its life in that
  state. Emit `{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"…"}}` on
  stdout, and only when the message is worth the context it costs.

Enforced by the `claude hook scripts are checked in runnable` block in
`tests/session-start-hook.test.ts`, which fails on any hook that is not `100755` or that carries CR
bytes. Do not weaken it.

<!-- END:claude-hook-scripts -->
