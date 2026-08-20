# Clinical KB Documentation Index

Curated map of the load-bearing docs under `docs/` (not an exhaustive listing of every
file). Categories distinguish **maintained** documents (keep these current when behavior
changes) from **point-in-time records** (historical; do not update, supersede with a new
dated doc instead).

Check that repo paths referenced from the maintained docs still resolve with:

```bash
npm run docs:check-links
```

## Start here

| Doc                                    | What it is                                                                                                 |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| [codebase-index.md](codebase-index.md) | Structured architecture map: layout, module map, Supabase schema, scripts, domain concepts                 |
| [site-map.md](site-map.md)             | **Generated** route map — regenerate with `npm run docs:update`, verify with `npm run sitemap:check`       |
| [agents-guide.md](agents-guide.md)     | Human onboarding pointer; Cursor MCP default read path (Supabase, Railway, Context7); rules in `AGENTS.md` |
| [scripts-index.md](scripts-index.md)   | Curated map of `scripts/` and the `package.json` command surface by purpose                                |
| [codex-cloud.md](codex-cloud.md)       | Codex Cloud setup, access profiles, profile-loading command shims, GitHub exception, and acceptance checks |

## Architecture

- [frontend-architecture.md](frontend-architecture.md) — shell, routing, dashboard module structure
- [wiring-conventions.md](wiring-conventions.md) — page/button wiring conventions and the dead-button / orphan-route gates
- [search-chrome-behaviour.md](search-chrome-behaviour.md) — shared search-chrome contract: composer ownership, phone edge-to-edge dock, hide/reveal reserves
- [search-results-bar-decisions.md](search-results-bar-decisions.md) — shared results-bar anatomy, why the filter shelf is scoped to two modes, and what is deliberately not done
- [deployment-architecture.md](deployment-architecture.md) — app/worker/Supabase deployment topology
- [ingestion-state-machine.md](ingestion-state-machine.md) — ingestion job lifecycle and states
- [design-system.md](design-system.md) — tokens, primitives, styling conventions
- [design-system/SPEC.md](design-system/SPEC.md) — the complete v2 design system: roles, rules, rationale (never values)
- [design-system/TOKENS.md](design-system/TOKENS.md) — reconciled token inventory: every role, winning name, owner, and what it replaces
- [design-system/COMPONENTS.md](design-system/COMPONENTS.md) — the eight safety-component specifications plus the maturity matrix
- [design-system/DECISIONS.md](design-system/DECISIONS.md) — conflicts C1–C5 resolved, clinical Q&A record, assumptions, blocked items
- [design-system/GATES.md](design-system/GATES.md) — every design-system rule paired with its enforcement status
- [design-system/ADOPTION.md](design-system/ADOPTION.md) — PR 13 registration record: adoption order, per-surface file allowlists, exclusions, pins, proof shots
- [comparison-behaviour.md](comparison-behaviour.md) — shared selection, state, responsive, and accessibility contract for comparison surfaces
- [clinical-chat-ui-component-map.md](clinical-chat-ui-component-map.md) — chat UI component inventory
- [clinical-badge-system-guide.md](clinical-badge-system-guide.md) — clinical badge semantics
- [multi-user-auth-setup.md](multi-user-auth-setup.md) — auth, sessions, owner scoping
- [pwa.md](pwa.md) — PWA install assets, privacy-first service worker, offline shell
- [webhooks.md](webhooks.md) — the two inbound webhook receivers and the outbound Actions notifier
- [api-jobs-ops-surface.md](api-jobs-ops-surface.md) — standing decision to keep `GET /api/jobs` as an ops/admin surface
- [verified-answer-incremental-delivery-design.md](verified-answer-incremental-delivery-design.md) — staged, clinical-safety-preserving design for delivering verified evidence and answer sections before the canonical final SSE frame

## Operations runbooks

- [launch-operator-runbook.md](launch-operator-runbook.md) — launch/operational duties and SLO probes
- [reindex-runbook.md](reindex-runbook.md) — safe reindex and ingestion recovery
- [retrieval-quality-runbook.md](retrieval-quality-runbook.md) — RAG/retrieval eval gates and tuning
- [worker-deploy-runbook.md](worker-deploy-runbook.md) — worker build contract, run recipe, secrets
- [disaster-recovery-runbook.md](disaster-recovery-runbook.md) — backup/restore and recovery drills
- [auth-connection-cap-runbook.md](auth-connection-cap-runbook.md) — Supabase auth connection cap (operator)
- [staging-setup.md](staging-setup.md) — staging environment bootstrap
- [database-drift-detection.md](database-drift-detection.md) — schema drift detection (`npm run check:drift`)
- [supabase-migration-reconciliation.md](supabase-migration-reconciliation.md) — migration drift and repair policy
- [db-maintenance.md](db-maintenance.md) — Supabase advisor snapshots and the standing disposition per finding class
- [observability-slos.md](observability-slos.md) — health probes, SLO counters, degraded modes
- [openai-rag-operations.md](openai-rag-operations.md) — OpenAI/RAG provider operations and modes
- [outstanding-issues.md](outstanding-issues.md) — single universal task ledger and repository memory
- [operator-backlog.md](operator-backlog.md) — provider/operator runbook detail (status is canonical in the universal ledger)
- [deploy-corrector-public-titles.md](deploy-corrector-public-titles.md) — public-title corrector deploy notes
- [operator-apply-performance-latency-remediation.md](operator-apply-performance-latency-remediation.md) — operator apply steps for the performance/latency migration batch
- [reconciliation-playbook.md](reconciliation-playbook.md) — broad chat/worktree reconciliation and archive-safe cleanup (not for ordinary feature work)
- [staging-tenancy-release-evidence.md](staging-tenancy-release-evidence.md) — cross-tenant staging harness as executable owner-boundary proof

## Governance, safety, privacy

- [clinical-governance.md](clinical-governance.md) — deployment and source governance checklist
- [error-tracking.md](error-tracking.md) — privacy-safe, opt-in production exception tracking envelope
- [governance-incident-runbooks.md](governance-incident-runbooks.md) — operator response checklists for clinical, source, privacy, provider, and answer-pipeline rollback incidents
- [clinical-hazard-analysis.md](clinical-hazard-analysis.md) — clinical hazard register
- [rag-injection-threat-model.md](rag-injection-threat-model.md) — prompt-injection threat model
- [privacy-impact-assessment.md](privacy-impact-assessment.md) — PIA findings and launch blockers
- [openai-cross-border-basis.md](openai-cross-border-basis.md) — cross-border data-processing basis
- [production-readiness-checklist.md](production-readiness-checklist.md) — release readiness criteria
- [samd-classification-medication-considerations.md](samd-classification-medication-considerations.md) — SaMD classification and medication considerations

## Process and review

- [process-hardening.md](process-hardening.md) — verification gates, CI expectations, known debts
- [testing.md](testing.md) — test execution, focused/live commands, Playwright ownership, flake policy
- [phone-chrome-physical-acceptance.md](phone-chrome-physical-acceptance.md) — labelled Safari and cold-launch PWA acceptance matrix
- [productivity-workflows.md](productivity-workflows.md) — repo workflow planners (flightplan, triage, rag-lab, …)
- [codex-review-protocol.md](codex-review-protocol.md) — shared review protocol for all review skills
- [codex-prompt-playbook.md](codex-prompt-playbook.md) — copy/paste prompts for common repo work
- [codex-cloud.md](codex-cloud.md) — reproducible provider-free Codex Cloud environment and acceptance check
- [branch-cleanup-guide.md](branch-cleanup-guide.md) — branch hygiene workflow
- [branch-review-ledger.md](branch-review-ledger.md) — reviewed branch/SHA ledger; read with `npm run ledger:lookup` (historical tables + immutable records), write with `npm run ledger:append`, and convert a pre-system active-branch row with `npm run ledger:migrate-legacy`

## Plans and workstreams (living)

- [maturity-backlog-workorders.md](maturity-backlog-workorders.md) — actionable work orders tracking the repository-maturity audit backlog
- [no-unchecked-indexed-access-migration-plan.md](no-unchecked-indexed-access-migration-plan.md) — staged multi-PR rollout for the `noUncheckedIndexedAccess` TypeScript flag (ledger `#211`)
- [ledger-id-scheme-proposal.md](ledger-id-scheme-proposal.md) — design for collision-free outstanding-issue ids so concurrent sessions stop contending on `issues:next-id` (ledger `#168`)
- [pr-handoff-stop-cross-agent-gap.md](pr-handoff-stop-cross-agent-gap.md) — why the PR-babysit budget is hook-enforced for Claude Code but prose-only for Codex and Cursor, and what parity would require (ledger `#258`)
- [framework-dependency-modernization-checklist.md](framework-dependency-modernization-checklist.md) — ordered Next.js 16, runtime, dependency, Turbopack, and verification migration program
- [search-rag-master-plan.md](search-rag-master-plan.md) / [search-rag-master-context.md](search-rag-master-context.md) — search/RAG roadmap and shared context
- [rag-improvement/README.md](rag-improvement/README.md) — reviewed/updated RAG improvement programme: answer-quality track (intent-aware related information, length) + corrected eval/safety infra track
- [rag-improvement/HANDOVER.md](rag-improvement/HANDOVER.md) — multi-session handover: per-session work packets, status table, checklists, and paste-ready prompts for executing the programme
- [rag-improvement/COORDINATION.md](rag-improvement/COORDINATION.md) — coordinator handover: programme history, wave/session decisions, babysit playbook, approvals map, and the coordination-chat bootstrap prompt
- [rag-improvement/baseline-record.md](rag-improvement/baseline-record.md) — programme evaluation baseline: the six-field report key, gate results, and which gates stay pending an owner-approved provider run
- [rag-improvement/data-flow-register.md](rag-improvement/data-flow-register.md) — Gate A register: every RAG input, process, sink, retention window, provider egress, and the known gaps
- [rag-hybrid-findings-and-todo.md](rag-hybrid-findings-and-todo.md) — hybrid retrieval findings backlog
- [reindex-shadow-harness-design.md](reindex-shadow-harness-design.md) — designed-only shadow reindex harness (driver not built)
- [ingestion-concurrency-fix-workorder.md](ingestion-concurrency-fix-workorder.md) — ingestion concurrency workorder
- [redesign/](redesign/) — premium redesign plans, decision log, token adoption
- [superpowers/](superpowers/) — agent-authored plans and specs

## Subdirectory map

| Directory                        | What lives there                                                                                                      |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| [rag-behaviour/](rag-behaviour/) | Protected retrieval/ranking surface: behaviour map, refuted approaches, safeguards. **Read before touching ranking.** |
| [prompts/](prompts/)             | Copy/paste review prompts, including the verbatim `codex-cloud-review/` inputs                                        |
| [codex/](codex/)                 | Per-lens Codex ultra-review output folders, one per review dimension                                                  |
| [evidence/](evidence/)           | Captured evidence artifacts backing ledger items (reliability reports, review manifests)                              |
| [audit/](audit/)                 | Dated repo, design, accessibility, and latency audits (point-in-time)                                                 |
| [redesign/](redesign/)           | Premium redesign plans, decision log, token adoption                                                                  |
| [superpowers/](superpowers/)     | Agent-authored plans and specs                                                                                        |
| [archive/](archive/)             | Completed phase plans, superseded designs, old progress logs — never current guidance                                 |

## Point-in-time records (historical — do not update)

Dated status reports, reviews, and operator decisions. They describe the repo
as it was on that date; supersede with a new dated document rather than editing.

- [audit/](audit/) — repo and UX/accessibility audits
- [audit/2026-07-20-repository-maturity.md](audit/2026-07-20-repository-maturity.md) — full repository maturity, mapping, and organisation audit
- [audit/latency-audit-2026-07-28.md](audit/latency-audit-2026-07-28.md) — latency audit: server, client, and database findings by tier, with the already-cleared list
- [audit/audit-handover-2026-07-14.md](audit/audit-handover-2026-07-14.md) — multi-skill repository audit findings inventory
- [audit/audit-remediation-plan-2026-07-14.md](audit/audit-remediation-plan-2026-07-14.md) — sequenced remediation plan for the 2026-07-14 audit, with the 2026-07-17 reconciliation
- [audit/design-audit-2026-07-17.md](audit/design-audit-2026-07-17.md) — repository-wide design, accessibility, and interaction audit
- [audit/cloud-connection-acceptance-2026-08-05.md](audit/cloud-connection-acceptance-2026-08-05.md) — hosted versus local MCP boundary acceptance, Personal Pro split control plane, and remaining Cloud launcher blockers
- [audit/claude-code-cloud-connection-acceptance-2026-08-17.md](audit/claude-code-cloud-connection-acceptance-2026-08-17.md) — Claude Code desktop-vs-cloud connector parity check (Railway/Figma/Sentry/Supabase/GitHub live-verified), dependency-currency hook, open Supabase-scope and GitHub-portability items
- [current-clinical-work-brief.md](current-clinical-work-brief.md) — ledger #063 product/privacy/persistence brief (decision only, no implementation)
- [factsheets-reading-model-brief.md](factsheets-reading-model-brief.md) — ledger #041 reading-model decision (no second Factsheets mode)
- [tooling-follow-through-decisions-2026-08-12.md](tooling-follow-through-decisions-2026-08-12.md) — ledger #150 CodeRabbit cap policy and #151 GitHub Actions observation fallback
- [source-governance-refresh-worklist-2026-07-22.md](source-governance-refresh-worklist-2026-07-22.md) — ledger #022 worklist and BMJ attestation policy status
- `release-source-metadata-debt-2026-06-30.json` — captured source-metadata debt policy, consumed by `npm run audit:source-governance:release` and `npm run eval:quality:release`
- [forward-codify-retrieval-rpcs-workorder.md](forward-codify-retrieval-rpcs-workorder.md) — completed retrieval RPC codification workorder
- [project-alignment-cleanup.md](archive/project-alignment-cleanup.md) — completed June 2026 repo-alignment record
- [capacity-review.md](audit/capacity-review.md), [scale-readiness-review.md](audit/scale-readiness-review.md), [tenancy-defense-in-depth-review.md](audit/tenancy-defense-in-depth-review.md)
- `*-2026-*` findings and status docs, e.g. [chunking-ocr-reindex-lever-finding-2026-07-08.md](chunking-ocr-reindex-lever-finding-2026-07-08.md), [source-governance-status-2026-07-08.md](archive/source-governance-status-2026-07-08.md), [source-governance-priorities-2026-07-02.md](archive/source-governance-priorities-2026-07-02.md), [source-review-priority-2026-07-02.md](source-review-priority-2026-07-02.md), [operator-apply-july8-batch.md](archive/operator-apply-july8-batch.md)

## Archive

- [archive/](archive/) — completed phase plans, superseded designs, and old
  progress logs kept for provenance. Never treat archive content as current
  guidance.

## Maintenance rules

- Generated files (`site-map.md`) are updated only via their generator scripts.
- When adding a doc, add it to the matching section here; date the filename if
  it is a point-in-time record.
- When a maintained doc is superseded, move it to `archive/` and update inbound
  links (`npm run docs:check-links` finds broken ones).
