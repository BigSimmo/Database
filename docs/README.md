# Clinical KB Documentation Index

Curated map of everything under `docs/`. Categories distinguish **maintained**
documents (keep these current when behavior changes) from **point-in-time
records** (historical; do not update, supersede with a new dated doc instead).

Check that repo paths referenced from the maintained docs still resolve with:

```bash
npm run docs:check-links
```

## Start here

| Doc                                    | What it is                                                                                              |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| [codebase-index.md](codebase-index.md) | Structured architecture map: layout, module map, Supabase schema, scripts, domain concepts              |
| [site-map.md](site-map.md)             | **Generated** route map — regenerate with `npm run sitemap:update`, verify with `npm run sitemap:check` |
| [agents-guide.md](agents-guide.md)     | Human onboarding pointer; authoritative agent rules live in the root `AGENTS.md`                        |

## Architecture

- [frontend-architecture.md](frontend-architecture.md) — shell, routing, dashboard module structure
- [deployment-architecture.md](deployment-architecture.md) — app/worker/Supabase deployment topology
- [ingestion-state-machine.md](ingestion-state-machine.md) — ingestion job lifecycle and states
- [design-system.md](design-system.md) — tokens, primitives, styling conventions
- [clinical-chat-ui-component-map.md](clinical-chat-ui-component-map.md) — chat UI component inventory
- [clinical-badge-system-guide.md](clinical-badge-system-guide.md) — clinical badge semantics
- [multi-user-auth-setup.md](multi-user-auth-setup.md) — auth, sessions, owner scoping

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
- [observability-slos.md](observability-slos.md) — health probes, SLO counters, degraded modes

## Governance, safety, privacy

- [clinical-governance.md](clinical-governance.md) — deployment and source governance checklist
- [clinical-hazard-analysis.md](clinical-hazard-analysis.md) — clinical hazard register
- [rag-injection-threat-model.md](rag-injection-threat-model.md) — prompt-injection threat model
- [privacy-impact-assessment.md](privacy-impact-assessment.md) — PIA findings and launch blockers
- [openai-cross-border-basis.md](openai-cross-border-basis.md) — cross-border data-processing basis
- [production-readiness-checklist.md](production-readiness-checklist.md) — release readiness criteria

## Process and review

- [process-hardening.md](process-hardening.md) — verification gates, CI expectations, known debts
- [codex-review-protocol.md](codex-review-protocol.md) — shared review protocol for all review skills
- [codex-prompt-playbook.md](codex-prompt-playbook.md) — copy/paste prompts for common repo work
- [branch-cleanup-guide.md](branch-cleanup-guide.md) — branch hygiene workflow
- [branch-review-ledger.md](branch-review-ledger.md) — reviewed branch/SHA ledger (append after reviews)

## Plans and workstreams (living)

- [search-rag-master-plan.md](search-rag-master-plan.md) / [search-rag-master-context.md](search-rag-master-context.md) — search/RAG roadmap and shared context
- [rag-hybrid-findings-and-todo.md](rag-hybrid-findings-and-todo.md) — hybrid retrieval findings backlog
- [reindex-shadow-harness-design.md](reindex-shadow-harness-design.md) — designed-only shadow reindex harness (driver not built)
- [ingestion-concurrency-fix-workorder.md](ingestion-concurrency-fix-workorder.md) — ingestion concurrency workorder
- [redesign/](redesign/) — premium redesign plans, decision log, token adoption
- [superpowers/](superpowers/) — agent-authored plans and specs

## Point-in-time records (historical — do not update)

Dated status reports, reviews, and operator decisions. They describe the repo
as it was on that date; supersede with a new dated document rather than editing.

- [audit/](audit/) — repo and UX/accessibility audits
- [forward-codify-retrieval-rpcs-workorder.md](forward-codify-retrieval-rpcs-workorder.md) — completed retrieval RPC codification workorder
- [project-alignment-cleanup.md](project-alignment-cleanup.md) — completed June 2026 repo-alignment record
- [capacity-review.md](capacity-review.md), [scale-readiness-review.md](scale-readiness-review.md), [tenancy-defense-in-depth-review.md](tenancy-defense-in-depth-review.md)
- `*-2026-*` findings and status docs, e.g. [chunking-ocr-reindex-lever-finding-2026-07-08.md](chunking-ocr-reindex-lever-finding-2026-07-08.md), [source-governance-status-2026-07-08.md](source-governance-status-2026-07-08.md), [source-governance-priorities-2026-07-02.md](source-governance-priorities-2026-07-02.md), [source-review-priority-2026-07-02.md](source-review-priority-2026-07-02.md), [operator-apply-july8-batch.md](operator-apply-july8-batch.md)

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
