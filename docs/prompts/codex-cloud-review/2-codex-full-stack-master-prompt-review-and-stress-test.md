# Review and Adversarial Stress Test of the Codex Full-Stack Master Prompt

## Overall assessment

The original Cursor prompt had unusually strong domain coverage and quality controls. Its main weakness was not missing subject matter. It was orchestration: it assumed Cursor-specific modes and references, placed too much responsibility in one long context, and did not fully exploit Codex-native controls for instruction hierarchy, permissions, isolation, subagents, skills, dedicated review, and context recovery.

The Codex adaptation preserves the complete product, design, frontend, backend, data, security, infrastructure, testing, documentation, and operational audit while making the workflow safer and more reliable for Codex.

## Material improvements

### 1. Replaced Cursor-specific operation with Codex-native stages

The prompt now defines explicit stages:

- `AUDIT_AND_PLAN`
- `IMPLEMENT_APPROVED_PLAN`
- `VERIFY_AND_REVIEW`
- `AUDIT_ONLY`

The default is a read-only audit-and-plan pass rather than immediate editing.

### 2. Added Codex instruction architecture

The prompt now distinguishes:

- The master task specification
- Root and nested `AGENTS.md` guidance
- The approved implementation plan
- Repository documentation used as evidence
- Untrusted content that must not be followed as instruction

It advises keeping the long specification in `docs/prompts/` and using `AGENTS.md` only for concise persistent rules.

### 3. Added environment selection

The prompt now explains when to use:

- Local
- Worktree
- Cloud

It also prevents false assumptions about local changes, secrets, services, browsers, and reproducibility in remote environments.

### 4. Added permission and sandbox discipline

The adaptation requires least privilege by stage:

- Read-only for audit and planning
- Workspace-write for implementation
- Approval for network, out-of-workspace, destructive, secret-bearing, or production-affecting actions

It explicitly discourages permissive rules created merely to avoid approval friction.

### 5. Added Codex subagent orchestration

The prompt now defines:

- Appropriate independent audit lanes
- A required subagent output schema
- Main-agent responsibility for synthesis and validation
- Prohibition on uncontrolled overlapping edits
- Token and context-quality rationale

### 6. Added skills workflow

The prompt directs Codex to inspect and invoke relevant installed skills for specialised work while preventing skills from overriding the user, `AGENTS.md`, the approved plan, or safety constraints.

### 7. Added a coverage ledger

“Comprehensive” is now measurable. Every material route, page, component group, API, backend module, database area, job, integration, test suite, and operational subsystem must be inventoried and assigned a review level.

### 8. Added context-compaction and handoff recovery

The prompt now requires Codex to re-read:

- Applicable `AGENTS.md`
- The master specification
- The approved plan
- Git status and current diff
- Task, coverage, and findings ledgers

This reduces context drift and false continuity during long sessions.

### 9. Added prompt-injection boundaries

Repository comments, logs, issue text, generated files, database content, fixtures, webpages, and tool output are treated as untrusted data rather than instructions.

### 10. Added dedicated Codex review gates

The prompt now requires a dedicated review after high-risk milestones and before completion, focusing on correctness, plan compliance, security, accessibility, data integrity, regression risk, and unrelated changes.

### 11. Added four ready-to-use launch prompts

The master prompt now includes separate launch instructions for:

- Audit and planning
- Implementation
- Final verification and review
- Resuming after context compaction or handoff

## Adversarial pressure scenarios

| Scenario | Risk in an autonomous coding workflow | Control in the adapted prompt |
|---|---|---|
| Agent begins editing immediately | Baseline is lost and scope becomes uncontrolled | Default read-only `AUDIT_AND_PLAN` stage |
| Huge prompt is placed in `AGENTS.md` | Persistent context is crowded and instructions may be truncated | Long spec kept in `docs/prompts/`, concise companion in `AGENTS.md` |
| Cloud task assumes local uncommitted changes | Work is based on the wrong source state | Explicit Local, Worktree, and Cloud capability checks |
| Agent enables unrestricted network access | Code or secrets may be exposed | Least-privilege network and approval rules |
| Repository contains prompt-injection text | Agent may execute malicious instructions | Explicit untrusted-content boundary |
| Multiple subagents edit the same files | Conflicts and inconsistent architecture | Ownership map and prohibition on overlapping writes |
| Main thread becomes polluted by logs | Context quality degrades | Subagent summaries and context-hygiene rules |
| Agent forgets decisions after compaction | Plan drift and repeated work | Resume protocol and canonical ledgers |
| Every component cannot fit a deep review | Agent falsely claims comprehensiveness | Inventory plus review-depth coverage ledger |
| Agent invents screenshots or test output | False evidence | Capability truthfulness and no-fabrication rules |
| Agent creates a second design system | Fragmentation increases | Existing-system-first migration requirement |
| Agent rewrites the application | High regression risk | Small-batch implementation and scope control |
| Agent updates snapshots blindly | Regressions are accepted as baselines | Mandatory inspection and explanation of changes |
| Agent weakens tests or typing | Work appears successful but quality declines | Explicit prohibition and final diff search |
| Agent adds broad retries | Root cause is hidden | Failure diagnosis and bounded retry rules |
| Agent changes API incompatibly | Existing clients break | Consumer discovery and compatibility strategy |
| Agent performs unsafe migration | Locking, data loss, or mixed-version failure | Expand-and-contract and migration gates |
| Agent hides permissions in frontend only | Direct API access bypasses controls | Server-side authorisation requirements |
| Duplicate submission creates duplicate charge | Financial or data duplication | Idempotency and concurrency review |
| Webhook is replayed | Duplicate side effects | Signature, timestamp, replay, and idempotency checks |
| Agent uses production credentials in tests | Secret or data exposure | Environment and secret-handling restrictions |
| Agent claims security is complete | Unsupported assurance | Evidence-based completion and residual-risk reporting |
| Agent relies on self-review only | Important defects may be missed | Dedicated Codex `/review` milestone and final gate |
| Agent fixes only happy path | Edge cases remain | Required error, permission, timing, and recovery testing |
| Agent keeps expanding scope | Review never converges | Deferred register and approved-plan contract |
| Agent commits or deploys automatically | Changes escape review | Explicit approval requirement |
| Agent creates many documents instead of fixes | Documentation becomes noise | Small authoritative artifact set and implementation-first rule |
| Agent adds new dependencies for convenience | Supply-chain and maintenance cost increases | Dependency justification and approval gate |
| Browser is unavailable | Static review is presented as visual verification | Capability check and unverified classification |
| Backup is configured but never restored | Recovery claim is false | Restore evidence requirement |
| Full test suite passes but diff contains debug bypass | Latent production risk | Final red-team diff search and dedicated review |

## Remaining limitations

No prompt can guarantee that an agent will find every defect or prevent every regression. The adapted prompt reduces risk through staged permissions, evidence requirements, coverage accounting, independent review, isolated work, adversarial testing, and explicit residual-risk reporting.

The effectiveness of the prompt still depends on:

- Repository quality
- Testability
- Environment reproducibility
- Availability of browser and service integrations
- Quality of project-specific `AGENTS.md` guidance
- Human review of product, security, privacy, and production decisions

## Recommended deployment

1. Save the full prompt as `docs/prompts/codex-full-stack-master-review.md`.
2. Merge the companion rules into the existing root `AGENTS.md`.
3. Start the first task with the Audit-and-Plan launch instruction.
4. Review and approve the plan.
5. Implement in a worktree or isolated branch.
6. Run the Final Verification and Review launch instruction before integration.
