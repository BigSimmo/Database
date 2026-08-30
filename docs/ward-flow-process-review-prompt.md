# Ward Flow — adversarial process audit

You are auditing the **process** behind a project called Ward Flow — how it is planned, coordinated,
recorded, decided and verified. **You are not reviewing the application.** Read product code only
where a process claim depends on it.

**Your job is not to summarise this system. It is to find where it fails, and to propose what should
replace those parts** — including, where warranted, replacing the whole structure. **Change nothing on
disk. Everything you produce is a report.**

## What Ward Flow is

An offline, synthetic prototype of a psychiatric bed-flow system for Western Australia, built by a
psychiatrist who is not a software engineer. It is built by **five parallel Claude Code chats on one
machine**, one acting as an orchestrator, coordinating by messages that do not survive their session.
It is never pushed and never opened as a pull request — **every copy is on one disk.**

**The coordination system, the documents, the decision records and the verification claims are what
you are auditing.**

## Where to read

```
git show <BRANCH>:<path>
git ls-tree -r --name-only <BRANCH> -- docs/ | grep ward
git log --oneline --follow -- <path>          # the history is evidence, see below
```

| Branch                               | Holds                                                    |
| ------------------------------------ | -------------------------------------------------------- |
| `claude/Wardquestions`               | the orchestrator — process, rules, custody, plans        |
| `claude/Ward-design`                 | **the decision ledger.** Divergent from the working line |
| `claude/ward-flow-phases-6-7-design` | the working line                                         |
| `claude/ward-flow-print-fixes`       | the ward board                                           |

**START HERE:** `git show claude/Wardquestions:docs/ward-flow-document-inventory.md` — **all 120
documents**, generated from git rather than curated, grouped by kind. **Its first table names the
eleven that exist on one branch only, including the decision ledger.**

**The ten the author calls core**, on `claude/Wardquestions` under `docs/`: `ward-flow-orchestrator`,
`-coordination-rules`, `-custody`, `-reporting-rule`, `-provisional-values`, `-changeable-data-rule`,
`-questions-rule`, `-mission-and-refusals`, `-remaining-work`, `-hubs-and-patient-plan`.

> **That list is the author's selection, and a hand-picked reading list is the author deciding what an
> auditor sees. Treat it as a hypothesis to test, not a syllabus.** Nothing in the inventory is out of
> scope.

**The decision register:** `git show claude/Ward-design:docs/ward-flow-ledger.md`.
**The repository's own rules:** `AGENTS.md` and `CLAUDE.md` at the root. **`AGENTS.md` wins on
conflicts.** Optional and outside the repository: `C:/Users/joshs/.claude/development-system.md` —
**if you cannot reach it, say so rather than inferring its contents.**

**The COMMIT HISTORY is evidence, not background.** These documents were rewritten repeatedly within
hours, and the messages record what was retracted and why. **A rule rewritten three times in an
evening is telling you something the current text cannot.** Use `git log` on the process documents.

---

# IF YOU ARE CODEX — READ THIS BEFORE ANYTHING ELSE

**`AGENTS.md` at the repository root governs this repository and wins over anything in these process
documents. But three of its rules were written for a different situation and must NOT be applied
here.**

## ⚠️ The review-throttling rules do NOT apply to this audit

`AGENTS.md` around **lines 894–895** says an automatic review _"may emit at most three inline findings
total"_, should _"prefer fewer, stronger findings"_, and should **omit P3 feedback**. See also
`docs/agents/codex-review-throttling.md`.

> **Those rules govern automatic Codex reviews of GitHub pull requests, where cost and reviewer
> fatigue are the constraint. This is a commissioned audit that the owner has explicitly asked to be
> exhaustive.**

**So, for this task only:**

- **There is no cap on findings.** Report every one you can support.
- **Do NOT omit low-severity items.** Small process defects are exactly what accumulates here.
- **Do not confine yourself to the smallest change.** The owner has asked for proposed overhauls.
- **A "single-pass, do not re-review" rule does not apply.** Probe 4 below asks you to iterate until a
  round finds nothing new.

**Do use `AGENTS.md`'s severity vocabulary**, because it is the language the owner already reads:
**P0** active exposure or data loss, **P1** serious defect with realistic impact, **P2** important
correctness or maintainability issue, **P3** minor. **Label every finding.**

## Effort and scope

**This is judgement work across 120 documents. It warrants `xhigh` reasoning effort** — above the
repository's `high` baseline — because the errors are expensive to undo: a wrong recommendation here
could delete rules that are working.

**If you are running in Codex Cloud at less than `xhigh`, say so in your first line** rather than
proceeding quietly. **If you are running locally, the offline access profile is correct for this work
— you need no provider access at all.**

**This is an audit, not a build.** There is no plan-high/build-low split to declare; effort stays high
throughout.

---

# USING SUBAGENTS — what to delegate, and what never to

**120 documents will not fit comfortably in one context. Delegate the reading. Never delegate the
judgement.**

**The split is the project owner's own rule and it holds here:**

| Kind of work                                                                  | Delegate?                      | Why                                                                                          |
| ----------------------------------------------------------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------- |
| **Extraction** — list, count, locate, quote, verify a commit or line exists   | **YES, fan out freely**        | A named fact either checks out or does not, so a wrong answer is catchable                   |
| **Assessment** — is this consistent, would this bite, is this rule decoration | **NO, keep it in one context** | There is no state to check it against; **a wrong assessment looks exactly like a right one** |

**Probe 5 is the ideal delegation.** Verifying documents' claims about commits, files, symbols and
counts is pure extraction, it is the highest-volume work here, and **many small agents each checking a
handful of claims beats one context trying to hold all of them.**

**Reading the inventory and recording what each document ASSERTS is also delegable.** Ask agents for
claims and citations, never for opinions.

**Probes 1, 2 and 3 stay with you**, and Probe 3 especially:

> **You cannot judge whether 120 documents are too many by dividing them between agents.** The whole
> question is what it is like to hold all of it at once. **A fan-out would answer a different question
> and return it in the same shape as an answer to yours.**

**Two rules for anything an agent returns:**

- **A subagent's finding is a lead, not a finding.** Confirm it yourself before it enters the report.
- **Say which conclusions rest on delegated work**, so the owner can weigh them accordingly.

**If your environment has no subagents, read in passes** — inventory, then the ten core documents,
then verification sampling. **Say that you did**, because it changes what your coverage claim means.

---

# HOW TO AUDIT

**Do not read each document and summarise it. Attack the system with the five probes below.** They are
ordered by expected yield.

## Probe 1 — Which rules can fail?

**For every rule, ask: what event would make this rule visibly violated, and what would notice?**

The repository has real gates for code — tests that go red, checks that block commits. **The process
is prose.** Nothing obviously detects a stale custody row, an unfollowed rule, or a document that has
become wrong.

> **These documents warn repeatedly about "checks that cannot fail" while apparently being made of
> them.** Classify every rule: **enforceable now / cheaply enforceable / decoration.** For the middle
> group, say exactly what the check would be.

## Probe 2 — Break each rule on purpose

**For each significant rule, construct the case where FOLLOWING it produces the wrong outcome.** Not
"this rule could be ignored" — **"here is a realistic situation where obeying this rule causes harm."**

**Look especially for:**

- **Rules over-fitted to one incident.** Written after a single failure, generalised too far, now
  costing more than the failure did.
- **Rules that only work if you already know the answer** — a caution aimed at one direction of a
  wrong inference, silent about its mirror image.
- **Rules that compete.** Two rules that are individually sensible and jointly force a bad choice.
- **Rules whose cost falls on someone other than their author.**

## Probe 3 — The structure itself, not its contents

**Admissible conclusions include:** the five-chat model is wrong; the orchestrator should not exist;
the document set should be a tenth of its size; the decision ledger and the work ledger should be one
thing, or three; the whole coordination layer should be replaced by something mechanical.

> **Do not confine yourself to improving what is there.** If the structure is the problem, say so and
> describe the replacement.

**Before proposing any overhaul, state the strongest case FOR the current design.** If you cannot,
you have not understood it well enough to replace it. **A review that only finds faults invites
somebody to rebuild what was already right.**

## Probe 4 — What did you not look at?

**When you think you are finished, ask: which document, branch, claim or category have I not
examined, and why not?** Whatever that turns up is your next round. **Repeat until a round finds
nothing new.**

**Then state explicitly what you did not read and what that leaves uncertain.** A gap you name costs
nothing; a gap you leave silent looks like coverage.

## Probe 5 — Check the claims against reality

**These documents make factual assertions** — about what is enforced, what landed, what is verified,
who holds what, how many tests passed. **Check a sample against git and against the files themselves,
not against other documents.**

**Where a document cites a commit, a file, a symbol or a count, verify it.** Report the hit rate. **A
process whose own records are unreliable is a different and worse problem than a process with bad
rules.**

---

# EVIDENCE STANDARD

**Every finding must cite the document and line, and state what would falsify it.** A finding you
cannot say how to disprove is an opinion.

**Distinguish, always: what you READ, what you RAN, and what you INFERRED.** Do not present an
inference as an observation.

**Do not invent problems to seem rigorous.** But note: **a system built this fast, by this many
parallel agents, in this few days, is unlikely to have only small problems.** If your audit finds only
minor issues, treat that as a signal to look harder before concluding it.

---

# WHAT TO DELIVER

**1. Findings, ordered by what they cost if left alone**, each labelled **P0/P1/P2/P3** using
`AGENTS.md`'s vocabulary. Each with: what is wrong, what it costs, how you would know you are right,
and **at least one concrete alternative.** Name the document and line. **There is no cap and P3s are
wanted.**

**2. The top three, in depth.** For each, **two or three genuinely different remedies** — a minimal
patch, a structural fix, and where it applies, a replacement — with the trade-offs stated. **Do not
give one option; give the owner a choice he can make.**

**3. Proposals for improvement across all four layers**, whether or not they came from a finding:

- **Structure** — documents, records, ownership, where things live
- **Approach** — how decisions are made, deferred, recorded, revisited
- **Pipeline** — how work is allocated, handed over, verified, landed
- **Project** — whether the whole thing is aimed at what the owner actually wants

**Be generous here. Many proposals, clearly separated from findings.** A proposal does not need a
defect behind it.

**4. What is working and must not be changed.** Specific, with the reason it works.

**5. If you had one hour with this project, what would you do?** One answer. Force yourself to choose.

**6. What you did not examine, and what that leaves uncertain.**

---

# CONSTRAINTS

- **Read-only. Change no file, run no gate, create no worktree, commit nothing.**
- **Codex: the protected-work hook does NOT run for you.** Nothing mechanical will stop an accidental
  write, so the read-only rule above is load-bearing rather than a formality.
- **Claude Code: the hook does run** and will refuse writes to protected paths. **Do not work around a
  refusal — report it.**
- **Never** touch OpenAI, Supabase, GitHub, or hosted CI. This work is local only.
- **Never** `git stash` — the stack is shared across every folder on this machine.
- **~148 worktrees exist and four chats are building right now. Do not disturb them.**
- **Prefix every shell command with an explicit `cd`** — the working directory silently reverts.
- **If a command is refused, report it. Do not find another route to the same effect.**

---

**These documents were written by the chat requesting this audit. It will agree with itself if you let
it. You were chosen because you have not read its reasoning — so where you disagree, say so plainly
and say why.**
