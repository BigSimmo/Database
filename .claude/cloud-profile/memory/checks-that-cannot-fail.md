---
name: checks-that-cannot-fail
description: Mutation-test any guard before trusting it; four defects in one session were all verifications that could not fail
metadata:
  node_type: memory
  type: feedback
  originSessionId: 0d5b8fb0-c1b6-4a1d-b4cf-962a819d4620
  modified: 2026-08-18T12:49:42.573Z
---

Before reporting a check as passing, ask whether it _could_ have failed. Four separate defects
in the 2026-08-18 environment session were the same shape — something that reads like
verification and cannot produce a red result:

- **A hook reporting on stderr.** `check-base-freshness.mjs` printed its stale-base warning with
  `console.error`, but Claude Code injects only a SessionStart hook's **stdout** into context. It
  ran, exited 0, and the warning reached nobody for its entire life.
- **`grep` on a file containing a NUL byte.** GNU grep switches to binary mode and prints only
  "Binary file matches", so a `git diff … | grep <pattern>` check returned empty whether or not
  the pattern was present. It "proved" a function was untouched. Redone by byte comparison.
- **A pipeline masking the exit code.** `npm run verify:pr-local … | tail -80` reported
  `exit code 0` while its own summary line said `failed: test (exit 1)`. `${PIPESTATUS[0]}` or
  redirect to a file, never a bare pipe, when the status matters.
- **A tautological guard.** `clean-worktree.mjs` re-checked "0 commits ahead" after its squash
  test, but the counter it used returns 0 for any branch that test just accepted — satisfiable
  only by candidates already skipped.

**Why:** two of the four were mine, and both were caught only because something forced a second
look. Neither would have surfaced from re-reading the code.

**How to apply:**

1. **Mutation-test a new guard.** Inject the regression it claims to catch and watch it go red.
   Done for `tests/claude-code-settings.test.ts`: a broad allow rule, a bare-path hook
   registration, and a missing timeout produced 6 failures, then 89/89 after restore.
2. **Capture real exit codes.** Redirect to a file and echo `$?`, or read `${PIPESTATUS[0]}`.
3. **Prefer byte/structural comparison over text matching** when proving something is unchanged.
4. **Know which stream a hook's output must use** — see [[claude-hook-exec-bit-trap]] for the
   sibling trap in the same area.

Related: [[ward-flow-verification-lessons]] — green tests that missed a wrong value on every
screen. Same family: the test ran, the test passed, the test proved nothing.
