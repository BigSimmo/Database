# RAG improvement programme — coordination handover

**Status:** maintained coordinator context (2026-08-13). This file hands the **coordinator
role** to a future chat: the session that dispatches worker sessions, drives their PRs to
green, merges them, approves canaries, and keeps the programme moving. Worker sessions read
[HANDOVER.md](HANDOVER.md); the design authority is [README.md](README.md); this file is
everything the coordinator additionally needs — the programme's history, the operating
decisions already made with the owner, and the playbook learned running the first cycle.

The three files are deliberately layered: README = _what to build and why_, HANDOVER =
_what each worker session does_, COORDINATION = _how the owner's chat runs the programme_.
Do not duplicate content across them; link instead.

---

## 1. Programme history (what has already happened)

Chronological, with the durable artefacts:

1. **PDF review + programme guide.** The owner's uploaded "Clinical RAG Improvement
   Programme" PDF was reviewed against the repo; agreed items kept, seven corrections made
   (stale pin, `check:rag:fixtures` name collision, intent detection already existing in
   triplicate, missing engagement with `docs/rag-behaviour/refuted-approaches.md`, `#231`'s
   real stop condition, single-owner roles, wrong follow-up assumptions). Result:
   `docs/rag-improvement/README.md` — **PR #1895, merged 2026-08-13**. The owner's
   priorities baked in: answer-quality track first, moderate (~1.5×) length increase.
2. **A1 phase 1 landed via babysit.** **PR #1899** ("record the structured
   generation-quality verdict on fallback", branch
   `claude/lithium-generation-quality-debug-ji1vce`) — structured `GenerationQualityError`
   diagnostics, `generation_quality_gate:*` retry reasons, fallback metadata,
   `scripts/probe-generation-quality.ts`. Driving it to merge required three fixes (see the
   playbook in §5): a real merge conflict with main resolved by keeping **both** sides'
   additive fallback diagnostics; a pre-existing test failure fixed by updating the expected
   verdict `template_like_answer` → `empty_after_sanitize` (current `sanitizeAnswerText`
   strips that fixture to empty, so the first rung of the failure-reason ladder wins); and a
   maintainability-budget breach fixed by extracting the prompt constant verbatim to
   `src/lib/rag/rag-answer-instructions.ts`. **Merged 2026-08-13** (merge commit `c924b65`).
3. **Worker handover pack.** `docs/rag-improvement/HANDOVER.md` — packets S1–S7+, status
   table, checklists, per-packet paste-ready prompts. **PR #1908, merged 2026-08-13.**

Nothing else from the programme has started. S1 and S4 are the next dispatches.

## 2. The coordinator role

The coordinator chat does what worker sessions must not:

- **Dispatch** exactly one worker session per packet, using the HANDOVER §7 prompt for that
  packet — or, preferably, the _tailored_ version the previous worker session emitted as its
  closing "handoff for the next chat" section (see §4).
- **Babysit** each worker PR to green and **merge** it (workers stop at the open PR by
  contract). Use the playbook in §5.
- **Approve and dispatch canaries.** Live eval-canary pairs (~$1–2/run, `eval-canary`
  repository dispatch, no `workflow_dispatch`) are per-run owner decisions. The coordinator
  relays the owner's approval; it never self-approves. Same for provider-backed evals
  (`eval:rag`, `eval:quality`, `eval:retrieval:quality`, `verify:release`,
  `check:supabase-project`, `test:live`) and live Supabase reads.
- **Keep the status table honest** — verify HANDOVER §2 rows against live GitHub/git state
  at the start of each coordination turn; correct stale rows in the next docs-carrying PR.
- **Capture follow-ups** into `docs/outstanding-issues.md` via `/issues` before context is
  lost.

Worker sessions implement one packet, run gates, open one PR, append the ledger, update
their status row, and stop. They never merge, never watch CI, never dispatch canaries.

## 3. Scheduling and session-configuration decisions (already made with the owner)

**Wave plan** (Track A is strictly consecutive — shared files and evidence dependencies;
Track B is the parallel lane):

| Wave | Dispatch in parallel                                                          | Gate to the next wave                                                                                                                           |
| ---- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | **S1 + S4**                                                                   | both PRs merged (S2 needs S1's code on main; S5 needs S4's fixtures)                                                                            |
| 2    | **S2 + S5 + S6**                                                              | S2 merged + its canary pair approved and green (S2b, the split-out A3 length step, follows S2 in the same lane if HANDOVER keeps them separate) |
| 3    | **S3** (after S2b when used)                                                  | S3 merged                                                                                                                                       |
| 4    | S7+ only after explicit owner decisions (Gate B verdict, experiment appetite) | —                                                                                                                                               |

One session per packet, never two — the duplicate-PR trap is real and recorded (`#292`:
PRs #1766/#1767 shipped the same conversion twice, four hours apart).

**Per-packet session settings** (agreed with the owner):

| Packet                | Model                     | Reasoning effort                                                   | Plan mode                                                                | Fast mode |
| --------------------- | ------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------ | --------- |
| S1                    | Fable                     | High (not xhigh — the plan exists; the session is build/diagnosis) | Yes — approve the mitigation-rung choice before edits                    | No        |
| S2 (and S2b if split) | Fable                     | High                                                               | Yes — eyeball the composition menu + length targets (clinical judgement) | No        |
| S3                    | Fable or Opus             | Medium–high                                                        | Optional                                                                 | OK        |
| S4                    | Cheaper model fine (Opus) | Medium                                                             | No                                                                       | OK        |
| S5/S6                 | Fable preferred           | High for sandbox/isolation design, medium for plumbing             | For the design decisions                                                 | No        |

Rationale anchors: `AGENTS.md` "Reasoning effort calibration" (RAG surfaces = top row;
xhigh planning over-produces; debugging inverts plan/build effort), and plan mode only in
sessions the owner will check back on — a fire-and-forget session parked in plan mode
stalls indefinitely.

## 4. The worker-prompt pattern (chained handoffs)

Every packet prompt from HANDOVER §7 gets one closing paragraph added when dispatched
(established with the owner for S1; reuse the pattern for all packets):

> **Handoff for the next chat:** as the final section of your last message, produce the
> ready-to-paste prompt for the next session. Start from the next packet's prompt in
> `docs/rag-improvement/HANDOVER.md` §7 and tailor it with this session's outcomes: your PR
> number and branch, the key findings/decisions the next packet depends on, any approval
> still pending, and anything you discovered that changes the next packet (flag it as a
> proposed HANDOVER edit rather than silently deviating). Label it clearly "Paste into the
> next session after you merge my PR".

The S1 dispatch prompt already exists in tailored form (HANDOVER §7 S1 + the reading order
including merged PR #1899's diff, the `rag.ts` 4,362-line budget warning, and the handoff
paragraph). If the coordinator needs to regenerate it, compose: HANDOVER §7 S1 prompt +
"read merged #1899's diff first; do not re-implement it" + budget warning + handoff
paragraph.

## 5. Babysit playbook (learned driving #1899 to merge)

- **Subscribe, don't poll:** `subscribe_pr_activity` for the PR; webhook events wake the
  session. `send_later` self check-ins may require an MCP approval the session cannot grant
  non-interactively — if blocked, rely on events and a manual owner nudge.
- **`dirty` is a claim, not a fact:** confirm with
  `git merge-tree --write-tree origin/main <tip>` before treating GitHub's
  `mergeable_state: dirty` as a real conflict. Behind-but-clean → sync once, late.
- **Resolve conflicts in a scratch worktree** (`git worktree add … <pr-branch>`), symlink
  `node_modules` from the main checkout for gates. When two sessions added _different
  additive_ fields at the same site (the common case here), the right resolution keeps both
  sides. Regenerate derived docs (`npm run docs:update`) rather than hand-resolving counts.
- **A failing test on the merge head may predate you:** check it against the PR's own head
  before blaming the merge. The #1899 case was a semantic drift — main's sanitizer changed
  which quality-verdict token a fixture trips; the fix was updating the expectation with a
  comment, not weakening the mechanism.
- **`src/lib/rag/rag.ts` has a 4,362-line no-growth budget**
  (`scripts/check-maintainability-budgets.mjs`, currently ~4,343 after the
  `rag-answer-instructions.ts` extraction). Additive diagnostics PRs can breach it on
  merge. Fix by extracting a cohesive module (pure move), never by raising the budget.
- **Expected noise:** CodeRabbit rate-limit comment edits (no action); the `ci-triage` bot
  comment restating failures you are already fixing (no action); `PR required` failing as
  the aggregate of a failure you've fixed on a superseded head (no action once pushed).
- **The PR-handoff stop hook re-arms** after every PR the coordinator session itself
  creates, blocking GitHub PR reads and loop tools. The owner's explicit babysit/merge
  instruction is the unlock; the deny message names the exact marker-removal command.
- **After merge:** verify the landing by content (the merged tree contains the expected
  files/lines — squash merges orphan branch SHAs), clean up worktrees, and skip
  babysit-only ledger pushes (the repo forbids tips whose sole delta is a babysit record).

## 6. Standing approvals map

Granted by the programme's standing decisions (no fresh ask needed):

- Dispatching worker sessions with the HANDOVER prompts; merging worker PRs that are green
  with all required checks and no unresolved actionable threads, when the owner has asked
  for babysit-to-merge on that PR or wave.
- Offline gates, `verify:pr-local`, focused tests, `eval:rag:offline`,
  `check:rag:fixtures` — all local/offline verification.
- Docs-only PRs maintaining HANDOVER/COORDINATION state.

Always a fresh owner ask, every single time:

- Live eval-canary dispatches (each run), any provider-backed eval or live test, live
  Supabase queries, reindexing, migrations, deployment actions, enabling any flag in
  production, and anything in `docs/rag-behaviour/refuted-approaches.md` territory.

## 7. Current state and next actions (update on change)

- **Done:** PR #1895 (guide), PR #1899 (A1 phase 1), PR #1908 (worker handover) — all
  merged 2026-08-13.
- **Next:** dispatch Wave 1 — S1 (Fable, high, plan mode) and S4 (cheaper model, medium,
  no plan mode) in parallel, one session each.
- **Waiting on owner:** nothing until Wave 1 PRs open; then merges, and later S2's canary
  approval.

## 8. Coordination-chat bootstrap prompt

Paste this into a fresh chat to stand up the coordinator:

> You are the coordination chat for the Clinical KB RAG improvement programme in
> BigSimmo/Database. Read, in order: `docs/rag-improvement/COORDINATION.md` (your role,
> history, decisions, playbook), `docs/rag-improvement/HANDOVER.md` (worker packets,
> status table, worker prompts), and skim `docs/rag-improvement/README.md` §5 for the
> track structure. Then verify live state before trusting any of it: check the HANDOVER
> status table against the actual open/merged PRs and branches on GitHub, and note any
> stale rows for correction in the next docs PR.
>
> Report back: (1) current programme state, (2) which wave we are in and what is ready to
> dispatch, (3) the exact tailored prompt(s) for the next worker session(s) per
> COORDINATION §4, and (4) anything waiting on my decision (merges, canary approvals).
> Then wait for my instruction — dispatching sessions, babysitting a PR to merge, or
> approving a canary are my calls, per the standing approvals map in COORDINATION §6.
> Never start implementing a packet yourself in this chat; the coordinator dispatches and
> merges, workers build.
