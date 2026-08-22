---
name: ward-flow-coordination-state
description: Ward Flow (WA metro psychiatry patient flow) — Phase 2 complete on codex/ward-management-design, unpushed; Phase 3 decisions settled
metadata:
  type: project
---

Ward Flow is a synthetic, offline prototype coordinating a psychiatric patient from a Perth
emergency department to an inpatient bed. Worktree
`C:/Users/joshs/.codex/worktrees/ward-management-design/Database`, branch
`codex/ward-management-design`. **Nothing pushed, no PR** — deliberate.

**Phase 2 (coordinator screen) completed 2026-08-19**: 21 commits, ten tasks, eleven review
rounds. Gates at close — tsc clean, 113 Vitest, lint clean and verified as actually run, 21
Chromium journeys, design-system contract clean. The whole-branch review initially returned NOT
FIT (2 Critical) and passed after one fix wave plus one ruled follow-up.

**Decisions the owner settled for Phase 3 (2026-08-19):**

1. A locked ward still _passes_ an open-security patient's gate, but the wording changes from
   "meets" to "more restrictive than required", and candidate ordering must prefer a
   security-matching ward. `ward-eligibility.ts` gate semantics stay untouched.
2. Role identity lives in the URL (`/ward-management/ward/<unitId>` etc.) with a role switcher
   on top for single-window demonstration, which spec §13 requires.
3. Statutory form codes were corrected in the fixture to 3A / 4A / 4C per spec §3. Owner still
   to confirm whether any of the five detention cases should be 3B rather than 3A.
4. Phone: drop the auto-scroll, pin Confirm to the bottom instead. Sets the pattern for the
   transport officer's screen.
5. Sidebar shows short labels on desktop, icons only on phone.
6. **State mutates in memory and resets on refresh** — no persistence, no server.
7. **All four Phase 3 surfaces in one phase** (ED screen, ward screen, transport officer phone,
   live tracker) — owner's choice against a recommendation to split; flagged as roughly twice
   Phase 2's size.

Open for the owner: whether a _voluntary_ patient on a locked ward warrants its own distinct
flag (sharper than the open-security case), and the 3A/3B split.

See [[ward-flow-verification-lessons]] for how claims get verified on this build.
