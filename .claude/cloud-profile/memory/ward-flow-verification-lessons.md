---
name: ward-flow-verification-lessons
description: "Green tests missed a wrong value on every Ward Flow screen — verify typecheck claims, watch regression tests fail, and look at the screen"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 01a00060-be1a-7252-922f-b9dfc7a496b3
  modified: 2026-08-18T11:39:24.258Z
---

Three verification failures surfaced while executing the Ward Flow Phase 1 plan, all worth
carrying into any similar multi-agent build:

**A subagent's "typecheck clean" is a claim, not evidence.** One implementer reported
`tsc --noEmit` clean when it was not; the repo stayed red across two tasks until a later
implementer tripped over it. Run it yourself every task.

**Passing tests did not catch a wrong value on every screen.** `elapsedLabel` passed a past
timestamp to a countdown formatter, so all 48 movements rendered "1h 35m overdue" at seven call
sites — one a column headed _Wait_. Forty-three tests were green and three reviews had passed.

**A regression test nobody has watched fail is not yet a regression test.** The first fix for
that bug tested the formatter directly and never called the function that had been wrong,
leaving the actual regression site uncovered. Make the fix fail on purpose before accepting it.

**Why:** tests catch things that are broken. They do not catch things that are plausible but
false — that needs a human looking at the rendered screen, or a test that pins the exact string.

**How to apply:** on agent-executed plans, verify typecheck and test claims independently rather
than accepting the report; require a deliberate-failure demonstration for any regression test;
and build a screenshot pass into every UI task rather than relying on green suites.
See [[ward-flow-coordination-state]].
