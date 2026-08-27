# Ward Flow Phases 6 and 7 — kickoff prompt

Paste the block below into a fresh session as its first message. It is deliberately self-sufficient:
the constraints are stated inline rather than only referenced, so they bind before the linked
documents are read.

**This is a design conversation, not a build.** It produces two written specifications. Do not let
it start writing product code — the Phase 5 pattern was spec first, build second, and it worked.

**Before pasting, check one thing:** has the clinician check
(`docs/ward-flow-clinician-check.md`) come back? If it has, say what it said. If it has not, say so
explicitly — the four-stage model is the single assumption most likely to be wrong, and Phase 6 is
built entirely from it.

---

```
Design Ward Flow Phases 6 and 7. This is a design conversation producing two written
specifications, not an implementation session. Do not write product code.

READ THESE FIRST, IN THIS ORDER:

1. docs/ward-flow-phase-6-7-decisions.md — the product owner's answers to every question that had
   to be settled first. These are decided. Do not re-open them, and do not re-derive them.
2. docs/ward-flow-roadmap.md — direction, phase order, and the refusals that are already settled.
3. docs/superpowers/specs/2026-08-26-ward-flow-phase-5-bed-availability-design.md — the Phase 5
   spec, whose 14 decisions Phase 6 builds on directly.
4. docs/ward-flow-phase-5-handover.md — what was built and what is proven, by what evidence.
5. docs/ward-flow-complete-ledger.md §5d — what the screenshots caught, and what is still open.
6. docs/development-speed-playbook.md — how to work fast here without weakening any gate.
7. AGENTS.md and CLAUDE.md — repository rules. They override generic habits.

WHAT PHASE 6 IS

The morning page. One page for a bed coordinator starting a shift, built entirely from numbers
Phase 5 already produces. Fixed at the morning handover with a live view one click away. Whole
service, grouped by hospital. Headline number: beds available right now. It also carries a
sixty-second self-driving guided tour — a patient waiting, a coordinator finding a bed, a ward
confirming, the board updating.

It is small on purpose. Its real output is something you can hand to a colleague as a link
instead of narrating over their shoulder. Finding out whether any of this is right is worth more
than the next feature.

WHAT PHASE 7 IS

The front door. Community referrals, intake from crisis services, police, ambulance and
inter-hospital transfers, matching to bed type, and the data-entry screens each contributor needs.
The bed-category model and the permitted referral fields are already decided — read them in the
decisions document and use them verbatim.

CONSTRAINTS THAT OVERRIDE EVERYTHING

1. Never invent a legal figure. Nothing from the Mental Health Act may be cited, paraphrased or
   inferred — not in code, copy, comment, test or fixture. A plain Voluntary/Involuntary label is
   permitted and is not a legal figure. If an actual figure is ever needed, stop and ask.
2. Synthetic data only. For a referral the permitted fields are age band, sex, and whether a secure
   bed is needed — nothing else. No name, date of birth, record number, address, diagnosis,
   history or treatment. Free text counts as data.
3. Local and offline checks only. Never run verify:release, any eval:* script,
   check:supabase-project, test:live, or anything touching OpenAI, Supabase, hosted CI or a live
   database.
4. The rule Phase 5 exists to hold, which Phase 6 must not break: nothing predicted,
   confirmed-but-unreleased, or on leave is ever added into "available now".
5. Never force-push, git reset --hard, or discard either side of a diverged branch. Never delete a
   worktree unasked.
6. Do not skip a gate, delete an assertion, loosen a test, or lower a tolerance. If a change would
   reduce what can honestly be claimed, do not make it — say so instead.

HOW TO WORK

Check state before trusting any document's account of itself: `gh pr view <n> --json state` first,
`git worktree list` before creating a worktree, and refresh a remote ref before reasoning from it.
Three times in one session on 2026-08-27, work was nearly redone that had already been done and
written down. docs/development-speed-playbook.md §1 records why.

Produce each specification as its own file under docs/superpowers/specs/, following the Phase 5
spec's shape: numbered decisions, each with its reasoning, and an explicit statement of what is
deliberately excluded. State plainly which decisions are assumptions that have not been validated.

Ask me before designing anything that would need a fact neither of us has.
```

---

## The bed-category model, settled 2026-08-27

Both previously open questions were answered by the owner and are recorded in
`docs/ward-flow-phase-6-7-decisions.md`. The design conversation should treat them as decided:

1. **Forensic is a fourth independent dimension** and combines with the other three.
2. **Most beds are undesignated for sex**; some are female-only or male-only. Undesignated is the
   default and the majority case.

The second one corrected an assumption that had been written down wrongly, so read the decisions
document rather than working from memory or from an older copy of this file.

**One trap the design must not fall into.** Sex designation is a constraint on who may occupy a
bed, not an attribute to compare for equality. Matching "bed sex equals patient sex" excludes every
referral from every undesignated bed — the majority of them. The rule is "does this bed accept this
person".
